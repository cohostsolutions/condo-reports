function peso(n) {
  const v = Number(n) || 0;
  const sign = v < 0 ? '−' : '';
  return `${sign}₱${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function esc(s) {
  return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function monthCard(m, idx) {
  const netClass = m.netIncome >= 0 ? 'pos' : 'neg';
  const sourceRows = Object.entries(m.bySource)
    .sort((a, b) => b[1] - a[1])
    .map(([src, nights]) => `<div class="stat-mini"><div class="stat-mini-label">${esc(src)}</div><div class="stat-mini-val">${nights} nights</div></div>`)
    .join('');
  const expenseRows = m.expenseLines
    .map(
      (e) =>
        `<tr><td>${esc(e.name)}</td><td>${esc(e.category)}</td><td>${peso(e.amount)}</td><td>${esc(e.status)}</td></tr>`
    )
    .join('');

  return `
  <div class="month-card">
    <div class="month-header" onclick="toggleMonth(${idx})">
      <div>
        <div class="month-name">${esc(m.label)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${m.nights} nights booked</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <span class="month-net-preview ${netClass}">${peso(m.netIncome)}</span>
        <span class="chevron" id="chevron-${idx}">▼</span>
      </div>
    </div>
    <div class="month-body" id="body-${idx}">
      <div class="stat-row">
        <div class="stat-mini"><div class="stat-mini-label">Guest revenue</div><div class="stat-mini-val">${peso(m.grossRevenue)}</div></div>
        <div class="stat-mini"><div class="stat-mini-label">OTA commission</div><div class="stat-mini-val">${peso(m.otaCommission)}</div></div>
        <div class="stat-mini"><div class="stat-mini-label">Mgmt fee</div><div class="stat-mini-val">${peso(m.mgmtFee)}</div></div>
      </div>
      <div class="stat-row">${sourceRows || '<div class="stat-mini"><div class="stat-mini-label">Nights by source</div><div class="stat-mini-val">No bookings logged yet</div></div>'}</div>
      ${
        expenseRows
          ? `<table class="expense-table"><thead><tr><th>Expense</th><th>Category</th><th>Amount</th><th>Status</th></tr></thead><tbody>${expenseRows}</tbody></table>`
          : ''
      }
    </div>
  </div>`;
}

export function renderReport(report) {
  const { unit, months, totals, remittances, remittanceTotal, generatedAt } = report;
  const lastUpdated = new Date(generatedAt).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });

  const monthCards = months.map((m, i) => monthCard(m, i)).join('\n');

  const remittanceRows = remittances
    .map(
      (r) =>
        `<tr><td>${esc(r.entry)}</td><td>${esc(r.type)}</td><td>${esc(r.periodCovered)}</td><td>${peso(r.amount)}</td><td>${esc(r.status)}</td></tr>`
    )
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
    --border: #E2D9CC; --text-muted: #7A6E62; --text-body: #3D3530;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: var(--cream); color: var(--text-body); line-height: 1.6; }
  .report-header { background: var(--brown); color: var(--cream); padding: 60px 48px 52px; }
  .header-label { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gold-light); margin-bottom: 14px; }
  .header-title { font-family: 'DM Serif Display', serif; font-size: 40px; line-height: 1.15; color: #fff; margin-bottom: 10px; }
  .header-sub { font-size: 15px; color: rgba(247,243,237,0.65); }
  .content { max-width: 900px; margin: 0 auto; padding: 48px 48px 80px; }
  .section-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--gold); margin-bottom: 8px; }
  .section-heading { font-family: 'DM Serif Display', serif; font-size: 28px; color: var(--brown); margin-bottom: 24px; }
  .hero-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 36px; }
  .hero-card { background: var(--warm-white); border: 1px solid var(--border); border-radius: 14px; padding: 24px 26px; }
  .hero-card.green-card { background: var(--green); border-color: var(--green); }
  .hero-label { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px; }
  .hero-card.green-card .hero-label { color: rgba(255,255,255,0.6); }
  .hero-value { font-family: 'DM Serif Display', serif; font-size: 32px; color: var(--brown); }
  .hero-card.green-card .hero-value { color: #fff; }
  .divider { height: 1px; background: var(--border); margin: 32px 0; }
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
  .expense-table, .remit-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px; }
  .expense-table th, .remit-table th { text-align: left; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); padding: 8px 12px; border-bottom: 1px solid var(--border); }
  .expense-table td, .remit-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); }
  .chevron { font-size: 12px; color: var(--text-muted); transition: transform 0.2s; }
  .chevron.open { transform: rotate(180deg); }
  .report-footer { background: var(--brown); color: rgba(247,243,237,0.65); padding: 28px 48px; font-size: 12px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  .report-footer strong { color: var(--gold-light); }
  @media (max-width: 640px) {
    .report-header { padding: 40px 24px; } .header-title { font-size: 28px; } .content { padding: 32px 24px 60px; }
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

<div class="content">

  <div class="section-eyebrow">Your Big Picture</div>
  <div class="section-heading">Here's how ${esc(unit.name)}<br>has been doing.</div>

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

  <div class="divider"></div>

  <div class="section-eyebrow">Month by Month</div>
  <div class="section-heading">Tap a month to see the full breakdown.</div>
  <div class="month-grid">
    ${monthCards || '<div class="month-card" style="padding:24px;color:var(--text-muted)">No reservations logged yet. Once daily bookings are entered in Notion, they will appear here automatically.</div>'}
  </div>

  <div class="divider"></div>

  <div class="section-eyebrow">Owner Remittance History</div>
  <div class="section-heading">Every payout, logged.</div>
  <table class="remit-table">
    <thead><tr><th>Entry</th><th>Type</th><th>Period</th><th>Amount</th><th>Status</th></tr></thead>
    <tbody>${remittanceRows || '<tr><td colspan="5" style="color:var(--text-muted)">No remittance entries logged yet.</td></tr>'}</tbody>
  </table>

</div>

<div class="report-footer">
  <div><strong>Co-Host Solutions</strong> — Owner Financial Report</div>
  <div>Last updated: ${esc(lastUpdated)}</div>
</div>

<script>
  function toggleMonth(idx) {
    const body = document.getElementById('body-' + idx);
    const chevron = document.getElementById('chevron-' + idx);
    body.classList.toggle('open');
    chevron.classList.toggle('open');
  }
</script>
</body>
</html>
`;
}
