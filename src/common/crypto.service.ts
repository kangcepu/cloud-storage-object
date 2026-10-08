import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

@Injectable()
export class CryptoService {
  private readonly key: Buffer;
  private readonly aad: Buffer;

  constructor(config: ConfigService) {
    this.key = Buffer.from(config.getOrThrow<string>('APP_ENCRYPTION_KEY_BASE64'), 'base64');
    this.aad = Buffer.from(config.get<string>('APP_ENCRYPTION_AAD', 'enterprise-s3-storage-manager'));
    if (this.key.length !== 32) {
      throw new Error('APP_ENCRYPTION_KEY_BASE64 harus berisi key 32-byte.');
    }
  }

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(this.aad);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
  }

  decrypt(value: string): string {
    const raw = Buffer.from(value, 'base64');
    if (raw.length < 28) {
      throw new Error('Ciphertext tidak valid.');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12));
    decipher.setAAD(this.aad);
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  }
}
