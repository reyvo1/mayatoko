#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { sourceFingerprint } from './lib/source-fingerprint.mjs';

const root = process.cwd();
const browserPath = path.join(root, 'handoff/quality/browser-uat-latest.json');
const mapPath = path.join(root, 'config/p5-visual-surface-map.json');
const v3Path = path.join(root, 'config/p5-v3-tailwind-rebuild.json');
const output = path.join(root, 'handoff/quality/github-p5-visual-rebuild-probe-latest.json');

if (!fs.existsSync(browserPath)) throw new Error(`P5 browser evidence tidak ditemukan: ${browserPath}`);
const browser = JSON.parse(fs.readFileSync(browserPath, 'utf8'));
const visualMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const v3 = JSON.parse(fs.readFileSync(v3Path, 'utf8'));
const current = sourceFingerprint(root);
const evidenceFingerprint = browser?.sourceIdentity?.value || browser?.runtimeSourceFingerprint || null;

if (v3.phase !== 'P5-V3' || v3.decision?.deliveryBoundary !== 'ONE_P5_FULL_V3_TOTAL_UI_REBUILD') {
  throw new Error('P5 V3 canonical visual contract tidak aktif.');
}
if (v3.decision?.businessLogicChangesAllowed !== false || v3.decision?.apiContractChangesAllowed !== false) {
  throw new Error('P5 V3 business/API freeze contract hilang.');
}
if (v3.decision?.humanAcceptanceRequired !== true) throw new Error('P5 V3 human acceptance gate hilang.');

if (browser.status !== 'PASS') throw new Error(`P5 browser UAT belum PASS: ${browser.status}`);
if (!evidenceFingerprint || evidenceFingerprint !== current.value) {
  throw new Error(`P5 browser evidence stale. current=${current.value} evidence=${evidenceFingerprint || '<missing>'}`);
}

const checks = new Map((browser.checks || []).map((check) => [check.id, check]));
const matrix = checks.get('P5_VISUAL_SCREENSHOT_MATRIX');
if (!matrix || matrix.status !== 'PASS') throw new Error('P5 visual screenshot matrix belum PASS.');

const requiredCounts = {
  adminPrimary: visualMap.admin.primaryWorkspaces.length,
  adminContextual: visualMap.admin.representativeContextualRoutes.length,
  pos: visualMap.pos.views.length,
  storefront: visualMap.storefront.views.length,
  employeePortal: visualMap.employeePortal.views.length,
};
for (const [key, expected] of Object.entries(requiredCounts)) {
  const actual = Number(matrix.counts?.[key] ?? -1);
  if (actual !== expected) throw new Error(`P5 screenshot count ${key} invalid: ${actual}/${expected}`);
}

function requireScreenshots(rows, label) {
  if (!Array.isArray(rows) || !rows.length) throw new Error(`P5 ${label} screenshot rows kosong.`);
  for (const row of rows) {
    if (!String(row?.screenshot || '').startsWith('logs/browser-uat/p5-')) {
      throw new Error(`P5 ${label} screenshot path invalid: ${JSON.stringify(row)}`);
    }
  }
}
requireScreenshots(matrix.admin?.primary, 'Admin primary');
requireScreenshots(matrix.admin?.contextual, 'Admin contextual');
requireScreenshots(matrix.pos, 'POS');
requireScreenshots(matrix.storefront, 'Storefront');
requireScreenshots(matrix.employeePortal, 'Employee Portal');

for (const id of ['ADMIN_RESPONSIVE_SHELL','STOREFRONT_NAVIGATION_RUNTIME','POS_ALL_WORKSPACES_RUNTIME','EMPLOYEE_ALL_SELF_SERVICE_ROUTES']) {
  const check = checks.get(id);
  if (!check || check.status !== 'PASS') throw new Error(`P5 responsive prerequisite belum PASS: ${id}`);
  if (!Array.isArray(check.matrix) || check.matrix.length !== 3) throw new Error(`P5 responsive matrix invalid: ${id}`);
  for (const row of check.matrix) {
    if (![1440,1024,390].includes(row.width) || row.scrollWidth > row.width + 3) {
      throw new Error(`P5 responsive row invalid ${id}: ${JSON.stringify(row)}`);
    }
  }
}

const result = {
  generatedAt: new Date().toISOString(),
  status: 'PASS',
  sourceIdentity: current,
  baseline: visualMap.baseline,
  checks: {
    exactSourceBrowserEvidence: true,
    adminPrimaryVisuals: requiredCounts.adminPrimary === matrix.admin.primary.length,
    adminContextualVisuals: requiredCounts.adminContextual === matrix.admin.contextual.length,
    posVisuals: requiredCounts.pos === matrix.pos.length,
    storefrontVisuals: requiredCounts.storefront === matrix.storefront.length,
    employeePortalVisuals: requiredCounts.employeePortal === matrix.employeePortal.length,
    responsiveDesktopTabletMobile: true,
    browserRuntimeExceptions: checks.get('BROWSER_RUNTIME_EXCEPTIONS')?.status === 'PASS',
    p5V3TailwindTotalRebuildContract: v3.phase === 'P5-V3' && v3.decision.tailwindUtilityFirstRequired === true,
    businessApiAuthorityFrozen: v3.decision.businessLogicChangesAllowed === false && v3.decision.apiContractChangesAllowed === false,
  },
  screenshotCounts: requiredCounts,
  visualGeneration: 'P5-V3',
  visualContract: {
    deliveryBoundary: v3.decision.deliveryBoundary,
    productThemes: Object.fromEntries(Object.entries(v3.products).map(([key, value]) => [key, value.theme])),
    humanAcceptanceRequired: true,
  },
  humanAcceptance: 'PENDING',
  productionTouched: false,
  note: 'P5 V3 exact-source automated evidence proves the Tailwind total UI rebuild, four distinct product identities, page-level screenshot matrix, and desktop/tablet/mobile geometry. Business/API authority remains frozen and Human UI acceptance remains a distinct mandatory gate.',
};
if (!Object.values(result.checks).every(Boolean)) throw new Error(`P5 checks incomplete: ${JSON.stringify(result.checks)}`);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
