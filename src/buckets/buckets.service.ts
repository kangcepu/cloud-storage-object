import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RowDataPacket } from 'mysql2';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../common/database.service';
import { slugBucket } from '../common/path.util';
import { ObjectStorageService } from '../storage/object-storage.service';
import { AuthUser, BucketRecord } from '../types';
import { AssignBucketDto, CreateBucketDto, UpdateBucketDto } from './buckets.dto';
import { PermissionService } from './permission.service';

@Injectable()
export class BucketsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: ObjectStorageService,
    private readonly permissions: PermissionService,
    private readonly audit: AuditService,
  ) {}

  async bucket(name: string): Promise<BucketRecord> {
    const bucket = await this.database.one<RowDataPacket & BucketRecord>(
      'SELECT * FROM buckets WHERE bucket_name=? LIMIT 1',
      [name],
    );
    if (!bucket) {
      throw new NotFoundException('Bucket not found.');
    }
    return bucket;
  }

  async list(user: AuthUser): Promise<{ data: any[]; minioError: string | null }> {
    if (user.role !== 'superadmin') {
      const data = await this.database.query<RowDataPacket>(
        'SELECT b.*,0 assigned_users,(SELECT COUNT(*) FROM files_metadata f WHERE f.bucket_id=b.id) total_files,(SELECT COALESCE(SUM(f.size),0) FROM files_metadata f WHERE f.bucket_id=b.id) total_size,(SELECT MAX(f.last_modified) FROM files_metadata f WHERE f.bucket_id=b.id) last_modified FROM buckets b JOIN bucket_user_permissions p ON p.bucket_id=b.id WHERE p.user_id=? AND p.can_view=1 ORDER BY b.id DESC',
        [user.id],
      );
      return { data, minioError: null };
    }
    let names: string[] = [];
    let minioError: string | null = null;
    try {
      names = (await this.storage.listBuckets()).flatMap((bucket) => (bucket.Name ? [bucket.Name] : []));
      await this.syncNames(names);
    } catch (error) {
      minioError = error instanceof Error ? error.message : String(error);
    }
    const values: unknown[] = [];
    const where = names.length ? ` WHERE b.bucket_name IN (${names.map(() => '?').join(',')})` : '';
    values.push(...names);
    const data = await this.database.query<RowDataPacket>(
      `SELECT b.*,${names.length ? '1' : 'NULL'} exists_in_minio,(SELECT COUNT(*) FROM bucket_user_permissions p WHERE p.bucket_id=b.id) assigned_users,(SELECT GROUP_CONCAT(u.name ORDER BY u.name SEPARATOR ', ') FROM bucket_user_permissions p JOIN users u ON u.id=p.user_id WHERE p.bucket_id=b.id) assigned_user_names,(SELECT COUNT(*) FROM files_metadata f WHERE f.bucket_id=b.id) total_files,(SELECT COALESCE(SUM(f.size),0) FROM files_metadata f WHERE f.bucket_id=b.id) total_size,(SELECT MAX(f.last_modified) FROM files_metadata f WHERE f.bucket_id=b.id) last_modified FROM buckets b${where} ORDER BY b.id DESC`,
      values,
    );
    return { data, minioError };
  }

  async details(
    name: string,
    user: AuthUser,
  ): Promise<{ data: BucketRecord; assigned_users: RowDataPacket[] }> {
    const bucket = await this.bucket(name);
    await this.permissions.assert(user.id, bucket.id, user.role === 'superadmin', 'view');
    const assignedUsers =
      user.role === 'superadmin'
        ? await this.database.query<RowDataPacket>(
            'SELECT u.id user_id,u.name,u.email,p.can_view,p.can_upload,p.can_rename,p.can_delete,p.can_download FROM bucket_user_permissions p JOIN users u ON u.id=p.user_id WHERE p.bucket_id=? ORDER BY u.name',
            [bucket.id],
          )
        : [];
    return { data: bucket, assigned_users: assignedUsers };
  }

  async create(body: CreateBucketDto, user: AuthUser): Promise<string> {
    const name = slugBucket(body.bucket_name);
    if (name.length < 3 || name.length > 63 || !/^[a-z0-9][a-z0-9.-]+[a-z0-9]$/.test(name)) {
      throw new BadRequestException('Nama bucket tidak valid.');
    }
    await this.storage.createBucket(name);
    const now = this.database.now();
    try {
      await this.database.execute(
        'INSERT INTO buckets (bucket_name,display_name,description,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),description=VALUES(description),updated_at=VALUES(updated_at)',
        [name, body.display_name?.trim() || null, body.description?.trim() || null, user.id, now, now],
      );
    } catch (error) {
      await this.storage.deleteBucket(name).catch(() => undefined);
      throw error;
    }
    await this.audit.log(user.id, 'create_bucket', 'bucket', name);
    return name;
  }

  async update(name: string, body: UpdateBucketDto, user: AuthUser): Promise<void> {
    await this.bucket(name);
    await this.database.execute(
      'UPDATE buckets SET display_name=?,description=?,updated_at=? WHERE bucket_name=?',
      [body.display_name?.trim() || null, body.description?.trim() || null, this.database.now(), name],
    );
    await this.audit.log(user.id, 'update_bucket', 'bucket', name);
  }

  async remove(name: string, confirm: string, user: AuthUser): Promise<void> {
    if (confirm !== name) {
      throw new BadRequestException('Konfirmasi bucket name tidak cocok.');
    }
    await this.storage.deleteBucket(name);
    await this.database.execute('DELETE FROM buckets WHERE bucket_name=?', [name]);
    await this.audit.log(user.id, 'delete_bucket', 'bucket', name);
  }

  async assign(name: string, body: AssignBucketDto, user: AuthUser): Promise<void> {
    const target = await this.database.one<RowDataPacket>('SELECT id FROM users WHERE id=? LIMIT 1', [
      body.user_id,
    ]);
    if (!target) {
      throw new NotFoundException('User not found.');
    }
    let bucket = await this.database.one<RowDataPacket & BucketRecord>(
      'SELECT * FROM buckets WHERE bucket_name=? LIMIT 1',
      [name],
    );
    if (!bucket) {
      await this.syncNames([name]);
      bucket = await this.database.one<RowDataPacket & BucketRecord>(
        'SELECT * FROM buckets WHERE bucket_name=? LIMIT 1',
        [name],
      );
    }
    if (!bucket) {
      throw new NotFoundException('Bucket not found.');
    }
    const permission = body.permissions;
    const now = this.database.now();
    await this.database.execute(
      'INSERT INTO bucket_user_permissions (bucket_id,user_id,can_view,can_upload,can_rename,can_delete,can_download,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE can_view=VALUES(can_view),can_upload=VALUES(can_upload),can_rename=VALUES(can_rename),can_delete=VALUES(can_delete),can_download=VALUES(can_download),updated_at=VALUES(updated_at)',
      [
        bucket.id,
        body.user_id,
        permission.view ? 1 : 0,
        permission.upload ? 1 : 0,
        permission.rename ? 1 : 0,
        permission.delete ? 1 : 0,
        permission.download ? 1 : 0,
        now,
        now,
      ],
    );
    await this.audit.log(user.id, 'assign_permission', 'bucket', name, {
      user_id: body.user_id,
      permissions: permission,
    });
  }

  async defaultForUser(user: AuthUser): Promise<BucketRecord> {
    const configured = await this.database.one<RowDataPacket>(
      'SELECT setting_value FROM settings WHERE setting_group="minio" AND setting_key="default_bucket" LIMIT 1',
    );
    const preferred = String(configured?.setting_value ?? '');
    const superadmin = user.role === 'superadmin';
    if (preferred) {
      const bucket = await this.database.one<RowDataPacket & BucketRecord>(
        superadmin
          ? 'SELECT * FROM buckets WHERE bucket_name=? LIMIT 1'
          : 'SELECT b.* FROM buckets b JOIN bucket_user_permissions p ON p.bucket_id=b.id WHERE b.bucket_name=? AND p.user_id=? AND p.can_view=1 LIMIT 1',
        superadmin ? [preferred] : [preferred, user.id],
      );
      if (bucket) {
        return bucket;
      }
    }
    const bucket = await this.database.one<RowDataPacket & BucketRecord>(
      superadmin
        ? 'SELECT * FROM buckets ORDER BY bucket_name LIMIT 1'
        : 'SELECT b.* FROM buckets b JOIN bucket_user_permissions p ON p.bucket_id=b.id WHERE p.user_id=? AND p.can_view=1 ORDER BY b.bucket_name LIMIT 1',
      superadmin ? [] : [user.id],
    );
    if (!bucket) {
      throw new NotFoundException('Tidak ada bucket yang bisa diakses.');
    }
    return bucket;
  }

  private async syncNames(names: string[]): Promise<void> {
    const now = this.database.now();
    for (const name of names) {
      await this.database.execute(
        'INSERT INTO buckets (bucket_name,display_name,description,created_by,created_at,updated_at) VALUES (?,NULL,NULL,NULL,?,?) ON DUPLICATE KEY UPDATE updated_at=VALUES(updated_at)',
        [name, now, now],
      );
    }
  }
}
