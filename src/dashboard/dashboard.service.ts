import { Injectable } from '@nestjs/common';
import { RowDataPacket } from 'mysql2';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../common/database.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import { AuthUser } from '../types';

interface DashboardBucket extends RowDataPacket {
  id?: number;
  bucket_name: string;
  display_name: string | null;
}

interface Aggregate {
  total_files: number;
  total_size: number;
  storage_per_bucket: Array<Record<string, unknown>>;
  recent_uploads: Array<Record<string, unknown>>;
  type_counts: Record<string, number>;
  type_sizes: Record<string, number>;
}

@Injectable()
export class DashboardService {
  private readonly cache = new Map<string, { expires: number; value: Aggregate }>();

  constructor(
    private readonly database: DatabaseService,
    private readonly storage: ObjectStorageService,
  ) {}

  async summary(user: AuthUser): Promise<Record<string, unknown>> {
    const superadmin = user.role === 'superadmin';
    let buckets: DashboardBucket[] = [];
    let minioError: string | null = null;
    if (superadmin) {
      try {
        const names = (await this.storage.listBuckets()).flatMap((bucket) =>
          bucket.Name ? [bucket.Name] : [],
        );
        if (names.length) {
          const rows = await this.database.query<DashboardBucket>(
            `SELECT bucket_name,display_name FROM buckets WHERE bucket_name IN (${names.map(() => '?').join(',')})`,
            names,
          );
          const namesToDisplay = new Map(rows.map((row) => [row.bucket_name, row.display_name]));
          buckets = names.map(
            (name) =>
              ({ bucket_name: name, display_name: namesToDisplay.get(name) ?? null }) as DashboardBucket,
          );
        }
      } catch (error) {
        minioError = error instanceof Error ? error.message : String(error);
      }
      if (!buckets.length) {
        buckets = await this.database.query<DashboardBucket>(
          'SELECT id,bucket_name,display_name FROM buckets ORDER BY id DESC',
        );
      }
    } else {
      buckets = await this.database.query<DashboardBucket>(
        'SELECT b.id,b.bucket_name,b.display_name FROM buckets b JOIN bucket_user_permissions p ON p.bucket_id=b.id WHERE p.user_id=? AND p.can_view=1',
        [user.id],
      );
    }
    const cacheKey = `${superadmin ? 'admin' : 'scoped'}:${createHash('sha1')
      .update(buckets.map((item) => item.bucket_name).join(','))
      .digest('hex')}`;
    let aggregate = this.readCache(cacheKey);
    if (!aggregate) {
      try {
        aggregate = await this.aggregateMinio(buckets);
        this.cache.set(cacheKey, { expires: Date.now() + 60_000, value: aggregate });
      } catch (error) {
        minioError = minioError || (error instanceof Error ? error.message : String(error));
        aggregate = await this.aggregateDatabase(buckets);
      }
    }
    const userCountRow = superadmin
      ? await this.database.one<RowDataPacket & { count: number }>('SELECT COUNT(*) count FROM users')
      : null;
    return {
      bucket_count: buckets.length,
      total_files: aggregate.total_files,
      total_size: aggregate.total_size,
      user_count: userCountRow?.count ?? null,
      recent_uploads: aggregate.recent_uploads,
      storage_per_bucket: aggregate.storage_per_bucket,
      type_counts: aggregate.type_counts,
      type_sizes: aggregate.type_sizes,
      minio_error: minioError,
    };
  }

