import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'SKU-001' }) @IsString() sku!: string;
  @ApiPropertyOptional({ example: '899000000001' }) @IsOptional() @IsString() barcode?: string;
  @ApiProperty({ example: 'Produk Contoh' }) @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() brandCode?: string;
  @ApiPropertyOptional({ default: 'pcs' }) @IsOptional() @IsString() unit?: string;
  @ApiProperty({ example: 10000 }) @IsNumber() @Min(0) costPrice!: number;
  @ApiProperty({ example: 15000 }) @IsNumber() @Min(0) salePrice!: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() @Min(0) minStock?: number;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}
