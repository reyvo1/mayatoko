'use client';
import { authFetch } from '../auth-fetch';
// Modul Operasional: retur, transfer stok, dan stock opname yang dapat dijalankan dari Admin.
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ErrorState, Panel, Table, StatusChip, rupiah, tanggal } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type SaleReturn = { id: string; number: string; status: string; refundMethod?: string; refundAmount: string | number; inspectionId?: string | null; createdAt: string };
type OrderReturn = { id: string; number: string; status: string; refundMethod?: string | null; refundAmount: string | number; inspectionId?: string | null; reason?: string | null; createdAt: string; order: { id: string; number: string; customerName: string; status: string }; customer?: { name: string; email?: string | null } | null; items: Array<{ id: string; quantity: number; condition: string; restock: boolean; product: { sku: string; name: string } }> };
type PurchaseReturnItem = { id: string; productId: string; quantity: number; metadata?: { goodsReceiptItemId?: string } | null };
type PurchaseReturn = { id: string; number: string; status: string; amount: string | number; goodsReceiptId?: string | null; supplierCreditNoteNumber?: string | null; inspectionId?: string | null; items: PurchaseReturnItem[]; createdAt: string };
type GoodsReceiptItem = { id: string; productId: string; quantityReceived: number; acceptedQty: number; product?: { id: string; sku: string; name: string } };
type GoodsReceipt = { id: string; number: string; operationalStatus: string; supplier?: { id: string; name: string }; warehouse?: { id: string; code: string; name: string }; items: GoodsReceiptItem[]; receivedAt: string };
type TransferItem = { id: string; productId: string; quantity: number; shippedQty: number; receivedQty: number; batchNumber?: string | null };
type Transfer = { id: string; number: string; sourceWarehouseId: string; destinationWarehouseId: string; status: string; items: TransferItem[]; createdAt: string };
type OpnameItem = { id: string; productId: string; systemQty: number; countedQty?: number | null; difference?: number | null; reason?: string | null };
type Opname = { id: string; number: string; warehouseId: string; locationId?: string | null; status: string; items: OpnameItem[]; createdAt: string };
type Warehouse = { id: string; code: string; name: string; branchId: string; isActive?: boolean };
type Product = { id: string; sku: string; name: string; trackBatch?: boolean; trackSerial?: boolean };
type InventoryBatch = { id:string; warehouseId:string; productId:string; batchNumber:string; quantity:number; reserved:number; producedAt?:string|null; expiryDate?:string|null };
type InventorySerial = { id:string; warehouseId:string; productId:string; serialNumber:string; status:string; referenceType?:string|null; referenceId?:string|null; createdAt:string };
type WarehouseLocation = { id:string; warehouseId:string; code:string; name:string; type:string; isDefault?:boolean; isActive?:boolean };
type LocationBalance = { id:string; warehouseId:string; locationId:string; productId:string; quantity:number; reserved:number; available:number; location?:WarehouseLocation|null; product?:{ id:string; sku:string; name:string; baseUnit?:string }|null };

type CursorResponse<T> = T[] | { items?: T[] };
function rowsOf<T>(value: CursorResponse<T>): T[] { return Array.isArray(value) ? value : value.items ?? []; }

