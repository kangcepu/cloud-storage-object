import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { basename } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { CurrentUser } from '../auth/current-user.decorator';
import { CsrfGuard, SessionAuthGuard } from '../auth/auth.guard';
import { safeObjectKey } from '../common/path.util';
import { ObjectStorageService } from '../storage/object-storage.service';
import { AuthUser } from '../types';
import { CreateFolderDto, DeleteObjectDto, ObjectTransferDto, ProxyQueryDto } from './files.dto';
import { FilesService } from './files.service';
import { uploadStorage } from './upload.config';

@Controller('api/buckets/:bucket')
@UseGuards(SessionAuthGuard)
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly storage: ObjectStorageService,
  ) {}

  @Get('files')
  async list(
    @Param('bucket') bucket: string,
    @Query('prefix') prefix: string | undefined,
    @Query('continuation_token') continuationToken: string | undefined,
    @Query('max_keys') maxKeys: string | undefined,
    @CurrentUser() user: AuthUser,
  ): Promise<Record<string, unknown>> {
    return {
      ok: true,
      ...(await this.files.list(bucket, prefix ?? '', continuationToken, Number(maxKeys || 1000), user)),
    };
  }

  @Post('folders')
  @UseGuards(CsrfGuard)
  async createFolder(
    @Param('bucket') bucket: string,
    @Body() body: CreateFolderDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Record<string, unknown>> {
    return { ok: true, key: await this.files.createFolder(bucket, body.parent ?? '', body.name, user) };
  }

  @Post('upload')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  @UseInterceptors(FilesInterceptor('files', 500, { storage: uploadStorage() }))
  async upload(
    @Param('bucket') bucket: string,
    @Body() body: { prefix?: string; paths?: string | string[] },
    @UploadedFiles() uploaded: Express.Multer.File[],
    @CurrentUser() user: AuthUser,
  ): Promise<Record<string, unknown>> {
    const paths = Array.isArray(body.paths) ? body.paths : body.paths ? [body.paths] : [];
    return {
      ok: true,
      results: await this.files.upload(bucket, body.prefix ?? '', paths, uploaded ?? [], user),
    };
  }

  @Put('files/rename')
  @UseGuards(CsrfGuard)
  async rename(
    @Param('bucket') bucket: string,
    @Body() body: ObjectTransferDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ ok: true }> {
    await this.files.rename(bucket, body.from, body.to, user);
    return { ok: true };
  }

  @Delete('files/delete')
  @UseGuards(CsrfGuard)
  async remove(
    @Param('bucket') bucket: string,
    @Body() body: DeleteObjectDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ ok: true }> {
    await this.files.remove(bucket, body.key, user);
    return { ok: true };
  }

  @Post('files/copy')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  async copy(
    @Param('bucket') bucket: string,
    @Body() body: ObjectTransferDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ ok: true }> {
    await this.files.copy(bucket, body.from, body.to, user);
    return { ok: true };
  }

  @Post('files/move')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  async move(
    @Param('bucket') bucket: string,
    @Body() body: ObjectTransferDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ ok: true }> {
    await this.files.move(bucket, body.from, body.to, user);
    return { ok: true };
  }

  @Get('files/preview')
  async preview(
    @Param('bucket') bucket: string,
    @Query('key') key: string,
    @Query('thumb') thumb: string | undefined,
    @CurrentUser() user: AuthUser,
  ): Promise<Record<string, unknown>> {
    return { ok: true, url: await this.files.previewUrl(bucket, key, thumb === '1', user) };
  }

  @Get('files/download')
  async download(
    @Param('bucket') bucket: string,
    @Query('key') key: string,
    @CurrentUser() user: AuthUser,
  ): Promise<Record<string, unknown>> {
    return { ok: true, url: await this.files.downloadUrl(bucket, key, user) };
  }

  @Get('files/proxy')
  async proxy(
    @Param('bucket') bucket: string,
    @Query() query: ProxyQueryDto,
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const key = safeObjectKey(query.key);
    const disposition = query.disposition ?? 'inline';
    await this.files.authorize(bucket, user, disposition === 'attachment' ? 'download' : 'view');
    const object = await this.storage.objectStream(bucket, key, request.get('range'));
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
}
