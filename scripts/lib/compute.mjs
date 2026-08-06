const MONTH_ABBR = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

// Turns "Nov '25" or "November 2025" into a sortable "2025-11" key.
function monthStringToKey(s) {
  const m = s.match(/([A-Za-z]{3,})\D*(\d{2,4})/);
  if (!m) return 'unassigned';
  const abbr = m[1].slice(0, 3).toLowerCase();
  let year = m[2];
  if (year.length === 2) year = `20${year}`;
  const mm = MONTH_ABBR[abbr];
  if (!mm) return 'unassigned';
  return `${year}-${mm}`;
}

function dateToKey(dateStr) {
  return dateStr.slice(0, 7);
}

function monthLabel(key) {
  if (key === 'unassigned') return 'Unassigned';
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// Nights the unit could have been booked in this month, accounting for a mid-month launch.
function availableNights(key, launchDate) {
  const [y, m] = key.split('-').map(Number);
  const total = daysInMonth(y, m);
  if (!launchDate) return total;
  const launchKey = launchDate.slice(0, 7);
  if (key < launchKey) return 0;
  if (key === launchKey) {
    const launchDay = Number(launchDate.slice(8, 10));
    return total - launchDay + 1;
  }
  return total;
}

function emptyMonth(key) {
  return {
    key,
    label: monthLabel(key),
    grossRevenue: 0,
    otaCommission: 0,
    netRevenue: 0,
    nights: 0,
    bySource: {},
    expenses: 0,
    expenseLines: [],
    mgmtFee: 0,
    netIncome: 0,
    laundryTotal: 0,
    cleaningTotal: 0,
    reservations: [],
    notes: [],
  };
}

// Aggregates raw Reservations / Expense Log / Owner Remittance Log / Report Notes rows
// into a month-by-month report for one unit. mgmtFeePct is applied to (Rate - OTA
// Commission); Laundry/Cleaning fees are tracked per-reservation but excluded from this
// calculation, since that treatment varies by unit's owner agreement (not yet standardized).
export function buildReport(unit, { reservations, expenses, remittances, notes }) {
  const months = new Map();
  const getMonth = (key) => {
    if (!months.has(key)) months.set(key, emptyMonth(key));
    return months.get(key);
  };

  for (const r of reservations) {
    if (r.status !== 'Booked' || !r.checkIn) continue;
    const m = getMonth(dateToKey(r.checkIn));
    const rate = r.rate || 0;
    const commission = r.otaCommission || 0;
    const nights = r.nights || 1;
    m.grossRevenue += rate;
    m.otaCommission += commission;
    m.netRevenue += rate - commission;
    m.nights += nights;
    m.bySource[r.source || 'Unknown'] = (m.bySource[r.source || 'Unknown'] || 0) + nights;
    m.laundryTotal += r.laundryFee || 0;
    m.cleaningTotal += r.cleaningFee || 0;
    m.reservations.push(r);
  }
  for (const m of months.values()) {
    m.reservations.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  }

  for (const e of expenses) {
    // "In-House Only" expenses are costs Co-Host absorbs itself (e.g. internal staff
    // time) — they never reach the owner's report or reduce the owner's net income.
    if (e.ownerVisibility === 'In-House Only') continue;
    const key = e.date ? dateToKey(e.date) : e.month ? monthStringToKey(e.month) : 'unassigned';
    const m = getMonth(key);
    m.expenses += e.amount || 0;
    m.expenseLines.push(e);
  }

  const overallNotes = [];
  for (const n of notes) {
    if (!n.period) continue;
    if (n.period.trim().toLowerCase() === 'overall') {
      overallNotes.push(n);
      continue;
    }
    const key = monthStringToKey(n.period);
    if (key === 'unassigned') continue;
    getMonth(key).notes.push(n);
  }

  for (const m of months.values()) {
    m.mgmtFee = m.netRevenue * unit.mgmtFeePct;
    m.netIncome = m.netRevenue - m.mgmtFee - m.expenses;
    m.availableNights = availableNights(m.key, unit.launchDate);
    m.occupancyPct = m.availableNights > 0 ? (m.nights / m.availableNights) * 100 : 0;
    m.adr = m.nights > 0 ? m.grossRevenue / m.nights : 0;
    m.commissionPct = m.grossRevenue > 0 ? (m.otaCommission / m.grossRevenue) * 100 : 0;
  }

  // Newest month first, per Coco's requested layout.
  const sortedMonths = [...months.values()]
    .filter((m) => m.key !== 'unassigned')
    .sort((a, b) => b.key.localeCompare(a.key));
  const unassigned = months.get('unassigned');

  const totals = sortedMonths.reduce(
    (acc, m) => {
      acc.grossRevenue += m.grossRevenue;
      acc.otaCommission += m.otaCommission;
      acc.netRevenue += m.netRevenue;
      acc.expenses += m.expenses;
      acc.mgmtFee += m.mgmtFee;
      acc.netIncome += m.netIncome;
      acc.nights += m.nights;
      acc.availableNights += m.availableNights;
      acc.laundryTotal += m.laundryTotal;
      acc.cleaningTotal += m.cleaningTotal;
      return acc;
    },
    { grossRevenue: 0, otaCommission: 0, netRevenue: 0, expenses: 0, mgmtFee: 0, netIncome: 0, nights: 0, availableNights: 0, laundryTotal: 0, cleaningTotal: 0 }
  );
  if (unassigned) {
    totals.expenses += unassigned.expenses;
    totals.netIncome -= unassigned.expenses;
  }
  totals.occupancyPct = totals.availableNights > 0 ? (totals.nights / totals.availableNights) * 100 : 0;
  totals.adr = totals.nights > 0 ? totals.grossRevenue / totals.nights : 0;
  totals.commissionPct = totals.grossRevenue > 0 ? (totals.otaCommission / totals.grossRevenue) * 100 : 0;

  const remittanceTotal = remittances.reduce((sum, r) => sum + (r.amount || 0), 0);

  // Best/worst month by net income, for the worked formula example and quick reference.
  const bestMonth = sortedMonths.reduce((a, b) => (!a || b.netIncome > a.netIncome ? b : a), null);
  const exampleMonth = sortedMonths.find((m) => m.nights > 0 && m.otaCommission > 0) || sortedMonths[0];

  return {
    unit,
    months: sortedMonths,
    unassignedExpenses: unassigned,
    totals,
    remittances,
    remittanceTotal,
    overallNotes,
    bestMonth,
    exampleMonth,
    generatedAt: new Date().toISOString(),
  };
}
