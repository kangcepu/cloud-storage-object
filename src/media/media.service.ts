import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { extname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { StoragePathService } from '../common/storage-path.service';

@Injectable()
export class MediaService {
  constructor(private readonly paths: StoragePathService) {}

  async store(
    file: Express.Multer.File,
    category: 'branding' | 'avatars',
    allowed: Record<string, string>,
  ): Promise<{ path: string; mime: string }> {
    const extension = extname(file.originalname).slice(1).toLowerCase();
    const expected = allowed[extension];
    if (!expected) {
      await fs.rm(file.path, { force: true });
      throw new BadRequestException('File type tidak didukung.');
    }
    if (file.mimetype && file.mimetype !== expected && !file.mimetype.startsWith('image/')) {
      await fs.rm(file.path, { force: true });
      throw new BadRequestException('Mime type tidak valid.');
    }
    const name = `${randomBytes(16).toString('hex')}.${extension}`;
    const destination = this.paths.current('uploads', category, name);
    await fs.rename(file.path, destination);
    return { path: name, mime: expected };
  }

  resolve(category: 'branding' | 'avatars', name: string): string {
    if (!/^[a-f0-9]{32}\.[a-z0-9]+$/.test(name)) {
      throw new NotFoundException('Not found.');
    }
    const path = this.paths.readable('uploads', category, name);
    if (!path) {
      throw new NotFoundException('Not found.');
    }
    return path;
  }

  async remove(category: 'branding' | 'avatars', name: string): Promise<void> {
    const path = this.paths.readable('uploads', category, name);
    if (path?.startsWith(this.paths.root)) {
      await fs.rm(path, { force: true });
    }
  }
}
