'use client';

import { Home, Search, ShoppingBag, UserRound, LogIn, Store, MapPin } from 'lucide-react';
import type { ReactNode } from 'react';

export type StorefrontView = 'home' | 'catalog' | 'product' | 'cart' | 'account';

const NAV_ITEMS: Array<{ id: StorefrontView; label: string; description: string; icon: typeof Home }> = [
  { id: 'home', label: 'Beranda', description: 'Belanja langsung dari toko dengan stok dan harga cabang yang aktif.', icon: Home },
  { id: 'catalog', label: 'Katalog', description: 'Cari produk, bandingkan harga, dan lihat ketersediaan aktual.', icon: Search },
  { id: 'cart', label: 'Keranjang', description: 'Tinjau barang, kuantitas, pembayaran, dan checkout sebelum membuat order.', icon: ShoppingBag },
  { id: 'account', label: 'Akun & Pesanan', description: 'Kelola identitas pelanggan, pesanan, favorit, ulasan, dan retur.', icon: UserRound },
];

export function StorefrontShell({ companyName, activeView, cartCount, signedIn, onNavigate, branchCode, branches, onBranchChange, children }: { companyName: string; branchCode: string; branches: Array<{ code: string; name: string }>; onBranchChange: (branchCode: string) => void; activeView: StorefrontView; cartCount: number; signedIn: boolean; onNavigate: (view: StorefrontView) => void; children: ReactNode; }) {
  const activeMeta = activeView === 'product'
    ? { label: 'Detail produk', description: 'Periksa varian, unit, harga, stok, dan pilihan pembelian sebelum menambah ke keranjang.' }
    : (NAV_ITEMS.find((item) => item.id === activeView) ?? NAV_ITEMS[0]);
  return (
    <div className="storefrontApp min-h-screen bg-[#f7f7f5] text-slate-950" data-visual-product="storefront" data-visual-version="p5-v2" data-visual-generation="p5-v3" data-visual-view={activeView}>
      <a className="skipLink" href="#storefront-main">Lewati ke konten utama</a>

      <div className="border-b border-slate-200 bg-[#15261f] px-4 py-2 text-center text-[10px] font-semibold tracking-[0.04em] text-emerald-50">Belanja dari cabang aktif · Harga dan stok ditarik langsung dari TOKO360</div>
      <header className="storefrontHeader sticky top-0 z-30 border-b border-slate-200/80 bg-[#f7f7f5]/92 backdrop-blur-xl">
        <div className="storefrontHeaderInner mx-auto flex min-h-[72px] w-full max-w-[1480px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <button className="brandButton flex shrink-0 items-center gap-3 rounded-xl border-0 bg-transparent p-0 text-left" type="button" onClick={() => onNavigate('home')} aria-label="Buka beranda">
            <span className="brandMark grid h-10 w-10 place-items-center rounded-full bg-[#15261f] text-[11px] font-black tracking-[0.08em] text-white shadow-[0_10px_24px_rgba(21,38,31,.16)]">T3</span>
            <span className="brandText hidden min-w-0 sm:block"><strong className="block max-w-48 truncate text-sm font-bold tracking-[-0.02em] text-slate-950">{companyName}</strong><small className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">Official Store</small></span>
          </button>

          <nav className="desktopNav hidden flex-1 items-center justify-center gap-1 md:flex" aria-label="Navigasi storefront">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.id === activeView || (item.id === 'catalog' && activeView === 'product');
              return <button key={item.id} className={`navAction relative inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-semibold transition ${active ? 'active bg-[#15261f] text-white shadow-sm' : 'text-slate-500 hover:bg-white hover:text-slate-950'}`} type="button" aria-current={active ? 'page' : undefined} onClick={() => onNavigate(item.id)}><Icon size={15}/>{item.label}{item.id === 'cart' && cartCount > 0 ? <span className="navCount grid h-5 min-w-5 place-items-center rounded-full bg-emerald-500 px-1 text-[9px] text-white">{cartCount}</span> : null}</button>;
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {branches.length > 1 ? <label className="branchChooser relative hidden items-center sm:flex"><MapPin size={14} className="pointer-events-none absolute left-3 text-slate-400"/><span className="srOnly">Pilih cabang storefront</span><select className="h-10 rounded-full border border-slate-200 bg-white pl-8 pr-8 text-[10px] font-semibold text-slate-600 shadow-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" aria-label="Pilih cabang storefront" value={branchCode} onChange={(event) => onBranchChange(event.target.value)}>{branches.map((branch) => <option key={branch.code} value={branch.code}>{branch.name}</option>)}</select></label> : null}
            <button className="accountShortcut inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:-translate-y-px hover:text-slate-950 hover:shadow-md" type="button" onClick={() => onNavigate('account')}>{signedIn ? <UserRound size={16}/> : <LogIn size={16}/>}<span className="hidden lg:inline">{signedIn ? 'Akun saya' : 'Masuk'}</span></button>
          </div>
        </div>
      </header>

      <main id="storefront-main" className="storefrontMain" tabIndex={-1}>
        <div className="viewContext flex flex-wrap items-center gap-2 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400"><span className="viewKicker inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700"><Store size={12}/>TOKO360 STOREFRONT</span><span>{activeView === 'product' ? 'Katalog / Detail produk' : activeMeta.label}</span></div>
        {activeView !== 'home' && (
          <header className="storefrontViewHeader mt-4 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div><h1 className="text-2xl font-bold tracking-[-0.04em] text-slate-950 sm:text-3xl">{activeMeta.label}</h1><p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">{activeMeta.description}</p></div>
            <span className="storefrontBranchContext inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-600 shadow-sm">{branches.find((branch) => branch.code === branchCode)?.name ?? branchCode}</span>
          </header>
        )}
        <div className="storefrontViewBody mt-5 min-w-0">{children}</div>
      </main>

      <nav className="mobileNav" aria-label="Navigasi storefront mobile">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeView || (item.id === 'catalog' && activeView === 'product');
          return <button key={item.id} className={active ? 'active' : ''} type="button" aria-current={active ? 'page' : undefined} onClick={() => onNavigate(item.id)}><span className="mobileIconWrap relative"><Icon size={18}/>{item.id === 'cart' && cartCount > 0 ? <span className="mobileCount absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-emerald-500 px-1 text-[8px] text-white">{cartCount}</span> : null}</span><small>{item.label === 'Akun & Pesanan' ? 'Akun' : item.label}</small></button>;
        })}
      </nav>
    </div>
  );
}
