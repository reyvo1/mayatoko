'use client';
import { authFetch } from '../auth-fetch';
// Modul HR & Payroll — karyawan, periode, payroll run, pembayaran, dan kewajiban payroll.
import { useEffect, useMemo, useState } from 'react';
import { Panel, Table, StatusChip, rupiah, tanggal } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type Employee = { id: string; employeeNumber: string; fullName: string; isActive?: boolean };
type PayrollPeriod = { id: string; code: string; year: number; month: number; startDate: string; endDate: string; status: string };
type RuleSet = { id: string; code: string; name: string; version: number; status: string; effectiveFrom: string };
type PayrollRun = {
  id: string; number: string; status: string; payrollPeriodId: string; taxRuleSetId?: string | null; socialSecurityRuleSetId?: string | null;
  employeeCount: number; grossTotal: string | number; deductionTotal: string | number; taxTotal: string | number; employerContributionTotal: string | number; netTotal: string | number; createdAt: string;
  adjustmentOfRunId?: string | null; adjustmentSequence?: number; adjustmentReason?: string | null; adjustmentPostingDate?: string | null;
};
type PayrollResult = { id: string; employeeId: string; status: string; grossPay: string | number; taxableIncome: string | number; incomeTax: string | number; employeeContribution: string | number; netPay: string | number };
type PayrollPayment = { id: string; employeeId: string; amount: string | number; status: string; paymentMethod: string; direction?: 'OUTBOUND' | 'RECOVERY' | string; settlementAccountCode?: string | null; paidAt?: string | null };
type LiabilityBucket = { recognized: string; paid: string; pending: string; outstanding: string; availableToPay?: string };
type PayrollLiability = { payrollRunId: string; number: string; status: string; salary: LiabilityBucket; tax: LiabilityBucket; socialAndOther: LiabilityBucket; recovery?: LiabilityBucket };
type LeaveRequest = { id: string; employeeId: string; leaveTypeId: string; startDate: string; endDate: string; totalDays: string | number; reason?: string | null; status: string; createdAt: string };
type OvertimeRequest = { id: string; employeeId: string; requestedStart: string; requestedEnd: string; approvedMinutes?: number | null; reason?: string | null; status: string; createdAt: string };
type LeaveType = { id: string; code: string; name: string; annualQuota?: string | number | null };

