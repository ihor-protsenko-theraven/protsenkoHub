import {
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import type { AuthUser } from '../common/types';
import { AUTH } from './auth.config';
import { AuthService } from './auth.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(@Optional() private readonly authService?: AuthService) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const activated = await super.canActivate(context);
    if (!activated || !this.authService) {
      return Boolean(activated);
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: AuthUser }>();
    const response = http.getResponse<Response>();
    const cookies = request.cookies as Record<string, string> | undefined;
    const cookieToken = cookies?.[AUTH.cookieName];

    if (!request.user || !cookieToken) {
      return true;
    }

    try {
      const resolved = await this.authService.me(request.user);
      request.user = resolved;
      const upgraded = await this.authService.upgradeWebToken(
        resolved,
        cookieToken,
      );
      if (upgraded) {
        response.cookie?.(AUTH.cookieName, upgraded, {
          httpOnly: true,
          sameSite: AUTH.sameSite,
          secure:
            process.env.NODE_ENV === 'production' || process.env.VERCEL === '1',
          maxAge: AUTH.maxAgeMs,
          path: AUTH.cookiePath,
        });
      }
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        response.clearCookie?.(AUTH.cookieName, { path: AUTH.cookiePath });
      }
      throw error;
    }
  }
}
