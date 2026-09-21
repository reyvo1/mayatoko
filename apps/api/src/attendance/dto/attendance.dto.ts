import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBase64, IsDateString, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export enum AttendanceMethodDto {
  FINGERPRINT = 'FINGERPRINT', FACE_DEVICE = 'FACE_DEVICE', SELFIE_GPS = 'SELFIE_GPS',
  MOBILE_GPS = 'MOBILE_GPS', WEB = 'WEB', QR_CODE = 'QR_CODE', MANUAL = 'MANUAL', API_IMPORT = 'API_IMPORT',
}
export enum AttendanceEventTypeDto {
  CHECK_IN = 'CHECK_IN', CHECK_OUT = 'CHECK_OUT', BREAK_START = 'BREAK_START', BREAK_END = 'BREAK_END',
  OVERTIME_START = 'OVERTIME_START', OVERTIME_END = 'OVERTIME_END',
}

export class CreateAttendanceEventDto {
  @ApiPropertyOptional({ description: 'Kompatibilitas lama; company tetap berasal dari token.' }) @IsOptional() @IsUUID() companyId?: string;
  @ApiPropertyOptional({ description: 'Kompatibilitas lama; branch tetap berasal dari token.' }) @IsOptional() @IsUUID() branchId?: string;
  @ApiProperty() @IsUUID() employeeId!: string;
  @ApiProperty({ enum: AttendanceEventTypeDto }) @IsEnum(AttendanceEventTypeDto) eventType!: AttendanceEventTypeDto;
  @ApiProperty({ enum: AttendanceMethodDto }) @IsEnum(AttendanceMethodDto) method!: AttendanceMethodDto;
  @ApiProperty() @IsDateString() occurredAt!: string;
  @ApiPropertyOptional({ description: 'YYYY-MM-DD sesuai timezone cabang.' }) @IsOptional() @IsString() workDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() deviceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() geofenceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() operationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() externalEventId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) accuracyMeters?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() photoObjectKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(1) livenessScore?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(1) faceMatchScore?: number;
  @ApiPropertyOptional() @IsOptional() @IsObject() sourcePayload?: Record<string, unknown>;
}

export class FingerprintEventDto {
  @ApiPropertyOptional({ description: 'Kompatibilitas lama; company tetap berasal dari token.' }) @IsOptional() @IsUUID() companyId?: string;
  @ApiPropertyOptional({ description: 'Kompatibilitas lama; branch tetap berasal dari token.' }) @IsOptional() @IsUUID() branchId?: string;
  @ApiProperty() @IsString() deviceCode!: string;
  @ApiProperty() @IsString() deviceUserCode!: string;
  @ApiProperty() @IsString() externalEventId!: string;
  @ApiProperty() @IsDateString() occurredAt!: string;
  @ApiProperty({ enum: AttendanceEventTypeDto }) @IsEnum(AttendanceEventTypeDto) eventType!: AttendanceEventTypeDto;
  @ApiPropertyOptional() @IsOptional() @IsObject() sourcePayload?: Record<string, unknown>;
}

export class CreateGeofenceDto {
  @ApiPropertyOptional({ description: 'Kompatibilitas lama; company tetap berasal dari token.' }) @IsOptional() @IsUUID() companyId?: string;
  @ApiPropertyOptional({ description: 'Kompatibilitas lama; branch tetap berasal dari token.' }) @IsOptional() @IsUUID() branchId?: string;
  @ApiProperty() @IsString() code!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiProperty() @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @ApiProperty() @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @ApiProperty() @IsInt() @Min(5) radiusMeters!: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) allowedAccuracyMeters?: number;
}

export class CreateAttendanceDeviceDto {
  @ApiPropertyOptional({ description: 'Kompatibilitas lama; company tetap berasal dari token.' }) @IsOptional() @IsUUID() companyId?: string;
  @ApiPropertyOptional({ description: 'Kompatibilitas lama; branch tetap berasal dari token.' }) @IsOptional() @IsUUID() branchId?: string;
  @ApiProperty() @IsString() code!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiProperty() @IsString() deviceType!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() vendor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() model?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() serialNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ipAddress?: string;
}

export class EnrollBiometricDto {
  @ApiPropertyOptional({ description: 'Kompatibilitas lama; company tetap berasal dari token.' }) @IsOptional() @IsUUID() companyId?: string;
  @ApiPropertyOptional({ description: 'Kompatibilitas lama; branch tetap berasal dari token.' }) @IsOptional() @IsUUID() branchId?: string;
  @ApiProperty() @IsUUID() employeeId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() attendanceDeviceId?: string;
  @ApiProperty() @IsString() biometricType!: string;
  @ApiProperty() @IsString() deviceUserCode!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() externalTemplateRef?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() templateHash?: string;
}

export class UploadAttendancePhotoDto {
  @ApiProperty() @IsString() fileName!: string;
  @ApiProperty() @IsString() contentType!: string;
  @ApiProperty() @IsBase64() base64!: string;
}
