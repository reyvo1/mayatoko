import Link from 'next/link';
import { CalendarDays, History, Home, LogOut, MapPinCheckInside, ReceiptText, TimerReset, UserRound } from 'lucide-react';

export type EmployeePortalView =
  | 'home'
  | 'attendance'
  | 'leave'
  | 'overtime'
  | 'payslips'
  | 'history'
  | 'profile';

type NavItem = {
  id: EmployeePortalView;
  label: string;
  description: string;
  href: string;
  Icon: typeof Home;
};

const NAV: NavItem[] = [
  { id: 'home', label: 'Beranda', description: 'Ringkasan hari kerja dan akses cepat', href: '/', Icon: Home },
  { id: 'attendance', label: 'Absensi', description: 'Presensi GPS, selfie, dan geofence', href: '/attendance', Icon: MapPinCheckInside },
  { id: 'leave', label: 'Cuti & Izin', description: 'Pengajuan dan status persetujuan', href: '/leave', Icon: CalendarDays },
  { id: 'overtime', label: 'Lembur', description: 'Pengajuan lembur dan hasil approval', href: '/overtime', Icon: TimerReset },
  { id: 'payslips', label: 'Slip Gaji', description: 'Riwayat slip yang sudah dipublikasikan', href: '/payslips', Icon: ReceiptText },
  { id: 'history', label: 'Riwayat', description: 'Riwayat presensi dan status kehadiran', href: '/history', Icon: History },
  { id: 'profile', label: 'Profil', description: 'Identitas employee dan konteks cabang', href: '/profile', Icon: UserRound },
];

export function isEmployeePortalView(value: string): value is EmployeePortalView {
  return NAV.some((item) => item.id === value);
}

export function employeePortalMeta(view: EmployeePortalView) {
  return NAV.find((item) => item.id === view) ?? NAV[0];
}

export function EmployeePortalShell({
  activeView,
  employeeName,
  employeeNumber,
  loading,
  onLogout,
  children,
}: {
  activeView: EmployeePortalView;
  employeeName?: string;
  employeeNumber?: string;
  loading: boolean;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const meta = employeePortalMeta(activeView);

  return (
    <main className="employeeShell" data-visual-product="employee-portal" data-visual-version="p5-v2" data-visual-view={activeView}>
      <a className="skipLink" href="#employee-main">Lewati ke konten utama</a>
      <aside className="employeeSidebar">
        <div className="employeeBrand">
          <span className="brandEyebrow">TOKO360 HR</span>
          <strong>Portal Karyawan</strong>
          <small>Employee self-service</small>
        </div>

        <nav className="employeeNav" aria-label="Navigasi Portal Karyawan">
          {NAV.map((item) => {
            const Icon = item.Icon;
            return (
            <Link
              key={item.id}
              className={`employeeNavItem ${item.id === activeView ? 'active' : ''}`}
              href={item.href}
              aria-current={item.id === activeView ? 'page' : undefined}
            >
              <span className="employeeNavIcon"><Icon size={17} /></span>
              <span className="employeeNavCopy"><strong>{item.label}</strong><small>{item.description}</small></span>
            </Link>
            );
          })}
        </nav>

        <div className="employeeSidebarFooter">
          <small>Akun aktif</small>
          <strong>{employeeName ?? 'Karyawan'}</strong>
          <span>{employeeNumber ?? (loading ? 'Memuat profil…' : 'Profil belum tersedia')}</span>
        </div>
      </aside>

      <section id="employee-main" className="employeeWorkspace" tabIndex={-1}>
        <header className="employeeTopbar">
          <div>
            <span className="brandEyebrow">TOKO360 HR</span>
            <h1>Halo, {employeeName ?? 'Karyawan'}</h1>
            <p>{employeeNumber ?? (loading ? 'Memuat profil…' : 'Profil belum tersedia')}</p>
          </div>
          <button className="outline iconButton" onClick={onLogout}><LogOut size={16} />Keluar</button>
        </header>

        <nav className="employeeMobileNav" aria-label="Navigasi mobile Portal Karyawan">
          {NAV.map((item) => {
            const Icon = item.Icon;
            return (
              <Link
                key={item.id}
                className={item.id === activeView ? 'active' : ''}
                href={item.href}
                aria-current={item.id === activeView ? 'page' : undefined}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="employeePageHeading">
          <div>
            <small>PORTAL KARYAWAN / {meta.label.toUpperCase()}</small>
            <h2>{meta.label}</h2>
            <p>{meta.description}</p>
          </div>
          <div className="employeeContextPill">{loading ? 'Memuat data' : 'Self-service aktif'}</div>
        </div>

        <div className="employeeViewBody">{children}</div>
      </section>
    </main>
  );
}
