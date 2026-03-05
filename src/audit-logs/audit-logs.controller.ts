import { Controller, Get, UseGuards, Query, Post } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { AuditStatus } from './entities/audit-log.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganisationRoles } from '../auth/decorators/organisation-roles.decorator';
import { OrganisationRoleGuard } from '../auth/guards/organisation-role.guard';
import { UserRole, OrganisationRole } from '../auth/dto/register.dto';

@ApiTags('Admin')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard, OrganisationRoleGuard)
@ApiBearerAuth('JWT-auth')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @OrganisationRoles(OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiOperation({ summary: 'Obtenir la liste des journaux d\'audit' })
  @ApiQuery({ name: 'status', required: false, enum: AuditStatus })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Liste des journaux d\'audit' })
  findAll(
    @Query('status') status?: AuditStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (status) {
      return this.auditLogsService.findByStatus(status);
    }
    if (startDate && endDate) {
      return this.auditLogsService.findByDateRange(
        new Date(startDate),
        new Date(endDate),
      );
    }
    return this.auditLogsService.findAll();
  }

  @Post('export')
  @Roles(UserRole.ADMIN)
  @OrganisationRoles(OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiOperation({ summary: 'Exporter les journaux d\'audit' })
  @ApiResponse({ status: 200, description: 'Journaux exportés' })
  export() {
    return this.auditLogsService.export();
  }
}



