import { BadRequestException, Injectable } from '@nestjs/common';
import { createReadStream, promises as fs } from 'node:fs';
import { extname } from 'node:path';
import { lookup } from 'mime-types';
import { AuditService } from '../audit/audit.service';
import { BucketsService } from '../buckets/buckets.service';
import { PermissionService } from '../buckets/permission.service';
import { ensureFolderKey, safeObjectKey, sanitizeClientPath } from '../common/path.util';
import { RawPreviewService } from '../raw/raw-preview.service';
import { SettingsService } from '../settings/settings.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import { AuthUser, BucketPermission, BucketRecord } from '../types';
import { MetadataService } from './metadata.service';

@Injectable()
export class FilesService {
  constructor(
    private readonly buckets: BucketsService,
    private readonly permissions: PermissionService,
    private readonly storage: ObjectStorageService,
    private readonly metadata: MetadataService,
    private readonly settings: SettingsService,
    private readonly raw: RawPreviewService,
    private readonly audit: AuditService,
  ) {}

  async list(
    bucketName: string,
    prefixValue: string,
    continuationToken: string | undefined,
    maxKeys: number,
    user: AuthUser,
  ): Promise<Record<string, unknown>> {
    const bucket = await this.authorize(bucketName, user, 'view');
    const prefix = prefixValue ? safeObjectKey(prefixValue) : '';
    const result = await this.storage.listObjects(bucketName, prefix, continuationToken, maxKeys);
    const folders = result.prefixes
      .filter((value) => !this.derived(value))
      .map((value) => ({ prefix: value }));
    const files = result.objects
      .filter((object) => object.key !== prefix && !this.derived(object.key))
      .map((object) => ({
        key: object.key,
        size: object.size,
        last_modified: object.lastModified?.toISOString() ?? null,
      }));
    return {
      prefix,
      folders,
      files,
      permissions: await this.permissions.permissions(user.id, bucket.id, user.role === 'superadmin'),
      is_truncated: result.truncated,
      next_continuation_token: result.nextContinuationToken,
    };
  }

  async createFolder(
    bucketName: string,
    parentValue: string,
    nameValue: string,
    user: AuthUser,
  ): Promise<string> {
    await this.authorize(bucketName, user, 'upload');
    const parent = parentValue ? safeObjectKey(parentValue) : '';
    const name = nameValue.trim();
    if (!name || name.includes('/') || name.includes('\\')) {
      throw new BadRequestException('Nama folder tidak valid.');
    }
    const key = `${parent ? `${parent.replace(/\/$/, '')}/` : ''}${name}/`;
    await this.storage.putObject(bucketName, key, '');
    await this.audit.log(user.id, 'create_folder', 'object', `${bucketName}:${key}`);
    return key;
  }

