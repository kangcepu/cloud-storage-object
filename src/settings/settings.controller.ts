import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuditService } from '../audit/audit.service';
import { CsrfGuard, SessionAuthGuard, SuperadminGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DatabaseService } from '../common/database.service';
import { uploadStorage } from '../files/upload.config';
import { MediaService } from '../media/media.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import { AuthUser } from '../types';
import { UpdateAppSettingsDto, UpdateMinioSettingsDto } from './settings.dto';
import { SettingsService } from './settings.service';

@Controller('api/settings')
@UseGuards(SessionAuthGuard, SuperadminGuard)
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly storage: ObjectStorageService,
    private readonly media: MediaService,
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async all(): Promise<Record<string, unknown>> {
    const minio = await this.settings.getGroup('minio');
    return {
      ok: true,
      app: await this.settings.getGroup('app'),
      security: await this.settings.getGroup('security'),
      minio_configured: await this.settings.hasMinioConfig(),
      minio: {
        endpoint: minio.endpoint ?? '',
        public_endpoint: minio.public_endpoint ?? '',
        access_key: minio.access_key ?? '',
        region: minio.region ?? 'us-east-1',
        use_ssl: minio.use_ssl ?? '0',
        path_style_endpoint: minio.path_style_endpoint ?? '1',
        delivery_mode: minio.delivery_mode ?? 'proxy',
        default_bucket: minio.default_bucket ?? '',
        last_test_at: minio.last_test_at ?? null,
        last_test_ok: minio.last_test_ok ?? null,
        last_test_message: minio.last_test_message ?? null,
        secret_key_configured: Boolean(minio.secret_key),
      },
    };
  }

  @Put('app')
  @UseGuards(CsrfGuard)
  async updateApp(@Body() body: UpdateAppSettingsDto, @CurrentUser() user: AuthUser): Promise<{ ok: true }> {
    await Promise.all([
      this.settings.set('app', 'title', body.title.trim()),
      this.settings.set('app', 'description', body.description?.trim() || ''),
      this.settings.set('app', 'login_title', body.login_title?.trim() || 'Sign in'),
      this.settings.set('app', 'footer_text', body.footer_text?.trim() || ''),
    ]);
    await this.audit.log(user.id, 'update_setting', 'settings', 'app');
    return { ok: true };
  }

  @Put('minio')
  @UseGuards(CsrfGuard)
  async updateMinio(
    @Body() body: UpdateMinioSettingsDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ ok: true }> {
    const useSsl = Boolean(body.use_ssl);
    const endpoint = this.endpoint(body.endpoint, useSsl);
    const publicEndpoint = body.public_endpoint ? this.endpoint(body.public_endpoint, useSsl) : '';
    const secret = body.secret_key?.trim() || (await this.settings.get('minio', 'secret_key', '')) || '';
    if (!endpoint || !body.access_key.trim() || !secret) {
      throw new BadRequestException('Endpoint/access key/secret key wajib.');
    }
    const mode = body.delivery_mode ?? 'proxy';
    if (mode === 'direct') {
      const host = new URL(publicEndpoint || endpoint).hostname.toLowerCase();
      if (['localhost', '127.0.0.1', '0.0.0.0'].includes(host)) {
        throw new BadRequestException('Public endpoint tidak boleh localhost/127.0.0.1.');
      }
    }
    await Promise.all([
      this.settings.set('minio', 'endpoint', endpoint, true),
      this.settings.set('minio', 'public_endpoint', publicEndpoint || null, true),
      this.settings.set('minio', 'access_key', body.access_key.trim(), true),
      this.settings.set('minio', 'secret_key', secret, true),
      this.settings.set('minio', 'region', body.region?.trim() || 'us-east-1', true),
      this.settings.set('minio', 'use_ssl', useSsl ? '1' : '0'),
      this.settings.set('minio', 'path_style_endpoint', body.path_style_endpoint === false ? '0' : '1'),
      this.settings.set('minio', 'delivery_mode', mode),
      this.settings.set('minio', 'default_bucket', body.default_bucket?.trim() || null),
    ]);
    await this.audit.log(user.id, 'update_setting', 'settings', 'minio');
    return { ok: true };
  }

  @Post('minio/test')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  async test(): Promise<Record<string, unknown>> {
    try {
      const result = await this.storage.testConnection();
      await Promise.all([
        this.settings.set('minio', 'last_test_at', this.database.now()),
        this.settings.set('minio', 'last_test_ok', '1'),
        this.settings.set('minio', 'last_test_message', 'OK'),
      ]);
      const now = this.database.now();
      for (const bucket of result.buckets) {
        if (bucket.Name) {
          await this.database.execute(
            'INSERT INTO buckets (bucket_name,display_name,description,created_by,created_at,updated_at) VALUES (?,NULL,NULL,NULL,?,?) ON DUPLICATE KEY UPDATE updated_at=VALUES(updated_at)',
            [bucket.Name, now, now],
          );
        }
      }
      return { ok: true, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await Promise.all([
        this.settings.set('minio', 'last_test_at', this.database.now()),
        this.settings.set('minio', 'last_test_ok', '0'),
        this.settings.set('minio', 'last_test_message', message),
      ]);
      throw error;
    }
  }

  @Post('app/logo')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  @UseInterceptors(FileInterceptor('logo', { storage: uploadStorage() }))
  async logo(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ): Promise<Record<string, unknown>> {
    return this.branding(file, 'logo', user);
  }

  @Post('app/favicon')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  @UseInterceptors(FileInterceptor('favicon', { storage: uploadStorage() }))
  async favicon(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ): Promise<Record<string, unknown>> {
    return this.branding(file, 'favicon', user);
  }

  private async branding(
    file: Express.Multer.File,
    type: 'logo' | 'favicon',
    user: AuthUser,
  ): Promise<Record<string, unknown>> {
    if (!file) {
      throw new BadRequestException('No file.');
    }
    const allowed: Record<string, string> =
      type === 'favicon'
        ? { ico: 'image/x-icon', png: 'image/png', svg: 'image/svg+xml' }
        : {
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            svg: 'image/svg+xml',
            webp: 'image/webp',
          };
    const old = await this.settings.get('app', `${type}_path`, '');
    const stored = await this.media.store(file, 'branding', allowed);
    await Promise.all([
      this.settings.set('app', `${type}_path`, stored.path),
      this.settings.set('app', `${type}_mime`, stored.mime),
    ]);
    if (old && old !== stored.path) {
      await this.media.remove('branding', old);
    }
    await this.audit.log(user.id, 'update_setting', 'settings', `app_${type}`);
    return { ok: true, path: stored.path };
  }

  private endpoint(value: string, useSsl: boolean): string {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const withScheme = /^https?:\/\//.test(trimmed) ? trimmed : `${useSsl ? 'https' : 'http'}://${trimmed}`;
    if (useSsl && withScheme.startsWith('http://')) return `https://${withScheme.slice(7)}`;
    if (!useSsl && withScheme.startsWith('https://')) return `http://${withScheme.slice(8)}`;
    return withScheme;
  }
}
