import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { AccountingCoreService } from './accounting-core.service';
import { CreatePostingRuleDto, CreateTaxCodeDto, PostManualAccountingEventDto, PreviewTaxDto } from './dto/accounting-core.dto';

@ApiTags('accounting-core') @ApiBearerAuth() @Controller('accounting-core')
  export class AccountingCoreController {
  constructor(private readonly accounting: AccountingCoreService) {}

  @Roles('SUPER_ADMIN','OWNER','FINANCE','AUDITOR') @Permissions('finance.view') @Get('accounts')
  accounts(@CurrentUser() user: AuthUser) {
    return this.accounting.listAccounts(user);
  }

  @Roles('SUPER_ADMIN','OWNER','FINANCE','AUDITOR') @Permissions('finance.view') @Get('events')
  events(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.accounting.listEvents(user, limit, cursor, companyId);
  }

  @Roles('SUPER_ADMIN','OWNER','FINANCE','AUDITOR') @Permissions('tax.view') @Get('tax-codes')
  taxCodes(@CurrentUser() user: AuthUser, @Query('companyId') companyId?: string) {
    return this.accounting.listTaxCodes(user, companyId);
  }

  @Roles('SUPER_ADMIN','OWNER','FINANCE') @Permissions('tax.manage') @Post('tax-codes')
  createTaxCode(@CurrentUser() user: AuthUser, @Body() dto: CreateTaxCodeDto) {
    return this.accounting.createTaxCode(dto, user);
  }

  @Roles('SUPER_ADMIN','OWNER','FINANCE') @Permissions('tax.view') @Post('tax/preview')
  previewTax(@CurrentUser() user: AuthUser, @Body() dto: PreviewTaxDto) {
    return this.accounting.previewTax(dto.taxCodeId, dto.amount, user);
  }

  @Roles('SUPER_ADMIN','OWNER','FINANCE','AUDITOR') @Permissions('finance.view') @Get('posting-rules')
  postingRules(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('eventType') eventType?: string,
  ) {
    return this.accounting.listPostingRules(user, eventType, companyId);
  }

  @Roles('SUPER_ADMIN','OWNER','FINANCE') @Permissions('accounting.rule.manage') @Post('posting-rules')
  createPostingRule(@CurrentUser() user: AuthUser, @Body() dto: CreatePostingRuleDto) {
    return this.accounting.createPostingRule(dto, user);
  }

  @Roles('SUPER_ADMIN','OWNER','FINANCE') @Permissions('finance.journal') @Post('events/post')
  post(@CurrentUser() user: AuthUser, @Body() dto: PostManualAccountingEventDto) {
    return this.accounting.postManual(dto, user);
  }
}
