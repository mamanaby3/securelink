import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../dto/register.dto';

export const ROLES_KEY = 'roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Récupérer les rôles depuis le handler (méthode) en priorité, puis depuis la classe
    const handlerRoles = this.reflector.get<UserRole[]>(ROLES_KEY, context.getHandler());
    const classRoles = this.reflector.get<UserRole[]>(ROLES_KEY, context.getClass());
    
    // Utiliser les rôles du handler s'ils existent, sinon ceux de la classe
    const requiredRoles = handlerRoles || classRoles;

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    const hasRole = requiredRoles.some((role) => user.role === role);
    if (!hasRole) {
      throw new ForbiddenException(`Accès refusé. Rôles requis: ${requiredRoles.join(', ')}. Rôle actuel: ${user.role}`);
    }

    return true;
  }
}





