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
  };
}

// Aggregates raw Reservations / Expense Log / Owner Remittance Log rows into a
// month-by-month report for one unit. mgmtFeePct is applied to (Rate - OTA Commission);
// Laundry/Cleaning fees are tracked per-reservation but excluded from this calculation,
// since Coco confirmed that treatment varies by unit's owner agreement (not yet standardized).
export function buildReport(unit, { reservations, expenses, remittances }) {
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
    const nights = r.nights || 0;
    m.grossRevenue += rate;
    m.otaCommission += commission;
    m.netRevenue += rate - commission;
    m.nights += nights;
    m.bySource[r.source || 'Unknown'] = (m.bySource[r.source || 'Unknown'] || 0) + nights;
  }

  for (const e of expenses) {
    const key = e.date ? dateToKey(e.date) : e.month ? monthStringToKey(e.month) : 'unassigned';
    const m = getMonth(key);
    m.expenses += e.amount || 0;
    m.expenseLines.push(e);
  }

  for (const m of months.values()) {
    m.mgmtFee = m.netRevenue * unit.mgmtFeePct;
    m.netIncome = m.netRevenue - m.mgmtFee - m.expenses;
  }

  const sortedMonths = [...months.values()]
    .filter((m) => m.key !== 'unassigned')
    .sort((a, b) => a.key.localeCompare(b.key));
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
      return acc;
    },
    { grossRevenue: 0, otaCommission: 0, netRevenue: 0, expenses: 0, mgmtFee: 0, netIncome: 0, nights: 0 }
  );
  if (unassigned) {
    totals.expenses += unassigned.expenses;
    totals.netIncome -= unassigned.expenses;
  }

  const remittanceTotal = remittances.reduce((sum, r) => sum + (r.amount || 0), 0);

  return {
    unit,
    months: sortedMonths,
    unassignedExpenses: unassigned,
    totals,
    remittances,
    remittanceTotal,
    generatedAt: new Date().toISOString(),
  };
}
