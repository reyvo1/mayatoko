'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ChevronRight, PanelLeftClose, PanelLeftOpen, RefreshCw, Search } from 'lucide-react';
import type { AdminIdentity, AdminRuntimeManifest, AdminWorkspace, ResolvedAdminNavigation } from './navigation';
import { domainRoute, resolveDomainViews, type AdminDomainView } from './domain-workspaces';

type AdminAppShellProps = {
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

export default function AdminAppShell({
  manifest,
  identity,
  navigation,
  activeWorkspace,
  activeDomainView,
  apiConnected,
  onNavigate,
  onReload,
  onLogout,
  headerAction,
  children,
}: AdminAppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [navQuery, setNavQuery] = useState('');
  const navItems = useMemo(() => navigation.flatMap((group) => group.items), [navigation]);
  const domainViews = useMemo(() => resolveDomainViews(activeWorkspace, manifest, identity), [activeWorkspace, manifest, identity]);
  const filteredNavigation = useMemo(() => {
    const query = navQuery.trim().toLocaleLowerCase('id-ID');
    if (!query) return navigation;
    return navigation
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => `${item.label} ${item.title} ${item.description}`.toLocaleLowerCase('id-ID').includes(query)),
      }))
      .filter((group) => group.items.length);
  }, [navigation, navQuery]);

  return (
    <div className={`shell ${sidebarCollapsed ? 'sidebarCollapsed' : ''}`}>
      <a className="skipLink" href="#admin-main">Lewati ke konten utama</a>
      <aside className="sidebar" aria-label="Navigasi Admin">
        <div className="logo">
          <span className="logoMark">T3</span>
          <span className="brandText"><strong>Toko360</strong><small>Enterprise Workflow</small></span>
          <button type="button" className="iconButton sidebarToggle" aria-label={sidebarCollapsed ? 'Buka sidebar' : 'Tutup sidebar'} onClick={() => setSidebarCollapsed((value) => !value)}>
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        <label className="navSearch">
          <Search size={15} />
          <input value={navQuery} onChange={(event) => setNavQuery(event.target.value)} placeholder="Cari workspace" aria-label="Cari workspace" />
        </label>

        <nav className="navScroll">
          {filteredNavigation.map((group) => (
            <div key={group.group}>
              <div className="navGroup">{group.group}</div>
              {group.items.map((item) => (
                <button key={item.route} type="button" title={sidebarCollapsed ? item.label : undefined} className={`navItem ${activeWorkspace.route === item.route ? 'active' : ''}`} onClick={() => onNavigate(item.route)}>
                  <span className="navIcon"><item.Icon size={17} /></span><span className="navLabel">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
          {!filteredNavigation.length && <div className="navEmpty">Workspace tidak ditemukan.</div>}
        </nav>

        <div className="sidebarFoot">
          <span className="sidebarFootTitle">Runtime navigation</span>
          <span>{manifest ? `${navItems.length} workspace tersedia` : 'Memuat module catalog...'}</span>
          <span>{manifest ? `${manifest.modules.filter((module) => module.isCore || !module.featureKey || manifest.features?.[module.featureKey]?.enabled === true).length}/${manifest.modules.length} module aktif` : 'Feature flags belum dimuat'}</span>
          <span>{manifest?.uiSchemas?.filter((item) => item.surface.toLowerCase() === 'admin').length ?? 0} Admin UI schema</span>
          <span>v{manifest?.version ?? '0.5.3'}</span>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <select className="mobileNav" aria-label="Pilih workspace" value={activeWorkspace.route} onChange={(event) => onNavigate(event.target.value)}>
            {navItems.map((item) => <option key={item.route} value={item.route}>{item.group} / {item.label}</option>)}
          </select>
          <div className="topContext">
            <span className="contextLabel">Konteks kerja</span>
            <strong>{manifest?.company?.name ?? 'Memuat runtime...'}</strong>
            <small>{manifest?.branch?.name ?? 'Semua cabang yang diizinkan'}</small>
          </div>
          <div className="topRight">
            <span className={`connectionPill ${apiConnected ? 'ok' : 'warn'}`} role="status" aria-live="polite"><span className="statusDot" />{apiConnected ? 'API terhubung' : 'Memuat data'}</span>
            <button type="button" className="secondary compactButton" onClick={onReload}><RefreshCw size={15} /> Muat ulang</button>
            <button type="button" className="secondary compactButton" onClick={onLogout}>Keluar</button>
          </div>
        </header>

        <main id="admin-main" className="content" tabIndex={-1}>
          <div className="breadcrumbs" aria-label="Breadcrumb">
            <button type="button" onClick={() => onNavigate('/dashboard')}>Toko360</button>
            <ChevronRight size={13} />
            <span>{activeWorkspace.group}</span>
            <ChevronRight size={13} />
            <strong>{activeWorkspace.label}</strong>
            {activeDomainView && <><ChevronRight size={13} /><strong>{activeDomainView.label}</strong></>}
          </div>

          <div className="pageHeader fadeSlideIn">
            <div className="pageHeaderCopy">
              <div className="pageHeaderKicker"><span className="eyebrow">{activeWorkspace.eyebrow}</span><span className="routeBadge">{activeWorkspace.route}</span></div>
              <h1>{activeDomainView?.title ?? activeWorkspace.title}</h1>
              <div className="pageDesc">{activeDomainView?.description ?? activeWorkspace.description}</div>
            </div>
            {headerAction}
          </div>

          {domainViews.length > 0 && (
            <nav className="domainWorkspace" aria-label={`${activeWorkspace.label} workspaces`}>
              <div className="domainTabs">
                <button type="button" className={!activeDomainView ? 'active' : ''} onClick={() => onNavigate(activeWorkspace.route)}>Ringkasan</button>
                {domainViews.map((view) => (
                  <button key={view.key} type="button" className={activeDomainView?.key === view.key ? 'active' : ''} onClick={() => onNavigate(domainRoute(activeWorkspace, view))}>
                    <view.Icon size={15} /><span>{view.label}</span>
                  </button>
                ))}
              </div>
            </nav>
          )}

          {children}
        </main>

      </div>
    </div>
  );
}