function monthParts(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const mm = String(month).padStart(2, '0');
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { year, month, mm, startDate: `${year}-${mm}-01`, endDate: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` };
}

function requestKey(prefix: string, id: string, account: string) {
  return `${prefix}:${id}:${account}`;
}

export default function HrPayrollView({ token }: { token: string }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [taxRules, setTaxRules] = useState<RuleSet[]>([]);
  const [socialRules, setSocialRules] = useState<RuleSet[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [results, setResults] = useState<PayrollResult[]>([]);
  const [payments, setPayments] = useState<PayrollPayment[]>([]);
  const [liabilities, setLiabilities] = useState<PayrollLiability[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [selectedRunId, setSelectedRunId] = useState('');
  const [selectedTaxRuleId, setSelectedTaxRuleId] = useState('');
  const [selectedSocialRuleId, setSelectedSocialRuleId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [settleTarget, setSettleTarget] = useState<PayrollPayment | null>(null);
  const [settlementReference, setSettlementReference] = useState('');
  const [adjustmentSource, setAdjustmentSource] = useState<PayrollRun | null>(null);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentPostingDate, setAdjustmentPostingDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [cancelTarget, setCancelTarget] = useState<PayrollRun | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await authFetch(`${API}${path}`, token, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Permintaan gagal.');
    return data as T;
  }

  async function refreshCore() {
    const now = monthParts();
    const [emp, periodData, runData, taxData, socialData, liabilityData, leaveTypeData, leaveData, overtimeData] = await Promise.all([
      api<Employee[] | { items?: Employee[] }>('/hr/employees?limit=100'),
      api<PayrollPeriod[]>(`/payroll/periods?year=${now.year}`),
      api<PayrollRun[]>('/payroll/runs'),
      api<RuleSet[]>('/payroll/tax-rule-sets'),
      api<RuleSet[]>('/payroll/social-security-rule-sets'),
      api<PayrollLiability[]>('/payroll/liabilities'),
      api<LeaveType[]>('/hr/leave-types'),
      api<LeaveRequest[]>('/hr/leave-requests'),
      api<OvertimeRequest[]>('/hr/overtime-requests'),
    ]);
    const employeeRows = Array.isArray(emp) ? emp : emp.items ?? [];
    setEmployees(employeeRows);
    setPeriods(periodData);
    setRuns(runData);
    setTaxRules(taxData);
    setSocialRules(socialData);
    setLiabilities(liabilityData);
    setLeaveTypes(leaveTypeData);
    setLeaveRequests(leaveData);
    setOvertimeRequests(overtimeData);
    const currentPeriod = periodData.find((p) => p.year === now.year && p.month === now.month) ?? periodData[0];
    setSelectedPeriodId((current) => current || currentPeriod?.id || '');
    const firstRun = runData[0];
    setSelectedRunId((current) => current || firstRun?.id || '');
    const approvedTax = taxData.find((r) => r.status === 'APPROVED');
    const approvedSocial = socialData.find((r) => r.status === 'APPROVED');
    setSelectedTaxRuleId((current) => current || approvedTax?.id || '');
    setSelectedSocialRuleId((current) => current || approvedSocial?.id || '');
  }

  async function refreshRun(runId: string) {
    if (!runId) { setResults([]); setPayments([]); return; }
    const [resultData, paymentData] = await Promise.all([
      api<PayrollResult[]>(`/payroll/runs/${runId}/results`),
      api<PayrollPayment[]>(`/payroll/runs/${runId}/payments`),
    ]);
    setResults(resultData);
    setPayments(paymentData);
  }

  async function refreshAll(runId = selectedRunId) {
    await refreshCore();
    if (runId) await refreshRun(runId);
  }

  useEffect(() => {
    refreshCore().catch((error) => setMessage(error instanceof Error ? error.message : 'Gagal memuat HR/Payroll.'));
  }, [token]);

  useEffect(() => {
    refreshRun(selectedRunId).catch((error) => setMessage(error instanceof Error ? error.message : 'Gagal memuat detail payroll.'));
  }, [selectedRunId, token]);

  const selectedRun = runs.find((run) => run.id === selectedRunId);
  const selectedLiability = liabilities.find((row) => row.payrollRunId === (selectedRun?.adjustmentOfRunId ?? selectedRunId));
  const employeeById = useMemo(() => new Map(employees.map((row) => [row.id, row])), [employees]);
  const current = monthParts();

  async function action(work: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await work(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Operasi payroll gagal.'); }
    finally { setBusy(false); }
  }

  async function ensureCurrentPeriod() {
    await action(async () => {
      const existing = periods.find((p) => p.year === current.year && p.month === current.month);
      if (existing) { setSelectedPeriodId(existing.id); setMessage(`Periode ${existing.code} sudah tersedia.`); return; }
      const created = await api<PayrollPeriod>('/payroll/periods', {
        method: 'POST',
        body: JSON.stringify({ code: `PAY-${current.year}-${current.mm}`, year: current.year, month: current.month, startDate: current.startDate, endDate: current.endDate }),
      });
      setSelectedPeriodId(created.id);
      setMessage(`Periode ${created.code} berhasil dibuat.`);
      await refreshCore();
    });
  }

  async function createRun() {
    await action(async () => {
      if (!selectedPeriodId) throw new Error('Pilih/buat periode payroll terlebih dahulu.');
      if (!selectedTaxRuleId) throw new Error('Belum ada tax rule APPROVED. Import/verifikasi tarif resmi lalu approve rule sebelum menghitung payroll.');
      const created = await api<PayrollRun>('/payroll/runs', {
        method: 'POST',
        body: JSON.stringify({ payrollPeriodId: selectedPeriodId, taxRuleSetId: selectedTaxRuleId, socialSecurityRuleSetId: selectedSocialRuleId || undefined }),
      });
      setSelectedRunId(created.id);
      setMessage(`Payroll run ${created.number} siap diproses.`);
      await refreshAll(created.id);
    });
  }

  async function createAdjustmentRun() {
    if (!adjustmentSource) return;
    await action(async () => {
      const reason = adjustmentReason.trim();
      if (reason.length < 5) throw new Error('Alasan adjustment minimal 5 karakter agar audit trail jelas.');
      const created = await api<PayrollRun>(`/payroll/runs/${adjustmentSource.id}/adjustments`, {
        method: 'POST',
        body: JSON.stringify({ reason, postingDate: adjustmentPostingDate || undefined }),
      });
      setAdjustmentSource(null); setAdjustmentReason('');
      setSelectedRunId(created.id);
      setMessage(`Adjustment ${created.number} dibuat dari ${adjustmentSource.number}. Hitung hanya selisihnya lalu review sebelum posting.`);
      await refreshAll(created.id);
    });
  }

  async function cancelPayrollRun() {
    if (!cancelTarget) return;
    await action(async () => {
      const reason = cancelReason.trim();
      if (reason.length < 5) throw new Error('Alasan pembatalan minimal 5 karakter.');
      await api(`/payroll/runs/${cancelTarget.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
      const label = cancelTarget.adjustmentOfRunId ? 'Adjustment' : 'Payroll run';
      setCancelTarget(null); setCancelReason('');
      setMessage(`${label} ${cancelTarget.number} dibatalkan sebelum posting. Riwayat audit tetap disimpan.`);
      await refreshAll(selectedRunId);
    });
  }

  async function runStep(path: string, success: string) {
    if (!selectedRunId) return;
    await action(async () => {
      await api(path, { method: 'POST' });
      setMessage(success);
      await refreshAll(selectedRunId);
    });
  }

  async function lockAttendance() {
    if (!selectedRun) return;
    await action(async () => {
      await api(`/payroll/periods/${selectedRun.payrollPeriodId}/lock-attendance`, { method: 'POST' });
      setMessage('Absensi periode berhasil dikunci untuk branch ini.');
      await refreshAll(selectedRunId);
    });
  }

  async function settleSalary(payment: PayrollPayment, externalReference: string) {
    const reference = externalReference.trim();
    if (!reference) { setMessage('Pembayaran belum dikonfirmasi: referensi transfer bank wajib diisi.'); return; }
    await action(async () => {
      await api(`/payroll/payments/${payment.id}/settle`, {
        method: 'POST',
        body: JSON.stringify({ settlementAccountCode: '1102', paymentMethod: 'BANK_TRANSFER', externalReference: reference }),
      });
      setMessage(payment.direction === 'RECOVERY' ? 'Penerimaan recovery dikonfirmasi dan Piutang Karyawan berkurang.' : 'Transfer bank dikonfirmasi dan jurnal pelunasan Utang Gaji terbentuk.');
      setSettleTarget(null); setSettlementReference('');
      await refreshAll(selectedRunId);
    });
  }

  async function createLiabilityDraft(accountCode: '2103' | '2104', amount: number) {
    if (!selectedRun || amount <= 0) return;
    await action(async () => {
      await api('/finance-operations', {
        method: 'POST',
        body: JSON.stringify({
          type: 'PAYROLL_LIABILITY_PAYMENT',
          description: accountCode === '2103' ? `Pelunasan PPh payroll ${selectedRun.number}` : `Pelunasan BPJS/potongan payroll ${selectedRun.number}`,
          amount,
          debitAccountCode: accountCode,
          creditAccountCode: '1102',
          paymentMethod: 'BANK_TRANSFER',
          referenceType: 'PayrollRun',
          referenceId: selectedRun.id,
          idempotencyKey: requestKey('payroll-liability', selectedRun.id, accountCode),
        }),
      });
      setMessage('Draft settlement kewajiban payroll dibuat. Posting final dilakukan dari menu Akuntansi setelah pembayaran eksternal benar-benar dilakukan.');
      await refreshAll(selectedRunId);
    });
  }


  async function reviewLeaveRequest(id: string, status: 'APPROVED' | 'REJECTED') {
    await action(async () => {
      await api(`/hr/leave-requests/${id}/review`, { method: 'POST', body: JSON.stringify({ status }) });
      setMessage(status === 'APPROVED' ? 'Pengajuan cuti disetujui.' : 'Pengajuan cuti ditolak.');
      await refreshCore();
    });
  }

  async function reviewOvertimeRequest(row: OvertimeRequest, status: 'APPROVED' | 'REJECTED') {
    await action(async () => {
      const requestedMinutes = Math.round((new Date(row.requestedEnd).getTime() - new Date(row.requestedStart).getTime()) / 60000);
      await api(`/hr/overtime-requests/${row.id}/review`, { method: 'POST', body: JSON.stringify({ status, ...(status === 'APPROVED' ? { approvedMinutes: requestedMinutes } : {}) }) });
      setMessage(status === 'APPROVED' ? 'Pengajuan lembur disetujui.' : 'Pengajuan lembur ditolak.');
      await refreshCore();
    });
  }

  return (
    <>
      <section className="grid2">
        <Panel eyebrow="HRIS" title="Daftar Karyawan" badge={`${employees.length} orang`}>
          <Table head={['NIP', 'Nama', 'Status']} rows={employees.map((e) => [<strong>{e.employeeNumber}</strong>, e.fullName, <StatusChip status={e.isActive === false ? 'NONAKTIF' : 'AKTIF'} />])} empty="Belum ada karyawan." />
        </Panel>
        <Panel eyebrow="PAYROLL CONTROL" title="Periode & Run" badge={`${runs.length} run`}>
          <div style={{ display: 'grid', gap: 10 }}>
            <label>Periode
              <select value={selectedPeriodId} onChange={(e) => setSelectedPeriodId(e.target.value)}>
                <option value="">Pilih periode</option>
                {periods.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.status}</option>)}
              </select>
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="secondary" disabled={busy} onClick={() => void ensureCurrentPeriod()}>Buat periode bulan ini</button>
              <button type="button" disabled={busy || !selectedPeriodId} onClick={() => void createRun()}>+ Buat Payroll Run</button>
            </div>
            <label>Tax rule APPROVED
              <select value={selectedTaxRuleId} onChange={(e) => setSelectedTaxRuleId(e.target.value)}>
                <option value="">Belum tersedia</option>
                {taxRules.filter((r) => r.status === 'APPROVED').map((r) => <option key={r.id} value={r.id}>{r.name} v{r.version}</option>)}
              </select>
            </label>
            <label>Social/BPJS rule APPROVED
              <select value={selectedSocialRuleId} onChange={(e) => setSelectedSocialRuleId(e.target.value)}>
                <option value="">Tidak digunakan / belum tersedia</option>
                {socialRules.filter((r) => r.status === 'APPROVED').map((r) => <option key={r.id} value={r.id}>{r.name} v{r.version}</option>)}
              </select>
            </label>
            {taxRules.some((r) => r.status === 'DRAFT') && !taxRules.some((r) => r.status === 'APPROVED') && <div className="notice">Tax rule masih DRAFT. Seed sengaja tidak mengaktifkan tarif pajak kosong; impor tarif resmi dan approve rule sebelum payroll production.</div>}
          </div>
        </Panel>
      </section>

      <section className="grid2">
        <Panel eyebrow="CUTI" title="Pengajuan Cuti" badge={`${leaveRequests.filter((row) => row.status === 'SUBMITTED').length} menunggu`}>
          <Table head={['Karyawan', 'Jenis', 'Periode', 'Hari', 'Status', 'Aksi']} rows={leaveRequests.map((row) => {
            const leaveType = leaveTypes.find((item) => item.id === row.leaveTypeId);
            return [employeeById.get(row.employeeId)?.fullName ?? row.employeeId, leaveType?.name ?? row.leaveTypeId, `${tanggal(row.startDate)} – ${tanggal(row.endDate)}`, String(row.totalDays), <StatusChip status={row.status} />, row.status === 'SUBMITTED' ? <span style={{ display: 'flex', gap: 5 }}><button type="button" disabled={busy} onClick={() => void reviewLeaveRequest(row.id, 'APPROVED')}>Approve</button><button type="button" className="secondary" disabled={busy} onClick={() => void reviewLeaveRequest(row.id, 'REJECTED')}>Reject</button></span> : '-'];
          })} empty="Belum ada pengajuan cuti." />
        </Panel>
        <Panel eyebrow="LEMBUR" title="Pengajuan Lembur" badge={`${overtimeRequests.filter((row) => row.status === 'SUBMITTED').length} menunggu`}>
          <Table head={['Karyawan', 'Waktu', 'Durasi', 'Status', 'Aksi']} rows={overtimeRequests.map((row) => {
            const minutes = Math.round((new Date(row.requestedEnd).getTime() - new Date(row.requestedStart).getTime()) / 60000);
            return [employeeById.get(row.employeeId)?.fullName ?? row.employeeId, `${new Date(row.requestedStart).toLocaleString('id-ID')} – ${new Date(row.requestedEnd).toLocaleString('id-ID')}`, `${row.approvedMinutes ?? minutes} menit`, <StatusChip status={row.status} />, row.status === 'SUBMITTED' ? <span style={{ display: 'flex', gap: 5 }}><button type="button" disabled={busy} onClick={() => void reviewOvertimeRequest(row, 'APPROVED')}>Approve</button><button type="button" className="secondary" disabled={busy} onClick={() => void reviewOvertimeRequest(row, 'REJECTED')}>Reject</button></span> : '-'];
          })} empty="Belum ada pengajuan lembur." />
        </Panel>
      </section>

      <Panel eyebrow="PAYROLL LIFECYCLE" title="Run Aktif" badge={selectedRun?.status ?? 'BELUM DIPILIH'}>
        <label style={{ display: 'block', marginBottom: 12 }}>Payroll Run
          <select value={selectedRunId} onChange={(e) => setSelectedRunId(e.target.value)}>
            <option value="">Pilih run</option>
            {runs.map((run) => <option key={run.id} value={run.id}>{run.adjustmentOfRunId ? `ADJ#${run.adjustmentSequence ?? '?'} · ` : ''}{run.number} · {run.status}</option>)}
          </select>
        </label>
        {selectedRun && <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {!selectedRun.adjustmentOfRunId && <button type="button" className="secondary" disabled={busy || !['DRAFT', 'REVIEW'].includes(selectedRun.status)} onClick={() => void lockAttendance()}>1. Kunci absensi</button>}
            <button type="button" className="secondary" disabled={busy || !['DRAFT', 'REVIEW'].includes(selectedRun.status)} onClick={() => void runStep(`/payroll/runs/${selectedRun.id}/calculate`, selectedRun.adjustmentOfRunId ? 'Adjustment selesai dihitung sebagai selisih; periksa hasil REVIEW.' : 'Payroll selesai dihitung; periksa hasil REVIEW.')}>{selectedRun.adjustmentOfRunId ? '2. Hitung selisih' : '2. Hitung'}</button>
            <button type="button" className="secondary" disabled={busy || selectedRun.status !== 'REVIEW'} onClick={() => void runStep(`/payroll/runs/${selectedRun.id}/approve`, selectedRun.adjustmentOfRunId ? 'Adjustment payroll berhasil disetujui.' : 'Payroll berhasil disetujui.')}>3. Approve</button>
            <button type="button" disabled={busy || selectedRun.status !== 'APPROVED'} onClick={() => void runStep(`/payroll/runs/${selectedRun.id}/post-accounting`, selectedRun.adjustmentOfRunId ? 'Selisih adjustment diposting tanpa mengulang jurnal payroll sumber.' : 'Payroll diposting; Utang Gaji/Pajak/BPJS sudah terbentuk.')}>{selectedRun.adjustmentOfRunId ? '4. Posting selisih' : '4. Posting jurnal'}</button>
            <button type="button" disabled={busy || selectedRun.status !== 'PAID'} onClick={() => void runStep(`/payroll/runs/${selectedRun.id}/publish-payslips`, selectedRun.adjustmentOfRunId ? 'Payslip adjustment diterbitkan melalui secure link.' : 'Payslip diterbitkan melalui secure link.')}>6. Terbitkan payslip</button>
            {!selectedRun.adjustmentOfRunId && ['POSTED', 'PAID'].includes(selectedRun.status) && <button type="button" className="secondary" disabled={busy} onClick={() => { setAdjustmentSource(selectedRun); setAdjustmentReason(''); setAdjustmentPostingDate(new Date().toLocaleDateString('en-CA')); }}>Buat adjustment</button>}
            {['DRAFT', 'REVIEW', 'APPROVED'].includes(selectedRun.status) && <button type="button" className="secondary" disabled={busy} onClick={() => { setCancelTarget(selectedRun); setCancelReason(''); }}>{selectedRun.adjustmentOfRunId ? 'Batalkan adjustment' : 'Batalkan run'}</button>}
          </div>
          {selectedRun.adjustmentOfRunId && <div className="notice" style={{ marginBottom: 12 }}>Adjustment #{selectedRun.adjustmentSequence ?? '-'} · sumber {runs.find((item) => item.id === selectedRun.adjustmentOfRunId)?.number ?? selectedRun.adjustmentOfRunId}. Nilai di bawah adalah <strong>selisih</strong>, bukan total payroll ulang. {selectedRun.adjustmentReason ? `Alasan: ${selectedRun.adjustmentReason}` : ''}</div>}
          <Table
            head={['Karyawan', 'Gross', 'Taxable', 'PPh', 'Iuran', 'Net', 'Status']}
            rows={results.map((r) => [
              employeeById.get(r.employeeId)?.fullName ?? r.employeeId,
              rupiah(Number(r.grossPay)), rupiah(Number(r.taxableIncome)), rupiah(Number(r.incomeTax)), rupiah(Number(r.employeeContribution)), <strong>{rupiah(Number(r.netPay))}</strong>, <StatusChip status={r.status} />,
            ])}
            empty="Belum ada hasil kalkulasi."
          />
        </>}
      </Panel>

      <section className="grid2">
        <Panel eyebrow="5A. PEMBAYARAN GAJI" title="Payroll Payments" badge={`${payments.filter((p) => p.status !== 'PAID').length} belum selesai`}>
          <Table
            head={['Karyawan', 'Arah', 'Nominal', 'Status', 'Aksi']}
            rows={payments.map((p) => [
              employeeById.get(p.employeeId)?.fullName ?? p.employeeId,
              p.direction === 'RECOVERY' ? 'Recovery ke perusahaan' : 'Bayar ke karyawan',
              rupiah(Number(p.amount)),
              <StatusChip status={p.status} />,
              p.status === 'PAID' ? tanggal(p.paidAt ?? '') : p.status === 'CANCELLED' ? 'Dikoreksi adjustment' : <button type="button" className="secondary" disabled={busy} onClick={() => { setSettleTarget(p); setSettlementReference(''); }}>{p.direction === 'RECOVERY' ? 'Konfirmasi penerimaan' : 'Konfirmasi transfer bank'}</button>,
            ])}
            empty="Payment/recovery akan dibuat setelah payroll diposting."
          />
          {selectedLiability?.recovery && Number(selectedLiability.recovery.recognized) > 0 && <div className="notice" style={{ marginTop: 10 }}>Piutang recovery karyawan: {rupiah(Number(selectedLiability.recovery.outstanding))} belum diterima dari {rupiah(Number(selectedLiability.recovery.recognized))} yang diakui.</div>}
        </Panel>
        <Panel eyebrow="5B. KEWAJIBAN PAYROLL" title="PPh / BPJS / Potongan" badge={selectedLiability ? 'Run terpilih' : 'Belum tersedia'}>
          {selectedLiability ? <Table
            head={['Kewajiban', 'Diakui', 'Dibayar', 'Pending', 'Sisa', 'Aksi']}
            rows={[
              ['PPh payroll (2103)', selectedLiability.tax, '2103' as const],
              ['BPJS/potongan (2104)', selectedLiability.socialAndOther, '2104' as const],
            ].map(([label, bucket, code]) => {
              const data = bucket as LiabilityBucket;
              const available = Number(data.availableToPay ?? 0);
              return [label, rupiah(Number(data.recognized)), rupiah(Number(data.paid)), rupiah(Number(data.pending)), <strong>{rupiah(Number(data.outstanding))}</strong>, available > 0 ? <button type="button" className="secondary" disabled={busy} onClick={() => void createLiabilityDraft(code as '2103' | '2104', available)}>Buat draft bayar</button> : '-'];
            })}
          /> : <div className="notice">Posting payroll terlebih dahulu untuk membentuk kewajiban.</div>}
        </Panel>
      </section>

      <Panel eyebrow="AUDIT" title="Riwayat Payroll Runs" badge={`${runs.length} run`}>
        <Table
          head={['Nomor', 'Jenis', 'Status', 'Karyawan', 'Gross', 'PPh', 'Net', 'Dibuat']}
          rows={runs.map((r) => [<strong>{r.number}</strong>, r.adjustmentOfRunId ? `Adjustment #${r.adjustmentSequence ?? '-'}` : 'Regular', <StatusChip status={r.status} />, r.employeeCount, rupiah(Number(r.grossTotal)), rupiah(Number(r.taxTotal)), <strong>{rupiah(Number(r.netTotal))}</strong>, tanggal(r.createdAt)])}
          empty="Belum ada payroll run."
        />
        {message && <div className="notice" style={{ marginTop: 12 }}>{message}</div>}
      </Panel>

      {cancelTarget && <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="payroll-cancel-title">
        <div className="modalCard">
          <span className="eyebrow">CANCEL PRE-POSTING</span>
          <h2 id="payroll-cancel-title">Batalkan {cancelTarget.number}</h2>
          <p className="sectionHelp">Hanya run DRAFT/REVIEW/APPROVED yang belum diposting yang dapat dibatalkan. Run POSTED/PAID tidak pernah diedit atau dibatalkan dari workflow ini.</p>
          <label>Alasan pembatalan<textarea autoFocus rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Contoh: rule payroll perlu diperbaiki sebelum adjustment dihitung ulang" /></label>
          <div className="modalActions">
            <button type="button" className="secondary" disabled={busy} onClick={() => { setCancelTarget(null); setCancelReason(''); }}>Kembali</button>
            <button type="button" disabled={busy || cancelReason.trim().length < 5} onClick={() => void cancelPayrollRun()}>{busy ? 'Memproses…' : 'Batalkan run'}</button>
          </div>
        </div>
      </div>}

      {adjustmentSource && <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="payroll-adjustment-title">
        <div className="modalCard">
          <span className="eyebrow">PAYROLL ADJUSTMENT</span>
          <h2 id="payroll-adjustment-title">Koreksi {adjustmentSource.number}</h2>
          <p className="sectionHelp">Run sumber tidak diubah. Sistem membuat run baru dan menghitung selisih terhadap payroll sumber + adjustment sebelumnya yang sudah diposting.</p>
          <label>Alasan koreksi<textarea autoFocus rows={3} value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)} placeholder="Contoh: koreksi lembur yang baru disetujui setelah payroll diposting" /></label>
          <label>Tanggal posting jurnal adjustment<input type="date" value={adjustmentPostingDate} onChange={(e) => setAdjustmentPostingDate(e.target.value)} /></label>
          <div className="notice">Tarif PPh/BPJS tidak dibuat otomatis. Adjustment mewarisi rule APPROVED dari payroll sumber kecuali backend diberi rule pengganti yang valid.</div>
          <div className="modalActions">
            <button type="button" className="secondary" disabled={busy} onClick={() => { setAdjustmentSource(null); setAdjustmentReason(''); }}>Batal</button>
            <button type="button" disabled={busy || adjustmentReason.trim().length < 5 || !adjustmentPostingDate} onClick={() => void createAdjustmentRun()}>{busy ? 'Memproses…' : 'Buat adjustment'}</button>
          </div>
        </div>
      </div>}

      {settleTarget && <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="payroll-settlement-title">
        <div className="modalCard">
          <span className="eyebrow">PAYROLL SETTLEMENT</span>
          <h2 id="payroll-settlement-title">{settleTarget.direction === 'RECOVERY' ? 'Konfirmasi penerimaan recovery' : 'Konfirmasi transfer gaji'}</h2>
          <p className="sectionHelp">Masukkan referensi bank hanya setelah transaksi eksternal benar-benar berhasil. {settleTarget.direction === 'RECOVERY' ? 'Nilai yang diterima kembali' : 'Nilai pembayaran'}: {rupiah(Number(settleTarget.amount))}.</p>
          <label>Referensi transfer bank<input autoFocus value={settlementReference} onChange={(e) => setSettlementReference(e.target.value)} placeholder="Nomor referensi / transaction ID" /></label>
          <div className="modalActions">
            <button type="button" className="secondary" disabled={busy} onClick={() => { setSettleTarget(null); setSettlementReference(''); }}>Kembali</button>
            <button type="button" disabled={busy || !settlementReference.trim()} onClick={() => void settleSalary(settleTarget, settlementReference)}>{busy ? 'Memproses…' : settleTarget.direction === 'RECOVERY' ? 'Konfirmasi penerimaan' : 'Konfirmasi transfer'}</button>
          </div>
        </div>
      </div>}
    </>
  );
}
