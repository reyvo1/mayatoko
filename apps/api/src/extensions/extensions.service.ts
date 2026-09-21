import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LoyaltyTransactionType, Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { SecretProtectorService } from '../platform/secret-protector.service';
import type { EdgeDeviceIdentity } from './edge-device-auth.service';
import { AuthUser } from '../auth/auth.types';
import { nextDocumentNumber } from '../common/numbering';
import { PrismaService } from '../prisma/prisma.service';
import { ReturnsService } from '../returns/returns.service';
import {
  ConfirmReturnDto,
  CreatePurchaseReturnDto as TenantCreatePurchaseReturnDto,
  CreateSaleReturnDto as TenantCreateSaleReturnDto,
} from '../returns/dto/returns.dto';
import {
  CreateBatchDto, CreateFiscalPeriodDto, CreateLoyaltyProgramDto, CreatePurchaseReturnDto, CreateReconciliationDto,
  CreateSaleReturnDto, CreateSerialDto, CreateShipmentDto, ImportBankStatementDto, ImportMarketplaceOrderDto,
  LoyaltyTransactionDto, MatchBankReconciliationDto, QueueNotificationDto, RegisterDeviceDto, RunForecastDto, UpsertNotificationTemplateDto,
  AcknowledgeSyncReceiptDto, RotateDeviceCredentialDto, SubmitOfflineTransactionsDto, UnmatchBankReconciliationDto,
} from './dto/extensions.dto';

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

function templatePathValue(root: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, root);
}

function renderNotificationTemplate(text: string | null | undefined, data: unknown): string | undefined {
  if (text == null) return undefined;
  return text.replace(/{{\s*([A-Za-z0-9_.-]+)\s*}}/g, (_match, path: string) => {
    const value = templatePathValue(data, path);
    if (value === undefined || value === null) throw new BadRequestException(`Variabel template notifikasi belum tersedia: ${path}`);
    if (typeof value === 'object') throw new BadRequestException(`Variabel template notifikasi harus scalar: ${path}`);
    return String(value);
  });
}

