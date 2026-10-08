import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { DatabaseService } from '../common/database.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class AuditService {
  constructor(
    private readonly database: DatabaseService,
    private readonly settings: SettingsService,
  ) {}

  async log(
    userId: number | null,
    action: string,
    entityType: string | null,
    entityId: string | null,
    metadata: Record<string, unknown> | null = null,
    request?: Request,
  ): Promise<void> {
    if ((await this.settings.get('security', 'audit_log_enabled', '1')) !== '1') {
      return;
    }
    try {
      await this.database.execute(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent, metadata, created_at) VALUES (?,?,?,?,?,?,?,?)',
        [
          userId,
          action,
          entityType,
          entityId,
          request?.ip ?? null,
          request?.get('user-agent')?.slice(0, 255) ?? null,
          metadata ? JSON.stringify(metadata) : null,
          this.database.now(),
        ],
      );
    } catch {
      return;
    }
  }
}
