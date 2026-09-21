#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { sourceFingerprint } from './lib/source-fingerprint.mjs';

const root = process.cwd();
const output = path.join(root, 'handoff', 'quality', 'postgres-dr-drill-latest.json');
const CONFIRM = 'RUN_T360_POSTGRES_DR_NON_PRODUCTION';
const unsafe = /(^|[-_.])(prod|production|live)([-_.]|$)/i;

function shortHash(value) { return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16); }
function parsePostgres(raw, label) {
  let url;
  try { url = new URL(raw); } catch { throw new Error(`${label} tidak valid.`); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error(`${label} wajib PostgreSQL.`);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!url.hostname || !database || !url.username) throw new Error(`${label} wajib memuat host, database, dan user.`);
  return { hostname: url.hostname, port: url.port || '5432', database, raw };
}
function lockedTarget(raw, expectedHost, expectedDatabase, label, targetMode) {
  const connection = parsePostgres(raw, label);
  if (!expectedHost || !expectedDatabase) throw new Error(`${label} membutuhkan expected host/database.`);
  if (connection.hostname !== expectedHost || connection.database !== expectedDatabase) throw new Error(`${label} tidak cocok dengan expected host/database.`);
  if (unsafe.test(connection.hostname) || unsafe.test(connection.database)) throw new Error(`${label} menolak target production/live.`);
  const marker = targetMode === 'TEST' ? /test/i : /stag/i;
  if (!marker.test(connection.database)) throw new Error(`${label} database harus memuat penanda ${targetMode}.`);
  return connection;
}
function sameDatabase(a, b) { return a.hostname.toLowerCase() === b.hostname.toLowerCase() && a.port === b.port && a.database === b.database; }
function commandName(name) { return process.platform === 'win32' && name === 'npm' ? 'npm.cmd' : name; }
function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName(command), args, { cwd: root, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${command} ${args.join(' ')} exit ${code}: ${stderr.trim().slice(-1200)}`)));
  });
}

const evidence = {
  generatedAt: null, status: 'FAIL', productionTouched: false, sourceIdentity: sourceFingerprint(root),
  sourceTarget: null, restoreTarget: null, steps: [], backup: null, error: null,
};
function step(id, status, detail = null) { evidence.steps.push({ id, status, ...(detail ? { detail } : {}) }); }

try {
  const mode = String(process.env.T360_DR_TARGET || '').toUpperCase();
  if (!['TEST', 'STAGING'].includes(mode)) throw new Error('T360_DR_TARGET harus TEST atau STAGING.');
  if (process.env.T360_DR_CONFIRM !== CONFIRM) throw new Error(`T360_DR_CONFIRM harus ${CONFIRM}.`);
  const source = lockedTarget(process.env.T360_DR_SOURCE_DATABASE_URL, process.env.T360_DR_SOURCE_EXPECTED_HOST, process.env.T360_DR_SOURCE_EXPECTED_DATABASE, 'T360_DR_SOURCE_DATABASE_URL', mode);
  const restore = lockedTarget(process.env.T360_DR_RESTORE_DATABASE_URL, process.env.T360_DR_RESTORE_EXPECTED_HOST, process.env.T360_DR_RESTORE_EXPECTED_DATABASE, 'T360_DR_RESTORE_DATABASE_URL', mode);
  if (sameDatabase(source, restore)) throw new Error('Database restore scratch wajib berbeda dari database source staging/test.');
  evidence.sourceTarget = { profile: 'postgresql', hostHash: shortHash(source.hostname), databaseHash: shortHash(source.database) };
  evidence.restoreTarget = { profile: 'postgresql', hostHash: shortHash(restore.hostname), databaseHash: shortHash(restore.database) };
  step('NON_PRODUCTION_TARGET_LOCK', 'PASS', mode);

  const backupDir = path.resolve(process.env.T360_DR_BACKUP_DIR || path.join(root, 'backups', 'dr-drill'));
  const sourceEnv = { ...process.env, DATABASE_PROFILE: 'postgresql', DATABASE_URL: source.raw, BACKUP_DIR: backupDir };
  const backupRun = await run(process.execPath, ['scripts/backup-database.mjs'], sourceEnv);
  const backup = JSON.parse(backupRun.stdout.trim());
  if (!backup?.ok || !backup?.metadata || !backup?.sha256) throw new Error('Backup runner tidak menghasilkan metadata valid.');
  evidence.backup = { sha256: backup.sha256, size: backup.size, metadataFile: path.basename(backup.metadata) };
  step('BACKUP_CREATED', 'PASS');

  const verifyRun = await run(process.execPath, ['scripts/verify-backup.mjs', backup.metadata], sourceEnv);
  const verified = JSON.parse(verifyRun.stdout.trim());
  if (!verified?.ok || verified.sha256 !== backup.sha256) throw new Error('Verifikasi backup tidak cocok dengan backup yang dibuat.');
  step('BACKUP_CHECKSUM_VERIFIED', 'PASS');

  const restoreRun = await run(process.execPath, ['scripts/restore-backup.mjs', backup.metadata, '--target-url', restore.raw, '--target-env', mode.toLowerCase()], sourceEnv);
  const restored = JSON.parse(restoreRun.stdout.trim());
  if (!restored?.ok || restored.profile !== 'postgresql') throw new Error('Restore rehearsal tidak menghasilkan PASS PostgreSQL.');
  step('RESTORE_TO_ISOLATED_SCRATCH', 'PASS');

  await run('npm', ['run', 'test:db:smoke'], { ...process.env, DATABASE_PROFILE: 'postgresql', DATABASE_URL: restore.raw, SEED_MODE: 'bootstrap' });
  step('RESTORED_DATABASE_SMOKE', 'PASS');
  evidence.status = 'PASS';
} catch (error) {
  evidence.error = error instanceof Error ? error.message : String(error);
  step('DR_DRILL', 'FAIL', evidence.error);
  process.exitCode = 1;
} finally {
  evidence.generatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
  console.log(`PostgreSQL DR drill ${evidence.status} — evidence: ${output}`);
}
