'use client';

import { Home, Search, ShoppingBag, UserRound, LogIn } from 'lucide-react';
import type { ReactNode } from 'react';

export type StorefrontView = 'home' | 'catalog' | 'product' | 'cart' | 'account';

const NAV_ITEMS: Array<{ id: StorefrontView; label: string; description: string; icon: typeof Home }> = [
  { id: 'home', label: 'Beranda', description: 'Belanja langsung dari toko dengan stok dan harga cabang yang aktif.', icon: Home },
  { id: 'catalog', label: 'Katalog', description: 'Cari produk, bandingkan harga, dan lihat ketersediaan aktual.', icon: Search },
  { id: 'cart', label: 'Keranjang', description: 'Tinjau barang, kuantitas, pembayaran, dan checkout sebelum membuat order.', icon: ShoppingBag },
  { id: 'account', label: 'Akun & Pesanan', description: 'Kelola identitas pelanggan, pesanan, favorit, ulasan, dan retur.', icon: UserRound },
];

export function StorefrontShell({
  companyName,
  activeView,
  cartCount,
  signedIn,
  onNavigate,
  branchCode,
  branches,
  onBranchChange,
  children,
}: {
  companyName: string;
  branchCode: string;
  branches: Array<{ code: string; name: string }>;
  onBranchChange: (branchCode: string) => void;
  activeView: StorefrontView;
  cartCount: number;
  signedIn: boolean;
  onNavigate: (view: StorefrontView) => void;
  children: ReactNode;
}) {
  const activeMeta = activeView === 'product'
    ? { label: 'Detail produk', description: 'Periksa varian, unit, harga, stok, dan pilihan pembelian sebelum menambah ke keranjang.' }
    : (NAV_ITEMS.find((item) => item.id === activeView) ?? NAV_ITEMS[0]);
  return (
    <div className="storefrontApp" data-visual-product="storefront" data-visual-view={activeView}>
      <a className="skipLink" href="#storefront-main">Lewati ke konten utama</a>
      <header className="storefrontHeader">
        <div className="storefrontHeaderInner">
          <button className="brandButton" type="button" onClick={() => onNavigate('home')} aria-label="Buka beranda">
            <span className="brandMark">T3</span>
            <span className="brandText"><strong>{companyName}</strong><small>Official Store</small></span>
          </button>

          <nav className="desktopNav" aria-label="Navigasi storefront">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.id === activeView || (item.id === 'catalog' && activeView === 'product');
              return <button key={item.id} className={active ? 'navAction active' : 'navAction'} type="button" aria-current={active ? 'page' : undefined} onClick={() => onNavigate(item.id)}><Icon size={16}/>{item.label}{item.id === 'cart' && cartCount > 0 ? <span className="navCount">{cartCount}</span> : null}</button>;
            })}
          </nav>

          {branches.length > 1 ? <label className="branchChooser"><span className="srOnly">Pilih cabang storefront</span><select aria-label="Pilih cabang storefront" value={branchCode} onChange={(event) => onBranchChange(event.target.value)}>{branches.map((branch) => <option key={branch.code} value={branch.code}>{branch.name}</option>)}</select></label> : null}
          <button className="accountShortcut" type="button" onClick={() => onNavigate('account')}>
            {signedIn ? <UserRound size={17}/> : <LogIn size={17}/>}
            <span>{signedIn ? 'Akun saya' : 'Masuk'}</span>
          </button>
        </div>
      </header>

      <main id="storefront-main" className="storefrontMain" tabIndex={-1}>
        <div className="viewContext">
          <span className="viewKicker">TOKO360 STOREFRONT</span>
          <span>{activeView === 'product' ? 'Katalog / Detail produk' : activeMeta.label}</span>
        </div>
        {activeView !== 'home' && (
          <header className="storefrontViewHeader">
            <div>
              <h1>{activeMeta.label}</h1>
              <p>{activeMeta.description}</p>
            </div>
            <span className="storefrontBranchContext">{branches.find((branch) => branch.code === branchCode)?.name ?? branchCode}</span>
          </header>
        )}
        <div className="storefrontViewBody">{children}</div>
      </main>

      <nav className="mobileNav" aria-label="Navigasi storefront mobile">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeView || (item.id === 'catalog' && activeView === 'product');
          return <button key={item.id} className={active ? 'active' : ''} type="button" aria-current={active ? 'page' : undefined} onClick={() => onNavigate(item.id)}><span className="mobileIconWrap"><Icon size={19}/>{item.id === 'cart' && cartCount > 0 ? <span className="mobileCount">{cartCount}</span> : null}</span><small>{item.label === 'Akun & Pesanan' ? 'Akun' : item.label}</small></button>;
        })}
      </nav>
    </div>
  );
}
