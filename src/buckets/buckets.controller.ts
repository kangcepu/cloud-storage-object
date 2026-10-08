import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { CsrfGuard, SessionAuthGuard, SuperadminGuard } from '../auth/auth.guard';
import { AuthUser } from '../types';
import { AssignBucketDto, CreateBucketDto, DeleteBucketDto, UpdateBucketDto } from './buckets.dto';
import { BucketsService } from './buckets.service';

@Controller('api/buckets')
@UseGuards(SessionAuthGuard)
export class BucketsController {
  constructor(private readonly buckets: BucketsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    const result = await this.buckets.list(user);
    return {
      ok: true,
      data: result.data,
      is_superadmin: user.role === 'superadmin',
      minio_list_error: result.minioError,
    };
  }

  @Post()
  @UseGuards(SuperadminGuard, CsrfGuard)
  async create(
    @Body() body: CreateBucketDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Record<string, unknown>> {
    return { ok: true, bucket: await this.buckets.create(body, user) };
  }

  @Get(':bucket')
  async details(
    @Param('bucket') bucket: string,
    @CurrentUser() user: AuthUser,
  ): Promise<Record<string, unknown>> {
    return { ok: true, ...(await this.buckets.details(bucket, user)) };
  }

  @Put(':bucket')
  @UseGuards(SuperadminGuard, CsrfGuard)
  async update(
    @Param('bucket') bucket: string,
    @Body() body: UpdateBucketDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ ok: true }> {
    await this.buckets.update(bucket, body, user);
    return { ok: true };
  }

  @Delete(':bucket')
  @UseGuards(SuperadminGuard, CsrfGuard)
  async remove(
    @Param('bucket') bucket: string,
    @Body() body: DeleteBucketDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ ok: true }> {
    await this.buckets.remove(bucket, body.confirm, user);
    return { ok: true };
  }

  @Post(':bucket/assign-user')
  @UseGuards(SuperadminGuard, CsrfGuard)
  async assign(
    @Param('bucket') bucket: string,
    @Body() body: AssignBucketDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ ok: true }> {
    await this.buckets.assign(bucket, body, user);
    return { ok: true };
  }
}
