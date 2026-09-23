'use client';

import { useEffect, useMemo, useState } from 'react';
import { authFetch } from '../auth-fetch';
import { Panel, StatusChip, Table, rupiah, tanggal } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type AccountRow = { accountId?: string; code: string; name: string; type?: string; debit?: number; credit?: number; normalBalance?: number; amount?: number };
type ProfitLoss = { from: string; to: string; revenue: number; expenses: number; netProfit: number; revenueAccounts: AccountRow[]; expenseAccounts: AccountRow[] };
type TrialBalance = { rows: AccountRow[]; totalDebit: number; totalCredit: number; difference: number; balanced: boolean };
type BalanceSheet = { totalAssets: number; totalLiabilities: number; totalEquity: number; totalLiabilitiesAndEquity: number; difference: number; balanced: boolean; assets: AccountRow[]; liabilities: AccountRow[]; equity: AccountRow[]; currentEarnings: number };
type CashFlow = { cashIn: number; cashOut: number; netCashFlow: number; rows: Array<{ journalNumber: string; date: string; description: string; accountCode: string; cashIn: number; cashOut: number; net: number }> };
type Margin = { revenueExTax: number; cost: number; grossMargin: number; rows: Array<{ id: string; number: string; date: string; channel: string; revenueExTax: number; cost: number; margin: number; marginPercent: number }> };
type Valuation = { summary: { skuCount: number; quantity: number; available: number; inventoryValue: number }; items: Array<{ id: string; quantity: number; available: number; inventoryValue: number | string; product: { sku: string; name: string; costPrice: number | string }; warehouse: { name: string } }> };
type TaxSummary = { outputTax: number; recoverableInputTax: number; nonRecoverableInputTax: number; withholdingTax: number; netIndirectTaxPayable: number; indirectTaxCredit: number; rows: Array<{ code: string; name: string; direction: string; taxableBase: number; taxAmount: number }> };
type Comparison = { current: { from: string; to: string; revenue: number; expenses: number; netProfit: number }; previous: { from: string; to: string; revenue: number; expenses: number; netProfit: number }; changePercent: { revenue: number | null; expenses: number | null; netProfit: number | null } };
type DimensionComparison = { branchScope: string; branches: Array<{ id: string; code: string; name: string; revenue: number; expenses: number; netProfit: number }>; costCenters: Array<{ costCenterId: string; label: string; amount: number }> };
type Integrity = { status: string; blockers: number; warnings: number; trialBalance: { difference: number; balanced: boolean }; balanceSheet: { difference: number; balanced: boolean }; postedEventsMissingJournal: number; failedEvents: number; queuedEvents: number };
type DrillDown = { account: { code: string; name: string; type: string }; rows: Array<{ journalLineId: string; journalNumber: string; date: string; debit: number; credit: number; runningBalance: number; referenceType: string; referenceId: string; description: string; accountingEvent: null | { id: string; eventType: string; sourceType: string; sourceId: string; status: string } }> };
type ReportJob = { id: string; reportType: string; format: string; status: string; progress: number; outputUrl?: string | null; errorMessage?: string | null; createdAt: string };
type CursorResponse<T> = T[] | { items?: T[] };

const REPORT_TYPES = ['PROFIT_LOSS','TRIAL_BALANCE','BALANCE_SHEET','GENERAL_LEDGER','CASH_FLOW','INVENTORY_VALUATION','MARGIN','TAX_SUMMARY','BRANCH_COMPARISON','COST_CENTER','PERIOD_COMPARISON','RECEIVABLES','PAYABLES','DELIVERY_COD','PAYROLL','AUDIT_LOG'] as const;

