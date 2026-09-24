'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Bell, Building2, Menu, RefreshCw, Search, X } from 'lucide-react';
import type { AdminIdentity, AdminRuntimeManifest, AdminWorkspace, ResolvedAdminNavigation } from './navigation';
import { domainRoute, resolveDomainViews, type AdminDomainView } from './domain-workspaces';

type Props = {
  manifest: AdminRuntimeManifest | null;
  identity: AdminIdentity | null;
  navigation: ResolvedAdminNavigation;
  activeWorkspace: AdminWorkspace;
  activeDomainView: AdminDomainView | null;
  apiConnected: boolean;
  onNavigate: (route: string) => void;
  onReload: () => void;
  onLogout: () => void;
  headerAction?: ReactNode;
  children: ReactNode;
};

export default function AdminAppShell({ manifest, identity, navigation, activeWorkspace, activeDomainView, apiConnected, onNavigate, onReload, onLogout, headerAction, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navItems = useMemo(() => navigation.flatMap((group) => group.items), [navigation]);
  const domainViews = useMemo(() => resolveDomainViews(activeWorkspace, manifest, identity), [activeWorkspace, manifest, identity]);
  const filteredNavigation = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('id-ID');
    if (!needle) return navigation;
    return navigation.map((group) => ({ ...group, items: group.items.filter((item) => `${item.label} ${item.title} ${item.description}`.toLocaleLowerCase('id-ID').includes(needle)) })).filter((group) => group.items.length);
  }, [navigation, query]);

  const navigate = (route: string) => { setMobileOpen(false); onNavigate(route); };

  return (
    <div className="shell">
      <a className="skipLink" href="#admin-main">Lewati ke konten utama</a>
      <aside className={`sidebar ${mobileOpen ? 'mobileOpen' : ''}`} aria-label="Navigasi Admin">
        <div className="logo">
          <div className="logoMark">T3</div>
          <div className="brandText"><strong>Toko360</strong><small>Business Operating System</small></div>
          <button type="button" className="iconButton sidebarMobileClose" aria-label="Tutup menu" onClick={() => setMobileOpen(false)}><X size={18}/></button>
        </div>

        <label className="navSearch"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari menu, fitur, atau area kerja" aria-label="Cari menu" /></label>

        <nav className="navScroll">
          {filteredNavigation.map((group) => (
            <section className="navSection" key={group.group}>
              <div className="navGroup">{group.group}</div>
              {group.items.map((item) => (
                <button key={item.route} type="button" className={`navItem ${activeWorkspace.route === item.route ? 'active' : ''}`} aria-current={activeWorkspace.route === item.route ? 'page' : undefined} onClick={() => navigate(item.route)}>
                  <span className="navIcon"><item.Icon size={18}/></span>
                  <span className="navLabel"><strong>{item.label}</strong><small>{item.description}</small></span>
                </button>
              ))}
            </section>
          ))}
          {!filteredNavigation.length && <div className="navEmpty">Tidak ada menu yang cocok.</div>}
        </nav>

        <div className="sidebarFoot">
          <div className="tenantMini"><Building2 size={16}/><div><small>Tenant aktif</small><strong>{manifest?.company?.name ?? 'Memuat...'}</strong><span>{manifest?.branch?.name ?? 'Cabang belum dimuat'}</span></div></div>
          <button type="button" className="sidebarLogout" onClick={onLogout}>Keluar dari akun</button>
        </div>
      </aside>
      {mobileOpen && <button className="sidebarBackdrop" type="button" aria-label="Tutup menu" onClick={() => setMobileOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <div className="topbarStart">
            <button type="button" className="iconButton mobileMenuButton" aria-label="Buka menu" onClick={() => setMobileOpen(true)}><Menu size={19}/></button>
            <div className="topContext">
              <span>{activeWorkspace.group}</span>
              <strong>{activeWorkspace.label}</strong>
            </div>
          </div>
          <div className="topRight">
            <div className={`connectionPill ${apiConnected ? 'ok' : 'warn'}`} role="status" aria-live="polite"><span className="statusDot"/>{apiConnected ? 'Terhubung' : 'Memuat'}</div>
            <button type="button" className="iconButton" aria-label="Muat ulang" onClick={onReload}><RefreshCw size={17}/></button>
            <button type="button" className="iconButton" aria-label="Buka pusat notifikasi" onClick={() => navigate('/integrations/notifications')}><Bell size={17}/></button>
          </div>
        </header>

        <main id="admin-main" className="content" tabIndex={-1}>
          <section className="pageHeader">
            <div className="pageHeaderCopy">
              <div className="pageHeaderKicker"><span className="eyebrow">{activeWorkspace.eyebrow}</span><span>{manifest?.branch?.name ?? 'Branch context'}</span></div>
              <h1>{activeDomainView?.title ?? activeWorkspace.title}</h1>
              <p className="pageDesc">{activeDomainView?.description ?? activeWorkspace.description}</p>
            </div>
            {headerAction && <div className="pageHeaderActions">{headerAction}</div>}
          </section>

          {domainViews.length > 0 && (
            <nav className="domainTabs" aria-label={`${activeWorkspace.label} sub menu`}>
              {domainViews.map((view) => (
                <button key={view.key} type="button" className={activeDomainView?.key === view.key || (!activeDomainView && domainViews[0]?.key === view.key) ? 'active' : ''} aria-current={activeDomainView?.key === view.key ? 'page' : undefined} onClick={() => onNavigate(domainRoute(activeWorkspace, view))}>
                  <view.Icon size={16}/><span>{view.label}</span>
                </button>
              ))}
              <span className="domainTabsSpacer" />
              <span className="domainMore" aria-label="Jumlah area kerja"><span>{domainViews.length} area kerja</span></span>
            </nav>
          )}

          <div className="workspaceSurface">{children}</div>
        </main>
      </div>
    </div>
  );
}
