'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  ReceiptText, TrendingUp, Landmark, Package, CircleDollarSign, CheckCircle2, XCircle,
} from 'lucide-react';
import AnalyticsWidgets from './analytics';
import OwnerView from './owner';
import AccountingView from './modules/accounting';
import HrPayrollView from './modules/hr-payroll';
import EmployeeMasterView from './modules/employee-master';
import OperationsView from './modules/operations';
import AssetsFleetView from './modules/assets-fleet';
import ExtensionsView from './modules/extensions';
import OperationsControlView from './modules/operations-control';
import MasterDataView from './modules/master-data';
import ApiKeysView from './modules/api-keys';
import SecurityView from './modules/security';
import AutomationWorkspace from './modules/automation-workspace';
import AiWorkspace from './modules/ai-workspace';
import { CountUp } from './ui';
import AdminAppShell from './app-shell';
import { authFetch, clearLoginTokens, storeLoginTokens } from './auth-fetch';
import {
  ADMIN_WORKSPACES, type AdminRuntimeManifest, identityFromAccessToken, resolveAdminNavigation, workspaceFromPath,
} from './navigation';
import { isValidAdminPath, resolvedDomainViewFromPath, resolveDomainViews } from './domain-workspaces';

type ToastItem = { id: number; text: string; tone: 'success' | 'error' };
function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  function push(text: string, tone: 'success' | 'error' = 'success') {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }
  return { toasts, push };
}
function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="toastStack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          <span className="toastIcon">{t.tone === 'success' ? <CheckCircle2 size={17} /> : <XCircle size={17} />}</span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type Product = { id: string; sku: string; name: string; unit: string; costPrice: string | number; salePrice: string | number; trackBatch?: boolean; trackExpiry?: boolean; trackSerial?: boolean; variants?: Array<{ id: string; code: string; name: string; isDefault?: boolean }>; units?: Array<{ id: string; variantId?: string | null; unitCode: string; quantityFactor: number; isDefaultPurchase?: boolean }> };
type Supplier = { id: string; code: string; name: string; phone?: string };
type Warehouse = { id: string; code: string; name: string; branch: { name: string } };
type POItem = { id: string; productId: string; variantId?: string | null; productUnitId?: string | null; unitCode?: string | null; unitQuantity?: number | null; quantityFactor: number; orderedQty: number; receivedQty: number; unitCost: string | number; purchaseUnitCost?: string | number | null; product: Product };
type PurchaseOrder = { id: string; number: string; status: string; supplier: Supplier; warehouse: Warehouse; total: string | number; items: POItem[] };
type PurchaseRequest = { id: string; number: string; status: string; reason?: string | null; neededBy?: string | null; supplier?: Supplier | null; warehouse: Warehouse; purchaseOrderId?: string | null; items: Array<{ id: string; quantity: number; estimatedUnitCost: string | number; product: Product }> };
type Receipt = { id: string; number: string; receivedAt: string; operationalStatus: string; inspectionId?: string | null; supplier: Supplier; purchaseOrder: { number: string }; items: Array<{ acceptedQty: number; quantityDamaged: number; product: Product }> };
type Inventory = { id: string; quantity: number; reserved: number; available: number; product: Product & { minStock: number }; warehouse: Warehouse };
type Role = { id: string; name: string };
type User = { id: string; name: string; email: string; isActive: boolean; roles: Array<{ role: Role }> };
type RuntimeManifest = AdminRuntimeManifest;
type CursorPage<T> = { items: T[]; pageInfo: { limit: number; nextCursor: string | null; hasMore: boolean } };
type Dashboard = { today: { revenue: number; transactions: number; grossProfitBeforeOnlineCops?: number; grossProfitBeforeOnlineCogs: number }, inventory: { items: number; lowStock: number; value: number }; pendingOrders: number } & Record<string, unknown>;
type AnalyticsData = {
  salesTrend: Array<{ date: string; revenue: number; profit: number; transactions: number }>;
  channels: Array<{ channel: string; revenue: number }>;
  cashFlow: Array<{ date: string; cashIn: number }>;
  topProducts: Array<{ name: string; sku: string; quantity: number; revenue: number }>;
  lowStock: Array<{ name: string; warehouse: string; available: number; minStock: number }>;
};