function pct(value: number | null) {
  if (value == null || !Number.isFinite(value)) return 'n/a';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export default function ReportingWorkspace({ token }: { token: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [profitLoss, setProfitLoss] = useState<ProfitLoss | null>(null);
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlow | null>(null);
  const [margin, setMargin] = useState<Margin | null>(null);
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [dimensions, setDimensions] = useState<DimensionComparison | null>(null);
  const [integrity, setIntegrity] = useState<Integrity | null>(null);
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);
  const [accountCode, setAccountCode] = useState('');
  const [jobs, setJobs] = useState<ReportJob[]>([]);
  const [reportType, setReportType] = useState<string>('PROFIT_LOSS');
  const [format, setFormat] = useState('XLSX');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await authFetch(`${API}${path}`, token, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message ?? payload?.error ?? `HTTP ${response.status}`);
    return payload as T;
  }

  async function loadReports() {
    setLoading(true); setMessage('');
    const range = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    try {
      const [pl, tb, bs, cf, mg, iv, tx, cmp, dim, integ, jobPage] = await Promise.all([
        api<ProfitLoss>(`/reports/profit-loss?${range}`),
        api<TrialBalance>(`/reports/trial-balance?${range}`),
        api<BalanceSheet>(`/reports/balance-sheet?asOf=${encodeURIComponent(to)}`),
        api<CashFlow>(`/reports/cash-flow?${range}`),
        api<Margin>(`/reports/margin?${range}&limit=100`),
        api<Valuation>('/reports/inventory-valuation?limit=100'),
        api<TaxSummary>(`/reports/tax-summary?${range}`),
        api<Comparison>(`/reports/period-comparison?${range}`),
        api<DimensionComparison>(`/reports/dimension-comparison?${range}`),
        api<Integrity>(`/reports/financial-integrity?asOf=${encodeURIComponent(to)}`),
        api<CursorResponse<ReportJob>>('/reports/jobs?limit=50'),
      ]);
      setProfitLoss(pl); setTrialBalance(tb); setBalanceSheet(bs); setCashFlow(cf); setMargin(mg); setValuation(iv); setTaxSummary(tx); setComparison(cmp); setDimensions(dim); setIntegrity(integ);
      setJobs(Array.isArray(jobPage) ? jobPage : jobPage.items ?? []);
      if (!accountCode) setAccountCode(tb.rows[0]?.code ?? '');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal memuat reporting workspace.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadReports(); }, [token]);

  const accountOptions = useMemo(() => trialBalance?.rows ?? [], [trialBalance]);

  async function loadDrillDown() {
    if (!accountCode) return;
    try {
      setDrillDown(await api<DrillDown>(`/reports/drill-down?accountCode=${encodeURIComponent(accountCode)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=100`));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal membuka drill-down.'); }
  }

  async function createExport(event: React.FormEvent) {
    event.preventDefault();
    try {
      const filters: Record<string, unknown> = { from, to, asOf: to };
      if (reportType === 'GENERAL_LEDGER' && accountCode) filters.accountCode = accountCode;
      const row = await api<ReportJob>('/reports/jobs', { method: 'POST', body: JSON.stringify({ reportType, format, filters }) });
      setJobs((current) => [row, ...current]);
      setMessage(`Export ${row.reportType} ${row.format} masuk antrean worker.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal membuat export.'); }
  }

  async function download(row: ReportJob) {
    const response = await authFetch(`${API}/reports/jobs/${row.id}/download`, token);
    if (!response.ok) { setMessage(`Download gagal (${response.status}).`); return; }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${row.reportType.toLowerCase()}-${row.id}.${row.format.toLowerCase()}`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <>
    <Panel eyebrow="FINANCIAL REPORTING" title="Laporan Keuangan & Perbandingan" badge={loading ? 'Memuat…' : integrity?.status ?? 'READY'}>
      <form onSubmit={(event) => { event.preventDefault(); void loadReports(); }} style={{ display: 'grid', gridTemplateColumns: '180px 180px auto', gap: 10, alignItems: 'end', marginBottom: 16 }}>
        <label>Dari<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>Sampai<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <button>Refresh laporan</button>
      </form>
      <div className="grid4">
        <article className="stat"><span>Pendapatan</span><strong>{rupiah(profitLoss?.revenue ?? 0)}</strong><small>{comparison ? pct(comparison.changePercent.revenue) : 'vs periode sebelumnya'}</small></article>
        <article className="stat"><span>Beban</span><strong>{rupiah(profitLoss?.expenses ?? 0)}</strong><small>{comparison ? pct(comparison.changePercent.expenses) : 'vs periode sebelumnya'}</small></article>
        <article className="stat"><span>Laba Bersih</span><strong>{rupiah(profitLoss?.netProfit ?? 0)}</strong><small>{comparison ? pct(comparison.changePercent.netProfit) : 'vs periode sebelumnya'}</small></article>
        <article className="stat"><span>Arus Kas Bersih</span><strong>{rupiah(cashFlow?.netCashFlow ?? 0)}</strong><small>Kas masuk {rupiah(cashFlow?.cashIn ?? 0)}</small></article>
      </div>
      {integrity && <p className="sectionHelp">Integrity <strong>{integrity.status}</strong> · blockers {integrity.blockers} · warnings {integrity.warnings} · trial difference {rupiah(integrity.trialBalance.difference)} · balance sheet difference {rupiah(integrity.balanceSheet.difference)}</p>}
    </Panel>

    <section className="grid2">
      <Panel eyebrow="TRIAL BALANCE" title="Neraca Saldo" badge={trialBalance?.balanced ? 'BALANCED' : 'REVIEW'}>
        <Table head={['Akun','Debit','Credit','Saldo']} rows={(trialBalance?.rows ?? []).map((row) => [<button type="button" className="secondary" onClick={() => { setAccountCode(row.code); void 0; }}>{row.code} · {row.name}</button>, rupiah(row.debit ?? 0), rupiah(row.credit ?? 0), rupiah(row.normalBalance ?? 0)])} empty="Belum ada aktivitas jurnal." />
      </Panel>
      <Panel eyebrow="BALANCE SHEET" title="Posisi Keuangan" badge={balanceSheet?.balanced ? 'BALANCED' : 'REVIEW'}>
        <Table head={['Kelompok','Nilai']} rows={[
          ['Aset', rupiah(balanceSheet?.totalAssets ?? 0)],
          ['Liabilitas', rupiah(balanceSheet?.totalLiabilities ?? 0)],
          ['Ekuitas + laba berjalan', rupiah(balanceSheet?.totalEquity ?? 0)],
          ['Selisih', rupiah(balanceSheet?.difference ?? 0)],
        ]} />
      </Panel>
    </section>

    <section className="grid2">
      <Panel eyebrow="INVENTORY" title="Valuasi Persediaan" badge={`${valuation?.summary.skuCount ?? 0} SKU`}>
        <Table head={['Produk','Gudang','Qty','Available','Nilai']} rows={(valuation?.items ?? []).slice(0, 30).map((row) => [`${row.product.sku} · ${row.product.name}`, row.warehouse.name, String(row.quantity), String(row.available), rupiah(Number(row.inventoryValue))])} empty="Belum ada stok." />
        <p className="sectionHelp">Total live inventory: <strong>{rupiah(valuation?.summary.inventoryValue ?? 0)}</strong></p>
      </Panel>
      <Panel eyebrow="MARGIN" title="Margin Penjualan" badge={rupiah(margin?.grossMargin ?? 0)}>
        <Table head={['Transaksi','Channel','Revenue ex-tax','Cost','Margin']} rows={(margin?.rows ?? []).slice(0, 30).map((row) => [row.number, row.channel, rupiah(row.revenueExTax), rupiah(row.cost), `${rupiah(row.margin)} · ${row.marginPercent.toFixed(1)}%`])} empty="Belum ada penjualan pada periode." />
      </Panel>
    </section>

    <section className="grid2">
      <Panel eyebrow="DIMENSION" title="Perbandingan Cabang" badge={dimensions?.branchScope ?? 'CURRENT_BRANCH'}>
        <Table head={['Cabang','Pendapatan','Beban','Laba']} rows={(dimensions?.branches ?? []).map((row) => [`${row.code} · ${row.name}`, rupiah(row.revenue), rupiah(row.expenses), rupiah(row.netProfit)])} empty="Belum ada journal dimension." />
      </Panel>
      <Panel eyebrow="COST CENTER" title="Accounting Event Dimension" badge={`${dimensions?.costCenters.length ?? 0} bucket`}>
        <Table head={['Cost Center','Net Amount']} rows={(dimensions?.costCenters ?? []).map((row) => [row.label, rupiah(row.amount)])} empty="Belum ada dimensions.costCenterId pada accounting event line." />
      </Panel>
    </section>

    <Panel eyebrow="REPORT DRILL-DOWN" title="Akun → Jurnal → Accounting Event → Source" badge={(drillDown?.account.code ?? accountCode) || undefined}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'end', marginBottom: 12, flexWrap: 'wrap' }}>
        <label style={{ minWidth: 280 }}>Akun<select value={accountCode} onChange={(event) => setAccountCode(event.target.value)}><option value="">Pilih akun</option>{accountOptions.map((row) => <option key={row.code} value={row.code}>{row.code} · {row.name}</option>)}</select></label>
        <button type="button" onClick={() => void loadDrillDown()}>Buka drill-down</button>
      </div>
      <Table head={['Tanggal','Jurnal','Debit/Credit','Running','Source']} rows={(drillDown?.rows ?? []).map((row) => [tanggal(row.date), `${row.journalNumber} · ${row.description}`, `${rupiah(row.debit)} / ${rupiah(row.credit)}`, rupiah(row.runningBalance), row.accountingEvent ? `${row.accountingEvent.eventType} → ${row.accountingEvent.sourceType}:${row.accountingEvent.sourceId}` : `${row.referenceType}:${row.referenceId}`])} empty="Pilih akun untuk membuka drill-down." />
    </Panel>

    <Panel eyebrow="TAX REPORT" title="Tax Summary" badge={rupiah(taxSummary?.netIndirectTaxPayable ?? 0)}>
      <Table head={['Kode','Direction','Taxable Base','Tax']} rows={(taxSummary?.rows ?? []).map((row) => [`${row.code} · ${row.name}`, row.direction, rupiah(row.taxableBase), rupiah(row.taxAmount)])} empty="Belum ada tax transaction POSTED." />
    </Panel>

    <Panel eyebrow="ASYNC REPORT JOB" title="PDF / XLSX / CSV" badge={`${jobs.length} job`}>
      <form onSubmit={createExport} style={{ display: 'grid', gridTemplateColumns: 'minmax(240px,1fr) 140px auto', gap: 10, alignItems: 'end', marginBottom: 16 }}>
        <label>Jenis laporan<select value={reportType} onChange={(event) => setReportType(event.target.value)}>{REPORT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
        <label>Format<select value={format} onChange={(event) => setFormat(event.target.value)}><option>CSV</option><option>XLSX</option><option>PDF</option></select></label>
        <button>Buat export</button>
      </form>
      <Table head={['Dibuat','Laporan','Format','Progress','Status','Aksi']} rows={jobs.map((row) => [tanggal(row.createdAt), row.reportType, row.format, `${row.progress ?? 0}%`, <StatusChip status={row.status} />, row.status === 'DONE' ? <button type="button" className="secondary" onClick={() => void download(row)}>Download</button> : row.status === 'FAILED' ? <small>{row.errorMessage ?? 'Worker gagal.'}</small> : <span>Worker queue</span>])} empty="Belum ada report job." />
    </Panel>

    {message && <div className="notice" style={{ marginTop: 12 }}>{message}</div>}
  </>;
}
