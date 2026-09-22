import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../apps/admin/app/page.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../apps/admin/app/app-shell.tsx', import.meta.url), 'utf8');
const domain = readFileSync(new URL('../apps/admin/app/domain-workspaces.ts', import.meta.url), 'utf8');
const navigation = readFileSync(new URL('../apps/admin/app/navigation.ts', import.meta.url), 'utf8');

test('UI-P6 resolves nested domain views from canonical source plus runtime constraints', () => {
  assert.match(domain, /export function resolveDomainViews/);
  assert.match(domain, /enabledModuleCodes\(manifest/);
  assert.match(domain, /identityCanSeeView\(identity, view\)/);
  assert.match(domain, /readDomainOverrides\(manifest, workspace\)/);
  assert.match(domain, /override\?\.hidden === true/);
  assert.match(domain, /view\.moduleCodes\.some/);
});

test('UI-P6 UiSchema overrides remain presentation-only and canonical', () => {
  assert.match(domain, /\.filter\(\(item\) => item\.surface\.toLowerCase\(\) === 'admin'\)/);
  assert.match(domain, /domainViews/);
  assert.match(domain, /override\.workspace !== workspace\.key/);
  assert.match(domain, /overrides\.has\(override\.key\)/);
  assert.match(domain, /label: typeof override\?\.label/);
  assert.match(domain, /title: typeof override\?\.title/);
  assert.match(domain, /description: typeof override\?\.description/);
  assert.doesNotMatch(domain, /fetch\(/);
});

test('UI-P6 shell uses runtime-resolved nested views and exposes runtime status', () => {
  assert.match(shell, /resolveDomainViews\(activeWorkspace, manifest, identity\)/);
  assert.match(shell, /module aktif/);
  assert.match(shell, /Admin UI schema/);
  assert.match(page, /identity=\{identity\}/);
});

test('UI-P6 redirects a runtime-hidden nested deep link to canonical domain root', () => {
  assert.match(page, /const visibleViews = resolveDomainViews\(activeWorkspace, manifest, identity\)/);
  assert.match(page, /router\.replace\(activeWorkspace\.route\)/);
  assert.match(page, /parts\.length !== 2/);
});

test('UI-P6 preserves top-level fail-closed navigation and backend authority', () => {
  assert.match(navigation, /resolveAdminNavigation/);
  assert.match(navigation, /manifest\.features\?\.\[module\.featureKey\]\?\.enabled === true/);
  assert.match(navigation, /identity\.permissions/);
  assert.match(page, /authFetch/);
});
