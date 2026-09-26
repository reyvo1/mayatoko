'use client';

import type { ReactNode } from 'react';
import { CreditCard, History, RefreshCw, Store, Wifi, WifiOff } from 'lucide-react';

export type PosWorkspace = 'SALE' | 'SHIFT' | 'RETURNS' | 'SYNC';

const WORKSPACES: Array<{ id: PosWorkspace; label: string; description: string; icon: typeof CreditCard }> = [
  { id: 'SALE', label: 'Penjualan', description: 'Scan produk, susun keranjang, quote server, dan selesaikan pembayaran.', icon: CreditCard },
  { id: 'SHIFT', label: 'Shift & Kas', description: 'Kontrol shift kasir, expected cash, kas masuk/keluar, dan penutupan.', icon: Store },
  { id: 'RETURNS', label: 'Retur', description: 'Cari transaksi asli dan buat retur auditable melalui jalur canonical.', icon: History },
  { id: 'SYNC', label: 'Sinkronisasi', description: 'Pantau antrean offline, konflik, retry, dan pemulihan koneksi.', icon: RefreshCw },
];

export function PosShell({
  workspace,
  onWorkspaceChange,
  apiOnline,
  queueCount,
  conflictCount,
  warehouseControl,
  children,
}: {
  workspace: PosWorkspace;
  onWorkspaceChange: (workspace: PosWorkspace) => void;
  apiOnline: boolean;
  queueCount: number;
  conflictCount: number;
  warehouseControl: ReactNode;
  children: ReactNode;
}) {
  const activeMeta = WORKSPACES.find((item) => item.id === workspace) ?? WORKSPACES[0];
  return (
    <main className="pos posModern" data-visual-product="pos" data-visual-view={workspace.toLowerCase()}>
      <a className="skipLink" href="#pos-workspace">Lewati ke workspace POS</a>
      <header className="posTopbar">
        <div className="posBrand">
          <span>TOKO360 POS</span>
          <div>
            <h1>Kasir · Terminal penjualan</h1>
            <small className={`connection ${apiOnline ? 'online' : 'offline'}`} role="status" aria-live="polite">
              {apiOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
              {apiOnline ? 'Server online' : 'Mode offline'}
              {queueCount ? ` · ${queueCount} antrean` : ''}
            </small>
          </div>
        </div>
        <div className="posTopbarActions">{warehouseControl}</div>
      </header>

      <nav className="posWorkspaceNav" aria-label="Workspace POS">
        {WORKSPACES.map(({ id, label, icon: Icon }) => {
          const badge = id === 'SYNC' ? queueCount : id === 'RETURNS' ? conflictCount : 0;
          return (
            <button
              key={id}
              type="button"
              className={workspace === id ? 'active' : ''}
              aria-current={workspace === id ? 'page' : undefined}
              onClick={() => onWorkspaceChange(id)}
            >
              <Icon size={15} />
              <span>{label}</span>
              {badge > 0 && <b>{badge}</b>}
            </button>
          );
        })}
      </nav>

      <section id="pos-workspace" className="posWorkspaceSurface" tabIndex={-1}>
        <header className="posWorkspaceHeader">
          <div>
            <span>WORKSPACE KASIR</span>
            <h2>{activeMeta.label}</h2>
            <p>{activeMeta.description}</p>
          </div>
          <div className={`posWorkspaceStatus ${apiOnline ? 'ok' : 'warn'}`}>
            {apiOnline ? 'Transaksi online' : 'Offline terbatas'}
          </div>
        </header>
        <div className="posWorkspaceBody">{children}</div>
      </section>
    </main>
  );
}
