import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type LocationAllocation = { locationId: string; quantity: number };

async function defaultLocation(tx: Prisma.TransactionClient, warehouseId: string) {
  let location = await tx.warehouseLocation.findFirst({ where: { warehouseId, isActive: true, isDefault: true }, orderBy: { code: 'asc' } });
  if (location) return location;
  const existing = await tx.warehouseLocation.findFirst({ where: { warehouseId, isActive: true }, orderBy: { code: 'asc' } });
  if (existing) {
    await tx.warehouseLocation.updateMany({ where: { warehouseId, id: { not: existing.id }, isDefault: true }, data: { isDefault: false } });
    return tx.warehouseLocation.update({ where: { id: existing.id }, data: { isDefault: true } });
  }
  return tx.warehouseLocation.create({ data: { warehouseId, code: 'DEFAULT', name: 'Lokasi Default', type: 'PICK_FACE', isDefault: true, isActive: true } });
}

async function assertLocation(tx: Prisma.TransactionClient, warehouseId: string, locationId: string) {
  const location = await tx.warehouseLocation.findFirst({ where: { id: locationId, warehouseId, isActive: true } });
  if (!location) throw new BadRequestException('Lokasi inventory tidak aktif atau tidak berada pada gudang yang dipilih.');
  return location;
}

/**
 * Transitional invariant guard. Existing installations start with warehouse-level Inventory only.
 * The first location-aware mutation materializes that aggregate into one deterministic default bin.
 * Once balances exist, every mutation must keep quantity/reserved/available exactly equal to the aggregate.
 */
export async function prepareLocationInventory(tx: Prisma.TransactionClient, warehouseId: string, productId: string) {
  const aggregate = await tx.inventory.findUnique({ where: { warehouseId_productId: { warehouseId, productId } } });
  const balances = await tx.inventoryLocationBalance.findMany({ where: { warehouseId, productId } });
  if (!balances.length) {
    const location = await defaultLocation(tx, warehouseId);
    if (aggregate) {
      await tx.inventoryLocationBalance.upsert({
        where: { locationId_productId: { locationId: location.id, productId } },
        create: { warehouseId, locationId: location.id, productId, quantity: aggregate.quantity, reserved: aggregate.reserved, available: aggregate.available },
        update: { warehouseId, quantity: aggregate.quantity, reserved: aggregate.reserved, available: aggregate.available },
      });
    }
    return { aggregate, defaultLocation: location };
  }

  const totals = balances.reduce((acc, row) => ({ quantity: acc.quantity + row.quantity, reserved: acc.reserved + row.reserved, available: acc.available + row.available }), { quantity: 0, reserved: 0, available: 0 });
  const expected = aggregate ?? { quantity: 0, reserved: 0, available: 0 };
  if (totals.quantity !== expected.quantity || totals.reserved !== expected.reserved || totals.available !== expected.available) {
    throw new BadRequestException(`LOCATION_INVENTORY_DRIFT:${warehouseId}:${productId}; aggregate=${expected.quantity}/${expected.reserved}/${expected.available}; locations=${totals.quantity}/${totals.reserved}/${totals.available}`);
  }
  return { aggregate, defaultLocation: await defaultLocation(tx, warehouseId) };
}

async function orderedAvailableBalances(tx: Prisma.TransactionClient, warehouseId: string, productId: string) {
  const { defaultLocation: primary } = await prepareLocationInventory(tx, warehouseId, productId);
  const rows = await tx.inventoryLocationBalance.findMany({ where: { warehouseId, productId, available: { gt: 0 } }, orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }] });
  return rows.sort((a, b) => (a.locationId === primary.id ? -1 : b.locationId === primary.id ? 1 : 0));
}

export async function depositLocationStock(tx: Prisma.TransactionClient, input: { warehouseId: string; productId: string; quantity: number; locationId?: string | null }) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new BadRequestException('Jumlah stock-in lokasi harus integer positif.');
  const { defaultLocation: primary } = await prepareLocationInventory(tx, input.warehouseId, input.productId);
  const location = input.locationId ? await assertLocation(tx, input.warehouseId, input.locationId) : primary;
  const row = await tx.inventoryLocationBalance.upsert({
    where: { locationId_productId: { locationId: location.id, productId: input.productId } },
    create: { warehouseId: input.warehouseId, locationId: location.id, productId: input.productId, quantity: input.quantity, available: input.quantity },
    update: { quantity: { increment: input.quantity }, available: { increment: input.quantity } },
  });
  return { locationId: location.id, balance: row };
}

