import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const plan = JSON.parse(read('.github/ci/security-dependency-plan.json'));
const script = read('scripts/ci-propose-security-dependency-refresh.mjs');
const workflow = read('.github/workflows/full-system-simulation.yml');
const pkg = JSON.parse(read('package.json'));

test('security dependency proposal pins current patched direct versions and advisory overrides', () => {
  assert.equal(plan.direct.next, '16.3.5');
  assert.equal(plan.direct['@nestjs/common'], '11.2.5');
  assert.equal(plan.direct['@nestjs/core'], '11.2.5');
  assert.equal(plan.direct['@nestjs/platform-express'], '11.2.5');
  assert.equal(plan.direct['@nestjs/swagger'], '11.4.7');
  assert.equal(plan.overrides['deepmerge-ts'], '8.0.0');
  assert.equal(plan.overrides['js-yaml'], '5.2.2');
  assert.equal(plan.overrides.multer, '2.4.0');
  assert.equal(plan.overrides.nanoid, '3.3.19');
  assert.equal(plan.overrides.postcss, '8.5.28');
  assert.equal(plan.overrides.sharp, '0.35.4');
});

test('security proposal is isolated and never overwrites the checked-out package lock', () => {
  assert.match(script, /mkdtempSync/);
  assert.match(script, /isolated: true/);
  assert.match(script, /package-lock-only/);
  assert.match(script, /handoff\/quality\/security-dependency-proposal/);
  assert.doesNotMatch(script, /copyFileSync\(proposedLock,\s*beforeLock/);
});

test('primary audit remains blocking while proposal is diagnostic-only and uploaded as evidence', () => {
  assert.match(workflow, /Audit production dependencies for high\/critical vulnerabilities/);
  assert.match(workflow, /id: dependency_audit/);
  assert.match(workflow, /Generate isolated security dependency lock proposal when audit blocks/);
  assert.match(workflow, /continue-on-error: true[\s\S]*?npm run ci:security:proposal/);
  assert.match(workflow, /handoff\/quality\/security-dependency-proposal\/\*\*/);
  assert.equal(pkg.scripts['ci:security:proposal'], 'node scripts/ci-propose-security-dependency-refresh.mjs');
});
