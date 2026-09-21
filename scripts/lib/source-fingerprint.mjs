import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_ENTRIES = [
  'apps', 'packages', 'database', 'scripts', 'tests', 'config',
  path.join('.github', 'workflows'),
  'package.json', 'package-lock.json', 'VERSION', '.env.example', '.env.local.example', '.env.postgres.example',
  'run-browser-uat.cmd', 'run-built-browser-uat.cmd', 'run-uat-candidate-build.cmd', 'run-payroll-adjustment-stage.cmd', 'verify-uat-candidate.cmd',
  'run-postgres-dr-drill.cmd', 'run-production-promotion-gate.cmd', 'run-production-smoke.cmd', 'verify-production-ready.cmd',
];
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'coverage', 'logs', 'data']);
const SKIP_FILE = /(?:\.db(?:-journal|-shm|-wal)?|\.sqlite3?(?:-journal|-shm|-wal)?|\.log)$/i;

function filesUnder(root, entry) {
  const absolute = path.join(root, entry);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [absolute];
  const result = [];
  const visit = (dir) => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (item.isDirectory() && SKIP_DIRS.has(item.name)) continue;
      const full = path.join(dir, item.name);
      if (item.isDirectory()) visit(full);
      else if (item.isFile() && !SKIP_FILE.test(item.name)) result.push(full);
    }
  };
  visit(absolute);
  return result;
}

export function sourceFingerprint(root = process.cwd()) {
  const files = ROOT_ENTRIES.flatMap((entry) => filesUnder(root, entry))
    .map((file) => ({ file, relative: path.relative(root, file).replaceAll('\\', '/') }))
    .sort((a, b) => a.relative.localeCompare(b.relative));
  const hash = crypto.createHash('sha256');
  for (const { file, relative } of files) {
    const body = fs.readFileSync(file);
    hash.update(relative); hash.update('\0'); hash.update(String(body.length)); hash.update('\0'); hash.update(body); hash.update('\0');
  }
  return { algorithm: 'sha256', value: hash.digest('hex'), fileCount: files.length };
}
