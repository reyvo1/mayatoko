import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { sourceFingerprint } from './lib/source-fingerprint.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const root = process.cwd();
const output = path.resolve(root, process.env.T360_BROWSER_UAT_OUTPUT || 'handoff/quality/browser-uat-latest.json');
const adminUrl = process.env.T360_ADMIN_URL || 'http://localhost:3001';
const apiUrl = process.env.T360_API_URL || 'http://localhost:4000/api/v1';
const storefrontUrl = process.env.T360_STOREFRONT_URL || 'http://localhost:3000';
const posUrl = process.env.T360_POS_URL || 'http://localhost:3002';
const employeeUrl = process.env.T360_EMPLOYEE_URL || 'http://localhost:3003';
const surfaces = [
  ['storefront', storefrontUrl],
  ['admin', adminUrl],
  ['pos', posUrl],
  ['employeePortal', employeeUrl],
];

function browserExecutable() {
  const candidates = [process.env.T360_CHROMIUM, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function http(url, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timeout); }
}

async function stopBrowserProcess(browser) {
  if (!browser || browser.exitCode !== null) return;
  browser.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => browser.once('exit', resolve)),
    sleep(3000),
  ]);
  if (browser.exitCode === null) {
    browser.kill('SIGKILL');
    await Promise.race([
      new Promise((resolve) => browser.once('exit', resolve)),
      sleep(2000),
    ]);
  }
}

async function removeBrowserProfile(tempDir) {
  if (!tempDir) return;
  let lastError;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try { fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 }); return; }
    catch (error) {
      lastError = error;
      if (!['ENOTEMPTY', 'EBUSY', 'EPERM'].includes(error?.code)) throw error;
      await sleep(250 * (attempt + 1));
    }
  }
  throw lastError ?? new Error('Browser profile cleanup gagal.');
}

async function waitHttp(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
    try {
      const response = await http(url);
      last = `HTTP ${response.status}`;
      if (response.ok) return response.status;
    } catch (error) { last = error instanceof Error ? error.message : String(error); }
    await sleep(500);
  }
  throw new Error(`${url} tidak siap (${last || 'timeout'}).`);
}

class Cdp {
  constructor(wsUrl) { this.ws = new WebSocket(wsUrl); this.id = 0; this.pending = new Map(); this.listeners = new Map(); }
  async open() {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout membuka Chrome DevTools Protocol.')), 10000);
      this.ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Chrome DevTools Protocol gagal terhubung.')); }, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.method) {
        for (const handler of this.listeners.get(message.method) || []) {
          try { handler(message.params || {}); } catch {}
        }
      }
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id); this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message || 'CDP error')); else resolve(message.result);
    });
  }
  call(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  on(method, handler) {
    if (!this.listeners.has(method)) this.listeners.set(method, new Set());
    this.listeners.get(method).add(handler);
    return () => this.listeners.get(method)?.delete(handler);
  }
  close() { try { this.ws.close(); } catch {} }
}

async function waitExpression(cdp, expression, label, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
    try {
      const result = await cdp.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result?.result?.value) return;
      last = result?.exceptionDetails?.text || '';
    } catch (error) { last = error instanceof Error ? error.message : String(error); }
    await sleep(300);
  }
  throw new Error(`${label} tidak ditemukan${last ? `: ${last}` : ''}.`);
}

async function navigateAndAssert(cdp, url, expression, label, timeoutMs = 45000) {
  await cdp.call('Page.navigate', { url });
  await waitExpression(cdp, `document.readyState === 'complete' && (${expression})`, label, timeoutMs);
}

async function browserPageDiagnostic(cdp, healthUrl) {
  const result = await cdp.call('Runtime.evaluate', {
    expression: `(async () => {
      const snapshot = { origin: location.origin, href: location.href, text: (document.body?.innerText || '').slice(0, 4000) };
      try {
        const response = await fetch(${JSON.stringify('__HEALTH_URL__')}, { cache: 'no-store' });
        snapshot.health = { ok: response.ok, status: response.status, text: (await response.text()).slice(0, 1000) };
      } catch (error) { snapshot.health = { ok: false, error: String(error) }; }
      return snapshot;
    })()`.replace('__HEALTH_URL__', healthUrl.replaceAll('\\', '\\').replaceAll('"', '\"')),
    returnByValue: true, awaitPromise: true,
  });
  return result?.result?.value || null;
}

