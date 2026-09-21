import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { CreateReportJobDto } from './dto/create-report-job.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports') @ApiBearerAuth() @Controller('reports') @Roles('SUPER_ADMIN','OWNER','ADMIN','FINANCE')
  export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.reports.dashboard(user);
  }

  @Get('analytics')
  analytics(@CurrentUser() user: AuthUser) {
    return this.reports.analytics(user);
  }

  @Get('profit-loss')
  profitLoss(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('companyId') companyId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reports.profitLoss(user, from, to, companyId, branchId);
  }

  @Get('trial-balance')
  trialBalance(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('companyId') companyId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reports.trialBalance(user, from, to, companyId, branchId);
  }

  @Get('balance-sheet')
  balanceSheet(
    @CurrentUser() user: AuthUser,
    @Query('asOf') asOf?: string,
    @Query('companyId') companyId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reports.balanceSheet(user, asOf, companyId, branchId);
  }

  @Get('general-ledger')
  generalLedger(
    @CurrentUser() user: AuthUser,
    @Query('accountCode') accountCode?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reports.generalLedger(user, accountCode, from, to, limit);
  }

  @Get('tax-summary')
  taxSummary(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('companyId') companyId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reports.taxSummary(user, from, to, companyId, branchId);
  }

  @Get('financial-integrity')
  financialIntegrity(@CurrentUser() user: AuthUser, @Query('asOf') asOf?: string) {
    return this.reports.financialIntegrity(user, asOf);
  }

  @Get('inventory-valuation')
  inventoryValuation(
    @CurrentUser() user: AuthUser,
    @Query('warehouseId') warehouseId?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.reports.inventoryValuation(user, warehouseId, limit, cursor);
  }

  @Post('jobs')
  @Permissions('report.export')
  createJob(@Body() dto: CreateReportJobDto, @CurrentUser() user: AuthUser) {
    return this.reports.createJob(dto, user);
  }

  @Get('jobs')
  listJobs(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('branchId') branchId?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.reports.listJobs(user, companyId, branchId, limit, cursor);
  }

  @Get('jobs/:id/download')
  @Permissions('report.export')
  downloadJob(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.reports.downloadJob(user, id);
  }

  @Get('peak-hours')
  peakHours(@CurrentUser() user: AuthUser, @Query('days') days?: string) {
    return this.reports.peakHours(user, days);
  }

  @Get('dead-stock')
  deadStock(@CurrentUser() user: AuthUser, @Query('days') days?: string, @Query('limit') limit?: string) {
    return this.reports.deadStock(user, days, limit);
  }

  @Get('customer-rfm')
  customerRfm(@CurrentUser() user: AuthUser, @Query('days') days?: string, @Query('limit') limit?: string) {
    return this.reports.customerRfm(user, days, limit);
  }
}
