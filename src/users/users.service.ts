import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { RowDataPacket } from 'mysql2';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../common/database.service';
import { AuthUser } from '../types';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async list(query: { q?: string; role?: string; status?: string }): Promise<AuthUser[]> {
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (query.q?.trim()) {
      clauses.push('(name LIKE ? OR email LIKE ?)');
      values.push(`%${query.q.trim()}%`, `%${query.q.trim()}%`);
    }
    if (query.role) {
      clauses.push('role=?');
      values.push(query.role);
    }
    if (query.status) {
      clauses.push('is_active=?');
      values.push(query.status === 'active' ? 1 : 0);
    }
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    return this.database.query<RowDataPacket & AuthUser>(
      `SELECT id,name,email,role,is_active,must_change_password,avatar_path,last_login_at,created_at,updated_at FROM users${where} ORDER BY id DESC LIMIT 200`,
      values,
    );
  }

  async find(id: number): Promise<AuthUser> {
    const user = await this.database.one<RowDataPacket & AuthUser>(
      'SELECT id,name,email,role,is_active,must_change_password,avatar_path,last_login_at,created_at,updated_at FROM users WHERE id=? LIMIT 1',
      [id],
    );
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return user;
  }

  async create(body: CreateUserDto, actor: AuthUser): Promise<number> {
    try {
      const now = this.database.now();
      const result = await this.database.execute(
        'INSERT INTO users (name,email,password,role,is_active,must_change_password,created_at,updated_at) VALUES (?,?,?,?,1,1,?,?)',
        [
          body.name.trim(),
          body.email.trim().toLowerCase(),
          await hash(body.password, 12),
          body.role,
          now,
          now,
        ],
      );
      await this.audit.log(actor.id, 'create_user', 'user', String(result.insertId));
      return result.insertId;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Duplicate')) {
        throw new ConflictException('Email sudah dipakai.');
      }
      throw error;
    }
  }

  async update(id: number, body: UpdateUserDto, actor: AuthUser): Promise<void> {
    await this.find(id);
    const fields: string[] = [];
    const values: unknown[] = [];
    if (body.name?.trim()) {
      fields.push('name=?');
      values.push(body.name.trim());
    }
    if (body.role) {
      fields.push('role=?');
      values.push(body.role);
    }
    if (body.is_active !== undefined) {
      fields.push('is_active=?');
      values.push(body.is_active ? 1 : 0);
    }
    if (!fields.length) {
      return;
    }
    fields.push('updated_at=?');
    values.push(this.database.now(), id);
    await this.database.execute(`UPDATE users SET ${fields.join(',')} WHERE id=?`, values);
    await this.audit.log(actor.id, 'update_user', 'user', String(id), {
      fields: fields.map((field) => field.split('=')[0]),
    });
  }

  async remove(id: number, actor: AuthUser): Promise<void> {
    if (id === 1) {
      throw new BadRequestException('Default superadmin tidak boleh dihapus.');
    }
    if (id === actor.id) {
      throw new BadRequestException('User aktif tidak boleh menghapus dirinya sendiri.');
    }
    await this.find(id);
    await this.database.execute('DELETE FROM users WHERE id=?', [id]);
    await this.audit.log(actor.id, 'delete_user', 'user', String(id));
  }

  async resetPassword(id: number, body: ResetPasswordDto, actor: AuthUser): Promise<void> {
    await this.find(id);
    await this.database.execute(
      'UPDATE users SET password=?,must_change_password=1,updated_at=? WHERE id=?',
      [await hash(body.password, 12), this.database.now(), id],
    );
    await this.audit.log(actor.id, 'reset_password', 'user', String(id));
  }
}
