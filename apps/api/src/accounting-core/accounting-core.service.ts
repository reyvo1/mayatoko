import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TaxTransactionDirection } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { nextDocumentNumber } from '../common/numbering';
import { decodeCursor, parsePageLimit, toCursorPage } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostingRuleDto, CreateTaxCodeDto, PostManualAccountingEventDto } from './dto/accounting-core.dto';

export interface OperationalEventLineInput {
  itemType?: string;
  itemId?: string;
  description?: string;
  quantity?: Prisma.Decimal.Value;
  unitAmount?: Prisma.Decimal.Value;
  netAmount?: Prisma.Decimal.Value;
  taxAmount?: Prisma.Decimal.Value;
  grossAmount?: Prisma.Decimal.Value;
  taxCodeId?: string;
  dimensions?: Prisma.InputJsonValue;
}

export interface OperationalTaxLineInput {
  taxCodeId: string;
  direction: TaxTransactionDirection;
  taxableBase: Prisma.Decimal.Value;
  taxAmount: Prisma.Decimal.Value;
  counterpartyType?: string;
  counterpartyId?: string;
  documentNumber?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface PostOperationalEventInput {
  companyId: string;
  branchId: string;
  eventType: string;
  sourceType: string;
  sourceId: string;
  idempotencyKey: string;
  businessDate?: Date;
  currency?: string;
  amounts: Record<string, Prisma.Decimal.Value>;
  accountCodes?: Record<string, string>;
  lines?: OperationalEventLineInput[];
  taxLines?: OperationalTaxLineInput[];
  context?: Prisma.InputJsonValue;
}

type DbClient = Prisma.TransactionClient | PrismaService;
type TenantScope = { companyId: string; branchId: string };
type RuleLine = { accountCode?: string; accountCodeKey?: string; side: 'DEBIT'|'CREDIT'; amountKey: string; description?: string; skipIfZero?: boolean };

@Injectable()
export class AccountingCoreService {
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
        payload: payload ?? { authenticatedBranchId: scope.branchId },
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
    entityType = 'AccountingScope',
  ): Promise<void> {
    const companyMismatch = requestedCompanyId && requestedCompanyId !== scope.companyId;
    const branchMismatch = requestedBranchId && requestedBranchId !== scope.branchId;
    if (companyMismatch || branchMismatch) {
      await this.denyTenantAccess(client, user, scope, entityType, undefined, {
        authenticatedCompanyId: scope.companyId,
        authenticatedBranchId: scope.branchId,
        ...(requestedCompanyId ? { requestedCompanyId } : {}),
        ...(requestedBranchId ? { requestedBranchId } : {}),
      });
    }
  }

  async listAccounts(user: AuthUser) {
    const scope = this.requireTenantScope(user);
    return this.prisma.account.findMany({
      where: { branchId: scope.branchId, branch: { companyId: scope.companyId } },
      select: { id: true, code: true, name: true, type: true, isActive: true },
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
    });
  }

