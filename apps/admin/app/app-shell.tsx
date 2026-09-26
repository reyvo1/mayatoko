'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Bell, Building2, Menu, RefreshCw, Search, X } from 'lucide-react';
import type { AdminIdentity, AdminRuntimeManifest, AdminWorkspace, ResolvedAdminNavigation } from './navigation';
import { domainRoute, resolveDomainViews, type AdminDomainView } from './domain-workspaces';

type BranchContext = { activeBranchId:string; homeBranchId:string; canSwitch:boolean; branches:Array<{id:string;code:string;name:string;isActive:boolean}> };

type Props = {
  manifest: AdminRuntimeManifest | null;
  identity: AdminIdentity | null;
  navigation: ResolvedAdminNavigation;
  activeWorkspace: AdminWorkspace;
  activeDomainView: AdminDomainView | null;
  apiConnected: boolean;
  branchContext: BranchContext | null;
  onBranchChange: (branchId:string) => void;
  onNavigate: (route: string) => void;
  onReload: () => void;
  onLogout: () => void;
  headerAction?: ReactNode;
  children: ReactNode;
};

export default function AdminAppShell({ manifest, identity, navigation, activeWorkspace, activeDomainView, apiConnected, branchContext, onBranchChange, onNavigate, onReload, onLogout, headerAction, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navItems = useMemo(() => navigation.flatMap((group) => group.items), [navigation]);
  const domainViews = useMemo(() => resolveDomainViews(activeWorkspace, manifest, identity), [activeWorkspace, manifest, identity]);
  const effectiveDomainView = activeDomainView ?? domainViews[0] ?? null;
  const filteredNavigation = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('id-ID');
    if (!needle) return navigation;
    return navigation.map((group) => ({ ...group, items: group.items.filter((item) => `${item.label} ${item.title} ${item.description}`.toLocaleLowerCase('id-ID').includes(needle)) })).filter((group) => group.items.length);
  }, [navigation, query]);

  const navigate = (route: string) => { setMobileOpen(false); onNavigate(route); };

  return (
    <div className="shell" data-visual-product="admin" data-visual-version="p5-v2" data-visual-workspace={activeWorkspace.key} data-visual-view={effectiveDomainView?.key ?? "overview"}>
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
                <button key={item.route} type="button" className={`navItem ${activeWorkspace.route === item.route ? 'active' : ''}`} data-admin-route={item.route} aria-current={activeWorkspace.route === item.route ? 'page' : undefined} onClick={() => navigate(item.route)}>
                  <span className="navIcon"><item.Icon size={18}/></span>
                  <span className="navLabel"><strong>{item.label}</strong><small>{item.description}</small></span>
                </button>
              ))}
            </section>
          ))}
          {!filteredNavigation.length && <div className="navEmpty">Tidak ada menu yang cocok.</div>}
        </nav>

        <div className="sidebarFoot">
          <div className="tenantMini"><Building2 size={16}/><div><small>Tenant aktif</small><strong>{manifest?.company?.name ?? 'Memuat...'}</strong>
            {branchContext?.canSwitch && branchContext.branches.length > 1 ? <label className="branchSwitcher"><span>Cabang aktif</span><select aria-label="Ganti cabang aktif" value={branchContext.activeBranchId} onChange={(event)=>onBranchChange(event.target.value)}>{branchContext.branches.map((branch)=><option key={branch.id} value={branch.id}>{branch.code} · {branch.name}{branch.id===branchContext.homeBranchId?' · HOME':''}</option>)}</select></label> : <span>{manifest?.branch?.name ?? 'Cabang belum dimuat'}</span>}
          </div></div>
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

        <main id="admin-main" className="content" tabIndex={-1} data-admin-workspace={activeWorkspace.key} data-admin-view={effectiveDomainView?.key ?? ""}>
          <section className="pageHeader" data-visual-role="page-header">
            <div className="pageHeaderCopy">
              <div className="pageHeaderKicker"><span className="eyebrow">{activeWorkspace.eyebrow}</span><span>{manifest?.branch?.name ?? 'Branch context'}</span></div>
              <div className="pageTitleRow">
                <h1>{effectiveDomainView?.title ?? activeWorkspace.title}</h1>
                <span className="pageWorkspaceBadge">{activeWorkspace.label}</span>
              </div>
              <p className="pageDesc">{effectiveDomainView?.description ?? activeWorkspace.description}</p>
              <div className="pageContextStrip" aria-label="Konteks workspace">
                <span>{manifest?.company?.name ?? 'Tenant'}</span>
                <span>{manifest?.branch?.code ?? manifest?.branch?.name ?? 'Branch'}</span>
                <span>{domainViews.length ? `${domainViews.length} area kerja` : 'Ringkasan workspace'}</span>
              </div>
            </div>
            {headerAction && <div className="pageHeaderActions">{headerAction}</div>}
          </section>

          {domainViews.length > 0 && (
            <nav className="domainTabs" aria-label={`${activeWorkspace.label} sub menu`}>
              {domainViews.map((view) => (
                <button key={view.key} type="button" className={effectiveDomainView?.key === view.key ? 'active' : ''} data-admin-route={domainRoute(activeWorkspace, view)} aria-current={effectiveDomainView?.key === view.key ? 'page' : undefined} onClick={() => onNavigate(domainRoute(activeWorkspace, view))}>
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
