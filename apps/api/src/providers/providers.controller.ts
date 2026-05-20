import { Controller, Get } from '@nestjs/common';
import { PROVIDER_REGISTRY } from './provider-config.js';

@Controller('providers')
export class ProvidersController {
  @Get()
  findAll() {
    return PROVIDER_REGISTRY;
  }
}
