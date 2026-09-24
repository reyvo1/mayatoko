import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const controller = fs.readFileSync('apps/api/src/reports/daily-digest.controller.ts', 'utf8');
const service = fs.readFileSync('apps/api/src/reports/daily-digest.service.ts', 'utf8');
const admin = fs.readFileSync('apps/admin/app/modules/extensions.tsx', 'utf8');
const probe = fs.readFileSync('scripts/ci-notification-provider-probe.mjs', 'utf8');
const handoff = fs.readFileSync('handoff/CURRENT-WORK.md', 'utf8');
const state = fs.readFileSync('docs/PROJECT-STATE.md', 'utf8');

test('R2 is closed on green runtime evidence and R3 is active without reopening UI polish', () => {
  assert.match(handoff, /R2 .*CLOSED/);
  assert.match(handoff, /R3 .*IMPLEMENTATION/);
  assert.match(state, /Recovery R3/);
  assert.match(state, /F22–F25, F29, F37, F39, F42–F44/);
});

test('R3 daily digest mutations are permissioned and manual send respects enabled flag', () => {
  assert.match(controller, /@Post\('reports\/daily-digest\/config'\)[\s\S]*@Permissions\('notification\.manage'\)/);
  assert.match(controller, /@Post\('reports\/daily-digest\/send'\)[\s\S]*@Permissions\('notification\.manage'\)/);
  assert.match(service, /if \(!config\.enabled\) throw new BadRequestException\('Owner daily digest sedang nonaktif/);
});

test('R3 owner digest stores verified Telegram binding IDs instead of raw recipients', () => {
  assert.match(service, /recipientBindingIds/);
  assert.match(service, /employeeChannelBinding\.findMany/);
  assert.match(service, /channel: 'TELEGRAM'/);
  assert.match(service, /verifiedAt: \{ not: null \}/);
  assert.match(service, /revokedAt: null/);
  assert.doesNotMatch(service, /for \(const recipient of config\.recipients\)/);
  assert.match(admin, /Penerima Telegram terverifikasi/);
  assert.match(admin, /recipientBindingIds/);
});

test('R3 low-stock digest compares branch inventory against product minStock without hard-coded lte 10 prefilter', () => {
  assert.match(service, /minStock: \{ gt: 0 \}/);
  assert.match(service, /inventories: \{ some:/);
  assert.match(service, /item\.available <= item\.product\.minStock/);
  assert.doesNotMatch(service, /available: \{ lte: 10 \}/);
});

test('R3 provider simulation verifies Telegram recipient before configuring and sending owner digest', () => {
  assert.match(probe, /employee\/me\/channels\/request-verification/);
  assert.match(probe, /employee\/me\/channels\/verify/);
  assert.match(probe, /recipientBindingIds:\[bindingRequest\.bindingId\]/);
  assert.match(probe, /verification \+ owner digest \+ manual wajib terkirim/);
  assert.match(probe, /verifiedRecipient:true/);
});
