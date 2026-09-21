import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';

/**
 * T360-20260825 OWNER VALUE PACK
 * Fitur 1: Laporan harian otomatis — digest disusun dari data live dan masuk
 * antrian Notification (channel TELEGRAM) untuk dikirim oleh notification hub.
 * Pengaturan penerima per perusahaan disimpan via PlatformSetting (key: daily_digest).
 */

const DIGEST_SETTING_KEY = 'daily_digest';

export type DigestConfig = { enabled: boolean; hour: number; recipients: string[] };

@Injectable()
export class DailyDigestService {
  constructor(private readonly prisma: PrismaService) {}

  private async getConfig(companyId: string): Promise<DigestConfig> {
    const setting = await this.prisma.systemSetting.findFirst({
      where: { companyId, namespace: 'reports', key: DIGEST_SETTING_KEY },
    });
    if (!setting) return { enabled: false, hour: 21, recipients: [] };
    try {
      const parsed = (typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value) as Partial<DigestConfig>;
      return { enabled: !!parsed.enabled, hour: Math.min(23, Math.max(0, Number(parsed.hour ?? 21))), recipients: Array.isArray(parsed.recipients) ? parsed.recipients : [] };
    } catch {
      return { enabled: false, hour: 21, recipients: [] };
    }
  }

  async saveConfig(user: AuthUser, dto: Partial<DigestConfig> & { companyId?: string }) {
    if (dto.companyId && dto.companyId !== user.companyId) throw new ForbiddenException('Tenant tidak sesuai token.');
    const config: DigestConfig = {
      enabled: !!dto.enabled,
      hour: Math.min(23, Math.max(0, Number(dto.hour ?? 21))),
      recipients: (dto.recipients ?? []).filter((r) => typeof r === 'string' && r.trim()).slice(0, 10),
    };
    const existing = await this.prisma.systemSetting.findFirst({ where: { companyId: user.companyId, namespace: 'reports', key: DIGEST_SETTING_KEY } });
    const value = config as unknown as import('@prisma/client').Prisma.InputJsonValue;
    if (existing) await this.prisma.systemSetting.update({ where: { id: existing.id }, data: { value, updatedAt: new Date() } });
    else await this.prisma.systemSetting.create({ data: { companyId: user.companyId, branchId: user.branchId ?? null, namespace: 'reports', key: DIGEST_SETTING_KEY, value } });
    return config;
  }

  async getConfigForUser(user: AuthUser) {
    return this.getConfig(user.companyId as string);
  }

  private async findLowStock(companyId: string, branchId: string) {
    const inventories = await this.prisma.inventory.findMany({
      where: { warehouse: { branchId, branch: { companyId } }, available: { lte: 10 } },
      select: { available: true, product: { select: { name: true, minStock: true, sku: true } } },
      take: 200,
    });
    return inventories.filter((inv) => inv.available <= inv.product.minStock).slice(0, 10);
  }

  /** Susun ringkasan hari ini untuk satu perusahaan (branch utama token). */
  async buildDigest(user: AuthUser, branchId?: string) {
    const companyId = user.companyId as string;
    const targetBranch: string | undefined = branchId ?? (user.branchId ?? undefined);
    if (!targetBranch) throw new BadRequestException('Branch tidak ditemukan pada konteks token.');
    const start = new Date(); start.setHours(0, 0, 0, 0);

    const [sales, lowStockItems, pendingOrders, topProducts] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { branchId: targetBranch, branch: { companyId }, status: 'COMPLETED', createdAt: { gte: start } },
        _sum: { total: true, costTotal: true }, _count: true,
      }),
      this.findLowStock(companyId, targetBranch as string),
      this.prisma.order.count({ where: { branchId: targetBranch, branch: { companyId }, status: { in: ['PAID', 'PROCESSING'] } } }),
      this.prisma.saleItem.groupBy({
        by: ['productId'],
        where: { sale: { branchId: targetBranch, status: 'COMPLETED', createdAt: { gte: start } } },
        _sum: { quantity: true, netSubtotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ]);

    const productIds = topProducts.map((t) => t.productId).filter(Boolean);
    const productNames = productIds.length
      ? await this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
      : [];
    const nameOf = (id: string) => productNames.find((p) => p.id === id)?.name ?? id;

    const revenue = Number(sales._sum.total ?? 0);
    const cogs = Number(sales._sum.costTotal ?? 0);
    const lines = [
      `📊 LAPORAN HARIAN TOKO360 — ${start.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      ``,
      `💰 Omzet: Rp ${revenue.toLocaleString('id-ID')}`,
      `📈 Laba kotor: Rp ${(revenue - cogs).toLocaleString('id-ID')}`,
      `🧾 Transaksi: ${sales._count}`,
      `⏳ Pesanan online diproses: ${pendingOrders}`,
      ``,
      lowStockItems.length ? `⚠️ Stok menipis (${lowStockItems.length}):` : `✅ Stok aman, tidak ada yang menipis.`,
      ...lowStockItems.slice(0, 8).map((item) => `   • ${item.product.name}: sisa ${item.available} (min ${item.product.minStock})`),
      ``,
      topProducts.length ? `🏆 Produk terlaris:` : ``,
      ...topProducts.map((t, i) => `   ${i + 1}. ${nameOf(t.productId)} — ${t._sum.quantity ?? 0} pcs`),
    ].filter((l) => l !== '');

    return { text: lines.join('\n'), summary: { revenue, grossProfit: revenue - cogs, transactions: sales._count, pendingOrders, lowStockCount: lowStockItems.length } };
  }

  /** Buat notifikasi TELEGRAM untuk semua penerima terdaftar. Idempotent per hari+branch. */
  async queueDailyDigest(user: AuthUser, branchId?: string) {
    const companyId = user.companyId as string;
    const config = await this.getConfig(companyId);
    const todayKey = new Date().toISOString().slice(0, 10);
    const created: string[] = [];
    for (const recipient of config.recipients) {
      const dedupeKey = `daily-digest:${companyId}:${branchId ?? (user.branchId ?? 'unknown')}:${todayKey}`;
      const duplicate = await this.prisma.notification.findFirst({
        where: { companyId, channel: 'TELEGRAM', recipient, templateCode: dedupeKey },
      });
      if (duplicate) continue;
      const digest = await this.buildDigest(user, branchId);
      const notification = await this.prisma.notification.create({
        data: { companyId, channel: 'TELEGRAM', recipient, templateCode: dedupeKey, body: digest.text, status: 'QUEUED' },
      });
      created.push(notification.id);
    }
    return { queued: created.length, notificationIds: created, enabled: config.enabled };
  }

  /** Preview tanpa mengirim. */
  async preview(user: AuthUser, branchId?: string) {
    const digest = await this.buildDigest(user, branchId);
    return digest;
  }
}

function targetBranchId(requested: string | undefined, fallback: string | undefined): string {
  return requested ?? fallback ?? 'unknown';
}
