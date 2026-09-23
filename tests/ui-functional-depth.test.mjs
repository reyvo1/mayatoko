import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

function assertContainsAll(source, values) {
  for (const value of values) {
    assert.ok(
      source.includes(value),
      `Expected source to contain: ${value}`,
    );
  }
}

test('finance domain exposes enterprise workspaces', () => {
  const source = read('apps/admin/app/domain-workspaces.ts');

  assertContainsAll(source, [
    "key: 'ledger'",
    "key: 'tax'",
    "key: 'fiscal'",
    "key: 'payables'",
    "key: 'receivables'",
    "key: 'banking'",
    "key: 'reports'",
    'Jurnal & Ledger',
    'Periode Fiskal',
    'Laporan Keuangan',
  ]);
});

test('master data exposes product multi-UOM and pricing as first-class workspaces', () => {
  const source = read('apps/admin/app/domain-workspaces.ts');

  assertContainsAll(source, [
    "key: 'catalog'",
    "key: 'products'",
    "key: 'pricing'",
    "key: 'organization'",
    "key: 'locations'",
    "key: 'references'",
    'Produk & Satuan',
    'multi-UOM',
    'PCS/BOTOL/PACK/LUSIN/DUS',
  ]);
});

test('page resolves active domain workspace and passes authoritative mode', () => {
  const source = read('apps/admin/app/page.tsx');

  assertContainsAll(source, [
    'resolvedDomainViewFromPath',
    'activeDomainView',
    'AccountingView',
    'MasterDataView',
  ]);

  assert.match(
    source,
    /AccountingView[\s\S]{0,1200}(mode|activeDomainView)|(mode|activeDomainView)[\s\S]{0,1200}AccountingView/,
  );
  assert.match(
    source,
    /MasterDataView[\s\S]{0,1200}(mode|activeDomainView)|(mode|activeDomainView)[\s\S]{0,1200}MasterDataView/,
  );
});

test('accounting workspace exposes complete enterprise finance capabilities', () => {
  const source = read('apps/admin/app/modules/accounting.tsx');

  assert.match(
    source,
    /AccountingView\s*\(\s*\{\s*token\s*,\s*mode\s*\}/,
    'AccountingView harus menerima finance workspace mode',
  );

  assertContainsAll(source, [
    '/accounting-core/events?limit=20',
    '/accounting-core/tax-codes',
    '/accounting-core/accounts',
    '/finance-operations?limit=50',
    '/finance-operations/supplier-payables',
    '/finance-operations/supplier-refunds',
    '/finance-operations/customer-receivables',
    '/finance/fiscal-periods',
    '/finance/bank-statements',
    '/finance/reconciliations',
    '/reports/jobs?limit=50',
    'PROFIT_LOSS',
    'TRIAL_BALANCE',
    'BALANCE_SHEET',
    'GENERAL_LEDGER',
    'TAX_SUMMARY',
    'RECEIVABLES',
    'PAYABLES',
  ]);
});

test('master-data workspace exposes catalog, UOM conversion, pricing and organization capabilities', () => {
  const source = read('apps/admin/app/modules/master-data.tsx');

  assert.match(
    source,
    /MasterDataView\s*\(\s*\{\s*token\s*,\s*mode\s*\}/,
    'MasterDataView harus menerima master-data workspace mode',
  );

  assertContainsAll(source, [
    '/master-data/categories',
    '/master-data/customers',
    '/master-data/branches',
    '/master-data/warehouses',
    '/master-data/warehouse-locations',
    '/master-data/references',
    '/products?limit=100',
    'Barcode & Konversi Unit',
    'quantityFactor',
    'unitCode',
    'segmentCode',
    'minQty',
  ]);
});
