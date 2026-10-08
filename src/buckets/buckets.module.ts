import { Global, Module } from '@nestjs/common';
import { BucketsController } from './buckets.controller';
import { BucketsService } from './buckets.service';
import { PermissionService } from './permission.service';

@Global()
@Module({
  controllers: [BucketsController],
  providers: [BucketsService, PermissionService],
  exports: [BucketsService, PermissionService],
})
export class BucketsModule {}
