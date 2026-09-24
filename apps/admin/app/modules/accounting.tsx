'use client';
import { authFetch } from '../auth-fetch';
// Modul Akuntansi & Kas — W3 functional surface: operational finance, period close, bank reconciliation.
import { useEffect, useRef, useState } from 'react';
import { Panel, Table, StatusChip, rupiah, tanggal } from '../ui';
import TaxWorkspace from './tax-workspace';
import ReportingWorkspace from './reporting-workspace';
import FinanceDepthWorkspace from './finance-depth-workspace';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type JournalEvent = { id: string; eventType: string; status: string; sourceType?: string; sourceId?: string; businessDate?: string; grossAmount?: string | number; createdAt: string };
type PostingRuleLine = { accountCode?: string; accountCodeKey?: string; side: 'DEBIT'|'CREDIT'; amountKey: string; description?: string; skipIfZero?: boolean };
type PostingRule = { id: string; code: string; version: number; name: string; eventType: string; priority: number; status: 'DRAFT'|'ACTIVE'|'INACTIVE'; effectiveFrom?: string | null; effectiveTo?: string | null; journalLines: PostingRuleLine[] };
type AccountingEventDetail = { event: JournalEvent & { lines: Array<{ id: string; lineNumber: number; description?: string | null; netAmount: string | number; taxAmount: string | number; grossAmount: string | number }>; postings: Array<{ id: string; ruleId?: string | null; journalEntryId: string; status: string; postedAt: string; postingTrace?: unknown }>; taxTransactions: Array<{ id: string; direction: string; taxableBase: string | number; taxAmount: string | number; taxCodeId: string }> }; rules: PostingRule[]; journalEntry: null | { id: string; number: string; date: string; referenceType: string; referenceId: string; description: string; lines: Array<{ id: string; debit: string | number; credit: string | number; account: { id: string; code: string; name: string; type: string } }> }; source: { type: string; id: string } };
type TaxCode = { id: string; code: string; name: string; rate: string | number; scope: string; status: string };
type Account = { id: string; code: string; name: string; type: string; isActive: boolean };
type FinanceTx = {
  id: string; number: string; type: string; description?: string; grossAmount: string | number;
  debitAccountCode: string; creditAccountCode: string; status: string; transactionDate?: string; createdAt: string;
};
type SupplierPayable = {
  referenceType: 'GoodsReceipt' | 'Asset' | 'MaintenanceWorkOrder' | 'FuelTransaction'; referenceId: string; documentNumber: string;
  goodsReceiptId?: string; goodsReceiptNumber?: string; purchaseOrderNumber?: string; assetId?: string; assetCode?: string;
  assetName?: string; sourceName?: string; supplierId: string; supplierName: string; transactionDate?: string; receivedAt?: string;
  grossAmount: string | number; returnedAmount: string | number; paidAmount: string | number; pendingPaymentAmount: string | number;
  outstandingAmount: string | number; availableToPay: string | number;
};
type SupplierRefund = { purchaseReturnId: string; purchaseReturnNumber: string; supplierId: string; supplierName: string; creditNoteNumber?: string | null; receivableAmount: string | number; receivedAmount: string | number; pendingAmount: string | number; outstandingAmount: string | number; availableToReceive: string | number };
type CustomerReceivable = { orderId: string; orderNumber: string; customerName: string; customerPhone?: string | null; paymentMethod: string; receivableAccountCode: string; grossAmount: string | number; receivedAmount: string | number; pendingAmount: string | number; outstandingAmount: string | number; availableToReceive: string | number; orderStatus: string };
type FinanceType = 'OPERATING_EXPENSE' | 'OTHER_INCOME' | 'TAX_PAYMENT' | 'SUPPLIER_PAYMENT' | 'SUPPLIER_REFUND' | 'CUSTOMER_RECEIPT' | 'CASH_TRANSFER';
type FiscalPeriod = { id: string; name: string; startDate: string; endDate: string; status: 'OPEN' | 'SOFT_CLOSED' | 'CLOSED'; closedAt?: string | null };
type AccountingCloseControl = { id: string; module: string; periodStart: string; periodEnd: string; status: 'OPEN'|'CLOSED'; closedAt?: string | null; reopenReason?: string | null };
type StatementLine = { id: string; transactionDate: string; description: string; reference?: string | null; debit: string | number; credit: string | number; balance?: string | number | null; matched: boolean; matchedType?: string | null; matchedId?: string | null };
type BankStatement = { id: string; bankAccountId?: string | null; source: string; fileName?: string | null; periodStart?: string | null; periodEnd?: string | null; openingBalance?: string | number | null; closingBalance?: string | number | null; lines: StatementLine[] };
type BankReconciliation = { id: string; bankAccountId?: string | null; statementId?: string | null; status: string; startDate: string; endDate: string; bookBalance: string | number; bankBalance: string | number; difference: string | number; matchedCount: number };
type JournalLine = { id: string; debit: string | number; credit: string | number; journalEntry: { id: string; number: string; date: string; referenceType: string; referenceId: string; description: string } };
type ReconciliationDetails = { reconciliation: BankReconciliation; statementLines: StatementLine[]; journalLines: JournalLine[] };
type ReportJob = { id: string; reportType: string; format: string; status: string; progress: number; outputUrl?: string | null; errorMessage?: string | null; createdAt: string; finishedAt?: string | null };
type CursorResponse<T> = T[] | { items?: T[] };
const REPORT_TYPES = ['SALES','PRODUCTS','CASHIER','CHANNELS','CUSTOMERS','DISCOUNTS','RETURNS','INVENTORY','INVENTORY_MOVEMENTS','BATCH_EXPIRY','STOCK_OPNAME','PURCHASES','SUPPLIERS','MARGIN','CASH_FLOW','PROFIT_LOSS','TRIAL_BALANCE','BALANCE_SHEET','GENERAL_LEDGER','TAX_SUMMARY','AUDIT_LOG','RECEIVABLES','PAYABLES','DELIVERY_COD','PAYROLL'] as const;

