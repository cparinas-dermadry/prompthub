import { Controller, Get } from '@nestjs/common';
import { ProviderRegistryService } from './provider-registry.service.js';

@Controller('providers')
export class ProvidersController {
  constructor(private readonly registry: ProviderRegistryService) {}

  @Get()
  findAll() {
    return this.registry.getAll();
  }
}
