import { Injectable } from '@nestjs/common';
import { RowDataPacket } from 'mysql2';
import { CryptoService } from '../common/crypto.service';
import { DatabaseService } from '../common/database.service';

interface SettingRow extends RowDataPacket {
  setting_key: string;
  setting_value: string | null;
  is_encrypted: number;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly crypto: CryptoService,
  ) {}

  async getGroup(group: string): Promise<Record<string, string | null>> {
    const rows = await this.database.query<SettingRow>(
      'SELECT setting_key, setting_value, is_encrypted FROM settings WHERE setting_group=?',
      [group],
    );
    return Object.fromEntries(
      rows.map((row) => [
        row.setting_key,
        row.is_encrypted === 1 && row.setting_value
          ? this.crypto.decrypt(row.setting_value)
          : row.setting_value,
      ]),
    );
  }

  async get(group: string, key: string, fallback: string | null = null): Promise<string | null> {
    if (group === 'minio' && key === 'delivery_mode' && process.env.MINIO_DELIVERY_MODE) {
      return process.env.MINIO_DELIVERY_MODE;
    }
    if (group === 'minio' && key === 'public_endpoint' && process.env.MINIO_PUBLIC_ENDPOINT) {
      return process.env.MINIO_PUBLIC_ENDPOINT;
    }
    const row = await this.database.one<SettingRow>(
      'SELECT setting_key, setting_value, is_encrypted FROM settings WHERE setting_group=? AND setting_key=? LIMIT 1',
      [group, key],
    );
    if (!row) {
      return fallback;
    }
    if (row.is_encrypted === 1 && row.setting_value) {
      return this.crypto.decrypt(row.setting_value);
    }
    return row.setting_value ?? fallback;
  }

  async set(group: string, key: string, value: string | null, encrypted = false): Promise<void> {
    const stored = encrypted && value ? this.crypto.encrypt(value) : value;
    const now = this.database.now();
    await this.database.execute(
      'INSERT INTO settings (setting_group, setting_key, setting_value, is_encrypted, created_at, updated_at) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), is_encrypted=VALUES(is_encrypted), updated_at=VALUES(updated_at)',
      [group, key, stored, encrypted ? 1 : 0, now, now],
    );
  }

  async hasMinioConfig(): Promise<boolean> {
    const values = await Promise.all([
      this.get('minio', 'endpoint'),
      this.get('minio', 'access_key'),
      this.get('minio', 'secret_key'),
    ]);
    return values.every(Boolean);
  }
}
