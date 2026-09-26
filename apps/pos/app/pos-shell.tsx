'use client';

import type { ReactNode } from 'react';
import { CreditCard, History, RefreshCw, Store, Wifi, WifiOff, CircleGauge } from 'lucide-react';

export type PosWorkspace = 'SALE' | 'SHIFT' | 'RETURNS' | 'SYNC';

const WORKSPACES: Array<{ id: PosWorkspace; label: string; description: string; icon: typeof CreditCard }> = [
  { id: 'SALE', label: 'Penjualan', description: 'Scan produk, susun keranjang, quote server, dan selesaikan pembayaran.', icon: CreditCard },
  { id: 'SHIFT', label: 'Shift & Kas', description: 'Kontrol shift kasir, expected cash, kas masuk/keluar, dan penutupan.', icon: Store },
  { id: 'RETURNS', label: 'Retur', description: 'Cari transaksi asli dan buat retur auditable melalui jalur canonical.', icon: History },
  { id: 'SYNC', label: 'Sinkronisasi', description: 'Pantau antrean offline, konflik, retry, dan pemulihan koneksi.', icon: RefreshCw },
];

export function PosShell({ workspace, onWorkspaceChange, apiOnline, queueCount, conflictCount, warehouseControl, children }: { workspace: PosWorkspace; onWorkspaceChange: (workspace: PosWorkspace) => void; apiOnline: boolean; queueCount: number; conflictCount: number; warehouseControl: ReactNode; children: ReactNode; }) {
  const activeMeta = WORKSPACES.find((item) => item.id === workspace) ?? WORKSPACES[0];
  return (
    <main className="pos posModern min-h-screen bg-[#eef4f6] text-slate-950" data-visual-product="pos" data-visual-version="p5-v2" data-visual-generation="p5-v3" data-visual-view={workspace.toLowerCase()}>
      <a className="skipLink" href="#pos-workspace">Lewati ke workspace POS</a>

      <header className="posTopbar sticky top-0 z-30 flex min-h-[70px] items-center justify-between gap-4 border-b border-slate-200/80 bg-white/90 px-4 shadow-[0_8px_28px_rgba(15,23,42,.06)] backdrop-blur-xl sm:px-6">
        <div className="posBrand flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#0f766e] text-[10px] font-black tracking-[0.08em] text-white shadow-[0_10px_24px_rgba(15,118,110,.22)]">T3</span>
          <div className="min-w-0"><span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-teal-700">TOKO360 POS</span><h1 className="truncate text-sm font-semibold tracking-[-0.02em] text-slate-900">Kasir · Terminal penjualan</h1><small className={`connection mt-0.5 flex items-center gap-1.5 text-[10px] font-medium ${apiOnline ? 'online text-emerald-700' : 'offline text-amber-700'}`} role="status" aria-live="polite">{apiOnline ? <Wifi size={12} /> : <WifiOff size={12} />}{apiOnline ? 'Server online' : 'Mode offline'}{queueCount ? ` · ${queueCount} antrean` : ''}</small></div>
        </div>
        <div className="posTopbarActions flex shrink-0 items-center gap-2">{warehouseControl}</div>
      </header>

      <div className="mx-auto w-full max-w-[1720px] px-3 py-3 sm:px-5 sm:py-4 lg:px-6">
        <nav className="posWorkspaceNav" aria-label="Workspace POS">
          {WORKSPACES.map(({ id, label, icon: Icon }) => {
            const badge = id === 'SYNC' ? queueCount : id === 'RETURNS' ? conflictCount : 0;
            const active = workspace === id;
            return (
              <button key={id} type="button" className={active ? 'active' : ''} aria-current={workspace === id ? 'page' : undefined} onClick={() => onWorkspaceChange(id)}>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-current/5"><Icon size={16} /></span>
                <span className="min-w-0 truncate">{label}</span>
                {badge > 0 && <b>{badge}</b>}
              </button>
            );
          })}
        </nav>

        <section id="pos-workspace" className="posWorkspaceSurface" tabIndex={-1}>
          <header className="posWorkspaceHeader">
            <div className="min-w-0"><span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-teal-700"><CircleGauge size={13}/>WORKSPACE KASIR</span><h2 className="mt-1 text-xl font-bold tracking-[-0.035em] text-slate-950 sm:text-2xl">{activeMeta.label}</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500 sm:text-[13px]">{activeMeta.description}</p></div>
            <div className={`posWorkspaceStatus ${apiOnline ? 'ok' : 'warn'}`}>{apiOnline ? 'Transaksi online' : 'Offline terbatas'}</div>
          </header>
          <div className="posWorkspaceBody">{children}</div>
        </section>
      </div>
    </main>
  );
}
