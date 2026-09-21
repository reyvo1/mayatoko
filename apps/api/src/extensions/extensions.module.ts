import { Module } from '@nestjs/common';
import { ReturnsModule } from '../returns/returns.module';
import { PlatformModule } from '../platform/platform.module';
import { EdgeDeviceAuthService } from './edge-device-auth.service';
import { EdgeSyncController } from './edge-sync.controller';
import { ExtensionsController } from './extensions.controller';
import { ExtensionsService } from './extensions.service';

@Module({ imports: [ReturnsModule, PlatformModule], controllers: [ExtensionsController, EdgeSyncController], providers: [ExtensionsService, EdgeDeviceAuthService] })
export class ExtensionsModule {}
