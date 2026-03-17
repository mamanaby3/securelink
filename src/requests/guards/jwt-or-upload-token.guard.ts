import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../auth/auth.service';
import { RequestsService } from '../requests.service';
import { UserRole } from '../../auth/dto/register.dto';

const UPLOAD_TOKEN_TYPE = 'upload';

@Injectable()
export class JwtOrUploadTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly requestsService: RequestsService,
  ) {}

  private isUploadFilledPdfRequest(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const path = req.url?.split('?')[0] ?? '';
    const method = req.method;
    return (
      (method === 'POST' || method === 'PUT') &&
      path.endsWith('/upload-filled-pdf')
    );
  }

  private getBearerToken(req: any): string | null {
    const auth = req.headers?.authorization;
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      return auth.slice(7).trim();
    }
    return null;
  }

  private getUploadToken(req: any): string | null {
    const token = req.headers?.['x-upload-token'];
    return typeof token === 'string' ? token.trim() : null;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // 1) Try Bearer JWT first
    const bearerToken = this.getBearerToken(req);
    if (bearerToken) {
      try {
        const secret =
          process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        const payload = this.jwtService.verify(bearerToken, { secret });
        const user = await this.authService.validateUserById(payload.sub);
        if (user && user.isActive) {
          req.user = {
            userId: user.id,
            email: user.email,
            role: user.role,
            type: user.type,
            organisationId: user.organisationId,
            organisationRole: user.organisationRole,
          };
          return true;
        }
      } catch {
        // Bearer invalid; fall through to upload token if applicable
      }
    }

    // 2) For upload-filled-pdf only: try X-Upload-Token
    if (this.isUploadFilledPdfRequest(context)) {
      const uploadToken = this.getUploadToken(req);
      const requestId = req.params?.id;
      if (uploadToken && requestId) {
        try {
          const secret =
            process.env.JWT_SECRET || 'your-secret-key-change-in-production';
          const payload = this.jwtService.verify(uploadToken, { secret });
          if (
            payload?.type === UPLOAD_TOKEN_TYPE &&
            payload?.requestId === requestId
          ) {
            const request = await this.requestsService.findOne(requestId);
            req.user = {
              userId: request.clientId,
              email: undefined,
              role: UserRole.CLIENT,
              type: undefined,
              organisationId: undefined,
              organisationRole: undefined,
            };
            return true;
          }
        } catch {
          // invalid or expired upload token
        }
      }
    }

    throw new UnauthorizedException('Authentification requise');
  }
}
