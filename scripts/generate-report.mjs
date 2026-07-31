import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { queryDataSource, prop } from './lib/notion.mjs';
import { buildReport } from './lib/compute.mjs';
import { renderReport } from './lib/render.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

const unitsConfig = JSON.parse(await readFile(path.join(repoRoot, 'config', 'units.json'), 'utf8'));

const unitFlagIdx = process.argv.indexOf('--unit');
const filterSlug = unitFlagIdx !== -1 ? process.argv[unitFlagIdx + 1] : null;
const units = filterSlug ? unitsConfig.filter((u) => u.slug === filterSlug) : unitsConfig;

if (units.length === 0) {
  console.error(`No unit found matching slug "${filterSlug}". Available: ${unitsConfig.map((u) => u.slug).join(', ')}`);
  process.exit(1);
}

function mapReservation(p) {
  return {
    guestName: prop(p, 'Guest Name'),
    checkIn: prop(p, 'Check-in')?.start,
    checkOut: prop(p, 'Check-out')?.start,
    nights: prop(p, 'Nights'),
    source: prop(p, 'Source'),
    rate: prop(p, 'Rate (PHP)'),
    laundryFee: prop(p, 'Laundry Fee (PHP)'),
    cleaningFee: prop(p, 'Cleaning Fee (PHP)'),
    otaCommission: prop(p, 'OTA Commission (PHP)'),
    status: prop(p, 'Status'),
  };
}

function mapExpense(p) {
  return {
    name: prop(p, 'Expense'),
    month: prop(p, 'Month'),
    date: prop(p, 'Date')?.start,
    category: prop(p, 'Category'),
    amount: prop(p, 'Amount (PHP)'),
    status: prop(p, 'Status'),
    notes: prop(p, 'Notes'),
  };
}

function mapRemittance(p) {
  return {
    entry: prop(p, 'Entry'),
    date: prop(p, 'Date')?.start,
    type: prop(p, 'Type'),
    periodCovered: prop(p, 'Period Covered'),
    amount: prop(p, 'Amount (PHP)'),
    status: prop(p, 'Status'),
    notes: prop(p, 'Notes'),
  };
}

const generated = [];

for (const unit of units) {
  console.log(`Generating report for ${unit.name} (${unit.slug})...`);
  const [resPages, expPages, remPages] = await Promise.all([
    queryDataSource(unit.notion.reservations),
    queryDataSource(unit.notion.expenses),
    queryDataSource(unit.notion.remittance),
  ]);

  const report = buildReport(unit, {
    reservations: resPages.map(mapReservation),
    expenses: expPages.map(mapExpense),
    remittances: remPages.map(mapRemittance),
  });

  const html = renderReport(report);
  const outDir = path.join(repoRoot, 'docs', unit.slug);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'index.html'), html);
  console.log(`  -> docs/${unit.slug}/index.html`);
  generated.push(unit);
}

// Regenerate the landing page so it always lists exactly what's been built.
// This page is an INTERNAL directory for Coco's own reference — it lists every
// owner and unit on one page, so it must never be the link handed to an owner.
// Only the unit-specific URL (docs/<slug>/) is safe to share externally.
const TOTAL_UNITS_PLANNED = 8;
const landingLinks = unitsConfig
  .map(
    (u) =>
      `<li><a href="./${u.slug}/">${u.name} — ${u.propertyLabel}</a> <span style="color:#7A6E62">(${u.ownerLabel})</span></li>`
  )
  .join('\n      ');
const isPilot = unitsConfig.length < TOTAL_UNITS_PLANNED;

const landingHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Co-Host Solutions — Owner Reports (Internal)</title>
<style>
  body { font-family: 'DM Sans', Arial, sans-serif; background: #F7F3ED; color: #3D3530; max-width: 640px; margin: 60px auto; padding: 0 24px; }
  h1 { font-size: 24px; color: #3D2E1E; }
  .warning { background: #FBF3DC; border-left: 3px solid #B8860B; border-radius: 0 8px 8px 0; padding: 14px 18px; margin: 20px 0; font-size: 13.5px; line-height: 1.6; }
  .warning strong { color: #3D2E1E; }
  .status { background: #FDFAF6; border: 1px solid #E2D9CC; border-radius: 8px; padding: 10px 16px; font-size: 13px; color: #7A6E62; margin-bottom: 8px; display: inline-block; }
  ul { list-style: none; padding: 0; margin-top: 24px; }
  li { padding: 14px 0; border-bottom: 1px solid #E2D9CC; }
  a { color: #3D2E1E; font-weight: 600; text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
  <h1>Co-Host Solutions — Owner Reports</h1>
  <div class="status">${unitsConfig.length} of ${TOTAL_UNITS_PLANNED} units live${isPilot ? ' — pilot phase, more being added' : ''}</div>
  <div class="warning">
    <strong>Internal use only.</strong> This page lists every unit and owner together — do not send this link to owners. Copy each unit's own link below (e.g. <code>/1215/</code>) and share only that one with its owner.
  </div>
  <ul>
      ${landingLinks}
  </ul>
</body>
</html>
`;
await writeFile(path.join(repoRoot, 'docs', 'index.html'), landingHtml);

console.log(`Done. Generated ${generated.length} report(s).`);