  private async aggregateMinio(buckets: DashboardBucket[]): Promise<Aggregate> {
    const typeCounts = this.emptyTypes();
    const typeSizes = this.emptyTypes();
    const scanned = await Promise.all(
      buckets.map(async (bucket) => {
        const recent: Array<Record<string, unknown> & { timestamp: number }> = [];
        const counts = this.emptyTypes();
        const sizes = this.emptyTypes();
        let files = 0;
        let bytes = 0;
        for await (const object of this.storage.iterateObjects(bucket.bucket_name, '')) {
          if (
            object.key.endsWith('/') ||
            object.key.startsWith('__thumbs/') ||
            object.key.startsWith('__previews/')
          ) {
            continue;
          }
          files += 1;
          bytes += object.size;
          const type = this.classify(object.key);
          counts[type] += 1;
          sizes[type] += object.size;
          recent.push({
            timestamp: object.lastModified?.getTime() ?? 0,
            bucket_name: bucket.bucket_name,
            object_key: object.key,
            size: object.size,
            mime_type: null,
            created_at: object.lastModified?.toISOString() ?? null,
            uploaded_by_name: null,
          });
          recent.sort((left, right) => right.timestamp - left.timestamp);
          if (recent.length > 10) recent.pop();
        }
        return { bucket, files, bytes, recent, counts, sizes };
      }),
    );
    const recent: Array<Record<string, unknown> & { timestamp: number }> = [];
    const perBucket: Array<Record<string, unknown>> = [];
    let totalFiles = 0;
    let totalSize = 0;
    for (const result of scanned) {
      totalFiles += result.files;
      totalSize += result.bytes;
      perBucket.push({
        bucket_name: result.bucket.bucket_name,
        display_name: result.bucket.display_name,
        total_files: result.files,
        total_size: result.bytes,
      });
      for (const type of Object.keys(typeCounts)) {
        typeCounts[type] += result.counts[type];
        typeSizes[type] += result.sizes[type];
      }
      recent.push(...result.recent);
    }
    recent.sort((left, right) => right.timestamp - left.timestamp);
    recent.splice(10);
    perBucket.sort((left, right) => Number(right.total_size) - Number(left.total_size));
    return {
      total_files: totalFiles,
      total_size: totalSize,
      storage_per_bucket: perBucket.slice(0, 10),
      recent_uploads: recent.map((entry) => {
        const item: Record<string, unknown> = { ...entry };
        delete item.timestamp;
        return item;
      }),
      type_counts: typeCounts,
      type_sizes: typeSizes,
    };
  }

  private async aggregateDatabase(buckets: DashboardBucket[]): Promise<Aggregate> {
    const ids = buckets.flatMap((bucket) => (bucket.id ? [bucket.id] : []));
    if (!ids.length) {
      return {
        total_files: 0,
        total_size: 0,
        storage_per_bucket: [],
        recent_uploads: [],
        type_counts: this.emptyTypes(),
        type_sizes: this.emptyTypes(),
      };
    }
    const placeholders = ids.map(() => '?').join(',');
    const total = await this.database.one<RowDataPacket & { total_files: number; total_size: number }>(
      `SELECT COUNT(*) total_files,COALESCE(SUM(size),0) total_size FROM files_metadata WHERE bucket_id IN (${placeholders})`,
      ids,
    );
    const perBucket = await this.database.query<RowDataPacket>(
      `SELECT b.bucket_name,b.display_name,COUNT(f.id) total_files,COALESCE(SUM(f.size),0) total_size FROM buckets b LEFT JOIN files_metadata f ON f.bucket_id=b.id WHERE b.id IN (${placeholders}) GROUP BY b.id ORDER BY total_size DESC LIMIT 10`,
      ids,
    );
    const recent = await this.database.query<RowDataPacket>(
      `SELECT f.object_key,f.size,f.mime_type,f.created_at,b.bucket_name,u.name uploaded_by_name FROM files_metadata f JOIN buckets b ON b.id=f.bucket_id LEFT JOIN users u ON u.id=f.uploaded_by WHERE f.bucket_id IN (${placeholders}) ORDER BY f.created_at DESC LIMIT 10`,
      ids,
    );
    const rows = await this.database.query<RowDataPacket & { object_key: string; size: number }>(
      `SELECT object_key,size FROM files_metadata WHERE bucket_id IN (${placeholders})`,
      ids,
    );
    const typeCounts = this.emptyTypes();
    const typeSizes = this.emptyTypes();
    for (const row of rows) {
      const type = this.classify(row.object_key);
      typeCounts[type] += 1;
      typeSizes[type] += Number(row.size);
    }
    return {
      total_files: Number(total?.total_files ?? 0),
      total_size: Number(total?.total_size ?? 0),
      storage_per_bucket: perBucket,
      recent_uploads: recent,
      type_counts: typeCounts,
      type_sizes: typeSizes,
    };
  }

  private readCache(key: string): Aggregate | null {
    const entry = this.cache.get(key);
    if (!entry || entry.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  private classify(name: string): string {
    const extension = name.split('.').pop()?.toLowerCase() ?? '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(extension)) return 'image';
    if (['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(extension)) return 'video';
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(extension)) return 'audio';
    if (extension === 'pdf') return 'pdf';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) return 'archive';
    if (
      [
        'doc',
        'docx',
        'ppt',
        'pptx',
        'xls',
        'xlsx',
        'txt',
        'md',
        'csv',
        'json',
        'xml',
        'html',
        'css',
        'js',
        'php',
        'sql',
        'log',
      ].includes(extension)
    )
      return 'document';
    return 'other';
  }

  private emptyTypes(): Record<string, number> {
    return { image: 0, video: 0, audio: 0, pdf: 0, document: 0, archive: 0, other: 0 };
  }
}
