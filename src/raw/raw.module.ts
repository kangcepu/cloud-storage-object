import { Global, Module } from '@nestjs/common';
import { RawPreviewService } from './raw-preview.service';

@Global()
@Module({
  providers: [RawPreviewService],
  exports: [RawPreviewService],
})
export class RawModule {}
