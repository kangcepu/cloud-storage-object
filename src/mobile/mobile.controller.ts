import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilesInterceptor } from '@nestjs/platform-express';
import archiver from 'archiver';
import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import { basename } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { AuthService } from '../auth/auth.service';
import { MobileLoginDto } from '../auth/auth.dto';
import { MobileAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { BucketsService } from '../buckets/buckets.service';
import { PermissionService } from '../buckets/permission.service';
import { DatabaseService } from '../common/database.service';
import { ensureFolderKey, safeObjectKey } from '../common/path.util';
import { FilesService } from '../files/files.service';
import { uploadStorage } from '../files/upload.config';
import { RawPreviewService } from '../raw/raw-preview.service';
import { SettingsService } from '../settings/settings.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import { AuthUser, BucketRecord } from '../types';
import { DownloadZipDto, MobileFolderDto, PrepareRawDto } from './mobile.dto';

@Controller('api')
export class MobileController {
  constructor(
    private readonly auth: AuthService,
    private readonly buckets: BucketsService,
    private readonly permissions: PermissionService,
    private readonly files: FilesService,
    private readonly storage: ObjectStorageService,
    private readonly settings: SettingsService,
    private readonly database: DatabaseService,
    private readonly raw: RawPreviewService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: MobileLoginDto, @Req() request: Request): Promise<Record<string, unknown>> {
    const token = await this.auth.issueMobileToken(
      body.username,
      body.password,
      body.name?.trim() || 'mobile',
      request,
    );
    return { success: true, data: { token } };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() request: Request): Promise<{ success: true }> {
    await this.auth.revokeToken(this.auth.bearerToken(request));
    return { success: true };
  }

  @Get('public/settings')
  async publicSettings(): Promise<Record<string, unknown>> {
    const app = await this.settings.getGroup('app');
    const base = this.config.get<string>('PUBLIC_BASE_URL', '').replace(/\/$/, '');
    return {
      success: true,
      data: {
        site_title: app.title || 'Cloud Storage',
        site_tagline: app.login_title || app.description || '',
        meta_description: app.description || '',
        logo_url: app.logo_path ? `${base}/media/branding/${app.logo_path}` : '',
        favicon_url: app.favicon_path ? `${base}/media/branding/${app.favicon_path}` : '',
      },
    };
  }

  @Get('overview')
  @UseGuards(MobileAuthGuard)
  async overview(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    const bucket = await this.buckets.defaultForUser(user);
    const total = await this.database.one<RowDataPacket & { count: number; bytes: number }>(
      'SELECT COUNT(*) count,COALESCE(SUM(size),0) bytes FROM files_metadata WHERE bucket_id=?',
      [bucket.id],
    );
    const recentRows = await this.database.query<
      RowDataPacket & { object_key: string; size: number; last_modified: string }
    >(
      'SELECT object_key,size,COALESCE(last_modified,created_at) last_modified FROM files_metadata WHERE bucket_id=? ORDER BY created_at DESC LIMIT 10',
      [bucket.id],
    );
    const recent = [];
    for (const row of recentRows) {
      if (row.object_key && !row.object_key.endsWith('/')) {
        recent.push(await this.fileRow(bucket, row.object_key, Number(row.size), row.last_modified));
      }
    }
    return {
      success: true,
      data: {
        bucket: bucket.bucket_name,
        region: (await this.settings.get('minio', 'region', 'us-east-1')) || 'us-east-1',
        count: Number(total?.count ?? 0),
        bytes: Number(total?.bytes ?? 0),
        truncated: false,
        recent,
        expires: 300,
      },
    };
  }

  @Get('drive')
  @UseGuards(MobileAuthGuard)
  async drive(
    @CurrentUser() user: AuthUser,
    @Query('prefix') prefixValue: string | undefined,
    @Query('continuation_token') continuationToken: string | undefined,
  ): Promise<Record<string, unknown>> {
    const bucket = await this.buckets.defaultForUser(user);
    await this.permissions.assert(user.id, bucket.id, user.role === 'superadmin', 'view');
    const prefix = prefixValue ? safeObjectKey(prefixValue) : '';
    const result = await this.storage.listObjects(bucket.bucket_name, prefix, continuationToken);
    const folders = result.prefixes
      .filter((value) => !value.startsWith('__thumbs/') && !value.startsWith('__previews/'))
      .map((value) => ({ name: basename(value.replace(/\/$/, '')) || value, prefix: value }));
    const fileRows = result.objects.filter(
      (object) =>
        object.key !== prefix &&
        !object.key.endsWith('/') &&
        !object.key.startsWith('__thumbs/') &&
        !object.key.startsWith('__previews/'),
    );
    const files = [];
    for (const object of fileRows) {
      files.push(
        await this.fileRow(bucket, object.key, object.size, object.lastModified?.toISOString() || ''),
      );
    }
    return {
      success: true,
      data: {
        prefix,
        folders,
        files,
        expires: 300,
        truncated: result.truncated,
        nextContinuationToken: result.nextContinuationToken,
      },
    };
  }

  @Post('folder')
  @HttpCode(200)
  @UseGuards(MobileAuthGuard)
  async folder(
    @Body() body: MobileFolderDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Record<string, unknown>> {
    const bucket = await this.buckets.defaultForUser(user);
    const key = await this.files.createFolder(bucket.bucket_name, body.prefix ?? '', body.name, user);
    return { success: true, data: { key } };
  }

  @Post('upload')
  @HttpCode(200)
  @UseGuards(MobileAuthGuard)
  @UseInterceptors(FilesInterceptor('files', 500, { storage: uploadStorage() }))
  async upload(
    @Body() body: { prefix?: string; paths?: string | string[] },
    @UploadedFiles() uploaded: Express.Multer.File[],
    @CurrentUser() user: AuthUser,
  ): Promise<Record<string, unknown>> {
    const bucket = await this.buckets.defaultForUser(user);
    const paths = Array.isArray(body.paths) ? body.paths : body.paths ? [body.paths] : [];
    const results = await this.files.upload(
      bucket.bucket_name,
      body.prefix ?? '',
      paths,
      uploaded ?? [],
      user,
    );
    const successful = results.filter((result) => result.ok);
    const failed = results.filter((result) => !result.ok);
    return {
      success: true,
      data: {
        ok: successful.length,
        failed: failed.length,
        keys: successful.map((result) => result.key),
        errors: failed.map((result) => {
          const message = typeof result.message === 'string' ? result.message : '';
          const name = typeof result.name === 'string' ? result.name : '';
          return `${message} (${name})`;
        }),
        prefix: body.prefix ?? '',
      },
    };
  }

  @Post('download-zip')
  @UseGuards(MobileAuthGuard)
  async downloadZip(
    @Body() body: DownloadZipDto,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ): Promise<void> {
    const bucket = await this.buckets.defaultForUser(user);
    await this.permissions.assert(user.id, bucket.id, user.role === 'superadmin', 'download');
    const wanted = new Set<string>();
    for (const value of body.keys ?? []) {
      const key = safeObjectKey(value);
      if (!key.endsWith('/')) wanted.add(key);
    }
    for (const value of body.folders ?? []) {
      const folder = ensureFolderKey(safeObjectKey(value));
      for await (const object of this.storage.iterateObjects(bucket.bucket_name, folder)) {
        if (!object.key.endsWith('/')) wanted.add(object.key);
      }
    }
    if (!wanted.size) {
      throw new BadRequestException('Tidak ada file untuk di-zip.');
    }
    const base = body.base_prefix ? safeObjectKey(body.base_prefix) : '';
    response.setHeader('Content-Type', 'application/zip');
    response.setHeader('Content-Disposition', 'attachment; filename="download.zip"');
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(response);
    for (const key of wanted) {
      const object = await this.storage.objectStream(bucket.bucket_name, key);
      const relative =
        (base && key.startsWith(base) ? key.slice(base.length) : key).replace(/^\/+/, '') || basename(key);
      archive.append(object.stream, { name: relative });
    }
    await archive.finalize();
  }

  @Get('proxy')
  @UseGuards(MobileAuthGuard)
  async proxy(
    @Query('key') keyValue: string,
    @Query('disposition') dispositionValue: string | undefined,
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const bucket = await this.buckets.defaultForUser(user);
    const key = safeObjectKey(keyValue);
    const disposition = dispositionValue === 'attachment' ? 'attachment' : 'inline';
    await this.permissions.assert(
      user.id,
      bucket.id,
      user.role === 'superadmin',
      disposition === 'attachment' ? 'download' : 'view',
    );
    const object = await this.storage.objectStream(bucket.bucket_name, key, request.get('range'));
    response.status(object.contentRange ? 206 : 200);
    response.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${basename(key).replaceAll('"', '')}"`,
    );
    if (object.contentType) response.setHeader('Content-Type', object.contentType);
    if (object.contentLength !== undefined)
      response.setHeader('Content-Length', String(object.contentLength));
    if (object.contentRange) response.setHeader('Content-Range', object.contentRange);
    if (object.acceptRanges) response.setHeader('Accept-Ranges', object.acceptRanges);
    if (object.etag) response.setHeader('ETag', object.etag);
    if (object.lastModified) response.setHeader('Last-Modified', object.lastModified.toUTCString());
    response.setHeader(
      'Cache-Control',
      disposition === 'inline' ? 'private, max-age=300, stale-while-revalidate=60' : 'private, no-store',
    );
    await pipeline(object.stream, response);
  }

  @Post('raw/prepare')
  @HttpCode(200)
  @UseGuards(MobileAuthGuard)
  async prepareRaw(
    @Body() body: PrepareRawDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Record<string, unknown>> {
    const bucket = await this.buckets.defaultForUser(user);
    await this.permissions.assert(user.id, bucket.id, user.role === 'superadmin', 'view');
    const key = safeObjectKey(body.key);
    if (!this.raw.isRaw(key)) {
      throw new BadRequestException('Not a RAW file.');
    }
    await Promise.all([
      this.raw.ensureThumb(bucket.bucket_name, key),
      this.raw.ensurePreview(bucket.bucket_name, key),
    ]);
    return { success: true, data: await this.fileRow(bucket, key, 0, new Date().toISOString()) };
  }

  private async fileRow(
    bucket: BucketRecord,
    key: string,
    size: number,
    lastModified: string,
  ): Promise<Record<string, unknown>> {
    let thumbKey = key;
    let previewKey = key;
    if (this.raw.isRaw(key)) {
      const thumb = this.raw.thumbKey(key);
      const preview = this.raw.previewKey(key);
      thumbKey = (await this.storage.statObject(bucket.bucket_name, thumb)).exists ? thumb : '';
      previewKey = (await this.storage.statObject(bucket.bucket_name, preview)).exists ? preview : '';
    }
    return {
      key,
      name: basename(key) || key,
      size,
      lastModified: lastModified || new Date().toISOString(),
      thumbUrl: thumbKey
        ? await this.files.deliveryUrl(bucket.bucket_name, thumbKey, 'inline', '/api/proxy')
        : '',
      previewUrl: previewKey
        ? await this.files.deliveryUrl(bucket.bucket_name, previewKey, 'inline', '/api/proxy')
        : '',
      downloadUrl: await this.files.deliveryUrl(bucket.bucket_name, key, 'attachment', '/api/proxy'),
    };
  }
}
