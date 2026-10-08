import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

@Injectable()
export class StoragePathService {
  readonly root: string;
  readonly legacyRoot: string;

  constructor(config: ConfigService) {
    this.root = config.get<string>('STORAGE_PATH', join(process.cwd(), 'storage'));
    this.legacyRoot = config.get<string>('LEGACY_STORAGE_PATH', '');
    for (const directory of [
      'logs',
      'cache',
      'tmp',
      join('uploads', 'branding'),
      join('uploads', 'avatars'),
    ]) {
      mkdirSync(join(this.root, directory), { recursive: true });
    }
  }

  current(...parts: string[]): string {
    return join(this.root, ...parts);
  }

  readable(...parts: string[]): string | null {
    const current = this.current(...parts);
    if (existsSync(current)) {
      return current;
    }
    if (this.legacyRoot) {
      const legacy = join(this.legacyRoot, ...parts);
      if (existsSync(legacy)) {
        return legacy;
      }
    }
    return null;
  }
}