export async function consumeAvailableLocationStock(tx: Prisma.TransactionClient, input: { warehouseId: string; productId: string; quantity: number }) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new BadRequestException('Jumlah stock-out lokasi harus integer positif.');
  const rows = await orderedAvailableBalances(tx, input.warehouseId, input.productId);
  let remaining = input.quantity;
  const allocations: LocationAllocation[] = [];
  for (const row of rows) {
    if (remaining <= 0) break;
    const take = Math.min(row.available, remaining);
    const changed = await tx.inventoryLocationBalance.updateMany({ where: { id: row.id, quantity: { gte: take }, available: { gte: take } }, data: { quantity: { decrement: take }, available: { decrement: take } } });
    if (changed.count !== 1) throw new BadRequestException('Saldo lokasi berubah saat stock-out. Ulangi transaksi.');
    allocations.push({ locationId: row.locationId, quantity: take });
    remaining -= take;
  }
  if (remaining > 0) throw new BadRequestException('Stok lokasi tidak mencukupi meskipun saldo gudang terlihat tersedia. Jalankan rekonsiliasi lokasi.');
  return allocations;
}

export async function reserveLocationStock(tx: Prisma.TransactionClient, input: { warehouseId: string; productId: string; quantity: number; sourceType: string; sourceId: string }) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new BadRequestException('Jumlah reservasi lokasi harus integer positif.');
  const existing = await tx.inventoryReservation.findMany({ where: { sourceType: input.sourceType, sourceId: input.sourceId, productId: input.productId, status: 'ACTIVE' } });
  if (existing.length) {
    const total = existing.reduce((sum, row) => sum + row.quantity, 0);
    if (total !== input.quantity) throw new BadRequestException('Reservasi lokasi existing tidak sama dengan quantity sumber.');
    return existing.map((row) => ({ locationId: row.locationId, quantity: row.quantity }));
  }
  const rows = await orderedAvailableBalances(tx, input.warehouseId, input.productId);
  let remaining = input.quantity;
  const allocations: LocationAllocation[] = [];
  for (const row of rows) {
    if (remaining <= 0) break;
    const take = Math.min(row.available, remaining);
    const changed = await tx.inventoryLocationBalance.updateMany({ where: { id: row.id, available: { gte: take } }, data: { reserved: { increment: take }, available: { decrement: take } } });
    if (changed.count !== 1) throw new BadRequestException('Saldo lokasi berubah saat reservasi. Ulangi transaksi.');
    await tx.inventoryReservation.create({ data: { warehouseId: input.warehouseId, locationId: row.locationId, productId: input.productId, sourceType: input.sourceType, sourceId: input.sourceId, quantity: take, status: 'ACTIVE' } });
    allocations.push({ locationId: row.locationId, quantity: take });
    remaining -= take;
  }
  if (remaining > 0) throw new BadRequestException('Stok lokasi tidak mencukupi untuk reservasi pesanan.');
  return allocations;
}

async function mutateLegacyReservedStock(
  tx: Prisma.TransactionClient,
  input: { warehouseId: string; productId: string; quantity: number; consume: boolean },
) {
  await prepareLocationInventory(tx, input.warehouseId, input.productId);
  const balances = await tx.inventoryLocationBalance.findMany({
    where: { warehouseId: input.warehouseId, productId: input.productId, reserved: { gt: 0 } },
    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
  });
  let remaining = input.quantity;
  const allocations: LocationAllocation[] = [];
  for (const balance of balances) {
    if (remaining <= 0) break;
    const tracked = await tx.inventoryReservation.aggregate({
      where: { locationId: balance.locationId, productId: input.productId, status: 'ACTIVE' },
      _sum: { quantity: true },
    });
    const legacyReserved = Math.max(0, balance.reserved - (tracked._sum.quantity ?? 0));
    if (!legacyReserved) continue;
    const take = Math.min(legacyReserved, remaining);
    const changed = await tx.inventoryLocationBalance.updateMany({
      where: {
        id: balance.id,
        reserved: { gte: take + (tracked._sum.quantity ?? 0) },
        ...(input.consume ? { quantity: { gte: take } } : {}),
      },
      data: input.consume
        ? { quantity: { decrement: take }, reserved: { decrement: take } }
        : { reserved: { decrement: take }, available: { increment: take } },
    });
    if (changed.count !== 1) throw new BadRequestException('Reservasi lokasi legacy berubah saat rekonsiliasi. Ulangi transaksi.');
    allocations.push({ locationId: balance.locationId, quantity: take });
    remaining -= take;
  }
  if (remaining > 0) throw new BadRequestException(`Reservasi lokasi legacy tidak lengkap (${input.quantity - remaining}/${input.quantity}).`);
  return allocations;
}

