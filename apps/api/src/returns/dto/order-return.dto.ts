import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export class CreateCustomerOrderReturnItemDto {
  @ApiProperty() @IsString() orderItemId!: string;
  @ApiProperty({ minimum: 1 }) @Type(() => Number) @IsInt() @Min(1) quantity!: number;
}

export class CreateCustomerOrderReturnDto {
  @ApiProperty() @IsString() orderId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) reason?: string;
  @ApiPropertyOptional({ enum: ['ORIGINAL','CASH','BANK_TRANSFER'] })
  @IsOptional() @IsString() @IsIn(['ORIGINAL','CASH','BANK_TRANSFER']) refundMethod?: string;
  @ApiProperty({ type: [CreateCustomerOrderReturnItemDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => CreateCustomerOrderReturnItemDto) items!: CreateCustomerOrderReturnItemDto[];
}

export class RejectOrderReturnDto {
  @ApiProperty() @IsString() @MaxLength(1000) reason!: string;
}

export class ConfirmOrderReturnDto {
  @ApiPropertyOptional({ enum: ['ORIGINAL','CASH','BANK_TRANSFER'] })
  @IsOptional() @IsString() @IsIn(['ORIGINAL','CASH','BANK_TRANSFER']) refundMethod?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}
