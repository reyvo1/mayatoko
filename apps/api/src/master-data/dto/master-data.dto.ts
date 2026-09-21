import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export const MASTER_REFERENCE_TYPES = ['BRAND','UNIT','BANK','COURIER','PAYMENT_METHOD'] as const;

export class CreateCategoryDto {
  @ApiProperty() @IsString() @MaxLength(120) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(140) slug?: string;
}
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class CreateCustomerDto {
  @ApiProperty() @IsString() @MaxLength(160) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) address?: string;
  @ApiPropertyOptional({ default: 'RETAIL' }) @IsOptional() @IsString() @MaxLength(40) customerType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) taxIdNumber?: string;
}
export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

export class CreateBranchDto {
  @ApiProperty() @IsString() @MaxLength(40) code!: string;
  @ApiProperty() @IsString() @MaxLength(160) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) address?: string;
}
export class UpdateBranchDto extends PartialType(CreateBranchDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateWarehouseDto {
  @ApiProperty() @IsString() branchId!: string;
  @ApiProperty() @IsString() @MaxLength(40) code!: string;
  @ApiProperty() @IsString() @MaxLength(160) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) address?: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isDefault?: boolean;
}
export class UpdateWarehouseDto extends PartialType(CreateWarehouseDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateWarehouseLocationDto {
  @ApiProperty() @IsString() warehouseId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() parentId?: string;
  @ApiProperty() @IsString() @MaxLength(50) code!: string;
  @ApiProperty() @IsString() @MaxLength(160) name!: string;
  @ApiPropertyOptional({ default: 'BIN' }) @IsOptional() @IsString() @MaxLength(40) type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) barcode?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) capacity?: number;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isDefault?: boolean;
}
export class UpdateWarehouseLocationDto extends PartialType(CreateWarehouseLocationDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateReferenceDto {
  @ApiProperty({ enum: MASTER_REFERENCE_TYPES }) @IsIn(MASTER_REFERENCE_TYPES) type!: typeof MASTER_REFERENCE_TYPES[number];
  @ApiProperty() @IsString() @MaxLength(60) code!: string;
  @ApiProperty() @IsString() @MaxLength(160) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() branchId?: string;
  @ApiPropertyOptional({ type: Object }) @IsOptional() metadata?: Record<string, unknown>;
}
export class UpdateReferenceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() branchId?: string;
  @ApiPropertyOptional({ type: Object }) @IsOptional() metadata?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateProductBarcodeDto {
  @ApiProperty() @IsString() @MaxLength(160) code!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) unitCode?: string;
  @ApiPropertyOptional({ default: 1, description: 'Jumlah base unit per barcode/unit jual. Inventory fisik Toko360 disimpan sebagai integer base unit.' }) @IsOptional() @IsInt() @Min(1) quantityFactor?: number;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isPrimary?: boolean;
}
export class UpdateProductBarcodeDto extends PartialType(CreateProductBarcodeDto) {}

export class CreateProductPriceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() branchId?: string;
  @ApiPropertyOptional({ default: 'RETAIL' }) @IsOptional() @IsString() @MaxLength(40) segmentCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) unitCode?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsNumber() @Min(0.000001) minQty?: number;
  @ApiProperty() @IsNumber() @Min(0) price!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveTo?: string;
}
export class UpdateProductPriceDto extends PartialType(CreateProductPriceDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