function money(value: string | number) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value)); }
function requestKey(prefix: string) { return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`; }

export default function AdminPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [token, setToken] = useState<string | null>(null);
  const [login, setLogin] = useState({ email: '', password: '', twoFactorCode: '' });
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [message, setMessage] = useState('');
  const { toasts, push } = useToasts();
  function notify(text: string, tone: 'success' | 'error' = 'success') { setMessage(text); push(text, tone); }
  const [activeNav, setActiveNav] = useState(() => workspaceFromPath(pathname).label);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [manifest, setManifest] = useState<RuntimeManifest | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [supplierForm, setSupplierForm] = useState({ code: '', name: '', phone: '' });
  const [purchaseRequestForm, setPurchaseRequestForm] = useState({ supplierId: '', warehouseId: '', productId: '', quantity: 1, estimatedUnitCost: 0, reason: '' });
  const [poForm, setPoForm] = useState({ supplierId: '', warehouseId: '', productId: '', variantId: '', productUnitId: '', orderedQty: 1, unitCost: 0 });
  const [receiptForm, setReceiptForm] = useState({ purchaseOrderId: '', purchaseOrderItemId: '', quantityReceived: 1, quantityDamaged: 0, supplierInvoice: '', deliveryNote: '', batchNumber: '', expiryDate: '', serialNumbers: '' });
  const poRequestKey = useRef(requestKey('po'));
  const receiptRequestKey = useRef(requestKey('gr'));
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', roleName: 'CASHIER' });
  const [featureChange, setFeatureChange] = useState<{ key: string; enabled: boolean } | null>(null);

  useEffect(() => { const saved = window.localStorage.getItem('toko360_token'); if (saved) setToken(saved); }, []);
  useEffect(() => { const value = new URLSearchParams(window.location.search).get('resetToken'); if (value) { setResetToken(value); setResetMode(true); } }, []);
  useEffect(() => { const refreshed = (event: Event) => setToken((event as CustomEvent<{ accessToken: string }>).detail.accessToken); const expired = () => setToken(null); window.addEventListener('toko360:auth-refreshed', refreshed); window.addEventListener('toko360:auth-expired', expired); return () => { window.removeEventListener('toko360:auth-refreshed', refreshed); window.removeEventListener('toko360:auth-expired', expired); }; }, []);
  useEffect(() => { if (token) void loadAll(token); }, [token]);
  useEffect(() => { setActiveNav(workspaceFromPath(pathname).label); }, [pathname]);
  useEffect(() => {
    if (!token) return;
    if (pathname === '/') router.replace('/dashboard');
    else {
      const workspace = workspaceFromPath(pathname);
      if (!isValidAdminPath(pathname, workspace)) router.replace(workspace.route);
    }
  }, [token, pathname, router]);

  const identity = useMemo(() => identityFromAccessToken(token), [token]);
  const navigation = useMemo(() => resolveAdminNavigation(manifest, identity), [manifest, identity]);
  const navItems = useMemo(() => navigation.flatMap((group) => group.items), [navigation]);
  const activeWorkspace = useMemo(() => ADMIN_WORKSPACES.find((item) => item.label === activeNav) ?? workspaceFromPath(pathname), [activeNav, pathname]);
  const activeDomainView = useMemo(() => resolvedDomainViewFromPath(pathname, activeWorkspace, manifest, identity), [pathname, activeWorkspace, manifest, identity]);

  function navigateTo(route: string) {
    const target = workspaceFromPath(route);
    setActiveNav(target.label);
    if (pathname !== route) router.push(route);
  }

  useEffect(() => {
    if (!token || !manifest || !navItems.length) return;
    if (!navItems.some((item) => item.label === activeNav)) navigateTo(navItems[0].route);
  }, [token, manifest, navItems, activeNav]);

  useEffect(() => {
    if (!token || !manifest) return;
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length !== 2) return;
    const visibleViews = resolveDomainViews(activeWorkspace, manifest, identity);
    if (!visibleViews.some((view) => view.key === parts[1])) router.replace(activeWorkspace.route);
  }, [token, manifest, identity, pathname, activeWorkspace, router]);

  async function request<T>(path: string, init?: RequestInit, overrideToken?: string): Promise<T> {
    const response = await authFetch(`${API}${path}`, overrideToken ?? token, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
    const data = await response.json();
    if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Terjadi kesalahan.');
    return data as T;
  }

  async function loadAll(activeToken: string) {
    try {
      const [d, p, s, w, pr, po, r, i, rl, u, m, an] = await Promise.all([
        request<Dashboard>('/reports/dashboard', undefined, activeToken), request<CursorPage<Product>>('/products?limit=100', undefined, activeToken),
        request<CursorPage<Supplier>>('/suppliers?limit=100', undefined, activeToken), request<Warehouse[]>('/inventory/warehouses', undefined, activeToken),
        request<PurchaseRequest[]>('/purchase-requests', undefined, activeToken), request<CursorPage<PurchaseOrder>>('/purchase-orders?limit=100', undefined, activeToken), request<CursorPage<Receipt>>('/goods-receipts?limit=100', undefined, activeToken),
        request<CursorPage<Inventory>>('/inventory?limit=100', undefined, activeToken), request<Role[]>('/users/roles', undefined, activeToken), request<User[]>('/users', undefined, activeToken),
        request<RuntimeManifest>('/platform/manifest', undefined, activeToken),
        request<AnalyticsData>('/reports/analytics', undefined, activeToken),
      ]);
      setDashboard(d); setAnalytics(an); setProducts(p.items); setSuppliers(s.items); setWarehouses(w); setPurchaseRequests(pr); setOrders(po.items); setReceipts(r.items); setInventories(i.items); setRoles(rl); setUsers(u); setManifest(m);
      const defaults = { supplierId: s.items[0]?.id || '', warehouseId: w[0]?.id || '', productId: p.items[0]?.id || '', cost: Number(p.items[0]?.costPrice ?? 0) };
      setPurchaseRequestForm((current) => ({ ...current, supplierId: current.supplierId || defaults.supplierId, warehouseId: current.warehouseId || defaults.warehouseId, productId: current.productId || defaults.productId, estimatedUnitCost: current.estimatedUnitCost || defaults.cost }));
      setPoForm((current) => ({ ...current, supplierId: current.supplierId || defaults.supplierId, warehouseId: current.warehouseId || defaults.warehouseId, productId: current.productId || defaults.productId, unitCost: current.unitCost || defaults.cost }));
    } catch (error) { notify(error instanceof Error ? error.message : 'Gagal memuat dashboard.', 'error'); }
  }

  async function submitLogin(event: FormEvent) {
    event.preventDefault(); setMessage('');
    try {
      const result = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...login, twoFactorCode: login.twoFactorCode || undefined }) });
      const data = await result.json();
      if (!result.ok) {
        if (data.code === 'TWO_FACTOR_REQUIRED' || data.code === 'TWO_FACTOR_INVALID') setShowTwoFactor(true);
        throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Login gagal.');
      }
      storeLoginTokens(data.accessToken, data.refreshToken); setToken(data.accessToken); setShowTwoFactor(false); setLogin((current) => ({ ...current, password: '', twoFactorCode: '' }));
    } catch (error) { notify(error instanceof Error ? error.message : 'Login gagal.', 'error'); }
  }

  async function requestPasswordReset(event: FormEvent) {
    event.preventDefault(); setMessage('');
    try {
      const result = await fetch(`${API}/auth/password-reset/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: resetEmail }) });
      const data = await result.json(); if (!result.ok) throw new Error(data.message ?? 'Permintaan reset gagal.');
      if (data.developmentResetToken) setResetToken(data.developmentResetToken);
      notify(data.message ?? 'Jika akun ditemukan, instruksi reset akan dikirim.');
    } catch (error) { notify(error instanceof Error ? error.message : 'Permintaan reset gagal.', 'error'); }
  }

  async function confirmPasswordReset(event: FormEvent) {
    event.preventDefault(); setMessage('');
    try {
      const result = await fetch(`${API}/auth/password-reset/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: resetToken, newPassword: resetPassword }) });
      const data = await result.json(); if (!result.ok) throw new Error(data.message ?? 'Reset password gagal.');
      setResetPassword(''); setResetToken(''); setResetMode(false); notify(data.message ?? 'Password berhasil diubah.');
      window.history.replaceState({}, '', window.location.pathname);
    } catch (error) { notify(error instanceof Error ? error.message : 'Reset password gagal.', 'error'); }
  }

  async function logout() {
    try { if (token) await request('/auth/logout', { method: 'POST' }, token); } catch { /* local logout must still complete */ }
    clearLoginTokens();
    setToken(null);
    setManifest(null);
    setDashboard(null);
  }

  async function toggleFeature(key: string, enabled: boolean) {
    if (!manifest?.company?.id) { notify('Perusahaan belum tersedia pada runtime manifest.', 'error'); return; }
    try {
      await request('/platform/features', { method: 'POST', body: JSON.stringify({ companyId: manifest.company.id, key, enabled }) });
      notify(`Feature ${key} ${enabled ? 'diaktifkan' : 'dinonaktifkan'}.`);
      setFeatureChange(null);
      await loadAll(token!);
    } catch (error) { notify(error instanceof Error ? error.message : 'Gagal mengubah feature flag.', 'error'); }
  }

  async function addSupplier(event: FormEvent) {
    event.preventDefault();
    try { await request('/suppliers', { method: 'POST', body: JSON.stringify({ ...supplierForm, phone: supplierForm.phone || undefined }) }); setSupplierForm({ code: '', name: '', phone: '' }); notify('Supplier berhasil ditambahkan.'); await loadAll(token!); }
    catch (error) { notify(error instanceof Error ? error.message : 'Gagal menambah supplier.', 'error'); }
  }

  async function addPurchaseRequest(event: FormEvent) {
    event.preventDefault();
    try {
      await request('/purchase-requests', { method: 'POST', body: JSON.stringify({
        supplierId: purchaseRequestForm.supplierId || undefined,
        warehouseId: purchaseRequestForm.warehouseId,
        reason: purchaseRequestForm.reason || undefined,
        items: [{ productId: purchaseRequestForm.productId, quantity: Number(purchaseRequestForm.quantity), estimatedUnitCost: Number(purchaseRequestForm.estimatedUnitCost) }],
      }) });
      setPurchaseRequestForm((current) => ({ ...current, quantity: 1, reason: '' }));
      notify('Purchase request draft berhasil dibuat. Ajukan approval sebelum dikonversi menjadi PO.');
      await loadAll(token!);
    } catch (error) { notify(error instanceof Error ? error.message : 'Gagal membuat purchase request.', 'error'); }
  }

  async function purchaseRequestAction(requestRow: PurchaseRequest, action: 'submit' | 'approve' | 'reject' | 'convert' | 'cancel') {
    try {
      if (action === 'submit') await request(`/purchase-requests/${requestRow.id}/submit`, { method: 'POST', body: '{}' });
      if (action === 'approve') await request(`/purchase-requests/${requestRow.id}/decision`, { method: 'POST', body: JSON.stringify({ status: 'APPROVED' }) });
      if (action === 'reject') await request(`/purchase-requests/${requestRow.id}/decision`, { method: 'POST', body: JSON.stringify({ status: 'REJECTED' }) });
      if (action === 'convert') await request(`/purchase-requests/${requestRow.id}/convert`, { method: 'POST', body: JSON.stringify({ supplierId: requestRow.supplier?.id }) });
      if (action === 'cancel') await request(`/purchase-requests/${requestRow.id}/cancel`, { method: 'POST', body: '{}' });
      notify(action === 'convert' ? 'Purchase request dikonversi menjadi PO tanpa duplikasi.' : `Purchase request ${action} berhasil diproses.`);
      await loadAll(token!);
    } catch (error) { notify(error instanceof Error ? error.message : 'Workflow purchase request gagal.', 'error'); }
  }

  async function addPO(event: FormEvent) {
    event.preventDefault();
    try {
      await request('/purchase-orders', { method: 'POST', body: JSON.stringify({ idempotencyKey: poRequestKey.current, supplierId: poForm.supplierId, warehouseId: poForm.warehouseId, items: [{ productId: poForm.productId, variantId: poForm.variantId || undefined, productUnitId: poForm.productUnitId || undefined, orderedQty: Number(poForm.orderedQty), unitCost: Number(poForm.unitCost) }] }) });
      poRequestKey.current = requestKey('po');
      notify('Purchase order berhasil dibuat dan berstatus APPROVED.'); await loadAll(token!);
    } catch (error) { notify(error instanceof Error ? error.message : 'Gagal membuat PO.', 'error'); }
  }

  async function addReceipt(event: FormEvent) {
    event.preventDefault();
    try {
      const created = await request<Receipt>('/goods-receipts', { method: 'POST', body: JSON.stringify({
        idempotencyKey: receiptRequestKey.current,
        purchaseOrderId: receiptForm.purchaseOrderId, supplierInvoice: receiptForm.supplierInvoice || undefined,
        deliveryNote: receiptForm.deliveryNote || undefined,
        items: [{
          purchaseOrderItemId: receiptForm.purchaseOrderItemId,
          quantityReceived: Number(receiptForm.quantityReceived),
          quantityDamaged: Number(receiptForm.quantityDamaged),
          batchNumber: receiptForm.batchNumber.trim() || undefined,
          expiryDate: receiptForm.expiryDate || undefined,
          serialNumbers: receiptForm.serialNumbers.split(/[,\n]/).map((value) => value.trim()).filter(Boolean),
        }],
      }) });
      receiptRequestKey.current = requestKey('gr');
      notify(created.operationalStatus === 'CONFIRMED' || created.operationalStatus === 'PARTIALLY_ACCEPTED'
        ? 'Penerimaan sudah diposting ke stok dan jurnal.'
        : 'Draft penerimaan dibuat. Selesaikan inspeksi lalu konfirmasi posting stok/jurnal.');
      await loadAll(token!);
    } catch (error) { notify(error instanceof Error ? error.message : 'Gagal menerima barang.', 'error'); }
  }

  async function confirmReceipt(receipt: Receipt) {
    try {
      const posted = await request<Receipt>(`/goods-receipts/${receipt.id}/confirm`, { method: 'POST', body: JSON.stringify({ inspectionId: receipt.inspectionId ?? undefined }) });
      notify(posted.operationalStatus === 'PARTIALLY_ACCEPTED' ? 'Penerimaan parsial berhasil diposting ke stok dan jurnal.' : 'Penerimaan berhasil diposting ke stok dan jurnal.');
      await loadAll(token!);
    } catch (error) { notify(error instanceof Error ? error.message : 'Penerimaan belum dapat dikonfirmasi.', 'error'); }
  }

  async function addUser(event: FormEvent) {
    event.preventDefault();
    try {
      await request('/users', { method: 'POST', body: JSON.stringify({ name: userForm.name, email: userForm.email, password: userForm.password, roleNames: [userForm.roleName] }) });
      setUserForm({ name: '', email: '', password: '', roleName: 'CASHIER' }); notify('Pengguna berhasil dibuat.'); await loadAll(token!);
    } catch (error) { notify(error instanceof Error ? error.message : 'Gagal membuat pengguna.', 'error'); }
  }

  const selectedPO = useMemo(() => orders.find((order) => order.id === receiptForm.purchaseOrderId), [orders, receiptForm.purchaseOrderId]);
  const selectedPOItem = useMemo(() => selectedPO?.items.find((item) => item.id === receiptForm.purchaseOrderItemId), [selectedPO, receiptForm.purchaseOrderItemId]);
  useEffect(() => {
    if (selectedPO && !selectedPO.items.some((item) => item.id === receiptForm.purchaseOrderItemId)) {
      setReceiptForm((current) => ({ ...current, purchaseOrderItemId: selectedPO.items[0]?.id ?? '', batchNumber: '', expiryDate: '', serialNumbers: '' }));
    }
  }, [selectedPO, receiptForm.purchaseOrderItemId]);

  if (!token) return (
    <main className="loginShell">
      <div className="loginCard">
        <div className="logo" style={{ padding: 0, marginBottom: 14 }}><span className="logoMark">T3</span><span><strong>Toko360</strong><small>Enterprise Workflow</small></span></div>
        {!resetMode ? <form onSubmit={submitLogin}>
          <h1>Masuk ke pusat operasional</h1>
          <p>Gunakan akun yang memiliki akses sesuai peran. Sesi akan dicabut di server ketika Anda keluar.</p>
          {message && <div className="notice">{message}</div>}
          <label>Email<input type="email" autoComplete="username" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} /></label>
          <label>Password<input type="password" autoComplete="current-password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} /></label>
          {showTwoFactor && <label>Kode 2FA / recovery<input autoComplete="one-time-code" value={login.twoFactorCode} onChange={(e) => setLogin({ ...login, twoFactorCode: e.target.value })} placeholder="6 digit atau recovery code" /></label>}
          <button>Masuk</button>
          <button type="button" className="secondary" onClick={() => { setResetMode(true); setResetEmail(login.email); setMessage(''); }}>Lupa password</button>
        </form> : <>
          <h1>Reset password</h1>
          <p>Permintaan tidak mengungkap apakah email terdaftar. Token hanya berlaku singkat dan hanya dapat digunakan sekali.</p>
          {message && <div className="notice">{message}</div>}
          {!resetToken ? <form onSubmit={requestPasswordReset}>
            <label>Email<input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required /></label>
            <button>Kirim instruksi reset</button>
          </form> : <form onSubmit={confirmPasswordReset}>
            <label>Reset token<input value={resetToken} onChange={(e) => setResetToken(e.target.value)} required /></label>
            <label>Password baru<input type="password" minLength={8} value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} required /></label>
            <button>Ubah password</button>
          </form>}
          <button type="button" className="secondary" onClick={() => { setResetMode(false); setResetToken(''); setMessage(''); }}>Kembali ke login</button>
        </>}
      </div>
    </main>
  );

  const pageMeta = activeWorkspace;
  const apiConnected = Boolean(manifest && dashboard);

  return (
    <AdminAppShell
      manifest={manifest}
      identity={identity}
      navigation={navigation}
      activeWorkspace={activeWorkspace}
      activeDomainView={activeDomainView}
      apiConnected={apiConnected}
      onNavigate={navigateTo}
      onReload={() => void loadAll(token)}
      onLogout={() => void logout()}
      headerAction={activeNav === 'Dashboard' ? <button type="button" className="btnGhost" onClick={() => window.print()}>Cetak ringkasan</button> : undefined}
    >
          {activeNav === 'Dashboard' && <>
            {!dashboard ? (
              <section className="stats">{Array.from({ length: 5 }).map((_, i) => <article className="statCard" key={i}><div className="skeletonRow" style={{ width: '40%' }} /><div className="skeletonBar" style={{ width: '80%', height: 20, margin: '10px 0' }} /><div className="skeletonBar" style={{ width: '55%' }} /></article>)}</section>
            ) : (
              <section className="stats">
                <article className="statCard fadeSlideIn"><span className="ico"><CircleDollarSign size={20} /></span><small>Penjualan Hari Ini</small><strong><CountUp value={dashboard.today.revenue} format={money} /></strong><span className="delta up">{dashboard.today.transactions} transaksi</span></article>
                <article className="statCard fadeSlideIn"><span className="ico"><TrendingUp size={20} /></span><small>Laba Kotor Sementara</small><strong><CountUp value={dashboard.today.grossProfitBeforeOnlineCogs} format={money} /></strong><span className="delta">Berdasarkan jurnal yang tersedia</span></article>
                <article className="statCard fadeSlideIn"><span className="ico"><Package size={20} /></span><small>Stok Menipis</small><strong><CountUp value={dashboard.inventory.lowStock} /></strong><span className="delta warnText">Perlu ditinjau</span></article>
                <article className="statCard fadeSlideIn"><span className="ico"><Landmark size={20} /></span><small>Nilai Persediaan</small><strong><CountUp value={dashboard.inventory.value} format={money} /></strong><span className="delta">{dashboard.inventory.items} saldo produk</span></article>
                <article className="statCard fadeSlideIn"><span className="ico"><ReceiptText size={20} /></span><small>Pesanan Diproses</small><strong><CountUp value={dashboard.pendingOrders} /></strong><span className="delta">Storefront</span></article>
              </section>
            )}
            <AnalyticsWidgets data={analytics} />
          </>}

          {activeNav === 'Owner Suite' && <OwnerView token={token} />}
          {activeNav === 'Master Data' && <MasterDataView token={token} mode={activeDomainView?.key} />}
          {activeNav === 'Akuntansi & Kas' && <AccountingView token={token} mode={activeDomainView?.key} />}
          {activeNav === 'HRIS & Payroll' && (activeDomainView?.key === 'employees' ? <EmployeeMasterView token={token} /> : <HrPayrollView token={token} />)}
          {activeNav === 'Retur & Transfer' && <OperationsView token={token} />}
          {activeNav === 'Aset & Fleet' && <AssetsFleetView token={token} />}
          {activeNav === 'Kontrol Operasional' && <OperationsControlView token={token} />}
          {activeNav === 'Loyalty & Devices' && (activeDomainView?.key === 'ai' ? <AiWorkspace token={token} /> : <ExtensionsView token={token} mode="extensions" />)}
          {activeNav === 'Storefront & Fulfillment' && <ExtensionsView token={token} mode="commerce" />}

          {activeNav === 'Pembelian & Stok' && <>
            <section className="grid2">
              <form className="panel" onSubmit={addPurchaseRequest}>
                <div className="panelTitle"><div><span className="eyebrow">PURCHASE REQUEST</span><h2>Ajukan kebutuhan pembelian</h2></div><span>Approval sebelum PO</span></div>
                <label>Gudang<select required value={purchaseRequestForm.warehouseId} onChange={(e) => setPurchaseRequestForm({ ...purchaseRequestForm, warehouseId: e.target.value })}>{warehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label>Supplier opsional<select value={purchaseRequestForm.supplierId} onChange={(e) => setPurchaseRequestForm({ ...purchaseRequestForm, supplierId: e.target.value })}><option value="">Tentukan saat convert PO</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label>Produk<select required value={purchaseRequestForm.productId} onChange={(e) => { const product = products.find((p) => p.id === e.target.value); setPurchaseRequestForm({ ...purchaseRequestForm, productId: e.target.value, estimatedUnitCost: Number(product?.costPrice ?? 0) }); }}>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <div className="inline"><label>Jumlah<input type="number" min="1" value={purchaseRequestForm.quantity} onChange={(e) => setPurchaseRequestForm({ ...purchaseRequestForm, quantity: Number(e.target.value) })} /></label><label>Estimasi biaya<input type="number" min="0" value={purchaseRequestForm.estimatedUnitCost} onChange={(e) => setPurchaseRequestForm({ ...purchaseRequestForm, estimatedUnitCost: Number(e.target.value) })} /></label></div>
                <label>Alasan kebutuhan<input value={purchaseRequestForm.reason} onChange={(e) => setPurchaseRequestForm({ ...purchaseRequestForm, reason: e.target.value })} /></label>
                <button>Buat draft PR</button>
              </form>
              <div className="panel">
                <div className="panelTitle"><div><span className="eyebrow">APPROVAL</span><h2>Purchase request</h2></div><span>{purchaseRequests.length} dokumen</span></div>
                <p className="sectionHelp">Requester tidak boleh menyetujui permintaannya sendiri. Gunakan akun approver berbeda untuk separation of duties.</p>
                {purchaseRequests.length ? <div className="table">{purchaseRequests.slice(0, 12).map((pr) => <div className="receipt" key={pr.id}><div><strong>{pr.number}</strong><small>{pr.warehouse.name} · {pr.supplier?.name ?? 'Supplier belum ditentukan'} · {pr.status}</small><small>{pr.items.map((item) => `${item.product.name} × ${item.quantity}`).join(', ')}</small></div><div className="rowActions">{pr.status === 'DRAFT' && <><button type="button" className="secondary" onClick={() => void purchaseRequestAction(pr, 'cancel')}>Batal</button><button type="button" onClick={() => void purchaseRequestAction(pr, 'submit')}>Ajukan</button></>}{pr.status === 'PENDING_APPROVAL' && <><button type="button" className="secondary" onClick={() => void purchaseRequestAction(pr, 'reject')}>Tolak</button><button type="button" onClick={() => void purchaseRequestAction(pr, 'approve')}>Setujui</button></>}{pr.status === 'APPROVED' && <><button type="button" className="secondary" onClick={() => void purchaseRequestAction(pr, 'cancel')}>Batal</button><button type="button" onClick={() => void purchaseRequestAction(pr, 'convert')}>Buat PO</button></>}{pr.status === 'CONVERTED' && <span className="okText">PO dibuat</span>}</div></div>)}</div> : <div className="emptyState"><h4>Belum ada purchase request</h4><p>Buat kebutuhan pembelian terlebih dahulu; PO hanya dibuat setelah approval.</p></div>}
              </div>
            </section>
            <section className="grid2">
              <form className="panel" onSubmit={addSupplier}><div className="panelTitle"><div><span className="eyebrow">MASTER DATA</span><h2>Tambah supplier</h2></div></div><label>Kode<input required value={supplierForm.code} onChange={(e) => setSupplierForm({ ...supplierForm, code: e.target.value })} /></label><label>Nama<input required value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} /></label><label>Telepon<input value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} /></label><button>Simpan supplier</button></form>
              <form className="panel" onSubmit={addPO}><div className="panelTitle"><div><span className="eyebrow">PEMBELIAN</span><h2>Buat purchase order</h2></div></div><label>Supplier<select required value={poForm.supplierId} onChange={(e) => setPoForm({ ...poForm, supplierId: e.target.value })}>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Gudang<select required value={poForm.warehouseId} onChange={(e) => setPoForm({ ...poForm, warehouseId: e.target.value })}>{warehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Produk<select required value={poForm.productId} onChange={(e) => { const product = products.find((p) => p.id === e.target.value); const defaultUnit = product?.units?.find((u) => u.isDefaultPurchase) ?? product?.units?.[0]; setPoForm({ ...poForm, productId: e.target.value, variantId: defaultUnit?.variantId ?? '', productUnitId: defaultUnit?.id ?? '', unitCost: Number(product?.costPrice ?? 0) * Number(defaultUnit?.quantityFactor ?? 1) }); }}>{products.map((item) => <option key={item.id} value={item.id}>{item.name} · base {item.unit}</option>)}</select></label><div className="inline"><label>Variant<select value={poForm.variantId} onChange={(e) => setPoForm({ ...poForm, variantId: e.target.value, productUnitId: '' })}><option value="">Produk dasar</option>{(products.find((p) => p.id === poForm.productId)?.variants ?? []).map((variant) => <option key={variant.id} value={variant.id}>{variant.code} · {variant.name}</option>)}</select></label><label>Unit pembelian<select value={poForm.productUnitId} onChange={(e) => { const product = products.find((p) => p.id === poForm.productId); const unit = product?.units?.find((u) => u.id === e.target.value); setPoForm({ ...poForm, productUnitId: e.target.value, variantId: unit?.variantId ?? poForm.variantId, unitCost: Number(product?.costPrice ?? 0) * Number(unit?.quantityFactor ?? 1) }); }}><option value="">{products.find((p) => p.id === poForm.productId)?.unit ?? 'BASE'} · base unit</option>{(products.find((p) => p.id === poForm.productId)?.units ?? []).filter((u) => !poForm.variantId || u.variantId === poForm.variantId).map((unit) => <option key={unit.id} value={unit.id}>{unit.unitCode} · isi {unit.quantityFactor}</option>)}</select></label></div><div className="inline"><label>Jumlah unit beli<input type="number" min="1" value={poForm.orderedQty} onChange={(e) => setPoForm({ ...poForm, orderedQty: Number(e.target.value) })} /></label><label>Harga per unit beli<input type="number" min="0" value={poForm.unitCost} onChange={(e) => setPoForm({ ...poForm, unitCost: Number(e.target.value) })} /></label></div><button>Buat PO</button></form>
            </section>

            <section className="panel highlight">
              <div className="panelTitle"><div><span className="eyebrow">GUDANG</span><h2>Terima barang dari supplier</h2></div><span>Posting mengikuti inspeksi server</span></div>
              <form className="receiptForm" onSubmit={addReceipt}>
                <label>Purchase order<select required value={receiptForm.purchaseOrderId} onChange={(e) => setReceiptForm({ ...receiptForm, purchaseOrderId: e.target.value, purchaseOrderItemId: orders.find((po) => po.id === e.target.value)?.items[0]?.id ?? '' })}><option value="">Pilih PO</option>{orders.filter((po) => !['RECEIVED','CANCELLED'].includes(po.status)).map((po) => <option key={po.id} value={po.id}>{po.number} · {po.supplier.name} · {po.status}</option>)}</select></label>
                <label>Barang<select required value={receiptForm.purchaseOrderItemId} onChange={(e) => setReceiptForm({ ...receiptForm, purchaseOrderItemId: e.target.value, batchNumber: '', expiryDate: '', serialNumbers: '' })}><option value="">Pilih barang</option>{selectedPO?.items.map((item) => <option key={item.id} value={item.id}>{item.product.name} · sisa {Math.floor((item.orderedQty - item.receivedQty) / Math.max(1, item.quantityFactor || 1))} {item.unitCode ?? item.product.unit}</option>)}</select></label>
                <div className="inline"><label>Jumlah datang<input type="number" min="1" value={receiptForm.quantityReceived} onChange={(e) => setReceiptForm({ ...receiptForm, quantityReceived: Number(e.target.value) })} /></label><label>Rusak<input type="number" min="0" max={receiptForm.quantityReceived} value={receiptForm.quantityDamaged} onChange={(e) => setReceiptForm({ ...receiptForm, quantityDamaged: Number(e.target.value) })} /></label></div>
                {selectedPOItem?.product.trackBatch && <div className="inline"><label>Nomor batch<input required value={receiptForm.batchNumber} onChange={(e) => setReceiptForm({ ...receiptForm, batchNumber: e.target.value })} /></label><label>Kedaluwarsa{selectedPOItem.product.trackExpiry ? ' (wajib)' : ''}<input type="date" required={Boolean(selectedPOItem.product.trackExpiry)} value={receiptForm.expiryDate} onChange={(e) => setReceiptForm({ ...receiptForm, expiryDate: e.target.value })} /></label></div>}
                {selectedPOItem?.product.trackSerial && <label>Serial accepted unit<textarea required value={receiptForm.serialNumbers} onChange={(e) => setReceiptForm({ ...receiptForm, serialNumbers: e.target.value })} placeholder="Satu serial per baris atau pisahkan dengan koma" /><small>Jumlah serial harus sama dengan jumlah diterima dikurangi rusak, lalu dikalikan faktor UOM karena serial mengikuti base unit.</small></label>}
                <div className="inline"><label>Faktur supplier<input value={receiptForm.supplierInvoice} onChange={(e) => setReceiptForm({ ...receiptForm, supplierInvoice: e.target.value })} /></label><label>Surat jalan<input value={receiptForm.deliveryNote} onChange={(e) => setReceiptForm({ ...receiptForm, deliveryNote: e.target.value })} /></label></div>
                <button>Proses barang masuk</button>
              </form>
            </section>

            <section className="grid2">
              <div className="panel"><div className="panelTitle"><div><span className="eyebrow">STOK</span><h2>Persediaan gudang</h2></div></div>{inventories.length ? <div className="table"><div className="tr th"><span>Produk</span><span>Gudang</span><span>Tersedia</span></div>{inventories.map((item) => <div className="tr" key={item.id}><span><strong>{item.product.name}</strong><small>{item.product.sku}</small></span><span>{item.warehouse.name}</span><span className={item.available <= item.product.minStock ? 'danger' : 'okText'}>{item.available}</span></div>)}</div> : <div className="emptyState"><h4>Belum ada saldo persediaan</h4><p>Saldo gudang akan tampil setelah penerimaan atau transaksi stok tercatat.</p></div>}</div>
              <div className="panel"><div className="panelTitle"><div><span className="eyebrow">PENERIMAAN</span><h2>Barang masuk terakhir</h2></div></div>{receipts.length ? <div className="table">{receipts.slice(0,8).map((receipt) => <div className="receipt" key={receipt.id}><div><strong>{receipt.number}</strong><small>{receipt.purchaseOrder.number} · {receipt.supplier.name} · {receipt.operationalStatus}</small></div><div className="rowActions"><span>{receipt.items.reduce((sum,item) => sum + item.acceptedQty,0)} diterima</span>{!['CONFIRMED','PARTIALLY_ACCEPTED','REJECTED','CANCELLED'].includes(receipt.operationalStatus) && <button type="button" className="secondary" onClick={() => void confirmReceipt(receipt)}>Konfirmasi posting</button>}</div></div>)}</div> : <div className="emptyState"><h4>Belum ada penerimaan</h4><p>Penerimaan supplier yang dibuat akan tampil di sini.</p></div>}</div>
            </section>
          </>}

          {activeNav === 'Sistem & Akses' && (activeDomainView?.key === 'automation' ? <AutomationWorkspace token={token} /> : <>
            <section className="panel">
              <div className="panelTitle"><div><span className="eyebrow">RUNTIME MODULES</span><h2>Feature flags</h2></div><span>{Object.values(manifest?.features ?? {}).filter((feature) => feature.enabled).length} aktif</span></div>
              <p className="sectionHelp">Perubahan flag memengaruhi kemampuan runtime. Gunakan hanya untuk feature yang memang memiliki implementasi backend/UI.</p>
              <div className="table">{manifest?.modules.map((module) => { const enabled = module.isCore || !module.featureKey || manifest.features[module.featureKey]?.enabled; return <div className="receipt" key={module.code}><div><strong>{module.name}</strong><small>{module.category} · {module.code}</small></div>{module.featureKey ? <button type="button" className="secondary" onClick={() => setFeatureChange({ key: module.featureKey!, enabled: !enabled })}>{enabled ? 'Nonaktifkan' : 'Aktifkan'}</button> : <span className="okText">CORE</span>}</div>; })}</div>
            </section>
            <section className="grid2">
              <form className="panel" onSubmit={addUser}><div className="panelTitle"><div><span className="eyebrow">MANAJEMEN USER</span><h2>Tambah pengguna</h2></div></div><label>Nama<input required value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} /></label><label>Email<input required type="email" autoComplete="off" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} /></label><label>Password<input required minLength={8} type="password" autoComplete="new-password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} /></label><label>Role<select value={userForm.roleName} onChange={(e) => setUserForm({ ...userForm, roleName: e.target.value })}>{roles.map((role) => <option key={role.id} value={role.name}>{role.name}</option>)}</select></label><button>Simpan pengguna</button></form>
              <div className="panel"><div className="panelTitle"><div><span className="eyebrow">AKSES SISTEM</span><h2>Daftar pengguna</h2></div><span>{users.length} akun</span></div>{users.length ? users.map((user) => <div className="receipt" key={user.id}><div><strong>{user.name}</strong><small>{user.email}</small></div><span>{user.roles.map((role) => role.role.name).join(', ') || 'Tanpa role'}</span></div>) : <div className="emptyState"><h4>Belum ada pengguna</h4><p>Akun yang dibuat akan tampil di sini.</p></div>}</div>
            </section>
            <SecurityView token={token} />
            <ApiKeysView token={token} />
          </>)}

        {featureChange && <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="feature-change-title">
          <div className="modalCard">
            <span className="eyebrow">FEATURE FLAG</span>
            <h2 id="feature-change-title">{featureChange.enabled ? 'Aktifkan' : 'Nonaktifkan'} {featureChange.key}?</h2>
            <p className="sectionHelp">Perubahan ini memengaruhi kemampuan runtime untuk perusahaan aktif. Pastikan dampaknya sudah dipahami sebelum melanjutkan.</p>
            <div className="modalActions"><button type="button" className="secondary" onClick={() => setFeatureChange(null)}>Batal</button><button type="button" className={!featureChange.enabled ? 'dangerButton' : ''} onClick={() => void toggleFeature(featureChange.key, featureChange.enabled)}>{featureChange.enabled ? 'Aktifkan feature' : 'Nonaktifkan feature'}</button></div>
          </div>
        </div>}
        {token && <ToastStack toasts={toasts} />}
    </AdminAppShell>
  );
}
