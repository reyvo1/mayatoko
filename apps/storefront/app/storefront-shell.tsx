'use client';

import { Home, Search, ShoppingBag, UserRound, LogIn } from 'lucide-react';
import type { ReactNode } from 'react';

export type StorefrontView = 'home' | 'catalog' | 'product' | 'cart' | 'account';

const NAV_ITEMS: Array<{ id: StorefrontView; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Beranda', icon: Home },
  { id: 'catalog', label: 'Katalog', icon: Search },
  { id: 'cart', label: 'Keranjang', icon: ShoppingBag },
  { id: 'account', label: 'Akun & Pesanan', icon: UserRound },
];

export function StorefrontShell({
  companyName,
  activeView,
  cartCount,
  signedIn,
  onNavigate,
  children,
}: {
  companyName: string;
  activeView: StorefrontView;
  cartCount: number;
  signedIn: boolean;
  onNavigate: (view: StorefrontView) => void;
  children: ReactNode;
}) {
  return (
    <div className="storefrontApp">
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

          <button className="accountShortcut" type="button" onClick={() => onNavigate('account')}>
            {signedIn ? <UserRound size={17}/> : <LogIn size={17}/>}
            <span>{signedIn ? 'Akun saya' : 'Masuk'}</span>
          </button>
        </div>
      </header>

      <main id="storefront-main" className="storefrontMain" tabIndex={-1}>
        <div className="viewContext">
          <span className="viewKicker">TOKO360 STOREFRONT</span>
          <span>{activeView === 'product' ? 'Katalog / Detail produk' : NAV_ITEMS.find((item) => item.id === activeView)?.label ?? 'Beranda'}</span>
        </div>
        {children}
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
