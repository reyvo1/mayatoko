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
  assert.match(css, /@import \"tailwindcss\"/);
  assert.match(css, /\.posWorkspaceNav\{@apply[^}]*grid grid-cols-4/);
  assert.match(css, /\.cart\{@apply[^}]*xl:sticky[^}]*xl:top-\[132px\]/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
  assert.doesNotMatch(css, /overflow-x:auto|overflow-x: auto/);
});

test('UI-P3 POS mobile topbar cannot reintroduce intrinsic horizontal overflow', () => {
  assert.match(shell, /posTopbar sticky[^\r\n]*flex min-w-0 flex-col[^\r\n]*sm:flex-row/);
  assert.match(shell, /posTopbarActions flex w-full min-w-0 flex-wrap[^\r\n]*sm:shrink-0 sm:flex-nowrap/);
  assert.match(css, /\.posTopbarActions label \{ @apply[^}]*min-w-0[^}]*flex-\[1_1_12rem\]/);
  assert.match(css, /\.posTopbarActions label select \{ @apply[^}]*min-w-0[^}]*flex-1/);
  assert.match(css, /@media\(max-width:767px\)[\s\S]*?\.posTopbarActions label \{ width:100%; \}/);
  assert.doesNotMatch(shell, /posTopbarActions flex shrink-0 items-center/);
});
