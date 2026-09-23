import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../apps/admin/app/page.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../apps/admin/app/app-shell.tsx', import.meta.url), 'utf8');
const catalog = readFileSync(new URL('../apps/admin/app/domain-workspaces.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../apps/admin/app/globals.css', import.meta.url), 'utf8');
const nestedRoute = readFileSync(new URL('../apps/admin/app/[section]/[view]/page.tsx', import.meta.url), 'utf8');

const requiredRoutes = [
  ['/procurement', ['requests', 'orders', 'receipts', 'inventory']],
  ['/finance', ['ledger', 'payables', 'receivables', 'banking', 'reports']],
  ['/people', ['employees', 'attendance', 'payroll', 'compliance']],
  ['/assets-fleet', ['assets', 'maintenance', 'vehicles', 'trips']],
  ['/platform', ['features', 'users', 'security', 'api-keys']],
];

test('UI-P2 declares stable nested operator workspaces for major Admin domains', () => {
  for (const [route, views] of requiredRoutes) {
    assert.match(catalog, new RegExp(`workspaceKey: '${route.slice(1)}'`));
    for (const view of views) assert.match(catalog, new RegExp(`key: '${view}'`));
  }
  assert.match(catalog, /domainRoute\(workspace: AdminWorkspace, view: AdminDomainView\)/);
  assert.match(nestedRoute, /export \{ default \} from '\.\.\/\.\.\/page'/);
});

test('UI-P2 validates nested paths and falls back safely instead of allowing arbitrary pages', () => {
  assert.match(catalog, /isValidAdminPath/);
  assert.match(catalog, /parts\.length !== 2/);
  assert.match(page, /isValidAdminPath\(pathname, workspace\)/);
  assert.match(page, /router\.replace\(workspace\.route\)/);
});

test('UI-P2 shell exposes one secondary domain navigation layer and third-level breadcrumb without redundant decks', () => {
  assert.match(shell, /resolveDomainViews\(activeWorkspace, manifest, identity\)/);
  assert.match(shell, /className="domainTabs"/);
  assert.match(shell, /activeDomainView\.label/);
  assert.doesNotMatch(shell, /className="domainDeck"|className="domainCard"|Mode kerja:/);
  assert.match(css, /\.domainTabs/);
    assert.match(css, /\.domainDeck\s*,\s*\.domainContext\s*\{\s*@apply hidden;\s*\}/);
  assert.match(css, /\.statusbar\s*\{\s*@apply hidden;\s*\}/);
  assert.doesNotMatch(css, /overflow-x:auto|overflow-x: auto/);
});

test('UI-P2 nested navigation keeps the same domain workspace and business API surface', () => {
  assert.match(page, /const target = workspaceFromPath\(route\)/);
  assert.match(page, /router\.push\(route\)/);
  assert.match(page, /<AccountingView token=\{token\}/);
  assert.match(page, /<HrPayrollView token=\{token\}/);
  assert.match(page, /<AssetsFleetView token=\{token\}/);
  assert.doesNotMatch(catalog, /fetch\(/);
});