export async function releaseLocationReservations(tx: Prisma.TransactionClient, input: { sourceType: string; sourceId: string; warehouseId: string; productId: string; quantity: number }) {
  const rows = await tx.inventoryReservation.findMany({ where: { sourceType: input.sourceType, sourceId: input.sourceId, productId: input.productId, status: 'ACTIVE' } });
  if (!rows.length) return mutateLegacyReservedStock(tx, { warehouseId: input.warehouseId, productId: input.productId, quantity: input.quantity, consume: false });
  const total = rows.reduce((sum, row) => sum + row.quantity, 0);
  if (total !== input.quantity) throw new BadRequestException(`Reservasi lokasi existing tidak lengkap saat release (${total}/${input.quantity}).`);
  for (const row of rows) {
    const changed = await tx.inventoryLocationBalance.updateMany({ where: { locationId: row.locationId, productId: row.productId, reserved: { gte: row.quantity } }, data: { reserved: { decrement: row.quantity }, available: { increment: row.quantity } } });
    if (changed.count !== 1) throw new BadRequestException('Reservasi lokasi tidak konsisten saat release.');
    await tx.inventoryReservation.update({ where: { id: row.id }, data: { status: 'RELEASED' } });
  }
  return rows.map((row) => ({ locationId: row.locationId, productId: row.productId, quantity: row.quantity }));
}

export async function consumeLocationReservations(tx: Prisma.TransactionClient, input: { sourceType: string; sourceId: string; warehouseId: string; productId: string; quantity: number }) {
  const rows = await tx.inventoryReservation.findMany({ where: { sourceType: input.sourceType, sourceId: input.sourceId, productId: input.productId, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } });
  if (!rows.length) return mutateLegacyReservedStock(tx, { warehouseId: input.warehouseId, productId: input.productId, quantity: input.quantity, consume: true });
  const total = rows.reduce((sum, row) => sum + row.quantity, 0);
  if (total !== input.quantity) throw new BadRequestException(`Reservasi lokasi tidak lengkap untuk fulfillment (${total}/${input.quantity}).`);
  for (const row of rows) {
    const changed = await tx.inventoryLocationBalance.updateMany({ where: { locationId: row.locationId, productId: row.productId, quantity: { gte: row.quantity }, reserved: { gte: row.quantity } }, data: { quantity: { decrement: row.quantity }, reserved: { decrement: row.quantity } } });
    if (changed.count !== 1) throw new BadRequestException('Reservasi lokasi berubah saat fulfillment.');
    await tx.inventoryReservation.update({ where: { id: row.id }, data: { status: 'CONSUMED' } });
  }
  return rows.map((row) => ({ locationId: row.locationId, quantity: row.quantity }));
}

export async function adjustLocationStock(tx: Prisma.TransactionClient, input: { warehouseId: string; productId: string; difference: number; locationId?: string | null }) {
  if (!Number.isInteger(input.difference)) throw new BadRequestException('Selisih lokasi harus integer.');
  if (input.difference === 0) return null;
  const { defaultLocation: primary } = await prepareLocationInventory(tx, input.warehouseId, input.productId);
  const location = input.locationId ? await assertLocation(tx, input.warehouseId, input.locationId) : primary;
  if (input.difference > 0) {
    return depositLocationStock(tx, { warehouseId: input.warehouseId, productId: input.productId, quantity: input.difference, locationId: location.id });
  }
  const qty = Math.abs(input.difference);
  const changed = await tx.inventoryLocationBalance.updateMany({ where: { locationId: location.id, productId: input.productId, quantity: { gte: qty }, available: { gte: qty } }, data: { quantity: { decrement: qty }, available: { decrement: qty } } });
  if (changed.count !== 1) throw new BadRequestException('Stok bebas pada lokasi opname tidak mencukupi untuk adjustment negatif.');
  return { locationId: location.id };
}

export async function relocateLocationStock(tx: Prisma.TransactionClient, input: { warehouseId: string; productId: string; sourceLocationId: string; destinationLocationId: string; quantity: number }) {
  if (input.sourceLocationId === input.destinationLocationId) throw new BadRequestException('Lokasi asal dan tujuan harus berbeda.');
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new BadRequestException('Jumlah relokasi harus integer positif.');
  await prepareLocationInventory(tx, input.warehouseId, input.productId);
  await assertLocation(tx, input.warehouseId, input.sourceLocationId);
  await assertLocation(tx, input.warehouseId, input.destinationLocationId);
  const moved = await tx.inventoryLocationBalance.updateMany({ where: { locationId: input.sourceLocationId, productId: input.productId, quantity: { gte: input.quantity }, available: { gte: input.quantity } }, data: { quantity: { decrement: input.quantity }, available: { decrement: input.quantity } } });
  if (moved.count !== 1) throw new BadRequestException('Stok bebas lokasi asal tidak mencukupi untuk relokasi.');
  await tx.inventoryLocationBalance.upsert({ where: { locationId_productId: { locationId: input.destinationLocationId, productId: input.productId } }, create: { warehouseId: input.warehouseId, locationId: input.destinationLocationId, productId: input.productId, quantity: input.quantity, available: input.quantity }, update: { quantity: { increment: input.quantity }, available: { increment: input.quantity } } });
}
