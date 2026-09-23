import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = {
  admin: readFileSync(new URL('../apps/admin/app/globals.css', import.meta.url), 'utf8'),
  pos: readFileSync(new URL('../apps/pos/app/globals.css', import.meta.url), 'utf8'),
  storefront: readFileSync(new URL('../apps/storefront/app/globals.css', import.meta.url), 'utf8'),
  employee: readFileSync(new URL('../apps/employee-portal/app/globals.css', import.meta.url), 'utf8'),
};

function f12(css) {
  const index = css.indexOf('F12 FINAL');
  assert.notEqual(index, -1, 'F12 marker missing');
  return css.slice(index);
}

test('F12 keeps the four user surfaces on restrained flat visual systems', () => {
  for (const [name, css] of Object.entries(files)) {
    const block = f12(css);
    assert.doesNotMatch(block, /linear-gradient|radial-gradient/, `${name} F12 must not add decorative gradients`);
    assert.match(block, /border-radius:/, `${name} must define final surface radius`);
    assert.match(block, /@media/, `${name} must include responsive rules`);
  }
});

test('F12 Admin improves dense operator tables and forms without changing business code', () => {
  const css = f12(files.admin);
  assert.match(css, /\.table>\.tr\.th\{position:sticky/);
  assert.match(css, /textarea:focus/);
  assert.match(css, /\.notice\.success/);
  assert.match(css, /\.modalCard\{max-height:/);
  assert.match(css, /scroll-snap-type:x proximity/);
});

test('F12 POS keeps touch-first checkout and responsive product density', () => {
  const css = f12(files.pos);
  assert.match(css, /\.products\{grid-template-columns:repeat\(4/);
  assert.match(css, /\.pay\{min-height:48px/);
  assert.match(css, /@media\(max-width:720px\)/);
  assert.match(css, /\.posWorkspaceNav\{display:flex\}/);
});

test('F12 Storefront keeps customer cards and checkout responsive down to mobile', () => {
  const css = f12(files.storefront);
  assert.match(css, /repeat\(auto-fill,minmax\(220px,1fr\)\)/);
  assert.match(css, /\.cardActions\{gap:6px\}/);
  assert.match(css, /@media\(max-width:430px\)/);
  assert.match(css, /\.mobileNav\{box-shadow:/);
});

test('F12 Employee Portal keeps compact self-service navigation and readable tables', () => {
  const css = f12(files.employee);
  assert.match(css, /\.employeeShell\{grid-template-columns:252px/);
  assert.match(css, /\.tr\.th\{position:sticky/);
  assert.match(css, /\.employeeMobileNav\{margin-inline:-12px/);
  assert.match(css, /@media\(max-width:430px\)\{\.statGrid\{grid-template-columns:1fr\}/);
});
