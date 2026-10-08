import { Global, Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { ProfileController } from './profile.controller';

@Global()
@Module({
  controllers: [MediaController, ProfileController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
