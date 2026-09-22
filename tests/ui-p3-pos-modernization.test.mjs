import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../apps/pos/app/page.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../apps/pos/app/pos-shell.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../apps/pos/app/globals.css', import.meta.url), 'utf8');

test('UI-P3 splits POS into explicit operator workspaces', () => {
  for (const label of ['Penjualan', 'Shift & Kas', 'Retur', 'Sinkronisasi']) assert.match(shell, new RegExp(label));
  for (const id of ["workspace === 'SALE'", "workspace === 'SHIFT'", "workspace === 'RETURNS'", "workspace === 'SYNC'"]) assert.ok(page.includes(id));
});

test('UI-P3 keeps payment and shift guards fail-closed', () => {
  assert.ok(page.includes('!cart.length || !warehouseId || !shift || !activeQuote || quoteLoading || !!activeQuoteError || paying || !splitReady'));
  assert.ok(page.includes('cart.length > 0 || paying || !apiOnline || ownedOfflineQueue.length > 0'));
});

test('UI-P3 preserves restrictive offline sale rules', () => {
  assert.ok(page.includes("splitEnabled || paymentMethod !== 'CASH'"));
  assert.ok(page.includes('Promo membutuhkan koneksi server.'));
  assert.ok(page.includes('Penukaran poin membutuhkan koneksi server.'));
  assert.ok(page.includes('reservedOfflineQuantity'));
});

test('UI-P3 preserves idempotent replay and conflict retention', () => {
  assert.ok(page.includes('idempotencyKey'));
  assert.ok(page.includes("status: 'CONFLICT' as const"));
  assert.ok(page.includes('Data tidak dibuang dan tidak diduplikasi.'));
});

test('UI-P3 uses responsive flat workspace surfaces without decorative gradient additions', () => {
  assert.match(css, /\.posWorkspaceNav/);
  assert.match(css, /\.posModern \.cart\{position:sticky/);
  const added = css.split('/* ===== UI-P3 POS MODERNIZATION ===== */')[1] ?? '';
  assert.doesNotMatch(added, /linear-gradient|radial-gradient/);
});
