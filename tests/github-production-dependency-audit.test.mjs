import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluateAudit, vulnerabilityCounts } from '../scripts/ci-audit-production-deps.mjs';

test('production dependency audit blocks high/critical but records lower severities', () => {
  const safe = { metadata: { vulnerabilities: { info: 0, low: 2, moderate: 1, high: 0, critical: 0, total: 3 } } };
  const bad = { metadata: { vulnerabilities: { low: 0, moderate: 0, high: 2, critical: 1, total: 3 } } };
  assert.deepEqual(vulnerabilityCounts(safe), { info: 0, low: 2, moderate: 1, high: 0, critical: 0, total: 3 });
  assert.equal(evaluateAudit(safe).passed, true);
  assert.equal(evaluateAudit(bad).blocking, 3);
  assert.equal(evaluateAudit(bad).passed, false);
});

test('GitHub full-system simulation requires source-bound production dependency audit evidence', () => {
  const workflow = fs.readFileSync('.github/workflows/full-system-simulation.yml', 'utf8');
  const summary = fs.readFileSync('scripts/ci-write-full-system-summary.mjs', 'utf8');
  const audit = fs.readFileSync('scripts/ci-audit-production-deps.mjs', 'utf8');
  assert.match(workflow, /id: dependency_audit/);
  assert.match(workflow, /npm run ci:audit:production/);
  assert.match(summary, /npm-audit-production-latest\.json/);
  assert.match(summary, /dependencyAudit: gateStatus/);
  assert.match(summary, /T360_CI_STEP_DEPENDENCY_AUDIT/);
  assert.match(audit, /--omit=dev/);
  assert.match(audit, /--audit-level=high/);
  assert.match(audit, /autoFix: false/);
  assert.doesNotMatch(audit, /audit fix/);
});
