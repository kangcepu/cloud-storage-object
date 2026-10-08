import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BucketsModule } from './buckets/buckets.module';
import { CommonModule } from './common/common.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FilesModule } from './files/files.module';
import { HealthController } from './health.controller';
import { MediaModule } from './media/media.module';
import { MobileModule } from './mobile/mobile.module';
import { RawModule } from './raw/raw.module';
import { SettingsApiModule } from './settings/settings-api.module';
import { SettingsModule } from './settings/settings.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    SettingsModule,
    AuditModule,
    AuthModule,
    StorageModule,
    RawModule,
    BucketsModule,
    FilesModule,
    MediaModule,
    UsersModule,
    SettingsApiModule,
    DashboardModule,
    MobileModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
