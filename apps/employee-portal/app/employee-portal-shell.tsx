import Link from 'next/link';
import { CalendarDays, History, Home, LogOut, MapPinCheckInside, ReceiptText, TimerReset, UserRound, Sparkles } from 'lucide-react';

export type EmployeePortalView = 'home' | 'attendance' | 'leave' | 'overtime' | 'payslips' | 'history' | 'profile';

type NavItem = { id: EmployeePortalView; label: string; description: string; href: string; Icon: typeof Home; };

const NAV: NavItem[] = [
  { id: 'home', label: 'Beranda', description: 'Ringkasan hari kerja dan akses cepat', href: '/', Icon: Home },
  { id: 'attendance', label: 'Absensi', description: 'Presensi GPS, selfie, dan geofence', href: '/attendance', Icon: MapPinCheckInside },
  { id: 'leave', label: 'Cuti & Izin', description: 'Pengajuan dan status persetujuan', href: '/leave', Icon: CalendarDays },
  { id: 'overtime', label: 'Lembur', description: 'Pengajuan lembur dan hasil approval', href: '/overtime', Icon: TimerReset },
  { id: 'payslips', label: 'Slip Gaji', description: 'Riwayat slip yang sudah dipublikasikan', href: '/payslips', Icon: ReceiptText },
  { id: 'history', label: 'Riwayat', description: 'Riwayat presensi dan status kehadiran', href: '/history', Icon: History },
  { id: 'profile', label: 'Profil', description: 'Identitas employee dan konteks cabang', href: '/profile', Icon: UserRound },
];

export function isEmployeePortalView(value: string): value is EmployeePortalView { return NAV.some((item) => item.id === value); }
export function employeePortalMeta(view: EmployeePortalView) { return NAV.find((item) => item.id === view) ?? NAV[0]; }

export function EmployeePortalShell({ activeView, employeeName, employeeNumber, loading, onLogout, children }: { activeView: EmployeePortalView; employeeName?: string; employeeNumber?: string; loading: boolean; onLogout: () => void; children: React.ReactNode; }) {
  const meta = employeePortalMeta(activeView);

  return (
    <main className="employeeShell min-h-screen bg-[#f6f7fb] text-slate-950 lg:grid lg:grid-cols-[248px_minmax(0,1fr)]" data-visual-product="employee-portal" data-visual-version="p5-v2" data-visual-generation="p5-v3" data-visual-view={activeView}>
      <a className="skipLink" href="#employee-main">Lewati ke konten utama</a>

      <aside className="employeeSidebar hidden border-r border-slate-200/80 bg-white/90 p-4 shadow-[16px_0_44px_rgba(15,23,42,.045)] backdrop-blur-xl lg:flex lg:h-screen lg:flex-col">
        <div className="employeeBrand rounded-[22px] bg-[#312e81] p-4 text-white shadow-[0_14px_34px_rgba(49,46,129,.18)]">
          <span className="brandEyebrow inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.16em] text-violet-200"><Sparkles size={12}/>TOKO360 HR</span>
          <strong className="mt-2 block text-lg font-bold tracking-[-.03em]">Portal Karyawan</strong>
          <small className="mt-1 block text-[10px] text-violet-200/80">Employee self-service</small>
        </div>

        <nav className="employeeNav mt-4 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label="Navigasi Portal Karyawan">
          {NAV.map((item) => {
            const Icon = item.Icon;
            const active = item.id === activeView;
            return (
              <Link key={item.id} className={`employeeNavItem group grid min-h-[48px] grid-cols-[38px_minmax(0,1fr)] items-center gap-2 rounded-2xl px-2 py-1.5 transition ${active ? 'active bg-violet-50 text-violet-900 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`} href={item.href} aria-current={active ? 'page' : undefined}>
                <span className={`employeeNavIcon grid h-9 w-9 place-items-center rounded-xl border transition ${active ? 'border-violet-200 bg-white text-violet-700 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-400 group-hover:text-slate-600'}`}><Icon size={16} /></span>
                <span className="employeeNavCopy min-w-0"><strong className="block truncate text-[11px] font-semibold">{item.label}</strong><small className="mt-0.5 block truncate text-[9px] text-slate-400">{item.description}</small></span>
              </Link>
            );
          })}
        </nav>

        <div className="employeeSidebarFooter mt-4 rounded-[20px] border border-slate-200 bg-slate-50 p-3"><small className="block text-[9px] font-bold uppercase tracking-[.12em] text-slate-400">Akun aktif</small><strong className="mt-1 block truncate text-xs font-semibold text-slate-800">{employeeName ?? 'Karyawan'}</strong><span className="mt-0.5 block truncate text-[10px] text-slate-500">{employeeNumber ?? (loading ? 'Memuat profil…' : 'Profil belum tersedia')}</span></div>
      </aside>

      <section id="employee-main" className="employeeWorkspace" tabIndex={-1}>
        <header className="employeeTopbar sticky top-0 z-30 flex min-h-[70px] items-center justify-between gap-4 border-b border-slate-200/80 bg-white/82 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="min-w-0"><span className="brandEyebrow block text-[9px] font-bold uppercase tracking-[.16em] text-violet-600">TOKO360 HR</span><h1 className="mt-0.5 truncate text-sm font-semibold tracking-[-.02em] text-slate-900">Halo, {employeeName ?? 'Karyawan'}</h1><p className="truncate text-[10px] text-slate-400">{employeeNumber ?? (loading ? 'Memuat profil…' : 'Profil belum tersedia')}</p></div>
          <button className="outline iconButton inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:-translate-y-px hover:text-slate-950 hover:shadow-md" onClick={onLogout}><LogOut size={15} />Keluar</button>
        </header>

        <nav className="employeeMobileNav" aria-label="Navigasi mobile Portal Karyawan">
          {NAV.slice(0, 4).map((item) => { const Icon = item.Icon; return <Link key={item.id} className={item.id === activeView ? 'active' : ''} href={item.href} aria-current={item.id === activeView ? 'page' : undefined}><Icon size={16} /><span>{item.label}</span></Link>; })}
        </nav>

        <div className="employeePageHeading mx-auto flex w-full max-w-[1480px] flex-col gap-4 px-4 pb-4 pt-6 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:pt-8">
          <div><small className="text-[9px] font-bold uppercase tracking-[.16em] text-violet-600">PORTAL KARYAWAN / {meta.label.toUpperCase()}</small><h2 className="mt-1.5 text-2xl font-bold tracking-[-.04em] text-slate-950 sm:text-3xl">{meta.label}</h2><p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">{meta.description}</p></div>
          <div className="employeeContextPill inline-flex w-fit items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold text-emerald-700">{loading ? 'Memuat data' : 'Self-service aktif'}</div>
        </div>

        <div className="employeeViewBody">{children}</div>
      </section>
    </main>
  );
}
