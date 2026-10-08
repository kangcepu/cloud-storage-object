import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../types';
import { DashboardService } from './dashboard.service';

@Controller('api/dashboard')
@UseGuards(SessionAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  async summary(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return { ok: true, data: await this.dashboard.summary(user) };
  }
}
