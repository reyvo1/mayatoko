import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
class PurchaseOrderItemDto {
  @ApiProperty() @IsString() productId!: string;
  @ApiProperty({ example: 10 }) @IsInt() @Min(1) orderedQty!: number;
  @ApiProperty({ example: 10000 }) @IsNumber() @Min(0) unitCost!: number;
}
export class CreatePurchaseOrderDto {
  @ApiPropertyOptional({ description: 'Kunci idempotensi untuk retry aman.' }) @IsOptional() @IsString() idempotencyKey?: string;
  @ApiProperty() @IsString() supplierId!: string;
  @ApiProperty() @IsString() warehouseId!: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expectedDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiProperty({ type: [PurchaseOrderItemDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => PurchaseOrderItemDto) items!: PurchaseOrderItemDto[];
}
