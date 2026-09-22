import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const adminPage = readFileSync(new URL('../apps/admin/app/page.tsx', import.meta.url), 'utf8');
const adminShell = readFileSync(new URL('../apps/admin/app/app-shell.tsx', import.meta.url), 'utf8');
const adminNavigation = readFileSync(new URL('../apps/admin/app/navigation.ts', import.meta.url), 'utf8');
const admin = [adminPage, adminShell, adminNavigation].join('\n');
const adminCss = readFileSync(new URL('../apps/admin/app/globals.css', import.meta.url), 'utf8');
const extensions = readFileSync(new URL('../apps/admin/app/modules/extensions.tsx', import.meta.url), 'utf8');
const payroll = readFileSync(new URL('../apps/admin/app/modules/hr-payroll.tsx', import.meta.url), 'utf8');
const operations = readFileSync(new URL('../apps/admin/app/modules/operations.tsx', import.meta.url), 'utf8');
const assetsFleet = readFileSync(new URL('../apps/admin/app/modules/assets-fleet.tsx', import.meta.url), 'utf8');
const owner = readFileSync(new URL('../apps/admin/app/owner.tsx', import.meta.url), 'utf8');
const pos = readFileSync(new URL('../apps/pos/app/page.tsx', import.meta.url), 'utf8');
const storefront = readFileSync(new URL('../apps/storefront/app/page.tsx', import.meta.url), 'utf8');
const employee = readFileSync(new URL('../apps/employee-portal/app/page.tsx', import.meta.url), 'utf8');
const layouts = [
  '../apps/admin/app/layout.tsx', '../apps/pos/app/layout.tsx', '../apps/storefront/app/layout.tsx', '../apps/employee-portal/app/layout.tsx',
].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');

test('admin navigation only exposes implemented work areas and has a mobile navigation path', () => {
  for (const label of ['Dashboard', 'Owner Suite', 'Master Data', 'Pembelian & Stok', 'Storefront & Fulfillment', 'Retur & Transfer', 'Kontrol Operasional', 'Akuntansi & Kas', 'HRIS & Payroll', 'Aset & Fleet', 'Loyalty & Devices', 'Sistem & Akses']) assert.match(admin, new RegExp(label.replace(/[&]/g, '\\&')));
  assert.doesNotMatch(admin, /Business Intelligence|Laporan Operasional|Audit Trail|Pengaturan Sistem/);
  assert.doesNotMatch(admin, /label: 'Kas & Bank'[\s\S]*label: 'Kas & Bank'/);
  assert.match(admin, /className="mobileNav"/);
  assert.match(adminCss, /\.mobileNav/);
});

test('admin removes decorative fake health controls and confirms high-impact feature flag changes', () => {
  assert.doesNotMatch(admin, /Database Healthy|Queue Healthy|Storage Healthy|Cari menu, transaksi, laporan/);
  assert.match(admin, /featureChange/);
  assert.match(admin, /Perubahan ini memengaruhi kemampuan runtime/);
  assert.match(admin, /API terhubung/);
});

test('native browser prompts are removed from payroll and fulfillment workflows', () => {
  assert.doesNotMatch(extensions, /window\.prompt|window\.confirm|window\.alert/);
  assert.doesNotMatch(payroll, /window\.prompt|window\.confirm|window\.alert/);
  assert.match(extensions, /modalOverlay/);
  assert.match(payroll, /modalOverlay/);
});

test('employee portal derives visible metrics from real attendance and payslip data', () => {
  assert.doesNotMatch(employee, /TUGAS HARI INI|TUGAS SELESAI|CUTI TERPAKAI|<strong>8<\/strong>|<strong>5<\/strong>/);
  assert.match(employee, /attendance\.filter\(\(item\) => Number\(item\.lateMinutes\) > 0\)/);
  assert.match(employee, /payslips\.length/);
  assert.match(employee, /localWorkDate\(\)/);
});

test('authenticated frontends revoke server sessions on logout and do not prefill demo credentials', () => {
  assert.match(admin, /\/auth\/logout/);
  assert.match(pos, /\/auth\/logout/);
  assert.match(employee, /\/auth\/logout/);
  assert.doesNotMatch(admin + pos, /Admin123!|Kasir123!|admin@toko360\.local|kasir@toko360\.local/);
});

test('storefront removes fake merchandising claims and clamps cart quantity to server catalog stock', () => {
  assert.doesNotMatch(storefront, /FLASH SALE|DISKON HINGGA|★★★★★|MOCK_QRIS/);
  assert.match(storefront, /Math\.min\(quantity, stockOf\(item\.product\)\)/);
  assert.match(storefront, /platform\/manifest\?branchCode=\$\{encodeURIComponent\(BRANCH_CODE\)\}/);
  assert.match(storefront, /paymentBusy/);
});

test('production-facing metadata no longer describes apps as starter/demo surfaces', () => {
  assert.doesNotMatch(layouts, /Bagian dari Toko360 Starter|demo|mockup/i);
});


test('operator modules distinguish HTTP failure from a legitimate empty result', () => {
  for (const source of [operations, assetsFleet, owner]) {
    assert.match(source, /if \(!response\.ok\)/);
    assert.match(source, /ErrorState/);
  }
  assert.doesNotMatch(operations + assetsFleet, /\.then\(\(r\) => r\.json\(\)\)\.catch\(\(\) => \[\]\)/);
  assert.match(operations + assetsFleet, /loading=\{loading\}/);
});

test('owner suite uses local business dates and professional icons instead of emoji claims', () => {
  assert.match(owner, /function localDate\(value: Date\)/);
  assert.doesNotMatch(owner, /toISOString\(\)\.slice\(0, 10\)/);
  assert.match(owner, /CircleDollarSign|TrendingDown|Landmark|Package/);
  assert.doesNotMatch(owner, /[💵📉🏆🏦]/u);
  assert.match(owner, /Transaksi yang masih draft\/pending tidak dinyatakan sebagai hasil final/);
});

test('POS makes optional customer-directory degradation visible instead of silently pretending it is empty', () => {
  assert.match(pos, /customerWarning/);
  assert.match(pos, /Direktori pelanggan tidak tersedia/);
  assert.match(pos, /loadCustomerDirectory\(activeToken\)/);
});