  async upload(
    bucketName: string,
    prefixValue: string,
    paths: string[],
    files: Express.Multer.File[],
    user: AuthUser,
  ): Promise<Array<Record<string, unknown>>> {
    const bucket = await this.authorize(bucketName, user, 'upload');
    const prefix = prefixValue ? safeObjectKey(prefixValue) : '';
    const results: Array<Record<string, unknown>> = [];
    for (const [index, file] of files.entries()) {
      const clientPath = paths[index] || file.originalname;
      try {
        const relative = sanitizeClientPath(clientPath);
        const key = safeObjectKey(`${prefix ? `${prefix.replace(/\/$/, '')}/` : ''}${relative}`);
        const stat = await this.storage.statObject(bucketName, key);
        if (!stat.exists || stat.size !== file.size) {
          await this.storage.putObject(
            bucketName,
            key,
            createReadStream(file.path),
            file.mimetype || String(lookup(relative) || 'application/octet-stream'),
            file.size,
          );
        }
        await this.metadata.upsert({
          bucket_id: bucket.id,
          object_key: key,
          original_name: clientPath,
          mime_type: file.mimetype || String(lookup(relative) || ''),
          size: file.size,
          extension: extname(relative).slice(1) || null,
          uploaded_by: user.id,
          last_modified: new Date().toISOString().slice(0, 19).replace('T', ' '),
        });
        if (!stat.exists || stat.size !== file.size) {
          await this.audit.log(user.id, 'upload_file', 'object', `${bucketName}:${key}`, { size: file.size });
        }
        results.push({ name: clientPath, ok: true, key, skipped: stat.exists && stat.size === file.size });
      } catch (error) {
        results.push({
          name: clientPath,
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        await fs.rm(file.path, { force: true });
      }
    }
    return results;
  }

  async rename(bucketName: string, fromValue: string, toValue: string, user: AuthUser): Promise<void> {
    const bucket = await this.authorize(bucketName, user, 'rename');
    const source = safeObjectKey(fromValue);
    const destination = safeObjectKey(toValue);
    this.assertDistinct(source, destination);
    if (source.endsWith('/')) {
      await this.moveFolder(bucketName, source, ensureFolderKey(destination));
      await this.metadata.movePrefix(bucket.id, source, ensureFolderKey(destination));
    } else {
      await this.storage.moveObject(bucketName, source, destination);
      await this.metadata.rename(bucket.id, source, destination);
    }
    await this.audit.log(user.id, 'rename_object', 'object', `${bucketName}:${source}`, { to: destination });
  }

  async remove(bucketName: string, keyValue: string, user: AuthUser): Promise<void> {
    const bucket = await this.authorize(bucketName, user, 'delete');
    const key = safeObjectKey(keyValue);
    if (key.endsWith('/')) {
      for await (const object of this.storage.iterateObjects(bucketName, key)) {
        await this.storage.deleteObject(bucketName, object.key);
      }
      await this.storage.deleteObject(bucketName, key).catch(() => undefined);
      await this.metadata.delete(bucket.id, key, true);
    } else {
      await this.storage.deleteObject(bucketName, key);
      await this.metadata.delete(bucket.id, key, false);
    }
    await this.audit.log(user.id, 'delete_file', 'object', `${bucketName}:${key}`);
  }

  async copy(bucketName: string, fromValue: string, toValue: string, user: AuthUser): Promise<void> {
    const bucket = await this.authorize(bucketName, user, 'upload');
    const source = safeObjectKey(fromValue);
    const destination = safeObjectKey(toValue);
    this.assertDistinct(source, destination);
    if (source.endsWith('/')) {
      const target = ensureFolderKey(destination);
      await this.copyFolder(bucketName, source, target);
      await this.metadata.copyPrefix(bucket.id, source, target, user.id);
    } else {
      await this.storage.copyObject(bucketName, source, destination);
      await this.metadata.copy(bucket.id, source, destination, user.id);
    }
    await this.audit.log(user.id, 'copy_object', 'object', `${bucketName}:${source}`, { to: destination });
  }

  async move(bucketName: string, fromValue: string, toValue: string, user: AuthUser): Promise<void> {
    const bucket = await this.authorize(bucketName, user, 'rename');
    const source = safeObjectKey(fromValue);
    const destination = safeObjectKey(toValue);
    this.assertDistinct(source, destination);
    if (source.endsWith('/')) {
      const target = ensureFolderKey(destination);
      await this.moveFolder(bucketName, source, target);
      await this.metadata.movePrefix(bucket.id, source, target);
    } else {
      await this.storage.moveObject(bucketName, source, destination);
      await this.metadata.rename(bucket.id, source, destination);
    }
    await this.audit.log(user.id, 'move_object', 'object', `${bucketName}:${source}`, { to: destination });
  }

  async previewUrl(bucketName: string, keyValue: string, thumb: boolean, user: AuthUser): Promise<string> {
    await this.authorize(bucketName, user, 'view');
    const key = safeObjectKey(keyValue);
    const raw = this.raw.isRaw(key);
    const raster = this.raw.isRaster(key);
    const source = raster && !thumb ? await this.storage.statObject(bucketName, key) : null;
    const optimize = raw || (raster && (thumb || Number(source?.size ?? 0) > 2 * 1024 * 1024));
    const target = optimize
      ? thumb
        ? await this.raw.ensureThumb(bucketName, key)
        : await this.raw.ensurePreview(bucketName, key)
      : key;
    return this.deliveryUrl(
      bucketName,
      target,
      'inline',
      `/api/buckets/${encodeURIComponent(bucketName)}/files/proxy`,
    );
  }

  async downloadUrl(bucketName: string, keyValue: string, user: AuthUser): Promise<string> {
    await this.authorize(bucketName, user, 'download');
    const key = safeObjectKey(keyValue);
    return this.deliveryUrl(
      bucketName,
      key,
      'attachment',
      `/api/buckets/${encodeURIComponent(bucketName)}/files/proxy`,
    );
  }

  async authorize(
    bucketName: string,
    user: AuthUser,
    permission: keyof BucketPermission,
  ): Promise<BucketRecord> {
    const bucket = await this.buckets.bucket(bucketName);
    await this.permissions.assert(user.id, bucket.id, user.role === 'superadmin', permission);
    return bucket;
  }

  async deliveryUrl(
    bucket: string,
    key: string,
    disposition: 'inline' | 'attachment',
    proxyPath: string,
  ): Promise<string> {
    const mode = await this.settings.get('minio', 'delivery_mode', 'proxy');
    const publicEndpoint = await this.settings.get('minio', 'public_endpoint', '');
    if (mode === 'direct' && publicEndpoint) {
      return this.storage.signedUrl(bucket, key, 300, disposition);
    }
    return `${proxyPath}?key=${encodeURIComponent(key)}&disposition=${disposition}`;
  }

  private async copyFolder(bucket: string, source: string, destination: string): Promise<void> {
    for await (const object of this.storage.iterateObjects(bucket, source)) {
      await this.storage.copyObject(bucket, object.key, `${destination}${object.key.slice(source.length)}`);
    }
    await this.storage.putObject(bucket, destination, '');
  }

  private async moveFolder(bucket: string, source: string, destination: string): Promise<void> {
    await this.copyFolder(bucket, source, destination);
    for await (const object of this.storage.iterateObjects(bucket, source)) {
      await this.storage.deleteObject(bucket, object.key);
    }
    await this.storage.deleteObject(bucket, source).catch(() => undefined);
  }

  private derived(key: string): boolean {
    return key.startsWith('__thumbs/') || key.startsWith('__previews/');
  }

  private assertDistinct(source: string, destination: string): void {
    if (source === destination || (source.endsWith('/') && destination.startsWith(source))) {
      throw new BadRequestException('Tujuan object tidak valid.');
    }
  }
}
