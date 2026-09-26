import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8');
const adminCss = read('apps/admin/app/globals.css');
const posCss = read('apps/pos/app/globals.css');
const posPage = read('apps/pos/app/page.tsx');
const storePage = read('apps/storefront/app/page.tsx');
const employeeShell = read('apps/employee-portal/app/employee-portal-shell.tsx');
const employeePackage = JSON.parse(read('apps/employee-portal/package.json'));

test('F12R2 Admin uses one Tailwind accent and no decorative gradient', () => {
  assert.match(adminCss, /--color-app-accent:\s*#0284c7/i);
  assert.match(adminCss, /@import\s+["']tailwindcss["']/);
  assert.doesNotMatch(adminCss, /(?:radial|linear|conic)-gradient\s*\(/i);
});

test('F12R2 POS removes decorative gradients, native confirm and text glyph action icons', () => {
  assert.doesNotMatch(posCss, /(?:radial|linear|conic)-gradient\s*\(/i);
  assert.match(posPage, /<Package size=\{24\}/);
  assert.match(posPage, /aria-label="Hapus metode pembayaran"/);
  assert.doesNotMatch(posPage, /window\.confirm|>×<|>\+ METODE</);
  assert.match(posPage, /pendingHeldRecall/);
});

test('F12R2 Storefront uses Lucide verification icon instead of checkmark text', () => {
  assert.match(storePage, /CircleCheck/);
  assert.doesNotMatch(storePage, /✓ Email terverifikasi|✓ Telepon terverifikasi/);
});

test('F12R2 Employee Portal uses the same Lucide icon system as other surfaces', () => {
  assert.equal(employeePackage.dependencies['lucide-react'], '^1.34.0');
  for (const icon of ['Home', 'MapPinCheckInside', 'CalendarDays', 'TimerReset', 'ReceiptText', 'History', 'UserRound', 'LogOut']) assert.match(employeeShell, new RegExp(`\\b${icon}\\b`));
  assert.match(employeeShell, /employeeNavIcon/);
});
