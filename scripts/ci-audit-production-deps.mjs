#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawnNpm } from './lib/process-runner.mjs';
import { sourceFingerprint } from './lib/source-fingerprint.mjs';

const DEFAULT_OUTPUT = 'handoff/quality/npm-audit-production-latest.json';

export function vulnerabilityCounts(audit) {
  const value = audit?.metadata?.vulnerabilities || {};
  return Object.fromEntries(['info','low','moderate','high','critical','total'].map((key) => [key, Number(value[key] || 0)]));
}

export function evaluateAudit(audit) {
  const counts = vulnerabilityCounts(audit);
  const blocking = counts.high + counts.critical;
  return { counts, blocking, passed: blocking === 0 };
}

function runAudit(root) {
  return new Promise((resolve) => {
    const child = spawnNpm(['audit', '--omit=dev', '--audit-level=high', '--json'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout?.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr?.on('data', (chunk) => { stderr += String(chunk); });
    child.once('error', (error) => resolve({ exitCode: 2, stdout, stderr, spawnError: error.message }));
    child.once('close', (code) => resolve({ exitCode: code ?? 2, stdout, stderr }));
  });
}

export async function auditProductionDependencies({ root = process.cwd(), output = process.env.T360_NPM_AUDIT_OUTPUT || DEFAULT_OUTPUT } = {}) {
  const sourceIdentity = sourceFingerprint(root);
  const target = path.resolve(root, output);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  let result;
  try {
    const run = await runAudit(root);
    if (run.spawnError) throw new Error(`npm audit tidak dapat dijalankan: ${run.spawnError}`);
    let audit;
    try { audit = JSON.parse(run.stdout || '{}'); }
    catch { throw new Error(`npm audit tidak menghasilkan JSON valid${run.stderr ? `: ${run.stderr.slice(-500)}` : ''}`); }
    const evaluated = evaluateAudit(audit);
    // npm audit returns non-zero when vulnerabilities meet threshold. Registry/tool errors can also be non-zero;
    // require internally consistent metadata so infrastructure errors do not become false PASS.
    if (run.exitCode !== 0 && evaluated.blocking === 0) throw new Error(`npm audit exit ${run.exitCode} tanpa high/critical metadata; kemungkinan registry/tool error.`);
    result = {
      generatedAt: new Date().toISOString(), status: evaluated.passed ? 'PASS' : 'FAIL', sourceIdentity,
      scope: 'production-dependencies', policy: { command: 'npm audit --omit=dev --audit-level=high --json', blockSeverities: ['high','critical'], autoFix: false },
      vulnerabilities: evaluated.counts, blockingCount: evaluated.blocking, productionTouched: false,
      ...(evaluated.passed ? {} : { error: `${evaluated.blocking} high/critical production dependency vulnerabilities detected.` }),
    };
  } catch (error) {
    result = {
      generatedAt: new Date().toISOString(), status: 'FAIL', sourceIdentity, scope: 'production-dependencies',
      policy: { command: 'npm audit --omit=dev --audit-level=high --json', blockSeverities: ['high','critical'], autoFix: false },
      vulnerabilities: null, blockingCount: null, productionTouched: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  fs.writeFileSync(target, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = await auditProductionDependencies();
  console.log(`Production dependency audit ${result.status}${result.error ? ` — ${result.error}` : ''}`);
  if (result.status !== 'PASS') process.exitCode = 2;
}
