'use client';

import { FormEvent, useEffect, useState } from 'react';
import { authFetch } from '../auth-fetch';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type Status = { enabled: boolean; setupPending: boolean; remainingRecoveryCodes: number };
type Setup = { secret: string; otpauthUri: string; algorithm: string; digits: number; period: number };

async function api<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await authFetch(`${API}${path}`, token, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(', ') : body.message ?? 'Permintaan keamanan gagal.');
  return body as T;
}

export default function SecurityView({ token }: { token: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function reload() {
    try { setStatus(await api<Status>('/auth/2fa/status', token)); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal memuat status 2FA.'); }
  }
  useEffect(() => { void reload(); }, [token]);

  async function beginSetup() {
    setBusy(true); setMessage(''); setRecoveryCodes([]);
    try { setSetup(await api<Setup>('/auth/2fa/setup', token, { method: 'POST' })); setMessage('Secret 2FA dibuat. Tambahkan ke authenticator lalu konfirmasi kode 6 digit.'); await reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal memulai 2FA.'); }
    finally { setBusy(false); }
  }

  async function confirmSetup(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const result = await api<{ recoveryCodes: string[]; message: string }>('/auth/2fa/confirm', token, { method: 'POST', body: JSON.stringify({ code }) });
      setRecoveryCodes(result.recoveryCodes); setSetup(null); setCode(''); setMessage(result.message); await reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal mengaktifkan 2FA.'); }
    finally { setBusy(false); }
  }

  async function regenerate(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const result = await api<{ recoveryCodes: string[] }>('/auth/2fa/recovery-codes', token, { method: 'POST', body: JSON.stringify({ code }) });
      setRecoveryCodes(result.recoveryCodes); setCode(''); setMessage('Recovery code baru dibuat. Simpan sekarang; daftar lama tidak berlaku.'); await reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal membuat recovery code baru.'); }
    finally { setBusy(false); }
  }

  async function disable(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      await api('/auth/2fa/disable', token, { method: 'POST', body: JSON.stringify({ password, code }) });
      setPassword(''); setCode(''); setRecoveryCodes([]); setSetup(null); setMessage('2FA dinonaktifkan. Sesi lain sudah dicabut.'); await reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal menonaktifkan 2FA.'); }
    finally { setBusy(false); }
  }

  return <section className="panel">
    <div className="panelTitle"><div><span className="eyebrow">KEAMANAN AKUN</span><h2>Autentikasi dua faktor</h2></div><span>{status?.enabled ? `AKTIF · ${status.remainingRecoveryCodes} recovery` : 'NONAKTIF'}</span></div>
    <p className="sectionHelp">TOTP bekerja dengan aplikasi authenticator standar. Secret disimpan terenkripsi di server; recovery code hanya disimpan sebagai hash.</p>
    {message && <div className="notice">{message}</div>}
    {!status?.enabled && <>
      {!setup ? <button type="button" onClick={() => void beginSetup()} disabled={busy}>Mulai setup 2FA</button> : <form onSubmit={confirmSetup}>
        <label>Secret authenticator<input readOnly value={setup.secret} /></label>
        <label>URI authenticator<textarea readOnly value={setup.otpauthUri} rows={3} /></label>
        <label>Kode 6 digit<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required /></label>
        <button disabled={busy}>Konfirmasi & aktifkan</button>
      </form>}
    </>}
    {status?.enabled && <div className="grid2">
      <form onSubmit={regenerate} className="panel compact">
        <h3>Buat recovery code baru</h3>
        <label>Kode TOTP / recovery<input value={code} onChange={(e) => setCode(e.target.value)} required /></label>
        <button disabled={busy}>Regenerasi</button>
      </form>
      <form onSubmit={disable} className="panel compact">
        <h3>Nonaktifkan 2FA</h3>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <label>Kode TOTP / recovery<input value={code} onChange={(e) => setCode(e.target.value)} required /></label>
        <button className="dangerButton" disabled={busy}>Nonaktifkan</button>
      </form>
    </div>}
    {recoveryCodes.length > 0 && <div className="panel highlight"><h3>Recovery code — simpan sekarang</h3><p className="sectionHelp">Masing-masing hanya dapat dipakai sekali. Setelah meninggalkan layar ini server tidak dapat menampilkan plaintext-nya kembali.</p><pre>{recoveryCodes.join('\n')}</pre></div>}
  </section>;
}
