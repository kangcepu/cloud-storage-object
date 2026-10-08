import { ForbiddenException, Injectable } from '@nestjs/common';
import { RowDataPacket } from 'mysql2';
import { DatabaseService } from '../common/database.service';
import { BucketPermission } from '../types';

interface PermissionRow extends RowDataPacket {
  can_view: number;
  can_upload: number;
  can_rename: number;
  can_delete: number;
  can_download: number;
}

@Injectable()
export class PermissionService {
  constructor(private readonly database: DatabaseService) {}

  async permissions(userId: number, bucketId: number, superadmin: boolean): Promise<BucketPermission> {
    if (superadmin) {
      return { view: true, upload: true, rename: true, delete: true, download: true };
    }
    const row = await this.database.one<PermissionRow>(
      'SELECT can_view,can_upload,can_rename,can_delete,can_download FROM bucket_user_permissions WHERE user_id=? AND bucket_id=? LIMIT 1',
      [userId, bucketId],
    );
    return {
      view: row?.can_view === 1,
      upload: row?.can_upload === 1,
      rename: row?.can_rename === 1,
      delete: row?.can_delete === 1,
      download: row?.can_download === 1,
    };
  }

  async assert(
    userId: number,
    bucketId: number,
    superadmin: boolean,
    permission: keyof BucketPermission,
  ): Promise<void> {
    const permissions = await this.permissions(userId, bucketId, superadmin);
    if (!permissions[permission]) {
      throw new ForbiddenException('Forbidden.');
    }
  }
}
