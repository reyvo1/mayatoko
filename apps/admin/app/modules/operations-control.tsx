'use client';
import { authFetch } from '../auth-fetch';
// Modul Operations Control — inspeksi, gate pass, approval konfirmasi.
import { useEffect, useState } from 'react';
import { Panel, Table, StatusChip, tanggal } from '../ui';

type OperationsControlMode = 'inspections' | 'evidence' | 'gate-pass';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type InspectionResult = { templateItemId?: string | null; code: string; label: string; result: string; productId?: string | null; expectedQty?: number | null; scannedQty?: number | null; acceptedQty?: number | null; rejectedQty?: number | null; damagedQty?: number | null; missingQty?: number | null; extraQty?: number | null; notes?: string | null };
type InspectionEvidence = { id: string; evidenceType: string; storageKey: string; sha256?: string | null };
type Inspection = { id: string; number: string; type: string; sourceType: string; sourceId: string; status: string; createdAt: string; results: InspectionResult[]; evidence: InspectionEvidence[] };
type GatePass = { id: string; number: string; direction?: string; status?: string; createdAt: string };

export default function OperationsControlView({ token, mode = 'inspections' }: { token: string; mode?: OperationsControlMode }) {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [gatePasses, setGatePasses] = useState<GatePass[]>([]);
  const [message, setMessage] = useState('');
  const [evidenceInspectionId, setEvidenceInspectionId] = useState('');
  const [barcodeValue, setBarcodeValue] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await authFetch(`${API}${path}`, token, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Permintaan gagal.');
    return data as T;
  }

  async function refresh() {
    try {
      const [ins, gp] = await Promise.all([
        api<{ items?: Inspection[] } | Inspection[]>('/operations-control/inspections?limit=15'),
        api<{ items?: GatePass[] } | GatePass[]>('/operations-control/gate-passes?limit=15'),
      ]);
      setInspections(Array.isArray(ins) ? ins : ins.items ?? []);
      setGatePasses(Array.isArray(gp) ? gp : gp.items ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sebagian data operasional kontrol gagal dimuat.');
    }
  }

  useEffect(() => { void refresh(); }, [token]);

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Gagal membaca file evidence.'));
      reader.onload = () => {
        const value = String(reader.result ?? '');
        const comma = value.indexOf(',');
        resolve(comma >= 0 ? value.slice(comma + 1) : value);
      };
      reader.readAsDataURL(file);
    });
  }

  function updateInspectionResult(inspectionId: string, code: string, patch: Partial<InspectionResult>) {
    setInspections((current) => current.map((inspection) => inspection.id !== inspectionId
      ? inspection
      : { ...inspection, results: inspection.results.map((row) => row.code === code ? { ...row, ...patch } : row) }));
  }

  function setChecklistResult(inspectionId: string, code: string, result: 'PASS' | 'FAIL' | 'OBSERVATION') {
    updateInspectionResult(inspectionId, code, { result });
  }

  const selectedInspection = inspections.find((inspection) => inspection.id === evidenceInspectionId);

  async function uploadBarcode() {
    if (!evidenceInspectionId || !barcodeValue.trim()) return setMessage('Pilih inspeksi dan isi barcode terlebih dahulu.');
    setMessage('');
    try {
      await api(`/operations-control/inspections/${evidenceInspectionId}/evidence`, {
        method: 'POST', body: JSON.stringify({ evidenceType: 'BARCODE', value: barcodeValue.trim(), metadata: { source: 'admin-operations-control' } }),
      });
      setBarcodeValue('');
      setMessage('Barcode evidence tersimpan dan diverifikasi server.');
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal menyimpan barcode evidence.'); }
  }

  async function uploadPhoto() {
    if (!evidenceInspectionId || !photoFile) return setMessage('Pilih inspeksi dan foto evidence terlebih dahulu.');
    setMessage('');
    try {
      const dataBase64 = await fileToBase64(photoFile);
      await api(`/operations-control/inspections/${evidenceInspectionId}/evidence`, {
        method: 'POST', body: JSON.stringify({ evidenceType: 'PHOTO', mimeType: photoFile.type, dataBase64, metadata: { fileName: photoFile.name, source: 'admin-operations-control' } }),
      });
      setPhotoFile(null);
      setMessage('Foto evidence tersimpan, di-hash, dan diverifikasi server.');
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal mengunggah foto evidence.'); }
  }

  async function completeInspection(inspection: Inspection) {
    setMessage('');
    try {
      await api(`/operations-control/inspections/${inspection.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          results: inspection.results.map((row) => ({
            templateItemId: row.templateItemId ?? undefined,
            code: row.code,
            label: row.label,
            result: row.result,
            productId: row.productId ?? undefined,
            expectedQty: row.expectedQty ?? undefined,
            scannedQty: row.scannedQty ?? undefined,
            acceptedQty: row.acceptedQty ?? undefined,
            rejectedQty: row.rejectedQty ?? undefined,
            damagedQty: row.damagedQty ?? undefined,
            missingQty: row.missingQty ?? undefined,
            extraQty: row.extraQty ?? undefined,
            notes: row.notes ?? undefined,
          })),
          notes: inspection.sourceType === 'Shipment' ? 'Finalisasi pemeriksaan outbound sesuai manifest shipment.' : ['SaleReturn','OrderReturn'].includes(inspection.sourceType) ? 'Finalisasi pemeriksaan barang retur pelanggan sebelum refund.' : inspection.sourceType === 'PurchaseReturn' ? 'Finalisasi pemeriksaan retur pembelian sebelum dikirim kembali.' : 'Finalisasi hasil penerimaan yang tercatat pada Goods Receipt.',
        }),
      });
      setMessage('Inspeksi selesai. Lakukan persetujuan jika diperlukan sebelum proses operasional berikutnya.');
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal menyelesaikan inspeksi.'); }
  }

  async function approveInspection(inspection: Inspection) {
    setMessage('');
    try {
      await api(`/operations-control/inspections/${inspection.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ notes: 'Selisih penerimaan ditinjau dan disetujui dari Kontrol Operasional.' }),
      });
      setMessage('Inspeksi disetujui. Dokumen sumber sekarang dapat dilanjutkan sesuai policy.');
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal menyetujui inspeksi.'); }
  }

  return (
    <>
      <section className="grid2">
        {mode === 'inspections' && <Panel eyebrow="KUALITAS" title="Inspeksi Barang" badge={`${inspections.length} record`}>
          <Table
            head={['Nomor', 'Jenis', 'Evidence', 'Dibuat', 'Status', 'Tindakan']}
            rows={inspections.map((i) => [
              <strong>{i.number}</strong>,
              <><span>{i.type}</span><small style={{ display: 'block', color: 'var(--muted)' }}>{i.sourceType}</small></>,
              <small>{i.evidence?.filter((e) => e.evidenceType === 'PHOTO').length ?? 0} foto · {i.evidence?.filter((e) => e.evidenceType === 'BARCODE').length ?? 0} scan</small>,
              tanggal(i.createdAt),
              <StatusChip status={i.status} />,
              ['GoodsReceipt','Shipment','SaleReturn','OrderReturn','PurchaseReturn'].includes(i.sourceType) && i.status === 'IN_PROGRESS'
                ? <button type="button" className="secondary" onClick={() => void completeInspection(i)}>Finalisasi</button>
                : ['GoodsReceipt','Shipment','SaleReturn','OrderReturn','PurchaseReturn'].includes(i.sourceType) && ['PASSED','PARTIAL','FAILED','REVIEW_REQUIRED'].includes(i.status)
                  ? <button type="button" className="secondary" onClick={() => void approveInspection(i)}>{i.status === 'FAILED' ? 'Tolak hasil' : 'Setujui'}</button>
                  : <span>-</span>,
            ])}
            empty="Belum ada inspeksi. Inspeksi dibuat otomatis untuk penerimaan dan fulfillment."
          />
        </Panel>}
        {mode === 'evidence' && <Panel eyebrow="EVIDENCE" title="Foto & Barcode Operasional" badge="server verified">
          <label>Inspeksi aktif
            <select value={evidenceInspectionId} onChange={(e) => setEvidenceInspectionId(e.target.value)}>
              <option value="">Pilih inspeksi penerimaan / shipment</option>
              {inspections.filter((i) => ['GoodsReceipt','Shipment','SaleReturn','OrderReturn','PurchaseReturn'].includes(i.sourceType) && i.status === 'IN_PROGRESS').map((i) => <option key={i.id} value={i.id}>{i.number} · {i.sourceType}</option>)}
            </select>
          </label>
          {selectedInspection && selectedInspection.results.filter((row) => !row.productId).length > 0 && (
            <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
              <strong>Checklist inspeksi</strong>
              {selectedInspection.results.filter((row) => !row.productId).map((row) => (
                <label key={row.code}>{row.label}
                  <select value={row.result} onChange={(e) => setChecklistResult(selectedInspection.id, row.code, e.target.value as 'PASS' | 'FAIL' | 'OBSERVATION')}>
                    <option value="OBSERVATION">Belum diputuskan</option>
                    <option value="PASS">PASS</option>
                    <option value="FAIL">FAIL</option>
                  </select>
                </label>
              ))}
            </div>
          )}
          {selectedInspection && selectedInspection.results.some((row) => row.productId) && (
            <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
              <small>Scan produk: {selectedInspection.results.filter((row) => row.productId).map((row) => `${row.label} ${row.scannedQty ?? 0}/${row.expectedQty ?? 0}`).join(' · ')}</small>
              {selectedInspection.sourceType === 'OrderReturn' && selectedInspection.results.filter((row) => row.productId).map((row) => <div key={row.code} className="receipt">
                <div><strong>{row.label}</strong><small style={{ display: 'block' }}>expected {row.expectedQty ?? 0} · scanned {row.scannedQty ?? 0}</small></div>
                <select value={row.result} onChange={(e) => { const result = e.target.value as 'PASS' | 'FAIL' | 'OBSERVATION'; const expected = row.expectedQty ?? 0; updateInspectionResult(selectedInspection.id, row.code, result === 'PASS' ? { result, acceptedQty: expected, rejectedQty: 0, damagedQty: 0, missingQty: 0, extraQty: 0 } : result === 'FAIL' ? { result, acceptedQty: 0, rejectedQty: expected, damagedQty: 0, missingQty: 0, extraQty: 0 } : { result }); }}>
                  <option value="OBSERVATION">Belum diputuskan</option><option value="PASS">PASS · layak restock</option><option value="FAIL">FAIL · jangan restock</option>
                </select>
              </div>)}
            </div>
          )}
          <label>Scan barcode / SKU
            <input value={barcodeValue} onChange={(e) => setBarcodeValue(e.target.value)} placeholder="Scan atau ketik barcode" />
          </label>
          <button type="button" className="secondary" onClick={() => void uploadBarcode()}>Simpan barcode</button>
          <label style={{ marginTop: 12 }}>Foto evidence
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
          </label>
          <button type="button" className="secondary" onClick={() => void uploadPhoto()}>Unggah foto</button>
          <small style={{ display: 'block', color: 'var(--muted)', marginTop: 10 }}>Finalisasi inspeksi hanya dapat dilakukan bila policy evidence sudah terpenuhi.</small>
        </Panel>}
        {mode === 'gate-pass' && <Panel eyebrow="GATE CONTROL" title="Gate Pass Masuk / Keluar" badge={`${gatePasses.length} pass`}>
          <Table
            head={['Nomor', 'Arah', 'Dibuat', 'Status']}
            rows={gatePasses.map((g) => [
              <strong>{g.number}</strong>,
              g.direction ?? '-',
              tanggal(g.createdAt),
              <StatusChip status={g.status ?? '-'} />,
            ])}
            empty="Belum ada gate pass."
          />
        </Panel>}
      </section>
      {message && <div className="notice">{message}</div>}
    </>
  );
}
