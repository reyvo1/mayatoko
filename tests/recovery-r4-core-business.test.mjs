import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');

const supplierSchema = read('apps/api/prisma/schema.prisma');
const supplierPgSchema = read('apps/api/prisma/schema.postgresql.prisma');
const supplierController = read('apps/api/src/suppliers/suppliers.controller.ts');
const supplierService = read('apps/api/src/suppliers/suppliers.service.ts');
const poService = read('apps/api/src/purchase-orders/purchase-orders.service.ts');
const prService = read('apps/api/src/purchase-orders/purchase-requests.service.ts');
const goodsController = read('apps/api/src/goods-receipts/goods-receipts.controller.ts');
const goodsService = read('apps/api/src/goods-receipts/goods-receipts.service.ts');
const inventoryController = read('apps/api/src/inventory/inventory.controller.ts');
const adminPage = read('apps/admin/app/page.tsx');
const accountingController = read('apps/api/src/accounting-core/accounting-core.controller.ts');
const accountingService = read('apps/api/src/accounting-core/accounting-core.service.ts');
const accountingUi = read('apps/admin/app/modules/accounting.tsx');
const reportController = read('apps/api/src/reports/reports.controller.ts');
const reportingUi = read('apps/admin/app/modules/reporting-workspace.tsx');
const platformController = read('apps/api/src/platform/platform.controller.ts');
const platformService = read('apps/api/src/platform/platform.service.ts');
const storefrontPage = read('apps/storefront/app/page.tsx');
const storefrontShell = read('apps/storefront/app/storefront-shell.tsx');
const promotionsService = read('apps/api/src/promotions/promotions.service.ts');
const extensionsUi = read('apps/admin/app/modules/extensions.tsx');
const r4Probe = read('scripts/ci-r4-core-business-probe.mjs');
const fullSystemWorkflow = read('.github/workflows/full-system-simulation.yml');
const fullUatWorkflow = read('.github/workflows/toko360-full-uat.yml');
const fullSystemSummary = read('scripts/ci-write-full-system-summary.mjs');
const githubUatReport = read('scripts/github-uat-report.mjs');
const packageJson = read('package.json');
const migrationManifest = read('config/expand-migration-order.json');
const supplierPgMigration = read('database/migrations/T360-20260924-r4-supplier-lifecycle/postgresql-expand.sql');
const supplierSqliteMigration = read('database/migrations/T360-20260924-r4-supplier-lifecycle/sqlite-expand.sql');
const state = read('docs/PROJECT-STATE.md');
const handoff = read('handoff/CURRENT-WORK.md');

test('R4 supplier lifecycle uses a new expand-only migration in both database providers', () => {
  assert.match(migrationManifest, /T360-20260924-r4-supplier-lifecycle/);
  assert.match(supplierPgMigration, /ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE/);
  assert.match(supplierSqliteMigration, /ALTER TABLE "Supplier" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT 1/);
});

test('R4 supplier lifecycle is tenant-scoped and inactive suppliers cannot enter new procurement', () => {
  for (const schema of [supplierSchema, supplierPgSchema]) assert.match(schema, /model Supplier[\s\S]*isActive\s+Boolean\s+@default\(true\)/);
  assert.match(supplierController, /@Patch\(':id'\)[\s\S]*@Permissions\('supplier\.update'\)/);
  assert.match(supplierController, /@Get\(':id'\)[\s\S]*@Permissions\('supplier\.view'\)/);
  assert.match(supplierService, /includeInactiveValue === 'true'/);
  assert.match(supplierService, /action: 'UPDATE_SUPPLIER'/);
  assert.match(poService, /supplierId[\s\S]*companyId: scope\.companyId, isActive: true/);
  assert.match(prService, /companyId: scope\.companyId, isActive: true/);
  assert.match(adminPage, /Supplier lifecycle/);
  assert.match(adminPage, /Nonaktifkan/);
});

