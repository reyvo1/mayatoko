'use client';

import { Search, Minus, Plus, PackageSearch, ShoppingBag, ArrowRight, Heart } from 'lucide-react';
import { StorefrontShell, type StorefrontView } from './storefront-shell';
export type { StorefrontView } from './storefront-shell';
import { FormEvent, useEffect, useMemo, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const BRANCH_CODE = process.env.NEXT_PUBLIC_BRANCH_CODE ?? 'PUSAT';

type Product = {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  salePrice: string | number;
  effectiveSalePrice?: string | number;
  inventories: Array<{ available: number; warehouse: { name: string } }>;
};
type CursorPage<T> = { items: T[]; pageInfo: { limit: number; nextCursor: string | null; hasMore: boolean } };
type RuntimeManifest = { company?: { name?: string }; features: Record<string, { enabled: boolean }> };
type CartItem = { product: Product; quantity: number };
type OrderResult = { number: string; total: string | number; status: string; accessToken: string; fulfillmentType?: string; shippingCost?: string | number; shippingMethodName?: string | null };
type CustomerAccount = { id: string; name: string; email?: string | null; phone?: string | null; emailVerifiedAt?: string | null; phoneVerifiedAt?: string | null; address?: string | null; points: number; lifetimePoints?: number; loyaltyTier?: string; customerType: string };
type AccountOrder = { id: string; number: string; total: string | number; shippingCost?: string | number; fulfillmentType?: string; shippingMethodName?: string | null; address?: string; status: string; createdAt: string; items: Array<{ id: string; productId: string; quantity: number; product: { id: string; sku: string; name: string } }>; payments: Array<{ method: string; status: string }>; shipments: Array<{ status: string; carrier?: string | null; trackingNumber?: string | null; deliveredAt?: string | null }> };
type AccountOrderReturn = { id: string; number: string; status: string; refundAmount: string | number; reason?: string | null; createdAt: string; order: { id: string; number: string }; items: Array<{ id: string; orderItemId: string; quantity: number; condition: string; restock: boolean; product: { sku: string; name: string } }> };
type CustomerAddress = { id: string; label: string; recipientName: string; phone: string; addressLine: string; district?: string | null; city?: string | null; province?: string | null; postalCode?: string | null; notes?: string | null; isDefault: boolean };
type FulfillmentMethod = { code: string; name: string; fulfillmentType: 'DELIVERY' | 'PICKUP'; price: number };
type Tone = 'info' | 'success' | 'error';

function productPrice(product: Product) { return Number(product.effectiveSalePrice ?? product.salePrice); }
function rupiah(value: string | number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value));
}
function stockOf(product: Product) { return product.inventories.reduce((sum, item) => sum + Number(item.available || 0), 0); }