async function main() {
  const startedAt = new Date().toISOString();
  const evidence = { environment: process.env.T360_UAT_ENVIRONMENT || 'LOCAL_UAT', startedAt, finishedAt: null, status: 'FAIL', sourceIdentity: sourceFingerprint(root), checks: [], error: null };
  let browser;
  let cdp;
  let tempDir;
  try {
    await waitHttp(`${apiUrl}/health`);
    const healthResponse = await http(`${apiUrl}/health`);
    const healthBody = await healthResponse.json().catch(() => ({}));
    if (!healthResponse.ok || healthBody?.status !== 'ok') throw new Error(`API health invalid (HTTP ${healthResponse.status}).`);
    const expectedRuntimeFingerprint = String(process.env.T360_EXPECTED_SOURCE_FINGERPRINT || '').trim();
    const expectedBuildArtifactId = String(process.env.T360_EXPECTED_BUILD_ARTIFACT_ID || '').trim();
    if (expectedRuntimeFingerprint && healthBody?.release?.sourceFingerprint !== expectedRuntimeFingerprint) {
      throw new Error(`Runtime source fingerprint tidak cocok. expected=${expectedRuntimeFingerprint} actual=${healthBody?.release?.sourceFingerprint || '<missing>'}`);
    }
    if (expectedBuildArtifactId && healthBody?.release?.buildArtifactId !== expectedBuildArtifactId) {
      throw new Error(`Runtime build artifact tidak cocok. expected=${expectedBuildArtifactId} actual=${healthBody?.release?.buildArtifactId || '<missing>'}`);
    }
    evidence.runtimeSourceFingerprint = healthBody?.release?.sourceFingerprint || null;
    evidence.runtimeBuildArtifactId = healthBody?.release?.buildArtifactId || null;
    evidence.checks.push({ id: 'API_HEALTH', status: 'PASS', runtimeSourceFingerprint: evidence.runtimeSourceFingerprint, runtimeBuildArtifactId: evidence.runtimeBuildArtifactId });
    for (const [name, url] of surfaces) {
      const status = await waitHttp(url);
      evidence.checks.push({ id: `SURFACE_${name.toUpperCase()}`, status: 'PASS', httpStatus: status, url });
    }

    const email = String(process.env.T360_UAT_ADMIN_EMAIL || '').trim();
    const password = String(process.env.T360_UAT_ADMIN_PASSWORD || '');
    if (!email || !password) throw new Error('T360_UAT_ADMIN_EMAIL dan T360_UAT_ADMIN_PASSWORD wajib diisi; runner tidak memakai kredensial demo tersembunyi.');
    const login = await http(`${apiUrl}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const loginBody = await login.json().catch(() => ({}));
    if (!login.ok || !loginBody?.accessToken) throw new Error(`Login UAT gagal (HTTP ${login.status}).`);
    if (loginBody?.code === 'TWO_FACTOR_REQUIRED') throw new Error('Akun UAT membutuhkan 2FA; gunakan akun staging UAT khusus atau jalankan login manual tervalidasi.');
    evidence.checks.push({ id: 'ADMIN_API_LOGIN', status: 'PASS' });

    if (String(process.env.T360_UAT_PREPARE_EMPLOYEE_SELF || '').toLowerCase() === 'true') {
      if (!loginBody.user?.sub) throw new Error('Login UAT tidak membawa user.sub untuk fixture Employee Portal CI.');
      const authHeaders = { authorization: `Bearer ${loginBody.accessToken}` };
      const existing = await http(`${apiUrl}/employee/me`, { headers: authHeaders });
      if (existing.status === 404) {
        const created = await http(`${apiUrl}/hr/employees`, {
          method: 'POST', headers: { ...authHeaders, 'content-type': 'application/json' },
          body: JSON.stringify({
            userId: loginBody.user?.sub, employeeNumber: 'CI-UAT-ADMIN', fullName: loginBody.user?.name || 'CI UAT Employee',
            email: loginBody.user?.email || email, employmentStatus: 'PERMANENT', hireDate: new Date().toISOString().slice(0, 10), timezone: 'Asia/Makassar',
          }),
        });
        if (!created.ok) throw new Error(`Persiapan employee self-service CI gagal (HTTP ${created.status}).`);
        evidence.checks.push({ id: 'EMPLOYEE_SELF_CI_FIXTURE', status: 'PASS', action: 'CREATED' });
      } else if (existing.ok) {
        evidence.checks.push({ id: 'EMPLOYEE_SELF_CI_FIXTURE', status: 'PASS', action: 'EXISTING' });
      } else {
        throw new Error(`Validasi employee self-service CI gagal (HTTP ${existing.status}).`);
      }
    }

    const executable = browserExecutable();
    if (!executable) throw new Error('Chromium/Chrome tidak ditemukan. Set T360_CHROMIUM ke executable browser UAT.');
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 't360-browser-uat-'));
    const debugPort = Number(process.env.T360_BROWSER_DEBUG_PORT || 49321);
    browser = spawn(executable, [
      '--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${tempDir}`,
      '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage', '--no-sandbox', 'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let browserErr = ''; browser.stderr?.on('data', (chunk) => { browserErr += String(chunk).slice(-4000); });
    const versionUrl = `http://127.0.0.1:${debugPort}/json/version`;
    await waitHttp(versionUrl, 15000);
    const targetResponse = await http(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(adminUrl)}`, { method: 'PUT' });
    if (!targetResponse.ok) throw new Error(`Tidak dapat membuat browser target (HTTP ${targetResponse.status}). ${browserErr.slice(-500)}`);
    const target = await targetResponse.json();
    cdp = new Cdp(target.webSocketDebuggerUrl); await cdp.open();
    const runtimeExceptions = [];
    cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
      const detail = exceptionDetails || {};
      runtimeExceptions.push({
        text: detail.exception?.description || detail.text || 'Unhandled browser exception',
        url: detail.url || null,
        lineNumber: Number.isInteger(detail.lineNumber) ? detail.lineNumber : null,
        columnNumber: Number.isInteger(detail.columnNumber) ? detail.columnNumber : null,
      });
    });
    await cdp.call('Page.enable'); await cdp.call('Runtime.enable');
    await waitExpression(cdp, `document.readyState === 'complete' && document.body && document.body.innerText.includes('Masuk ke pusat operasional')`, 'Halaman login Admin');
    evidence.checks.push({ id: 'ADMIN_LOGIN_SCREEN', status: 'PASS' });

    const access = JSON.stringify(loginBody.accessToken); const refresh = JSON.stringify(loginBody.refreshToken || '');
    await cdp.call('Runtime.evaluate', { expression: `localStorage.setItem('toko360_token', ${access}); localStorage.setItem('toko360_refresh', ${refresh}); location.reload(); true`, returnByValue: true });
    await waitExpression(cdp, `document.body && document.body.innerText.includes('Aset & Fleet')`, 'Navigasi Admin setelah login', 45000);
    evidence.checks.push({ id: 'ADMIN_AUTHENTICATED_SHELL', status: 'PASS' });

    const clickFleet = `(() => { const nodes=[...document.querySelectorAll('button,a')]; const el=nodes.find(x=>x.textContent?.trim().includes('Aset & Fleet')); if(!el)return false; el.click(); return true; })()`;
    await waitExpression(cdp, clickFleet, 'Menu Aset & Fleet');
    await waitExpression(cdp, `document.body && document.body.innerText.includes('Outbound / Delivery Lifecycle') && document.body.innerText.includes('TRIP WORKBENCH')`, 'Delivery Lifecycle Admin', 45000);
    const pageText = await cdp.call('Runtime.evaluate', { expression: `document.body.innerText`, returnByValue: true });
    const bodyText = String(pageText?.result?.value || '');
    if (bodyText.includes('Delivery lifecycle gagal dimuat')) throw new Error('Delivery Lifecycle dirender tetapi read model gagal dimuat dari API.');
    evidence.checks.push({ id: 'ADMIN_DELIVERY_LIFECYCLE', status: 'PASS', assertions: ['Outbound / Delivery Lifecycle', 'TRIP WORKBENCH', 'read model tanpa error'] });

    const clickPayroll = `(() => { const nodes=[...document.querySelectorAll('button,a')]; const el=nodes.find(x=>x.textContent?.trim().includes('HRIS & Payroll')); if(!el)return false; el.click(); return true; })()`;
    await waitExpression(cdp, clickPayroll, 'Menu HRIS & Payroll');
    await waitExpression(cdp, `document.body && document.body.innerText.includes('PAYROLL LIFECYCLE') && document.body.innerText.includes('Riwayat Payroll Runs') && document.body.innerText.includes('PPh / BPJS / Potongan')`, 'Payroll Lifecycle Admin', 45000);
    const payrollPageText = await cdp.call('Runtime.evaluate', { expression: `document.body.innerText`, returnByValue: true });
    const payrollBodyText = String(payrollPageText?.result?.value || '');
    if (payrollBodyText.includes('Gagal memuat HR/Payroll') || payrollBodyText.includes('Gagal memuat detail payroll')) throw new Error('Payroll Lifecycle dirender tetapi read model gagal dimuat dari API.');
    evidence.checks.push({ id: 'ADMIN_PAYROLL_LIFECYCLE', status: 'PASS', assertions: ['PAYROLL LIFECYCLE', 'Riwayat Payroll Runs', 'PPh / BPJS / Potongan', 'read model tanpa error'] });

    await navigateAndAssert(cdp, storefrontUrl, `document.body && document.body.innerText.includes('TOKO360 OFFICIAL STORE') && document.body.innerText.includes('Belanja langsung dari toko')`, 'Storefront browser render');
    evidence.checks.push({ id: 'STOREFRONT_BROWSER_RENDER', status: 'PASS', url: storefrontUrl });

    await navigateAndAssert(cdp, posUrl, `document.body && document.body.innerText.includes('KASIR TOKO360') && document.body.innerText.includes('Masuk ke terminal kasir')`, 'POS browser render');
    evidence.checks.push({ id: 'POS_BROWSER_RENDER', status: 'PASS', url: posUrl });
    await cdp.call('Runtime.evaluate', { expression: `localStorage.setItem('toko360_pos_token', ${access}); location.reload(); true`, returnByValue: true });
    await waitExpression(cdp, `document.body && document.body.innerText.includes('TOKO360 POS') && document.body.innerText.includes('Kasir') && document.body.innerText.includes('Gudang/toko')`, 'POS authenticated cashier shell', 45000);
    try {
      await waitExpression(cdp, `document.body && document.body.innerText.includes('Server online') && !document.body.innerText.includes('Gagal memuat data.')`, 'POS online data/offline-config bootstrap', 45000);
    } catch (error) {
      evidence.posDiagnostic = await browserPageDiagnostic(cdp, `${apiUrl}/health`).catch((diagnosticError) => ({ diagnosticError: diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError) }));
      throw error;
    }
    evidence.checks.push({ id: 'POS_AUTHENTICATED_RUNTIME', status: 'PASS', assertions: ['cashier shell', 'warehouse selector', 'server online', 'offline config/data bootstrap'] });

    await navigateAndAssert(cdp, employeeUrl, `document.body && document.body.innerText.includes('TOKO360 HR') && document.body.innerText.includes('Portal Karyawan')`, 'Employee Portal browser render');
    evidence.checks.push({ id: 'EMPLOYEE_PORTAL_BROWSER_RENDER', status: 'PASS', url: employeeUrl });
    if (String(process.env.T360_UAT_PREPARE_EMPLOYEE_SELF || '').toLowerCase() === 'true') {
      await cdp.call('Runtime.evaluate', { expression: `localStorage.setItem('employeeToken', ${access}); location.reload(); true`, returnByValue: true });
      await waitExpression(cdp, `document.body && document.body.innerText.includes('TOKO360 HR') && document.body.innerText.includes('Halo,') && document.body.innerText.includes('CI-UAT-ADMIN') && document.body.innerText.includes('REKAMAN 31 HARI') && document.body.innerText.includes('Slip Gaji')`, 'Employee Portal authenticated self-service', 45000);
      const employeeText = await cdp.call('Runtime.evaluate', { expression: `document.body.innerText`, returnByValue: true });
      if (String(employeeText?.result?.value || '').includes('Profil belum tersedia')) throw new Error('Employee Portal authenticated shell dirender tetapi self-service read model gagal.');
      evidence.checks.push({ id: 'EMPLOYEE_PORTAL_AUTHENTICATED_RUNTIME', status: 'PASS', assertions: ['employee profile', 'attendance history', 'payslip self-service'] });
    }

    // A page that renders while throwing an uncaught JS exception is not a browser-UAT PASS.
    await sleep(500);
    if (runtimeExceptions.length) {
      evidence.browserRuntimeExceptions = runtimeExceptions.slice(0, 20);
      throw new Error(`Browser mencatat ${runtimeExceptions.length} unhandled JavaScript exception.`);
    }
    evidence.checks.push({ id: 'BROWSER_RUNTIME_EXCEPTIONS', status: 'PASS', count: 0 });
    evidence.status = 'PASS';
  } catch (error) {
    evidence.error = error instanceof Error ? error.message : String(error);
    if (cdp) {
      try {
        const screenshot = await cdp.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        if (screenshot?.data) {
          const screenshotPath = path.resolve(root, 'logs', 'browser-uat', 'failure.png');
          fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
          fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
          evidence.failureScreenshot = path.relative(root, screenshotPath).replaceAll('\\', '/');
        }
      } catch { /* screenshot is best-effort; original UAT failure remains authoritative */ }
    }
    throw error;
  } finally {
    evidence.finishedAt = new Date().toISOString();
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
    cdp?.close();
    await stopBrowserProcess(browser);
    await removeBrowserProfile(tempDir);
  }
}

main().then(() => { console.log(`Browser UAT PASS — evidence: ${output}`); }).catch((error) => { console.error(`Browser UAT FAIL — ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
