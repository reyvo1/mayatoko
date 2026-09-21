import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
class SaleItemDto {
  @ApiProperty() @IsString() productId!: string;
  @ApiProperty({ example: 1, description: 'Jumlah unit jual. Tanpa barcodeCode berarti base unit produk.' }) @IsInt() @Min(1) quantity!: number;
  @ApiPropertyOptional({ description: 'Barcode unit/kemasan yang discan. Server menyelesaikan unitCode dan quantityFactor secara authoritative.' }) @IsOptional() @IsString() @MaxLength(160) barcodeCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() taxCodeId?: string;
}

export class SalePaymentDto {
  @ApiProperty({ enum: ['CASH','QRIS','TRANSFER','CARD'] }) @IsString() @IsIn(['CASH','QRIS','TRANSFER','CARD']) method!: string;
  @ApiProperty({ example: 50000 }) @IsNumber() @Min(0.01) amount!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) provider?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) externalRef?: string;
}
export class CreateSaleDto {
  @ApiPropertyOptional({ description: 'Kunci idempotensi untuk retry aman.' }) @IsOptional() @IsString() idempotencyKey?: string;
  @ApiProperty() @IsString() warehouseId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cashierShiftId?: string;
  @ApiPropertyOptional({ default: 'CASH', enum: ['CASH','QRIS','TRANSFER','CARD'], description: 'Kompatibilitas transaksi satu metode. Jangan kirim bersamaan dengan payments.' }) @IsOptional() @IsString() @IsIn(['CASH','QRIS','TRANSFER','CARD']) paymentMethod?: string;
  @ApiPropertyOptional({ type: [SalePaymentDto], description: 'Split payment. Total amount wajib sama persis dengan total transaksi.' }) @IsOptional() @IsArray() @ArrayMaxSize(8) @ValidateNested({ each: true }) @Type(() => SalePaymentDto) payments?: SalePaymentDto[];
  @ApiPropertyOptional({ description: 'Kode promo aktif yang diterapkan server.' }) @IsOptional() @IsString() @MaxLength(64) promoCode?: string;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() @Min(0) discount?: number;
  @ApiPropertyOptional({ description: 'Tukar poin loyalitas; diskon = points / redemptionRate program.' }) @IsOptional() @IsInt() @Min(0) redeemPoints?: number;
  @ApiProperty({ type: [SaleItemDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => SaleItemDto) items!: SaleItemDto[];
}

export class OpenCashierShiftDto {
  @ApiProperty({ example: 500000 }) @IsNumber() @Min(0) openingCash!: number;
}

export class CloseCashierShiftDto {
  @ApiProperty({ example: 1750000 }) @IsNumber() @Min(0) closingCash!: number;
}

export class CashierCashMovementDto {
  @ApiProperty({ enum: ['CASH_IN','CASH_OUT'] }) @IsString() @IsIn(['CASH_IN','CASH_OUT']) type!: 'CASH_IN' | 'CASH_OUT';
  @ApiProperty({ example: 100000 }) @IsNumber() @Min(0.01) amount!: number;
  @ApiProperty({ example: 'Tambah uang kecil' }) @IsString() @MaxLength(240) reason!: string;
}

export class OfflineSaleReplayItemDto {
  @ApiProperty() @IsString() @MaxLength(160) localId!: string;
  @ApiProperty() @IsInt() @Min(1) sequence!: number;
  @ApiProperty() @IsDateString() capturedAt!: string;
  @ApiProperty({ description: 'Waktu terakhir POS menerima konfigurasi harga/pajak server.' }) @IsDateString() configSyncedAt!: string;
  @ApiProperty({ description: 'Total yang diterima kasir saat offline; server harus cocok sebelum transaksi diterapkan.' }) @IsNumber() @Min(0) expectedTotal!: number;
  @ApiProperty({ type: CreateSaleDto }) @ValidateNested() @Type(() => CreateSaleDto) payload!: CreateSaleDto;
}

export class ReplayOfflineSalesDto {
  @ApiProperty() @IsString() @MaxLength(160) deviceCode!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) deviceName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) appVersion?: string;
  @ApiProperty({ type: [OfflineSaleReplayItemDto] }) @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => OfflineSaleReplayItemDto) transactions!: OfflineSaleReplayItemDto[];
}
