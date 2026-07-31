function peso(n) {
  const v = Number(n) || 0;
  const sign = v < 0 ? '−' : '';
  return `${sign}₱${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function pct(n) {
  return `${(Number(n) || 0).toFixed(1)}%`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function esc(s) {
  return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

const NOTE_BADGE = { Highlight: 'badge-good', 'Improvement Area': 'badge-watch', 'Action Item': 'badge-action' };

function noteCard(n) {
  const badgeClass = NOTE_BADGE[n.type] || 'badge-watch';
  return `
    <div class="note-card">
      <div class="note-head"><span class="note-badge ${badgeClass}">${esc(n.type || 'Note')}</span><span class="note-title">${esc(n.title)}</span></div>
      <div class="note-body">${esc(n.note)}</div>
    </div>`;
}

function dailyRow(r) {
  const net = (r.rate || 0) - (r.otaCommission || 0);
  const isContinuation = !r.rate && !r.otaCommission;
  return `<tr${isContinuation ? ' class="cont-row"' : ''}>
    <td>${fmtDate(r.checkIn)}</td>
    <td>${esc(r.source)}</td>
    <td>${peso(r.rate)}</td>
    <td>${peso(r.otaCommission)}</td>
    <td>${peso(net)}</td>
    <td class="notes-cell">${esc(r.notes)}</td>
  </tr>`;
}

function monthCard(m, idx) {
  const netClass = m.netIncome >= 0 ? 'pos' : 'neg';
  const sourceRows = Object.entries(m.bySource)
    .sort((a, b) => b[1] - a[1])
    .map(([src, nights]) => `<div class="stat-mini"><div class="stat-mini-label">${esc(src)}</div><div class="stat-mini-val">${nights} nights</div></div>`)
    .join('');
  const expenseRows = m.expenseLines
    .map((e) => `<tr><td>${esc(e.name)}</td><td>${esc(e.category)}</td><td>${peso(e.amount)}</td><td>${esc(e.status)}</td></tr>`)
    .join('');
  const dailyRows = m.reservations.map(dailyRow).join('');
  const monthNotes = m.notes.map(noteCard).join('');

  return `
  <div class="month-card">
    <div class="month-header" onclick="toggleMonth(${idx})">
      <div>
        <div class="month-name">${esc(m.label)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${m.nights} of ${m.availableNights} nights booked · ${pct(m.occupancyPct)} occupancy</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <span class="month-net-preview ${netClass}">${peso(m.netIncome)}</span>
        <span class="chevron" id="chevron-${idx}">▼</span>
      </div>
    </div>
    <div class="month-body" id="body-${idx}">
      <div class="stat-row">
        <div class="stat-mini"><div class="stat-mini-label">Occupancy</div><div class="stat-mini-val">${pct(m.occupancyPct)}</div></div>
        <div class="stat-mini"><div class="stat-mini-label">Average Daily Rate</div><div class="stat-mini-val">${peso(m.adr)}</div></div>
        <div class="stat-mini"><div class="stat-mini-label">Mgmt fee</div><div class="stat-mini-val">${peso(m.mgmtFee)}</div></div>
      </div>
      <div class="stat-row">${sourceRows || '<div class="stat-mini"><div class="stat-mini-label">Nights by platform</div><div class="stat-mini-val">No bookings logged yet</div></div>'}</div>
      <div class="stat-row">
        <div class="stat-mini"><div class="stat-mini-label">Laundry fees collected</div><div class="stat-mini-val">${peso(m.laundryTotal)}</div></div>
        <div class="stat-mini"><div class="stat-mini-label">Cleaning fees collected</div><div class="stat-mini-val">${peso(m.cleaningTotal)}</div></div>
        <div class="stat-mini"><div class="stat-mini-label">Total pass-through</div><div class="stat-mini-val">${peso(m.laundryTotal + m.cleaningTotal)}</div></div>
      </div>
      ${monthNotes ? `<div class="note-list">${monthNotes}</div>` : ''}
      ${
        dailyRows
          ? `<div class="sub-heading">Daily Bookings</div><div class="table-scroll"><table class="expense-table"><thead><tr><th>Date</th><th>Platform</th><th>Rate</th><th>Commission</th><th>Net</th><th>Notes</th></tr></thead><tbody>${dailyRows}</tbody></table></div>`
          : ''
      }
      ${
        expenseRows
          ? `<div class="sub-heading">Expenses</div><table class="expense-table"><thead><tr><th>Expense</th><th>Category</th><th>Amount</th><th>Status</th></tr></thead><tbody>${expenseRows}</tbody></table>`
          : ''
      }
    </div>
  </div>`;
}

function formulasSection(report) {
  const { unit, exampleMonth, totals } = report;
  const feePct = pct(unit.mgmtFeePct * 100);
  const ex = exampleMonth;
  const exNet = ex ? ex.grossRevenue - ex.otaCommission : 0;
  const exFee = ex ? ex.mgmtFee : 0;
  const exIncome = ex ? ex.netIncome : 0;

  return `
  <div class="section-eyebrow">No Guesswork</div>
  <div class="section-heading">How every number<br>on this page is calculated.</div>
  <div class="section-intro">You shouldn't have to trust a number you can't trace. Here's exactly how we get from "a guest paid us" to "here's your income" — using ${ex ? esc(ex.label) : 'a real month'} from your own data as the example.</div>

  <div class="explain-box">
    <strong>Step 1 — Guest Revenue.</strong> This is simply what the guest paid for the stay. In ${ex ? esc(ex.label) : 'this month'}, guests paid a total of <strong>${peso(ex ? ex.grossRevenue : 0)}</strong> across all bookings.
  </div>

  <div class="explain-box">
    <strong>Step 2 — Subtract the booking platform's commission.</strong> Airbnb, Booking.com, and Agoda each take a cut for bringing you the guest — that money never reaches you or Co-Host Solutions:
    <ul class="formula-list">
      <li><strong>Airbnb</strong> takes about <span class="rate-red">4%</span> of the booking</li>
      <li><strong>Booking.com</strong> takes about <span class="rate-red">16.5%</span></li>
      <li><strong>Agoda</strong> takes about <span class="rate-red">17%</span></li>
      <li><strong>Direct bookings</strong> (no platform involved) take <span class="rate-green">0%</span> — this is why direct guests are worth more to you per peso of rate charged</li>
    </ul>
    In ${ex ? esc(ex.label) : 'this month'}, platform commissions totaled <strong>${peso(ex ? ex.otaCommission : 0)}</strong>.
  </div>

  <div class="explain-box">
    <strong>Step 3 — Net Revenue.</strong> Guest Revenue minus platform commission:<br>
    ${peso(ex ? ex.grossRevenue : 0)} − ${peso(ex ? ex.otaCommission : 0)} = <strong>${peso(exNet)}</strong>
  </div>

  <div class="explain-box">
    <strong>Step 4 — Management Fee.</strong> Co-Host Solutions' fee is <strong>${feePct}</strong> of Net Revenue (not the full guest revenue — the platform's cut is already removed first):<br>
    ${peso(exNet)} × ${feePct} = <strong>${peso(exFee)}</strong>
  </div>

  <div class="explain-box">
    <strong>Step 5 — Running Costs.</strong> Everything it costs to keep the unit operating that month — condo rent, electricity, water, internet, supplies, maintenance — plus the management fee above. Laundry and cleaning fees collected from guests are handled separately: they're passed straight through to cover the actual laundry/cleaning service, so they don't count as your income or your cost here.
  </div>

  <div class="explain-box">
    <strong>Step 6 — Net Income to you.</strong> Net Revenue minus Management Fee minus that month's Running Costs (excluding the fee, already subtracted):<br>
    ${peso(exNet)} − ${peso(exFee)} − ${peso((ex ? ex.expenses : 0))} = <strong>${peso(exIncome)}</strong>
  </div>

  <div class="divider"></div>

  <div class="explain-box">
    <strong>Occupancy % — how full the calendar was.</strong> Nights actually booked, divided by nights the unit was available to book that month. Lifetime so far: ${totals.nights} of ${totals.availableNights} available nights = <strong>${pct(totals.occupancyPct)}</strong>.
  </div>

  <div class="explain-box">
    <strong>Average Daily Rate (ADR) — the average price per night.</strong> Total Guest Revenue divided by nights booked. Lifetime: ${peso(totals.grossRevenue)} ÷ ${totals.nights} nights = <strong>${peso(totals.adr)}</strong> per night.
  </div>
  `;
}

export function renderReport(report) {
  const { unit, months, totals, remittances, remittanceTotal, generatedAt, overallNotes } = report;
  const lastUpdated = new Date(generatedAt).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });

  const monthCards = months.map((m, i) => monthCard(m, i)).join('\n');
  const overallNoteCards = overallNotes.map(noteCard).join('');

  const remittanceRows = remittances
    .map((r) => `<tr><td>${esc(r.entry)}</td><td>${esc(r.type)}</td><td>${esc(r.periodCovered)}</td><td>${peso(r.amount)}</td><td>${esc(r.status)}</td></tr>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(unit.name)} — Owner Report</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --cream: #F7F3ED; --warm-white: #FDFAF6; --charcoal: #1C1A17; --brown: #3D2E1E;
    --gold: #B8860B; --gold-light: #E8C96A; --gold-pale: #FBF3DC;
    --green: #1E5C3A; --green-light: #D4EDDA; --red: #8B2020; --red-light: #FAE0E0;
    --amber: #7A4A00; --amber-light: #FFF0CC; --blue: #1E4E8C; --blue-light: #DCE8FB;
    --border: #E2D9CC; --text-muted: #7A6E62; --text-body: #3D3530;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: var(--cream); color: var(--text-body); line-height: 1.6; }
  .report-header { background: var(--brown); color: var(--cream); padding: 60px 48px 52px; }
  .header-label { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gold-light); margin-bottom: 14px; }
  .header-title { font-family: 'DM Serif Display', serif; font-size: 40px; line-height: 1.15; color: #fff; margin-bottom: 10px; }
  .header-sub { font-size: 15px; color: rgba(247,243,237,0.65); }
  .nav-bar { background: var(--warm-white); border-bottom: 1px solid var(--border); padding: 0 48px; position: sticky; top: 0; z-index: 100; display: flex; gap: 0; overflow-x: auto; }
  .nav-btn { font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; color: var(--text-muted); background: none; border: none; border-bottom: 2px solid transparent; padding: 16px 20px; cursor: pointer; white-space: nowrap; }
  .nav-btn:hover { color: var(--brown); }
  .nav-btn.active { color: var(--brown); border-bottom-color: var(--gold); font-weight: 600; }
  .content { max-width: 900px; margin: 0 auto; padding: 48px 48px 80px; }
  .section { display: none; } .section.active { display: block; }
  .section-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--gold); margin-bottom: 8px; }
  .section-heading { font-family: 'DM Serif Display', serif; font-size: 28px; color: var(--brown); margin-bottom: 12px; line-height: 1.25; }
  .section-intro { font-size: 14.5px; color: var(--text-muted); margin-bottom: 28px; max-width: 640px; }
  .sub-heading { font-size: 13px; font-weight: 700; color: var(--brown); text-transform: uppercase; letter-spacing: 0.06em; margin: 20px 0 8px; }
  .hero-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 20px; }
  .hero-card { background: var(--warm-white); border: 1px solid var(--border); border-radius: 14px; padding: 24px 26px; }
  .hero-card.green-card { background: var(--green); border-color: var(--green); }
  .hero-label { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px; }
  .hero-card.green-card .hero-label { color: rgba(255,255,255,0.6); }
  .hero-value { font-family: 'DM Serif Display', serif; font-size: 32px; color: var(--brown); }
  .hero-card.green-card .hero-value { color: #fff; }
  .divider { height: 1px; background: var(--border); margin: 28px 0; }
  .month-grid { display: flex; flex-direction: column; gap: 20px; margin-bottom: 36px; }
  .month-card { background: var(--warm-white); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
  .month-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--border); cursor: pointer; }
  .month-header:hover { background: var(--cream); }
  .month-name { font-family: 'DM Serif Display', serif; font-size: 20px; color: var(--brown); }
  .month-net-preview { font-family: 'DM Serif Display', serif; font-size: 20px; }
  .pos { color: var(--green); } .neg { color: var(--red); }
  .month-body { padding: 24px; display: none; } .month-body.open { display: block; }
  .stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
  .stat-mini { background: var(--cream); border-radius: 10px; padding: 14px 16px; }
  .stat-mini-label { font-size: 11px; color: var(--text-muted); margin-bottom: 4px; }
  .stat-mini-val { font-size: 16px; font-weight: 600; color: var(--brown); }
  .table-scroll { overflow-x: auto; }
  .expense-table, .remit-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 4px; }
  .expense-table th, .remit-table th { text-align: left; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); padding: 8px 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
  .expense-table td, .remit-table td { padding: 8px 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
  .notes-cell { white-space: normal !important; color: var(--text-muted); font-size: 12px; min-width: 160px; }
  .cont-row td { color: var(--text-muted); font-style: italic; }
  .chevron { font-size: 12px; color: var(--text-muted); transition: transform 0.2s; }
  .chevron.open { transform: rotate(180deg); }
  .report-footer { background: var(--brown); color: rgba(247,243,237,0.65); padding: 28px 48px; font-size: 12px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  .report-footer strong { color: var(--gold-light); }
  .note-list { display: flex; flex-direction: column; gap: 10px; margin: 8px 0 18px; }
  .note-card { background: var(--warm-white); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; }
  .note-head { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
  .note-title { font-weight: 600; font-size: 13.5px; color: var(--brown); }
  .note-body { font-size: 13px; color: var(--text-muted); line-height: 1.6; }
  .note-badge { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; padding: 3px 9px; border-radius: 99px; }
  .badge-good { background: var(--green-light); color: var(--green); }
  .badge-watch { background: var(--amber-light); color: var(--amber); }
  .badge-action { background: var(--blue-light); color: var(--blue); }
  .explain-box { background: var(--gold-pale); border-left: 3px solid var(--gold); border-radius: 0 10px 10px 0; padding: 16px 20px; margin: 16px 0; font-size: 13.5px; color: var(--amber); line-height: 1.75; }
  .explain-box strong { color: var(--brown); }
  .formula-list { margin: 10px 0 0 18px; }
  .formula-list li { margin-bottom: 4px; }
  .rate-red { color: var(--red); font-weight: 700; }
  .rate-green { color: var(--green); font-weight: 700; }
  @media (max-width: 640px) {
    .report-header { padding: 40px 24px; } .header-title { font-size: 28px; } .content { padding: 32px 24px 60px; } .nav-bar { padding: 0 24px; }
    .hero-grid { grid-template-columns: 1fr; } .stat-row { grid-template-columns: repeat(2, 1fr); }
  }
</style>
</head>
<body>

<div class="report-header">
  <div class="header-label">Co-Host Solutions · Owner Report</div>
  <div class="header-title">${esc(unit.name)}<br>${esc(unit.propertyLabel)}</div>
  <div class="header-sub">${esc(unit.location)} · Prepared for ${esc(unit.ownerLabel)}</div>
</div>

<nav class="nav-bar">
  <button class="nav-btn active" onclick="showSection('overview', this)">Overview</button>
  <button class="nav-btn" onclick="showSection('monthly', this)">Monthly Breakdown</button>
  <button class="nav-btn" onclick="showSection('formulas', this)">How We Calculate This</button>
</nav>

<div class="content">

  <div id="overview" class="section active">
    <div class="section-eyebrow">Lifetime Summary</div>
    <div class="section-heading">Here's how ${esc(unit.name)}<br>has done since day one.</div>

    <div class="hero-grid">
      <div class="hero-card">
        <div class="hero-label">Total collected from guests</div>
        <div class="hero-value">${peso(totals.grossRevenue)}</div>
      </div>
      <div class="hero-card">
        <div class="hero-label">Running costs (incl. mgmt fee)</div>
        <div class="hero-value">${peso(totals.expenses + totals.mgmtFee)}</div>
      </div>
      <div class="hero-card green-card">
        <div class="hero-label">Net income to owner</div>
        <div class="hero-value">${peso(totals.netIncome)}</div>
      </div>
      <div class="hero-card">
        <div class="hero-label">Total remitted to owner</div>
        <div class="hero-value">${peso(remittanceTotal)}</div>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-mini"><div class="stat-mini-label">Occupancy (lifetime)</div><div class="stat-mini-val">${pct(totals.occupancyPct)}</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Average Daily Rate</div><div class="stat-mini-val">${peso(totals.adr)}</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Platform commission</div><div class="stat-mini-val">${pct(totals.commissionPct)} of revenue</div></div>
    </div>
    <div class="stat-row">
      <div class="stat-mini"><div class="stat-mini-label">Laundry fees collected (lifetime)</div><div class="stat-mini-val">${peso(totals.laundryTotal)}</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Cleaning fees collected (lifetime)</div><div class="stat-mini-val">${peso(totals.cleaningTotal)}</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Total pass-through</div><div class="stat-mini-val">${peso(totals.laundryTotal + totals.cleaningTotal)}</div></div>
    </div>

    ${overallNoteCards ? `<div class="sub-heading">Notes from Co-Host Solutions</div><div class="note-list">${overallNoteCards}</div>` : ''}
  </div>

  <div id="monthly" class="section">
    <div class="section-eyebrow">Month by Month</div>
    <div class="section-heading">Newest month first.<br>Tap any month for the full detail.</div>
    <div class="month-grid">
      ${monthCards || '<div class="month-card" style="padding:24px;color:var(--text-muted)">No reservations logged yet. Once daily bookings are entered in Notion, they will appear here automatically.</div>'}
    </div>

    <div class="divider"></div>

    <div class="section-eyebrow">Owner Remittance History</div>
    <div class="section-heading">Every payout, logged.</div>
    <div class="table-scroll">
    <table class="remit-table">
      <thead><tr><th>Entry</th><th>Type</th><th>Period</th><th>Amount</th><th>Status</th></tr></thead>
      <tbody>${remittanceRows || '<tr><td colspan="5" style="color:var(--text-muted)">No remittance entries logged yet.</td></tr>'}</tbody>
    </table>
    </div>
  </div>

  <div id="formulas" class="section">
    ${formulasSection(report)}
  </div>

</div>

<div class="report-footer">
  <div><strong>Co-Host Solutions</strong> — Owner Financial Report</div>
  <div>Last updated: ${esc(lastUpdated)}</div>
</div>

<script>
  function toggleMonth(idx) {
    document.getElementById('body-' + idx).classList.toggle('open');
    document.getElementById('chevron-' + idx).classList.toggle('open');
  }
  function showSection(id, btn) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
</script>
</body>
</html>
`;
}
