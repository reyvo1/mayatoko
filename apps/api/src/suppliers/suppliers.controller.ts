import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { SuppliersService } from './suppliers.service';

@ApiTags('suppliers')
@ApiBearerAuth()
@Controller('suppliers')
  export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'PURCHASING', 'WAREHOUSE')
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.suppliers.list(user, companyId, search, limit, cursor);
  }

  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'PURCHASING')
  @Post()
  @Permissions('supplier.create')
  create(@Body() dto: CreateSupplierDto, @CurrentUser() user: AuthUser) {
    return this.suppliers.create(dto, user);
  }
}
