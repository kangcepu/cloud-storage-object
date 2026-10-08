import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { Request } from 'express';
import { RowDataPacket } from 'mysql2';
import { createHash, randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../common/database.service';
import { AuthUser } from '../types';

interface UserWithPassword extends RowDataPacket, AuthUser {
  password: string;
}

interface TokenUserRow extends RowDataPacket, AuthUser {
  token_id: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async userById(id: number): Promise<AuthUser | null> {
    return this.database.one<RowDataPacket & AuthUser>(
      'SELECT id,name,email,role,is_active,must_change_password,avatar_path,last_login_at,created_at,updated_at FROM users WHERE id=? AND is_active=1 LIMIT 1',
      [id],
    );
  }

  async login(email: string, password: string, request: Request): Promise<AuthUser> {
    const attempt = request.session.loginAttempt ?? { count: 0, lockedUntil: 0 };
    if (attempt.lockedUntil > Date.now()) {
      throw new HttpException('Terlalu banyak percobaan. Coba lagi nanti.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const normalized = email.trim().toLowerCase();
    const user = await this.database.one<UserWithPassword>('SELECT * FROM users WHERE email=? LIMIT 1', [
      normalized,
    ]);
    if (!user || user.is_active !== 1 || !(await compare(password, user.password))) {
      const count = attempt.count + 1;
      request.session.loginAttempt = { count, lockedUntil: count >= 8 ? Date.now() + 600_000 : 0 };
      await this.audit.log(
        user?.id ?? null,
        'login_failed',
        'user',
        user ? String(user.id) : null,
        { email: normalized },
        request,
      );
      throw new BadRequestException('Email atau password salah.');
    }
    request.session.loginAttempt = { count: 0, lockedUntil: 0 };
    await new Promise<void>((resolve, reject) =>
      request.session.regenerate((error) =>
        error ? reject(error instanceof Error ? error : new Error(String(error))) : resolve(),
      ),
    );
    request.session.userId = user.id;
    request.session.csrfToken = randomBytes(32).toString('hex');
    const now = this.database.now();
    await this.database.execute('UPDATE users SET last_login_at=?, updated_at=? WHERE id=?', [
      now,
      now,
      user.id,
    ]);
    await this.audit.log(user.id, 'login', 'user', String(user.id), null, request);
    return (await this.userById(user.id)) as AuthUser;
  }

  async logout(request: Request): Promise<void> {
    if (request.session.userId) {
      await this.audit.log(
        request.session.userId,
        'logout',
        'user',
        String(request.session.userId),
        null,
        request,
      );
    }
    await new Promise<void>((resolve, reject) =>
      request.session.destroy((error) =>
        error ? reject(error instanceof Error ? error : new Error(String(error))) : resolve(),
      ),
    );
  }

  async changePassword(user: AuthUser, current: string, next: string, request: Request): Promise<void> {
    const row = await this.database.one<UserWithPassword>('SELECT * FROM users WHERE id=? LIMIT 1', [
      user.id,
    ]);
    if (!row || !(await compare(current, row.password))) {
      throw new BadRequestException('Password saat ini salah.');
    }
    await this.database.execute(
      'UPDATE users SET password=?, must_change_password=0, updated_at=? WHERE id=?',
      [await hash(next, 12), this.database.now(), user.id],
    );
    await this.audit.log(user.id, 'change_password', 'user', String(user.id), null, request);
  }

  async issueMobileToken(
    username: string,
    password: string,
    name: string,
    request: Request,
  ): Promise<string> {
    const user = await this.database.one<UserWithPassword>('SELECT * FROM users WHERE email=? LIMIT 1', [
      username.trim().toLowerCase(),
    ]);
    if (!user || user.is_active !== 1 || !(await compare(password, user.password))) {
      await this.audit.log(
        user?.id ?? null,
        'login_failed',
        'user',
        user ? String(user.id) : null,
        { mobile: true },
        request,
      );
      throw new BadRequestException('Email atau password salah.');
    }
    const token = randomBytes(32).toString('base64url');
    await this.database.execute(
      'INSERT INTO api_tokens (user_id,name,token_hash,created_at) VALUES (?,?,?,?)',
      [user.id, name, this.tokenHash(token), this.database.now()],
    );
    await this.database.execute('UPDATE users SET last_login_at=?, updated_at=? WHERE id=?', [
      this.database.now(),
      this.database.now(),
      user.id,
    ]);
    await this.audit.log(user.id, 'api_token_login', 'user', String(user.id), { name }, request);
    return token;
  }

  async userByToken(token: string): Promise<AuthUser | null> {
    if (!token) {
      return null;
    }
    const row = await this.database.one<TokenUserRow>(
      'SELECT u.id,u.name,u.email,u.role,u.is_active,u.must_change_password,u.avatar_path,u.last_login_at,u.created_at,u.updated_at,t.id token_id FROM api_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.revoked_at IS NULL LIMIT 1',
      [this.tokenHash(token)],
    );
    if (!row || row.is_active !== 1) {
      return null;
    }
    await this.database.execute('UPDATE api_tokens SET last_used_at=? WHERE id=?', [
      this.database.now(),
      row.token_id,
    ]);
    const user = { ...row } as Partial<TokenUserRow>;
    delete user.token_id;
    return user as AuthUser;
  }

  async revokeToken(token: string): Promise<void> {
    if (token) {
      await this.database.execute('UPDATE api_tokens SET revoked_at=? WHERE token_hash=?', [
        this.database.now(),
        this.tokenHash(token),
      ]);
    }
  }

  bearerToken(request: Request): string {
    const authorization = request.get('authorization') ?? '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || request.get('x-api-token')?.trim() || '';
  }

  requireTokenUser(user: AuthUser | null): AuthUser {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated.');
    }
    return user;
  }

  private tokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
