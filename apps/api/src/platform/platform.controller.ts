import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApprovalStatus } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import {
  CreateApprovalPolicyDto, CreateApprovalRequestDto, CreateBusinessRuleDto, CreateCustomFieldDto,
  CreateIntegrationDto, CreateUiSchemaDto, CreateWebhookDto, DecideApprovalDto, DelegateApprovalDto, UpdateIntegrationDto,
  SetCustomFieldValueDto, UpsertFeatureFlagDto, UpsertSettingDto,
} from './dto/platform.dto';
import { PlatformService } from './platform.service';

@ApiTags('platform') @ApiBearerAuth() @Controller('platform')
  export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Public() @Get('manifest')
  manifest(
    @CurrentUser() user: AuthUser | undefined,
    @Query('branchCode') branchCode?: string,
    @Query('companyId') companyId?: string,
    @Query('branchId') branchId?: string,
  ) { return this.platform.manifest(user, branchCode, companyId, branchId); }

  @Get('modules') modules() { return this.platform.listModules(); }
  @Get('plugins') plugins() { return this.platform.pluginCatalog(); }

  @Get('features') features(@CurrentUser() user: AuthUser, @Query('companyId') companyId?: string) { return this.platform.listFeatures(user, companyId); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Post('features') setFeature(@Body() dto: UpsertFeatureFlagDto, @CurrentUser() user: AuthUser) { return this.platform.setFeature(dto, user); }

  @Get('settings') settings(@CurrentUser() user: AuthUser, @Query('companyId') companyId?: string, @Query('namespace') namespace?: string) { return this.platform.listSettings(user, companyId, namespace); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Post('settings') setSetting(@Body() dto: UpsertSettingDto, @CurrentUser() user: AuthUser) { return this.platform.setSetting(dto, user); }

  @Get('custom-fields') customFields(@CurrentUser() user: AuthUser, @Query('companyId') companyId?: string, @Query('entityType') entityType?: string) { return this.platform.listCustomFields(user, companyId, entityType); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Post('custom-fields') createCustomField(@Body() dto: CreateCustomFieldDto, @CurrentUser() user: AuthUser) { return this.platform.createCustomField(dto, user); }
  @Post('custom-field-values') setCustomFieldValue(@Body() dto: SetCustomFieldValueDto, @CurrentUser() user: AuthUser) { return this.platform.setCustomFieldValue(dto, user); }

  @Get('integrations') integrations(@CurrentUser() user: AuthUser, @Query('companyId') companyId?: string) { return this.platform.listIntegrations(user, companyId); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Post('integrations') createIntegration(@Body() dto: CreateIntegrationDto, @CurrentUser() user: AuthUser) { return this.platform.createIntegration(dto, user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Patch('integrations/:id') updateIntegration(@Param('id') id: string, @Body() dto: UpdateIntegrationDto, @CurrentUser() user: AuthUser) { return this.platform.updateIntegration(id, dto, user); }

  @Get('webhooks') webhooks(@CurrentUser() user: AuthUser, @Query('companyId') companyId?: string) { return this.platform.listWebhooks(user, companyId); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Post('webhooks') createWebhook(@Body() dto: CreateWebhookDto, @CurrentUser() user: AuthUser) { return this.platform.createWebhook(dto, user); }

  @Get('business-rules') rules(@CurrentUser() user: AuthUser, @Query('companyId') companyId?: string) { return this.platform.listRules(user, companyId); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Post('business-rules') createRule(@Body() dto: CreateBusinessRuleDto, @CurrentUser() user: AuthUser) { return this.platform.createRule(dto, user); }

  @Get('approval-policies') approvalPolicies(@CurrentUser() user: AuthUser, @Query('companyId') companyId?: string) { return this.platform.listApprovalPolicies(user, companyId); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Post('approval-policies') createApprovalPolicy(@Body() dto: CreateApprovalPolicyDto, @CurrentUser() user: AuthUser) { return this.platform.createApprovalPolicy(dto, user); }
  @Get('approval-requests') approvalRequests(@CurrentUser() user: AuthUser, @Query('companyId') companyId?: string, @Query('status') status?: ApprovalStatus) { return this.platform.listApprovalRequests(user, companyId, status); }
  @Post('approval-requests') createApprovalRequest(@Body() dto: CreateApprovalRequestDto, @CurrentUser() user: AuthUser) { return this.platform.createApprovalRequest(dto, user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN','FINANCE','WAREHOUSE','PURCHASING') @Patch('approval-requests/:id/decision') decideApproval(@Param('id') id: string, @Body() dto: DecideApprovalDto, @CurrentUser() user: AuthUser) { return this.platform.decideApproval(id, dto, user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN','FINANCE','WAREHOUSE','PURCHASING') @Patch('approval-requests/:id/delegate') delegateApproval(@Param('id') id: string, @Body() dto: DelegateApprovalDto, @CurrentUser() user: AuthUser) { return this.platform.delegateApproval(id, dto, user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN','AUDITOR') @Post('automation-jobs/:id/replay') replayAutomation(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.platform.replayAutomationJob(id, user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN','AUDITOR') @Post('webhook-deliveries/:id/replay') replayWebhook(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.platform.replayWebhookDelivery(id, user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN','AUDITOR') @Post('outbox/:id/replay') replayOutbox(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.platform.replayOutboxEvent(id, user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN','AUDITOR') @Post('notifications/:id/replay') replayNotification(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.platform.replayNotification(id, user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN','AUDITOR') @Get('audit-logs') auditLogs(@CurrentUser() user: AuthUser, @Query('limit') limit?: string, @Query('action') action?: string, @Query('entityType') entityType?: string) { return this.platform.listAuditLogs(user, limit ? Number(limit) : 100, action, entityType); }

  @Get('ui-schemas') uiSchemas(@CurrentUser() user: AuthUser, @Query('companyId') companyId?: string, @Query('code') code?: string) { return this.platform.listUiSchemas(user, companyId, code); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Post('ui-schemas') createUiSchema(@Body() dto: CreateUiSchemaDto, @CurrentUser() user: AuthUser) { return this.platform.createUiSchema(dto, user); }

  @Roles('SUPER_ADMIN','OWNER','ADMIN','AUDITOR') @Get('outbox') outbox(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) { return this.platform.outbox(user, limit ? Number(limit) : 100); }

  @Roles('SUPER_ADMIN','OWNER','ADMIN','AUDITOR') @Get('ops-health') opsHealth(@CurrentUser() user: AuthUser) { return this.platform.opsHealth(user); }
  }