  async listEvents(user: AuthUser, limitValue?: string, cursorValue?: string, requestedCompanyId?: string) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, requestedCompanyId);
    const limit = parsePageLimit(limitValue);
    const cursor = decodeCursor<{ createdAt: string; id: string }>(cursorValue);
    const rows = await this.prisma.accountingEvent.findMany({
      where: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        ...(cursor ? { OR: [
          { createdAt: { lt: new Date(cursor.createdAt) } },
          { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
        ] } : {}),
      },
      include: { lines: true, postings: true, taxTransactions: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    return toCursorPage(rows, limit, (item) => ({ createdAt: item.createdAt.toISOString(), id: item.id }));
  }

  async listTaxCodes(user: AuthUser, requestedCompanyId?: string) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, requestedCompanyId, undefined, 'TaxCode');
    return this.prisma.taxCode.findMany({
      where: { companyId: scope.companyId },
      orderBy: [{ scope: 'asc' }, { code: 'asc' }],
    });
  }

  async createTaxCode(dto: CreateTaxCodeDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, dto.companyId, undefined, 'TaxCode');
    return this.prisma.$transaction(async (tx) => {
      const taxCode = await tx.taxCode.upsert({
        where: { companyId_code: { companyId: scope.companyId, code: dto.code } },
        create: {
          companyId: scope.companyId, code: dto.code, name: dto.name, scope: dto.scope,
          rate: new Prisma.Decimal(dto.rate), inclusive: dto.inclusive ?? false,
          recoverable: dto.recoverable ?? false, payableAccountCode: dto.payableAccountCode,
          receivableAccountCode: dto.receivableAccountCode, expenseAccountCode: dto.expenseAccountCode,
          effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
          status: dto.status ?? 'DRAFT', calculationRules: dto.calculationRules as Prisma.InputJsonValue | undefined,
          legalReference: dto.legalReference,
        },
        update: {
          name: dto.name, scope: dto.scope, rate: new Prisma.Decimal(dto.rate), inclusive: dto.inclusive ?? false,
          recoverable: dto.recoverable ?? false, payableAccountCode: dto.payableAccountCode,
          receivableAccountCode: dto.receivableAccountCode, expenseAccountCode: dto.expenseAccountCode,
          effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
          status: dto.status ?? 'DRAFT', calculationRules: dto.calculationRules as Prisma.InputJsonValue | undefined,
          legalReference: dto.legalReference,
        },
      });
      await tx.auditLog.create({
        data: {
          companyId: scope.companyId,
          userId: user.sub,
          action: 'UPSERT_TAX_CODE',
          entityType: 'TaxCode',
          entityId: taxCode.id,
          payload: { code: taxCode.code, status: taxCode.status },
        },
      });
      return taxCode;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async listPostingRules(user: AuthUser, eventType?: string, requestedCompanyId?: string) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, requestedCompanyId, undefined, 'AccountingPostingRule');
    return this.prisma.accountingPostingRule.findMany({
      where: { companyId: scope.companyId, ...(eventType ? { eventType } : {}) },
      orderBy: [{ eventType: 'asc' }, { priority: 'asc' }, { version: 'desc' }],
    });
  }

  async createPostingRule(dto: CreatePostingRuleDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, dto.companyId, undefined, 'AccountingPostingRule');
    if (!dto.journalLines.length) throw new BadRequestException('Aturan jurnal harus memiliki baris.');
    return this.prisma.$transaction(async (tx) => {
      const rule = await tx.accountingPostingRule.upsert({
        where: { companyId_code_version: { companyId: scope.companyId, code: dto.code, version: dto.version ?? 1 } },
        create: {
          companyId: scope.companyId, code: dto.code, version: dto.version ?? 1, name: dto.name,
          eventType: dto.eventType, priority: dto.priority ?? 100, status: (dto.status ?? 'DRAFT') as never,
          effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
          conditions: dto.conditions as Prisma.InputJsonValue | undefined,
          journalLines: dto.journalLines as unknown as Prisma.InputJsonValue,
          taxBehavior: dto.taxBehavior as Prisma.InputJsonValue | undefined,
          dimensions: dto.dimensions as Prisma.InputJsonValue | undefined,
        },
        update: {
          name: dto.name, eventType: dto.eventType, priority: dto.priority ?? 100,
          status: (dto.status ?? 'DRAFT') as never,
          effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
          conditions: dto.conditions as Prisma.InputJsonValue | undefined,
          journalLines: dto.journalLines as unknown as Prisma.InputJsonValue,
          taxBehavior: dto.taxBehavior as Prisma.InputJsonValue | undefined,
          dimensions: dto.dimensions as Prisma.InputJsonValue | undefined,
        },
      });
      await tx.auditLog.create({
        data: {
          companyId: scope.companyId,
          userId: user.sub,
          action: 'UPSERT_ACCOUNTING_POSTING_RULE',
          entityType: 'AccountingPostingRule',
          entityId: rule.id,
          payload: { code: rule.code, version: rule.version, status: rule.status },
        },
      });
      return rule;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async previewTax(taxCodeId: string, amount: Prisma.Decimal.Value, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    return this.calculateTax(this.prisma, taxCodeId, amount, scope.companyId);
  }

  async calculateTax(
    client: DbClient,
    taxCodeId: string | undefined,
    amount: Prisma.Decimal.Value,
    companyId?: string,
    effectiveAt: Date = new Date(),
    expectedScopes?: string[],
  ) {
    const grossOrBase = new Prisma.Decimal(amount);
    if (!taxCodeId) return { taxCode: null, net: grossOrBase, tax: new Prisma.Decimal(0), gross: grossOrBase };
    const taxCode = companyId
      ? await client.taxCode.findFirst({ where: { id: taxCodeId, companyId } })
      : await client.taxCode.findUnique({ where: { id: taxCodeId } });
    if (!taxCode) throw new NotFoundException(companyId ? 'Tax code tidak ditemukan.' : `Tax code ${taxCodeId} tidak ditemukan.`);
    if (taxCode.status !== 'ACTIVE') throw new BadRequestException(`Tax code ${taxCode.code} belum ACTIVE.`);
    if (taxCode.effectiveFrom && taxCode.effectiveFrom > effectiveAt) throw new BadRequestException(`Tax code ${taxCode.code} belum berlaku pada tanggal transaksi.`);
    if (taxCode.effectiveTo && taxCode.effectiveTo < effectiveAt) throw new BadRequestException(`Tax code ${taxCode.code} sudah tidak berlaku pada tanggal transaksi.`);
    if (expectedScopes?.length && !expectedScopes.includes(taxCode.scope)) {
      throw new BadRequestException(`Tax code ${taxCode.code} scope ${taxCode.scope} tidak sesuai transaksi ini.`);
    }
    const rate = new Prisma.Decimal(taxCode.rate);
    if (rate.lessThan(0)) throw new BadRequestException('Tarif pajak tidak valid.');
    if (taxCode.inclusive && rate.greaterThan(0)) {
      const divisor = new Prisma.Decimal(1).add(rate);
      const net = grossOrBase.div(divisor).toDecimalPlaces(2);
      const tax = grossOrBase.sub(net);
      return { taxCode, net, tax, gross: grossOrBase };
    }
    const tax = grossOrBase.mul(rate).toDecimalPlaces(2);
    return { taxCode, net: grossOrBase, tax, gross: grossOrBase.add(tax) };
  }

  async postOperationalEvent(client: DbClient, input: PostOperationalEventInput) {
    const existing = await client.accountingEvent.findUnique({
      where: { companyId_idempotencyKey: { companyId: input.companyId, idempotencyKey: input.idempotencyKey } },
      include: { postings: true, taxTransactions: true },
    });
    if (existing) {
      const sameIdentity = existing.branchId === input.branchId
        && existing.eventType === input.eventType
        && existing.sourceType === input.sourceType
        && existing.sourceId === input.sourceId;
      if (!sameIdentity) throw new BadRequestException('Idempotency key sudah digunakan untuk event atau branch yang berbeda.');
      return existing;
    }

    const businessDate = input.businessDate ?? new Date();
    if (input.taxLines?.length) {
      const taxCodeIds = [...new Set(input.taxLines.map((line) => line.taxCodeId))];
      const taxCodes = await client.taxCode.findMany({
        where: { id: { in: taxCodeIds }, companyId: input.companyId },
      });
      const taxCodeMap = new Map(taxCodes.map((taxCode) => [taxCode.id, taxCode]));
      for (const line of input.taxLines) {
        const taxCode = taxCodeMap.get(line.taxCodeId);
        if (!taxCode) throw new BadRequestException('Tax code event tidak tersedia untuk company transaksi.');
        if (taxCode.status !== 'ACTIVE') throw new BadRequestException(`Tax code ${taxCode.code} belum ACTIVE.`);
        if (taxCode.effectiveFrom && taxCode.effectiveFrom > businessDate) throw new BadRequestException(`Tax code ${taxCode.code} belum berlaku pada tanggal transaksi.`);
        if (taxCode.effectiveTo && taxCode.effectiveTo < businessDate) throw new BadRequestException(`Tax code ${taxCode.code} sudah tidak berlaku pada tanggal transaksi.`);
        const allowedScopesByDirection: Record<string, string[]> = {
          OUTPUT: ['SALE', 'SHIPPING', 'OTHER'],
          INPUT: ['PURCHASE', 'EXPENSE', 'ASSET', 'SHIPPING', 'OTHER'],
          WITHHOLDING: ['WITHHOLDING', 'PAYROLL', 'OTHER'],
          SELF_ASSESSED: ['PURCHASE', 'EXPENSE', 'ASSET', 'OTHER'],
        };
        const allowedScopes = allowedScopesByDirection[line.direction] ?? [];
        if (!allowedScopes.includes(taxCode.scope)) {
          throw new BadRequestException(`Tax code ${taxCode.code} scope ${taxCode.scope} tidak sesuai arah pajak ${line.direction}.`);
        }
      }
    }

    const rule = await client.accountingPostingRule.findFirst({
      where: {
        companyId: input.companyId, eventType: input.eventType, status: 'ACTIVE',
        AND: [
          { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: businessDate } }] },
          { OR: [{ effectiveTo: null }, { effectiveTo: { gte: businessDate } }] },
        ],
      },
      orderBy: [{ priority: 'asc' }, { version: 'desc' }],
    });
    if (!rule) throw new BadRequestException(`Accounting posting rule ACTIVE untuk ${input.eventType} belum dikonfigurasi.`);

    // Period close enforcement: SOFT_CLOSED maupun CLOSED sama-sama membekukan posting normal.
    // Koreksi harus dilakukan setelah period direopen secara eksplisit (SOFT_CLOSED) atau pada periode baru.
    const fiscalPeriod = await client.fiscalPeriod.findFirst({
      where: {
        companyId: input.companyId,
        branchId: input.branchId,
        startDate: { lte: businessDate },
        endDate: { gte: businessDate },
      },
      orderBy: { startDate: 'desc' },
    });
    if (fiscalPeriod && fiscalPeriod.status !== 'OPEN') {
      throw new BadRequestException(`Periode fiskal berstatus ${fiscalPeriod.status}; posting jurnal ke periode ini tidak diizinkan.`);
    }

    const amounts = Object.fromEntries(Object.entries(input.amounts).map(([key, value]) => [key, new Prisma.Decimal(value)]));
    const netAmount = amounts.net ?? amounts.revenue ?? amounts.inventory ?? amounts.expense ?? amounts.asset ?? amounts.gain ?? amounts.loss ?? new Prisma.Decimal(0);
    const taxAmount = amounts.tax ?? amounts.outputTax ?? amounts.inputTax ?? new Prisma.Decimal(0);
    const grossAmount = amounts.gross ?? amounts.cash ?? amounts.bank ?? amounts.payable ?? amounts.receivable ?? netAmount.add(taxAmount);

    const event = await client.accountingEvent.create({
      data: {
        companyId: input.companyId, branchId: input.branchId, eventType: input.eventType,
        sourceType: input.sourceType, sourceId: input.sourceId, idempotencyKey: input.idempotencyKey,
        businessDate, currency: input.currency ?? 'IDR',
        netAmount, taxAmount, grossAmount, status: 'VALIDATED', context: input.context,
        lines: input.lines?.length ? { create: input.lines.map((line, index) => ({
          lineNumber: index + 1, itemType: line.itemType, itemId: line.itemId, description: line.description,
          quantity: new Prisma.Decimal(line.quantity ?? 0), unitAmount: new Prisma.Decimal(line.unitAmount ?? 0),
          netAmount: new Prisma.Decimal(line.netAmount ?? 0), taxAmount: new Prisma.Decimal(line.taxAmount ?? 0),
          grossAmount: new Prisma.Decimal(line.grossAmount ?? 0), taxCodeId: line.taxCodeId, dimensions: line.dimensions,
        })) } : undefined,
      },
    });

    const configuredLines = rule.journalLines as unknown as RuleLine[];
    const usable = configuredLines.filter((line) => {
      const amount = amounts[line.amountKey] ?? new Prisma.Decimal(0);
      return !(line.skipIfZero ?? true) || !amount.isZero();
    });
    if (!usable.length) throw new BadRequestException(`Aturan ${rule.code} tidak menghasilkan jurnal.`);
    const resolvedLines = usable.map((line) => {
      const accountCode = line.accountCodeKey ? input.accountCodes?.[line.accountCodeKey] : line.accountCode;
      if (!accountCode) throw new BadRequestException(`Account code untuk baris ${line.amountKey} belum dikonfigurasi.`);
      return { ...line, accountCode };
    });
    const codes = [...new Set(resolvedLines.map((line) => line.accountCode))];
    const accounts = await client.account.findMany({ where: { branchId: input.branchId, code: { in: codes }, isActive: true } });
    const accountMap = new Map(accounts.map((account) => [account.code, account]));
    const missing = codes.filter((code) => !accountMap.has(code));
    if (missing.length) throw new BadRequestException(`Akun belum dikonfigurasi: ${missing.join(', ')}.`);

    let debitTotal = new Prisma.Decimal(0);
    let creditTotal = new Prisma.Decimal(0);
    const journalLines = resolvedLines.map((line) => {
      const amount = amounts[line.amountKey] ?? new Prisma.Decimal(0);
      if (amount.lessThan(0)) throw new BadRequestException(`Nilai ${line.amountKey} tidak boleh negatif.`);
      if (line.side === 'DEBIT') debitTotal = debitTotal.add(amount); else creditTotal = creditTotal.add(amount);
      return {
        accountId: accountMap.get(line.accountCode)!.id,
        debit: line.side === 'DEBIT' ? amount : new Prisma.Decimal(0),
        credit: line.side === 'CREDIT' ? amount : new Prisma.Decimal(0),
      };
    });
    if (!debitTotal.equals(creditTotal)) {
      throw new BadRequestException(`Jurnal ${rule.code} tidak seimbang. Debit ${debitTotal.toFixed(2)}, kredit ${creditTotal.toFixed(2)}.`);
    }

    const journalEntry = await client.journalEntry.create({
      data: {
        number: await nextDocumentNumber(client, { companyId: input.companyId, branchId: input.branchId, documentType: 'JOURNAL', prefix: 'JRN' }), date: businessDate,
        referenceType: input.sourceType, referenceId: input.sourceId,
        description: `${input.eventType} ${input.sourceType} ${input.sourceId}`,
        lines: { create: journalLines },
      },
    });

    if (input.taxLines?.length) {
      await client.taxTransaction.createMany({ data: input.taxLines.map((tax) => ({
        companyId: input.companyId, branchId: input.branchId, accountingEventId: event.id,
        sourceType: input.sourceType, sourceId: input.sourceId, taxCodeId: tax.taxCodeId,
        direction: tax.direction, transactionDate: businessDate,
        taxPeriod: businessDate.toISOString().slice(0, 7),
        taxableBase: new Prisma.Decimal(tax.taxableBase), taxAmount: new Prisma.Decimal(tax.taxAmount),
        status: 'POSTED', counterpartyType: tax.counterpartyType, counterpartyId: tax.counterpartyId,
        documentNumber: tax.documentNumber, metadata: tax.metadata,
      })) });
    }
    await client.accountingPosting.create({
      data: { accountingEventId: event.id, ruleId: rule.id, journalEntryId: journalEntry.id, postingTrace: { ruleCode: rule.code, debitTotal: debitTotal.toFixed(2), creditTotal: creditTotal.toFixed(2) } },
    });
    return client.accountingEvent.update({
      where: { id: event.id }, data: { status: 'POSTED', journalEntryId: journalEntry.id },
      include: { postings: true, taxTransactions: true, lines: true },
    });
  }

  async postManual(dto: PostManualAccountingEventDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, dto.companyId, dto.branchId, 'AccountingEvent');
    return this.prisma.$transaction(async (tx) => {
      const taxCodeIds = [...new Set([
        ...(dto.lines?.map((line) => line.taxCodeId).filter((value): value is string => Boolean(value)) ?? []),
        ...(dto.taxLines?.map((line) => line.taxCodeId) ?? []),
      ])];
      if (taxCodeIds.length) {
        const ownedTaxCodes = await tx.taxCode.findMany({
          where: { id: { in: taxCodeIds }, companyId: scope.companyId },
          select: { id: true },
        });
        const ownedIds = new Set(ownedTaxCodes.map((taxCode) => taxCode.id));
        const foreignTaxCodeId = taxCodeIds.find((id) => !ownedIds.has(id));
        if (foreignTaxCodeId) {
          await this.denyTenantAccess(tx, user, scope, 'TaxCode', foreignTaxCodeId, {
            authenticatedCompanyId: scope.companyId,
            authenticatedBranchId: scope.branchId,
          });
        }
      }

      const existing = await tx.accountingEvent.findUnique({
        where: { companyId_idempotencyKey: { companyId: scope.companyId, idempotencyKey: dto.idempotencyKey } },
        include: { postings: true, taxTransactions: true, lines: true },
      });
      if (existing) {
        if (existing.branchId !== scope.branchId) {
          await this.denyTenantAccess(tx, user, scope, 'AccountingEvent', existing.id, {
            authenticatedBranchId: scope.branchId,
            eventBranchId: existing.branchId,
            idempotencyKey: dto.idempotencyKey,
          });
        }
        return existing;
      }

      const event = await this.postOperationalEvent(tx, {
        companyId: scope.companyId, branchId: scope.branchId, eventType: dto.eventType,
        sourceType: dto.sourceType, sourceId: dto.sourceId, idempotencyKey: dto.idempotencyKey,
        currency: dto.currency, businessDate: dto.businessDate ? new Date(dto.businessDate) : undefined,
        amounts: dto.amounts, accountCodes: dto.accountCodes,
        lines: dto.lines?.map((line) => ({ ...line, dimensions: line.dimensions as Prisma.InputJsonValue | undefined })),
        taxLines: dto.taxLines?.map((line) => ({ ...line, direction: line.direction as TaxTransactionDirection })),
        context: dto.context as Prisma.InputJsonValue | undefined,
      });
      await tx.auditLog.create({
        data: {
          companyId: scope.companyId,
          userId: user.sub,
          action: 'POST_MANUAL_ACCOUNTING_EVENT',
          entityType: 'AccountingEvent',
          entityId: event.id,
          payload: { eventType: dto.eventType, sourceType: dto.sourceType, sourceId: dto.sourceId },
        },
      });
      return event;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
