import { Controller, Get } from '@nestjs/common';

import { platformInfoSchema } from '@respark/schemas/platform';

import { platformVersion } from './platform-version';

@Controller()
export class HealthController {
  @Get('healthz')
  healthz() {
    return { status: 'ok' };
  }

  @Get('info')
  info() {
    return platformInfoSchema.parse({ version: platformVersion() });
  }
}