function newRequestKey() { return `finance:${Date.now()}:${Math.random().toString(36).slice(2)}`; }
function isoDate(value?: string | null) { return value ? new Date(value).toISOString().slice(0, 10) : ''; }
function parseMoney(value: string) {
  const normalized = value.trim().replace(/\s+/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  const result = Number(normalized || 0);
  if (!Number.isFinite(result)) throw new Error(`Nominal tidak valid: ${value}`);
  return result;
}
function parseStatementText(text: string) {
  const rows = text.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
  const result: Array<{ transactionDate: string; description: string; reference?: string; debit?: number; credit?: number; balance?: number }> = [];
  for (const [index, row] of rows.entries()) {
    const separator = row.includes('|') ? '|' : ',';
    const cells = row.split(separator).map((cell) => cell.trim());
    if (index === 0 && !/^\d{4}-\d{2}-\d{2}/.test(cells[0] ?? '')) continue;
    if (cells.length < 5) throw new Error(`Baris ${index + 1}: format harus tanggal|deskripsi|referensi|debit|credit|balance.`);
    const debit = parseMoney(cells[3] ?? '0');
    const credit = parseMoney(cells[4] ?? '0');
    const balanceText = cells[5]?.trim();
    result.push({
      transactionDate: cells[0], description: cells[1], reference: cells[2] || undefined,
      debit: debit || undefined, credit: credit || undefined,
      balance: balanceText ? parseMoney(balanceText) : undefined,
    });
  }
  if (!result.length) throw new Error('Bank statement belum memiliki baris transaksi.');
  return result;
}

export default function AccountingView({ token, mode }: { token: string; mode?: string | null }) {
  const [events, setEvents] = useState<JournalEvent[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [postingRules, setPostingRules] = useState<PostingRule[]>([]);
  const [eventDetail, setEventDetail] = useState<AccountingEventDetail | null>(null);
  const [finances, setFinances] = useState<FinanceTx[]>([]);
  const [payables, setPayables] = useState<SupplierPayable[]>([]);
  const [supplierRefunds, setSupplierRefunds] = useState<SupplierRefund[]>([]);
  const [customerReceivables, setCustomerReceivables] = useState<CustomerReceivable[]>([]);
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [closeControls, setCloseControls] = useState<AccountingCloseControl[]>([]);
  const [closeControlForm, setCloseControlForm] = useState({ module: 'ACCOUNTING', periodStart: '', periodEnd: '' });
  const [reopenReasons, setReopenReasons] = useState<Record<string, string>>({});
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [reconciliations, setReconciliations] = useState<BankReconciliation[]>([]);
  const [reconDetails, setReconDetails] = useState<ReconciliationDetails | null>(null);
  const [reportJobs, setReportJobs] = useState<ReportJob[]>([]);
  const [reportForm, setReportForm] = useState({ reportType: 'SALES', format: 'XLSX', from: '', to: '', days: 90 });
  const [manualMatches, setManualMatches] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [financeDialog, setFinanceDialog] = useState<{ transaction: FinanceTx; action: 'reject' | 'cancel'; notes: string } | null>(null);
  const [accountEditDialog, setAccountEditDialog] = useState<{ account: Account; name: string } | null>(null);
  const requestKey = useRef(newRequestKey());
  const [form, setForm] = useState({
    type: 'OPERATING_EXPENSE' as FinanceType, description: '', amount: 0, settlementAccount: '1101', transferTargetAccount: '1102',
    taxPayableAccount: '2201', supplierPayableKey: '', purchaseReturnId: '', customerOrderId: '', requireApproval: false,
  });
  const [periodForm, setPeriodForm] = useState({ name: '', startDate: '', endDate: '' });
  const [accountForm, setAccountForm] = useState({ code: '', name: '', type: 'ASSET' });
  const [ruleForm, setRuleForm] = useState({ code: '', version: 1, name: '', eventType: '', priority: 100, status: 'DRAFT', effectiveFrom: '', effectiveTo: '', journalLinesText: 'DEBIT|1101|gross|Kas/Bank\nCREDIT|4101|net|Pendapatan' });
  const [statementForm, setStatementForm] = useState({ bankAccountId: '', source: 'MANUAL', fileName: '', periodStart: '', periodEnd: '', openingBalance: '', closingBalance: '', linesText: '' });
  const [reconForm, setReconForm] = useState({ statementId: '', startDate: '', endDate: '' });

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await authFetch(`${API}${path}`, token, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    });
    const data = await response.json();
    if (!response.ok) {
      const detail = typeof data.message === 'string' ? data.message : Array.isArray(data.message) ? data.message.join(', ') : data?.message?.message ?? data?.error ?? 'Permintaan gagal.';
      throw new Error(detail);
    }
    return data as T;
  }

  async function refresh() {
    try {
      const [ev, tx, ac, pr, fin, ap, sr, cr, fp, cc, bs, br, rj] = await Promise.all([
        api<CursorResponse<JournalEvent>>('/accounting-core/events?limit=20'),
        api<CursorResponse<TaxCode>>('/accounting-core/tax-codes'),
        api<Account[]>('/accounting-core/accounts'),
        api<PostingRule[]>('/accounting-core/posting-rules'),
        api<CursorResponse<FinanceTx>>('/finance-operations?limit=50'),
        api<SupplierPayable[]>('/finance-operations/supplier-payables'),
        api<SupplierRefund[]>('/finance-operations/supplier-refunds'),
        api<CustomerReceivable[]>('/finance-operations/customer-receivables'),
        api<FiscalPeriod[]>('/finance/fiscal-periods'),
        api<AccountingCloseControl[]>('/accounting-core/close-controls'),
        api<BankStatement[]>('/finance/bank-statements'),
        api<BankReconciliation[]>('/finance/reconciliations'),
        api<CursorResponse<ReportJob>>('/reports/jobs?limit=50'),
      ]);
      const accountRows = ac;
      const activeAccountRows = ac.filter((row) => row.isActive);
      const assetAccounts = activeAccountRows.filter((row) => row.type === 'ASSET');
      setEvents(Array.isArray(ev) ? ev : ev.items ?? []); setTaxCodes(Array.isArray(tx) ? tx : tx.items ?? []); setAccounts(accountRows); setPostingRules(pr);
      setFinances(Array.isArray(fin) ? fin : fin.items ?? []); setPayables(ap); setSupplierRefunds(sr); setCustomerReceivables(cr);
      setPeriods(fp); setCloseControls(cc); setStatements(bs); setReconciliations(br); setReportJobs(Array.isArray(rj) ? rj : rj.items ?? []);
      setForm((current) => ({
        ...current,
        settlementAccount: activeAccountRows.some((row) => row.code === current.settlementAccount) ? current.settlementAccount : assetAccounts[0]?.code ?? current.settlementAccount,
        transferTargetAccount: activeAccountRows.some((row) => row.code === current.transferTargetAccount) ? current.transferTargetAccount : assetAccounts[1]?.code ?? assetAccounts[0]?.code ?? current.transferTargetAccount,
        supplierPayableKey: current.supplierPayableKey || (() => { const row = ap.find((item) => Number(item.availableToPay) > 0); return row ? `${row.referenceType}:${row.referenceId}` : ''; })(),
        purchaseReturnId: current.purchaseReturnId || sr.find((row) => Number(row.availableToReceive) > 0)?.purchaseReturnId || '',
        customerOrderId: current.customerOrderId || cr.find((row) => Number(row.availableToReceive) > 0)?.orderId || '',
      }));
      setStatementForm((current) => ({ ...current, bankAccountId: current.bankAccountId || assetAccounts.find((row) => row.code === '1102')?.id || assetAccounts[0]?.id || '' }));
      setReconForm((current) => {
        if (current.statementId || !bs.length) return current;
        const first = bs[0];
        return { statementId: first.id, startDate: isoDate(first.periodStart ?? first.lines[0]?.transactionDate), endDate: isoDate(first.periodEnd ?? first.lines.at(-1)?.transactionDate) };
      });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal memuat data akuntansi.'); }
  }

  useEffect(() => { void refresh(); }, [token]);

  async function addFinance(event: React.FormEvent) {
    event.preventDefault(); setMessage('');
    try {
      const payable = payables.find((row) => `${row.referenceType}:${row.referenceId}` === form.supplierPayableKey);
      const supplierRefund = supplierRefunds.find((row) => row.purchaseReturnId === form.purchaseReturnId);
      const customerReceivable = customerReceivables.find((row) => row.orderId === form.customerOrderId);
      if (form.type === 'SUPPLIER_PAYMENT' && !payable) throw new Error('Pilih utang supplier yang akan dibayar.');
      if (form.type === 'SUPPLIER_REFUND' && !supplierRefund) throw new Error('Pilih piutang refund supplier yang akan diterima.');
      if (form.type === 'CUSTOMER_RECEIPT' && !customerReceivable) throw new Error('Pilih piutang pelanggan yang akan diterima.');
      if (form.type === 'CASH_TRANSFER' && form.settlementAccount === form.transferTargetAccount) throw new Error('Akun sumber dan tujuan transfer harus berbeda.');
      const common = { amount: Number(form.amount), idempotencyKey: requestKey.current, requireApproval: form.requireApproval };
      const payload = form.type === 'OPERATING_EXPENSE'
        ? { ...common, type: form.type, description: form.description, debitAccountCode: '6101', creditAccountCode: form.settlementAccount, paymentMethod: form.settlementAccount === '1102' ? 'BANK_TRANSFER' : 'CASH' }
        : form.type === 'OTHER_INCOME'
          ? { ...common, type: form.type, description: form.description, debitAccountCode: form.settlementAccount, creditAccountCode: '4103', paymentMethod: form.settlementAccount === '1102' ? 'BANK_TRANSFER' : 'CASH' }
          : form.type === 'TAX_PAYMENT'
            ? { ...common, type: form.type, description: `Pembayaran pajak ${form.taxPayableAccount}`, debitAccountCode: form.taxPayableAccount, creditAccountCode: form.settlementAccount, paymentMethod: form.settlementAccount === '1102' ? 'BANK_TRANSFER' : 'CASH' }
            : form.type === 'SUPPLIER_PAYMENT'
              ? { ...common, type: form.type, description: form.description || `Pembayaran ${payable!.supplierName} ${payable!.documentNumber}`, debitAccountCode: '2101', creditAccountCode: form.settlementAccount, counterpartyType: 'Supplier', counterpartyId: payable!.supplierId, counterpartyName: payable!.supplierName, paymentMethod: form.settlementAccount === '1102' ? 'BANK_TRANSFER' : 'CASH', referenceType: payable!.referenceType, referenceId: payable!.referenceId }
              : form.type === 'SUPPLIER_REFUND'
                ? { ...common, type: form.type, description: form.description || `Refund ${supplierRefund!.supplierName} ${supplierRefund!.purchaseReturnNumber}`, debitAccountCode: form.settlementAccount, creditAccountCode: '1202', counterpartyType: 'Supplier', counterpartyId: supplierRefund!.supplierId, counterpartyName: supplierRefund!.supplierName, paymentMethod: form.settlementAccount === '1102' ? 'BANK_TRANSFER' : 'CASH', referenceType: 'PurchaseReturn', referenceId: supplierRefund!.purchaseReturnId }
                : form.type === 'CUSTOMER_RECEIPT'
                  ? { ...common, type: form.type, description: form.description || `Penerimaan ${customerReceivable!.orderNumber} ${customerReceivable!.customerName}`, debitAccountCode: form.settlementAccount, creditAccountCode: customerReceivable!.receivableAccountCode, counterpartyType: 'Customer', counterpartyName: customerReceivable!.customerName, paymentMethod: form.settlementAccount === '1102' ? 'BANK_TRANSFER' : 'CASH', referenceType: 'Order', referenceId: customerReceivable!.orderId }
                  : { ...common, type: form.type, description: form.description || 'Transfer internal kas/bank', debitAccountCode: form.transferTargetAccount, creditAccountCode: form.settlementAccount, paymentMethod: 'INTERNAL_TRANSFER' };
      await api('/finance-operations', { method: 'POST', body: JSON.stringify(payload) });
      requestKey.current = newRequestKey(); setMessage(form.requireApproval ? 'Transaksi keuangan menunggu approval. Setelah disetujui, posting diperlukan agar jurnal terbentuk.' : 'Transaksi keuangan tersimpan sebagai draft. Posting diperlukan agar jurnal terbentuk.'); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal menyimpan transaksi.'); }
  }

  async function financeAction(transaction: FinanceTx, action: 'approve' | 'reject' | 'cancel' | 'post', notes = '') {
    setMessage('');
    try {
      if ((action === 'reject' || action === 'cancel') && !notes.trim()) throw new Error('Alasan wajib diisi.');
      const endpoint = action === 'post'
        ? `/finance-operations/${transaction.id}/post`
        : `/finance-operations/${transaction.id}/${action}`;
      await api(endpoint, { method: 'POST', body: JSON.stringify({ notes }) });
      setFinanceDialog(null);
      setMessage(`${transaction.number}: ${action} berhasil.`); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : `Gagal ${action} transaksi.`); }
  }

  function requestFinanceAction(transaction: FinanceTx, action: 'approve' | 'reject' | 'cancel' | 'post') {
    if (action === 'reject' || action === 'cancel') {
      setFinanceDialog({ transaction, action, notes: '' });
      return;
    }
    void financeAction(transaction, action);
  }

  async function createPeriod(event: React.FormEvent) {
    event.preventDefault(); setMessage('');
    try { await api('/finance/fiscal-periods', { method: 'POST', body: JSON.stringify(periodForm) }); setPeriodForm({ name: '', startDate: '', endDate: '' }); setMessage('Periode fiskal dibuat.'); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal membuat periode fiskal.'); }
  }
  async function periodAction(period: FiscalPeriod, action: 'soft-close' | 'reopen' | 'close') {
    setMessage('');
    try { await api(`/finance/fiscal-periods/${period.id}/${action}`, { method: 'PATCH' }); setMessage(`${period.name}: ${action} berhasil.`); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : `Gagal ${action} periode.`); }
  }

  async function createCloseControl(event: React.FormEvent) {
    event.preventDefault(); setMessage('');
    try {
      await api('/accounting-core/close-controls', { method: 'POST', body: JSON.stringify(closeControlForm) });
      setCloseControlForm({ module: 'ACCOUNTING', periodStart: '', periodEnd: '' });
      setMessage('Accounting close control dibuat dalam status OPEN. Tutup untuk memblok posting.');
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal membuat accounting close control.'); }
  }

  async function closeControlAction(control: AccountingCloseControl, action: 'close'|'reopen') {
    setMessage('');
    try {
      const reason = reopenReasons[control.id]?.trim();
      if (action === 'reopen' && !reason) { setMessage('Alasan reopen accounting close control wajib diisi.'); return; }
      const body = action === 'reopen' ? { reopenReason: reason } : undefined;
      await api(`/accounting-core/close-controls/${control.id}/${action}`, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) });
      if (action === 'reopen') setReopenReasons((current) => ({ ...current, [control.id]: '' }));
      setMessage(`${control.module}: ${action} berhasil.`);
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : `Gagal ${action} accounting close control.`); }
  }

  async function loadStatementFile(file?: File) {
    if (!file) return;
    try { const text = await file.text(); setStatementForm((current) => ({ ...current, fileName: current.fileName || file.name, linesText: text })); }
    catch { setMessage('Gagal membaca file bank statement.'); }
  }
  async function importStatement(event: React.FormEvent) {
    event.preventDefault(); setMessage('');
    try {
      const lines = parseStatementText(statementForm.linesText);
      await api('/finance/bank-statements/import', { method: 'POST', body: JSON.stringify({
        bankAccountId: statementForm.bankAccountId, source: statementForm.source, fileName: statementForm.fileName,
        periodStart: statementForm.periodStart || undefined, periodEnd: statementForm.periodEnd || undefined,
        openingBalance: statementForm.openingBalance ? parseMoney(statementForm.openingBalance) : undefined,
        closingBalance: statementForm.closingBalance ? parseMoney(statementForm.closingBalance) : undefined, lines,
      }) });
      setStatementForm((current) => ({ ...current, fileName: '', periodStart: '', periodEnd: '', openingBalance: '', closingBalance: '', linesText: '' }));
      setMessage('Bank statement berhasil diimpor dan siap direkonsiliasi.'); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal import bank statement.'); }
  }

  function chooseStatement(statementId: string) {
    const statement = statements.find((row) => row.id === statementId);
    setReconForm({ statementId, startDate: isoDate(statement?.periodStart ?? statement?.lines[0]?.transactionDate), endDate: isoDate(statement?.periodEnd ?? statement?.lines.at(-1)?.transactionDate) });
  }
  async function createReconciliation(event: React.FormEvent) {
    event.preventDefault(); setMessage('');
    try { await api('/finance/reconciliations', { method: 'POST', body: JSON.stringify(reconForm) }); setMessage('Snapshot rekonsiliasi dibuat dari journal + bank statement.'); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal membuat rekonsiliasi.'); }
  }
  async function loadReconciliation(id: string) {
    try { const details = await api<ReconciliationDetails>(`/finance/reconciliations/${id}/details`); setReconDetails(details); setManualMatches({}); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal membuka detail rekonsiliasi.'); }
  }
  async function autoMatch(reconciliation: BankReconciliation) {
    try { const result = await api<{ reconciliation: BankReconciliation; matchedThisRun: number }>(`/finance/reconciliations/${reconciliation.id}/auto-match`, { method: 'POST' }); setMessage(`Auto-match: ${result.matchedThisRun} baris baru cocok.`); await refresh(); await loadReconciliation(reconciliation.id); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Auto-match gagal.'); }
  }
  async function matchLine(statementLineId: string) {
    if (!reconDetails) return;
    const journalLineId = manualMatches[statementLineId]; if (!journalLineId) return;
    try { await api(`/finance/reconciliations/${reconDetails.reconciliation.id}/match`, { method: 'POST', body: JSON.stringify({ statementLineId, journalLineId }) }); await refresh(); await loadReconciliation(reconDetails.reconciliation.id); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Match manual gagal.'); }
  }
  async function unmatchLine(statementLineId: string) {
    if (!reconDetails) return;
    try { await api(`/finance/reconciliations/${reconDetails.reconciliation.id}/unmatch`, { method: 'POST', body: JSON.stringify({ statementLineId }) }); await refresh(); await loadReconciliation(reconDetails.reconciliation.id); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unmatch gagal.'); }
  }

  function parsePostingRuleLines(text: string): PostingRuleLine[] {
    const rows = text.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
    return rows.map((row, index) => {
      const [sideRaw, accountRaw, amountKeyRaw, descriptionRaw] = row.split('|').map((value) => value.trim());
      const side = sideRaw?.toUpperCase();
      if (side !== 'DEBIT' && side !== 'CREDIT') throw new Error(`Baris ${index + 1}: side harus DEBIT atau CREDIT.`);
      if (!accountRaw || !amountKeyRaw) throw new Error(`Baris ${index + 1}: akun dan amountKey wajib diisi.`);
      return { side, accountCode: accountRaw.toUpperCase(), amountKey: amountKeyRaw, description: descriptionRaw || undefined, skipIfZero: true };
    });
  }

  async function createAccount(event: React.FormEvent) {
    event.preventDefault(); setMessage('');
    try {
      await api('/accounting-core/accounts', { method: 'POST', body: JSON.stringify(accountForm) });
      setAccountForm({ code: '', name: '', type: 'ASSET' });
      setMessage('Akun baru dibuat pada branch aktif.'); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal membuat akun.'); }
  }

  async function updateAccount(account: Account, patch: Partial<Pick<Account, 'name'|'type'|'isActive'>>) {
    setMessage('');
    try { await api(`/accounting-core/accounts/${account.id}`, { method: 'PATCH', body: JSON.stringify(patch) }); setMessage(`Akun ${account.code} diperbarui.`); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal memperbarui akun.'); }
  }

  async function createPostingRule(event: React.FormEvent) {
    event.preventDefault(); setMessage('');
    try {
      const journalLines = parsePostingRuleLines(ruleForm.journalLinesText);
      await api('/accounting-core/posting-rules', { method: 'POST', body: JSON.stringify({ ...ruleForm, version: Number(ruleForm.version), priority: Number(ruleForm.priority), effectiveFrom: ruleForm.effectiveFrom || undefined, effectiveTo: ruleForm.effectiveTo || undefined, journalLines }) });
      setMessage(`Posting rule ${ruleForm.code} v${ruleForm.version} tersimpan.`); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal menyimpan posting rule.'); }
  }

  function cloneRuleVersion(rule: PostingRule) {
    const rows = rule.journalLines.map((line) => `${line.side}|${line.accountCode ?? line.accountCodeKey ?? ''}|${line.amountKey}|${line.description ?? ''}`).join('\n');
    setRuleForm({ code: rule.code, version: rule.version + 1, name: rule.name, eventType: rule.eventType, priority: rule.priority, status: 'DRAFT', effectiveFrom: '', effectiveTo: '', journalLinesText: rows });
  }

  async function updatePostingRuleStatus(rule: PostingRule, status: 'ACTIVE'|'INACTIVE') {
    setMessage('');
    try { await api(`/accounting-core/posting-rules/${rule.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); setMessage(`${rule.code} v${rule.version} → ${status}.`); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal mengubah status posting rule.'); }
  }

  async function loadEventDetail(id: string) {
    setMessage('');
    try { setEventDetail(await api<AccountingEventDetail>(`/accounting-core/events/${id}`)); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal membuka drill-down accounting event.'); }
  }

  const payableOptions = payables.filter((row) => Number(row.availableToPay) > 0);
  const selectedPayable = payables.find((row) => `${row.referenceType}:${row.referenceId}` === form.supplierPayableKey);
  const refundOptions = supplierRefunds.filter((row) => Number(row.availableToReceive) > 0);
  const selectedRefund = supplierRefunds.find((row) => row.purchaseReturnId === form.purchaseReturnId);
  const customerOptions = customerReceivables.filter((row) => Number(row.availableToReceive) > 0);
  const selectedCustomer = customerReceivables.find((row) => row.orderId === form.customerOrderId);
  const assetAccounts = accounts.filter((row) => row.type === 'ASSET');
  const show = (...modes: string[]) => !mode || modes.includes(mode);

  async function createReportJob(event: React.FormEvent) {
    event.preventDefault();
    try {
      const filters: Record<string, unknown> = { days: Number(reportForm.days) || 90 };
      if (reportForm.from) filters.from = reportForm.from;
      if (reportForm.to) filters.to = reportForm.to;
      const row = await api<ReportJob>('/reports/jobs', { method: 'POST', body: JSON.stringify({ reportType: reportForm.reportType, format: reportForm.format, filters }) });
      setMessage(`Export ${row.reportType} ${row.format} masuk antrean worker.`);
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal membuat export report.'); }
  }

  async function downloadReport(row: ReportJob) {
    try {
      const response = await authFetch(`${API}/reports/jobs/${row.id}/download`, token);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message ?? `Download gagal HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `${row.reportType.toLowerCase()}-${row.id}.${row.format.toLowerCase()}`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Export belum dapat diunduh.'); }
  }

  return (
    <>
      <FinanceDepthWorkspace token={token} mode={mode} />
      <section className="grid2">
        {show('ledger') && <Panel eyebrow="ACCOUNTING CORE" title="Accounting Events (Jurnal)" badge={`${events.length} event`}>
          <Table head={['Event / Source', 'Status', 'Tanggal', 'Aksi']} rows={events.slice(0, 20).map((e) => [<><strong>{e.eventType}</strong><small style={{ display: 'block', color: 'var(--muted)' }}>{e.sourceType ?? '-'} · {e.sourceId ?? '-'}</small></>, <StatusChip status={e.status} />, tanggal(e.businessDate ?? e.createdAt), <button type="button" className="secondary" onClick={() => void loadEventDetail(e.id)}>Drill-down</button>])} empty="Belum ada jurnal." />
        </Panel>}
        {show('ledger') && <Panel eyebrow="CHART OF ACCOUNTS" title="Akun Branch" badge={`${accounts.length} akun`}>
          <form onSubmit={createAccount} style={{ display: 'grid', gridTemplateColumns: '120px minmax(180px, 1fr) 150px auto', gap: 8, alignItems: 'end', marginBottom: 14 }}>
            <label>Kode<input required value={accountForm.code} onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value.toUpperCase() })} /></label>
            <label>Nama<input required value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} /></label>
            <label>Tipe<select value={accountForm.type} onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })}><option>ASSET</option><option>LIABILITY</option><option>EQUITY</option><option>REVENUE</option><option>EXPENSE</option></select></label>
            <button>Tambah akun</button>
          </form>
          <Table head={['Kode', 'Nama', 'Tipe', 'Status', 'Aksi']} rows={accounts.slice(0, 80).map((a) => [<strong>{a.code}</strong>, a.name, a.type, <StatusChip status={a.isActive ? 'ACTIVE' : 'INACTIVE'} />, <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}><button type="button" className="secondary" onClick={() => setAccountEditDialog({ account: a, name: a.name })}>Edit nama</button><button type="button" className="secondary" onClick={() => void updateAccount(a, { isActive: !a.isActive })}>{a.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button></span>])} empty="Belum ada chart of accounts." />
        </Panel>}
      </section>

      {show('tax') && <TaxWorkspace token={token} onOpenAccountingEvent={(id) => void loadEventDetail(id)} />}

      {show('ledger') && <Panel eyebrow="POSTING RULES" title="Versioned Account Mapping" badge={`${postingRules.length} rule`}>
        <form onSubmit={createPostingRule} style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
          <section className="grid2">
            <label>Kode rule<input required value={ruleForm.code} onChange={(e) => setRuleForm({ ...ruleForm, code: e.target.value.toUpperCase() })} placeholder="SALE-CASH" /></label>
            <label>Nama<input required value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} /></label>
            <label>Event type<input required value={ruleForm.eventType} onChange={(e) => setRuleForm({ ...ruleForm, eventType: e.target.value.toUpperCase() })} placeholder="SALE_CASH" /></label>
            <label>Version<input type="number" min="1" required value={ruleForm.version} onChange={(e) => setRuleForm({ ...ruleForm, version: Number(e.target.value) })} /></label>
            <label>Priority<input type="number" required value={ruleForm.priority} onChange={(e) => setRuleForm({ ...ruleForm, priority: Number(e.target.value) })} /></label>
            <label>Status<select value={ruleForm.status} onChange={(e) => setRuleForm({ ...ruleForm, status: e.target.value })}><option>DRAFT</option><option>ACTIVE</option></select></label>
            <label>Efektif dari<input type="date" value={ruleForm.effectiveFrom} onChange={(e) => setRuleForm({ ...ruleForm, effectiveFrom: e.target.value })} /></label>
            <label>Efektif sampai<input type="date" value={ruleForm.effectiveTo} onChange={(e) => setRuleForm({ ...ruleForm, effectiveTo: e.target.value })} /></label>
          </section>
          <label>Journal mapping <small>(SIDE|ACCOUNT_CODE|AMOUNT_KEY|DESCRIPTION)</small><textarea rows={5} required value={ruleForm.journalLinesText} onChange={(e) => setRuleForm({ ...ruleForm, journalLinesText: e.target.value })} /></label>
          <div><button>Simpan version</button></div>
        </form>
        <Table head={['Rule', 'Event', 'Version', 'Priority', 'Efektif', 'Status', 'Aksi']} rows={postingRules.map((rule) => [<><strong>{rule.code}</strong><small style={{ display: 'block', color: 'var(--muted)' }}>{rule.name}</small></>, rule.eventType, `v${rule.version}`, String(rule.priority), `${isoDate(rule.effectiveFrom) || '∞'} → ${isoDate(rule.effectiveTo) || '∞'}`, <StatusChip status={rule.status} />, <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}><button type="button" className="secondary" onClick={() => cloneRuleVersion(rule)}>Buat v{rule.version + 1}</button>{rule.status !== 'ACTIVE' && <button type="button" onClick={() => void updatePostingRuleStatus(rule, 'ACTIVE')}>Aktifkan</button>}{rule.status === 'ACTIVE' && <button type="button" className="secondary" onClick={() => void updatePostingRuleStatus(rule, 'INACTIVE')}>Nonaktifkan</button>}</span>])} empty="Belum ada posting rule." />
        <p className="sectionHelp">Rule yang pernah ACTIVE atau sudah dipakai posting tidak dapat ditimpa. Koreksi mapping dilakukan dengan version baru agar histori journal tetap reproducible.</p>
      </Panel>}

      {show('ledger') && eventDetail && <Panel eyebrow="ACCOUNTING DRILL-DOWN" title={`${eventDetail.event.eventType} · ${eventDetail.source.type}:${eventDetail.source.id}`} badge={eventDetail.event.status}>
        <section className="grid2">
          <div><strong>Rule</strong><p>{eventDetail.rules.map((rule) => `${rule.code} v${rule.version}`).join(', ') || '-'}</p></div>
          <div><strong>Journal</strong><p>{eventDetail.journalEntry ? `${eventDetail.journalEntry.number} · ${tanggal(eventDetail.journalEntry.date)}` : '-'}</p></div>
        </section>
        <Table head={['Akun', 'Nama', 'Debit', 'Kredit']} rows={(eventDetail.journalEntry?.lines ?? []).map((line) => [<strong>{line.account.code}</strong>, line.account.name, rupiah(Number(line.debit)), rupiah(Number(line.credit))])} empty="Journal line belum tersedia." />
        <Table head={['Event line', 'Net', 'Tax', 'Gross']} rows={eventDetail.event.lines.map((line) => [line.description ?? `Line ${line.lineNumber}`, rupiah(Number(line.netAmount)), rupiah(Number(line.taxAmount)), rupiah(Number(line.grossAmount))])} empty="Event line belum tersedia." />
        <button type="button" className="secondary" onClick={() => setEventDetail(null)}>Tutup detail</button>
      </Panel>}

      {show('fiscal') && <Panel eyebrow="PERIODE FISKAL" title="Open → Soft Close → Final Close" badge={`${periods.length} periode`}>
        <form onSubmit={createPeriod} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 160px auto', gap: 10, alignItems: 'end', marginBottom: 16 }}>
          <label>Nama<input required value={periodForm.name} onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })} placeholder="September 2026" /></label>
          <label>Mulai<input required type="date" value={periodForm.startDate} onChange={(e) => setPeriodForm({ ...periodForm, startDate: e.target.value })} /></label>
          <label>Selesai<input required type="date" value={periodForm.endDate} onChange={(e) => setPeriodForm({ ...periodForm, endDate: e.target.value })} /></label>
          <button>Buat periode</button>
        </form>
        <Table head={['Periode', 'Rentang', 'Status', 'Aksi']} rows={periods.map((period) => [
          <strong>{period.name}</strong>, `${tanggal(period.startDate)} – ${tanggal(period.endDate)}`, <StatusChip status={period.status} />,
          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {period.status === 'OPEN' && <button type="button" className="secondary" onClick={() => void periodAction(period, 'soft-close')}>Soft close</button>}
            {period.status === 'SOFT_CLOSED' && <><button type="button" className="secondary" onClick={() => void periodAction(period, 'reopen')}>Reopen</button><button type="button" onClick={() => void periodAction(period, 'close')}>Final close</button></>}
            {period.status === 'CLOSED' && <small>Final</small>}
          </span>,
        ])} empty="Belum ada periode fiskal." />
      </Panel>}

      {show('fiscal') && <Panel eyebrow="ACCOUNTING CLOSE CONTROL" title="Runtime posting lock" badge={`${closeControls.filter((row) => row.status === 'CLOSED').length} closed`}>
        <form onSubmit={createCloseControl} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 160px auto', gap: 10, alignItems: 'end', marginBottom: 16 }}>
          <label>Module<input required value={closeControlForm.module} onChange={(e) => setCloseControlForm({ ...closeControlForm, module: e.target.value.toUpperCase() })} /></label>
          <label>Mulai<input required type="date" value={closeControlForm.periodStart} onChange={(e) => setCloseControlForm({ ...closeControlForm, periodStart: e.target.value })} /></label>
          <label>Selesai<input required type="date" value={closeControlForm.periodEnd} onChange={(e) => setCloseControlForm({ ...closeControlForm, periodEnd: e.target.value })} /></label>
          <button>Buat control</button>
        </form>
        <Table head={['Module','Periode','Status','Aksi']} rows={closeControls.map((row) => [row.module, `${tanggal(row.periodStart)} – ${tanggal(row.periodEnd)}`, <StatusChip status={row.status} />, row.status === 'OPEN' ? <button type="button" onClick={() => void closeControlAction(row, 'close')}>Close posting</button> : <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><input aria-label={`Alasan reopen ${row.module}`} placeholder="Alasan reopen" value={reopenReasons[row.id] ?? ''} onChange={(event) => setReopenReasons((current) => ({ ...current, [row.id]: event.target.value }))} /><button type="button" className="secondary" onClick={() => void closeControlAction(row, 'reopen')}>Reopen</button></span>])} empty="Belum ada accounting close control." />
        <p className="sectionHelp">Close control CLOSED memblokir posting accounting event pada rentang tanggal tersebut, termasuk posting operasional yang masuk melalui accounting core.</p>
      </Panel>}

      {show('payables') && <Panel eyebrow="UTANG USAHA" title="Utang Supplier per Dokumen" badge={`${payables.filter((row) => Number(row.outstandingAmount) > 0).length} terbuka`}>
        <Table head={['Supplier / Dokumen', 'Sumber', 'Tagihan', 'Retur', 'Sudah Dibayar', 'Pending', 'Sisa']} rows={payables.filter((row) => Number(row.outstandingAmount) > 0).map((row) => [
          <><strong>{row.supplierName}</strong><small style={{ display: 'block', color: 'var(--muted)' }}>{row.documentNumber}</small></>,
          row.referenceType === 'Asset' ? `Aset · ${row.assetName ?? row.assetCode ?? '-'}` : row.referenceType === 'MaintenanceWorkOrder' ? `Maintenance · ${row.sourceName ?? row.documentNumber}` : row.referenceType === 'FuelTransaction' ? `BBM · ${row.sourceName ?? row.documentNumber}` : `GR · ${row.purchaseOrderNumber ?? '-'}`,
          rupiah(Number(row.grossAmount)), rupiah(Number(row.returnedAmount)), rupiah(Number(row.paidAmount)), rupiah(Number(row.pendingPaymentAmount)), <strong>{rupiah(Number(row.outstandingAmount))}</strong>,
        ])} empty="Tidak ada utang supplier terbuka." />
      </Panel>}

      {show('receivables') && <section className="grid2">
        <Panel eyebrow="REFUND SUPPLIER" title="Piutang Refund Supplier" badge={`${supplierRefunds.filter((row) => Number(row.outstandingAmount) > 0).length} terbuka`}>
          <Table head={['Supplier / Retur', 'Credit Note', 'Piutang', 'Diterima', 'Pending', 'Sisa']} rows={supplierRefunds.filter((row) => Number(row.outstandingAmount) > 0).map((row) => [<><strong>{row.supplierName}</strong><small style={{ display: 'block', color: 'var(--muted)' }}>{row.purchaseReturnNumber}</small></>, row.creditNoteNumber ?? '-', rupiah(Number(row.receivableAmount)), rupiah(Number(row.receivedAmount)), rupiah(Number(row.pendingAmount)), <strong>{rupiah(Number(row.outstandingAmount))}</strong>])} empty="Tidak ada refund supplier terbuka." />
        </Panel>
        <Panel eyebrow="PIUTANG PELANGGAN" title="COD / Invoice" badge={`${customerReceivables.filter((row) => Number(row.outstandingAmount) > 0).length} terbuka`}>
          <Table head={['Order', 'Pelanggan', 'Metode', 'Piutang', 'Diterima', 'Sisa']} rows={customerReceivables.filter((row) => Number(row.outstandingAmount) > 0).map((row) => [<strong>{row.orderNumber}</strong>, row.customerName, row.paymentMethod, rupiah(Number(row.grossAmount)), rupiah(Number(row.receivedAmount)), <strong>{rupiah(Number(row.outstandingAmount))}</strong>])} empty="Tidak ada piutang pelanggan terbuka." />
        </Panel>
      </section>}

      {show('banking') && <Panel eyebrow="KAS & BANK" title="Transaksi Keuangan Operasional" badge={`${finances.length} transaksi`}>
        <form onSubmit={addFinance} style={{ display: 'grid', gridTemplateColumns: '170px minmax(220px, 1fr) 150px 150px auto', gap: 10, alignItems: 'end', marginBottom: 16 }}>
          <label>Jenis<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as FinanceType })}><option value="OPERATING_EXPENSE">Beban operasional</option><option value="OTHER_INCOME">Pendapatan lain</option><option value="TAX_PAYMENT">Bayar pajak</option><option value="SUPPLIER_PAYMENT">Bayar supplier</option><option value="SUPPLIER_REFUND">Terima refund supplier</option><option value="CUSTOMER_RECEIPT">Terima piutang pelanggan</option><option value="CASH_TRANSFER">Transfer kas/bank</option></select></label>
          {form.type === 'TAX_PAYMENT' ? <label>Utang pajak<select value={form.taxPayableAccount} onChange={(e) => setForm({ ...form, taxPayableAccount: e.target.value })}><option value="2201">Pajak Keluaran (2201)</option><option value="2202">Utang Pajak Lainnya (2202)</option><option value="2103">Pajak Payroll (2103)</option></select></label>
            : form.type === 'SUPPLIER_PAYMENT' ? <label>Utang / Dokumen<select required value={form.supplierPayableKey} onChange={(e) => { const row = payables.find((x) => `${x.referenceType}:${x.referenceId}` === e.target.value); setForm({ ...form, supplierPayableKey: e.target.value, amount: Number(row?.availableToPay ?? 0), description: row ? `Pembayaran ${row.supplierName} ${row.documentNumber}` : '' }); }}><option value="">Pilih utang supplier</option>{payableOptions.map((row) => <option key={`${row.referenceType}:${row.referenceId}`} value={`${row.referenceType}:${row.referenceId}`}>{row.supplierName} · {row.documentNumber} · {rupiah(Number(row.availableToPay))}</option>)}</select></label>
              : form.type === 'SUPPLIER_REFUND' ? <label>Refund / Purchase Return<select required value={form.purchaseReturnId} onChange={(e) => { const row = supplierRefunds.find((x) => x.purchaseReturnId === e.target.value); setForm({ ...form, purchaseReturnId: e.target.value, amount: Number(row?.availableToReceive ?? 0), description: row ? `Refund ${row.supplierName} ${row.purchaseReturnNumber}` : '' }); }}><option value="">Pilih refund supplier</option>{refundOptions.map((row) => <option key={row.purchaseReturnId} value={row.purchaseReturnId}>{row.supplierName} · {row.purchaseReturnNumber} · {rupiah(Number(row.availableToReceive))}</option>)}</select></label>
                : form.type === 'CUSTOMER_RECEIPT' ? <label>Piutang / Order<select required value={form.customerOrderId} onChange={(e) => { const row = customerReceivables.find((x) => x.orderId === e.target.value); setForm({ ...form, customerOrderId: e.target.value, amount: Number(row?.availableToReceive ?? 0), description: row ? `Penerimaan ${row.orderNumber} ${row.customerName}` : '' }); }}><option value="">Pilih piutang pelanggan</option>{customerOptions.map((row) => <option key={row.orderId} value={row.orderId}>{row.orderNumber} · {row.customerName} · {rupiah(Number(row.availableToReceive))}</option>)}</select></label>
                  : <label>Keterangan<input required={form.type !== 'CASH_TRANSFER'} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>}
          <label>Nominal<input required type="number" min="1" max={form.type === 'SUPPLIER_PAYMENT' ? Number(selectedPayable?.availableToPay ?? 0) || undefined : form.type === 'SUPPLIER_REFUND' ? Number(selectedRefund?.availableToReceive ?? 0) || undefined : form.type === 'CUSTOMER_RECEIPT' ? Number(selectedCustomer?.availableToReceive ?? 0) || undefined : undefined} value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></label>
          <label>{form.type === 'CASH_TRANSFER' ? 'Sumber' : 'Kas/Bank'}<select value={form.settlementAccount} onChange={(e) => setForm({ ...form, settlementAccount: e.target.value })}>{assetAccounts.map((account) => <option key={account.id} value={account.code}>{account.code} · {account.name}</option>)}</select></label>
          <button>Simpan</button>
          {form.type === 'CASH_TRANSFER' && <label>Tujuan<select value={form.transferTargetAccount} onChange={(e) => setForm({ ...form, transferTargetAccount: e.target.value })}>{assetAccounts.map((account) => <option key={account.id} value={account.code}>{account.code} · {account.name}</option>)}</select></label>}
          <label style={{ alignSelf: 'center' }}><input type="checkbox" checked={form.requireApproval} onChange={(e) => setForm({ ...form, requireApproval: e.target.checked })} /> Wajib approval</label>
        </form>
        <Table head={['Nomor', 'Jenis', 'Keterangan', 'Nominal', 'Debit→Kredit', 'Status', 'Aksi']} rows={finances.map((f) => [<strong>{f.number}</strong>, f.type, f.description ?? '-', rupiah(Number(f.grossAmount)), <small style={{ color: 'var(--muted)' }}>{f.debitAccountCode} → {f.creditAccountCode}</small>, <StatusChip status={f.status} />, <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {f.status === 'WAITING_APPROVAL' && <><button type="button" onClick={() => requestFinanceAction(f, 'approve')}>Approve</button><button type="button" className="secondary" onClick={() => requestFinanceAction(f, 'reject')}>Reject</button></>}
          {['DRAFT', 'APPROVED'].includes(f.status) && <button type="button" className="secondary" onClick={() => requestFinanceAction(f, 'post')}>Posting</button>}
          {['DRAFT', 'WAITING_APPROVAL', 'APPROVED'].includes(f.status) && <button type="button" className="secondary" onClick={() => requestFinanceAction(f, 'cancel')}>Batal</button>}
        </span>])} empty="Belum ada transaksi kas." />
      </Panel>}

      {show('banking') && <Panel eyebrow="BANK STATEMENT" title="Import Statement untuk Rekonsiliasi" badge={`${statements.length} file`}>
        <form onSubmit={importStatement} style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
          <section className="grid2">
            <label>Akun bank<select required value={statementForm.bankAccountId} onChange={(e) => setStatementForm({ ...statementForm, bankAccountId: e.target.value })}><option value="">Pilih akun bank</option>{assetAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></label>
            <label>Sumber<input required value={statementForm.source} onChange={(e) => setStatementForm({ ...statementForm, source: e.target.value })} placeholder="BCA / Mandiri / CSV" /></label>
            <label>Nama file<input required value={statementForm.fileName} onChange={(e) => setStatementForm({ ...statementForm, fileName: e.target.value })} placeholder="statement-2026-09.csv" /></label>
            <label>Baca CSV/TXT<input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => void loadStatementFile(e.target.files?.[0])} /></label>
            <label>Periode mulai<input type="date" value={statementForm.periodStart} onChange={(e) => setStatementForm({ ...statementForm, periodStart: e.target.value })} /></label>
            <label>Periode selesai<input type="date" value={statementForm.periodEnd} onChange={(e) => setStatementForm({ ...statementForm, periodEnd: e.target.value })} /></label>
            <label>Saldo awal<input value={statementForm.openingBalance} onChange={(e) => setStatementForm({ ...statementForm, openingBalance: e.target.value })} /></label>
            <label>Saldo akhir<input value={statementForm.closingBalance} onChange={(e) => setStatementForm({ ...statementForm, closingBalance: e.target.value })} /></label>
          </section>
          <label>Baris statement (tanggal|deskripsi|referensi|debit|credit|balance)<textarea required rows={6} value={statementForm.linesText} onChange={(e) => setStatementForm({ ...statementForm, linesText: e.target.value })} placeholder={'2026-09-01|SETORAN POS|POS-001|0|150000|150000\n2026-09-02|BIAYA BANK|ADM|10000|0|140000'} /></label>
          <button>Import bank statement</button>
        </form>
        <Table head={['File', 'Sumber', 'Periode', 'Baris']} rows={statements.map((row) => [<strong>{row.fileName ?? row.id}</strong>, row.source, `${isoDate(row.periodStart)} – ${isoDate(row.periodEnd)}`, String(row.lines.length)])} empty="Belum ada bank statement." />
      </Panel>}

      {show('banking') && <Panel eyebrow="REKONSILIASI BANK" title="Statement ↔ Journal" badge={`${reconciliations.length} rekonsiliasi`}>
        <form onSubmit={createReconciliation} style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) 160px 160px auto', gap: 10, alignItems: 'end', marginBottom: 16 }}>
          <label>Statement<select required value={reconForm.statementId} onChange={(e) => chooseStatement(e.target.value)}><option value="">Pilih statement</option>{statements.map((row) => <option key={row.id} value={row.id}>{row.fileName ?? row.id} · {row.source}</option>)}</select></label>
          <label>Mulai<input required type="date" value={reconForm.startDate} onChange={(e) => setReconForm({ ...reconForm, startDate: e.target.value })} /></label>
          <label>Selesai<input required type="date" value={reconForm.endDate} onChange={(e) => setReconForm({ ...reconForm, endDate: e.target.value })} /></label>
          <button>Buat snapshot</button>
        </form>
        <Table head={['Periode', 'Saldo Buku', 'Saldo Bank', 'Selisih', 'Matched', 'Status', 'Aksi']} rows={reconciliations.map((row) => [
          `${tanggal(row.startDate)} – ${tanggal(row.endDate)}`, rupiah(Number(row.bookBalance)), rupiah(Number(row.bankBalance)), <strong>{rupiah(Number(row.difference))}</strong>, String(row.matchedCount), <StatusChip status={row.status} />,
          <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}><button type="button" className="secondary" onClick={() => void autoMatch(row)}>Auto-match</button><button type="button" className="secondary" onClick={() => void loadReconciliation(row.id)}>Detail</button></span>,
        ])} empty="Belum ada rekonsiliasi." />
        {reconDetails && <div style={{ marginTop: 18 }}>
          <h3>Detail rekonsiliasi · {reconDetails.reconciliation.status}</h3>
          <Table head={['Tanggal', 'Statement', 'Debit/Credit', 'Match', 'Aksi']} rows={reconDetails.statementLines.map((line) => {
            const amount = Number(line.credit) > 0 ? `+${rupiah(Number(line.credit))}` : `-${rupiah(Number(line.debit))}`;
            const candidates = reconDetails.journalLines.filter((journal) => Number(line.credit) > 0 ? Number(journal.debit) === Number(line.credit) && Number(journal.credit) === 0 : Number(journal.credit) === Number(line.debit) && Number(journal.debit) === 0);
            return [tanggal(line.transactionDate), <><strong>{line.description}</strong><small style={{ display: 'block', color: 'var(--muted)' }}>{line.reference ?? '-'}</small></>, amount, line.matched ? <StatusChip status="COMPLETED" /> : <StatusChip status="PENDING" />, line.matched ? <button type="button" className="secondary" onClick={() => void unmatchLine(line.id)}>Unmatch</button> : <span style={{ display: 'flex', gap: 5 }}><select value={manualMatches[line.id] ?? ''} onChange={(e) => setManualMatches({ ...manualMatches, [line.id]: e.target.value })}><option value="">Pilih journal</option>{candidates.map((journal) => <option key={journal.id} value={journal.id}>{journal.journalEntry.number} · {tanggal(journal.journalEntry.date)} · {journal.journalEntry.description}</option>)}</select><button type="button" onClick={() => void matchLine(line.id)}>Match</button></span>];
          })} empty="Tidak ada baris statement pada rentang ini." />
        </div>}
      </Panel>}

      {show('reports') && <ReportingWorkspace token={token} />}

      {financeDialog && <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="finance-action-title">
        <div className="modalCard">
          <span className="eyebrow">FINANCE CONTROL</span>
          <h2 id="finance-action-title">{financeDialog.action === 'reject' ? 'Tolak' : 'Batalkan'} {financeDialog.transaction.number}</h2>
          <p className="sectionHelp">Alasan tersimpan sebagai evidence operasional dan tidak boleh kosong.</p>
          <label>Alasan<textarea autoFocus value={financeDialog.notes} onChange={(event) => setFinanceDialog({ ...financeDialog, notes: event.target.value })} /></label>
          <div className="modalActions"><button type="button" className="secondary" onClick={() => setFinanceDialog(null)}>Kembali</button><button type="button" className="dangerButton" disabled={!financeDialog.notes.trim()} onClick={() => void financeAction(financeDialog.transaction, financeDialog.action, financeDialog.notes)}>Konfirmasi</button></div>
        </div>
      </div>}

      {accountEditDialog && <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="account-edit-title">
        <div className="modalCard">
          <span className="eyebrow">CHART OF ACCOUNTS</span>
          <h2 id="account-edit-title">Edit nama akun {accountEditDialog.account.code}</h2>
          <label>Nama akun<input autoFocus value={accountEditDialog.name} onChange={(event) => setAccountEditDialog({ ...accountEditDialog, name: event.target.value })} /></label>
          <div className="modalActions"><button type="button" className="secondary" onClick={() => setAccountEditDialog(null)}>Batal</button><button type="button" disabled={!accountEditDialog.name.trim()} onClick={() => { void updateAccount(accountEditDialog.account, { name: accountEditDialog.name.trim() }); setAccountEditDialog(null); }}>Simpan</button></div>
        </div>
      </div>}

      {message && <div className="notice" style={{ marginTop: 12 }}>{message}</div>}
    </>
  );
}
