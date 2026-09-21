'use client';
import { authFetch } from '../auth-fetch';
// Asset & Fleet operations: master aset, acquisition, maintenance, depreciation, vehicle, dan fuel.
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ErrorState, Panel, Skeleton, Table, StatusChip, rupiah, tanggal } from '../ui';
import DeliveryLifecycle from './delivery-lifecycle';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
type AssetCategory = { id: string; code: string; name: string; assetType: string; usefulLifeMonths?: number | null };
type Asset = { id: string; categoryId?: string; assetType?: string; code?: string; name: string; status?: string; acquisitionCost?: number | string; accumulatedDepreciation?: number | string; bookValue?: number | string; acquisitionDate?: string };
type Maintenance = { id: string; number?: string; status: string; assetId: string; scheduledAt?: string; completedAt?: string; estimatedCost?: number | string; actualCost?: number | string; asset?: { code?: string; name: string } };
type Vehicle = { id: string; assetId?: string | null; code: string; plateNumber?: string; vehicleType?: string; status?: string; currentOdometer?: number };
type Trip = { id: string; number: string; status: string; createdAt: string; codExpected?: number | string; codCollected?: number | string };
type Fuel = { id: string; vehicleId: string; liters: number | string; totalAmount: number | string; transactionDate: string; receiptNumber?: string | null };
type AssetSummary = { assetCount: number; activeAssetCount: number; acquisitionCost: number | string; accumulatedDepreciation: number | string; bookValue: number | string; maintenanceOpen: number };
type FleetSummary = { vehicleCount: number; availableVehicles: number; maintenanceVehicles: number; activeTrips: number; fuelTransactionCount: number; fuelLiters: number | string; fuelCost: number | string; codExpected: number | string; codCollected: number | string; codVariance: number | string };
type CursorResponse<T> = T[] | { items?: T[] };
function rowsOf<T>(value: CursorResponse<T>): T[] { return Array.isArray(value) ? value : value.items ?? []; }

