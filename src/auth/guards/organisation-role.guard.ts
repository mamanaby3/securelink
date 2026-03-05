import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganisationRole, UserRole } from '../dto/register.dto';

export const ORGANISATION_ROLES_KEY = 'organisationRoles';

@Injectable()
export class OrganisationRoleGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<OrganisationRole[]>(
            ORGANISATION_ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        // Si aucun rôle organisation requis, autoriser l'accès
        // Le RolesGuard vérifiera déjà que l'utilisateur a le bon rôle application
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();
        if (!user) {
            throw new ForbiddenException('Utilisateur non authentifié');
        }

        // Si l'utilisateur est ADMIN, autoriser l'accès sans vérification d'organisationRole
        // Le RolesGuard vérifiera déjà que l'utilisateur a le rôle ADMIN
        if (user.role === UserRole.ADMIN) {
            return true;
        }

        // Si l'utilisateur est CLIENT, autoriser l'accès sans vérification d'organisationRole
        // Le RolesGuard vérifiera déjà que l'utilisateur a le rôle CLIENT
        if (user.role === UserRole.CLIENT) {
            return true;
        }

        // Pour les utilisateurs ORGANISATION, vérifier le rôle organisation
        if (user.role === UserRole.ORGANISATION) {
            if (!user.organisationRole) {
                throw new ForbiddenException('Rôle organisation non défini pour cet utilisateur');
            }

            const hasRequiredRole = requiredRoles.some((role) => user.organisationRole === role);
            if (!hasRequiredRole) {
                throw new ForbiddenException(
                    `Accès refusé. Rôles requis: ${requiredRoles.join(', ')}. Rôle actuel: ${user.organisationRole}`
                );
            }
            return true;
        }

        // Si le rôle n'est ni ADMIN, ni CLIENT, ni ORGANISATION, refuser l'accès
        throw new ForbiddenException(`Rôle non autorisé: ${user.role}`);
    }
}

