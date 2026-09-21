import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { DailyDigestService } from './daily-digest.service';

@ApiTags('reports') @ApiBearerAuth() @Controller()
export class DailyDigestController {
  constructor(private readonly digest: DailyDigestService) {}

  /** Lihat/ubah konfigurasi laporan harian otomatis (T360-20260825). */
  @Get('reports/daily-digest/config')
  getConfig(@CurrentUser() user: AuthUser) {
    return this.digest.getConfigForUser(user);
  }

  @Post('reports/daily-digest/config')
  saveConfig(@Body() dto: { enabled?: boolean; hour?: number; recipients?: string[] }, @CurrentUser() user: AuthUser) {
    return this.digest.saveConfig(user, dto);
  }

  /** Preview teks laporan hari ini tanpa mengirim. */
  @Get('reports/daily-digest/preview')
  preview(@CurrentUser() user: AuthUser) {
    return this.digest.preview(user);
  }

  /** Masukkan laporan hari ini ke antrian notifikasi TELEGRAM. */
  @Post('reports/daily-digest/send')
  send(@CurrentUser() user: AuthUser) {
    return this.digest.queueDailyDigest(user);
  }
}
