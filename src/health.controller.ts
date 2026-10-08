import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './common/database.service';

@Controller('api/health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  async health(): Promise<Record<string, unknown>> {
    await this.database.ping();
    return {
      ok: true,
      service: 'cloud-storage-api',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
