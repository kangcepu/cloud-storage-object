import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const user = request.session.userId ? await this.auth.userById(request.session.userId) : null;
    if (!user) {
      throw new UnauthorizedException('Unauthenticated.');
    }
    request.user = user;
    return true;
  }
}

@Injectable()
export class SuperadminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: { role?: string } }>();
    if (request.user?.role !== 'superadmin') {
      throw new ForbiddenException('Forbidden.');
    }
    return true;
  }
}

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const body = request.body as { _csrf?: unknown } | undefined;
    const bodyToken = typeof body?._csrf === 'string' ? body._csrf : '';
    const supplied = request.get('x-csrf-token') || bodyToken;
    if (!request.session.csrfToken || supplied !== request.session.csrfToken) {
      throw new ForbiddenException('CSRF token invalid.');
    }
    return true;
  }
}

@Injectable()
export class MobileAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const user = await this.auth.userByToken(this.auth.bearerToken(request));
    if (!user) {
      throw new UnauthorizedException('Unauthenticated.');
    }
    request.user = user;
    return true;
  }
}