function boundaryDate(value: string, endOfDay = false): Date {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = dateOnly ? new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`) : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Format tanggal tidak valid.');
  return parsed;
}

type DbClient = Prisma.TransactionClient | PrismaService;
type TenantScope = { companyId: string; branchId: string };

@Injectable()
export class ExtensionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly returns: ReturnsService,
    private readonly secrets: SecretProtectorService,
  ) {}

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
    entityType = 'Extension',
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

  private async audit(
    client: DbClient,
    user: AuthUser,
    scope: TenantScope,
    action: string,
    entityType: string,
    entityId: string,
    payload?: Prisma.InputJsonValue,
  ) {
    await client.auditLog.create({
      data: { companyId: scope.companyId, userId: user.sub, action, entityType, entityId, payload },
    });
  }

  private async tenantWarehouseIds(client: DbClient, scope: TenantScope) {
    const rows = await client.warehouse.findMany({
      where: { branchId: scope.branchId, branch: { companyId: scope.companyId } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  private async assertWarehouse(client: DbClient, user: AuthUser, scope: TenantScope, id: string) {
    const warehouse = await client.warehouse.findFirst({
      where: { id, branchId: scope.branchId, branch: { companyId: scope.companyId } },
    });
    if (!warehouse) return this.denyTenantAccess(client, user, scope, 'Warehouse', id);
    return warehouse;
  }

  private async assertInventoryProduct(
    client: DbClient,
    user: AuthUser,
    scope: TenantScope,
    warehouseId: string,
    productId: string,
  ) {
    await this.assertWarehouse(client, user, scope, warehouseId);
    const inventory = await client.inventory.findFirst({
      where: { warehouseId, productId, product: { companyId: scope.companyId, isActive: true } },
      include: { product: true },
    });
    if (!inventory) return this.denyTenantAccess(client, user, scope, 'InventoryProduct', productId, { warehouseId });
    return inventory;
  }

  private async assertIntegration(client: DbClient, user: AuthUser, scope: TenantScope, id: string) {
    const integration = await client.integrationConnection.findFirst({
      where: {
        id,
        companyId: scope.companyId,
        OR: [{ branchId: null }, { branchId: scope.branchId }],
      },
    });
    if (!integration) return this.denyTenantAccess(client, user, scope, 'IntegrationConnection', id);
    return integration;
  }

  private async scopedDevice(client: DbClient, user: AuthUser, scope: TenantScope, id: string) {
    const device = await client.device.findFirst({
      where: { id, companyId: scope.companyId, branchId: scope.branchId, isActive: true },
    });
    if (!device) return this.denyTenantAccess(client, user, scope, 'Device', id);
    return device;
  }

  private async scopedFiscalPeriod(client: DbClient, user: AuthUser, scope: TenantScope, id: string) {
    const period = await client.fiscalPeriod.findFirst({
      where: { id, companyId: scope.companyId, branchId: scope.branchId },
    });
    if (!period) return this.denyTenantAccess(client, user, scope, 'FiscalPeriod', id);
    return period;
  }

  private async scopedBankStatement(client: DbClient, user: AuthUser, scope: TenantScope, id: string) {
    const statement = await client.bankStatement.findFirst({
      where: { id, companyId: scope.companyId, branchId: scope.branchId },
    });
    if (!statement) return this.denyTenantAccess(client, user, scope, 'BankStatement', id);
    return statement;
  }

  private async scopedReconciliation(client: DbClient, user: AuthUser, scope: TenantScope, id: string) {
    const reconciliation = await client.bankReconciliation.findFirst({
      where: { id, companyId: scope.companyId, branchId: scope.branchId },
    });
    if (!reconciliation) return this.denyTenantAccess(client, user, scope, 'BankReconciliation', id);
    return reconciliation;
  }

  private async assertBankAccount(client: DbClient, user: AuthUser, scope: TenantScope, id: string) {
    const account = await client.account.findFirst({
      where: {
        id,
        branchId: scope.branchId,
        type: 'ASSET',
        isActive: true,
        branch: { companyId: scope.companyId },
      },
    });
    if (!account) return this.denyTenantAccess(client, user, scope, 'BankAccount', id);
    return account;
  }

  private async fiscalCloseBlockers(client: DbClient, scope: TenantScope, startDate: Date, endDate: Date) {
    const journalGroups = await client.journalLine.groupBy({
      by: ['journalEntryId'],
      where: {
        journalEntry: { date: { gte: startDate, lte: endDate } },
        account: { branchId: scope.branchId, branch: { companyId: scope.companyId } },
      },
      _sum: { debit: true, credit: true },
    });
    const unbalancedJournals = journalGroups.filter((row) => !new Prisma.Decimal(row._sum.debit ?? 0).equals(row._sum.credit ?? 0)).length;
    const [unresolvedAccountingEvents, postedEventsMissingJournal, pendingFinanceTransactions, nonPostedTaxTransactions] = await Promise.all([
      client.accountingEvent.count({
        where: {
          companyId: scope.companyId,
          branchId: scope.branchId,
          businessDate: { gte: startDate, lte: endDate },
          status: { in: ['PENDING', 'VALIDATED', 'FAILED'] },
        },
      }),
      client.accountingEvent.count({
        where: {
          companyId: scope.companyId,
          branchId: scope.branchId,
          businessDate: { gte: startDate, lte: endDate },
          status: 'POSTED',
          journalEntryId: null,
        },
      }),
      client.operationalFinanceTransaction.count({
        where: {
          companyId: scope.companyId,
          branchId: scope.branchId,
          transactionDate: { gte: startDate, lte: endDate },
          status: { in: ['DRAFT', 'WAITING_APPROVAL', 'APPROVED'] },
        },
      }),
      client.taxTransaction.count({
        where: {
          companyId: scope.companyId,
          branchId: scope.branchId,
          transactionDate: { gte: startDate, lte: endDate },
          status: 'CALCULATED',
        },
      }),
    ]);
    return {
      journalCount: journalGroups.length,
      unbalancedJournals,
      unresolvedAccountingEvents,
      postedEventsMissingJournal,
      pendingFinanceTransactions,
      nonPostedTaxTransactions,
    };
  }

  private hasFiscalCloseBlockers(checks: Awaited<ReturnType<ExtensionsService['fiscalCloseBlockers']>>) {
    return checks.unbalancedJournals > 0
      || checks.unresolvedAccountingEvents > 0
      || checks.postedEventsMissingJournal > 0
      || checks.pendingFinanceTransactions > 0
      || checks.nonPostedTaxTransactions > 0;
  }

  private async journalBookBalance(client: DbClient, accountId: string, endDate: Date) {
    const totals = await client.journalLine.aggregate({
      where: { accountId, journalEntry: { date: { lte: endDate } } },
      _sum: { debit: true, credit: true },
    });
    return new Prisma.Decimal(totals._sum.debit ?? 0).sub(totals._sum.credit ?? 0);
  }

  private statementBalance(statement: { openingBalance: Prisma.Decimal | null; closingBalance: Prisma.Decimal | null }, lines: Array<{ transactionDate: Date; debit: Prisma.Decimal; credit: Prisma.Decimal; balance: Prisma.Decimal | null }>, fallback?: number) {
    if (statement.closingBalance !== null) return new Prisma.Decimal(statement.closingBalance);
    const withBalance = [...lines].filter((line) => line.balance !== null).sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime());
    if (withBalance.length && withBalance[0].balance !== null) return new Prisma.Decimal(withBalance[0].balance!);
    if (statement.openingBalance !== null) {
      return lines.reduce((balance, line) => balance.add(line.credit).sub(line.debit), new Prisma.Decimal(statement.openingBalance));
    }
    if (fallback !== undefined) return new Prisma.Decimal(fallback);
    throw new BadRequestException('Saldo bank tidak dapat dihitung. Isi closingBalance, balance baris terakhir, atau openingBalance pada bank statement.');
  }

  private normalizeBankReference(value?: string | null) {
    return (value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private sameBusinessDate(left: Date, right: Date) {
    return left.getFullYear() === right.getFullYear()
      && left.getMonth() === right.getMonth()
      && left.getDate() === right.getDate();
  }

  private bankLineMatchesJournalAmount(statementLine: { debit: Prisma.Decimal; credit: Prisma.Decimal }, journalLine: { debit: Prisma.Decimal; credit: Prisma.Decimal }) {
    const statementDebit = new Prisma.Decimal(statementLine.debit);
    const statementCredit = new Prisma.Decimal(statementLine.credit);
    const journalDebit = new Prisma.Decimal(journalLine.debit);
    const journalCredit = new Prisma.Decimal(journalLine.credit);
    if (statementCredit.greaterThan(0) && statementDebit.isZero()) return journalDebit.equals(statementCredit) && journalCredit.isZero();
    if (statementDebit.greaterThan(0) && statementCredit.isZero()) return journalCredit.equals(statementDebit) && journalDebit.isZero();
    return false;
  }

  private async refreshReconciliation(client: DbClient, user: AuthUser, scope: TenantScope, reconciliationId: string) {
    const reconciliation = await this.scopedReconciliation(client, user, scope, reconciliationId);
    if (!reconciliation.statementId) throw new BadRequestException('Rekonsiliasi tidak memiliki bank statement.');
    const [matchedCount, unmatchedCount] = await Promise.all([
      client.bankStatementLine.count({
        where: {
          statementId: reconciliation.statementId,
          transactionDate: { gte: reconciliation.startDate, lte: reconciliation.endDate },
          matched: true,
        },
      }),
      client.bankStatementLine.count({
        where: {
          statementId: reconciliation.statementId,
          transactionDate: { gte: reconciliation.startDate, lte: reconciliation.endDate },
          matched: false,
        },
      }),
    ]);
    const completed = reconciliation.difference.isZero() && unmatchedCount === 0;
    return client.bankReconciliation.update({
      where: { id: reconciliation.id },
      data: {
        matchedCount,
        status: completed ? 'COMPLETED' : 'IN_PROGRESS',
        completedById: completed ? user.sub : null,
        completedAt: completed ? new Date() : null,
      },
    });
  }

  private stableJson(value: unknown): string {
    const normalize = (input: unknown): unknown => {
      if (Array.isArray(input)) return input.map(normalize);
      if (input && typeof input === 'object') {
        return Object.fromEntries(Object.entries(input as Record<string, unknown>)
          .filter(([, item]) => item !== undefined)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => [key, normalize(item)]));
      }
      return input;
    };
    return JSON.stringify(normalize(value));
  }

  private tenantPayload(value: unknown, scope: TenantScope): Prisma.InputJsonValue {
    if (value === undefined) return json({ companyId: scope.companyId, branchId: scope.branchId });
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      return json({ ...record, companyId: scope.companyId, branchId: scope.branchId });
    }
    return json({ companyId: scope.companyId, branchId: scope.branchId, payload: value });
  }

  async batches(user: AuthUser, warehouseId?: string, productId?: string) {
    const scope = this.requireTenantScope(user);
    const warehouseIds = warehouseId
      ? [(await this.assertWarehouse(this.prisma, user, scope, warehouseId)).id]
      : await this.tenantWarehouseIds(this.prisma, scope);
    return this.prisma.inventoryBatch.findMany({
      where: { warehouseId: { in: warehouseIds }, ...(productId ? { productId } : {}) },
      orderBy: { expiryDate: 'asc' },
      take: 500,
    });
  }

  async createBatch(dto: CreateBatchDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    return this.prisma.$transaction(async (tx) => {
      const inventory = await this.assertInventoryProduct(tx, user, scope, dto.warehouseId, dto.productId);
      if (!inventory.product.trackBatch) {
        throw new BadRequestException('Produk tidak mengaktifkan pelacakan batch.');
      }
      if ((dto.quantity ?? 0) !== 0) {
        throw new BadRequestException('Kuantitas batch tidak boleh ditambah manual. Gunakan penerimaan, retur, transfer, atau movement inventory canonical.');
      }
      const producedAt = dto.producedAt ? new Date(dto.producedAt) : undefined;
      const expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : undefined;
      if (producedAt && expiryDate && expiryDate < producedAt) {
        throw new BadRequestException('Tanggal kedaluwarsa batch tidak boleh sebelum tanggal produksi.');
      }
      const existing = await tx.inventoryBatch.findFirst({
        where: { warehouseId: dto.warehouseId, productId: dto.productId, batchNumber: dto.batchNumber },
      });
      if (existing) return existing;
      const batch = await tx.inventoryBatch.create({
        data: {
          warehouseId: dto.warehouseId,
          productId: dto.productId,
          batchNumber: dto.batchNumber.trim(),
          quantity: 0,
          producedAt,
          expiryDate,
        },
      });
      await this.audit(tx, user, scope, 'PRE_REGISTER_INVENTORY_BATCH', 'InventoryBatch', batch.id, {
        branchId: scope.branchId, warehouseId: dto.warehouseId, productId: dto.productId,
      });
      return batch;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async serials(user: AuthUser, warehouseId?: string, productId?: string) {
    const scope = this.requireTenantScope(user);
    const warehouseIds = warehouseId
      ? [(await this.assertWarehouse(this.prisma, user, scope, warehouseId)).id]
      : await this.tenantWarehouseIds(this.prisma, scope);
    return this.prisma.inventorySerial.findMany({
      where: { warehouseId: { in: warehouseIds }, ...(productId ? { productId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async createSerial(dto: CreateSerialDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    return this.prisma.$transaction(async (tx) => {
      const inventory = await this.assertInventoryProduct(tx, user, scope, dto.warehouseId, dto.productId);
      if (!inventory.product.trackSerial) {
        throw new BadRequestException('Produk tidak mengaktifkan pelacakan serial.');
      }
      const serialNumber = dto.serialNumber.trim();
      const existing = await tx.inventorySerial.findUnique({ where: { serialNumber } });
      if (existing) {
        if (existing.warehouseId !== dto.warehouseId || existing.productId !== dto.productId) {
          return this.denyTenantAccess(tx, user, scope, 'InventorySerial', existing.id);
        }
        return existing;
      }
      const physicalSerials = await tx.inventorySerial.count({
        where: {
          warehouseId: dto.warehouseId,
          productId: dto.productId,
          status: { in: ['AVAILABLE', 'RESERVED', 'RETURNED', 'DAMAGED'] },
        },
      });
      if (physicalSerials >= inventory.quantity) {
        throw new BadRequestException('Serial baru melebihi stok fisik produk. Terima/posting stok terlebih dahulu sebelum registrasi serial.');
      }
      const serial = await tx.inventorySerial.create({
        data: { warehouseId: dto.warehouseId, productId: dto.productId, serialNumber },
      });
      await this.audit(tx, user, scope, 'CREATE_INVENTORY_SERIAL', 'InventorySerial', serial.id, {
        branchId: scope.branchId, warehouseId: dto.warehouseId, productId: dto.productId,
      });
      return serial;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  saleReturns(user: AuthUser) { return this.returns.listSaleReturns(user); }

  async createSaleReturn(dto: CreateSaleReturnDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    const sale = await this.prisma.sale.findFirst({
      where: { id: dto.saleId, branchId: scope.branchId, branch: { companyId: scope.companyId } },
      include: { items: true },
    });
    if (!sale) return this.denyTenantAccess(this.prisma, user, scope, 'Sale', dto.saleId);
    await this.assertWarehouse(this.prisma, user, scope, dto.warehouseId);
    if (sale.warehouseId !== dto.warehouseId) throw new BadRequestException('Gudang retur harus sesuai dengan gudang penjualan.');
    const mapped: TenantCreateSaleReturnDto = {
      saleId: dto.saleId,
      warehouseId: dto.warehouseId,
      reason: dto.reason,
      refundMethod: dto.refundMethod,
      items: dto.items.map((item) => {
        const candidates = sale.items.filter((row) => row.productId === item.productId);
        if (candidates.length !== 1) {
          throw new BadRequestException(`Produk ${item.productId} harus dipilih melalui endpoint returns canonical berdasarkan saleItemId.`);
        }
        return { saleItemId: candidates[0].id, quantity: item.quantity, condition: item.condition, restock: item.restock };
      }),
    };
    return this.returns.createSaleReturn(mapped, user);
  }

  completeSaleReturn(id: string, user: AuthUser) {
    return this.returns.confirmSaleReturn(id, new ConfirmReturnDto(), user);
  }

  purchaseReturns(user: AuthUser) { return this.returns.listPurchaseReturns(user); }

  async createPurchaseReturn(dto: CreatePurchaseReturnDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    if (!dto.goodsReceiptId) {
      throw new BadRequestException('goodsReceiptId wajib untuk endpoint retur pembelian lama. Gunakan endpoint returns canonical.');
    }
    const receipt = await this.prisma.goodsReceipt.findUnique({
      where: { id: dto.goodsReceiptId },
      include: { items: true, warehouse: { include: { branch: true } } },
    });
    if (!receipt
      || receipt.warehouse.branchId !== scope.branchId
      || receipt.warehouse.branch.companyId !== scope.companyId) {
      return this.denyTenantAccess(this.prisma, user, scope, 'GoodsReceipt', dto.goodsReceiptId);
    }
    if (receipt.supplierId !== dto.supplierId || receipt.warehouseId !== dto.warehouseId
      || (dto.purchaseOrderId && receipt.purchaseOrderId !== dto.purchaseOrderId)) {
      throw new BadRequestException('Referensi retur pembelian tidak sesuai dengan goods receipt tenant.');
    }
    const mapped: TenantCreatePurchaseReturnDto = {
      goodsReceiptId: receipt.id,
      reason: dto.reason,
      items: dto.items.map((item) => {
        const candidates = receipt.items.filter((row) => row.productId === item.productId);
        if (candidates.length !== 1) {
          throw new BadRequestException(`Produk ${item.productId} harus dipilih melalui endpoint returns canonical berdasarkan goodsReceiptItemId.`);
        }
        return { goodsReceiptItemId: candidates[0].id, quantity: item.quantity, reason: item.reason };
      }),
    };
    return this.returns.createPurchaseReturn(mapped, user);
  }

  completePurchaseReturn(id: string, user: AuthUser) {
    return this.returns.confirmPurchaseReturn(id, new ConfirmReturnDto(), user);
  }

  async loyaltyPrograms(user: AuthUser, requestedCompanyId?: string) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, requestedCompanyId, undefined, 'LoyaltyProgram');
    return this.prisma.loyaltyProgram.findMany({ where: { companyId: scope.companyId }, orderBy: { name: 'asc' } });
  }

  /** Daftar pelanggan terbatas untuk dropdown POS (T360-20260825). */
  async customers(user: AuthUser, search?: string, limit = 50) {
    const scope = this.requireTenantScope(user);
    return this.prisma.customer.findMany({
      where: { companyId: scope.companyId, ...(search ? { OR: [{ name: { contains: search } }, { phone: { contains: search } }] } : {}) },
      select: { id: true, name: true, phone: true },
      orderBy: { name: 'asc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  /**
   * T360-20260825 Fitur 2: harga member otomatis.
   * Tier pelanggan dari lifetimePoints vs program.tiers[{code,minPoints,discountPct}].
   */
  async loyaltyTierForCustomer(user: AuthUser, customerId: string) {
    const scope = this.requireTenantScope(user);
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, companyId: scope.companyId }, select: { id: true } });
    if (!customer) throw new NotFoundException('Pelanggan tidak ditemukan.');
    const program = await this.prisma.loyaltyProgram.findFirst({
      where: { companyId: scope.companyId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, tiers: true },
    });
    if (!program) return { tier: 'MEMBER', discountPct: 0 };
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { programId_customerId: { programId: program.id, customerId } },
      select: { lifetimePoints: true },
    });
    const lifetime = account?.lifetimePoints ?? 0;
    const tiers = Array.isArray(program.tiers) ? (program.tiers as Array<{ code: string; minPoints: number; discountPct?: number }>) : [];
    const eligible = tiers.filter((t) => lifetime >= (t.minPoints ?? 0)).sort((a, b) => (b.minPoints ?? 0) - (a.minPoints ?? 0));
    const tier = eligible[0];
    return { tier: tier?.code ?? 'MEMBER', discountPct: Math.min(50, Math.max(0, Number(tier?.discountPct ?? 0))) };
  }

  /** Saldo poin pelanggan pada program aktif pertama (T360-20260825). */
  async loyaltyAccountForCustomer(user: AuthUser, customerId: string) {
    const scope = this.requireTenantScope(user);
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, companyId: scope.companyId }, select: { id: true } });
    if (!customer) throw new NotFoundException('Pelanggan tidak ditemukan.');
    const program = await this.prisma.loyaltyProgram.findFirst({
      where: { companyId: scope.companyId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, earnRate: true, redemptionRate: true, minimumRedeem: true },
    });
    if (!program) return { program: null, points: 0 };
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { programId_customerId: { programId: program.id, customerId } },
      select: { points: true },
    });
    return { program, points: account?.points ?? 0 };
  }

  async createLoyaltyProgram(dto: CreateLoyaltyProgramDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, dto.companyId, undefined, 'LoyaltyProgram');
    const program = await this.prisma.loyaltyProgram.create({ data: {
      companyId: scope.companyId,
      name: dto.name,
      earnRate: dto.earnRate === undefined ? undefined : new Prisma.Decimal(dto.earnRate),
      redemptionRate: dto.redemptionRate === undefined ? undefined : new Prisma.Decimal(dto.redemptionRate),
      minimumRedeem: dto.minimumRedeem,
      pointsExpireDays: dto.pointsExpireDays,
      tiers: dto.tiers === undefined ? undefined : json(dto.tiers),
      rules: dto.rules === undefined ? undefined : json(dto.rules),
    } });
    await this.audit(this.prisma, user, scope, 'CREATE_LOYALTY_PROGRAM', 'LoyaltyProgram', program.id, { branchId: scope.branchId });
    return program;
  }

  async loyaltyTransaction(dto: LoyaltyTransactionDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    return this.prisma.$transaction(async (tx) => {
      const program = await tx.loyaltyProgram.findFirst({ where: { id: dto.programId, companyId: scope.companyId, isActive: true } });
      if (!program) return this.denyTenantAccess(tx, user, scope, 'LoyaltyProgram', dto.programId);
      const customer = await tx.customer.findFirst({ where: { id: dto.customerId, companyId: scope.companyId } });
      if (!customer) throw new NotFoundException('Pelanggan tidak ditemukan.');
      const account = await tx.loyaltyAccount.upsert({
        where: { programId_customerId: { programId: program.id, customerId: dto.customerId } },
        create: { programId: program.id, customerId: dto.customerId },
        update: {},
      });
      const next = account.points + dto.points;
      if (next < 0) throw new BadRequestException('Poin pelanggan tidak mencukupi.');
      const updated = await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: { points: next, lifetimePoints: dto.points > 0 ? { increment: dto.points } : undefined },
      });
      const transaction = await tx.loyaltyTransaction.create({ data: {
        accountId: account.id,
        type: dto.type as LoyaltyTransactionType,
        points: dto.points,
        balanceAfter: next,
        referenceType: dto.referenceType,
        referenceId: dto.referenceId,
        notes: dto.notes,
      } });
      await this.audit(tx, user, scope, 'CREATE_LOYALTY_TRANSACTION', 'LoyaltyTransaction', transaction.id, {
        branchId: scope.branchId, programId: program.id, customerId: customer.id,
      });
      return { account: updated, transaction };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async fiscalPeriods(user: AuthUser, requestedCompanyId?: string, requestedBranchId?: string) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, requestedCompanyId, requestedBranchId, 'FiscalPeriod');
    return this.prisma.fiscalPeriod.findMany({
      where: { companyId: scope.companyId, branchId: scope.branchId },
      orderBy: { startDate: 'desc' },
    });
  }

  async createFiscalPeriod(dto: CreateFiscalPeriodDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, dto.companyId, dto.branchId, 'FiscalPeriod');
    const startDate = boundaryDate(dto.startDate, false);
    const endDate = boundaryDate(dto.endDate, true);
    if (startDate > endDate) throw new BadRequestException('Tanggal awal periode tidak boleh melewati tanggal akhir.');
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.fiscalPeriod.findFirst({
        where: { companyId: scope.companyId, branchId: scope.branchId, startDate, endDate },
      });
      if (existing) {
        if (existing.name !== dto.name) {
          throw new BadRequestException('Periode fiskal pada rentang yang sama sudah tersedia dengan nama berbeda.');
        }
        return existing;
      }
      const overlapping = await tx.fiscalPeriod.findFirst({
        where: {
          companyId: scope.companyId,
          branchId: scope.branchId,
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        select: { id: true, name: true, startDate: true, endDate: true },
      });
      if (overlapping) {
        throw new BadRequestException(`Periode fiskal tumpang tindih dengan ${overlapping.name}.`);
      }
      const period = await tx.fiscalPeriod.create({
        data: { companyId: scope.companyId, branchId: scope.branchId, name: dto.name, startDate, endDate },
      });
      await tx.auditLog.create({
        data: {
          companyId: scope.companyId,
          userId: user.sub,
          action: 'CREATE_FISCAL_PERIOD',
          entityType: 'FiscalPeriod',
          entityId: period.id,
          payload: { branchId: scope.branchId, startDate: dto.startDate, endDate: dto.endDate },
        },
      });
      return period;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async softCloseFiscalPeriod(id: string, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    return this.prisma.$transaction(async (tx) => {
      const period = await this.scopedFiscalPeriod(tx, user, scope, id);
      if (period.status === 'CLOSED') throw new BadRequestException('Periode CLOSED bersifat final dan tidak dapat di-soft-close.');
      if (period.status === 'SOFT_CLOSED') return period;
      const checks = await this.fiscalCloseBlockers(tx, scope, period.startDate, period.endDate);
      if (this.hasFiscalCloseBlockers(checks)) {
        throw new BadRequestException({
          code: 'FISCAL_PERIOD_SOFT_CLOSE_BLOCKED',
          message: 'Periode belum dapat di-soft-close karena masih ada item rekonsiliasi yang belum selesai.',
          details: checks,
        });
      }
      const updated = await tx.fiscalPeriod.update({
        where: { id: period.id },
        data: { status: 'SOFT_CLOSED', closedById: null, closedAt: null },
      });
      await this.audit(tx, user, scope, 'SOFT_CLOSE_FISCAL_PERIOD', 'FiscalPeriod', period.id, {
        branchId: scope.branchId,
        checks,
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async reopenFiscalPeriod(id: string, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    return this.prisma.$transaction(async (tx) => {
      const period = await this.scopedFiscalPeriod(tx, user, scope, id);
      if (period.status === 'CLOSED') {
        throw new BadRequestException('Periode CLOSED bersifat final. Gunakan adjustment/reversal pada periode terbuka, bukan reopen.');
      }
      if (period.status === 'OPEN') return period;
      const updated = await tx.fiscalPeriod.update({
        where: { id: period.id },
        data: { status: 'OPEN', closedById: null, closedAt: null },
      });
      await this.audit(tx, user, scope, 'REOPEN_FISCAL_PERIOD', 'FiscalPeriod', period.id, { branchId: scope.branchId });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async closeFiscalPeriod(id: string, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    return this.prisma.$transaction(async (tx) => {
      const period = await this.scopedFiscalPeriod(tx, user, scope, id);
      if (period.status === 'CLOSED') return period;
      if (period.status !== 'SOFT_CLOSED') {
        throw new BadRequestException('Periode harus SOFT_CLOSED dan direkonsiliasi sebelum final close.');
      }
      const checks = await this.fiscalCloseBlockers(tx, scope, period.startDate, period.endDate);
      if (this.hasFiscalCloseBlockers(checks)) {
        throw new BadRequestException({
          code: 'FISCAL_PERIOD_CLOSE_BLOCKED',
          message: 'Periode belum dapat ditutup karena masih ada item rekonsiliasi yang belum selesai.',
          details: checks,
        });
      }
      const closed = await tx.fiscalPeriod.update({
        where: { id: period.id },
        data: { status: 'CLOSED', closedById: user.sub, closedAt: new Date() },
      });
      await this.audit(tx, user, scope, 'CLOSE_FISCAL_PERIOD', 'FiscalPeriod', period.id, {
        branchId: scope.branchId,
        checks,
      });
      return closed;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }


  async bankStatements(user: AuthUser, requestedCompanyId?: string, requestedBranchId?: string) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, requestedCompanyId, requestedBranchId, 'BankStatement');
    return this.prisma.bankStatement.findMany({
      where: { companyId: scope.companyId, branchId: scope.branchId },
      include: { lines: true },
      orderBy: { importedAt: 'desc' },
    });
  }

  async importBankStatement(dto: ImportBankStatementDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, dto.companyId, dto.branchId, 'BankStatement');
    if (!dto.fileName.trim()) throw new BadRequestException('Nama file bank statement wajib sebagai identitas idempoten.');
    if (!dto.lines.length) throw new BadRequestException('Bank statement harus memiliki baris transaksi.');
    return this.prisma.$transaction(async (tx) => {
      const account = await this.assertBankAccount(tx, user, scope, dto.bankAccountId);
      const normalizedLines = dto.lines.map((line) => {
        const transactionDate = new Date(line.transactionDate);
        const debit = new Prisma.Decimal(line.debit ?? 0);
        const credit = new Prisma.Decimal(line.credit ?? 0);
        if (debit.isNegative() || credit.isNegative()) throw new BadRequestException('Debit/credit bank statement tidak boleh negatif.');
        if ((debit.isZero() && credit.isZero()) || (!debit.isZero() && !credit.isZero())) {
          throw new BadRequestException('Setiap baris bank statement wajib memiliki tepat satu sisi debit atau credit yang bernilai positif.');
        }
        return {
          transactionDate,
          description: line.description.trim(),
          reference: line.reference?.trim() || undefined,
          debit,
          credit,
          balance: line.balance === undefined ? null : new Prisma.Decimal(line.balance),
          raw: line.raw === undefined ? undefined : json(line.raw),
        };
      });
      const firstDate = normalizedLines.reduce((min, line) => line.transactionDate < min ? line.transactionDate : min, normalizedLines[0].transactionDate);
      const lastDate = normalizedLines.reduce((max, line) => line.transactionDate > max ? line.transactionDate : max, normalizedLines[0].transactionDate);
      const periodStart = dto.periodStart ? boundaryDate(dto.periodStart, false) : boundaryDate(firstDate.toISOString().slice(0, 10), false);
      const periodEnd = dto.periodEnd ? boundaryDate(dto.periodEnd, true) : boundaryDate(lastDate.toISOString().slice(0, 10), true);
      if (periodStart > periodEnd) throw new BadRequestException('Periode bank statement tidak valid.');
      if (normalizedLines.some((line) => line.transactionDate < periodStart || line.transactionDate > periodEnd)) {
        throw new BadRequestException('Ada baris bank statement di luar periodStart/periodEnd.');
      }

      const existing = await tx.bankStatement.findFirst({
        where: { companyId: scope.companyId, branchId: scope.branchId, source: dto.source, fileName: dto.fileName },
        include: { lines: true },
      });
      if (existing) {
        const sameHeader = existing.bankAccountId === account.id
          && existing.periodStart?.getTime() === periodStart.getTime()
          && existing.periodEnd?.getTime() === periodEnd.getTime()
          && (existing.openingBalance?.equals(dto.openingBalance ?? 0) ?? dto.openingBalance === undefined)
          && (existing.closingBalance?.equals(dto.closingBalance ?? 0) ?? dto.closingBalance === undefined)
          && existing.lines.length === normalizedLines.length;
        const key = (line: { transactionDate: Date; description: string; reference?: string | null; debit: Prisma.Decimal; credit: Prisma.Decimal; balance?: Prisma.Decimal | null }) => [
          line.transactionDate.toISOString(), line.description.trim(), line.reference ?? '', line.debit.toString(), line.credit.toString(), line.balance?.toString() ?? '',
        ].join('|');
        const existingKeys = existing.lines.map((line) => key(line)).sort();
        const incomingKeys = normalizedLines.map((line) => key(line)).sort();
        if (!sameHeader || existingKeys.some((value, index) => value !== incomingKeys[index])) {
          throw new BadRequestException('Identitas file bank statement sudah pernah dipakai dengan payload berbeda.');
        }
        return existing;
      }

      const statement = await tx.bankStatement.create({
        data: {
          companyId: scope.companyId,
          branchId: scope.branchId,
          bankAccountId: account.id,
          source: dto.source.trim(),
          fileName: dto.fileName.trim(),
          periodStart,
          periodEnd,
          openingBalance: dto.openingBalance === undefined ? undefined : new Prisma.Decimal(dto.openingBalance),
          closingBalance: dto.closingBalance === undefined ? undefined : new Prisma.Decimal(dto.closingBalance),
          lines: { create: normalizedLines.map((line) => ({
            transactionDate: line.transactionDate,
            description: line.description,
            reference: line.reference,
            debit: line.debit,
            credit: line.credit,
            balance: line.balance,
            raw: line.raw,
          })) },
        },
        include: { lines: true },
      });
      await this.audit(tx, user, scope, 'IMPORT_BANK_STATEMENT', 'BankStatement', statement.id, {
        branchId: scope.branchId,
        bankAccountId: account.id,
        source: dto.source,
        lineCount: dto.lines.length,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      });
      return statement;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async reconciliations(user: AuthUser, requestedCompanyId?: string, requestedBranchId?: string) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, requestedCompanyId, requestedBranchId, 'BankReconciliation');
    return this.prisma.bankReconciliation.findMany({
      where: { companyId: scope.companyId, branchId: scope.branchId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createReconciliation(dto: CreateReconciliationDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, dto.companyId, dto.branchId, 'BankReconciliation');
    const startDate = boundaryDate(dto.startDate, false);
    const endDate = boundaryDate(dto.endDate, true);
    if (startDate > endDate) throw new BadRequestException('Tanggal awal rekonsiliasi tidak boleh melewati tanggal akhir.');
    return this.prisma.$transaction(async (tx) => {
      await this.scopedBankStatement(tx, user, scope, dto.statementId);
      const statement = await tx.bankStatement.findUnique({ where: { id: dto.statementId }, include: { lines: true } });
      if (!statement) throw new BadRequestException('Bank statement tidak ditemukan.');
      const bankAccountId = dto.bankAccountId ?? statement.bankAccountId;
      if (!bankAccountId) throw new BadRequestException('Bank statement belum terikat ke account bank. Import ulang atau pilih bankAccountId.');
      if (statement.bankAccountId && dto.bankAccountId && statement.bankAccountId !== dto.bankAccountId) {
        throw new BadRequestException('bankAccountId rekonsiliasi berbeda dari bank statement.');
      }
      await this.assertBankAccount(tx, user, scope, bankAccountId);
      if (statement.periodStart && startDate < statement.periodStart) throw new BadRequestException('Tanggal awal rekonsiliasi berada sebelum periode statement.');
      if (statement.periodEnd && endDate > statement.periodEnd) throw new BadRequestException('Tanggal akhir rekonsiliasi berada setelah periode statement.');

      const statementLines = statement.lines.filter((line) => line.transactionDate >= startDate && line.transactionDate <= endDate);
      if (!statementLines.length) throw new BadRequestException('Tidak ada baris bank statement pada periode rekonsiliasi.');
      const bookBalance = await this.journalBookBalance(tx, bankAccountId, endDate);
      const bankBalance = this.statementBalance(statement, statementLines, dto.bankBalance);
      if (dto.bookBalance !== undefined && !bookBalance.equals(dto.bookBalance)) {
        throw new BadRequestException(`Saldo buku client stale. Server=${bookBalance.toFixed(2)}.`);
      }
      if (dto.bankBalance !== undefined && !bankBalance.equals(dto.bankBalance)) {
        throw new BadRequestException(`Saldo bank client berbeda dari statement. Server=${bankBalance.toFixed(2)}.`);
      }
      const difference = bankBalance.sub(bookBalance);

      const existing = await tx.bankReconciliation.findFirst({
        where: { companyId: scope.companyId, branchId: scope.branchId, statementId: statement.id, startDate, endDate },
      });
      if (existing) {
        if (existing.bankAccountId !== bankAccountId || !existing.bookBalance.equals(bookBalance) || !existing.bankBalance.equals(bankBalance)) {
          throw new BadRequestException('Rekonsiliasi periode ini sudah ada tetapi snapshot saldo telah berubah. Buat periode/snapshot baru setelah menyelesaikan perubahan ledger.');
        }
        return existing;
      }
      const matchedCount = statementLines.filter((line) => line.matched).length;
      const unmatchedCount = statementLines.length - matchedCount;
      const completed = difference.isZero() && unmatchedCount === 0;
      const reconciliation = await tx.bankReconciliation.create({
        data: {
          companyId: scope.companyId,
          branchId: scope.branchId,
          bankAccountId,
          statementId: statement.id,
          startDate,
          endDate,
          bookBalance,
          bankBalance,
          difference,
          matchedCount,
          createdById: user.sub,
          status: completed ? 'COMPLETED' : 'IN_PROGRESS',
          completedById: completed ? user.sub : undefined,
          completedAt: completed ? new Date() : undefined,
        },
      });
      await this.audit(tx, user, scope, 'CREATE_BANK_RECONCILIATION', 'BankReconciliation', reconciliation.id, {
        branchId: scope.branchId,
        statementId: statement.id,
        bankAccountId,
        bookBalance: bookBalance.toString(),
        bankBalance: bankBalance.toString(),
        difference: difference.toString(),
        matchedCount,
        unmatchedCount,
      });
      return reconciliation;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async reconciliationDetails(id: string, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    const reconciliation = await this.scopedReconciliation(this.prisma, user, scope, id);
    if (!reconciliation.statementId || !reconciliation.bankAccountId) throw new BadRequestException('Rekonsiliasi belum memiliki statement/account bank lengkap.');
    await this.assertBankAccount(this.prisma, user, scope, reconciliation.bankAccountId);
    const [statementLines, journalLines] = await Promise.all([
      this.prisma.bankStatementLine.findMany({
        where: { statementId: reconciliation.statementId, transactionDate: { gte: reconciliation.startDate, lte: reconciliation.endDate } },
        orderBy: [{ transactionDate: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.journalLine.findMany({
        where: {
          accountId: reconciliation.bankAccountId,
          journalEntry: { date: { gte: reconciliation.startDate, lte: reconciliation.endDate } },
        },
        include: { journalEntry: true },
        orderBy: [{ journalEntry: { date: 'asc' } }, { id: 'asc' }],
        take: 2000,
      }),
    ]);
    return { reconciliation, statementLines, journalLines };
  }

  async autoMatchReconciliation(id: string, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    return this.prisma.$transaction(async (tx) => {
      const reconciliation = await this.scopedReconciliation(tx, user, scope, id);
      if (reconciliation.status === 'CANCELLED') throw new BadRequestException('Rekonsiliasi sudah dibatalkan.');
      if (!reconciliation.statementId || !reconciliation.bankAccountId) throw new BadRequestException('Rekonsiliasi belum memiliki statement/account bank lengkap.');
      await this.assertBankAccount(tx, user, scope, reconciliation.bankAccountId);
      const [statementLines, journalLines, matchedRows] = await Promise.all([
        tx.bankStatementLine.findMany({
          where: {
            statementId: reconciliation.statementId,
            transactionDate: { gte: reconciliation.startDate, lte: reconciliation.endDate },
            matched: false,
          },
          orderBy: [{ transactionDate: 'asc' }, { id: 'asc' }],
        }),
        tx.journalLine.findMany({
          where: {
            accountId: reconciliation.bankAccountId,
            journalEntry: { date: { gte: reconciliation.startDate, lte: reconciliation.endDate } },
          },
          include: { journalEntry: true },
          orderBy: [{ journalEntry: { date: 'asc' } }, { id: 'asc' }],
          take: 2000,
        }),
        tx.bankStatementLine.findMany({
          where: {
            matched: true,
            matchedType: 'JournalLine',
            matchedId: { not: null },
            statement: { companyId: scope.companyId, branchId: scope.branchId },
          },
          select: { matchedId: true },
        }),
      ]);
      const usedJournalIds = new Set(matchedRows.map((row) => row.matchedId).filter((value): value is string => Boolean(value)));
      let matched = 0;
      for (const statementLine of statementLines) {
        let candidates = journalLines.filter((journalLine) => !usedJournalIds.has(journalLine.id)
          && this.sameBusinessDate(statementLine.transactionDate, journalLine.journalEntry.date)
          && this.bankLineMatchesJournalAmount(statementLine, journalLine));
        if (candidates.length > 1 && statementLine.reference) {
          const reference = this.normalizeBankReference(statementLine.reference);
          const referenceMatches = candidates.filter((candidate) => {
            const haystack = [candidate.journalEntry.number, candidate.journalEntry.referenceId, candidate.journalEntry.description]
              .map((value) => this.normalizeBankReference(value)).filter(Boolean);
            return reference && haystack.some((value) => value.includes(reference) || reference.includes(value));
          });
          if (referenceMatches.length === 1) candidates = referenceMatches;
        }
        if (candidates.length !== 1) continue;
        const candidate = candidates[0];
        await tx.bankStatementLine.update({
          where: { id: statementLine.id },
          data: { matched: true, matchedType: 'JournalLine', matchedId: candidate.id },
        });
        usedJournalIds.add(candidate.id);
        matched += 1;
      }
      const refreshed = await this.refreshReconciliation(tx, user, scope, reconciliation.id);
      await this.audit(tx, user, scope, 'AUTO_MATCH_BANK_RECONCILIATION', 'BankReconciliation', reconciliation.id, {
        matchedThisRun: matched,
        matchedTotal: refreshed.matchedCount,
        status: refreshed.status,
      });
      return { reconciliation: refreshed, matchedThisRun: matched };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async matchReconciliation(id: string, dto: MatchBankReconciliationDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    return this.prisma.$transaction(async (tx) => {
      const reconciliation = await this.scopedReconciliation(tx, user, scope, id);
      if (reconciliation.status === 'CANCELLED') throw new BadRequestException('Rekonsiliasi sudah dibatalkan.');
      if (!reconciliation.statementId || !reconciliation.bankAccountId) throw new BadRequestException('Rekonsiliasi belum memiliki statement/account bank lengkap.');
      const statementLine = await tx.bankStatementLine.findFirst({
        where: {
          id: dto.statementLineId,
          statementId: reconciliation.statementId,
          transactionDate: { gte: reconciliation.startDate, lte: reconciliation.endDate },
        },
      });
      if (!statementLine) return this.denyTenantAccess(tx, user, scope, 'BankStatementLine', dto.statementLineId);
      const journalLine = await tx.journalLine.findFirst({
        where: {
          id: dto.journalLineId,
          accountId: reconciliation.bankAccountId,
          journalEntry: { date: { gte: reconciliation.startDate, lte: reconciliation.endDate } },
        },
        include: { journalEntry: true },
      });
      if (!journalLine) return this.denyTenantAccess(tx, user, scope, 'JournalLine', dto.journalLineId);
      if (!this.bankLineMatchesJournalAmount(statementLine, journalLine)) {
        throw new BadRequestException('Nominal/direction bank statement tidak sama dengan journal line.');
      }
      const used = await tx.bankStatementLine.findFirst({
        where: { matched: true, matchedType: 'JournalLine', matchedId: journalLine.id, id: { not: statementLine.id } },
        select: { id: true },
      });
      if (used) throw new BadRequestException('Journal line sudah dipakai oleh bank statement line lain.');
      await tx.bankStatementLine.update({
        where: { id: statementLine.id },
        data: { matched: true, matchedType: 'JournalLine', matchedId: journalLine.id },
      });
      const refreshed = await this.refreshReconciliation(tx, user, scope, reconciliation.id);
      await this.audit(tx, user, scope, 'MATCH_BANK_RECONCILIATION_LINE', 'BankReconciliation', reconciliation.id, {
        statementLineId: statementLine.id,
        journalLineId: journalLine.id,
      });
      return refreshed;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async unmatchReconciliation(id: string, dto: UnmatchBankReconciliationDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    return this.prisma.$transaction(async (tx) => {
      const reconciliation = await this.scopedReconciliation(tx, user, scope, id);
      if (!reconciliation.statementId) throw new BadRequestException('Rekonsiliasi tidak memiliki bank statement.');
      const statementLine = await tx.bankStatementLine.findFirst({
        where: {
          id: dto.statementLineId,
          statementId: reconciliation.statementId,
          transactionDate: { gte: reconciliation.startDate, lte: reconciliation.endDate },
        },
      });
      if (!statementLine) return this.denyTenantAccess(tx, user, scope, 'BankStatementLine', dto.statementLineId);
      if (!statementLine.matched) return reconciliation;
      const previousMatch = { matchedType: statementLine.matchedType, matchedId: statementLine.matchedId };
      await tx.bankStatementLine.update({
        where: { id: statementLine.id },
        data: { matched: false, matchedType: null, matchedId: null },
      });
      const refreshed = await this.refreshReconciliation(tx, user, scope, reconciliation.id);
      await this.audit(tx, user, scope, 'UNMATCH_BANK_RECONCILIATION_LINE', 'BankReconciliation', reconciliation.id, {
        statementLineId: statementLine.id,
        previousMatch,
      });
      return refreshed;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }


  async devices(user: AuthUser, requestedCompanyId?: string) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, requestedCompanyId, undefined, 'Device');
    return this.prisma.device.findMany({
      where: { companyId: scope.companyId, branchId: scope.branchId },
      orderBy: { name: 'asc' },
    });
  }

  async registerDevice(dto: RegisterDeviceDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, dto.companyId, dto.branchId, 'Device');
    if (dto.warehouseId) await this.assertWarehouse(this.prisma, user, scope, dto.warehouseId);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.device.findFirst({ where: { companyId: scope.companyId, code: dto.code } });
      if (existing && existing.branchId !== scope.branchId) {
        return this.denyTenantAccess(tx, user, scope, 'Device', existing.id, { code: dto.code });
      }
      const data = {
        companyId: scope.companyId,
        branchId: scope.branchId,
        warehouseId: dto.warehouseId,
        code: dto.code,
        name: dto.name,
        platform: dto.platform,
        appVersion: dto.appVersion,
        publicKey: dto.publicKey,
        lastSeenAt: new Date(),
        isActive: true,
      };
      const device = existing
        ? await tx.device.update({ where: { id: existing.id }, data })
        : await tx.device.create({ data });
      await this.audit(tx, user, scope, existing ? 'UPDATE_DEVICE' : 'REGISTER_DEVICE', 'Device', device.id, {
        branchId: scope.branchId, warehouseId: dto.warehouseId, code: dto.code,
      });
      return device;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async rotateDeviceCredential(deviceId: string, dto: RotateDeviceCredentialDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date())) throw new BadRequestException('Masa berlaku credential device tidak valid.');
    return this.prisma.$transaction(async (tx) => {
      const device = await this.scopedDevice(tx, user, scope, deviceId);
      const secret = randomBytes(32).toString('base64url');
      const keyId = randomBytes(12).toString('hex');
      const secretHash = createHash('sha256').update(`${device.id}:${keyId}:${secret}`).digest('hex');
      await tx.deviceCredential.updateMany({ where: { deviceId: device.id, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: new Date() } });
      const credential = await tx.deviceCredential.create({ data: {
        deviceId: device.id, keyId, secretHash, encryptedSecret: this.secrets.encryptText(secret), publicKey: dto.publicKey?.trim() || device.publicKey,
        expiresAt, createdById: user.sub,
      } });
      if (dto.publicKey?.trim()) await tx.device.update({ where: { id: device.id }, data: { publicKey: dto.publicKey.trim(), lastSeenAt: new Date() } });
      await this.audit(tx, user, scope, 'ROTATE_DEVICE_CREDENTIAL', 'Device', device.id, { branchId: scope.branchId, keyId, expiresAt: expiresAt?.toISOString() ?? null });
      return { deviceId: device.id, credentialId: credential.id, keyId, secret, expiresAt: credential.expiresAt, note: 'Secret hanya ditampilkan sekali. Simpan pada secure store node toko.' };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async setDeviceStatus(deviceId: string, isActive: boolean, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    return this.prisma.$transaction(async (tx) => {
      const device = await tx.device.findFirst({ where: { id: deviceId, companyId: scope.companyId, branchId: scope.branchId } });
      if (!device) return this.denyTenantAccess(tx, user, scope, 'Device', deviceId);
      if (device.isActive === isActive) return device;
      const updated = await tx.device.update({ where: { id: device.id }, data: { isActive } });
      if (!isActive) {
        await tx.deviceCredential.updateMany({
          where: { deviceId: device.id, status: 'ACTIVE' },
          data: { status: 'REVOKED', revokedAt: new Date() },
        });
      }
      await this.audit(tx, user, scope, isActive ? 'ACTIVATE_DEVICE' : 'DEACTIVATE_DEVICE', 'Device', device.id, {
        branchId: scope.branchId, credentialsRevoked: !isActive,
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async acknowledgeSyncReceiptScoped(
    scope: TenantScope,
    deviceId: string,
    dto: AcknowledgeSyncReceiptDto,
    actorUserId?: string,
  ) {
    const checkpoint = new Date(dto.checkpoint);
    if (Number.isNaN(checkpoint.getTime())) throw new BadRequestException('Checkpoint acknowledgement tidak valid.');
    return this.prisma.$transaction(async (tx) => {
      const device = await tx.device.findFirst({ where: { id: deviceId, companyId: scope.companyId, branchId: scope.branchId, isActive: true } });
      if (!device) throw new ForbiddenException('Device sync tidak tersedia pada tenant/branch ini.');
      const receipt = await tx.syncReceipt.findFirst({ where: { id: dto.receiptId, deviceId: device.id, companyId: scope.companyId, branchId: scope.branchId } });
      if (!receipt) throw new ForbiddenException('Sync receipt tidak tersedia pada device/tenant ini.');
      if (receipt.checkpoint.getTime() !== checkpoint.getTime()) throw new BadRequestException('Checkpoint acknowledgement tidak sama dengan receipt yang diterbitkan server.');
      if (receipt.status === 'ACKNOWLEDGED') return receipt;
      const updated = await tx.syncReceipt.update({ where: { id: receipt.id }, data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() } });
      await tx.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
      await tx.auditLog.create({ data: { companyId: scope.companyId, userId: actorUserId, action: 'ACK_SYNC_RECEIPT', entityType: 'SyncReceipt', entityId: receipt.id, payload: { branchId: scope.branchId, deviceId: device.id, eventCount: receipt.eventCount, authType: actorUserId ? 'OPERATOR' : 'DEVICE_HMAC' } } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async acknowledgeSyncReceipt(deviceId: string, dto: AcknowledgeSyncReceiptDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    await this.scopedDevice(this.prisma, user, scope, deviceId);
    return this.acknowledgeSyncReceiptScoped(scope, deviceId, dto, user.sub);
  }

  async edgeAcknowledgeSync(identity: EdgeDeviceIdentity, dto: AcknowledgeSyncReceiptDto) {
    return this.acknowledgeSyncReceiptScoped({ companyId: identity.companyId, branchId: identity.branchId }, identity.deviceId, dto);
  }

  async requeueOfflineTransaction(deviceId: string, transactionId: string, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    return this.prisma.$transaction(async (tx) => {
      const device = await this.scopedDevice(tx, user, scope, deviceId);
      const row = await tx.offlineTransaction.findFirst({ where: { id: transactionId, deviceId: device.id } });
      if (!row) return this.denyTenantAccess(tx, user, scope, 'OfflineTransaction', transactionId, { deviceId: device.id });
      if (!['FAILED','CONFLICT','DEAD_LETTER'].includes(row.status)) throw new BadRequestException(`Offline transaction berstatus ${row.status} tidak dapat direqueue.`);
      const updated = await tx.offlineTransaction.update({ where: { id: row.id }, data: { status: 'PENDING', nextRetryAt: null, deadLetteredAt: null, errorMessage: null } });
      await this.audit(tx, user, scope, 'REQUEUE_OFFLINE_TRANSACTION', 'OfflineTransaction', row.id, { branchId: scope.branchId, deviceId: device.id, previousStatus: row.status, attempts: row.attempts });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /**
   * Pull perubahan dari server pusat ke server toko (w6-edge-central-sync).
   * Node toko membawa checkpoint 'since'; server mengembalikan event outbox sejak checkpoint itu.
   */
  private async syncPullScoped(scope: TenantScope, since?: string, cursor?: string, deviceId?: string) {
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 86400000);
    if (Number.isNaN(sinceDate.getTime())) throw new BadRequestException('Checkpoint sync tidak valid.');
    const syncDevice = deviceId ? await this.prisma.device.findFirst({ where: { id: deviceId, companyId: scope.companyId, branchId: scope.branchId, isActive: true } }) : null;
    if (deviceId && !syncDevice) throw new ForbiddenException('Device sync tidak tersedia pada tenant/branch ini.');
    const tenantDevices = await this.prisma.device.findMany({ where: { companyId: scope.companyId, OR: [{ branchId: null }, { branchId: scope.branchId }] }, select: { id: true } });
    const events = await this.prisma.eventOutbox.findMany({
      where: { companyId: scope.companyId, createdAt: { gte: sinceDate }, aggregateType: { not: 'SyncHeartbeat' } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), take: 500,
    });
    const deviceIds = tenantDevices.map((device) => device.id);
    const processed = deviceIds.length ? await this.prisma.offlineTransaction.findMany({ where: { deviceId: { in: deviceIds }, status: 'APPLIED', receivedAt: { gte: sinceDate } }, orderBy: { receivedAt: 'asc' }, take: 200 }).catch(() => []) : [];
    const scopedEvents = events.filter((event) => {
      const payload = event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload) ? event.payload as Record<string, unknown> : undefined;
      if (!payload) return true;
      const branchIds = [payload.branchId, payload.sourceBranchId, payload.destinationBranchId].filter((value): value is string => typeof value === 'string');
      return branchIds.length === 0 || branchIds.includes(scope.branchId);
    });
    const hasMore = events.length === 500;
    const lastEvent = events.at(-1);
    const checkpointDate = lastEvent?.createdAt ?? new Date();
    const nextCursor = hasMore ? lastEvent?.id ?? null : null;
    let receiptId: string | null = null;
    if (syncDevice) {
      const eventIds = scopedEvents.map((event) => event.id);
      const requestHash = createHash('sha256').update(this.stableJson({ deviceId: syncDevice.id, since: sinceDate.toISOString(), cursor: cursor ?? null, checkpoint: checkpointDate.toISOString(), nextCursor, eventIds })).digest('hex');
      const receipt = await this.prisma.syncReceipt.upsert({ where: { deviceId_requestHash: { deviceId: syncDevice.id, requestHash } }, update: {}, create: { deviceId: syncDevice.id, companyId: scope.companyId, branchId: scope.branchId, since: sinceDate, checkpoint: checkpointDate, nextCursor, eventCount: eventIds.length, eventIds, requestHash } });
      receiptId = receipt.id;
    }
    return { checkpoint: checkpointDate.toISOString(), nextCursor, receiptId, events: scopedEvents.map((e) => ({ id: e.id, type: e.eventType, aggregateType: e.aggregateType, aggregateId: e.aggregateId, payload: e.payload, createdAt: e.createdAt })), offlineProcessed: processed.length, hasMore };
  }

  async syncPull(user: AuthUser, since?: string, cursor?: string, deviceId?: string) {
    const scope = this.requireTenantScope(user);
    if (deviceId) await this.scopedDevice(this.prisma, user, scope, deviceId);
    return this.syncPullScoped(scope, since, cursor, deviceId);
  }

  async edgeSyncPull(identity: EdgeDeviceIdentity, since?: string, cursor?: string) {
    return this.syncPullScoped({ companyId: identity.companyId, branchId: identity.branchId }, since, cursor, identity.deviceId);
  }

  private async submitOfflineTransactionsScoped(
    scope: TenantScope,
    deviceId: string,
    dto: SubmitOfflineTransactionsDto,
    actorUserId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const device = await tx.device.findFirst({ where: { id: deviceId, companyId: scope.companyId, branchId: scope.branchId, isActive: true } });
      if (!device) throw new ForbiddenException('Device sync tidak tersedia pada tenant/branch ini.');
      const results = [];
      for (const item of dto.transactions) {
        const payload = item.payload as Record<string, unknown> | undefined;
        if (typeof payload?.companyId === 'string' && payload.companyId !== scope.companyId) throw new ForbiddenException('Payload offline memakai company berbeda dari credential device.');
        if (typeof payload?.branchId === 'string' && payload.branchId !== scope.branchId) throw new ForbiddenException('Payload offline memakai branch berbeda dari credential device.');
        const tenantPayload = this.tenantPayload(item.payload, scope);
        const existing = await tx.offlineTransaction.findFirst({ where: { deviceId: device.id, OR: [{ localId: item.localId }, { sequence: item.sequence }] } });
        if (existing) {
          if (existing.localId !== item.localId || existing.sequence !== item.sequence || existing.transactionType !== item.transactionType || this.stableJson(existing.payload) !== this.stableJson(tenantPayload)) {
            throw new BadRequestException('Replay transaksi offline memakai localId/sequence dengan payload berbeda.');
          }
          results.push(existing); continue;
        }
        results.push(await tx.offlineTransaction.create({ data: { deviceId: device.id, localId: item.localId, sequence: item.sequence, transactionType: item.transactionType, payload: tenantPayload, status: 'PENDING' } }));
      }
      await tx.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
      await tx.auditLog.create({ data: { companyId: scope.companyId, userId: actorUserId, action: 'SUBMIT_OFFLINE_TRANSACTIONS', entityType: 'Device', entityId: device.id, payload: { branchId: scope.branchId, count: dto.transactions.length, authType: actorUserId ? 'OPERATOR' : 'DEVICE_HMAC' } } });
      return { deviceId: device.id, accepted: results.length, transactions: results };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async submitOfflineTransactions(deviceId: string, dto: SubmitOfflineTransactionsDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    await this.scopedDevice(this.prisma, user, scope, deviceId);
    return this.submitOfflineTransactionsScoped(scope, deviceId, dto, user.sub);
  }

  async edgeSubmitOfflineTransactions(identity: EdgeDeviceIdentity, dto: SubmitOfflineTransactionsDto) {
    return this.submitOfflineTransactionsScoped({ companyId: identity.companyId, branchId: identity.branchId }, identity.deviceId, dto);
  }

  async forecasts(user: AuthUser) {
    const scope = this.requireTenantScope(user);
    const warehouseIds = await this.tenantWarehouseIds(this.prisma, scope);
    return this.prisma.forecastRun.findMany({
      where: { companyId: scope.companyId, warehouseId: { in: warehouseIds } },
      include: { suggestions: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async runForecast(dto: RunForecastDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, dto.companyId, dto.branchId, 'ForecastRun');
    const warehouse = await this.assertWarehouse(this.prisma, user, scope, dto.warehouseId);
    const lookbackDays = dto.lookbackDays ?? 30;
    const horizonDays = dto.horizonDays ?? 14;
    const leadTimeDays = dto.leadTimeDays ?? 7;
    const since = new Date(Date.now() - lookbackDays * 86400000);
    return this.prisma.$transaction(async (tx) => {
      const [saleItems, inventories] = await Promise.all([
        tx.saleItem.findMany({
          where: { sale: { warehouseId: warehouse.id, branchId: scope.branchId, status: 'COMPLETED', createdAt: { gte: since } } },
          select: { productId: true, quantity: true },
        }),
        tx.inventory.findMany({
          where: { warehouseId: warehouse.id, product: { isActive: true } },
          include: { product: { select: { id: true, minStock: true } } },
        }),
      ]);
      const sold = new Map<string, number>();
      for (const item of saleItems) sold.set(item.productId, (sold.get(item.productId) ?? 0) + item.quantity);
      const run = await tx.forecastRun.create({ data: {
        companyId: scope.companyId,
        warehouseId: warehouse.id,
        model: 'MOVING_AVERAGE',
        horizonDays,
        parameters: { lookbackDays, leadTimeDays, branchId: scope.branchId },
        status: 'PROCESSING',
        startedAt: new Date(),
      } });
      const suggestions = inventories.map((inventory) => {
        const average = (sold.get(inventory.productId) ?? 0) / lookbackDays;
        const safetyStock = Math.max(inventory.product.minStock, Math.ceil(average * leadTimeDays));
        const target = Math.ceil(average * (horizonDays + leadTimeDays)) + safetyStock;
        return {
          forecastRunId: run.id,
          warehouseId: warehouse.id,
          productId: inventory.productId,
          currentStock: inventory.quantity,
          reservedStock: inventory.reserved,
          averageDailySales: new Prisma.Decimal(average),
          leadTimeDays,
          safetyStock,
          suggestedQty: Math.max(0, target - inventory.quantity + inventory.reserved),
          reason: { model: 'moving_average', lookbackDays, horizonDays, branchId: scope.branchId },
        };
      }).filter((item) => item.suggestedQty > 0);
      if (suggestions.length) await tx.reorderSuggestion.createMany({ data: suggestions });
      const completed = await tx.forecastRun.update({
        where: { id: run.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
        include: { suggestions: true },
      });
      await this.audit(tx, user, scope, 'RUN_INVENTORY_FORECAST', 'ForecastRun', run.id, {
        branchId: scope.branchId, warehouseId: warehouse.id, suggestionCount: suggestions.length,
      });
      return completed;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async shipments(user: AuthUser) {
    const scope = this.requireTenantScope(user);
    const warehouseIds = await this.tenantWarehouseIds(this.prisma, scope);
    return this.prisma.shipment.findMany({
      where: { warehouseId: { in: warehouseIds } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async createShipment(dto: CreateShipmentDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    const warehouse = await this.assertWarehouse(this.prisma, user, scope, dto.warehouseId);
    if (dto.orderId) {
      const order = await this.prisma.order.findFirst({ where: { id: dto.orderId, branchId: scope.branchId, warehouseId: warehouse.id } });
      if (!order) return this.denyTenantAccess(this.prisma, user, scope, 'Order', dto.orderId);
    }
    if (dto.saleId) {
      const sale = await this.prisma.sale.findFirst({ where: { id: dto.saleId, branchId: scope.branchId, warehouseId: warehouse.id } });
      if (!sale) return this.denyTenantAccess(this.prisma, user, scope, 'Sale', dto.saleId);
    }
    if (dto.integrationId) await this.assertIntegration(this.prisma, user, scope, dto.integrationId);
    const shipment = await this.prisma.shipment.create({ data: {
      orderId: dto.orderId,
      saleId: dto.saleId,
      warehouseId: warehouse.id,
      integrationId: dto.integrationId,
      carrier: dto.carrier,
      service: dto.service,
      number: await nextDocumentNumber(this.prisma, { companyId: scope.companyId, branchId: scope.branchId, documentType: 'SHIPMENT', prefix: 'SHP' }),
      recipient: json(dto.recipient),
      packages: dto.packages === undefined ? undefined : json(dto.packages),
      status: 'READY',
      metadata: { companyId: scope.companyId, branchId: scope.branchId },
    } });
    await this.audit(this.prisma, user, scope, 'CREATE_SHIPMENT', 'Shipment', shipment.id, {
      branchId: scope.branchId, warehouseId: warehouse.id, orderId: dto.orderId, saleId: dto.saleId,
    });
    return shipment;
  }

  async marketplaces(user: AuthUser) {
    const scope = this.requireTenantScope(user);
    const integrations = await this.prisma.integrationConnection.findMany({
      where: { companyId: scope.companyId, OR: [{ branchId: null }, { branchId: scope.branchId }] },
      select: { id: true },
    });
    return this.prisma.marketplaceOrder.findMany({
      where: { integrationId: { in: integrations.map((row) => row.id) } },
      orderBy: { lastSyncedAt: 'desc' },
      take: 500,
    });
  }

  async importMarketplaceOrder(dto: ImportMarketplaceOrderDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    const integration = await this.assertIntegration(this.prisma, user, scope, dto.integrationId);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.marketplaceOrder.findFirst({
        where: { integrationId: integration.id, externalOrderId: dto.externalOrderId },
      });
      const data = {
        integrationId: integration.id,
        externalOrderId: dto.externalOrderId,
        marketplace: dto.marketplace,
        shopId: dto.shopId,
        status: dto.status,
        orderData: this.tenantPayload(dto.orderData, scope),
        lastSyncedAt: new Date(),
      };
      const order = existing
        ? await tx.marketplaceOrder.update({ where: { id: existing.id }, data })
        : await tx.marketplaceOrder.create({ data });
      await this.audit(tx, user, scope, existing ? 'UPDATE_MARKETPLACE_ORDER' : 'IMPORT_MARKETPLACE_ORDER', 'MarketplaceOrder', order.id, {
        branchId: scope.branchId, integrationId: integration.id, externalOrderId: dto.externalOrderId,
      });
      return order;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async notificationTemplates(user: AuthUser) {
    const scope = this.requireTenantScope(user);
    return this.prisma.notificationTemplate.findMany({
      where: { companyId: scope.companyId },
      orderBy: [{ code: 'asc' }, { channel: 'asc' }],
      take: 500,
    });
  }

  async upsertNotificationTemplate(dto: UpsertNotificationTemplateDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    const code = dto.code.trim().toUpperCase();
    if (!code) throw new BadRequestException('Kode template notifikasi wajib diisi.');
    if (!dto.body.trim()) throw new BadRequestException('Body template notifikasi wajib diisi.');
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.notificationTemplate.upsert({
        where: { companyId_code_channel: { companyId: scope.companyId, code, channel: dto.channel } },
        create: {
          companyId: scope.companyId, code, channel: dto.channel, subject: dto.subject?.trim() || undefined,
          body: dto.body, variables: dto.variables ? json(dto.variables) : undefined, isActive: dto.isActive ?? true,
        },
        update: {
          subject: dto.subject?.trim() || null, body: dto.body, variables: dto.variables ? json(dto.variables) : Prisma.JsonNull,
          isActive: dto.isActive ?? true,
        },
      });
      await this.audit(tx, user, scope, 'UPSERT_NOTIFICATION_TEMPLATE', 'NotificationTemplate', row.id, { code, channel: dto.channel });
      return row;
    });
  }

  async notifications(user: AuthUser) {
    const scope = this.requireTenantScope(user);
    const rows = await this.prisma.notification.findMany({
      where: { companyId: scope.companyId },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return rows.filter((row) => {
      const data = row.data as Record<string, unknown> | null;
      return !data?.branchId || data.branchId === scope.branchId;
    }).slice(0, 200);
  }

  async queueNotification(dto: QueueNotificationDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, dto.companyId, dto.branchId, 'Notification');
    const templateCode = dto.templateCode?.trim().toUpperCase();
    const template = templateCode ? await this.prisma.notificationTemplate.findFirst({
      where: { companyId: scope.companyId, code: templateCode, channel: dto.channel, isActive: true },
    }) : null;
    if (templateCode && !template) throw new BadRequestException('Template notifikasi aktif untuk channel tersebut tidak ditemukan.');
    const renderData = dto.data ?? {};
    const bodySource = dto.body?.trim() ? dto.body : template?.body;
    if (!bodySource?.trim()) throw new BadRequestException('Body atau templateCode notifikasi wajib tersedia.');
    const body = renderNotificationTemplate(bodySource, renderData) as string;
    const subject = renderNotificationTemplate(dto.subject?.trim() || template?.subject, renderData);
    const notification = await this.prisma.notification.create({ data: {
      companyId: scope.companyId,
      channel: dto.channel,
      recipient: dto.recipient.trim(),
      templateCode: templateCode || undefined,
      subject,
      body,
      data: this.tenantPayload(renderData, scope),
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : new Date(),
    } });
    await this.audit(this.prisma, user, scope, 'QUEUE_NOTIFICATION', 'Notification', notification.id, {
      branchId: scope.branchId, channel: dto.channel, templateCode: templateCode ?? null,
    });
    return notification;
  }
}
