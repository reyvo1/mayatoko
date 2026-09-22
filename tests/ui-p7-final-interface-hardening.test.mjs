import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const shells = {
  admin: read('apps/admin/app/app-shell.tsx'),
  pos: read('apps/pos/app/pos-shell.tsx'),
  storefront: read('apps/storefront/app/storefront-shell.tsx'),
  employee: read('apps/employee-portal/app/employee-portal-shell.tsx'),
};

const css = {
  admin: read('apps/admin/app/globals.css'),
  pos: read('apps/pos/app/globals.css'),
  storefront: read('apps/storefront/app/globals.css'),
  employee: read('apps/employee-portal/app/globals.css'),
};

const browser = read('scripts/browser-uat.mjs');

test('UI-P7 provides skip links and focusable main workspace targets across all operator surfaces', () => {
  assert.match(shells.admin, /className="skipLink" href="#admin-main"/);
  assert.match(shells.admin, /id="admin-main" className="content" tabIndex=\{-1\}/);
  assert.match(shells.pos, /className="skipLink" href="#pos-workspace"/);
  assert.match(shells.pos, /id="pos-workspace" className="posWorkspaceSurface" tabIndex=\{-1\}/);
  assert.match(shells.storefront, /className="skipLink" href="#storefront-main"/);
  assert.match(shells.storefront, /id="storefront-main" className="storefrontMain" tabIndex=\{-1\}/);
  assert.match(shells.employee, /className="skipLink" href="#employee-main"/);
  assert.match(shells.employee, /id="employee-main" className="employeeWorkspace" tabIndex=\{-1\}/);
});

test('UI-P7 exposes active navigation state and operational status semantically', () => {
  assert.match(shells.admin, /role="status" aria-live="polite"/);
  assert.match(shells.pos, /role="status" aria-live="polite"/);
  assert.match(shells.pos, /aria-current=\{workspace === id \? 'page' : undefined\}/);
  assert.match(shells.storefront, /aria-current=\{active \? 'page' : undefined\}/);
  assert.match(shells.employee, /aria-current=\{item\.id === activeView \? 'page' : undefined\}/);
});

test('UI-P7 CSS hardens keyboard focus, reduced motion, and touch targets in every app', () => {
  for (const [name, source] of Object.entries(css)) {
    assert.match(source, /UI-P7 final accessibility and responsive hardening/, `${name} marker`);
    assert.match(source, /:focus-visible/, `${name} focus visible`);
    assert.match(source, /prefers-reduced-motion:\s*reduce/, `${name} reduced motion`);
    assert.match(source, /pointer:coarse/, `${name} coarse pointer`);
    assert.match(source, /min-height:44px/, `${name} touch target`);
  }
});

test('UI-P7 keeps real-browser contracts unchanged while polishing presentation', () => {
  for (const literal of [
    'TOKO360 OFFICIAL STORE',
    'Belanja langsung dari toko',
    'Masuk ke terminal kasir',
    'TOKO360 POS',
    'TOKO360 HR',
    'Portal Karyawan',
  ]) assert.match(browser, new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(shells.pos, /TOKO360 POS/);
  assert.match(shells.pos, /Kasir · Terminal penjualan/);
  assert.match(shells.employee, /TOKO360 HR/);
  assert.match(shells.employee, /Portal Karyawan/);
});

test('UI-P7 mobile navigation remains scrollable and large enough for touch', () => {
  assert.match(css.admin, /workspaceRail,.domainTabs\{scrollbar-width:thin\}/);
  assert.match(css.pos, /\.posWorkspaceNav\{overflow-x:auto/);
  assert.match(css.storefront, /\.mobileNav button\{min-height:52px\}/);
  assert.match(css.employee, /\.employeeMobileNav a\{min-height:44px/);
});
