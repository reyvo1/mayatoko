import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'logs', 'github-uat');
fs.mkdirSync(outDir, { recursive: true });

const rows = [
  ['PostgreSQL schema', process.env.STEP_SCHEMA],
  ['PostgreSQL seed', process.env.STEP_SEED],
  ['Build gate', process.env.STEP_BUILD],
  ['Browser UAT', process.env.STEP_BROWSER],
  ['Built Browser UAT', process.env.STEP_BUILT_BROWSER],
  ['Stage 18', process.env.STEP_STAGE18],
  ['Stage 19', process.env.STEP_STAGE19],
  ['Payroll staging', process.env.STEP_PAYROLL],
  ['Stage 20 automated', process.env.STEP_STAGE20],
  ['UAT candidate verifier', process.env.STEP_CANDIDATE],
];

function normalize(value) {
  return value || 'not-run';
}

const stage20Mode = process.env.STAGE20_MODE || 'UNKNOWN';

const report = {
  generatedAt: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || null,
  runId: process.env.GITHUB_RUN_ID || null,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
  stage20Mode,
  humanUatMutated: false,
  checks: rows.map(([id, status]) => ({ id, status: normalize(status) })),
};

fs.writeFileSync(
  path.join(outDir, 'summary.json'),
  JSON.stringify(report, null, 2) + '\n',
);

const md = [
  '# Toko360 GitHub Automated UAT',
  '',
  `- Commit: \`${report.commit || 'unknown'}\``,
  `- Stage-20 mode: **${stage20Mode}**`,
  '- Human Stage-20 UAT: **not modified by automation**',
  '',
  '| Check | Result |',
  '|---|---|',
  ...rows.map(([id, status]) => `| ${id} | ${normalize(status)} |`),
  '',
  '## Evidence',
  '',
  'Download the workflow artifact for `logs/`, `handoff/quality/`, and generated Stage evidence.',
  '',
];

fs.writeFileSync(path.join(outDir, 'summary.md'), md.join('\n') + '\n');

console.log(md.join('\n'));
