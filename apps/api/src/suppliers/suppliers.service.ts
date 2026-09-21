import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { decodeCursor, parsePageLimit, toCursorPage } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';

type DbClient = Prisma.TransactionClient | PrismaService;
type SupplierCursor = { name: string; id: string };
type TenantScope = { companyId: string; branchId: string };

@Injectable()
export class SuppliersService {
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
      message: `${entityType} tidak tersedia dalam company pengguna.`,
    });
  }

  async list(user: AuthUser, requestedCompanyId?: string, search?: string, limitValue?: string, cursorValue?: string) {
    const scope = this.requireTenantScope(user);
    if (requestedCompanyId && requestedCompanyId !== scope.companyId) {
      return this.denyTenantAccess(this.prisma, user, scope, 'SupplierCatalog', undefined, {
        authenticatedCompanyId: scope.companyId,
        requestedCompanyId,
      });
    }
    const limit = parsePageLimit(limitValue);
    const cursor = decodeCursor<SupplierCursor>(cursorValue);
    const filters: Prisma.SupplierWhereInput[] = [];
    const query = search?.trim();
    if (query) filters.push({ OR: [{ code: query }, { name: { contains: query } }, { phone: { contains: query } }] });
    if (cursor) filters.push({ OR: [{ name: { gt: cursor.name } }, { name: cursor.name, id: { gt: cursor.id } }] });
    const rows = await this.prisma.supplier.findMany({
      where: { companyId: scope.companyId, AND: filters.length ? filters : undefined },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });
    return toCursorPage(rows, limit, (item) => ({ name: item.name, id: item.id }));
  }

  async create(dto: CreateSupplierDto, user: AuthUser) {
    const scope = this.requireTenantScope(user);
    return this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data: { ...dto, companyId: scope.companyId, paymentTermDays: dto.paymentTermDays ?? 0 },
      });
      await tx.auditLog.create({
        data: {
          companyId: scope.companyId,
          userId: user.sub,
          action: 'CREATE_SUPPLIER',
          entityType: 'Supplier',
          entityId: supplier.id,
          payload: { branchId: scope.branchId, code: supplier.code },
        },
      });
      return supplier;
    });
  }
}
