'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Bell, Building2, Menu, RefreshCw, Search, X, ChevronRight, Command, LogOut } from 'lucide-react';
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
  const domainViews = useMemo(() => resolveDomainViews(activeWorkspace, manifest, identity), [activeWorkspace, manifest, identity]);
  const effectiveDomainView = activeDomainView ?? domainViews[0] ?? null;
  const filteredNavigation = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('id-ID');
    if (!needle) return navigation;
    return navigation
      .map((group) => ({ ...group, items: group.items.filter((item) => `${item.label} ${item.title} ${item.description}`.toLocaleLowerCase('id-ID').includes(needle)) }))
      .filter((group) => group.items.length);
  }, [navigation, query]);

  const navigate = (route: string) => { setMobileOpen(false); onNavigate(route); };

  return (
    <div
      className="shell min-h-screen bg-[#f5f7fb] text-slate-950 lg:grid lg:grid-cols-[272px_minmax(0,1fr)]"
      data-visual-product="admin"
      data-visual-version="p5-v2"
      data-visual-generation="p5-v3"
      data-visual-workspace={activeWorkspace.key}
      data-visual-view={effectiveDomainView?.key ?? 'overview'}
    >
      <a className="skipLink" href="#admin-main">Lewati ke konten utama</a>

      /* compatibility source marker: className="sidebar */
      <aside className={`sidebar fixed inset-y-0 left-0 z-50 flex w-[288px] -translate-x-full flex-col border-r border-white/10 bg-[#0b1220]/95 text-slate-100 shadow-[24px_0_64px_rgba(15,23,42,0.20)] backdrop-blur-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:w-[272px] lg:translate-x-0 ${mobileOpen ? 'mobileOpen' : ''}`} aria-label="Navigasi Admin">
        <div className="flex min-h-[76px] items-center gap-3 border-b border-white/10 px-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/10 text-sm font-black tracking-[-0.03em] text-white shadow-[0_12px_28px_rgba(2,6,23,0.22)]">T3</div>
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-[15px] font-bold tracking-[-0.02em] text-white">Toko360</strong>
            <small className="mt-0.5 block truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Business OS</small>
          </div>
          <button type="button" className="iconButton sidebarMobileClose grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 lg:hidden" aria-label="Tutup menu" onClick={() => setMobileOpen(false)}><X size={18}/></button>
        </div>

        <div className="px-3 pt-4">
          <label className="navSearch flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-3 text-slate-400 shadow-inner shadow-black/10 focus-within:border-sky-400/40 focus-within:bg-white/[0.09] focus-within:text-slate-200">
            <Search size={16}/>
            <input className="min-w-0 flex-1 border-0 bg-transparent text-[12px] text-slate-100 outline-none placeholder:text-slate-500" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari menu, fitur, atau area kerja" aria-label="Cari menu" />
            <Command size={13} className="text-slate-600"/>
          </label>
        </div>

        <nav className="navScroll min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,.22)_transparent]">
          {filteredNavigation.map((group) => (
            <section className="navSection" key={group.group}>
              <div className="navGroup mb-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">{group.group}</div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = activeWorkspace.route === item.route;
                  return (
                    <button
                      key={item.route}
                      type="button"
                      className={`navItem group grid w-full grid-cols-[38px_minmax(0,1fr)_16px] items-center gap-2 rounded-2xl px-2 py-2 text-left transition-all duration-150 ${active ? 'active bg-white text-slate-950 shadow-[0_12px_28px_rgba(2,6,23,0.24)]' : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'}`}
                      data-admin-route={item.route}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => navigate(item.route)}
                    >
                      <span className={`navIcon grid h-9 w-9 place-items-center rounded-xl border transition-colors ${active ? 'border-slate-200 bg-slate-100 text-slate-800' : 'border-white/10 bg-white/[0.06] text-slate-400 group-hover:text-slate-200'}`}><item.Icon size={17}/></span>
                      <span className="navLabel min-w-0"><strong className="block truncate text-[12px] font-semibold">{item.label}</strong><small className={`mt-0.5 block truncate text-[10px] ${active ? 'text-slate-500' : 'text-slate-500 group-hover:text-slate-400'}`}>{item.description}</small></span>
                      <ChevronRight size={14} className={`transition-transform ${active ? 'text-slate-400' : 'text-slate-600 group-hover:translate-x-0.5 group-hover:text-slate-400'}`}/>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {!filteredNavigation.length && <div className="navEmpty rounded-2xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-500">Tidak ada menu yang cocok.</div>}
        </nav>

        <div className="sidebarFoot border-t border-white/10 p-3">
          <div className="tenantMini rounded-2xl border border-white/10 bg-white/[0.05] p-3">
            <div className="flex items-start gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-sky-400/10 text-sky-300"><Building2 size={15}/></span>
              <div className="min-w-0 flex-1"><small className="block text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Tenant aktif</small><strong className="mt-1 block truncate text-[11px] text-slate-100">{manifest?.company?.name ?? 'Memuat...'}</strong></div>
            </div>
            {branchContext?.canSwitch && branchContext.branches.length > 1 ? (
              <label className="branchSwitcher mt-3 block"><span className="mb-1 block text-[9px] font-semibold text-slate-500">Cabang aktif</span><select className="h-9 w-full rounded-xl border border-white/10 bg-[#111b2d] px-2 text-[10px] text-slate-200 outline-none focus:border-sky-400/40" aria-label="Ganti cabang aktif" value={branchContext.activeBranchId} onChange={(event)=>onBranchChange(event.target.value)}>{branchContext.branches.map((branch)=><option key={branch.id} value={branch.id}>{branch.code} · {branch.name}{branch.id===branchContext.homeBranchId?' · HOME':''}</option>)}</select></label>
            ) : <span className="mt-2 block truncate pl-[42px] text-[10px] text-slate-500">{manifest?.branch?.name ?? 'Cabang belum dimuat'}</span>}
          </div>
          <button type="button" className="sidebarLogout mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-[11px] font-semibold text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300" onClick={onLogout}><LogOut size={15}/>Keluar dari akun</button>
        </div>
      </aside>
      {mobileOpen && <button className="sidebarBackdrop fixed inset-0 z-40 border-0 bg-slate-950/65 backdrop-blur-sm lg:hidden" type="button" aria-label="Tutup menu" onClick={() => setMobileOpen(false)} />}

      <div className="main min-w-0">
        <header className="topbar sticky top-0 z-30 flex min-h-[68px] items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="topbarStart flex min-w-0 items-center gap-3">
            <button type="button" className="iconButton mobileMenuButton grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm lg:hidden" aria-label="Buka menu" onClick={() => setMobileOpen(true)}><Menu size={19}/></button>
            <div className="topContext min-w-0"><span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">{activeWorkspace.group}</span><strong className="mt-0.5 block truncate text-sm font-semibold tracking-[-0.01em] text-slate-900">{activeWorkspace.label}</strong></div>
          </div>
          <div className="topRight flex items-center gap-2">
            <div className={`connectionPill hidden items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold sm:flex ${apiConnected ? 'ok border-emerald-200 bg-emerald-50 text-emerald-700' : 'warn border-amber-200 bg-amber-50 text-amber-700'}`} role="status" aria-live="polite"><span className={`statusDot h-1.5 w-1.5 rounded-full ${apiConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}/>{apiConnected ? 'Terhubung' : 'Memuat'}</div>
            <button type="button" className="iconButton grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:-translate-y-px hover:text-slate-900 hover:shadow-md" aria-label="Muat ulang" onClick={onReload}><RefreshCw size={17}/></button>
            <button type="button" className="iconButton relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:-translate-y-px hover:text-slate-900 hover:shadow-md" aria-label="Buka pusat notifikasi" onClick={() => navigate('/integrations/notifications')}><Bell size={17}/><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-sky-500 ring-2 ring-white"/></button>
          </div>
        </header>

        <main id="admin-main" className="content" tabIndex={-1} data-admin-workspace={activeWorkspace.key} data-admin-view={effectiveDomainView?.key ?? ""}>
          <section className="pageHeader relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/88 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-6 lg:p-7" data-visual-role="page-header">
            <div className="absolute inset-y-0 left-0 w-1 bg-sky-500" aria-hidden="true"/>
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="pageHeaderCopy min-w-0 max-w-4xl">
                <div className="pageHeaderKicker flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400"><span className="eyebrow rounded-full bg-slate-900 px-2.5 py-1 text-[9px] font-bold tracking-[0.14em] text-white">{activeWorkspace.eyebrow}</span><span>{manifest?.branch?.name ?? 'Branch context'}</span></div>
                <div className="pageTitleRow mt-3 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold tracking-[-0.035em] text-slate-950 sm:text-3xl">{effectiveDomainView?.title ?? activeWorkspace.title}</h1><span className="pageWorkspaceBadge rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-semibold text-sky-700">{activeWorkspace.label}</span></div>
                <p className="pageDesc mt-2 max-w-3xl text-sm leading-6 text-slate-500">{effectiveDomainView?.description ?? activeWorkspace.description}</p>
                <div className="pageContextStrip mt-4 flex flex-wrap gap-2" aria-label="Konteks workspace"><span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-medium text-slate-600">{manifest?.company?.name ?? 'Tenant'}</span><span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-medium text-slate-600">{manifest?.branch?.code ?? manifest?.branch?.name ?? 'Branch'}</span><span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-medium text-slate-600">{domainViews.length ? `${domainViews.length} area kerja` : 'Ringkasan workspace'}</span></div>
              </div>
              {headerAction && <div className="pageHeaderActions shrink-0">{headerAction}</div>}
            </div>
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

          <div className="workspaceSurface mt-4 min-w-0 space-y-4">{children}</div>
        </main>
      </div>
    </div>
  );
}