export function StorefrontApp({ initialView = 'home' }: { initialView?: StorefrontView }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [manifest, setManifest] = useState<RuntimeManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<Tone>('info');
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('QRIS');
  const [promoCode, setPromoCode] = useState('');
  const [customer, setCustomer] = useState({ customerName: '', customerEmail: '', customerPhone: '', address: '' });
  const [search, setSearch] = useState('');
  const [activeView, setActiveView] = useState<StorefrontView>(initialView);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [sortMode, setSortMode] = useState<'relevance' | 'name' | 'price-asc' | 'price-desc' | 'stock'>('relevance');
  const [submitting, setSubmitting] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [accountToken, setAccountToken] = useState('');
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [accountOrders, setAccountOrders] = useState<AccountOrder[]>([]);
  const [accountReturns, setAccountReturns] = useState<AccountOrderReturn[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [reviewForm, setReviewForm] = useState({ orderId: '', productId: '', productName: '', rating: 5, title: '', body: '' });
  const [returnForm, setReturnForm] = useState({ orderId: '', orderItemId: '', orderNumber: '', productName: '', maxQuantity: 1, quantity: 1, reason: '' });
  const [accountMode, setAccountMode] = useState<'login' | 'register'>('login');
  const [accountBusy, setAccountBusy] = useState(false);
  const [authForm, setAuthForm] = useState({ name: '', email: '', phone: '', address: '', password: '' });
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationForm, setVerificationForm] = useState<{ type: 'EMAIL' | 'PHONE' | ''; code: string }>({ type: '', code: '' });
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [fulfillmentMethods, setFulfillmentMethods] = useState<FulfillmentMethod[]>([]);
  const [fulfillmentType, setFulfillmentType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [shippingMethodCode, setShippingMethodCode] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [addressForm, setAddressForm] = useState({ label: 'Rumah', recipientName: '', phone: '', addressLine: '', district: '', city: '', province: '', postalCode: '' });

  function notify(text: string, tone: Tone = 'info') { setMessage(text); setMessageTone(tone); }

  useEffect(() => {
    const onPopState = () => {
      const candidate = window.location.pathname.replace(/^\//, '') || 'home';
      if (['home', 'catalog', 'product', 'cart', 'account'].includes(candidate)) setActiveView(candidate as StorefrontView);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  function customerHeaders(token: string) { return { 'x-branch-code': BRANCH_CODE, 'x-customer-session': token }; }

  async function loadAccount(token: string) {
    const headers = customerHeaders(token);
    const [meResponse, ordersResponse, favoritesResponse, returnsResponse, addressesResponse] = await Promise.all([fetch(`${API}/storefront/account/me`, { headers }), fetch(`${API}/storefront/account/orders`, { headers }), fetch(`${API}/storefront/account/favorites`, { headers }), fetch(`${API}/storefront/account/returns`, { headers }), fetch(`${API}/storefront/account/addresses`, { headers })]);
    const me = await meResponse.json(); const orders = await ordersResponse.json(); const favorites = await favoritesResponse.json(); const returns = await returnsResponse.json(); const addressRows = await addressesResponse.json();
    if (!meResponse.ok) throw new Error(Array.isArray(me.message) ? me.message.join(', ') : me.message ?? 'Sesi pelanggan tidak valid.');
    if (!ordersResponse.ok) throw new Error(Array.isArray(orders.message) ? orders.message.join(', ') : orders.message ?? 'Riwayat pesanan gagal dimuat.');
    if (!favoritesResponse.ok) throw new Error(Array.isArray(favorites.message) ? favorites.message.join(', ') : favorites.message ?? 'Favorit gagal dimuat.');
    if (!returnsResponse.ok) throw new Error(Array.isArray(returns.message) ? returns.message.join(', ') : returns.message ?? 'Riwayat retur gagal dimuat.');
    if (!addressesResponse.ok) throw new Error(Array.isArray(addressRows.message) ? addressRows.message.join(', ') : addressRows.message ?? 'Alamat pelanggan gagal dimuat.');
    setAddresses(addressRows); setSelectedAddressId((current) => current || addressRows.find((row: CustomerAddress) => row.isDefault)?.id || addressRows[0]?.id || '');
    setAccount(me); setAccountOrders(orders); setAccountReturns(returns); setFavoriteIds(favorites.map((item: { productId: string }) => item.productId));
    setCustomer((current) => ({ customerName: me.name ?? current.customerName, customerEmail: me.email ?? '', customerPhone: me.phone ?? '', address: me.address ?? current.address }));
  }

  async function authenticateCustomer() {
    if (accountBusy) return;
    setAccountBusy(true); notify(accountMode === 'login' ? 'Masuk ke akun pelanggan…' : 'Membuat akun pelanggan…');
    try {
      const endpoint = accountMode === 'login' ? 'login' : 'register';
      const body = accountMode === 'login'
        ? { branchCode: BRANCH_CODE, email: authForm.email, password: authForm.password }
        : { branchCode: BRANCH_CODE, name: authForm.name, email: authForm.email, phone: authForm.phone || undefined, address: authForm.address || undefined, password: authForm.password };
      const response = await fetch(`${API}/storefront/account/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Autentikasi pelanggan gagal.');
      localStorage.setItem('toko360.customer.session', data.sessionToken);
      setAccountToken(data.sessionToken); setAuthForm({ name: '', email: '', phone: '', address: '', password: '' });
      await loadAccount(data.sessionToken); notify(accountMode === 'login' ? 'Berhasil masuk ke akun pelanggan.' : 'Akun pelanggan berhasil dibuat.', 'success');
    } catch (error) { notify(error instanceof Error ? error.message : 'Autentikasi pelanggan gagal.', 'error'); } finally { setAccountBusy(false); }
  }

  async function logoutCustomer() {
    const token = accountToken;
    localStorage.removeItem('toko360.customer.session'); setAccountToken(''); setAccount(null); setAccountOrders([]); setAccountReturns([]); setFavoriteIds([]); setAddresses([]); setSelectedAddressId(''); setVerificationForm({ type: '', code: '' });
    if (token) await fetch(`${API}/storefront/account/logout`, { method: 'POST', headers: customerHeaders(token) }).catch(() => undefined);
    notify('Sesi pelanggan ditutup.', 'success');
  }

  async function requestCustomerVerification(type: 'EMAIL' | 'PHONE') {
    if (!accountToken || verificationBusy) return;
    setVerificationBusy(true);
    try {
      const response = await fetch(`${API}/storefront/account/verification/request`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...customerHeaders(accountToken) }, body: JSON.stringify({ type }) });
      const data = await response.json();
      if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Kode verifikasi gagal dikirim.');
      if (data.verified) { await loadAccount(accountToken); notify(`${type === 'EMAIL' ? 'Email' : 'Nomor telepon'} sudah terverifikasi.`, 'success'); return; }
      setVerificationForm({ type, code: typeof data.debugCode === 'string' ? data.debugCode : '' });
      notify(`Kode verifikasi dikirim ke ${data.recipient ?? 'kontak akun'}.${data.debugCode ? ` Kode lokal: ${data.debugCode}` : ''}`, 'success');
    } catch (error) { notify(error instanceof Error ? error.message : 'Kode verifikasi gagal dikirim.', 'error'); } finally { setVerificationBusy(false); }
  }

  async function confirmCustomerVerification(event: FormEvent) {
    event.preventDefault();
    if (!accountToken || !verificationForm.type || verificationBusy) return;
    const code = verificationForm.code.trim();
    if (!/^\d{8}$/.test(code)) { notify('Kode verifikasi harus tepat 8 digit.', 'error'); return; }
    setVerificationBusy(true);
    try {
      const response = await fetch(`${API}/storefront/account/verification/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...customerHeaders(accountToken) }, body: JSON.stringify({ type: verificationForm.type, code }) });
      const data = await response.json();
      if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Verifikasi kontak gagal.');
      setVerificationForm({ type: '', code: '' });
      await loadAccount(accountToken);
      notify(`${data.type === 'EMAIL' ? 'Email' : 'Nomor telepon'} berhasil diverifikasi.`, 'success');
    } catch (error) { notify(error instanceof Error ? error.message : 'Verifikasi kontak gagal.', 'error'); } finally { setVerificationBusy(false); }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`${API}/products?branchCode=${encodeURIComponent(BRANCH_CODE)}&limit=100`).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Katalog gagal dimuat.');
        return data as CursorPage<Product>;
      }),
      fetch(`${API}/platform/manifest?branchCode=${encodeURIComponent(BRANCH_CODE)}`).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Konfigurasi toko gagal dimuat.');
        return data as RuntimeManifest;
      }),
      fetch(`${API}/storefront/account/fulfillment-options`, { headers: { 'x-branch-code': BRANCH_CODE } }).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Metode fulfillment gagal dimuat.');
        return data as { methods: FulfillmentMethod[] };
      }),
    ])
      .then(([data, runtime, fulfillment]) => { if (!cancelled) { setProducts(data.items ?? []); setManifest(runtime); setFulfillmentMethods(fulfillment.methods ?? []); const firstDelivery = fulfillment.methods?.find((item) => item.fulfillmentType === 'DELIVERY'); setShippingMethodCode(firstDelivery?.code ?? fulfillment.methods?.[0]?.code ?? ''); setMessage(''); } })
      .catch((error) => { if (!cancelled) notify(error instanceof Error ? error.message : 'API belum dapat dihubungi.', 'error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('toko360.customer.session');
    if (!token) return;
    setAccountToken(token);
    void loadAccount(token).catch(() => { localStorage.removeItem('toko360.customer.session'); setAccountToken(''); setAccount(null); setAccountOrders([]); setAccountReturns([]); setFavoriteIds([]); setVerificationForm({ type: '', code: '' }); });
  }, []);

  const total = useMemo(() => cart.reduce((sum, item) => sum + productPrice(item.product) * item.quantity, 0), [cart]);
  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? products.filter((product) => product.name.toLowerCase().includes(q) || product.sku.toLowerCase().includes(q) || product.description?.toLowerCase().includes(q))
      : [...products];
    if (sortMode === 'name') return filtered.sort((a, b) => a.name.localeCompare(b.name, 'id'));
    if (sortMode === 'price-asc') return filtered.sort((a, b) => productPrice(a) - productPrice(b));
    if (sortMode === 'price-desc') return filtered.sort((a, b) => productPrice(b) - productPrice(a));
    if (sortMode === 'stock') return filtered.sort((a, b) => stockOf(b) - stockOf(a));
    return filtered;
  }, [products, search, sortMode]);
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  function navigate(view: StorefrontView) {
    setActiveView(view);
    if (typeof window !== 'undefined') window.history.pushState({}, '', view === 'home' ? '/' : `/${view}`);
  }

  function openProduct(product: Product) {
    setSelectedProductId(product.id);
    navigate('product');
  }

  async function toggleFavorite(productId: string) {
    if (!accountToken) { notify('Masuk ke akun pelanggan untuk menyimpan favorit.', 'error'); return; }
    const active = favoriteIds.includes(productId);
    const response = await fetch(`${API}/storefront/account/favorites/${productId}`, { method: active ? 'DELETE' : 'POST', headers: customerHeaders(accountToken) });
    const data = await response.json();
    if (!response.ok) { notify(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Favorit gagal diperbarui.', 'error'); return; }
    setFavoriteIds((current) => active ? current.filter((id) => id !== productId) : [...new Set([...current, productId])]);
    notify(active ? 'Produk dihapus dari favorit.' : 'Produk disimpan ke favorit.', 'success');
  }

  async function submitReview(event: FormEvent) {
    event.preventDefault();
    if (!accountToken || !reviewForm.orderId || !reviewForm.productId) return;
    const response = await fetch(`${API}/storefront/account/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...customerHeaders(accountToken) }, body: JSON.stringify({ orderId: reviewForm.orderId, productId: reviewForm.productId, rating: Number(reviewForm.rating), title: reviewForm.title || undefined, body: reviewForm.body || undefined }) });
    const data = await response.json();
    if (!response.ok) { notify(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Review gagal disimpan.', 'error'); return; }
    notify('Review verified-purchase berhasil disimpan.', 'success');
    setReviewForm({ orderId: '', productId: '', productName: '', rating: 5, title: '', body: '' });
  }

  async function saveAddress(event: FormEvent) {
    event.preventDefault();
    if (!accountToken) return;
    const response = await fetch(`${API}/storefront/account/addresses`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...customerHeaders(accountToken) }, body: JSON.stringify({ ...addressForm, isDefault: addresses.length === 0 }) });
    const data = await response.json();
    if (!response.ok) { notify(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Alamat gagal disimpan.', 'error'); return; }
    setAddressForm({ label: 'Rumah', recipientName: '', phone: '', addressLine: '', district: '', city: '', province: '', postalCode: '' });
    await loadAccount(accountToken); setSelectedAddressId(data.id); notify('Alamat pengiriman disimpan.', 'success');
  }

  async function removeAddress(id: string) {
    if (!accountToken) return;
    const response = await fetch(`${API}/storefront/account/addresses/${id}`, { method: 'DELETE', headers: customerHeaders(accountToken) });
    const data = await response.json();
    if (!response.ok) { notify(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Alamat gagal dihapus.', 'error'); return; }
    await loadAccount(accountToken); notify('Alamat dinonaktifkan.', 'success');
  }

  function add(product: Product) {
    const stock = stockOf(product);
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing && existing.quantity >= stock) return current;
      if (existing) return current.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return stock > 0 ? [...current, { product, quantity: 1 }] : current;
    });
  }

  function update(productId: string, quantity: number) {
    setCart((current) => current.flatMap((item) => {
      if (item.product.id !== productId) return [item];
      if (quantity <= 0) return [];
      return [{ ...item, quantity: Math.min(quantity, stockOf(item.product)) }];
    }));
  }

  async function checkout(event: FormEvent) {
    event.preventDefault();
    if (!cart.length || submitting) return;
    setSubmitting(true); notify('Membuat pesanan…');
    try {
      const response = await fetch(`${API}/orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(accountToken ? { 'x-customer-session': accountToken } : {}) },
        body: JSON.stringify({ branchCode: BRANCH_CODE, ...customer, customerEmail: customer.customerEmail || undefined, customerPhone: customer.customerPhone || undefined, address: fulfillmentType === 'DELIVERY' ? customer.address : undefined, fulfillmentType, customerAddressId: fulfillmentType === 'DELIVERY' && selectedAddressId ? selectedAddressId : undefined, shippingMethodCode: shippingMethodCode || undefined, promoCode: promoCode.trim() || undefined, items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Pesanan gagal dibuat.');
      setOrder(data); setCart([]); setPromoCode(''); if (accountToken) await loadAccount(accountToken); notify('Pesanan berhasil dibuat dan stok sudah direservasi. Harga/promo telah divalidasi server.', 'success');
    } catch (error) { notify(error instanceof Error ? error.message : 'Pesanan gagal dibuat.', 'error'); }
    finally { setSubmitting(false); }
  }

  async function submitOrderReturn(event: FormEvent) {
    event.preventDefault();
    if (!accountToken || !returnForm.orderId || !returnForm.orderItemId) return;
    const quantity = Number(returnForm.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > returnForm.maxQuantity) { notify(`Jumlah retur harus 1 sampai ${returnForm.maxQuantity}.`, 'error'); return; }
    const response = await fetch(`${API}/storefront/account/returns`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...customerHeaders(accountToken) },
      body: JSON.stringify({ orderId: returnForm.orderId, reason: returnForm.reason || undefined, refundMethod: 'ORIGINAL', items: [{ orderItemId: returnForm.orderItemId, quantity }] }),
    });
    const data = await response.json();
    if (!response.ok) { notify(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Pengajuan retur gagal.', 'error'); return; }
    setReturnForm({ orderId: '', orderItemId: '', orderNumber: '', productName: '', maxQuantity: 1, quantity: 1, reason: '' });
    await loadAccount(accountToken);
    notify(`Retur ${data.number} diajukan. Toko akan melakukan inspeksi barang sebelum refund.`, 'success');
  }

  async function selectPayment() {
    if (!order || paymentBusy) return;
    setPaymentBusy(true); notify('Menyimpan pilihan pembayaran…');
    try {
      const response = await fetch(`${API}/orders/${order.number}/payment-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-branch-code': BRANCH_CODE, 'x-order-access-token': order.accessToken },
        body: JSON.stringify({ paymentMethod }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Metode pembayaran gagal diproses.');
      setOrder(data);
      if (paymentMethod === 'COD') notify('COD dipilih. Piutang COD baru terbentuk ketika barang benar-benar dikirim.', 'success');
      else if (paymentMethod === 'INVOICE') notify('Pembayaran termin dicatat dan menunggu otorisasi backoffice.', 'success');
      else notify(`${paymentMethod} dipilih. Pesanan tetap menunggu konfirmasi provider/backoffice sebelum dianggap lunas.`, 'success');
    } catch (error) { notify(error instanceof Error ? error.message : 'Metode pembayaran gagal diproses.', 'error'); }
    finally { setPaymentBusy(false); }
  }

  return (
    <StorefrontShell
      companyName={manifest?.company?.name ?? 'Toko360'}
      activeView={activeView}
      cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
      signedIn={Boolean(account)}
      onNavigate={navigate}
    >
      {message && <div className={`notice ${messageTone}`}>{message}</div>}

      {activeView === 'home' && <>
      <section className="homeDeck">
        <div className="homeIntro">
          <span className="eyebrow">TOKO360 OFFICIAL STORE</span>
          <h2>Belanja langsung dari toko</h2>
          <p className="homeSubtitle">Satu storefront untuk katalog, checkout, fulfillment, dan layanan purna jual.</p>
          <p>Harga, promo, stok, reservasi, pembayaran, pengiriman, retur, dan loyalitas tetap divalidasi oleh backend Toko360.</p>
          <div className="homeActions">
            <button className="primary compact" type="button" onClick={() => navigate('catalog')}>Jelajahi katalog <ArrowRight size={16} /></button>
            <button className="secondary compact" type="button" onClick={() => navigate(account ? 'account' : 'cart')}>{account ? 'Buka akun saya' : 'Lihat keranjang'}</button>
          </div>
        </div>
        <div className="metricDeck">
          <article><strong>{loading ? '—' : products.length}</strong><span>produk tersedia</span></article>
          <article><strong>{cart.reduce((sum, item) => sum + item.quantity, 0)}</strong><span>item di keranjang</span></article>
          <article><strong>{account ? account.points : '—'}</strong><span>poin loyalitas</span></article>
        </div>
      </section>

      <section>
        <div className="sectionTitle"><div><span className="eyebrow">PILIHAN TOKO</span><h2>Produk untuk mulai belanja</h2></div><button type="button" className="textAction" onClick={() => navigate('catalog')}>Lihat semua <ArrowRight size={15} /></button></div>
        <div className="productGrid compactGrid">
          {products.slice(0, 3).map((product) => { const stock = stockOf(product); return <article className="productCard" key={product.id}><div className="productImage" aria-hidden="true">{product.name.slice(0,1).toUpperCase()}</div><div className="body"><small>{product.sku}</small><h3>{product.name}</h3><div className="priceRow"><strong>{rupiah(productPrice(product))}</strong><span>Stok {stock}</span></div><button type="button" onClick={() => openProduct(product)}>Lihat produk</button></div></article>; })}
          {!loading && !products.length && <div className="emptyState"><h4>Katalog belum tersedia</h4><p>Produk akan tampil setelah cabang mengaktifkan katalog.</p></div>}
        </div>
      </section>
      </>}

      {activeView === 'catalog' && <>
      <section>
        <div className="sectionTitle"><div><span className="eyebrow">KATALOG</span><h2>Produk tersedia</h2></div><span>{loading ? 'Memuat…' : `${visibleProducts.length} produk`}</span></div>
        <div className="catalogControls">
          <div className="catalogToolbar"><Search size={17}/><input aria-label="Cari produk" placeholder="Cari nama atau SKU…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <label className="sortControl">Urutkan<select value={sortMode} onChange={(e) => setSortMode(e.target.value as typeof sortMode)}><option value="relevance">Relevansi</option><option value="name">Nama A-Z</option><option value="price-asc">Harga termurah</option><option value="price-desc">Harga tertinggi</option><option value="stock">Stok terbanyak</option></select></label>
        </div>
        <div className="productGrid">
          {loading && Array.from({ length: 6 }).map((_, i) => <article className="productCard" key={`sk${i}`} aria-busy="true"><div className="skeletonBlock tall" /><div className="body"><div className="skeletonBlock" style={{width:'35%'}} /><div className="skeletonBlock" style={{width:'70%',height:16}} /><div className="skeletonBlock" style={{width:'90%'}} /><div className="skeletonBlock" style={{width:'50%'}} /></div></article>)}
          {!loading && !visibleProducts.length && <div className="emptyState"><div className="emptyIcon"><PackageSearch size={28} strokeWidth={1.6} /></div><h4>{products.length ? 'Produk tidak ditemukan' : 'Katalog belum tersedia'}</h4><p>{products.length ? 'Coba kata kunci lain.' : 'Produk akan tampil setelah toko mengaktifkan katalog untuk cabang ini.'}</p></div>}
          {visibleProducts.map((product) => {
            const stock = stockOf(product);
            return <article className="productCard" key={product.id}>
              <div className="productImage" aria-hidden="true">{product.name.slice(0, 1).toUpperCase()}</div>
              <div className="body"><small>{product.sku}</small><h3>{product.name}</h3><p>{product.description?.trim() || 'Detail produk belum tersedia.'}</p><div className="priceRow"><strong>{rupiah(productPrice(product))}</strong><span>Stok {stock}</span></div><div className="cardActions"><button type="button" className="secondary" onClick={() => openProduct(product)}>Lihat detail</button><button disabled={stock <= 0} onClick={() => add(product)}>{stock > 0 ? 'Tambah' : 'Stok habis'}</button></div><button type="button" className="favoriteAction secondary" onClick={() => void toggleFavorite(product.id)}><Heart size={15} fill={favoriteIds.includes(product.id) ? 'currentColor' : 'none'} />{favoriteIds.includes(product.id) ? 'Favorit' : 'Simpan favorit'}</button></div>
            </article>;
          })}
        </div>
      </section>
      </>}

      {activeView === 'product' && <>
      <section>
        <div className="sectionTitle"><div><span className="eyebrow">DETAIL PRODUK</span><h2>{selectedProduct?.name ?? 'Pilih produk dari katalog'}</h2></div><button type="button" className="secondary compact" onClick={() => navigate('catalog')}>Kembali ke katalog</button></div>
        {selectedProduct ? <div className="productDetail">
          <div className="productDetailVisual" aria-hidden="true">{selectedProduct.name.slice(0,1).toUpperCase()}</div>
          <div className="productDetailBody">
            <span className="productSku">{selectedProduct.sku}</span>
            <h3>{selectedProduct.name}</h3>
            <p>{selectedProduct.description?.trim() || 'Detail produk belum tersedia.'}</p>
            <div className="detailPrice">{rupiah(productPrice(selectedProduct))}</div>
            <div className="inventoryList">{selectedProduct.inventories.map((item, index) => <span key={`${item.warehouse.name}-${index}`}>{item.warehouse.name}: <strong>{item.available}</strong></span>)}</div>
            <div className="homeActions">
              <button className="primary compact" type="button" disabled={stockOf(selectedProduct) <= 0} onClick={() => add(selectedProduct)}>{stockOf(selectedProduct) > 0 ? 'Tambah ke keranjang' : 'Stok habis'}</button>
              <button className="secondary compact" type="button" onClick={() => void toggleFavorite(selectedProduct.id)}><Heart size={16} fill={favoriteIds.includes(selectedProduct.id) ? 'currentColor' : 'none'} />{favoriteIds.includes(selectedProduct.id) ? 'Tersimpan' : 'Simpan favorit'}</button>
            </div>
          </div>
        </div> : <div className="emptyState"><div className="emptyIcon"><PackageSearch size={28} /></div><h4>Belum ada produk dipilih</h4><p>Buka katalog lalu pilih “Lihat detail”.</p><button type="button" className="primary compact" onClick={() => navigate('catalog')}>Buka katalog</button></div>}
      </section>
      </>}

      {activeView === 'cart' && <>
      <section className="checkoutGrid">
        <div className="panel">
          <div className="sectionTitle"><div><span className="eyebrow">KERANJANG</span><h2>Ringkasan belanja</h2></div></div>
          {!cart.length && <div className="emptyState"><div className="emptyIcon"><ShoppingBag size={24} strokeWidth={1.6} /></div><h4>Keranjang masih kosong</h4><p>Tambahkan produk dari katalog untuk mulai belanja.</p></div>}
          {cart.map((item) => <div className="cartRow" key={item.product.id}><div><strong>{item.product.name}</strong><small>{rupiah(productPrice(item.product))}</small></div><div className="qty"><button aria-label={`Kurangi ${item.product.name}`} onClick={() => update(item.product.id, item.quantity - 1)}><Minus size={14}/></button><span>{item.quantity}</span><button aria-label={`Tambah ${item.product.name}`} disabled={item.quantity >= stockOf(item.product)} onClick={() => update(item.product.id, item.quantity + 1)}><Plus size={14}/></button></div></div>)}
          <div className="total"><span>Total sementara</span><strong>{rupiah(total)}</strong></div>
        </div>

        <form className="panel" onSubmit={checkout}>
          <div className="sectionTitle"><div><span className="eyebrow">CHECKOUT</span><h2>Data pelanggan</h2></div></div>
          <label>Nama<input required readOnly={Boolean(account)} autoComplete="name" value={customer.customerName} onChange={(event) => setCustomer({ ...customer, customerName: event.target.value })} /></label>
          <label>Email<input type="email" readOnly={Boolean(account)} autoComplete="email" value={customer.customerEmail} onChange={(event) => setCustomer({ ...customer, customerEmail: event.target.value })} /></label>
          <label>Nomor telepon<input autoComplete="tel" value={customer.customerPhone} onChange={(event) => setCustomer({ ...customer, customerPhone: event.target.value })} /></label>
          <label>Fulfillment<select value={fulfillmentType} onChange={(event) => { const type = event.target.value as 'DELIVERY' | 'PICKUP'; setFulfillmentType(type); const method = fulfillmentMethods.find((item) => item.fulfillmentType === type); setShippingMethodCode(method?.code ?? ''); }}><option value="DELIVERY">Dikirim</option><option value="PICKUP">Ambil di toko</option></select></label>
          <label>Metode<select required value={shippingMethodCode} onChange={(event) => setShippingMethodCode(event.target.value)}>{fulfillmentMethods.filter((item) => item.fulfillmentType === fulfillmentType).map((item) => <option key={item.code} value={item.code}>{item.name} · {item.price ? rupiah(item.price) : 'Gratis'}</option>)}</select></label>
          {fulfillmentType === 'DELIVERY' && account && addresses.length > 0 && <label>Alamat tersimpan<select value={selectedAddressId} onChange={(event) => setSelectedAddressId(event.target.value)}><option value="">Gunakan alamat manual</option>{addresses.map((row) => <option key={row.id} value={row.id}>{row.label} · {row.addressLine}{row.city ? `, ${row.city}` : ''}</option>)}</select></label>}
          {fulfillmentType === 'DELIVERY' && !selectedAddressId && <label>Alamat<textarea required autoComplete="street-address" value={customer.address} onChange={(event) => setCustomer({ ...customer, address: event.target.value })} /></label>}
          {fulfillmentType === 'PICKUP' && <small>Alamat pickup ditentukan server dari cabang/gudang yang memproses pesanan.</small>}
          <label>Voucher / kode promo<input maxLength={40} value={promoCode} onChange={(event) => setPromoCode(event.target.value.toUpperCase())} placeholder="Opsional" /></label>
          <small>Promo divalidasi server terhadap channel, produk, tier, quota, dan isi keranjang saat order dibuat.</small>
          <button className="primary" disabled={!cart.length || submitting}>{submitting ? 'Membuat pesanan…' : 'Buat pesanan'}</button>
        </form>
      </section>
      {order && <section className="orderPanel"><span className="eyebrow">PESANAN</span><h2>{order.number}</h2><p>Status: <strong>{order.status}</strong> · {order.fulfillmentType ?? fulfillmentType} / {order.shippingMethodName ?? shippingMethodCode} · Ongkir {rupiah(order.shippingCost ?? 0)} · Total server {rupiah(order.total)}</p>
        {order.status === 'PENDING_PAYMENT' && <div className="paymentChooser"><label>Metode pembayaran<select value={paymentMethod} disabled={paymentBusy} onChange={(event) => setPaymentMethod(event.target.value)}><option value="QRIS">QRIS</option><option value="TRANSFER">Transfer</option><option value="CARD">Kartu</option><option value="COD">COD</option><option value="INVOICE">Invoice / termin</option></select></label><button disabled={paymentBusy} onClick={() => void selectPayment()}>{paymentBusy ? 'Memproses…' : 'Pilih metode'}</button></div>}
        <small>Pembayaran elektronik tidak dianggap lunas sampai provider/backoffice mengonfirmasi. Stok fisik baru keluar ketika shipment dikirim.</small>
      </section>}
      </>}

      {activeView === 'account' && <>
      <section className="checkoutGrid">
        <div className="panel">
          <div className="sectionTitle"><div><span className="eyebrow">AKUN PELANGGAN</span><h2>{account ? `Halo, ${account.name}` : 'Masuk / daftar'}</h2></div>{account && <button className="secondary" type="button" onClick={() => void logoutCustomer()}>Keluar</button>}</div>
          {account ? <>
            <p><strong>{account.email}</strong>{account.phone ? ` · ${account.phone}` : ''}</p><p>Poin loyalitas: <strong>{account.points}</strong> · Tier: <strong>{account.loyaltyTier ?? 'MEMBER'}</strong></p>
            <div className="paymentChooser">
              <button type="button" className={account.emailVerifiedAt ? 'primary' : 'secondary'} disabled={verificationBusy || Boolean(account.emailVerifiedAt)} onClick={() => void requestCustomerVerification('EMAIL')}>{account.emailVerifiedAt ? '✓ Email terverifikasi' : 'Verifikasi email'}</button>
              {account.phone && <button type="button" className={account.phoneVerifiedAt ? 'primary' : 'secondary'} disabled={verificationBusy || Boolean(account.phoneVerifiedAt)} onClick={() => void requestCustomerVerification('PHONE')}>{account.phoneVerifiedAt ? '✓ Telepon terverifikasi' : 'Verifikasi telepon'}</button>}
            </div>
            {verificationForm.type && <form onSubmit={confirmCustomerVerification}>
              <label>Kode verifikasi {verificationForm.type === 'EMAIL' ? 'email' : 'telepon'}<input inputMode="numeric" pattern="[0-9]{8}" minLength={8} maxLength={8} value={verificationForm.code} onChange={(e) => setVerificationForm({ ...verificationForm, code: e.target.value.replace(/\D/g, '').slice(0, 8) })} /></label>
              <button type="submit" className="primary" disabled={verificationBusy || verificationForm.code.length !== 8}>{verificationBusy ? 'Memverifikasi…' : 'Konfirmasi kode'}</button>
              <button type="button" className="secondary" disabled={verificationBusy} onClick={() => setVerificationForm({ type: '', code: '' })}>Batal</button>
            </form>}
            <h3>Alamat tersimpan</h3>
            {addresses.map((row) => <div className="cartRow" key={row.id}><div><strong>{row.label}{row.isDefault ? ' · utama' : ''}</strong><small>{row.recipientName} · {row.phone}</small><small>{[row.addressLine,row.district,row.city,row.province,row.postalCode].filter(Boolean).join(', ')}</small></div><button type="button" className="secondary" onClick={() => void removeAddress(row.id)}>Hapus</button></div>)}
            <form onSubmit={saveAddress}><label>Label<input value={addressForm.label} onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })} /></label><label>Penerima<input required value={addressForm.recipientName} onChange={(e) => setAddressForm({ ...addressForm, recipientName: e.target.value })} /></label><label>Telepon<input required value={addressForm.phone} onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })} /></label><label>Alamat<textarea required value={addressForm.addressLine} onChange={(e) => setAddressForm({ ...addressForm, addressLine: e.target.value })} /></label><div className="paymentChooser"><input placeholder="Kota" value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} /><input placeholder="Provinsi" value={addressForm.province} onChange={(e) => setAddressForm({ ...addressForm, province: e.target.value })} /></div><button type="submit" className="secondary">Simpan alamat</button></form>
            <small>Pesanan yang dibuat saat sesi akun aktif otomatis terhubung ke akun ini.</small>
          </> : <>
            <div className="paymentChooser"><button type="button" className={accountMode === 'login' ? 'primary' : 'secondary'} onClick={() => setAccountMode('login')}>Masuk</button><button type="button" className={accountMode === 'register' ? 'primary' : 'secondary'} onClick={() => setAccountMode('register')}>Daftar</button></div>
            {accountMode === 'register' && <><label>Nama<input value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} /></label><label>Telepon<input value={authForm.phone} onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })} /></label><label>Alamat<textarea value={authForm.address} onChange={(e) => setAuthForm({ ...authForm, address: e.target.value })} /></label></>}
            <label>Email<input type="email" autoComplete="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} /></label>
            <label>Password<input type="password" autoComplete={accountMode === 'login' ? 'current-password' : 'new-password'} value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} /></label>
            <button type="button" className="primary" disabled={accountBusy || !authForm.email || !authForm.password || (accountMode === 'register' && !authForm.name)} onClick={() => void authenticateCustomer()}>{accountBusy ? 'Memproses…' : accountMode === 'login' ? 'Masuk akun' : 'Buat akun'}</button>
            <small>Password baru minimal 10 karakter, huruf besar, huruf kecil, dan angka.</small>
          </>}
        </div>
        <div className="panel">
          <div className="sectionTitle"><div><span className="eyebrow">RIWAYAT & TRACKING</span><h2>Pesanan saya</h2></div><span>{account ? `${accountOrders.length} order` : 'masuk dulu'}</span></div>
          {!account && <div className="emptyState"><h4>Riwayat terlindungi akun</h4><p>Masuk untuk melihat status pembayaran, fulfillment, carrier, dan nomor resi.</p></div>}
          {account && !accountOrders.length && <div className="emptyState"><h4>Belum ada pesanan akun</h4><p>Checkout berikutnya akan otomatis tertaut ke akun ini.</p></div>}
          {accountOrders.slice(0, 8).map((item) => { const shipment = item.shipments[0]; return <div className="cartRow" key={item.id}><div><strong>{item.number}</strong><small>{new Date(item.createdAt).toLocaleString('id-ID')} · {item.fulfillmentType ?? 'DELIVERY'} / {item.shippingMethodName ?? '-'} · {item.payments[0]?.method ?? 'UNSELECTED'} / {item.payments[0]?.status ?? '-'}</small>{shipment && <small>{shipment.carrier ?? 'Shipment'} · {shipment.trackingNumber ?? shipment.status}</small>}{item.status === 'COMPLETED' && item.items.map((orderItem) => <span key={orderItem.id} style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}><button type="button" className="secondary" onClick={() => setReviewForm({ orderId: item.id, productId: orderItem.productId, productName: orderItem.product.name, rating: 5, title: '', body: '' })}>Ulas {orderItem.product.name}</button><button type="button" className="secondary" onClick={() => setReturnForm({ orderId: item.id, orderItemId: orderItem.id, orderNumber: item.number, productName: orderItem.product.name, maxQuantity: orderItem.quantity, quantity: 1, reason: '' })}>Retur {orderItem.product.name}</button></span>)}</div><div><strong>{item.status}</strong><small>{rupiah(item.total)}</small></div></div>; })}
          {reviewForm.productId && <form onSubmit={submitReview}><h3>Ulas {reviewForm.productName}</h3><label>Rating<select value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}><option value={5}>5</option><option value={4}>4</option><option value={3}>3</option><option value={2}>2</option><option value={1}>1</option></select></label><label>Judul<input maxLength={120} value={reviewForm.title} onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })} /></label><label>Review<textarea maxLength={2000} value={reviewForm.body} onChange={(e) => setReviewForm({ ...reviewForm, body: e.target.value })} /></label><button type="submit">Simpan review</button><button type="button" className="secondary" onClick={() => setReviewForm({ orderId: '', productId: '', productName: '', rating: 5, title: '', body: '' })}>Batal</button></form>}
          {returnForm.orderItemId && <form onSubmit={submitOrderReturn}><h3>Retur {returnForm.productName}</h3><small>Order {returnForm.orderNumber}. Refund final hanya diposting setelah barang diperiksa toko.</small><label>Jumlah<input type="number" min="1" max={returnForm.maxQuantity} step="1" value={returnForm.quantity} onChange={(e) => setReturnForm({ ...returnForm, quantity: Number(e.target.value) })} /></label><label>Alasan<textarea maxLength={1000} required value={returnForm.reason} onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })} /></label><button type="submit">Ajukan retur</button><button type="button" className="secondary" onClick={() => setReturnForm({ orderId: '', orderItemId: '', orderNumber: '', productName: '', maxQuantity: 1, quantity: 1, reason: '' })}>Batal</button></form>}
          {account && accountReturns.length > 0 && <div><h3>Riwayat retur</h3>{accountReturns.slice(0, 8).map((ret) => <div className="cartRow" key={ret.id}><div><strong>{ret.number}</strong><small>{ret.order.number} · {ret.items.map((line) => `${line.product.name} × ${line.quantity}`).join(', ')}</small>{ret.reason && <small>{ret.reason}</small>}</div><div><strong>{ret.status}</strong><small>{rupiah(ret.refundAmount)}</small></div></div>)}</div>}
        </div>
      </section>
      </>}
    </StorefrontShell>
  );
}

export default function StorefrontPage() {
  return <StorefrontApp />;
}
