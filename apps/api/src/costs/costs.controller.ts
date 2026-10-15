import { Controller, Get, UseGuards } from '@nestjs/common';

import { ClerkAuthGuard } from '../auth/clerk-auth.guard';

import { CostsService } from './costs.service';

@Controller('costs')
@UseGuards(ClerkAuthGuard)
export class CostsController {
  constructor(private readonly costsService: CostsService) {}

  @Get()
  async getSummary() {
    return this.costsService.getSummary();
  }
}
