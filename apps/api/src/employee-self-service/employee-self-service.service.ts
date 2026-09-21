import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt } from 'node:crypto';
import { AuthUser } from '../auth/auth.types';
import { HrService } from '../hr/hr.service';
import { PrismaService } from '../prisma/prisma.service';
import { RequestChannelBindingDto, UpdateNotificationPreferenceDto, VerifyChannelBindingDto } from './employee-self-service.dto';

const sha256 = (input: string) => createHash('sha256').update(input).digest('hex');

@Injectable()
export class EmployeeSelfServiceService {
  constructor(
    private readonly hr: HrService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async requestBinding(user: AuthUser, dto: RequestChannelBindingDto) {
    const employee = await this.hr.byUserId(user);
    const normalized = dto.externalUserId.trim();
    if (!normalized) throw new BadRequestException('Alamat kanal tidak boleh kosong.');
    const addressHash = sha256(`${dto.channel}:${normalized}`);
    const code = String(randomInt(100000, 1000000));
    const tokenHash = sha256(code);
    const existing = await this.prisma.employeeChannelBinding.findFirst({
      where: { companyId: employee.companyId, employeeId: employee.id, channel: dto.channel as never, addressHash },
    });
    const binding = existing
      ? await this.prisma.employeeChannelBinding.update({
        where: { id: existing.id },
        data: { externalUserId: normalized, verificationTokenHash: tokenHash, verifiedAt: null, revokedAt: null },
      })
      : await this.prisma.employeeChannelBinding.create({
        data: {
          companyId: employee.companyId, employeeId: employee.id, channel: dto.channel as never,
          addressHash, externalUserId: normalized, verificationTokenHash: tokenHash,
        },
      });
    await this.prisma.notification.create({ data: {
      companyId: employee.companyId, channel: dto.channel, recipient: normalized, templateCode: 'CHANNEL_VERIFICATION',
      subject: 'Kode verifikasi kanal karyawan', body: `Kode verifikasi Toko360 Anda: ${code}. Jangan berikan kode ini kepada orang lain.`,
      data: { employeeId: employee.id, bindingId: binding.id },
    } });
    return {
      bindingId: binding.id,
      status: 'VERIFICATION_QUEUED',
      ...(this.config.get('NODE_ENV') === 'production' ? {} : { developmentCode: code }),
    };
  }

  async verifyBinding(user: AuthUser, dto: VerifyChannelBindingDto) {
    const employee = await this.hr.byUserId(user);
    const addressHash = sha256(`${dto.channel}:${dto.externalUserId.trim()}`);
    const binding = await this.prisma.employeeChannelBinding.findFirst({
      where: {
        companyId: employee.companyId, employeeId: employee.id,
        channel: dto.channel as never, addressHash, revokedAt: null,
      },
    });
    if (!binding?.verificationTokenHash || binding.verificationTokenHash !== sha256(dto.code)) {
      throw new BadRequestException('Kode verifikasi tidak valid.');
    }
    return this.prisma.employeeChannelBinding.update({
      where: { id: binding.id },
      data: { verifiedAt: new Date(), verificationTokenHash: null, isPrimary: true },
    });
  }

  async updatePreference(user: AuthUser, dto: UpdateNotificationPreferenceDto) {
    const employee = await this.hr.byUserId(user);
    return this.prisma.employeeNotificationPreference.upsert({
      where: {
        employeeId_eventCode_channel: {
          employeeId: employee.id,
          eventCode: dto.eventCode,
          channel: dto.channel as never,
        },
      },
      create: {
        companyId: employee.companyId, employeeId: employee.id,
        eventCode: dto.eventCode, channel: dto.channel as never, enabled: dto.enabled ?? true,
      },
      update: { enabled: dto.enabled ?? true },
    });
  }
}
