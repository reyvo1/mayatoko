import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { AuthUser } from '../auth/auth.types';
import { decodeCursor, parsePageLimit, toCursorPage } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceMethodDto, CreateAttendanceDeviceDto, CreateAttendanceEventDto, CreateGeofenceDto, EnrollBiometricDto, FingerprintEventDto, UploadAttendancePhotoDto } from './dto/attendance.dto';

function radians(value: number) { return value * Math.PI / 180; }
function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earth = 6371000;
  const dLat = radians(lat2 - lat1); const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function normalizeWorkDate(input: string | undefined, occurredAt: Date) {
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) return new Date(`${input}T00:00:00.000Z`);
  return new Date(Date.UTC(occurredAt.getUTCFullYear(), occurredAt.getUTCMonth(), occurredAt.getUTCDate()));
}

type DbClient = Prisma.TransactionClient | PrismaService;
type TenantScope = { companyId: string; branchId: string };

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private requireTenantScope(user: AuthUser): TenantScope {
    if (!user.companyId || !user.branchId) {
      throw new ForbiddenException({
        code: 'TENANT_CONTEXT_REQUIRED',
        message: 'Pengguna belum memiliki company dan branch yang valid.',
      });
    }
    return { companyId: user.companyId, branchId: user.branchId };
  }

  private async denyTenantAccess(
    client: DbClient,
    user: AuthUser,
    scope: TenantScope,
    entityType: string,
    entityId?: string,
    payload?: Prisma.InputJsonValue,
  ): Promise<never> {
    await client.auditLog.create({
      data: {
        companyId: scope.companyId,
        userId: user.sub,
        action: 'TENANT_ACCESS_DENIED',
        entityType,
        entityId,
        payload: payload ?? {
          authenticatedCompanyId: scope.companyId,
          authenticatedBranchId: scope.branchId,
        },
      },
    });
    throw new ForbiddenException({
      code: 'TENANT_ACCESS_DENIED',
      message: `${entityType} tidak tersedia dalam company dan branch pengguna.`,
    });
  }

  private async assertRequestedScope(
    client: DbClient,
    user: AuthUser,
    scope: TenantScope,
    requestedCompanyId?: string,
    requestedBranchId?: string,
    entityType = 'AttendanceScope',
  ): Promise<void> {
    if ((requestedCompanyId && requestedCompanyId !== scope.companyId)
      || (requestedBranchId && requestedBranchId !== scope.branchId)) {
      await this.denyTenantAccess(client, user, scope, entityType, undefined, {
        authenticatedCompanyId: scope.companyId,
        authenticatedBranchId: scope.branchId,
        ...(requestedCompanyId ? { requestedCompanyId } : {}),
        ...(requestedBranchId ? { requestedBranchId } : {}),
      });
    }
  }

  private async scopedEmployee(client: DbClient, user: AuthUser, scope: TenantScope, employeeId: string) {
    const employee = await client.employee.findFirst({
      where: { id: employeeId, companyId: scope.companyId, branchId: scope.branchId, isActive: true },
    });
    if (!employee) return this.denyTenantAccess(client, user, scope, 'Employee', employeeId);
    return employee;
  }

  private async scopedDevice(client: DbClient, user: AuthUser, scope: TenantScope, deviceId: string) {
    const device = await client.attendanceDevice.findFirst({
      where: { id: deviceId, companyId: scope.companyId, branchId: scope.branchId, status: 'ACTIVE' },
    });
    if (!device) return this.denyTenantAccess(client, user, scope, 'AttendanceDevice', deviceId);
    return device;
  }

  private async scopedDeviceByCode(client: DbClient, user: AuthUser, scope: TenantScope, deviceCode: string) {
    const device = await client.attendanceDevice.findFirst({
      where: { companyId: scope.companyId, branchId: scope.branchId, code: deviceCode, status: 'ACTIVE' },
    });
    if (!device) return this.denyTenantAccess(client, user, scope, 'AttendanceDevice', undefined, {
      authenticatedCompanyId: scope.companyId,
      authenticatedBranchId: scope.branchId,
      requestedDeviceCode: deviceCode,
    });
    return device;
  }

  private async scopedGeofence(client: DbClient, user: AuthUser, scope: TenantScope, geofenceId: string) {
    const geofence = await client.attendanceGeofence.findFirst({
      where: {
        id: geofenceId,
        companyId: scope.companyId,
        isActive: true,
        OR: [{ branchId: scope.branchId }, { branchId: null }],
      },
    });
    if (!geofence) return this.denyTenantAccess(client, user, scope, 'AttendanceGeofence', geofenceId);
    return geofence;
  }

  private async existingEventForKey(
    client: DbClient,
    user: AuthUser,
    scope: TenantScope,
    key: { operationId: string } | { externalEventId: string },
  ) {
    const prior = await client.attendanceEvent.findFirst({
      where: { companyId: scope.companyId, ...key },
    });
    if (!prior) return null;
    if (prior.branchId !== scope.branchId) {
      return this.denyTenantAccess(client, user, scope, 'AttendanceEvent', prior.id, {
        authenticatedCompanyId: scope.companyId,
        authenticatedBranchId: scope.branchId,
        existingBranchId: prior.branchId,
        ...key,
      });
    }
    return prior;
  }

  async employeeConfig(user: AuthUser, employeeId: string) {
    const scope = this.requireTenantScope(user);
    await this.scopedEmployee(this.prisma, user, scope, employeeId);
    const [policy, geofences] = await Promise.all([
      this.prisma.attendancePolicy.findFirst({
        where: {
          companyId: scope.companyId,
          isActive: true,
          OR: [{ branchId: scope.branchId }, { branchId: null }],
        },
        orderBy: { branchId: 'desc' },
      }),
      this.prisma.attendanceGeofence.findMany({
        where: {
          companyId: scope.companyId,
          isActive: true,
          OR: [{ branchId: scope.branchId }, { branchId: null }],
        },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { policy, geofences };
  }

  async uploadLocalPhoto(user: AuthUser, dto: UploadAttendancePhotoDto) {
    const scope = this.requireTenantScope(user);
    const provider = this.config.get('ATTENDANCE_MEDIA_PROVIDER') ?? 'disabled';
    if (provider !== 'local') throw new BadRequestException('Upload lokal dinonaktifkan. Konfigurasikan object-storage media provider.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(dto.contentType)) throw new BadRequestException('Format foto harus JPEG, PNG, atau WebP.');
    const data = Buffer.from(dto.base64, 'base64');
    if (!data.length || data.length > 3 * 1024 * 1024) throw new BadRequestException('Ukuran foto maksimal 3 MB.');
    const extension = extname(dto.fileName).toLowerCase() || (dto.contentType === 'image/png' ? '.png' : '.jpg');
    const safeExtension = ['.jpg', '.jpeg', '.png', '.webp'].includes(extension) ? extension : '.jpg';
    const dateFolder = new Date().toISOString().slice(0, 10);
    const relativeDirectory = `attendance-media/${scope.companyId}/${scope.branchId}/${dateFolder}`;
    const directory = resolve(process.cwd(), 'data', relativeDirectory);
    await mkdir(directory, { recursive: true });
    const objectKey = `${relativeDirectory}/${randomUUID()}${safeExtension}`;
    await writeFile(resolve(process.cwd(), 'data', objectKey), data, { flag: 'wx' });
    return { objectKey, provider: 'local', productionSafe: false };
  }

  async createDevice(user: AuthUser, dto: CreateAttendanceDeviceDto) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, dto.companyId, dto.branchId, 'AttendanceDevice');
    return this.prisma.$transaction(async (tx) => {
      const device = await tx.attendanceDevice.create({
        data: {
          companyId: scope.companyId,
          branchId: scope.branchId,
          code: dto.code,
          name: dto.name,
          deviceType: dto.deviceType,
          vendor: dto.vendor,
          model: dto.model,
          serialNumber: dto.serialNumber,
          ipAddress: dto.ipAddress,
        },
      });
      await tx.auditLog.create({
        data: {
          companyId: scope.companyId,
          userId: user.sub,
          action: 'CREATE_ATTENDANCE_DEVICE',
          entityType: 'AttendanceDevice',
          entityId: device.id,
          payload: { branchId: scope.branchId, code: device.code },
        },
      });
      return device;
    });
  }

  async createGeofence(user: AuthUser, dto: CreateGeofenceDto) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, dto.companyId, dto.branchId, 'AttendanceGeofence');
    return this.prisma.$transaction(async (tx) => {
      const geofence = await tx.attendanceGeofence.create({
        data: {
          companyId: scope.companyId,
          branchId: scope.branchId,
          code: dto.code,
          name: dto.name,
          latitude: dto.latitude,
          longitude: dto.longitude,
          radiusMeters: dto.radiusMeters,
          allowedAccuracyMeters: dto.allowedAccuracyMeters,
        },
      });
      await tx.auditLog.create({
        data: {
          companyId: scope.companyId,
          userId: user.sub,
          action: 'CREATE_ATTENDANCE_GEOFENCE',
          entityType: 'AttendanceGeofence',
          entityId: geofence.id,
          payload: { branchId: scope.branchId, code: geofence.code },
        },
      });
      return geofence;
    });
  }

  async enroll(user: AuthUser, dto: EnrollBiometricDto) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, dto.companyId, dto.branchId, 'EmployeeBiometricCredential');
    if (!dto.externalTemplateRef && !dto.templateHash) {
      throw new BadRequestException('Simpan reference/hash template, bukan fingerprint mentah.');
    }
    return this.prisma.$transaction(async (tx) => {
      const employee = await this.scopedEmployee(tx, user, scope, dto.employeeId);
      const device = dto.attendanceDeviceId
        ? await this.scopedDevice(tx, user, scope, dto.attendanceDeviceId)
        : undefined;
      const credential = await tx.employeeBiometricCredential.create({
        data: {
          companyId: scope.companyId,
          employeeId: employee.id,
          attendanceDeviceId: device?.id,
          biometricType: dto.biometricType as never,
          deviceUserCode: dto.deviceUserCode,
          externalTemplateRef: dto.externalTemplateRef,
          templateHash: dto.templateHash,
          enrolledAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          companyId: scope.companyId,
          userId: user.sub,
          action: 'ENROLL_EMPLOYEE_BIOMETRIC',
          entityType: 'EmployeeBiometricCredential',
          entityId: credential.id,
          payload: {
            branchId: scope.branchId,
            employeeId: employee.id,
            ...(device ? { attendanceDeviceId: device.id } : {}),
          },
        },
      });
      return credential;
    });
  }

  async record(user: AuthUser, dto: CreateAttendanceEventDto) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, dto.companyId, dto.branchId, 'AttendanceEvent');
    if (dto.operationId) {
      const prior = await this.existingEventForKey(this.prisma, user, scope, { operationId: dto.operationId });
      if (prior) return prior;
    }
    if (dto.externalEventId) {
      const prior = await this.existingEventForKey(this.prisma, user, scope, { externalEventId: dto.externalEventId });
      if (prior) return prior;
    }

    const employee = await this.scopedEmployee(this.prisma, user, scope, dto.employeeId);
    const device = dto.deviceId ? await this.scopedDevice(this.prisma, user, scope, dto.deviceId) : undefined;

    let geofenceId: string | undefined;
    let distance: number | undefined; let inside: boolean | undefined;
    if (dto.geofenceId) {
      const geofence = await this.scopedGeofence(this.prisma, user, scope, dto.geofenceId);
      geofenceId = geofence.id;
      if (dto.latitude === undefined || dto.longitude === undefined) throw new BadRequestException('Koordinat wajib untuk absensi geofence.');
      if (geofence.allowedAccuracyMeters && (dto.accuracyMeters ?? Number.MAX_SAFE_INTEGER) > geofence.allowedAccuracyMeters) {
        throw new BadRequestException('Akurasi lokasi tidak memenuhi kebijakan absensi.');
      }
      distance = distanceMeters(dto.latitude, dto.longitude, Number(geofence.latitude), Number(geofence.longitude));
      inside = distance <= geofence.radiusMeters;
      if (!inside) throw new BadRequestException(`Lokasi berada di luar geofence (${Math.round(distance)} meter).`);
    }
    if (dto.method === 'SELFIE_GPS' && !dto.photoObjectKey) {
      throw new BadRequestException('Foto selfie wajib untuk metode SELFIE_GPS.');
    }

    const occurredAt = new Date(dto.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) throw new BadRequestException('Waktu absensi tidak valid.');
    const workDate = normalizeWorkDate(dto.workDate, occurredAt);

    return this.prisma.$transaction(async (tx) => {
      let photoEvidenceId: string | undefined;
      if (dto.photoObjectKey) {
        const evidence = await tx.attendancePhotoEvidence.create({
          data: {
            companyId: scope.companyId,
            employeeId: employee.id,
            objectKey: dto.photoObjectKey,
            capturedAt: occurredAt,
            latitude: dto.latitude,
            longitude: dto.longitude,
            livenessScore: dto.livenessScore,
            faceMatchScore: dto.faceMatchScore,
            retentionUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
          },
        });
        photoEvidenceId = evidence.id;
      }
      const event = await tx.attendanceEvent.create({
        data: {
          companyId: scope.companyId,
          branchId: scope.branchId,
          employeeId: employee.id,
          eventType: dto.eventType as never,
          method: dto.method as never,
          occurredAt,
          deviceId: device?.id,
          geofenceId,
          operationId: dto.operationId,
          externalEventId: dto.externalEventId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracyMeters: dto.accuracyMeters,
          distanceMeters: distance,
          insideGeofence: inside,
          photoEvidenceId,
          livenessScore: dto.livenessScore,
          faceMatchScore: dto.faceMatchScore,
          sourcePayload: dto.sourcePayload as Prisma.InputJsonValue | undefined,
        },
      });
      const current = await tx.attendanceRecord.findUnique({
        where: { employeeId_workDate: { employeeId: employee.id, workDate } },
      });
      if (current && (current.companyId !== scope.companyId || current.branchId !== scope.branchId)) {
        return this.denyTenantAccess(tx, user, scope, 'AttendanceRecord', current.id, {
          authenticatedCompanyId: scope.companyId,
          authenticatedBranchId: scope.branchId,
          existingCompanyId: current.companyId,
          existingBranchId: current.branchId,
        });
      }
      const data: Record<string, unknown> = {
        companyId: scope.companyId,
        branchId: scope.branchId,
        employeeId: employee.id,
        workDate,
        status: 'PRESENT',
        sourceVersion: (current?.sourceVersion ?? 0) + 1,
        calculatedAt: new Date(),
      };
      if (dto.eventType === 'CHECK_IN' && (!current?.firstCheckInAt || occurredAt < current.firstCheckInAt)) data.firstCheckInAt = occurredAt;
      if (dto.eventType === 'CHECK_OUT' && (!current?.lastCheckOutAt || occurredAt > current.lastCheckOutAt)) data.lastCheckOutAt = occurredAt;
      await tx.attendanceRecord.upsert({
        where: { employeeId_workDate: { employeeId: employee.id, workDate } },
        create: data as never,
        update: data as never,
      });
      const grouped = await tx.attendanceRecord.groupBy({
        by: ['status'],
        where: { companyId: scope.companyId, branchId: scope.branchId, workDate },
        _count: { _all: true },
        _sum: { workedMinutes: true, overtimeMinutes: true },
      });
      const summary = {
        scheduledCount: await tx.employeeSchedule.count({
          where: { companyId: scope.companyId, branchId: scope.branchId, workDate, isDayOff: false },
        }),
        presentCount: grouped.filter((row) => ['PRESENT', 'LATE', 'EARLY_LEAVE'].includes(row.status)).reduce((sum, row) => sum + row._count._all, 0),
        lateCount: grouped.find((row) => row.status === 'LATE')?._count._all ?? 0,
        absentCount: grouped.find((row) => row.status === 'ABSENT')?._count._all ?? 0,
        leaveCount: grouped.filter((row) => ['LEAVE', 'SICK'].includes(row.status)).reduce((sum, row) => sum + row._count._all, 0),
        incompleteCount: grouped.filter((row) => ['INCOMPLETE', 'NEEDS_REVIEW'].includes(row.status)).reduce((sum, row) => sum + row._count._all, 0),
        workedMinutes: grouped.reduce((sum, row) => sum + (row._sum.workedMinutes ?? 0), 0),
        overtimeMinutes: grouped.reduce((sum, row) => sum + (row._sum.overtimeMinutes ?? 0), 0),
      };
      const existingSummary = await tx.dailyAttendanceSummary.findFirst({
        where: { companyId: scope.companyId, branchId: scope.branchId, businessDate: workDate },
      });
      if (existingSummary) {
        await tx.dailyAttendanceSummary.update({ where: { id: existingSummary.id }, data: summary });
      } else {
        await tx.dailyAttendanceSummary.create({
          data: { companyId: scope.companyId, branchId: scope.branchId, businessDate: workDate, ...summary },
        });
      }
      await tx.auditLog.create({
        data: {
          companyId: scope.companyId,
          userId: user.sub,
          action: 'RECORD_ATTENDANCE_EVENT',
          entityType: 'AttendanceEvent',
          entityId: event.id,
          payload: {
            branchId: scope.branchId,
            employeeId: employee.id,
            eventType: dto.eventType,
            method: dto.method,
            ...(device ? { deviceId: device.id } : {}),
          },
        },
      });
      return event;
    }).catch((error: unknown) => {
      if (error instanceof ConflictException) throw error;
      throw error;
    });
  }

  async ingestFingerprint(user: AuthUser, dto: FingerprintEventDto) {
    const scope = this.requireTenantScope(user);
    await this.assertRequestedScope(this.prisma, user, scope, dto.companyId, dto.branchId, 'AttendanceDeviceEvent');
    const device = await this.scopedDeviceByCode(this.prisma, user, scope, dto.deviceCode);
    const credential = await this.prisma.employeeBiometricCredential.findFirst({
      where: {
        companyId: scope.companyId,
        attendanceDeviceId: device.id,
        deviceUserCode: dto.deviceUserCode,
        status: 'ACTIVE',
      },
    });
    if (!credential) {
      return this.denyTenantAccess(this.prisma, user, scope, 'EmployeeBiometricCredential', undefined, {
        authenticatedCompanyId: scope.companyId,
        authenticatedBranchId: scope.branchId,
        attendanceDeviceId: device.id,
        deviceUserCode: dto.deviceUserCode,
      });
    }
    await this.scopedEmployee(this.prisma, user, scope, credential.employeeId);
    return this.record(user, {
      companyId: scope.companyId,
      branchId: scope.branchId,
      employeeId: credential.employeeId,
      eventType: dto.eventType,
      method: AttendanceMethodDto.FINGERPRINT,
      occurredAt: dto.occurredAt,
      deviceId: device.id,
      externalEventId: dto.externalEventId,
      sourcePayload: dto.sourcePayload,
    });
  }

  async listEmployee(user: AuthUser, employeeId: string, limitInput?: string, cursorInput?: string) {
    const scope = this.requireTenantScope(user);
    const employee = await this.scopedEmployee(this.prisma, user, scope, employeeId);
    const limit = parsePageLimit(limitInput);
    const cursor = decodeCursor<{ workDate: string; id: string }>(cursorInput);
    const items = await this.prisma.attendanceRecord.findMany({
      where: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        employeeId: employee.id,
        ...(cursor ? {
          OR: [
            { workDate: { lt: new Date(cursor.workDate) } },
            { workDate: new Date(cursor.workDate), id: { lt: cursor.id } },
          ],
        } : {}),
      },
      orderBy: [{ workDate: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    return toCursorPage(items, limit, (item) => ({ workDate: item.workDate.toISOString(), id: item.id }));
  }
}
