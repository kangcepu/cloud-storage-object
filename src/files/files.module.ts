import { Global, Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { MetadataService } from './metadata.service';

@Global()
@Module({
  controllers: [FilesController],
  providers: [FilesService, MetadataService],
  exports: [FilesService, MetadataService],
})
export class FilesModule {}
