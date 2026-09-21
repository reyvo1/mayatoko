import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const script = fs.readFileSync('scripts/browser-uat.mjs','utf8');
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
const cmd = fs.readFileSync('run-browser-uat.cmd','utf8');

test('browser UAT launcher is fail-closed and uses real Chromium CDP', () => {
  assert.match(script, /remote-debugging-port/);
  assert.match(script, /new WebSocket/);
  assert.match(script, /T360_UAT_ADMIN_EMAIL/);
  assert.match(script, /T360_UAT_ADMIN_PASSWORD/);
  assert.doesNotMatch(script, /Admin123!/);
  assert.match(script, /process\.exitCode = 1/);
});

test('browser UAT verifies authenticated delivery lifecycle in Admin', () => {
  assert.match(script, /Aset & Fleet/);
  assert.match(script, /Outbound \/ Delivery Lifecycle/);
  assert.match(script, /TRIP WORKBENCH/);
  assert.match(script, /Delivery lifecycle gagal dimuat/);
});

test('browser UAT verifies payroll lifecycle read model in Admin', () => {
  assert.match(script, /HRIS & Payroll/);
  assert.match(script, /PAYROLL LIFECYCLE/);
  assert.match(script, /Riwayat Payroll Runs/);
  assert.match(script, /ADMIN_PAYROLL_LIFECYCLE/);
  assert.match(script, /Gagal memuat HR\/Payroll/);
});

test('browser UAT is exposed through npm and Windows launcher', () => {
  assert.equal(pkg.scripts['uat:browser'], 'node scripts/browser-uat.mjs');
  assert.match(cmd, /browser-uat\.mjs/i);
});


test('browser UAT evidence is bound to the current source fingerprint', () => {
  assert.match(script, /sourceIdentity: sourceFingerprint\(root\)/);
});


test('browser UAT renders Storefront, POS, and Employee Portal in real browser', () => {
  assert.match(script, /STOREFRONT_BROWSER_RENDER/);
  assert.match(script, /TOKO360 OFFICIAL STORE/);
  assert.match(script, /POS_BROWSER_RENDER/);
  assert.match(script, /Masuk ke terminal kasir/);
  assert.match(script, /EMPLOYEE_PORTAL_BROWSER_RENDER/);
  assert.match(script, /Portal Karyawan/);
  assert.match(script, /Page\.navigate/);
});
