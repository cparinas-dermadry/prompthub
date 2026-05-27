import { Module } from '@nestjs/common';
import { ProvidersController } from './providers.controller.js';
import { OpenRouterCatalogService } from './openrouter-catalog.service.js';
import { ProviderRegistryService } from './provider-registry.service.js';

@Module({
  controllers: [ProvidersController],
  providers: [OpenRouterCatalogService, ProviderRegistryService],
  exports: [ProviderRegistryService],
})
export class ProvidersModule {}