export default function AssetsFleetView({ token }: { token: string }) {
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [fuelRows, setFuelRows] = useState<Fuel[]>([]);
  const [assetSummary, setAssetSummary] = useState<AssetSummary | null>(null);
  const [fleetSummary, setFleetSummary] = useState<FleetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [categoryForm, setCategoryForm] = useState({ code: '', name: '', assetType: 'EQUIPMENT', usefulLifeMonths: 60 });
  const [assetForm, setAssetForm] = useState({ categoryId: '', code: '', name: '', acquisitionCost: 0, paymentMode: 'CASH' });
  const [maintenanceForm, setMaintenanceForm] = useState({ assetId: '', maintenanceType: 'PREVENTIVE', priority: 'NORMAL', estimatedCost: 0, notes: '' });
  const [completeMaintenanceId, setCompleteMaintenanceId] = useState('');
  const [completeForm, setCompleteForm] = useState({ actualCost: 0, paymentMode: 'CASH', odometer: '', notes: '' });
  const [depreciation, setDepreciation] = useState(() => { const d = new Date(); const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const last = new Date(y,d.getMonth()+1,0).getDate(); return { periodStart: `${y}-${m}-01`, periodEnd: `${y}-${m}-${String(last).padStart(2,'0')}` }; });
  const [vehicleForm, setVehicleForm] = useState({ assetId: '', code: '', plateNumber: '', vehicleType: 'DELIVERY_VAN', currentOdometer: 0, fuelType: 'GASOLINE' });
  const [fuelForm, setFuelForm] = useState({ vehicleId: '', liters: 0, unitPrice: 0, odometer: '', receiptNumber: '', vendorName: '', paymentMode: 'CASH' });

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await authFetch(`${API}${path}`, token, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(Array.isArray(data?.message) ? data.message.join(', ') : data?.message ?? `HTTP ${response.status}`);
    return data as T;
  }

  async function refresh() {
    setLoading(true); setError('');
    try {
      const [cat, a, m, assetStats, v, t, f, fleetStats] = await Promise.all([
        api<AssetCategory[]>('/assets/categories'), api<CursorResponse<Asset>>('/assets'), api<CursorResponse<Maintenance>>('/assets/maintenances'), api<AssetSummary>('/assets/summary'),
        api<CursorResponse<Vehicle>>('/fleet/vehicles'), api<CursorResponse<Trip>>('/fleet/trips'), api<CursorResponse<Fuel>>('/fleet/fuel'), api<FleetSummary>('/fleet/summary'),
      ]);
      const assetRows = rowsOf(a); const vehicleRows = rowsOf(v);
      setCategories(cat); setAssets(assetRows); setMaintenances(rowsOf(m)); setAssetSummary(assetStats); setVehicles(vehicleRows); setTrips(rowsOf(t)); setFuelRows(rowsOf(f)); setFleetSummary(fleetStats);
      setAssetForm((x) => ({ ...x, categoryId: x.categoryId || cat[0]?.id || '' }));
      setMaintenanceForm((x) => ({ ...x, assetId: x.assetId || assetRows[0]?.id || '' }));
      setVehicleForm((x) => ({ ...x, assetId: x.assetId || assetRows.find((row) => row.assetType === 'VEHICLE')?.id || '' }));
      setFuelForm((x) => ({ ...x, vehicleId: x.vehicleId || vehicleRows[0]?.id || '' }));
    } catch (err) { setError(err instanceof Error ? err.message : 'Data aset dan armada gagal dimuat.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, [token]);

  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);

  async function run(key: string, work: () => Promise<string>) {
    if (busy) return;
    setBusy(key); setMessage('');
    try { setMessage(await work()); await refresh(); }
    catch (err) { setMessage(err instanceof Error ? err.message : 'Operasi Asset/Fleet gagal.'); }
    finally { setBusy(''); }
  }

  async function createCategory(e: FormEvent) { e.preventDefault(); await run('category', async () => {
    await api('/assets/categories', { method: 'POST', body: JSON.stringify(categoryForm) });
    setCategoryForm({ ...categoryForm, code: '', name: '' }); return 'Kategori aset berhasil dibuat.';
  }); }
  async function acquireAsset(e: FormEvent) { e.preventDefault(); await run('asset', async () => {
    const row = await api<Asset>('/assets', { method: 'POST', body: JSON.stringify({ ...assetForm, acquisitionCost: Number(assetForm.acquisitionCost) }) });
    setAssetForm((x) => ({ ...x, code: '', name: '', acquisitionCost: 0 })); return `Aset ${row.code ?? row.name} berhasil diperoleh dan jurnal perolehan diposting.`;
  }); }
  async function createMaintenance(e: FormEvent) { e.preventDefault(); await run('maintenance', async () => {
    const row = await api<Maintenance>('/assets/maintenance', { method: 'POST', body: JSON.stringify({ ...maintenanceForm, estimatedCost: Number(maintenanceForm.estimatedCost) }) });
    setMaintenanceForm((x) => ({ ...x, estimatedCost: 0, notes: '' })); return `Work order ${row.number ?? row.id} dibuat.`;
  }); }
  async function completeMaintenance(e: FormEvent) { e.preventDefault(); if (!completeMaintenanceId) return; await run('maintenance-complete', async () => {
    const payload = { actualCost: Number(completeForm.actualCost), paymentMode: completeForm.paymentMode, ...(completeForm.odometer ? { odometer: Number(completeForm.odometer) } : {}), notes: completeForm.notes || undefined };
    await api(`/assets/maintenance/${completeMaintenanceId}/complete`, { method: 'POST', body: JSON.stringify(payload) });
    setCompleteMaintenanceId(''); setCompleteForm({ actualCost: 0, paymentMode: 'CASH', odometer: '', notes: '' }); return 'Maintenance selesai; biaya, jurnal, dan odometer diposting server.';
  }); }
  async function runDepreciation(e: FormEvent) { e.preventDefault(); await run('depreciation', async () => {
    const result = await api<{ postedCount?: number }>('/assets/depreciation-runs', { method: 'POST', body: JSON.stringify(depreciation) }); return `Depresiasi periode diproses${result.postedCount != null ? ` untuk ${result.postedCount} aset` : ''}.`;
  }); }
  async function createVehicle(e: FormEvent) { e.preventDefault(); await run('vehicle', async () => {
    const row = await api<Vehicle>('/fleet/vehicles', { method: 'POST', body: JSON.stringify({ ...vehicleForm, assetId: vehicleForm.assetId || undefined, currentOdometer: Number(vehicleForm.currentOdometer) }) });
    setVehicleForm((x) => ({ ...x, code: '', plateNumber: '' })); return `Kendaraan ${row.code} dibuat.`;
  }); }
  async function recordFuel(e: FormEvent) { e.preventDefault(); await run('fuel', async () => {
    if (!fuelForm.receiptNumber.trim()) throw new Error('Nomor struk BBM wajib untuk idempotency/trace.');
    await api('/fleet/fuel', { method: 'POST', body: JSON.stringify({ vehicleId: fuelForm.vehicleId, liters: Number(fuelForm.liters), unitPrice: Number(fuelForm.unitPrice), ...(fuelForm.odometer ? { odometer: Number(fuelForm.odometer) } : {}), receiptNumber: fuelForm.receiptNumber.trim(), vendorName: fuelForm.vendorName || undefined, paymentMode: fuelForm.paymentMode }) });
    setFuelForm((x) => ({ ...x, liters: 0, unitPrice: 0, receiptNumber: '', vendorName: '' })); return 'Transaksi BBM dicatat dan jurnal biaya diposting.';
  }); }

  if (error) return <ErrorState message={`Data Asset/Fleet tidak dapat dimuat: ${error}`} />;
  return <>
    <section className="grid4">
      <Panel eyebrow="NILAI ASET" title={loading ? 'Memuat…' : rupiah(Number(assetSummary?.bookValue ?? 0))} badge={loading ? undefined : `${assetSummary?.activeAssetCount ?? 0} aktif`}>{loading ? <Skeleton rows={2}/> : <small>Perolehan {rupiah(Number(assetSummary?.acquisitionCost ?? 0))} · Akumulasi depresiasi {rupiah(Number(assetSummary?.accumulatedDepreciation ?? 0))}</small>}</Panel>
      <Panel eyebrow="MAINTENANCE" title={loading ? 'Memuat…' : `${assetSummary?.maintenanceOpen ?? 0} terbuka`} badge="work order"><small>Maintenance lifecycle dan parts diposting atomik.</small></Panel>
      <Panel eyebrow="ARMADA" title={loading ? 'Memuat…' : `${fleetSummary?.availableVehicles ?? 0}/${fleetSummary?.vehicleCount ?? 0} tersedia`} badge={`${fleetSummary?.activeTrips ?? 0} trip aktif`}><small>{fleetSummary?.maintenanceVehicles ?? 0} kendaraan maintenance.</small></Panel>
      <Panel eyebrow="BBM & COD" title={loading ? 'Memuat…' : rupiah(Number(fleetSummary?.fuelCost ?? 0))} badge={`${Number(fleetSummary?.fuelLiters ?? 0).toFixed(2)} L`}><small>COD variance {rupiah(Number(fleetSummary?.codVariance ?? 0))}.</small></Panel>
    </section>

    <section className="grid2">
      <Panel eyebrow="MASTER ASET" title="Kategori Aset"><form className="formStack" onSubmit={createCategory}><label>Kode<input required value={categoryForm.code} onChange={e=>setCategoryForm({...categoryForm,code:e.target.value})}/></label><label>Nama<input required value={categoryForm.name} onChange={e=>setCategoryForm({...categoryForm,name:e.target.value})}/></label><label>Tipe<select value={categoryForm.assetType} onChange={e=>setCategoryForm({...categoryForm,assetType:e.target.value})}>{['MOVABLE','IMMOVABLE','VEHICLE','LAND','BUILDING','EQUIPMENT','FURNITURE','IT','SOFTWARE','OTHER'].map(x=><option key={x}>{x}</option>)}</select></label><label>Umur manfaat (bulan)<input type="number" min="1" value={categoryForm.usefulLifeMonths} onChange={e=>setCategoryForm({...categoryForm,usefulLifeMonths:Number(e.target.value)})}/></label><button disabled={Boolean(busy)}>{busy==='category'?'Menyimpan…':'Buat kategori'}</button></form><Table head={['Kode','Nama','Tipe']} rows={categories.map(c=>[<strong>{c.code}</strong>,c.name,c.assetType])} empty="Belum ada kategori aset"/></Panel>
      <Panel eyebrow="PEROLEHAN" title="Daftarkan Aset"><form className="formStack" onSubmit={acquireAsset}><label>Kategori<select required value={assetForm.categoryId} onChange={e=>setAssetForm({...assetForm,categoryId:e.target.value})}>{categories.map(c=><option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></label><label>Kode aset<input required value={assetForm.code} onChange={e=>setAssetForm({...assetForm,code:e.target.value})}/></label><label>Nama aset<input required value={assetForm.name} onChange={e=>setAssetForm({...assetForm,name:e.target.value})}/></label><label>Biaya perolehan<input required type="number" min="0" value={assetForm.acquisitionCost} onChange={e=>setAssetForm({...assetForm,acquisitionCost:Number(e.target.value)})}/></label><label>Pembayaran<select value={assetForm.paymentMode} onChange={e=>setAssetForm({...assetForm,paymentMode:e.target.value})}><option>CASH</option><option>BANK</option><option>CREDIT</option></select></label><button disabled={Boolean(busy)}>{busy==='asset'?'Memposting…':'Catat perolehan aset'}</button></form></Panel>
    </section>

    <Panel eyebrow="ASET" title="Daftar Aset Perusahaan" badge={`${assets.length} aset`}><Table loading={loading} head={['Kode','Nama','Perolehan','Nilai Buku','Status']} rows={assets.map(a=>[<strong>{a.code??'-'}</strong>,a.name,rupiah(Number(a.acquisitionCost??0)),rupiah(Number(a.bookValue??0)),<StatusChip status={a.status??'ACTIVE'}/>])} empty="Belum ada aset terdaftar."/></Panel>

    <section className="grid2">
      <Panel eyebrow="MAINTENANCE" title="Buat Work Order"><form className="formStack" onSubmit={createMaintenance}><label>Aset<select required value={maintenanceForm.assetId} onChange={e=>setMaintenanceForm({...maintenanceForm,assetId:e.target.value})}>{assets.map(a=><option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label><label>Tipe maintenance<input required value={maintenanceForm.maintenanceType} onChange={e=>setMaintenanceForm({...maintenanceForm,maintenanceType:e.target.value})}/></label><label>Prioritas<select value={maintenanceForm.priority} onChange={e=>setMaintenanceForm({...maintenanceForm,priority:e.target.value})}><option>LOW</option><option>NORMAL</option><option>HIGH</option><option>CRITICAL</option></select></label><label>Estimasi biaya<input type="number" min="0" value={maintenanceForm.estimatedCost} onChange={e=>setMaintenanceForm({...maintenanceForm,estimatedCost:Number(e.target.value)})}/></label><label>Catatan<input value={maintenanceForm.notes} onChange={e=>setMaintenanceForm({...maintenanceForm,notes:e.target.value})}/></label><button disabled={Boolean(busy)}>{busy==='maintenance'?'Membuat…':'Buat work order'}</button></form></Panel>
      <Panel eyebrow="DEPRECIATION" title="Run Depresiasi"><form className="formStack" onSubmit={runDepreciation}><label>Awal periode<input type="date" required value={depreciation.periodStart} onChange={e=>setDepreciation({...depreciation,periodStart:e.target.value})}/></label><label>Akhir periode<input type="date" required value={depreciation.periodEnd} onChange={e=>setDepreciation({...depreciation,periodEnd:e.target.value})}/></label><button disabled={Boolean(busy)}>{busy==='depreciation'?'Memposting…':'Jalankan depresiasi'}</button></form><p className="sectionHelp">Server mencegah double-post periode yang sama dan menghormati fiscal-period lock.</p></Panel>
    </section>

    <Panel eyebrow="MAINTENANCE" title="Jadwal & Riwayat Maintenance" badge={`${maintenances.length} record`}><Table loading={loading} head={['Nomor','Aset','Jadwal/Selesai','Biaya','Status','Aksi']} rows={maintenances.map(m=>[<strong>{m.number??'-'}</strong>,assetById.get(m.assetId)?.name??m.asset?.name??'-',m.completedAt?tanggal(m.completedAt):m.scheduledAt?tanggal(m.scheduledAt):'-',rupiah(Number(m.actualCost??m.estimatedCost??0)),<StatusChip status={m.status}/>,!['COMPLETED','CANCELLED'].includes(m.status)?<button type="button" className="secondary" onClick={()=>{setCompleteMaintenanceId(m.id);setCompleteForm(x=>({...x,actualCost:Number(m.estimatedCost??0)}));}}>Selesaikan</button>:'-'])} empty="Belum ada maintenance."/></Panel>
    {completeMaintenanceId && <Panel eyebrow="MAINTENANCE COMPLETION" title={`Selesaikan ${maintenances.find(m=>m.id===completeMaintenanceId)?.number??''}`}><form className="formStack" onSubmit={completeMaintenance}><label>Biaya aktual<input required type="number" min="0" value={completeForm.actualCost} onChange={e=>setCompleteForm({...completeForm,actualCost:Number(e.target.value)})}/></label><label>Pembayaran<select value={completeForm.paymentMode} onChange={e=>setCompleteForm({...completeForm,paymentMode:e.target.value})}><option>CASH</option><option>BANK</option><option>CREDIT</option></select></label><label>Odometer (bila kendaraan)<input type="number" min="0" value={completeForm.odometer} onChange={e=>setCompleteForm({...completeForm,odometer:e.target.value})}/></label><label>Catatan<input value={completeForm.notes} onChange={e=>setCompleteForm({...completeForm,notes:e.target.value})}/></label><div className="rowActions"><button disabled={Boolean(busy)}>{busy==='maintenance-complete'?'Memposting…':'Selesaikan & posting'}</button><button type="button" className="secondary" onClick={()=>setCompleteMaintenanceId('')}>Batal</button></div></form></Panel>}

    <section className="grid2">
      <Panel eyebrow="ARMADA" title="Daftarkan Kendaraan"><form className="formStack" onSubmit={createVehicle}><label>Aset kendaraan (opsional)<select value={vehicleForm.assetId} onChange={e=>setVehicleForm({...vehicleForm,assetId:e.target.value})}><option value="">Tanpa link aset</option>{assets.filter(a=>a.assetType==='VEHICLE').map(a=><option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label><label>Kode<input required value={vehicleForm.code} onChange={e=>setVehicleForm({...vehicleForm,code:e.target.value})}/></label><label>Plat<input required value={vehicleForm.plateNumber} onChange={e=>setVehicleForm({...vehicleForm,plateNumber:e.target.value})}/></label><label>Tipe<input required value={vehicleForm.vehicleType} onChange={e=>setVehicleForm({...vehicleForm,vehicleType:e.target.value})}/></label><label>Odometer awal<input type="number" min="0" value={vehicleForm.currentOdometer} onChange={e=>setVehicleForm({...vehicleForm,currentOdometer:Number(e.target.value)})}/></label><label>Bahan bakar<input value={vehicleForm.fuelType} onChange={e=>setVehicleForm({...vehicleForm,fuelType:e.target.value})}/></label><button disabled={Boolean(busy)}>{busy==='vehicle'?'Membuat…':'Buat kendaraan'}</button></form></Panel>
      <Panel eyebrow="BBM" title="Catat Pengisian BBM"><form className="formStack" onSubmit={recordFuel}><label>Kendaraan<select required value={fuelForm.vehicleId} onChange={e=>setFuelForm({...fuelForm,vehicleId:e.target.value})}>{vehicles.map(v=><option key={v.id} value={v.id}>{v.code} · {v.plateNumber}</option>)}</select></label><label>Liter<input required type="number" min="0.001" step="0.001" value={fuelForm.liters} onChange={e=>setFuelForm({...fuelForm,liters:Number(e.target.value)})}/></label><label>Harga/liter<input required type="number" min="0" value={fuelForm.unitPrice} onChange={e=>setFuelForm({...fuelForm,unitPrice:Number(e.target.value)})}/></label><label>Odometer<input type="number" min="0" value={fuelForm.odometer} onChange={e=>setFuelForm({...fuelForm,odometer:e.target.value})}/></label><label>Nomor struk<input required value={fuelForm.receiptNumber} onChange={e=>setFuelForm({...fuelForm,receiptNumber:e.target.value})}/></label><label>SPBU/Vendor<input value={fuelForm.vendorName} onChange={e=>setFuelForm({...fuelForm,vendorName:e.target.value})}/></label><label>Pembayaran<select value={fuelForm.paymentMode} onChange={e=>setFuelForm({...fuelForm,paymentMode:e.target.value})}><option>CASH</option><option>BANK</option><option>CREDIT</option></select></label><button disabled={Boolean(busy)}>{busy==='fuel'?'Memposting…':'Catat BBM'}</button></form></Panel>
    </section>

    <section className="grid2"><Panel eyebrow="ARMADA" title="Kendaraan" badge={`${vehicles.length} unit`}><Table loading={loading} head={['Kode','Plat','Odometer','Status']} rows={vehicles.map(v=>[<strong>{v.code}</strong>,v.plateNumber??'-',`${Number(v.currentOdometer??0).toLocaleString('id-ID')} km`,<StatusChip status={v.status??'AVAILABLE'}/>])} empty="Belum ada kendaraan."/></Panel><Panel eyebrow="DELIVERY" title="Delivery Trips" badge={`${trips.length} trip`}><Table loading={loading} head={['Nomor','Dibuat','COD','Status']} rows={trips.map(t=>[<strong>{t.number}</strong>,tanggal(t.createdAt),`${rupiah(Number(t.codCollected??0))} / ${rupiah(Number(t.codExpected??0))}`,<StatusChip status={t.status}/>])} empty="Belum ada trip pengiriman."/></Panel></section>
    <Panel eyebrow="FUEL LEDGER" title="Riwayat BBM" badge={`${fuelRows.length} transaksi`}><Table head={['Tanggal','Kendaraan','Liter','Nilai','Receipt']} rows={fuelRows.slice(0,30).map(f=>[tanggal(f.transactionDate),vehicleById.get(f.vehicleId)?.code??'-',Number(f.liters).toFixed(2),rupiah(Number(f.totalAmount)),f.receiptNumber??'-'])} empty="Belum ada transaksi BBM."/></Panel>
    <DeliveryLifecycle token={token}/>
    {message&&<div className="notice">{message}</div>}
  </>;
}
