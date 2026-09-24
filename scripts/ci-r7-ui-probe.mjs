#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { sourceFingerprint } from './lib/source-fingerprint.mjs';

const root = process.cwd();
const input = path.join(root, 'handoff/quality/browser-uat-latest.json');
const output = path.join(root, 'handoff/quality/github-r7-ui-probe-latest.json');
if (!fs.existsSync(input)) throw new Error(`Browser UAT evidence tidak ditemukan: ${input}`);

const browser = JSON.parse(fs.readFileSync(input, 'utf8'));
const current = sourceFingerprint(root);
const evidenceFingerprint = browser?.sourceIdentity?.value || browser?.runtimeSourceFingerprint || null;
if (browser.status !== 'PASS') throw new Error(`Browser UAT belum PASS: ${browser.status}`);
if (!evidenceFingerprint || evidenceFingerprint !== current.value) {
  throw new Error(`R7 browser evidence stale. current=${current.value} evidence=${evidenceFingerprint || '<missing>'}`);
}

const checksById = new Map((browser.checks || []).map((check) => [check.id, check]));
const requirePass = (id) => {
  const check = checksById.get(id);
  if (!check || check.status !== 'PASS') throw new Error(`R7 browser check belum PASS: ${id}`);
  return check;
};

const expectedWorkspaces = [
  'Dashboard', 'Penjualan & Order', 'Pembelian', 'Persediaan', 'Kontrol Operasional',
  'Produk & Master Data', 'Keuangan', 'Laporan & Analitik', 'HRIS & Payroll', 'Aset & Armada',
  'Forecast & Otomasi', 'Integrasi & Notifikasi', 'Tenant & Organisasi', 'Pengaturan & Akses',
];

const responsive = [
  requirePass('ADMIN_RESPONSIVE_SHELL'),
  requirePass('STOREFRONT_NAVIGATION_RUNTIME'),
  requirePass('POS_ALL_WORKSPACES_RUNTIME'),
  requirePass('EMPLOYEE_ALL_SELF_SERVICE_ROUTES'),
];
for (const check of responsive) {
  if (!Array.isArray(check.matrix) || check.matrix.length !== 3 || !check.matrix.every((row) => [1440,1024,390].includes(row.width) && row.scrollWidth <= row.width + 3)) {
    throw new Error(`R7 responsive matrix invalid: ${check.id}`);
  }
}

const nav = requirePass('ADMIN_ALL_NAVIGATION_RUNTIME');
for (const label of expectedWorkspaces) {
  if (!nav.workspaces?.includes(label)) throw new Error(`R7 Admin workspace tidak ditemukan di runtime: ${label}`);
}
if (!Array.isArray(nav.domainViews) || nav.domainViews.length < expectedWorkspaces.length) {
  throw new Error(`R7 contextual navigation belum lengkap: ${nav.domainViews?.length ?? 0}/${expectedWorkspaces.length}`);
}
for (const row of nav.domainViews) {
  if (!Array.isArray(row.domains) || row.domains.length < 1) throw new Error(`R7 workspace tanpa contextual destination: ${row.workspace}`);
}

const analytics = requirePass('ADMIN_CANONICAL_ANALYTICS');
if (analytics.count < 3 || !['line','share-bars','bars'].every((kind) => analytics.kinds?.includes(kind)) || analytics.legacyGradient !== 0) {
  throw new Error(`R7 canonical analytics invalid: ${JSON.stringify(analytics)}`);
}

const result = {
  generatedAt: new Date().toISOString(),
  status: 'PASS',
  sourceIdentity: current,
  checks: {
    primaryNavigation: expectedWorkspaces.length === 14,
    contextualNavigation: true,
    canonicalCharts: true,
    adminResponsive: true,
    posResponsive: true,
    storefrontResponsive: true,
    employeeResponsive: true,
    screenshots: Boolean(nav.screenshot && analytics.screenshot),
  },
  workspaceCount: nav.workspaces.length,
  contextualWorkspaceCount: nav.domainViews.length,
  chartKinds: analytics.kinds,
  productionTouched: false,
  note: 'R7 exact-source browser evidence proves one primary + one contextual Admin IA, canonical chart primitives, desktop/tablet/mobile no-overflow geometry, and screenshot artifacts while Human Stage-20 remains separate.',
};
if (!Object.values(result.checks).every(Boolean)) throw new Error(`R7 UI checks incomplete: ${JSON.stringify(result.checks)}`);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
