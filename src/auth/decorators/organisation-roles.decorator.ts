import { SetMetadata } from '@nestjs/common';
import { OrganisationRole } from '../dto/register.dto';
import { ORGANISATION_ROLES_KEY } from '../guards/organisation-role.guard';

export const OrganisationRoles = (...roles: OrganisationRole[]) =>
  SetMetadata(ORGANISATION_ROLES_KEY, roles);








