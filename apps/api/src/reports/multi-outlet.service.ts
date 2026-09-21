import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

/**
 * T360-20260825 Fitur 4: dashboard multi-outlet.
 * Agregasi performa per cabang milik satu perusahaan: omzet hari ini,
 * transaksi, laba kotor, stok menipis, pesanan pending. Tenant dari token.
 */
@Injectable()
export class MultiOutletService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(user: AuthUser) {
    const companyId = user.companyId as string;
    const start = new Date(); start.setHours(0, 0, 0, 0);

    const branches = await this.prisma.branch.findMany({
      where: { companyId },
      select: { id: true, name: true, code: true, isActive: true },
      orderBy: { name: 'asc' },
    });

    const outlets = await Promise.all(branches.map(async (branch) => {
      const [sales, online, lowStock, pendingOrders] = await Promise.all([
        this.prisma.sale.aggregate({
          where: { branchId: branch.id, status: 'COMPLETED', createdAt: { gte: start } },
          _sum: { total: true, costTotal: true }, _count: true,
        }),
        this.prisma.order.aggregate({
          where: { branchId: branch.id, status: { in: ['PAID', 'PROCESSING', 'PACKED', 'SHIPPED', 'COMPLETED'] }, createdAt: { gte: start } },
          _sum: { total: true }, _count: true,
        }),
        this.prisma.inventory.count({
          where: { warehouse: { branchId: branch.id }, available: { lte: 5 } },
        }),
        this.prisma.order.count({ where: { branchId: branch.id, status: { in: ['PAID', 'PROCESSING'] } } }),
      ]);
      const revenue = Number(sales._sum.total ?? 0) + Number(online._sum.total ?? 0);
      return {
        branchId: branch.id,
        name: branch.name,
        code: branch.code,
        isActive: branch.isActive,
        today: {
          revenue,
          grossProfit: revenue - Number(sales._sum.costTotal ?? 0),
          transactions: sales._count + online._count,
        },
        lowStock,
        pendingOrders,
      };
    }));

    const totalRevenue = outlets.reduce((sum, o) => sum + o.today.revenue, 0);
    return {
      companyId,
      generatedAt: new Date().toISOString(),
      totals: {
        revenue: totalRevenue,
        grossProfit: outlets.reduce((s, o) => s + o.today.grossProfit, 0),
        transactions: outlets.reduce((s, o) => s + o.today.transactions, 0),
        outletCount: outlets.length,
      },
      ranked: [...outlets].sort((a, b) => b.today.revenue - a.today.revenue).map((o, i) => ({ ...o, rank: i + 1, sharePct: totalRevenue > 0 ? Math.round((o.today.revenue / totalRevenue) * 1000) / 10 : 0 })),
    };
  }
}
