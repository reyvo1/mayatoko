import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty() @IsString() @MaxLength(120) name!: string;
  @ApiProperty({ type: [String], example: ['product.view','inventory.view'] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsString({ each: true }) scopes!: string[];
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiresAt?: string;
}
