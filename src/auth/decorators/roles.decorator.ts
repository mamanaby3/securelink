import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../dto/register.dto';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);










