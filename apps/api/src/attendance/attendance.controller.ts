import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDeviceDto, CreateAttendanceEventDto, CreateGeofenceDto, EnrollBiometricDto, FingerprintEventDto, UploadAttendancePhotoDto } from './dto/attendance.dto';

@ApiTags('attendance') @ApiBearerAuth() @Controller('attendance')
  export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Permissions('attendance.record')
  @Get('config')
  config(@CurrentUser() user: AuthUser, @Query('employeeId') employeeId: string) {
    return this.attendance.employeeConfig(user, employeeId);
  }

  @Permissions('attendance.record')
  @Post('media/upload-local')
  upload(@CurrentUser() user: AuthUser, @Body() dto: UploadAttendancePhotoDto) {
    return this.attendance.uploadLocalPhoto(user, dto);
  }

  @Permissions('attendance.record')
  @Post('events')
  record(@CurrentUser() user: AuthUser, @Body() dto: CreateAttendanceEventDto) {
    return this.attendance.record(user, dto);
  }

  @Permissions('attendance.device_ingest')
  @Post('devices/fingerprint/events')
  fingerprint(@CurrentUser() user: AuthUser, @Body() dto: FingerprintEventDto) {
    return this.attendance.ingestFingerprint(user, dto);
  }

  @Permissions('attendance.manage')
  @Post('devices')
  device(@CurrentUser() user: AuthUser, @Body() dto: CreateAttendanceDeviceDto) {
    return this.attendance.createDevice(user, dto);
  }

  @Permissions('attendance.manage')
  @Post('geofences')
  geofence(@CurrentUser() user: AuthUser, @Body() dto: CreateGeofenceDto) {
    return this.attendance.createGeofence(user, dto);
  }

  @Permissions('attendance.manage')
  @Post('biometrics/enroll')
  enroll(@CurrentUser() user: AuthUser, @Body() dto: EnrollBiometricDto) {
    return this.attendance.enroll(user, dto);
  }

  @Permissions('attendance.view')
  @Get('employee')
  list(
    @CurrentUser() user: AuthUser,
    @Query('employeeId') employeeId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.attendance.listEmployee(user, employeeId, limit, cursor);
  }
}