test('R4 exposes canonical inventory movement ledger without introducing a balance mutation endpoint', () => {
  assert.match(inventoryController, /@Get\('movements'\)/);
  assert.match(adminPage, /Canonical inventory movements/);
  assert.match(adminPage, /\/inventory\/movements\?limit=100/);
  assert.doesNotMatch(inventoryController, /@(?:Post|Patch|Delete)\('movements/);
});

test('R4 goods receipt reject is a real pre-posting operator action', () => {
  assert.match(goodsController, /@Permissions\('goods_receipt\.reject'\)[\s\S]*@Post\(':id\/reject'\)/);
  assert.match(goodsService, /Penerimaan yang sudah diposting harus diretur\/reversal, bukan ditolak/);
  assert.match(goodsService, /operationalStatus: 'REJECTED'/);
  assert.match(adminPage, /submitReceiptReject/);
  assert.match(adminPage, /goods-receipts\/\$\{receiptReject\.id\}\/reject/);
  assert.match(adminPage, />Tolak<\/button>/);
});

test('R4 AccountingCloseControl is used by API, operator UI, audit, and posting enforcement', () => {
  assert.match(accountingController, /@Get\('close-controls'\)/);
  assert.match(accountingController, /@Post\('close-controls\/:id\/close'\)/);
  assert.match(accountingController, /@Post\('close-controls\/:id\/reopen'\)/);
  assert.match(accountingService, /accountingCloseControl\.findFirst/);
  assert.match(accountingService, /status: 'CLOSED'/);
  assert.match(accountingService, /Accounting close control .* menutup posting/);
  assert.match(accountingService, /action: 'CLOSE_ACCOUNTING_CONTROL'/);
  assert.match(accountingService, /action: 'REOPEN_ACCOUNTING_CONTROL'/);
  assert.match(accountingUi, /ACCOUNTING CLOSE CONTROL/);
});

test('R4 exposes General Ledger report in Admin instead of export-only discoverability', () => {
  assert.match(reportController, /@Get\('general-ledger'\)/);
  assert.match(reportingUi, /GENERAL LEDGER/);
  assert.match(reportingUi, /\/reports\/general-ledger\?/);
  assert.match(reportingUi, /Tampilkan buku besar/);
});

test('R4 storefront branch is runtime-selectable and env is bootstrap fallback only', () => {
  assert.match(platformController, /@Public\(\) @Get\('storefront-branches'\)/);
  assert.match(platformService, /storefrontBranches\(branchCode\?/);
  assert.match(platformService, /companyId: tenant\.companyId, isActive: true/);
  assert.match(storefrontPage, /DEFAULT_BRANCH_CODE/);
  assert.match(storefrontPage, /toko360\.storefront\.branch/);
  assert.match(storefrontPage, /platform\/storefront-branches\?branchCode=/);
  assert.match(storefrontPage, /function changeBranch/);
  assert.match(storefrontShell, /Pilih cabang storefront/);
});

test('R4 advanced promotion remains server-authoritative and has operator lifecycle controls', () => {
  for (const token of ['QUANTITY_BREAK', 'BOGO', 'BUNDLE']) assert.match(promotionsService, new RegExp(token));
  assert.match(promotionsService, /resolveSalePromotion/);
  assert.match(extensionsUi, /updatePromoStatus/);
  assert.match(extensionsUi, /Nonaktifkan/);
  assert.match(extensionsUi, /Aktifkan/);
});

test('R4 live PostgreSQL probe is mandatory in both GitHub workflows and aggregate evidence', () => {
  assert.match(packageJson, /\"ci:r4:probe\": \"node scripts\/ci-r4-core-business-probe\.mjs\"/);
  for (const workflow of [fullSystemWorkflow, fullUatWorkflow]) {
    assert.match(workflow, /id: r4_core_business/);
    assert.match(workflow, /npm run ci:r4:probe/);
  }
  assert.match(fullUatWorkflow, /check \"R4 core-business runtime probe\" \"\$STEP_R4_CORE_BUSINESS\"/);
  assert.match(githubUatReport, /R4 core-business runtime probe/);
  assert.match(fullSystemSummary, /github-r4-core-business-probe-latest\.json/);
  assert.match(fullSystemSummary, /r4CoreBusiness/);
  for (const token of ['inactiveSupplierRejectedForProcurement','goodsReceiptRejectPrePosting','accountingCloseBlocksPosting','generalLedgerVisible','storefrontBranchRuntime','advancedPromotionLifecycle']) assert.match(r4Probe, new RegExp(token));
});

test('R3 remains open while R4 runs as an explicit parallel recovery work item', () => {
  assert.match(handoff, /R3 is IMPLEMENTATION/);
  assert.match(handoff, /R4 is \*\*IMPLEMENTATION\*\*/);
  assert.match(state, /Recovery R3/);
  assert.match(state, /Recovery R4/);
});

test('R4 npm runtime probe registration is present and points to the committed probe file', () => {
  const packageJson = JSON.parse(read('package.json'));
  assert.equal(packageJson.scripts?.['ci:r4:probe'], 'node scripts/ci-r4-core-business-probe.mjs');
  assert.match(read('scripts/ci-r4-core-business-probe.mjs'), /R4/);
  assert.match(read('.github/workflows/toko360-full-uat.yml'), /run: npm run ci:r4:probe/);
  assert.match(read('.github/workflows/full-system-simulation.yml'), /run: npm run ci:r4:probe/);
});
