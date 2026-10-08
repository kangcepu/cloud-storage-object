import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuditService } from '../audit/audit.service';
import { CsrfGuard, SessionAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DatabaseService } from '../common/database.service';
import { uploadStorage } from '../files/upload.config';
import { AuthUser } from '../types';
import { MediaService } from './media.service';

@Controller('api/profile')
export class ProfileController {
  constructor(
    private readonly media: MediaService,
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  @Post('avatar')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @UseInterceptors(FileInterceptor('avatar', { storage: uploadStorage() }))
  async avatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ): Promise<{ ok: true; avatar_path: string }> {
    if (!file) {
      throw new BadRequestException('No file.');
    }
    const stored = await this.media.store(file, 'avatars', {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
    });
    await this.database.execute('UPDATE users SET avatar_path=?,updated_at=? WHERE id=?', [
      stored.path,
      this.database.now(),
      user.id,
    ]);
    if (user.avatar_path && user.avatar_path !== stored.path) {
      await this.media.remove('avatars', user.avatar_path);
    }
    await this.audit.log(user.id, 'update_profile', 'user', String(user.id), { avatar: true });
    return { ok: true, avatar_path: stored.path };
  }
}
