import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../apps/admin/app/page.tsx', import.meta.url), 'utf8');
const navigation = readFileSync(new URL('../apps/admin/app/navigation.ts', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../apps/admin/app/app-shell.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../apps/admin/app/globals.css', import.meta.url), 'utf8');
const dynamicRoute = readFileSync(new URL('../apps/admin/app/[section]/page.tsx', import.meta.url), 'utf8');

const expectedRoutes = [
  '/dashboard', '/owner', '/master-data', '/procurement', '/commerce', '/inventory-control',
  '/operations-control', '/finance', '/people', '/assets-fleet', '/extensions', '/platform',
];

test('UI-P1 gives every implemented Admin workspace a canonical route', () => {
  for (const route of expectedRoutes) assert.match(navigation, new RegExp(`route: '${route.replaceAll('/', '\\/')}'`));
  assert.match(dynamicRoute, /export \{ default \} from '\.\.\/page'/);
  assert.match(page, /usePathname\(\)/);
  assert.match(page, /router\.push\(target\.route\)/);
});

test('UI-P1 navigation is resolved from runtime modules, features, permissions and UI schema', () => {
  assert.match(navigation, /manifest\.modules\.filter/);
  assert.match(navigation, /manifest\.features\?\.\[module\.featureKey\]\?\.enabled === true/);
  assert.match(navigation, /identity\.permissions/);
  assert.match(navigation, /identity\.roles/);
  assert.match(navigation, /manifest\?\.uiSchemas/);
  assert.match(navigation, /navigation = \(candidate\.schema as Record<string, unknown>\)\.navigation/);
  assert.match(page, /resolveAdminNavigation\(manifest, identity\)/);
  assert.doesNotMatch(page, /const NAV:/);
});

test('UI-P1 application shell exposes workspace search, collapsible sidebar, breadcrumb and branch context', () => {
  assert.match(page, /<AdminAppShell/);
  assert.match(shell, /Cari workspace/);
  assert.match(shell, /sidebarCollapsed/);
  assert.match(shell, /aria-label="Breadcrumb"/);
  assert.match(shell, /manifest\?\.branch\?\.name/);
  assert.match(shell, /workspaceRail/);
  assert.match(css, /\.sidebarCollapsed \.sidebar/);
  assert.match(css, /\.breadcrumbs/);
  assert.match(css, /\.workspaceRail/);
});

test('UI-P1 preserves fail-closed backend authorization while using token claims only for UI visibility', () => {
  assert.match(navigation, /identityFromAccessToken/);
  assert.match(navigation, /window\.atob/);
  assert.doesNotMatch(navigation, /fetch\(/);
  assert.match(page, /authFetch/);
});

test('UI-P1 follows dark restrained design tokens without adding decorative gradients to shell overrides', () => {
  assert.match(css, /--bg: #0b0e14/);
  assert.match(css, /--panel: #131722/);
  assert.match(css, /--accent: #6366f1/);
  const block = css.slice(css.indexOf('UI-P1 — Admin application shell'));
  assert.doesNotMatch(block, /linear-gradient\(/);
  assert.match(block, /max-width: 1440px/);
  assert.match(block, /width: 240px/);
});