export default function OperationsView({ token }: { token: string }) {
  const [saleReturns, setSaleReturns] = useState<SaleReturn[]>([]);
  const [orderReturns, setOrderReturns] = useState<OrderReturn[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturn[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [opnames, setOpnames] = useState<Opname[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [serials, setSerials] = useState<InventorySerial[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [locationBalances, setLocationBalances] = useState<LocationBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [transferForm, setTransferForm] = useState({ sourceWarehouseId: '', destinationWarehouseId: '', productId: '', quantity: 1, notes: '' });
  const [opnameWarehouseId, setOpnameWarehouseId] = useState('');
  const [opnameLocationId, setOpnameLocationId] = useState('');
  const [locationWarehouseId, setLocationWarehouseId] = useState('');
  const [relocationForm, setRelocationForm] = useState({ productId:'', sourceLocationId:'', destinationLocationId:'', quantity:1, notes:'' });
  const [purchaseReturnForm, setPurchaseReturnForm] = useState({ goodsReceiptId: '', goodsReceiptItemId: '', quantity: 1, reason: '', supplierCreditNoteNumber: '' });
  const [selectedOpnameId, setSelectedOpnameId] = useState('');
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [rejectOrderReturnId, setRejectOrderReturnId] = useState('');
  const [rejectOrderReturnReason, setRejectOrderReturnReason] = useState('');
  const [batchForm, setBatchForm] = useState({ warehouseId:'', productId:'', batchNumber:'', producedAt:'', expiryDate:'' });
  const [serialForm, setSerialForm] = useState({ warehouseId:'', productId:'', serialNumber:'' });

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await authFetch(`${API}${path}`, token, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(Array.isArray(data?.message) ? data.message.join(', ') : data?.message ?? `HTTP ${response.status}`);
    return data as T;
  }

  async function refresh() {
    setLoading(true); setError('');
    try {
      const [sr, ort, prt, gr, tr, op, wh, pr, ba, se, lo] = await Promise.all([
        api<CursorResponse<SaleReturn>>('/returns/sales?limit=50'),
        api<CursorResponse<OrderReturn>>('/returns/orders'),
        api<CursorResponse<PurchaseReturn>>('/returns/purchases?limit=50'),
        api<CursorResponse<GoodsReceipt>>('/goods-receipts?limit=100'),
        api<CursorResponse<Transfer>>('/advanced-inventory/stock-transfers'),
        api<CursorResponse<Opname>>('/advanced-inventory/stock-opnames'),
        api<CursorResponse<Warehouse>>('/master-data/warehouses'),
        api<CursorResponse<Product>>('/products?limit=200'),
        api<CursorResponse<InventoryBatch>>('/inventory-batches'),
        api<CursorResponse<InventorySerial>>('/inventory-serials'),
        api<CursorResponse<WarehouseLocation>>('/master-data/warehouse-locations'),
      ]);
      const warehouseRows = rowsOf(wh).filter((row) => row.isActive !== false);
      const productRows = rowsOf(pr);
      const receiptRows = rowsOf(gr).filter((row) => ['CONFIRMED','PARTIALLY_ACCEPTED'].includes(row.operationalStatus));
      const locationRows = rowsOf(lo).filter((row) => row.isActive !== false);
      setSaleReturns(rowsOf(sr)); setOrderReturns(rowsOf(ort)); setPurchaseReturns(rowsOf(prt)); setGoodsReceipts(receiptRows); setTransfers(rowsOf(tr)); setOpnames(rowsOf(op)); setWarehouses(warehouseRows); setProducts(productRows); setBatches(rowsOf(ba)); setSerials(rowsOf(se)); setLocations(locationRows);
      setPurchaseReturnForm((value) => {
        const receiptId = value.goodsReceiptId || receiptRows[0]?.id || '';
        const receipt = receiptRows.find((row) => row.id === receiptId);
        const itemId = value.goodsReceiptItemId && receipt?.items.some((item) => item.id === value.goodsReceiptItemId) ? value.goodsReceiptItemId : receipt?.items[0]?.id || '';
        return { ...value, goodsReceiptId: receiptId, goodsReceiptItemId: itemId };
      });
      setTransferForm((value) => ({
        ...value,
        sourceWarehouseId: value.sourceWarehouseId || warehouseRows[0]?.id || '',
        destinationWarehouseId: value.destinationWarehouseId || warehouseRows.find((row) => row.id !== (value.sourceWarehouseId || warehouseRows[0]?.id))?.id || '',
        productId: value.productId || productRows[0]?.id || '',
      }));
      setOpnameWarehouseId((value) => value || warehouseRows[0]?.id || '');
      setLocationWarehouseId((value) => value || warehouseRows[0]?.id || '');
      setRelocationForm((value) => ({ ...value, productId:value.productId || productRows[0]?.id || '' }));
      const batchProducts = productRows.filter((row) => row.trackBatch);
      const serialProducts = productRows.filter((row) => row.trackSerial);
      setBatchForm((value) => ({ ...value, warehouseId: value.warehouseId || warehouseRows[0]?.id || '', productId: value.productId || batchProducts[0]?.id || '' }));
      setSerialForm((value) => ({ ...value, warehouseId: value.warehouseId || warehouseRows[0]?.id || '', productId: value.productId || serialProducts[0]?.id || '' }));
    } catch (err) { setError(err instanceof Error ? err.message : 'Data operasional gagal dimuat.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, [token]);

  useEffect(() => {
    if (!locationWarehouseId) { setLocationBalances([]); return; }
    let cancelled = false;
    void api<CursorResponse<LocationBalance>>(`/advanced-inventory/location-balances?warehouseId=${encodeURIComponent(locationWarehouseId)}`).then((value) => {
      if (!cancelled) setLocationBalances(rowsOf(value));
    }).catch((err) => { if (!cancelled) setMessage(err instanceof Error ? err.message : 'Saldo lokasi gagal dimuat.'); });
    return () => { cancelled = true; };
  }, [locationWarehouseId, token]);

  const warehouseById = useMemo(() => new Map(warehouses.map((row) => [row.id, row])), [warehouses]);
  const productById = useMemo(() => new Map(products.map((row) => [row.id, row])), [products]);
  const selectedOpname = opnames.find((row) => row.id === selectedOpnameId);
  const locationOptions = locations.filter((row) => row.warehouseId === locationWarehouseId);
  const opnameLocationOptions = locations.filter((row) => row.warehouseId === opnameWarehouseId);

  async function run(key: string, work: () => Promise<string | void>) {
    if (busyKey) return;
    setBusyKey(key); setMessage('');
    try {
      const result = await work();
      if (result) setMessage(result);
      await refresh();
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Operasi gagal.'); }
    finally { setBusyKey(''); }
  }

  async function confirmSaleReturn(row: SaleReturn) {
    if (!['REQUESTED','APPROVED'].includes(row.status)) return;
    await run(`return:${row.id}`, async () => {
      await api(`/returns/sales/${row.id}/confirm`, {
        method: 'POST', body: JSON.stringify({ inspectionId: row.inspectionId ?? undefined, notes: 'Refund diselesaikan dari modul Retur & Transfer setelah inspeksi.' }),
      });
      return `Retur ${row.number} selesai. Refund, stok, loyalitas, pajak, dan jurnal telah diposting server.`;
    });
  }

  async function startOrderReturnInspection(row: OrderReturn) {
    await run(`order-return:${row.id}:inspection`, async () => {
      await api(`/returns/orders/${row.id}/inspection`, { method: 'POST' });
      return `Inspeksi retur online ${row.number} dibuat. Selesaikan di Kontrol Operasional sebelum refund.`;
    });
  }

  async function confirmOrderReturn(row: OrderReturn) {
    await run(`order-return:${row.id}:confirm`, async () => {
      await api(`/returns/orders/${row.id}/confirm`, { method: 'POST', body: JSON.stringify({ refundMethod: row.refundMethod ?? 'ORIGINAL', notes: 'Refund order online diposting dari Admin setelah inspeksi inbound APPROVED.' }) });
      return `Retur order ${row.number} selesai. Refund/reversal stok, pajak, dan jurnal telah diposting server.`;
    });
  }

  async function rejectOrderReturn(event: FormEvent) {
    event.preventDefault();
    const row = orderReturns.find((item) => item.id === rejectOrderReturnId);
    const reason = rejectOrderReturnReason.trim();
    if (!row || !reason) return;
    await run(`order-return:${row.id}:reject`, async () => {
      await api(`/returns/orders/${row.id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
      setRejectOrderReturnId(''); setRejectOrderReturnReason('');
      return `Retur order ${row.number} ditolak.`;
    });
  }

  async function createPurchaseReturn(event: FormEvent) {
    event.preventDefault();
    await run('purchase-return:create', async () => {
      const receipt = goodsReceipts.find((row) => row.id === purchaseReturnForm.goodsReceiptId);
      const item = receipt?.items.find((row) => row.id === purchaseReturnForm.goodsReceiptItemId);
      if (!receipt || !item) throw new Error('Pilih penerimaan dan item yang akan diretur.');
      if (!Number.isInteger(purchaseReturnForm.quantity) || purchaseReturnForm.quantity < 1 || purchaseReturnForm.quantity > item.acceptedQty) {
        throw new Error(`Jumlah retur harus 1 sampai ${item.acceptedQty}. Server tetap memvalidasi sisa retur kumulatif.`);
      }
      const row = await api<PurchaseReturn>('/returns/purchases', {
        method: 'POST',
        body: JSON.stringify({
          goodsReceiptId: receipt.id,
          reason: purchaseReturnForm.reason || undefined,
          supplierCreditNoteNumber: purchaseReturnForm.supplierCreditNoteNumber || undefined,
          idempotencyKey: `admin-purchase-return-${receipt.id}-${item.id}-${Date.now()}`,
          items: [{ goodsReceiptItemId: item.id, quantity: purchaseReturnForm.quantity, reason: purchaseReturnForm.reason || undefined }],
        }),
      });
      setPurchaseReturnForm((value) => ({ ...value, quantity: 1, reason: '', supplierCreditNoteNumber: '' }));
      return `Retur supplier ${row.number} dibuat. Selesaikan inspeksi outbound di Kontrol Operasional sebelum posting retur.`;
    });
  }

  async function confirmPurchaseReturn(row: PurchaseReturn) {
    await run(`purchase-return:${row.id}`, async () => {
      await api(`/returns/purchases/${row.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ inspectionId: row.inspectionId ?? undefined, supplierCreditNoteNumber: row.supplierCreditNoteNumber ?? undefined, notes: 'Retur supplier diposting dari Admin setelah pemeriksaan outbound.' }),
      });
      return `Retur supplier ${row.number} selesai. Stok, utang/piutang refund supplier, pajak, dan jurnal telah diposting server.`;
    });
  }

  async function createTransfer(event: FormEvent) {
    event.preventDefault();
    await run('transfer:create', async () => {
      if (!transferForm.sourceWarehouseId || !transferForm.destinationWarehouseId || !transferForm.productId) throw new Error('Pilih gudang asal, tujuan, dan produk.');
      if (transferForm.sourceWarehouseId === transferForm.destinationWarehouseId) throw new Error('Gudang asal dan tujuan harus berbeda.');
      if (!Number.isInteger(transferForm.quantity) || transferForm.quantity < 1) throw new Error('Jumlah transfer minimal 1.');
      const row = await api<Transfer>('/advanced-inventory/stock-transfers', {
        method: 'POST', body: JSON.stringify({ sourceWarehouseId: transferForm.sourceWarehouseId, destinationWarehouseId: transferForm.destinationWarehouseId, notes: transferForm.notes || undefined, items: [{ productId: transferForm.productId, quantity: transferForm.quantity }] }),
      });
      setTransferForm((value) => ({ ...value, quantity: 1, notes: '' }));
      return `Transfer ${row.number} dibuat dan menunggu approval.`;
    });
  }

  async function transferAction(row: Transfer, action: 'approve' | 'ship' | 'receive') {
    await run(`transfer:${row.id}:${action}`, async () => {
      if (action === 'receive') {
        const items = row.items.map((item) => ({ transferItemId: item.id, receivedQty: Math.max(0, item.shippedQty - item.receivedQty) })).filter((item) => item.receivedQty > 0);
        if (!items.length) throw new Error('Tidak ada quantity dalam perjalanan yang tersisa untuk diterima.');
        await api(`/advanced-inventory/stock-transfers/${row.id}/receive`, { method: 'PATCH', body: JSON.stringify({ items, notes: 'Penerimaan seluruh sisa quantity dari Admin.' }) });
      } else {
        await api(`/advanced-inventory/stock-transfers/${row.id}/${action}`, { method: 'PATCH' });
      }
      return `Transfer ${row.number}: ${action} berhasil.`;
    });
  }

  async function createOpname(event: FormEvent) {
    event.preventDefault();
    await run('opname:create', async () => {
      if (!opnameWarehouseId) throw new Error('Pilih gudang untuk stock opname.');
      const row = await api<Opname>('/advanced-inventory/stock-opnames', { method: 'POST', body: JSON.stringify({ warehouseId: opnameWarehouseId, locationId: opnameLocationId || undefined, notes: opnameLocationId ? 'Stock opname lokasi dibuat dari Admin.' : 'Stock opname seluruh gudang dibuat dari Admin.' }) });
      setSelectedOpnameId(row.id);
      setCounts(Object.fromEntries(row.items.map((item) => [item.id, String(item.systemQty)])));
      return `Stock opname ${row.number} dibuat. Masukkan hasil hitung fisik.`;
    });
  }

  function editCounts(row: Opname) {
    setSelectedOpnameId(row.id);
    setCounts(Object.fromEntries(row.items.map((item) => [item.id, String(item.countedQty ?? item.systemQty)])));
    setMessage(`Menghitung ${row.number}. Nilai awal diisi sesuai system quantity; ubah sesuai hitung fisik.`);
  }

  async function saveCounts(row: Opname) {
    await run(`opname:${row.id}:count`, async () => {
      const items = row.items.map((item) => {
        const raw = counts[item.id];
        const countedQty = Number(raw);
        if (!Number.isInteger(countedQty) || countedQty < 0) throw new Error(`Hasil hitung ${productById.get(item.productId)?.name ?? item.productId} harus bilangan bulat >= 0.`);
        return { opnameItemId: item.id, countedQty, ...(countedQty !== item.systemQty ? { reason: 'Hasil hitung fisik berbeda dari sistem.' } : {}) };
      });
      await api(`/advanced-inventory/stock-opnames/${row.id}/count`, { method: 'PATCH', body: JSON.stringify({ items }) });
      return `Hasil hitung ${row.number} disimpan.`;
    });
  }

  async function opnameAction(row: Opname, action: 'submit' | 'complete') {
    await run(`opname:${row.id}:${action}`, async () => {
      await api(`/advanced-inventory/stock-opnames/${row.id}/${action}`, { method: 'PATCH' });
      if (action === 'complete') { setSelectedOpnameId(''); setCounts({}); }
      return action === 'submit' ? `${row.number} diajukan untuk approval.` : `${row.number} selesai; movement dan jurnal penyesuaian diposting.`;
    });
  }

  async function relocateStock(event: FormEvent) {
    event.preventDefault();
    await run('location:relocate', async () => {
      if (!locationWarehouseId || !relocationForm.productId || !relocationForm.sourceLocationId || !relocationForm.destinationLocationId) throw new Error('Gudang, produk, lokasi asal, dan lokasi tujuan wajib dipilih.');
      if (relocationForm.sourceLocationId === relocationForm.destinationLocationId) throw new Error('Lokasi asal dan tujuan harus berbeda.');
      if (!Number.isInteger(relocationForm.quantity) || relocationForm.quantity < 1) throw new Error('Jumlah relokasi minimal 1.');
      await api('/advanced-inventory/location-relocations', { method:'POST', body:JSON.stringify({ warehouseId:locationWarehouseId, productId:relocationForm.productId, sourceLocationId:relocationForm.sourceLocationId, destinationLocationId:relocationForm.destinationLocationId, quantity:relocationForm.quantity, notes:relocationForm.notes || undefined }) });
      const fresh = await api<CursorResponse<LocationBalance>>(`/advanced-inventory/location-balances?warehouseId=${encodeURIComponent(locationWarehouseId)}`);
      setLocationBalances(rowsOf(fresh));
      setRelocationForm((value) => ({ ...value, quantity:1, notes:'' }));
      return 'Relokasi stok antar-lokasi berhasil. Total stok gudang tidak berubah.';
    });
  }

  async function createBatch(event: FormEvent) {
    event.preventDefault();
    await run('batch:create', async () => {
      if (!batchForm.warehouseId || !batchForm.productId || !batchForm.batchNumber.trim()) throw new Error('Gudang, produk, dan nomor batch wajib diisi.');
      await api('/inventory-batches', { method:'POST', body:JSON.stringify({ warehouseId:batchForm.warehouseId, productId:batchForm.productId, batchNumber:batchForm.batchNumber.trim(), producedAt:batchForm.producedAt || undefined, expiryDate:batchForm.expiryDate || undefined, quantity:0 }) });
      setBatchForm((value) => ({ ...value, batchNumber:'', producedAt:'', expiryDate:'' }));
      return 'Batch berhasil dipraregistrasi dengan quantity 0. Kuantitas hanya bertambah melalui movement inventory canonical.';
    });
  }

  async function createSerial(event: FormEvent) {
    event.preventDefault();
    await run('serial:create', async () => {
      if (!serialForm.warehouseId || !serialForm.productId || !serialForm.serialNumber.trim()) throw new Error('Gudang, produk, dan nomor serial wajib diisi.');
      await api('/inventory-serials', { method:'POST', body:JSON.stringify({ warehouseId:serialForm.warehouseId, productId:serialForm.productId, serialNumber:serialForm.serialNumber.trim() }) });
      setSerialForm((value) => ({ ...value, serialNumber:'' }));
      return 'Serial berhasil diregistrasi terhadap stok fisik yang sudah diposting.';
    });
  }

  if (error) return <ErrorState message={`Data retur/transfer/opname tidak dapat dimuat: ${error}`} />;

  return (
    <>
      <section className="grid2">
        <Panel eyebrow="TRACEABILITY" title="Batch / Expiry" badge={`${batches.length} batch`}>
          <form className="formStack" onSubmit={createBatch}>
            <label>Gudang<select required value={batchForm.warehouseId} onChange={(e)=>setBatchForm({...batchForm,warehouseId:e.target.value})}>{warehouses.map((w)=><option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label>
            <label>Produk batch<select required value={batchForm.productId} onChange={(e)=>setBatchForm({...batchForm,productId:e.target.value})}><option value="">Pilih produk</option>{products.filter((p)=>p.trackBatch).map((p)=><option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}</select></label>
            <label>Nomor batch<input required value={batchForm.batchNumber} onChange={(e)=>setBatchForm({...batchForm,batchNumber:e.target.value})}/></label>
            <label>Tanggal produksi<input type="date" value={batchForm.producedAt} onChange={(e)=>setBatchForm({...batchForm,producedAt:e.target.value})}/></label>
            <label>Kedaluwarsa<input type="date" value={batchForm.expiryDate} onChange={(e)=>setBatchForm({...batchForm,expiryDate:e.target.value})}/></label>
            <button disabled={Boolean(busyKey)}>Praregistrasi batch</button>
          </form>
          <Table head={['Batch','Produk','Gudang','Qty / Reserved','Expiry']} rows={batches.slice(0,40).map((b)=>[<strong>{b.batchNumber}</strong>,productById.get(b.productId)?.sku??b.productId,warehouseById.get(b.warehouseId)?.code??'-',`${b.quantity} / ${b.reserved}`,b.expiryDate?tanggal(b.expiryDate):'-'])} empty="Belum ada batch." />
          <p className="sectionHelp">Praregistrasi tidak menambah stok. Kuantitas batch hanya boleh berasal dari penerimaan/retur/transfer/movement canonical.</p>
        </Panel>
        <Panel eyebrow="TRACEABILITY" title="Serial Number" badge={`${serials.length} serial`}>
          <form className="formStack" onSubmit={createSerial}>
            <label>Gudang<select required value={serialForm.warehouseId} onChange={(e)=>setSerialForm({...serialForm,warehouseId:e.target.value})}>{warehouses.map((w)=><option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label>
            <label>Produk serial<select required value={serialForm.productId} onChange={(e)=>setSerialForm({...serialForm,productId:e.target.value})}><option value="">Pilih produk</option>{products.filter((p)=>p.trackSerial).map((p)=><option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}</select></label>
            <label>Nomor serial<input required value={serialForm.serialNumber} onChange={(e)=>setSerialForm({...serialForm,serialNumber:e.target.value})}/></label>
            <button disabled={Boolean(busyKey)}>Registrasi serial</button>
          </form>
          <Table head={['Serial','Produk','Gudang','Status']} rows={serials.slice(0,40).map((x)=>[<strong>{x.serialNumber}</strong>,productById.get(x.productId)?.sku??x.productId,warehouseById.get(x.warehouseId)?.code??'-',<StatusChip status={x.status}/>])} empty="Belum ada serial." />
          <p className="sectionHelp">Server menolak serial untuk produk non-serial dan menolak jumlah serial fisik melebihi stok inventory yang sudah diposting.</p>
        </Panel>
      </section>

      <section className="grid2">
        <Panel eyebrow="RETUR" title="Retur Penjualan" badge={loading ? 'memuat' : `${saleReturns.length} retur`}>
          <Table loading={loading} head={['Nomor', 'Refund', 'Nilai', 'Status', 'Tindakan']} rows={saleReturns.map((r) => [
            <strong>{r.number}</strong>, r.refundMethod ?? '-', rupiah(r.refundAmount ?? 0), <StatusChip status={r.status ?? '-'} />,
            ['REQUESTED','APPROVED'].includes(r.status) ? <button type="button" className="secondary" disabled={Boolean(busyKey)} onClick={() => void confirmSaleReturn(r)}>{busyKey === `return:${r.id}` ? 'Memproses…' : 'Selesaikan refund'}</button> : <span>-</span>,
          ])} empty="Belum ada retur penjualan." />
        </Panel>

        <Panel eyebrow="ONLINE RETURN" title="Retur Pesanan Storefront" badge={loading ? 'memuat' : `${orderReturns.length} retur`}>
          <Table loading={loading} head={['Nomor / Order', 'Customer', 'Nilai', 'Status', 'Tindakan']} rows={orderReturns.map((r) => {
            const actions: React.ReactNode[] = [];
            if (r.status === 'REQUESTED') actions.push(<button key="inspect" type="button" className="secondary" disabled={Boolean(busyKey)} onClick={() => void startOrderReturnInspection(r)}>Mulai inspeksi</button>);
            if (['INSPECTION','APPROVED'].includes(r.status)) actions.push(<button key="confirm" type="button" className="secondary" disabled={Boolean(busyKey)} onClick={() => void confirmOrderReturn(r)}>Posting refund</button>);
            if (['REQUESTED','INSPECTION'].includes(r.status)) actions.push(<button key="reject" type="button" className="secondary" disabled={Boolean(busyKey)} onClick={() => { setRejectOrderReturnId(r.id); setRejectOrderReturnReason(''); }}>Tolak</button>);
            return [<><strong>{r.number}</strong><small style={{ display: 'block' }}>{r.order.number}</small></>, r.customer?.name ?? r.order.customerName, rupiah(Number(r.refundAmount ?? 0)), <StatusChip status={r.status} />, <div className="rowActions">{actions.length ? actions : '-'}</div>];
          })} empty="Belum ada retur order storefront." />
          {rejectOrderReturnId && <form className="formStack" onSubmit={rejectOrderReturn}><label>Alasan penolakan<input required maxLength={1000} value={rejectOrderReturnReason} onChange={(e) => setRejectOrderReturnReason(e.target.value)} /></label><div className="rowActions"><button disabled={Boolean(busyKey)}>Konfirmasi tolak</button><button type="button" className="secondary" onClick={() => { setRejectOrderReturnId(''); setRejectOrderReturnReason(''); }}>Batal</button></div></form>}
          <p className="sectionHelp">Customer mengajukan retur dari akun Storefront. Staff memulai inspeksi inbound, Kontrol Operasional memverifikasi barang, lalu Finance/Warehouse memposting refund dan reversal.</p>
        </Panel>

        <Panel eyebrow="TRANSFER BARU" title="Pindah Stok Antar-Gudang" badge="workflow approval">
          <form className="formStack" onSubmit={createTransfer}>
            <label>Gudang asal<select required value={transferForm.sourceWarehouseId} onChange={(e) => setTransferForm({ ...transferForm, sourceWarehouseId: e.target.value })}>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label>
            <label>Gudang tujuan<select required value={transferForm.destinationWarehouseId} onChange={(e) => setTransferForm({ ...transferForm, destinationWarehouseId: e.target.value })}>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label>
            <label>Produk<select required value={transferForm.productId} onChange={(e) => setTransferForm({ ...transferForm, productId: e.target.value })}>{products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}</select></label>
            <label>Jumlah<input required type="number" min="1" step="1" value={transferForm.quantity} onChange={(e) => setTransferForm({ ...transferForm, quantity: Number(e.target.value) })} /></label>
            <label>Catatan<input value={transferForm.notes} onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })} /></label>
            <button disabled={Boolean(busyKey)}>{busyKey === 'transfer:create' ? 'Membuat…' : 'Buat transfer'}</button>
          </form>
        </Panel>
      </section>

      <section className="grid2">
        <Panel eyebrow="RETUR SUPPLIER" title="Buat Retur Pembelian" badge="inspection required">
          <form className="formStack" onSubmit={createPurchaseReturn}>
            <label>Penerimaan barang<select required value={purchaseReturnForm.goodsReceiptId} onChange={(e) => { const receipt = goodsReceipts.find((row) => row.id === e.target.value); setPurchaseReturnForm({ ...purchaseReturnForm, goodsReceiptId: e.target.value, goodsReceiptItemId: receipt?.items[0]?.id ?? '' }); }}>
              <option value="">Pilih penerimaan</option>{goodsReceipts.map((r) => <option key={r.id} value={r.id}>{r.number} · {r.supplier?.name ?? 'Supplier'} · {r.warehouse?.code ?? '-'}</option>)}
            </select></label>
            <label>Item<select required value={purchaseReturnForm.goodsReceiptItemId} onChange={(e) => setPurchaseReturnForm({ ...purchaseReturnForm, goodsReceiptItemId: e.target.value })}>
              <option value="">Pilih item</option>{(goodsReceipts.find((row) => row.id === purchaseReturnForm.goodsReceiptId)?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.product?.sku ?? item.productId} · {item.product?.name ?? 'Produk'} · accepted {item.acceptedQty}</option>)}
            </select></label>
            <label>Jumlah<input required type="number" min="1" step="1" value={purchaseReturnForm.quantity} onChange={(e) => setPurchaseReturnForm({ ...purchaseReturnForm, quantity: Number(e.target.value) })} /></label>
            <label>Alasan<input value={purchaseReturnForm.reason} onChange={(e) => setPurchaseReturnForm({ ...purchaseReturnForm, reason: e.target.value })} /></label>
            <label>Credit note supplier <small>(boleh nanti bila belum tersedia)</small><input value={purchaseReturnForm.supplierCreditNoteNumber} onChange={(e) => setPurchaseReturnForm({ ...purchaseReturnForm, supplierCreditNoteNumber: e.target.value })} /></label>
            <button disabled={Boolean(busyKey)}>{busyKey === 'purchase-return:create' ? 'Membuat…' : 'Buat retur supplier'}</button>
          </form>
        </Panel>

        <Panel eyebrow="PURCHASE RETURN" title="Retur Pembelian / Supplier" badge={loading ? 'memuat' : `${purchaseReturns.length} retur`}>
          <Table loading={loading} head={['Nomor', 'Nilai', 'Credit Note', 'Status', 'Tindakan']} rows={purchaseReturns.map((r) => [
            <strong>{r.number}</strong>, rupiah(Number(r.amount ?? 0)), r.supplierCreditNoteNumber ?? '-', <StatusChip status={r.status} />,
            ['REQUESTED','APPROVED'].includes(r.status) ? <button type="button" className="secondary" disabled={Boolean(busyKey)} onClick={() => void confirmPurchaseReturn(r)}>{busyKey === `purchase-return:${r.id}` ? 'Memproses…' : 'Posting retur'}</button> : <span>-</span>,
          ])} empty="Belum ada retur pembelian." />
          <p className="sectionHelp">Retur baru membuat pemeriksaan outbound. Selesaikan pemeriksaan di Kontrol Operasional dahulu. Server menolak posting bila inspeksi belum lulus atau stok tidak cukup.</p>
        </Panel>
      </section>

      <Panel eyebrow="GUDANG" title="Transfer Stok Antar-Gudang" badge={loading ? 'memuat' : `${transfers.length} transfer`}>
        <Table loading={loading} head={['Nomor', 'Rute', 'Item', 'Tanggal', 'Status', 'Tindakan']} rows={transfers.map((t) => {
          const source = warehouseById.get(t.sourceWarehouseId); const destination = warehouseById.get(t.destinationWarehouseId);
          const itemText = t.items.map((item) => `${productById.get(item.productId)?.sku ?? item.productId}: ${item.receivedQty}/${item.shippedQty || item.quantity}`).join(', ');
          const actions: React.ReactNode[] = [];
          if (['DRAFT','REQUESTED'].includes(t.status)) actions.push(<button key="approve" type="button" className="secondary" disabled={Boolean(busyKey)} onClick={() => void transferAction(t, 'approve')}>Approve</button>);
          if (t.status === 'APPROVED') actions.push(<button key="ship" type="button" className="secondary" disabled={Boolean(busyKey)} onClick={() => void transferAction(t, 'ship')}>Ship</button>);
          if (['SHIPPED','PARTIALLY_RECEIVED'].includes(t.status)) actions.push(<button key="receive" type="button" className="secondary" disabled={Boolean(busyKey)} onClick={() => void transferAction(t, 'receive')}>Terima sisa</button>);
          return [<strong>{t.number}</strong>, `${source?.code ?? '?'} → ${destination?.code ?? '?'}`, <small>{itemText || '-'}</small>, tanggal(t.createdAt), <StatusChip status={t.status} />, <div className="rowActions">{actions.length ? actions : '-'}</div>];
        })} empty="Belum ada transfer." />
        <p className="sectionHelp">Ship mengurangi stok gudang asal dan memindahkannya ke in-transit. Receive menambah stok tujuan. Semua movement dan accounting event diposting server.</p>
      </Panel>

      <section className="grid2">
        <Panel eyebrow="LOCATION INVENTORY" title="Saldo Stok per Lokasi" badge={`${locationBalances.length} saldo`}>
          <div className="formStack">
            <label>Gudang<select value={locationWarehouseId} onChange={(e) => { setLocationWarehouseId(e.target.value); setRelocationForm((value) => ({ ...value, sourceLocationId:'', destinationLocationId:'' })); }}>{warehouses.map((w)=><option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label>
          </div>
          <Table head={['Lokasi','Produk','Qty','Reserved','Available']} rows={locationBalances.map((row)=>[`${row.location?.code ?? row.locationId}${row.location?.isDefault ? ' · DEFAULT' : ''}`,row.product ? `${row.product.sku} · ${row.product.name}` : row.productId,row.quantity,row.reserved,row.available])} empty="Belum ada saldo lokasi. Saldo gudang lama dimaterialisasi otomatis pada akses location-aware pertama." />
        </Panel>
        <Panel eyebrow="LOCATION MOVE" title="Relokasi Dalam Gudang" badge="aggregate tetap">
          <form className="formStack" onSubmit={relocateStock}>
            <label>Produk<select required value={relocationForm.productId} onChange={(e)=>setRelocationForm({...relocationForm,productId:e.target.value})}><option value="">Pilih produk</option>{products.map((p)=><option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}</select></label>
            <label>Lokasi asal<select required value={relocationForm.sourceLocationId} onChange={(e)=>setRelocationForm({...relocationForm,sourceLocationId:e.target.value})}><option value="">Pilih lokasi</option>{locationOptions.map((l)=><option key={l.id} value={l.id}>{l.code} · {l.name}</option>)}</select></label>
            <label>Lokasi tujuan<select required value={relocationForm.destinationLocationId} onChange={(e)=>setRelocationForm({...relocationForm,destinationLocationId:e.target.value})}><option value="">Pilih lokasi</option>{locationOptions.map((l)=><option key={l.id} value={l.id}>{l.code} · {l.name}</option>)}</select></label>
            <label>Jumlah<input type="number" min="1" step="1" value={relocationForm.quantity} onChange={(e)=>setRelocationForm({...relocationForm,quantity:Number(e.target.value)})}/></label>
            <label>Catatan<input value={relocationForm.notes} onChange={(e)=>setRelocationForm({...relocationForm,notes:e.target.value})}/></label>
            <button disabled={Boolean(busyKey)}>{busyKey==='location:relocate'?'Memindahkan…':'Relokasi stok'}</button>
          </form>
          <p className="sectionHelp">Relokasi hanya memindahkan saldo antar bin/lokasi. Quantity warehouse aggregate, accounting, dan nilai persediaan tidak berubah.</p>
        </Panel>
      </section>

      <section className="grid2">
        <Panel eyebrow="STOCK OPNAME" title="Mulai Penghitungan Fisik" badge="branch scoped">
          <form className="formStack" onSubmit={createOpname}>
            <label>Gudang<select required value={opnameWarehouseId} onChange={(e) => { setOpnameWarehouseId(e.target.value); setOpnameLocationId(''); }}>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label>
            <label>Lokasi <small>(kosong = seluruh gudang)</small><select value={opnameLocationId} onChange={(e)=>setOpnameLocationId(e.target.value)}><option value="">Seluruh gudang</option>{opnameLocationOptions.map((l)=><option key={l.id} value={l.id}>{l.code} · {l.name}{l.isDefault?' · DEFAULT':''}</option>)}</select></label>
            <button disabled={Boolean(busyKey)}>{busyKey === 'opname:create' ? 'Membuat…' : 'Mulai stock opname'}</button>
          </form>
          <p className="sectionHelp">Snapshot system quantity dibuat server. Setelah hitung fisik disimpan, submit dan approval akan membuat inventory movement serta jurnal selisih.</p>
        </Panel>

        <Panel eyebrow="GUDANG" title="Sesi Stock Opname" badge={loading ? 'memuat' : `${opnames.length} sesi`}>
          <Table loading={loading} head={['Nomor', 'Gudang', 'Dibuat', 'Status', 'Tindakan']} rows={opnames.map((o) => {
            const actions: React.ReactNode[] = [];
            if (o.status === 'COUNTING') actions.push(<button key="count" type="button" className="secondary" disabled={Boolean(busyKey)} onClick={() => editCounts(o)}>Hitung</button>);
            if (o.status === 'COUNTING' && o.items.length > 0 && o.items.every((item) => item.countedQty != null)) actions.push(<button key="submit" type="button" className="secondary" disabled={Boolean(busyKey)} onClick={() => void opnameAction(o, 'submit')}>Submit</button>);
            if (o.status === 'WAITING_APPROVAL') actions.push(<button key="complete" type="button" className="secondary" disabled={Boolean(busyKey)} onClick={() => void opnameAction(o, 'complete')}>Approve & posting</button>);
            return [<strong>{o.number}</strong>, warehouseById.get(o.warehouseId)?.code ?? '-', tanggal(o.createdAt), <StatusChip status={o.status} />, <div className="rowActions">{actions.length ? actions : '-'}</div>];
          })} empty="Belum ada stock opname." />
        </Panel>
      </section>

      {selectedOpname && selectedOpname.status === 'COUNTING' && <Panel eyebrow="PHYSICAL COUNT" title={`Hitung ${selectedOpname.number}`} badge={`${selectedOpname.items.length} item`}>
        {selectedOpname.items.length === 0 ? <p className="sectionHelp">Gudang belum memiliki inventory yang dapat dihitung.</p> : <div className="formStack">
          {selectedOpname.items.map((item) => <label key={item.id}>{productById.get(item.productId)?.name ?? item.productId} · sistem {item.systemQty}
            <input type="number" min="0" step="1" value={counts[item.id] ?? ''} onChange={(e) => setCounts((value) => ({ ...value, [item.id]: e.target.value }))} />
          </label>)}
          <div className="rowActions"><button type="button" disabled={Boolean(busyKey)} onClick={() => void saveCounts(selectedOpname)}>{busyKey === `opname:${selectedOpname.id}:count` ? 'Menyimpan…' : 'Simpan hitung fisik'}</button><button type="button" className="secondary" onClick={() => setSelectedOpnameId('')}>Tutup</button></div>
        </div>}
      </Panel>}

      {message && <div className="notice">{message}</div>}
    </>
  );
}
