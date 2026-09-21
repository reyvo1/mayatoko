import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sourceFingerprint } from '../scripts/lib/source-fingerprint.mjs';

const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
const buildGate = fs.readFileSync('scripts/run-build-gate.mjs','utf8');
const builtBrowser = fs.readFileSync('scripts/run-built-browser-uat.mjs','utf8');
const verifier = fs.readFileSync('scripts/verify-uat-candidate.mjs','utf8');
const release = fs.readFileSync('.github/workflows/release-candidate.yml','utf8');
const fullSystem = fs.readFileSync('.github/workflows/full-system-simulation.yml','utf8');

test('source fingerprint is deterministic and covers executable source roots', () => {
  const a = sourceFingerprint(process.cwd());
  const b = sourceFingerprint(process.cwd());
  assert.equal(a.algorithm, 'sha256');
  assert.equal(a.value, b.value);
  assert.match(a.value, /^[0-9a-f]{64}$/);
  assert.ok(a.fileCount > 100);
});

test('build gate records deterministic install, both Prisma profiles and six-app build', () => {
  assert.equal(pkg.scripts['build:gate'], 'node scripts/run-build-gate.mjs');
  assert.match(buildGate, /setup:dependencies/);
  assert.doesNotMatch(buildGate, /T360_BUILD_GATE_SKIP_INSTALL/);
  assert.match(buildGate, /prisma:validate:sqlite/);
  assert.match(buildGate, /prisma:validate:postgres/);
  assert.match(buildGate, /db:local:prepare/);
  assert.match(buildGate, /SQLITE_DB_SMOKE/);
  assert.match(buildGate, /db:postgres:generate/);
  assert.match(buildGate, /SIX_APP_PRODUCTION_BUILD/);
  assert.match(buildGate, /sourceIdentityBefore/);
  assert.match(buildGate, /sourceIdentityAfter/);
});

test('built browser UAT starts all six runtime processes and rejects production', () => {
  for (const workspace of ['@toko360/api','@toko360/worker','@toko360/storefront','@toko360/admin','@toko360/pos','@toko360/employee-portal']) {
    assert.match(builtBrowser, new RegExp(workspace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(builtBrowser, /PROD\|PRODUCTION\|LIVE/);
  assert.match(builtBrowser, /browser-uat\.mjs/);
  assert.equal(pkg.scripts['uat:browser:built'], 'node scripts/run-built-browser-uat.mjs');
});

test('candidate verifier requires build, built-browser wrapper, browser and Stage-20 evidence bound to one source fingerprint', () => {
  assert.equal(pkg.scripts['uat:candidate:verify'], 'node scripts/verify-uat-candidate.mjs');
  assert.match(verifier, /BUILD_GATE/);
  assert.match(verifier, /BUILT_BROWSER_UAT/);
  assert.match(verifier, /built-browser-uat-latest\.json/);
  assert.match(verifier, /BROWSER_UAT/);
  assert.match(verifier, /STAGE20/);
  assert.match(verifier, /source fingerprint evidence tidak cocok/i);
  assert.match(verifier, /uatCandidate: passed/);
  assert.match(verifier, /productionReady: false/);
  assert.match(builtBrowser, /sourceIdentityBefore/);
  assert.match(builtBrowser, /sourceIdentityAfter/);
  assert.match(builtBrowser, /browserEvidence/);
  assert.match(builtBrowser, /T360_UAT_EXPECTED_HOST/);
  assert.match(builtBrowser, /T360_UAT_EXPECTED_DATABASE/);
  assert.match(builtBrowser, /menolak NODE_ENV production\/live/);
  assert.match(verifier, /target database berbeda/);
  assert.match(verifier, /browser harus dijalankan ulang setelah build/);
  assert.match(verifier, /Stage-20 harus dijalankan setelah runtime browser gate/);
  assert.match(verifier, /tepat 12 skenario kritis/);
});

test('runtime gate CI reuses full-system exact-artifact browser gate and does not label automated output as final UAT candidate', () => {
  assert.match(release, /uses: \.\/\.github\/workflows\/full-system-simulation\.yml/);
  assert.match(fullSystem, /npm run uat:browser:built/);
  assert.match(fullSystem, /T360_UAT_ADMIN_EMAIL: ci-admin@example\.invalid/);
  assert.match(fullSystem, /CORS_ORIGINS: http:\/\/localhost:3000/);
  assert.match(fullSystem, /SECRET_MASTER_KEY: [0-9a-f]{64}/);
  assert.match(fullSystem, /full-system-evidence/);
  assert.doesNotMatch(fullSystem, /T360_BUILD_GATE_SKIP_INSTALL/);
  assert.match(fullSystem, /T360_UAT_EXPECTED_HOST: localhost/);
  assert.match(fullSystem, /T360_UAT_EXPECTED_DATABASE: toko360_staging/);
  assert.doesNotMatch(release, /name: toko360-release-candidate/);
  assert.match(release, /full-system-gated-source/);
});


test('runtime target identity rejects production and locks PostgreSQL host/database', async () => {
  const { runtimeTargetIdentity } = await import('../scripts/run-built-browser-uat.mjs');
  assert.throws(() => runtimeTargetIdentity({ NODE_ENV: 'production', DATABASE_PROFILE: 'sqlite', DATABASE_URL: 'file:./data/test.db' }), /NODE_ENV production/);
  assert.throws(() => runtimeTargetIdentity({ NODE_ENV: 'staging', DATABASE_PROFILE: 'postgresql', DATABASE_URL: 'postgresql://u:p@db:5432/toko360_staging' }), /EXPECTED_HOST/);
  assert.throws(() => runtimeTargetIdentity({ NODE_ENV: 'staging', DATABASE_PROFILE: 'postgresql', DATABASE_URL: 'postgresql://u:p@prod-db:5432/toko360_staging', T360_UAT_EXPECTED_HOST: 'prod-db', T360_UAT_EXPECTED_DATABASE: 'toko360_staging' }), /production\/live/);
  const target = runtimeTargetIdentity({ NODE_ENV: 'staging', DATABASE_PROFILE: 'postgresql', DATABASE_URL: 'postgresql://u:p@staging-db:5432/toko360_staging', T360_UAT_EXPECTED_HOST: 'staging-db', T360_UAT_EXPECTED_DATABASE: 'toko360_staging' });
  assert.equal(target.profile, 'postgresql');
  assert.match(target.hostHash, /^[0-9a-f]{16}$/);
  assert.match(target.databaseHash, /^[0-9a-f]{16}$/);
});
