import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

const values = {
  databaseUrl: process.env.DATABASE_URL
    || 'postgresql://postgres:toko360_ci_password@127.0.0.1:5432/toko360_staging',
  restoreUrl: 'postgresql://postgres:toko360_ci_password@127.0.0.1:5432/toko360_stage18_restore',
  host: '127.0.0.1',
  database: 'toko360_staging',
  restoreDatabase: 'toko360_stage18_restore',
};

if (!values.databaseUrl) {
  throw new Error('DATABASE_URL wajib tersedia.');
}

const common = {
  DATABASE_PROFILE: 'postgresql',
  DATABASE_URL: values.databaseUrl,
  T360_UAT_ENVIRONMENT: 'GITHUB_UAT',
  T360_UAT_EXPECTED_HOST: values.host,
  T360_UAT_EXPECTED_DATABASE: values.database,
  T360_ALLOW_PRESERVE_ARTIFACT: '1',
};

const stage18 = {
  ...common,
  T360_STAGE18_TARGET: 'STAGING',
  T360_STAGE18_CONFIRM: 'APPLY_T360_STAGE18_NON_PRODUCTION',
  T360_STAGE18_CONFIRMATION: 'APPLY_T360_STAGE18_NON_PRODUCTION',
  T360_STAGE18_EXPECTED_HOST: values.host,
  T360_STAGE18_EXPECTED_DATABASE: values.database,

  T360_STAGE18_RESTORE_DATABASE_URL: values.restoreUrl,
  T360_STAGE18_RESTORE_URL: values.restoreUrl,
  T360_STAGE18_RESTORE_EXPECTED_HOST: values.host,
  T360_STAGE18_RESTORE_EXPECTED_DATABASE: values.restoreDatabase,
  T360_STAGE18_RESTORE_CONFIRM: 'REPLACE_T360_STAGE18_RESTORE_DATABASE',
  T360_STAGE18_RESTORE_CONFIRMATION: 'REPLACE_T360_STAGE18_RESTORE_DATABASE',
};

const stage19 = {
  ...common,
  T360_STAGE19_TARGET: 'STAGING',
  T360_STAGE19_CONFIRM: 'RUN_T360_STAGE19_NON_PRODUCTION',
  T360_STAGE19_CONFIRMATION: 'RUN_T360_STAGE19_NON_PRODUCTION',
  T360_STAGE19_EXPECTED_HOST: values.host,
  T360_STAGE19_EXPECTED_DATABASE: values.database,
};

const payroll = {
  ...common,
  T360_PAYROLL_ADJUSTMENT_TARGET: 'STAGING',
  T360_PAYROLL_ADJUSTMENT_CONFIRM: 'APPLY_T360_PAYROLL_ADJUSTMENT_NON_PRODUCTION',
  T360_PAYROLL_ADJUSTMENT_CONFIRMATION: 'APPLY_T360_PAYROLL_ADJUSTMENT_NON_PRODUCTION',
  T360_PAYROLL_ADJUSTMENT_EXPECTED_HOST: values.host,
  T360_PAYROLL_ADJUSTMENT_EXPECTED_DATABASE: values.database,
};

const stage20 = {
  ...common,
  T360_STAGE20_TARGET: 'STAGING',
  T360_STAGE20_CONFIRM: 'RUN_T360_STAGE20_NON_PRODUCTION',
  T360_STAGE20_CONFIRMATION: 'RUN_T360_STAGE20_NON_PRODUCTION',
  T360_STAGE20_EXPECTED_HOST: values.host,
  T360_STAGE20_EXPECTED_DATABASE: values.database,
  T360_STAGE20_API_PORT: '42020',
  T360_STAGE20_HEALTH_SAMPLES: '30',
  T360_STAGE20_HEALTH_INTERVAL_MS: '50',
  T360_STAGE20_HEALTH_P95_BUDGET_MS: '1000',
  T360_STAGE20_MAX_ACTIVE_CONNECTIONS: '50',
};

function serialize(obj) {
  return Object.entries(obj)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n') + '\n';
}

function mergeExample(target, generated) {
  const candidates = [
    `${target}.example`,
    path.join(root, 'config', `${target}.example`),
    path.join(root, 'config', path.basename(target) + '.example'),
  ];

  const source = candidates.find((file) => fs.existsSync(file));
  const base = {};

  if (source) {
    const content = fs.readFileSync(source, 'utf8');
    for (const raw of content.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match) base[match[1]] = match[2];
    }
  }

  return { ...base, ...generated };
}

function writeEnv(target, data) {
  const destination = path.join(root, target);
  fs.writeFileSync(destination, serialize(mergeExample(target, data)));
  console.log(`GitHub UAT env written: ${target}`);
}

writeEnv('stage18-postgres.env', stage18);
writeEnv('stage19-integration.env', stage19);
writeEnv('payroll-adjustment-postgres-stage.env', payroll);
writeEnv('stage20-release-readiness.env', stage20);

const decisions = path.join(root, 'stage18-ownership-decisions.json');
if (!fs.existsSync(decisions)) {
  fs.writeFileSync(decisions, JSON.stringify({
    version: 1,
    productAssignments: [],
    supplierAssignments: [],
  }, null, 2) + '\n');
  console.log('Created empty canonical stage18-ownership-decisions.json');
}

const stage20Uat = path.join(root, 'stage20-uat-results.json');
if (!fs.existsSync(stage20Uat)) {
  const exampleCandidates = [
    path.join(root, 'stage20-uat-results.json.example'),
    path.join(root, 'config', 'stage20-uat-results.json.example'),
  ];
  const example = exampleCandidates.find((file) => fs.existsSync(file));

  if (example) {
    fs.copyFileSync(example, stage20Uat);
    console.log('Created stage20-uat-results.json from example; Human UAT remains PENDING.');
  }
}

if (process.argv.includes('--seed')) {
  const apiPackagePath = path.join(root, 'apps', 'api', 'package.json');
  const apiPackage = JSON.parse(fs.readFileSync(apiPackagePath, 'utf8'));
  const scripts = apiPackage.scripts || {};

  const candidates = [
    'db:seed:postgres',
    'seed:postgres',
    'prisma:seed:postgres',
    'db:seed',
    'seed',
  ];

  const selected = candidates.find((name) => typeof scripts[name] === 'string');

  if (!selected) {
    console.error('Tidak menemukan script seed PostgreSQL/API yang aman.');
    console.error('Available apps/api scripts containing "seed":');
    for (const [name, command] of Object.entries(scripts)) {
      if (name.toLowerCase().includes('seed') || String(command).toLowerCase().includes('seed')) {
        console.error(`- ${name}: ${command}`);
      }
    }
    process.exit(1);
  }

  console.log(`Running API seed script: ${selected}`);

  const result = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', selected, '-w', '@toko360/api'],
    {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
      shell: false,
    },
  );

  process.exit(result.status ?? 1);
}
