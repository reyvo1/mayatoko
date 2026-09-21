import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBranchDto, CreateCategoryDto, CreateCustomerDto, CreateProductBarcodeDto, CreateProductPriceDto,
  CreateReferenceDto, CreateWarehouseDto, CreateWarehouseLocationDto, MASTER_REFERENCE_TYPES,
  UpdateBranchDto, UpdateCategoryDto, UpdateCustomerDto, UpdateProductBarcodeDto, UpdateProductPriceDto,
  UpdateReferenceDto, UpdateWarehouseDto, UpdateWarehouseLocationDto,
} from './dto/master-data.dto';

type DbClient = Prisma.TransactionClient | PrismaService;
type Scope = { companyId: string; branchId: string };
const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

@Injectable()
export class MasterDataService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(user: AuthUser): Scope {
    if (!user.companyId || !user.branchId) throw new ForbiddenException('Company/branch pengguna belum valid.');
    return { companyId: user.companyId, branchId: user.branchId };
  }

  private async audit(client: DbClient, user: AuthUser, action: string, entityType: string, entityId: string, extra?: Record<string, unknown>) {
    const scope = this.scope(user);
    await client.auditLog.create({ data: { companyId: scope.companyId, userId: user.sub, action, entityType, entityId, payload: json({ branchId: scope.branchId, ...(extra ?? {}) }) } });
  }

  private async branch(client: DbClient, user: AuthUser, id: string) {
    const scope = this.scope(user);
    const row = await client.branch.findFirst({ where: { id, companyId: scope.companyId } });
    if (!row) throw new ForbiddenException('Cabang tidak tersedia pada perusahaan pengguna.');
    return row;
  }

  private async warehouse(client: DbClient, user: AuthUser, id: string) {
    const scope = this.scope(user);
    const row = await client.warehouse.findFirst({ where: { id, branch: { companyId: scope.companyId } } });
    if (!row) throw new ForbiddenException('Gudang tidak tersedia pada perusahaan pengguna.');
    return row;
  }

  private async product(client: DbClient, user: AuthUser, id: string) {
    const scope = this.scope(user);
    const row = await client.product.findFirst({ where: { id, companyId: scope.companyId } });
    if (!row) throw new ForbiddenException('Produk tidak tersedia pada perusahaan pengguna.');
    return row;
  }

  private normalizedUnit(value?: string | null) { return value?.trim().toUpperCase() || ''; }

  private normalizedFactor(value?: number | Prisma.Decimal | null) {
    const factor = Number(value ?? 1);
    if (!Number.isSafeInteger(factor) || factor < 1) throw new BadRequestException('quantityFactor wajib integer minimal 1 karena stok fisik disimpan dalam base unit integer.');
    return factor;
  }

  private async validateSellingUnit(client: DbClient, product: { id: string; unit: string; companyId: string | null }, unitCode?: string | null, quantityFactor?: number | Prisma.Decimal | null, primary = false) {
    const baseUnit = this.normalizedUnit(product.unit) || 'PCS';
    const unit = this.normalizedUnit(unitCode) || baseUnit;
    const factor = this.normalizedFactor(quantityFactor);
    if (primary && (factor !== 1 || unit !== baseUnit)) throw new BadRequestException('Barcode utama wajib mewakili 1 base unit produk.');
    if (factor > 1 && unit === baseUnit) throw new BadRequestException('Barcode kemasan dengan quantityFactor > 1 wajib memakai unitCode berbeda dari base unit.');
    if (unit !== baseUnit && product.companyId) {
      const [unitMaster, companyHasUnits] = await Promise.all([
        client.masterReference.findFirst({ where: { companyId: product.companyId, type: 'UNIT', code: unit, isActive: true }, select: { id: true } }),
        client.masterReference.findFirst({ where: { companyId: product.companyId, type: 'UNIT', isActive: true }, select: { id: true } }),
      ]);
      if (companyHasUnits && !unitMaster) throw new BadRequestException(`Unit ${unit} belum terdaftar pada master UNIT aktif.`);
    }
    return { baseUnit, unitCode: unit, quantityFactor: factor };
  }

  private slug(value: string) {
    return value.trim().toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 140);
  }

  categories(user: AuthUser, search?: string) {
    const scope = this.scope(user);
    return this.prisma.category.findMany({ where: { companyId: scope.companyId, ...(search?.trim() ? { name: { contains: search.trim() } } : {}) }, orderBy: { name: 'asc' }, take: 500 });
  }

  async createCategory(dto: CreateCategoryDto, user: AuthUser) {
    const scope = this.scope(user); const slug = this.slug(dto.slug || dto.name);
    if (!slug) throw new BadRequestException('Slug kategori tidak valid.');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.category.create({ data: { companyId: scope.companyId, name: dto.name.trim(), slug } });
        await this.audit(tx, user, 'CREATE_CATEGORY', 'Category', row.id, { slug }); return row;
      });
    } catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Nama/slug kategori sudah digunakan.'); throw error; }
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, user: AuthUser) {
    const scope = this.scope(user);
    const existing = await this.prisma.category.findFirst({ where: { id, companyId: scope.companyId } });
    if (!existing) throw new NotFoundException('Kategori tidak ditemukan.');
    const data: Prisma.CategoryUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.slug !== undefined) data.slug = this.slug(dto.slug);
    return this.prisma.$transaction(async (tx) => { const row = await tx.category.update({ where: { id }, data }); await this.audit(tx, user, 'UPDATE_CATEGORY', 'Category', id); return row; });
  }

  customers(user: AuthUser, search?: string) {
    const scope = this.scope(user); const q = search?.trim();
    return this.prisma.customer.findMany({ where: { companyId: scope.companyId, ...(q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }] } : {}) }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 500 });
  }

  async createCustomer(dto: CreateCustomerDto, user: AuthUser) {
    const scope = this.scope(user);
    try {
      return await this.prisma.$transaction(async (tx) => { const row = await tx.customer.create({ data: { companyId: scope.companyId, name: dto.name.trim(), phone: dto.phone?.trim(), email: dto.email?.trim().toLowerCase(), address: dto.address?.trim(), customerType: (dto.customerType || 'RETAIL').trim().toUpperCase(), taxIdNumber: dto.taxIdNumber?.trim() } }); await this.audit(tx, user, 'CREATE_CUSTOMER', 'Customer', row.id); return row; });
    } catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Email pelanggan sudah digunakan pada perusahaan ini.'); throw error; }
  }

  async updateCustomer(id: string, dto: UpdateCustomerDto, user: AuthUser) {
    const scope = this.scope(user); const existing = await this.prisma.customer.findFirst({ where: { id, companyId: scope.companyId } });
    if (!existing) throw new NotFoundException('Pelanggan tidak ditemukan.');
    const data: Prisma.CustomerUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim(); if (dto.phone !== undefined) data.phone = dto.phone?.trim() || null;
    if (dto.email !== undefined) data.email = dto.email?.trim().toLowerCase() || null; if (dto.address !== undefined) data.address = dto.address?.trim() || null;
    if (dto.customerType !== undefined) data.customerType = dto.customerType.trim().toUpperCase(); if (dto.taxIdNumber !== undefined) data.taxIdNumber = dto.taxIdNumber?.trim() || null;
    return this.prisma.$transaction(async (tx) => { const row = await tx.customer.update({ where: { id }, data }); await this.audit(tx, user, 'UPDATE_CUSTOMER', 'Customer', id); return row; });
  }

  branches(user: AuthUser) { const scope = this.scope(user); return this.prisma.branch.findMany({ where: { companyId: scope.companyId }, orderBy: { name: 'asc' } }); }
  async createBranch(dto: CreateBranchDto, user: AuthUser) { const scope = this.scope(user); return this.prisma.$transaction(async (tx) => { const row = await tx.branch.create({ data: { companyId: scope.companyId, code: dto.code.trim().toUpperCase(), name: dto.name.trim(), address: dto.address?.trim() } }); await this.audit(tx, user, 'CREATE_BRANCH', 'Branch', row.id); return row; }); }
  async updateBranch(id: string, dto: UpdateBranchDto, user: AuthUser) { await this.branch(this.prisma, user, id); return this.prisma.$transaction(async (tx) => { const row = await tx.branch.update({ where: { id }, data: { ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}), ...(dto.name !== undefined ? { name: dto.name.trim() } : {}), ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}), ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}) } }); await this.audit(tx, user, 'UPDATE_BRANCH', 'Branch', id); return row; }); }

  async warehouses(user: AuthUser, branchId?: string) { const scope = this.scope(user); if (branchId) await this.branch(this.prisma, user, branchId); return this.prisma.warehouse.findMany({ where: { branch: { companyId: scope.companyId }, ...(branchId ? { branchId } : {}) }, include: { branch: true }, orderBy: [{ branchId: 'asc' }, { name: 'asc' }] }); }
  async createWarehouse(dto: CreateWarehouseDto, user: AuthUser) { await this.branch(this.prisma, user, dto.branchId); return this.prisma.$transaction(async (tx) => { if (dto.isDefault) await tx.warehouse.updateMany({ where: { branchId: dto.branchId }, data: { isDefault: false } }); const row = await tx.warehouse.create({ data: { branchId: dto.branchId, code: dto.code.trim().toUpperCase(), name: dto.name.trim(), address: dto.address?.trim(), isDefault: dto.isDefault ?? false } }); await this.audit(tx, user, 'CREATE_WAREHOUSE', 'Warehouse', row.id, { targetBranchId: dto.branchId }); return row; }); }
  async updateWarehouse(id: string, dto: UpdateWarehouseDto, user: AuthUser) { const existing = await this.warehouse(this.prisma, user, id); const targetBranch = dto.branchId ?? existing.branchId; await this.branch(this.prisma, user, targetBranch); return this.prisma.$transaction(async (tx) => { if (dto.isDefault) await tx.warehouse.updateMany({ where: { branchId: targetBranch, id: { not: id } }, data: { isDefault: false } }); const row = await tx.warehouse.update({ where: { id }, data: { ...(dto.branchId !== undefined ? { branchId: targetBranch } : {}), ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}), ...(dto.name !== undefined ? { name: dto.name.trim() } : {}), ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}), ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}), ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}) } }); await this.audit(tx, user, 'UPDATE_WAREHOUSE', 'Warehouse', id); return row; }); }

  async locations(user: AuthUser, warehouseId?: string) { const scope = this.scope(user); if (warehouseId) await this.warehouse(this.prisma, user, warehouseId); const warehouseIds = warehouseId ? [warehouseId] : (await this.prisma.warehouse.findMany({ where: { branch: { companyId: scope.companyId } }, select: { id: true } })).map((x) => x.id); return this.prisma.warehouseLocation.findMany({ where: { warehouseId: { in: warehouseIds } }, orderBy: [{ warehouseId: 'asc' }, { code: 'asc' }] }); }
  async createLocation(dto: CreateWarehouseLocationDto, user: AuthUser) { await this.warehouse(this.prisma, user, dto.warehouseId); if (dto.parentId) { const parent = await this.prisma.warehouseLocation.findFirst({ where: { id: dto.parentId, warehouseId: dto.warehouseId } }); if (!parent) throw new BadRequestException('Parent lokasi tidak ditemukan pada gudang yang sama.'); } return this.prisma.$transaction(async (tx) => { const count = await tx.warehouseLocation.count({ where: { warehouseId: dto.warehouseId, isActive: true } }); const makeDefault = Boolean(dto.isDefault) || count === 0; if (makeDefault) await tx.warehouseLocation.updateMany({ where: { warehouseId: dto.warehouseId, isDefault: true }, data: { isDefault: false } }); const row = await tx.warehouseLocation.create({ data: { warehouseId: dto.warehouseId, parentId: dto.parentId, code: dto.code.trim().toUpperCase(), name: dto.name.trim(), type: (dto.type || 'BIN').trim().toUpperCase(), barcode: dto.barcode?.trim(), capacity: dto.capacity === undefined ? undefined : new Prisma.Decimal(dto.capacity), isDefault: makeDefault } }); await this.audit(tx, user, 'CREATE_WAREHOUSE_LOCATION', 'WarehouseLocation', row.id, { warehouseId: dto.warehouseId, isDefault: makeDefault }); return row; }); }
  async updateLocation(id: string, dto: UpdateWarehouseLocationDto, user: AuthUser) { const scope = this.scope(user); const row0 = await this.prisma.warehouseLocation.findUnique({ where: { id } }); if (!row0) throw new NotFoundException('Lokasi gudang tidak ditemukan.'); await this.warehouse(this.prisma, user, row0.warehouseId); const targetWarehouse = dto.warehouseId ?? row0.warehouseId; await this.warehouse(this.prisma, user, targetWarehouse); if (dto.parentId) { const parent = await this.prisma.warehouseLocation.findFirst({ where: { id: dto.parentId, warehouseId: targetWarehouse } }); if (!parent || parent.id === id) throw new BadRequestException('Parent lokasi tidak valid.'); } return this.prisma.$transaction(async (tx) => { if (dto.isDefault === true) await tx.warehouseLocation.updateMany({ where: { warehouseId: targetWarehouse, id: { not: id }, isDefault: true }, data: { isDefault: false } }); const row = await tx.warehouseLocation.update({ where: { id }, data: { ...(dto.warehouseId !== undefined ? { warehouseId: targetWarehouse } : {}), ...(dto.parentId !== undefined ? { parentId: dto.parentId || null } : {}), ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}), ...(dto.name !== undefined ? { name: dto.name.trim() } : {}), ...(dto.type !== undefined ? { type: dto.type.trim().toUpperCase() } : {}), ...(dto.barcode !== undefined ? { barcode: dto.barcode?.trim() || null } : {}), ...(dto.capacity !== undefined ? { capacity: new Prisma.Decimal(dto.capacity) } : {}), ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}), ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}) } }); await this.audit(tx, user, 'UPDATE_WAREHOUSE_LOCATION', 'WarehouseLocation', id, { companyId: scope.companyId }); return row; }); }

  references(user: AuthUser, type?: string) { const scope = this.scope(user); if (type && !MASTER_REFERENCE_TYPES.includes(type.toUpperCase() as never)) throw new BadRequestException('Tipe master reference tidak didukung.'); return this.prisma.masterReference.findMany({ where: { companyId: scope.companyId, ...(type ? { type: type.toUpperCase() } : {}) }, orderBy: [{ type: 'asc' }, { name: 'asc' }] }); }
  async createReference(dto: CreateReferenceDto, user: AuthUser) { const scope = this.scope(user); if (dto.branchId) await this.branch(this.prisma, user, dto.branchId); return this.prisma.$transaction(async (tx) => { const row = await tx.masterReference.create({ data: { companyId: scope.companyId, branchId: dto.branchId, type: dto.type, code: dto.code.trim().toUpperCase(), name: dto.name.trim(), metadata: dto.metadata === undefined ? undefined : json(dto.metadata) } }); await this.audit(tx, user, 'CREATE_MASTER_REFERENCE', 'MasterReference', row.id, { type: row.type, code: row.code }); return row; }); }
  async updateReference(id: string, dto: UpdateReferenceDto, user: AuthUser) { const scope = this.scope(user); const existing = await this.prisma.masterReference.findFirst({ where: { id, companyId: scope.companyId } }); if (!existing) throw new NotFoundException('Master reference tidak ditemukan.'); if (dto.branchId) await this.branch(this.prisma, user, dto.branchId); return this.prisma.$transaction(async (tx) => { const row = await tx.masterReference.update({ where: { id }, data: { ...(dto.name !== undefined ? { name: dto.name.trim() } : {}), ...(dto.branchId !== undefined ? { branchId: dto.branchId || null } : {}), ...(dto.metadata !== undefined ? { metadata: json(dto.metadata) } : {}), ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}) } }); await this.audit(tx, user, 'UPDATE_MASTER_REFERENCE', 'MasterReference', id); return row; }); }

  async barcodes(productId: string, user: AuthUser) {
    await this.product(this.prisma, user, productId);
    return this.prisma.productBarcode.findMany({ where: { productId }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] });
  }

  async createBarcode(productId: string, dto: CreateProductBarcodeDto, user: AuthUser) {
    const product = await this.product(this.prisma, user, productId);
    const conversion = await this.validateSellingUnit(this.prisma, product, dto.unitCode, dto.quantityFactor, dto.isPrimary ?? false);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) await tx.productBarcode.updateMany({ where: { productId }, data: { isPrimary: false } });
      const row = await tx.productBarcode.create({ data: {
        productId,
        code: dto.code.trim(),
        unitCode: conversion.unitCode,
        quantityFactor: new Prisma.Decimal(conversion.quantityFactor),
        isPrimary: dto.isPrimary ?? false,
      } });
      if (row.isPrimary || !product.barcode) await tx.product.update({ where: { id: productId }, data: { barcode: row.code } });
      await this.audit(tx, user, 'CREATE_PRODUCT_BARCODE', 'ProductBarcode', row.id, { productId, unitCode: conversion.unitCode, quantityFactor: conversion.quantityFactor });
      return row;
    });
  }

  async updateBarcode(productId: string, id: string, dto: UpdateProductBarcodeDto, user: AuthUser) {
    const product = await this.product(this.prisma, user, productId);
    const existing = await this.prisma.productBarcode.findFirst({ where: { id, productId } });
    if (!existing) throw new NotFoundException('Barcode produk tidak ditemukan.');
    const targetPrimary = dto.isPrimary ?? existing.isPrimary;
    const conversion = await this.validateSellingUnit(
      this.prisma,
      product,
      dto.unitCode !== undefined ? dto.unitCode : existing.unitCode,
      dto.quantityFactor !== undefined ? dto.quantityFactor : existing.quantityFactor,
      targetPrimary,
    );
    return this.prisma.$transaction(async (tx) => {
      if (targetPrimary) await tx.productBarcode.updateMany({ where: { productId, id: { not: id } }, data: { isPrimary: false } });
      const row = await tx.productBarcode.update({ where: { id }, data: {
        ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
        unitCode: conversion.unitCode,
        quantityFactor: new Prisma.Decimal(conversion.quantityFactor),
        ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
      } });
      if (row.isPrimary) await tx.product.update({ where: { id: productId }, data: { barcode: row.code } });
      await this.audit(tx, user, 'UPDATE_PRODUCT_BARCODE', 'ProductBarcode', id, { productId, unitCode: conversion.unitCode, quantityFactor: conversion.quantityFactor });
      return row;
    });
  }

  async prices(productId: string, user: AuthUser) { await this.product(this.prisma, user, productId); const scope = this.scope(user); return this.prisma.productPrice.findMany({ where: { productId, OR: [{ branchId: null }, { branch: { companyId: scope.companyId } }] }, include: { branch: true }, orderBy: [{ isActive: 'desc' }, { segmentCode: 'asc' }, { minQty: 'asc' }] }); }
  private parseDate(value?: string) { if (!value) return undefined; const date = new Date(value); if (Number.isNaN(date.getTime())) throw new BadRequestException('Format tanggal harga tidak valid.'); return date; }
  async createPrice(productId: string, dto: CreateProductPriceDto, user: AuthUser) {
    const product = await this.product(this.prisma, user, productId);
    if (dto.branchId) await this.branch(this.prisma, user, dto.branchId);
    const unitCode = dto.unitCode?.trim().toUpperCase() || null;
    if (unitCode && unitCode !== this.normalizedUnit(product.unit)) {
      const conversion = await this.prisma.productBarcode.findFirst({ where: { productId, unitCode, quantityFactor: { gt: new Prisma.Decimal(1) } }, select: { id: true } });
      if (!conversion) throw new BadRequestException(`Harga unit ${unitCode} membutuhkan barcode/konversi aktif untuk produk ini.`);
    }
    const from = this.parseDate(dto.effectiveFrom), to = this.parseDate(dto.effectiveTo);
    if (from && to && from > to) throw new BadRequestException('effectiveFrom tidak boleh setelah effectiveTo.');
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.productPrice.create({ data: { productId, branchId: dto.branchId, segmentCode: (dto.segmentCode || 'RETAIL').trim().toUpperCase(), unitCode, minQty: new Prisma.Decimal(dto.minQty ?? 1), price: new Prisma.Decimal(dto.price), effectiveFrom: from, effectiveTo: to } });
      await this.audit(tx, user, 'CREATE_PRODUCT_PRICE', 'ProductPrice', row.id, { productId, targetBranchId: dto.branchId ?? null, unitCode });
      return row;
    });
  }

  async updatePrice(productId: string, id: string, dto: UpdateProductPriceDto, user: AuthUser) {
    const product = await this.product(this.prisma, user, productId);
    const existing = await this.prisma.productPrice.findFirst({ where: { id, productId } });
    if (!existing) throw new NotFoundException('Harga produk tidak ditemukan.');
    if (dto.branchId) await this.branch(this.prisma, user, dto.branchId);
    const unitCode = dto.unitCode !== undefined ? (dto.unitCode?.trim().toUpperCase() || null) : existing.unitCode;
    if (unitCode && unitCode.toUpperCase() !== this.normalizedUnit(product.unit)) {
      const conversion = await this.prisma.productBarcode.findFirst({ where: { productId, unitCode: unitCode.toUpperCase(), quantityFactor: { gt: new Prisma.Decimal(1) } }, select: { id: true } });
      if (!conversion) throw new BadRequestException(`Harga unit ${unitCode} membutuhkan barcode/konversi aktif untuk produk ini.`);
    }
    const from = dto.effectiveFrom !== undefined ? this.parseDate(dto.effectiveFrom) : existing.effectiveFrom ?? undefined;
    const to = dto.effectiveTo !== undefined ? this.parseDate(dto.effectiveTo) : existing.effectiveTo ?? undefined;
    if (from && to && from > to) throw new BadRequestException('effectiveFrom tidak boleh setelah effectiveTo.');
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.productPrice.update({ where: { id }, data: {
        ...(dto.branchId !== undefined ? { branchId: dto.branchId || null } : {}),
        ...(dto.segmentCode !== undefined ? { segmentCode: dto.segmentCode.trim().toUpperCase() } : {}),
        ...(dto.unitCode !== undefined ? { unitCode } : {}),
        ...(dto.minQty !== undefined ? { minQty: new Prisma.Decimal(dto.minQty) } : {}),
        ...(dto.price !== undefined ? { price: new Prisma.Decimal(dto.price) } : {}),
        ...(dto.effectiveFrom !== undefined ? { effectiveFrom: from ?? null } : {}),
        ...(dto.effectiveTo !== undefined ? { effectiveTo: to ?? null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      } });
      await this.audit(tx, user, 'UPDATE_PRODUCT_PRICE', 'ProductPrice', id, { productId, unitCode });
      return row;
    });
  }
}
