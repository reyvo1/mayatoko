'use client';

import type { ReactNode } from 'react';
import { CreditCard, History, RefreshCw, Store, Wifi, WifiOff } from 'lucide-react';

export type PosWorkspace = 'SALE' | 'SHIFT' | 'RETURNS' | 'SYNC';

const WORKSPACES: Array<{ id: PosWorkspace; label: string; icon: typeof CreditCard }> = [
  { id: 'SALE', label: 'Penjualan', icon: CreditCard },
  { id: 'SHIFT', label: 'Shift & Kas', icon: Store },
  { id: 'RETURNS', label: 'Retur', icon: History },
  { id: 'SYNC', label: 'Sinkronisasi', icon: RefreshCw },
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
  return (
    <main className="pos posModern">
      <header className="posTopbar">
        <div className="posBrand">
          <span>TOKO360 POS</span>
          <div>
            <h1>Terminal kasir</h1>
            <small className={`connection ${apiOnline ? 'online' : 'offline'}`}>
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

      <section className="posWorkspaceSurface">{children}</section>
    </main>
  );
}
