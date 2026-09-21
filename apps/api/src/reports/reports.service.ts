import { BadRequestException, ForbiddenException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { existsSync, createReadStream, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { decodeCursor, parsePageLimit, toCursorPage } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportJobDto } from './dto/create-report-job.dto';

type DbClient = Prisma.TransactionClient | PrismaService;
type TenantScope = { companyId: string; branchId: string };

function parseDate(value: string | undefined, fallback: Date, endOfDay = false): Date {
  if (!value) return fallback;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = dateOnly
    ? new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`)
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Format tanggal tidak valid.');
  return parsed;
}

function accountNormalBalance(type: string, debit: Prisma.Decimal, credit: Prisma.Decimal): Prisma.Decimal {
  return ['ASSET', 'EXPENSE'].includes(type) ? debit.sub(credit) : credit.sub(debit);
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenantScope(user: AuthUser): TenantScope {
    if (!user.companyId || !user.branchId) {
      throw new ForbiddenException({
        code: 'TENANT_CONTEXT_REQUIRED',
        message: 'Pengguna belum memiliki company dan branch yang valid.',
      });
    }
    return { companyId: user.companyId, branchId: user.branchId };
  }

  private async denyTenantAccess(
    client: DbClient,
    user: AuthUser,
    scope: TenantScope,
    entityType: string,
    entityId?: string,
    payload?: Prisma.InputJsonValue,
  ): Promise<never> {
    await client.auditLog.create({
      data: {
        companyId: scope.companyId,
        userId: user.sub,
        action: 'TENANT_ACCESS_DENIED',
        entityType,
        entityId,
        payload: payload ?? {
          authenticatedCompanyId: scope.companyId,
          authenticatedBranchId: scope.branchId,
        },
      },
    });
    throw new ForbiddenException({
      code: 'TENANT_ACCESS_DENIED',
      message: `${entityType} tidak tersedia dalam company dan branch pengguna.`,
    });
  }

  private async assertRequestedScope(
    client: DbClient,
    user: AuthUser,
    scope: TenantScope,
    requestedCompanyId?: string,
    requestedBranchId?: string,
    entityType = 'Report',
  ): Promise<void> {
    if ((requestedCompanyId && requestedCompanyId !== scope.companyId)
      || (requestedBranchId && requestedBranchId !== scope.branchId)) {
      await this.denyTenantAccess(client, user, scope, entityType, undefined, {
        authenticatedCompanyId: scope.companyId,
        authenticatedBranchId: scope.branchId,
        ...(requestedCompanyId ? { requestedCompanyId } : {}),
        ...(requestedBranchId ? { requestedBranchId } : {}),
      });
    }
  }

  private async branchWarehouseIds(client: DbClient, user: AuthUser, scope: TenantScope): Promise<string[]> {
    const branch = await client.branch.findFirst({
      where: { id: scope.branchId, companyId: scope.companyId },
      select: { id: true },
    });
    if (!branch) return this.denyTenantAccess(client, user, scope, 'Branch', scope.branchId);
    const warehouses = await client.warehouse.findMany({
      where: { branchId: scope.branchId, branch: { companyId: scope.companyId } },
      select: { id: true },
    });
    return warehouses.map((warehouse) => warehouse.id);
  }

  private async accountActivity(scope: TenantScope, from?: Date, to?: Date) {
    const grouped = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        ...(from || to ? { journalEntry: { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } } : {}),
        account: { branchId: scope.branchId, branch: { companyId: scope.companyId } },
      },
      _sum: { debit: true, credit: true },
    });
    const ids = grouped.map((row) => row.accountId);
    const accounts = ids.length ? await this.prisma.account.findMany({
      where: { id: { in: ids }, branchId: scope.branchId, branch: { companyId: scope.companyId } },
      select: { id: true, code: true, name: true, type: true },
      orderBy: { code: 'asc' },
    }) : [];
    const activity = new Map(grouped.map((row) => [row.accountId, row]));
    return accounts.map((account) => {
      const row = activity.get(account.id);
      const debit = new Prisma.Decimal(row?._sum.debit ?? 0);
      const credit = new Prisma.Decimal(row?._sum.credit ?? 0);
      return { ...account, debit, credit, balance: accountNormalBalance(account.type, debit, credit) };
    });
  }

  private reportRange(fromValue?: string, toValue?: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const from = parseDate(fromValue, monthStart, false);
    const to = parseDate(toValue, now, true);
    if (from > to) throw new BadRequestException('Tanggal awal tidak boleh melebihi tanggal akhir.');
    return { from, to };
  }

  async dashboard(user: AuthUser) {
    const scope = this.requireTenantScope(user);
    const warehouseIds = await this.branchWarehouseIds(this.prisma, user, scope);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const now = new Date();
    const [financialActivity, recognizedTransactions, inventorySummary, inventoryTotals, pendingOrders, recentReceipts] = await Promise.all([
      this.accountActivity(scope, start, now),
      this.prisma.accountingEvent.count({
        where: {
          companyId: scope.companyId,
          branchId: scope.branchId,
          status: 'POSTED',
          businessDate: { gte: start, lte: now },
          eventType: { in: ['SALE_CASH', 'SALE_BANK', 'ONLINE_ORDER_PREPAID_FULFILLED', 'ONLINE_ORDER_CREDIT_FULFILLED'] },
        },
      }),
      this.prisma.dailyInventorySummary.findFirst({
        where: { companyId: scope.companyId, warehouseId: { in: warehouseIds } },
        orderBy: [{ businessDate: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.inventory.aggregate({
        where: { warehouseId: { in: warehouseIds } },
        _count: true,
        _sum: { quantity: true, reserved: true, available: true },
      }),
      this.prisma.order.count({
        where: {
          branchId: scope.branchId,
          branch: { companyId: scope.companyId },
          status: { in: ['PAID', 'PROCESSING', 'PACKED'] },
        },
      }),
      this.prisma.goodsReceipt.findMany({
        where: { warehouseId: { in: warehouseIds } },
        include: { supplier: true },
        orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
        take: 5,
      }),
    ]);

    const revenue = financialActivity.filter((row) => row.type === 'REVENUE')
      .reduce((sum, row) => sum.add(row.balance), new Prisma.Decimal(0));
    const cogs = financialActivity.filter((row) => row.code === '5101')
      .reduce((sum, row) => sum.add(row.balance), new Prisma.Decimal(0));
    const expenses = financialActivity.filter((row) => row.type === 'EXPENSE')
      .reduce((sum, row) => sum.add(row.balance), new Prisma.Decimal(0));
    const netProfit = revenue.sub(expenses);
    return {
      companyId: scope.companyId,
      branchId: scope.branchId,
      today: {
        revenue: Number(revenue),
        recognizedRevenue: Number(revenue),
        transactions: recognizedTransactions,
        cogs: Number(cogs),
        grossProfit: Number(revenue.sub(cogs)),
        expenses: Number(expenses),
        netProfit: Number(netProfit),
        source: 'POSTED_JOURNAL',
      },
      inventory: {
        items: inventorySummary?.skuCount ?? inventoryTotals._count,
        lowStock: inventorySummary?.lowStockCount ?? 0,
        value: Number(inventorySummary?.inventoryValue ?? 0),
        quantity: inventorySummary?.quantity ?? inventoryTotals._sum.quantity ?? 0,
        reserved: inventorySummary?.reserved ?? inventoryTotals._sum.reserved ?? 0,
        available: inventorySummary?.available ?? inventoryTotals._sum.available ?? 0,
        source: inventorySummary ? 'DAILY_SUMMARY' : 'LIVE_TOTALS_WITHOUT_VALUE',
      },
      pendingOrders,
      recentReceipts,
    };
  }

  async analytics(user: AuthUser) {
    const scope = this.requireTenantScope(user);
    const start = new Date();
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);

    // Gunakan jurnal POSTED sebagai sumber kebenaran analitik keuangan. Daily summary boleh kosong
    // pada instalasi yang belum menjalankan materializer, jadi dashboard tidak boleh bergantung padanya.
    const [recognizedEvents, cogsLines, cashLines] = await Promise.all([
      this.prisma.accountingEvent.findMany({
        where: {
          companyId: scope.companyId,
          branchId: scope.branchId,
          status: 'POSTED',
          businessDate: { gte: start },
          eventType: { in: ['SALE_CASH', 'SALE_BANK', 'ONLINE_ORDER_PREPAID_FULFILLED', 'ONLINE_ORDER_CREDIT_FULFILLED', 'SALE_RETURN', 'ORDER_RETURN'] },
        },
        select: { businessDate: true, eventType: true, netAmount: true },
        orderBy: { businessDate: 'asc' },
      }),
      this.prisma.journalLine.findMany({
        where: {
          account: { branchId: scope.branchId, branch: { companyId: scope.companyId }, code: '5101' },
          journalEntry: { date: { gte: start } },
        },
        select: { debit: true, credit: true, journalEntry: { select: { date: true } } },
      }),
      this.prisma.journalLine.findMany({
        where: {
          account: { branchId: scope.branchId, branch: { companyId: scope.companyId }, code: { in: ['1101', '1102', '1103'] } },
          journalEntry: { date: { gte: start } },
        },
        select: { debit: true, credit: true, journalEntry: { select: { date: true, description: true } } },
      }),
    ]);
    const salesByDay = new Map<string, { revenue: number; cogs: number; transactions: number }>();
    const channelRevenue = new Map<string, number>();
    for (const event of recognizedEvents) {
      const key = new Date(event.businessDate).toISOString().slice(0, 10);
      const bucket = salesByDay.get(key) ?? { revenue: 0, cogs: 0, transactions: 0 };
      const signedRevenue = ['SALE_RETURN','ORDER_RETURN'].includes(event.eventType) ? -Number(event.netAmount) : Number(event.netAmount);
      bucket.revenue += signedRevenue;
      if (!['SALE_RETURN','ORDER_RETURN'].includes(event.eventType)) bucket.transactions += 1;
      salesByDay.set(key, bucket);
      const channel = event.eventType.startsWith('ONLINE_ORDER_') ? 'STOREFRONT' : 'POS';
      channelRevenue.set(channel, (channelRevenue.get(channel) ?? 0) + signedRevenue);
    }
    for (const line of cogsLines) {
      const key = new Date(line.journalEntry.date).toISOString().slice(0, 10);
      const bucket = salesByDay.get(key) ?? { revenue: 0, cogs: 0, transactions: 0 };
      bucket.cogs += Number(line.debit) - Number(line.credit);
      salesByDay.set(key, bucket);
    }
    const cashByDay = new Map<string, { cashIn: number; cashOut: number }>();
    for (const line of cashLines) {
      // Transfer internal Kas <-> Bank bukan arus kas perusahaan dan sengaja dikeluarkan.
      if (line.journalEntry.description.startsWith('BALANCE_TRANSFER ')) continue;
      const key = new Date(line.journalEntry.date).toISOString().slice(0, 10);
      const bucket = cashByDay.get(key) ?? { cashIn: 0, cashOut: 0 };
      bucket.cashIn += Number(line.debit);
      bucket.cashOut += Number(line.credit);
      cashByDay.set(key, bucket);
    }
    const topItems = await this.prisma.saleItem.groupBy({
      by: ['productId'],
      where: { sale: { branchId: scope.branchId, branch: { companyId: scope.companyId }, status: 'COMPLETED' } },
      _sum: { quantity: true, grossSubtotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });
    const productIds = topItems.map((row) => row.productId);
    const products = productIds.length ? await this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, sku: true } }) : [];
    const lowStock = await this.prisma.inventory.findMany({
      where: { warehouseId: { in: await this.branchWarehouseIds(this.prisma, user, scope) } },
      include: { product: true, warehouse: true },
      orderBy: { available: 'asc' },
      take: 5,
    });

    return {
      salesTrend: [...salesByDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, row]) => ({
        date,
        revenue: row.revenue,
        profit: row.revenue - row.cogs,
        transactions: row.transactions,
      })),
      channels: [...channelRevenue.entries()].map(([channel, revenue]) => ({ channel, revenue })),
      cashFlow: [...cashByDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({
        date,
        cashIn: amount.cashIn,
        cashOut: amount.cashOut,
        netCashFlow: amount.cashIn - amount.cashOut,
      })),
      topProducts: topItems.map((row) => ({
        name: products.find((p) => p.id === row.productId)?.name ?? '(produk terhapus)',
        sku: products.find((p) => p.id === row.productId)?.sku ?? '-',
        quantity: row._sum.quantity ?? 0,
        revenue: Number(row._sum.grossSubtotal ?? 0),
      })),
      lowStock: lowStock.map((row) => ({ name: row.product.name, warehouse: row.warehouse.name, available: row.available, minStock: row.product.minStock })),
    };
  }

  async profitLoss(
    user: AuthUser,
    fromValue?: string,
    toValue?: string,
    requestedCompanyId?: string,
    requestedBranchId?: string,
  ) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, requestedCompanyId, requestedBranchId, 'ProfitLossReport');
    const { from, to } = this.reportRange(fromValue, toValue);
    const activity = await this.accountActivity(scope, from, to);
    const revenueAccounts = activity.filter((row) => row.type === 'REVENUE');
    const expenseAccounts = activity.filter((row) => row.type === 'EXPENSE');
    const revenue = revenueAccounts.reduce((sum, row) => sum.add(row.balance), new Prisma.Decimal(0));
    const expenses = expenseAccounts.reduce((sum, row) => sum.add(row.balance), new Prisma.Decimal(0));
    return {
      from,
      to,
      companyId: scope.companyId,
      branchId: scope.branchId,
      revenue: Number(revenue),
      expenses: Number(expenses),
      netProfit: Number(revenue.sub(expenses)),
      revenueAccounts: revenueAccounts.map((row) => ({ code: row.code, name: row.name, amount: Number(row.balance) })),
      expenseAccounts: expenseAccounts.map((row) => ({ code: row.code, name: row.name, amount: Number(row.balance) })),
      source: 'POSTED_JOURNAL',
    };
  }

  async trialBalance(
    user: AuthUser,
    fromValue?: string,
    toValue?: string,
    requestedCompanyId?: string,
    requestedBranchId?: string,
  ) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, requestedCompanyId, requestedBranchId, 'TrialBalanceReport');
    const { from, to } = this.reportRange(fromValue, toValue);
    const rows = await this.accountActivity(scope, from, to);
    const totalDebit = rows.reduce((sum, row) => sum.add(row.debit), new Prisma.Decimal(0));
    const totalCredit = rows.reduce((sum, row) => sum.add(row.credit), new Prisma.Decimal(0));
    return {
      from,
      to,
      companyId: scope.companyId,
      branchId: scope.branchId,
      rows: rows.map((row) => ({
        accountId: row.id,
        code: row.code,
        name: row.name,
        type: row.type,
        debit: Number(row.debit),
        credit: Number(row.credit),
        normalBalance: Number(row.balance),
      })),
      totalDebit: Number(totalDebit),
      totalCredit: Number(totalCredit),
      difference: Number(totalDebit.sub(totalCredit)),
      balanced: totalDebit.equals(totalCredit),
    };
  }

  async balanceSheet(
    user: AuthUser,
    asOfValue?: string,
    requestedCompanyId?: string,
    requestedBranchId?: string,
  ) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, requestedCompanyId, requestedBranchId, 'BalanceSheetReport');
    const asOf = parseDate(asOfValue, new Date(), true);
    const rows = await this.accountActivity(scope, undefined, asOf);
    const assets = rows.filter((row) => row.type === 'ASSET');
    const liabilities = rows.filter((row) => row.type === 'LIABILITY');
    const equity = rows.filter((row) => row.type === 'EQUITY');
    const revenue = rows.filter((row) => row.type === 'REVENUE').reduce((sum, row) => sum.add(row.balance), new Prisma.Decimal(0));
    const expenses = rows.filter((row) => row.type === 'EXPENSE').reduce((sum, row) => sum.add(row.balance), new Prisma.Decimal(0));
    const currentEarnings = revenue.sub(expenses);
    const totalAssets = assets.reduce((sum, row) => sum.add(row.balance), new Prisma.Decimal(0));
    const totalLiabilities = liabilities.reduce((sum, row) => sum.add(row.balance), new Prisma.Decimal(0));
    const postedEquity = equity.reduce((sum, row) => sum.add(row.balance), new Prisma.Decimal(0));
    const totalEquity = postedEquity.add(currentEarnings);
    const totalLiabilitiesAndEquity = totalLiabilities.add(totalEquity);
    return {
      asOf,
      companyId: scope.companyId,
      branchId: scope.branchId,
      assets: assets.map((row) => ({ code: row.code, name: row.name, amount: Number(row.balance) })),
      liabilities: liabilities.map((row) => ({ code: row.code, name: row.name, amount: Number(row.balance) })),
      equity: equity.map((row) => ({ code: row.code, name: row.name, amount: Number(row.balance) })),
      currentEarnings: Number(currentEarnings),
      totalAssets: Number(totalAssets),
      totalLiabilities: Number(totalLiabilities),
      postedEquity: Number(postedEquity),
      totalEquity: Number(totalEquity),
      totalLiabilitiesAndEquity: Number(totalLiabilitiesAndEquity),
      difference: Number(totalAssets.sub(totalLiabilitiesAndEquity)),
      balanced: totalAssets.equals(totalLiabilitiesAndEquity),
      source: 'POSTED_JOURNAL',
    };
  }

  async generalLedger(
    user: AuthUser,
    accountCode?: string,
    fromValue?: string,
    toValue?: string,
    limitValue?: string,
  ) {
    const scope = this.requireTenantScope(user);
    const { from, to } = this.reportRange(fromValue, toValue);
    const limit = Math.min(parsePageLimit(limitValue), 200);
    if (accountCode) {
      const account = await this.prisma.account.findFirst({
        where: { branchId: scope.branchId, branch: { companyId: scope.companyId }, code: accountCode },
        select: { id: true },
      });
      if (!account) throw new NotFoundException('Akun buku besar tidak ditemukan pada branch ini.');
    }
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        date: { gte: from, lte: to },
        lines: { some: { account: { branchId: scope.branchId, branch: { companyId: scope.companyId }, ...(accountCode ? { code: accountCode } : {}) } } },
      },
      include: {
        lines: {
          where: { account: { branchId: scope.branchId, branch: { companyId: scope.companyId }, ...(accountCode ? { code: accountCode } : {}) } },
          include: { account: { select: { code: true, name: true, type: true } } },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return {
      companyId: scope.companyId,
      branchId: scope.branchId,
      from,
      to,
      accountCode: accountCode ?? null,
      entries: entries.map((entry) => ({
        id: entry.id,
        number: entry.number,
        date: entry.date,
        referenceType: entry.referenceType,
        referenceId: entry.referenceId,
        description: entry.description,
        lines: entry.lines.map((line) => ({
          accountCode: line.account.code,
          accountName: line.account.name,
          accountType: line.account.type,
          debit: Number(line.debit),
          credit: Number(line.credit),
        })),
      })),
    };
  }

  async taxSummary(
    user: AuthUser,
    fromValue?: string,
    toValue?: string,
    requestedCompanyId?: string,
    requestedBranchId?: string,
  ) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, requestedCompanyId, requestedBranchId, 'TaxSummaryReport');
    const { from, to } = this.reportRange(fromValue, toValue);
    const transactions = await this.prisma.taxTransaction.findMany({
      where: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        status: 'POSTED',
        transactionDate: { gte: from, lte: to },
      },
      orderBy: [{ transactionDate: 'asc' }, { id: 'asc' }],
    });
    const taxCodeIds = [...new Set(transactions.map((row) => row.taxCodeId))];
    const taxCodes = taxCodeIds.length ? await this.prisma.taxCode.findMany({
      where: { companyId: scope.companyId, id: { in: taxCodeIds } },
      select: { id: true, code: true, name: true, scope: true, recoverable: true },
    }) : [];
    const codeMap = new Map(taxCodes.map((row) => [row.id, row]));
    const buckets = new Map<string, { taxCodeId: string; code: string; name: string; direction: string; taxableBase: Prisma.Decimal; taxAmount: Prisma.Decimal; recoverable: boolean }>();
    for (const row of transactions) {
      const code = codeMap.get(row.taxCodeId);
      const key = `${row.taxCodeId}:${row.direction}`;
      const current = buckets.get(key) ?? {
        taxCodeId: row.taxCodeId,
        code: code?.code ?? '(tax code terhapus)',
        name: code?.name ?? '(tax code terhapus)',
        direction: row.direction,
        taxableBase: new Prisma.Decimal(0),
        taxAmount: new Prisma.Decimal(0),
        recoverable: code?.recoverable ?? false,
      };
      current.taxableBase = current.taxableBase.add(row.taxableBase);
      current.taxAmount = current.taxAmount.add(row.taxAmount);
      buckets.set(key, current);
    }
    const outputTax = transactions.filter((row) => row.direction === 'OUTPUT')
      .reduce((sum, row) => sum.add(row.taxAmount), new Prisma.Decimal(0));
    const recoverableInputTax = transactions.filter((row) => row.direction === 'INPUT' && codeMap.get(row.taxCodeId)?.recoverable)
      .reduce((sum, row) => sum.add(row.taxAmount), new Prisma.Decimal(0));
    const nonRecoverableInputTax = transactions.filter((row) => row.direction === 'INPUT' && !codeMap.get(row.taxCodeId)?.recoverable)
      .reduce((sum, row) => sum.add(row.taxAmount), new Prisma.Decimal(0));
    const withholdingTax = transactions.filter((row) => row.direction === 'WITHHOLDING')
      .reduce((sum, row) => sum.add(row.taxAmount), new Prisma.Decimal(0));
    const netIndirectTax = outputTax.sub(recoverableInputTax);
    const documents = await this.prisma.taxDocument.aggregate({
      where: { companyId: scope.companyId, branchId: scope.branchId, issueDate: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
      _count: true,
      _sum: { netAmount: true, taxAmount: true, grossAmount: true },
    });
    return {
      from,
      to,
      companyId: scope.companyId,
      branchId: scope.branchId,
      rows: [...buckets.values()].map((row) => ({ ...row, taxableBase: Number(row.taxableBase), taxAmount: Number(row.taxAmount) })),
      outputTax: Number(outputTax),
      recoverableInputTax: Number(recoverableInputTax),
      nonRecoverableInputTax: Number(nonRecoverableInputTax),
      withholdingTax: Number(withholdingTax),
      netIndirectTaxPayable: Number(Prisma.Decimal.max(netIndirectTax, 0)),
      indirectTaxCredit: Number(Prisma.Decimal.max(netIndirectTax.negated(), 0)),
      taxDocuments: {
        count: documents._count,
        netAmount: Number(documents._sum.netAmount ?? 0),
        taxAmount: Number(documents._sum.taxAmount ?? 0),
        grossAmount: Number(documents._sum.grossAmount ?? 0),
      },
      note: 'Retur tersimpan sebagai TaxTransaction bernilai negatif dan otomatis mengurangi periode terkait.',
    };
  }

  async financialIntegrity(user: AuthUser, asOfValue?: string) {
    const scope = this.requireTenantScope(user);
    const asOf = parseDate(asOfValue, new Date(), true);
    const activity = await this.accountActivity(scope, undefined, asOf);
    const totalDebit = activity.reduce((sum, row) => sum.add(row.debit), new Prisma.Decimal(0));
    const totalCredit = activity.reduce((sum, row) => sum.add(row.credit), new Prisma.Decimal(0));
    const assets = activity.filter((row) => row.type === 'ASSET').reduce((sum, row) => sum.add(row.balance), new Prisma.Decimal(0));
    const liabilities = activity.filter((row) => row.type === 'LIABILITY').reduce((sum, row) => sum.add(row.balance), new Prisma.Decimal(0));
    const equity = activity.filter((row) => row.type === 'EQUITY').reduce((sum, row) => sum.add(row.balance), new Prisma.Decimal(0));
    const revenue = activity.filter((row) => row.type === 'REVENUE').reduce((sum, row) => sum.add(row.balance), new Prisma.Decimal(0));
    const expenses = activity.filter((row) => row.type === 'EXPENSE').reduce((sum, row) => sum.add(row.balance), new Prisma.Decimal(0));
    const balanceSheetDifference = assets.sub(liabilities.add(equity).add(revenue.sub(expenses)));
    const journalGroups = await this.prisma.journalLine.groupBy({
      by: ['journalEntryId'],
      where: {
        journalEntry: { date: { lte: asOf } },
        account: { branchId: scope.branchId, branch: { companyId: scope.companyId } },
      },
      _sum: { debit: true, credit: true },
    });
    const unbalancedJournalIds = journalGroups
      .filter((row) => !new Prisma.Decimal(row._sum.debit ?? 0).equals(row._sum.credit ?? 0))
      .map((row) => row.journalEntryId);
    const [postedEventsMissingJournal, failedEvents, queuedEvents, pendingFinanceTransactions, nonPostedTaxTransactions] = await Promise.all([
      this.prisma.accountingEvent.count({ where: { companyId: scope.companyId, branchId: scope.branchId, status: 'POSTED', journalEntryId: null, businessDate: { lte: asOf } } }),
      this.prisma.accountingEvent.count({ where: { companyId: scope.companyId, branchId: scope.branchId, status: 'FAILED', businessDate: { lte: asOf } } }),
      this.prisma.accountingEvent.count({ where: { companyId: scope.companyId, branchId: scope.branchId, status: { in: ['PENDING', 'VALIDATED'] }, businessDate: { lte: asOf } } }),
      this.prisma.operationalFinanceTransaction.count({ where: { companyId: scope.companyId, branchId: scope.branchId, transactionDate: { lte: asOf }, status: { in: ['DRAFT', 'WAITING_APPROVAL', 'APPROVED'] } } }),
      this.prisma.taxTransaction.count({ where: { companyId: scope.companyId, branchId: scope.branchId, transactionDate: { lte: asOf }, status: 'CALCULATED' } }),
    ]);
    const trialDifference = totalDebit.sub(totalCredit);
    const structuralMismatch = (trialDifference.isZero() ? 0 : 1) + (balanceSheetDifference.isZero() ? 0 : 1);
    const blockers = unbalancedJournalIds.length + postedEventsMissingJournal + failedEvents + structuralMismatch;
    const warnings = queuedEvents + pendingFinanceTransactions + nonPostedTaxTransactions;
    return {
      companyId: scope.companyId,
      branchId: scope.branchId,
      asOf,
      status: blockers > 0 ? 'FAIL' : warnings > 0 ? 'WARN' : 'PASS',
      trialBalance: { debit: Number(totalDebit), credit: Number(totalCredit), difference: Number(trialDifference), balanced: trialDifference.isZero() },
      balanceSheet: { difference: Number(balanceSheetDifference), balanced: balanceSheetDifference.isZero() },
      unbalancedJournalIds: unbalancedJournalIds.slice(0, 50),
      postedEventsMissingJournal,
      failedEvents,
      queuedEvents,
      unresolvedEvents: failedEvents + queuedEvents,
      pendingFinanceTransactions,
      nonPostedTaxTransactions,
      blockers,
      warnings,
    };
  }

  async inventoryValuation(
    user: AuthUser,
    warehouseId?: string,
    limitValue?: string,
    cursorValue?: string,
  ) {
    const scope = this.requireTenantScope(user);
    const branchWarehouseIds = await this.branchWarehouseIds(this.prisma, user, scope);
    let warehouseIds = branchWarehouseIds;
    if (warehouseId) {
      const warehouse = await this.prisma.warehouse.findFirst({
        where: {
          id: warehouseId,
          branchId: scope.branchId,
          branch: { companyId: scope.companyId },
        },
        select: { id: true },
      });
      if (!warehouse) return this.denyTenantAccess(this.prisma, user, scope, 'Warehouse', warehouseId);
      warehouseIds = [warehouse.id];
    }

    const limit = parsePageLimit(limitValue);
    const cursor = decodeCursor<{ updatedAt: string; id: string }>(cursorValue);
    const valuationRows = await this.prisma.inventory.findMany({
      where: { warehouseId: { in: warehouseIds } },
      select: { quantity: true, reserved: true, available: true, product: { select: { costPrice: true } } },
    });
    const inventoryValue = valuationRows.reduce(
      (sum, row) => sum.add(new Prisma.Decimal(row.product.costPrice).mul(row.quantity)),
      new Prisma.Decimal(0),
    );
    const rows = await this.prisma.inventory.findMany({
      where: {
        warehouseId: { in: warehouseIds },
        AND: cursor ? [{ OR: [
          { updatedAt: { lt: new Date(cursor.updatedAt) } },
          { updatedAt: new Date(cursor.updatedAt), id: { lt: cursor.id } },
        ] }] : undefined,
      },
      include: { product: true, warehouse: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = toCursorPage(rows, limit, (item) => ({ updatedAt: item.updatedAt.toISOString(), id: item.id }));
    return {
      ...page,
      companyId: scope.companyId,
      branchId: scope.branchId,
      summary: {
        skuCount: valuationRows.length,
        quantity: valuationRows.reduce((sum, row) => sum + row.quantity, 0),
        reserved: valuationRows.reduce((sum, row) => sum + row.reserved, 0),
        available: valuationRows.reduce((sum, row) => sum + row.available, 0),
        inventoryValue: Number(inventoryValue),
        source: 'LIVE_INVENTORY',
      },
      items: page.items.map((item) => ({
        ...item,
        inventoryValue: new Prisma.Decimal(item.product.costPrice).mul(item.quantity),
      })),
    };
  }

  async createJob(dto: CreateReportJobDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, dto.companyId, dto.branchId, 'ReportJob');
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.reportJob.create({
        data: {
          companyId: scope.companyId,
          branchId: scope.branchId,
          requestedById: user.sub,
          reportType: dto.reportType,
          format: dto.format ?? 'CSV',
          filters: dto.filters as Prisma.InputJsonValue | undefined,
        },
      });
      await tx.auditLog.create({
        data: {
          companyId: scope.companyId,
          userId: user.sub,
          action: 'CREATE_REPORT_JOB',
          entityType: 'ReportJob',
          entityId: job.id,
          payload: {
            branchId: scope.branchId,
            reportType: job.reportType,
            format: job.format,
          },
        },
      });
      return job;
    });
  }

  async listJobs(
    user: AuthUser,
    requestedCompanyId?: string,
    requestedBranchId?: string,
    limitValue?: string,
    cursorValue?: string,
  ) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, requestedCompanyId, requestedBranchId, 'ReportJob');
    const limit = parsePageLimit(limitValue);
    const cursor = decodeCursor<{ createdAt: string; id: string }>(cursorValue);
    const rows = await this.prisma.reportJob.findMany({
      where: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        AND: cursor ? [{ OR: [
          { createdAt: { lt: new Date(cursor.createdAt) } },
          { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
        ] }] : undefined,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    return toCursorPage(rows, limit, (item) => ({ createdAt: item.createdAt.toISOString(), id: item.id }));
  }

  // T360-20260829 value pack 2 — penjualan per jam untuk deteksi jam ramai.
  async peakHours(user: AuthUser, daysValue?: string) {
    const scope = this.requireTenantScope(user);
    const days = Math.min(Math.max(Number(daysValue ?? 30) || 30, 1), 90);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    const sales = await this.prisma.sale.findMany({
      where: { branchId: scope.branchId, branch: { companyId: scope.companyId }, status: 'COMPLETED', createdAt: { gte: start } },
      select: { createdAt: true, total: true },
    });
    const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, transactions: 0, revenue: 0 }));
    for (const sale of sales) {
      const bucket = buckets[new Date(sale.createdAt).getHours()];
      bucket.transactions += 1;
      bucket.revenue += Number(sale.total);
    }
    return {
      companyId: scope.companyId,
      branchId: scope.branchId,
      days,
      buckets,
      peakHour: buckets.reduce((best, current) => (current.transactions > best.transactions ? current : best)).hour,
    };
  }

  // T360-20260829 value pack 2 — stok menganggur tanpa penjualan pada periode.
  async deadStock(user: AuthUser, daysValue?: string, limitValue?: string) {
    const scope = this.requireTenantScope(user);
    const days = Math.min(Math.max(Number(daysValue ?? 30) || 30, 1), 365);
    const limit = parsePageLimit(limitValue);
    const start = new Date();
    start.setDate(start.getDate() - days);
    const warehouseIds = await this.branchWarehouseIds(this.prisma, user, scope);
    const sold = await this.prisma.saleItem.findMany({
      where: { sale: { branchId: scope.branchId, branch: { companyId: scope.companyId }, status: 'COMPLETED', createdAt: { gte: start } } },
      select: { productId: true },
      distinct: ['productId'],
    });
    const soldIds = sold.map((row) => row.productId);
    const rows = await this.prisma.inventory.findMany({
      where: {
        warehouseId: { in: warehouseIds },
        quantity: { gt: 0 },
        productId: soldIds.length ? { notIn: soldIds } : undefined,
      },
      include: {
        product: { select: { id: true, sku: true, name: true, costPrice: true } },
        warehouse: { select: { name: true } },
      },
      orderBy: [{ quantity: 'desc' }, { id: 'asc' }],
      take: limit,
    });
    return {
      companyId: scope.companyId,
      branchId: scope.branchId,
      days,
      items: rows.map((row) => ({
        productId: row.productId,
        sku: row.product.sku,
        name: row.product.name,
        warehouse: row.warehouse.name,
        quantity: row.quantity,
        tiedUpValue: new Prisma.Decimal(row.product.costPrice).mul(row.quantity),
      })),
    };
  }

  // T360-20260829 value pack 2 — segmentasi pelanggan RFM sederhana.
  async customerRfm(user: AuthUser, daysValue?: string, limitValue?: string) {
    const scope = this.requireTenantScope(user);
    const days = Math.min(Math.max(Number(daysValue ?? 90) || 90, 7), 365);
    const limit = parsePageLimit(limitValue);
    const start = new Date();
    start.setDate(start.getDate() - days);
    const grouped = await this.prisma.sale.groupBy({
      by: ['customerId'],
      where: { branchId: scope.branchId, branch: { companyId: scope.companyId }, status: 'COMPLETED', customerId: { not: null }, createdAt: { gte: start } },
      _count: true,
      _sum: { total: true },
      _max: { createdAt: true },
    });
    const customerIds = grouped.map((row) => row.customerId).filter((value): value is string => Boolean(value));
    const customers = customerIds.length
      ? await this.prisma.customer.findMany({ where: { companyId: scope.companyId, id: { in: customerIds } }, select: { id: true, name: true, phone: true } })
      : [];
    const nameById = new Map(customers.map((customer) => [customer.id, customer]));
    const now = Date.now();
    const items = grouped
      .filter((row) => row.customerId)
      .map((row) => {
        const recencyDays = Math.floor((now - (row._max.createdAt?.getTime() ?? now)) / 86400000);
        const frequency = row._count;
        const monetary = Number(row._sum.total ?? 0);
        return {
          customerId: row.customerId as string,
          name: nameById.get(row.customerId as string)?.name ?? '(terhapus)',
          phone: nameById.get(row.customerId as string)?.phone ?? null,
          recencyDays,
          frequency,
          monetary,
          segment: rfmSegment(recencyDays, frequency, monetary),
        };
      })
      .sort((a, b) => b.monetary - a.monetary)
      .slice(0, limit);
    return { companyId: scope.companyId, branchId: scope.branchId, days, items };
  }

  // T360-20260829 value pack 2 — unduh hasil export CSV milik company/branch sendiri.
  async downloadJob(user: AuthUser, jobId: string): Promise<StreamableFile> {
    const scope = this.requireTenantScope(user);
    const job = await this.prisma.reportJob.findFirst({
      where: { id: jobId, companyId: scope.companyId, branchId: scope.branchId },
    });
    if (!job) return this.denyTenantAccess(this.prisma, user, scope, 'ReportJob', jobId);
    if (job.status !== 'DONE' || !job.outputUrl) throw new BadRequestException('Export belum tersedia.');
    const filePath = resolveExportPath(job.outputUrl);
    if (!existsSync(filePath)) throw new NotFoundException('Berkas export sudah tidak tersedia.');
    const extension = job.outputUrl.split('.').pop()?.toLowerCase() ?? 'csv';
    const contentType = extension === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : extension === 'pdf' ? 'application/pdf' : 'text/csv; charset=utf-8';
    return new StreamableFile(createReadStream(filePath), {
      type: contentType,
      disposition: `attachment; filename="${job.id}.${extension}"`,
    });
  }
}

// T360-20260829 value pack 2 — logika segmentasi murni agar mudah diuji.
export function rfmSegment(recencyDays: number, frequency: number, monetary: number): string {
  if (recencyDays <= 7 && frequency >= 4) return 'CHAMPION';
  if (recencyDays <= 30 && frequency >= 2) return 'LOYAL';
  if (recencyDays <= 30) return 'NEW_PROMISING';
  if (recencyDays <= 90 && monetary > 0) return 'AT_RISK';
  return 'HIBERNATING';
}

// T360-20260829 value pack 2 — direktori export bersama API dan worker.
export function resolveExportDir(): string {
  const configured = process.env.REPORT_EXPORT_DIR?.trim();
  if (configured) {
    const dir = resolve(configured);
    mkdirSync(dir, { recursive: true });
    return dir;
  }
  const candidates = [
    join(process.cwd(), 'logs', 'report-exports'),
    resolve(process.env.INIT_CWD || process.cwd(), 'logs', 'report-exports'),
    resolve(process.cwd(), '..', '..', 'logs', 'report-exports'),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  const fallback = candidates[1];
  mkdirSync(fallback, { recursive: true });
  return fallback;
}

function resolveExportPath(outputUrl: string): string {
  const fileName = outputUrl.split(/[\\/]/).pop() ?? '';
  if (!fileName || fileName.includes('..')) throw new BadRequestException('Path export tidak valid.');
  return join(resolveExportDir(), fileName);
}
