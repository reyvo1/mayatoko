import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const backlog = JSON.parse(readFileSync('config/implementation-backlog.json', 'utf8'));
const automation = JSON.parse(readFileSync('config/work-automation.json', 'utf8'));
const delivery = JSON.parse(readFileSync('config/module-delivery-map.json', 'utf8'));
const policy = JSON.parse(readFileSync('config/workflow-policy.json', 'utf8'));

test('one-click launchers and documentation exist', () => {
  for (const path of [
    'mulai-pekerjaan-otomatis.cmd',
    'buat-work-item.cmd',
    'lanjutkan-pekerjaan.cmd',
    'status-pekerjaan.cmd',
    'scripts/start-work.mjs',
    'docs/AUTOMATED-WORK-STARTER.md',
  ]) assert.ok(existsSync(path), `missing ${path}`);
});

test('implementation backlog is dependency-safe and mapped to delivery waves', () => {
  const keys = backlog.items.map((item) => item.key);
  assert.equal(new Set(keys).size, keys.length, 'backlog keys must be unique');
  const keySet = new Set(keys);
  const waveMap = new Map(delivery.waves.map((wave) => [wave.id, new Set(wave.modules)]));
  for (const item of backlog.items) {
    assert.ok(waveMap.has(item.wave), `${item.key} unknown wave ${item.wave}`);
    assert.ok(waveMap.get(item.wave).has(item.module), `${item.key} module ${item.module} not in ${item.wave}`);
    assert.ok(policy.allowedTypes.includes(item.type), `${item.key} invalid type`);
    assert.ok(policy.allowedRisks.includes(item.risk), `${item.key} invalid risk`);
    assert.ok(item.acceptanceCriteria.length > 0, `${item.key} missing acceptance criteria`);
    assert.ok(item.testPlan.length > 0, `${item.key} missing test plan`);
    for (const dependency of item.dependencies ?? []) assert.ok(keySet.has(dependency), `${item.key} unknown dependency ${dependency}`);
  }

  const visiting = new Set();
  const visited = new Set();
  const byKey = new Map(backlog.items.map((item) => [item.key, item]));
  function visit(key) {
    if (visiting.has(key)) assert.fail(`dependency cycle at ${key}`);
    if (visited.has(key)) return;
    visiting.add(key);
    for (const dependency of byKey.get(key)?.dependencies ?? []) visit(dependency);
    visiting.delete(key);
    visited.add(key);
  }
  for (const key of keys) visit(key);
});

test('external coding agent is safe-by-default', () => {
  assert.equal(automation.agent.enabled, false);
  assert.equal(typeof automation.autoCreateBranch, 'boolean');
  assert.equal(typeof automation.openEditor, 'boolean');
});

test('automation status command runs without changing work items', () => {
  const result = spawnSync(process.execPath, ['scripts/start-work.mjs', 'status'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Toko360 automated work status/);
  // 18/18 backlog selesai: status harus menunjukkan nol aktif/blocked (bukan "ready task")
  assert.match(result.stdout, /Work item aktif\s+:\s*0/);
  assert.match(result.stdout, /Semua backlog otomatis sudah selesai atau sedang aktif\./);
});
