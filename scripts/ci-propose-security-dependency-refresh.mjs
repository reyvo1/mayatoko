#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnNpmSync } from './lib/process-runner.mjs';
import { evaluateAudit } from './ci-audit-production-deps.mjs';
import { sourceFingerprint } from './lib/source-fingerprint.mjs';

const ROOT = process.cwd();
const PLAN_FILE = path.join(ROOT, '.github/ci/security-dependency-plan.json');
const OUTPUT_DIR = path.join(ROOT, 'handoff/quality/security-dependency-proposal');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
function copyJson(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function workspacePackageFiles(root) {
  const roots = ['apps', 'packages'];
  const out = [];
  for (const parent of roots) {
    const base = path.join(root, parent);
    if (!fs.existsSync(base)) continue;
    for (const name of fs.readdirSync(base)) {
      const file = path.join(base, name, 'package.json');
      if (fs.existsSync(file)) out.push(path.relative(root, file));
    }
  }
  return out.sort();
}

function patchPackageJsons(tempRoot, plan) {
  const nextApps = ['admin', 'storefront', 'pos', 'employee-portal'];
  for (const app of nextApps) {
    const file = path.join(tempRoot, 'apps', app, 'package.json');
    const pkg = readJson(file);
    if (!pkg.dependencies?.next) throw new Error(`${app} does not declare next`);
    pkg.dependencies.next = plan.direct.next;
    writeJson(file, pkg);
  }

  const apiFile = path.join(tempRoot, 'apps/api/package.json');
  const api = readJson(apiFile);
  for (const name of ['@nestjs/common', '@nestjs/core', '@nestjs/platform-express', '@nestjs/swagger']) {
    if (!api.dependencies?.[name]) throw new Error(`API does not declare ${name}`);
    api.dependencies[name] = plan.direct[name];
  }
  writeJson(apiFile, api);

  const rootFile = path.join(tempRoot, 'package.json');
  const rootPkg = readJson(rootFile);
  rootPkg.overrides = { ...(rootPkg.overrides || {}), ...plan.overrides };
  writeJson(rootFile, rootPkg);
}

function run(root, args) {
  const result = spawnNpmSync(args, { cwd: root, encoding: 'utf8', env: { ...process.env, CI: 'true' }, maxBuffer: 20 * 1024 * 1024 });
  return {
    exitCode: result.status ?? 2,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error?.message || null,
  };
}

export function generateSecurityDependencyProposal({ root = ROOT, outputDir = OUTPUT_DIR } = {}) {
  const sourceIdentity = sourceFingerprint(root);
  const plan = readJson(path.join(root, '.github/ci/security-dependency-plan.json'));
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'toko360-security-deps-'));
  const beforeLock = path.join(root, 'package-lock.json');
  const workspaceFiles = workspacePackageFiles(root);
  const result = {
    generatedAt: new Date().toISOString(),
    status: 'FAIL',
    sourceIdentity,
    productionTouched: false,
    isolated: true,
    plan,
    committedLockSha256: sha256(beforeLock),
    proposedLockSha256: null,
    audit: null,
    error: null,
  };

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  try {
    copyJson(path.join(root, 'package.json'), path.join(tempRoot, 'package.json'));
    fs.copyFileSync(beforeLock, path.join(tempRoot, 'package-lock.json'));
    for (const rel of workspaceFiles) copyJson(path.join(root, rel), path.join(tempRoot, rel));
    patchPackageJsons(tempRoot, plan);

    const install = run(tempRoot, ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund']);
    fs.writeFileSync(path.join(outputDir, 'npm-install-package-lock-only.log'), `${install.stdout}${install.stderr}`);
    if (install.error || install.exitCode !== 0) throw new Error(`security proposal lock refresh failed with exit ${install.exitCode}${install.error ? `: ${install.error}` : ''}`);

    const auditRun = run(tempRoot, ['audit', '--omit=dev', '--audit-level=high', '--json']);
    fs.writeFileSync(path.join(outputDir, 'npm-audit.json'), auditRun.stdout || '{}');
    let auditJson;
    try { auditJson = JSON.parse(auditRun.stdout || '{}'); }
    catch { throw new Error(`security proposal npm audit did not return valid JSON: ${auditRun.stderr.slice(-500)}`); }
    const evaluated = evaluateAudit(auditJson);
    result.audit = { exitCode: auditRun.exitCode, ...evaluated };

    const proposedLock = path.join(tempRoot, 'package-lock.json');
    result.proposedLockSha256 = sha256(proposedLock);
    copyJson(path.join(tempRoot, 'package.json'), path.join(outputDir, 'package.json'));
    fs.copyFileSync(proposedLock, path.join(outputDir, 'package-lock.json'));
    for (const rel of workspaceFiles) {
      if (['apps/admin/package.json','apps/storefront/package.json','apps/pos/package.json','apps/employee-portal/package.json','apps/api/package.json'].includes(rel)) {
        copyJson(path.join(tempRoot, rel), path.join(outputDir, rel));
      }
    }
    result.status = evaluated.passed ? 'PASS' : 'FAIL';
    if (!evaluated.passed) result.error = `${evaluated.blocking} high/critical vulnerabilities remain in the isolated proposal.`;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  writeJson(path.join(outputDir, 'proposal.json'), result);
  return result;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = generateSecurityDependencyProposal();
  console.log(`Security dependency proposal ${result.status} — isolated=${result.isolated} output=${path.relative(ROOT, OUTPUT_DIR)}`);
  if (result.error) console.error(result.error);
  if (result.status !== 'PASS') process.exitCode = 2;
}
