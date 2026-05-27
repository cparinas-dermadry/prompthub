import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

/**
 * Slice of the OpenRouter /api/v1/models response we actually use. The full
 * payload contains additional fields (architecture, top_provider, supported
 * parameters, per_request_limits, etc.) that we ignore — keep this interface
 * minimal so we don't accidentally couple to fields that may change shape.
 *
 * Reference: https://openrouter.ai/docs/api/reference (Models endpoint)
 */
export interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number | null;
  /** All pricing fields are USD per token, encoded as strings. */
  pricing: {
    prompt: string;
    completion: string;
    image?: string;
    request?: string;
  };
  /** Set when OpenRouter has flagged the model as deprecated. */
  deprecated?: boolean;
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Fetches OpenRouter's live model catalog on boot, caches it in memory, and
 * refreshes every 6 hours. Other services should depend on this and treat
 * the result as the authoritative live truth (decorated by provider-overlay).
 *
 * Failure mode: if the initial fetch fails we keep an empty catalog and log
 * an error. ProviderRegistryService is responsible for falling back to the
 * static BASELINE_REGISTRY in that case — this service never throws.
 */
@Injectable()
export class OpenRouterCatalogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OpenRouterCatalogService.name);
  private catalog: OpenRouterModel[] = [];
  private lastFetchedAt: Date | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  async onModuleInit(): Promise<void> {
    // Fire-and-forget the boot fetch so a slow OpenRouter response doesn't
    // hold up the rest of module init. The registry service will fall back
    // to BASELINE_REGISTRY until the cache is populated.
    void this.refresh();

    this.refreshTimer = setInterval(() => {
      void this.refresh();
    }, REFRESH_INTERVAL_MS);
    // Don't keep the event loop alive solely for this timer (matters in CLI
    // and graceful-shutdown scenarios).
    this.refreshTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /** Returns the cached catalog. Empty array if the boot fetch hasn't succeeded yet. */
  getCatalog(): ReadonlyArray<OpenRouterModel> {
    return this.catalog;
  }

  getLastFetchedAt(): Date | null {
    return this.lastFetchedAt;
  }

  /**
   * Manually trigger a refresh. Safe to call concurrently — the worst case
   * is two in-flight fetches; the second-resolved one wins. We keep the
   * method public so an admin endpoint or test can force a refresh.
   */
  async refresh(): Promise<void> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(OPENROUTER_MODELS_URL, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        this.logger.error(
          `OpenRouter /models returned ${res.status} ${res.statusText} — keeping previous catalog (size=${this.catalog.length})`,
        );
        return;
      }

      const json = (await res.json()) as OpenRouterModelsResponse;
      if (!json || !Array.isArray(json.data)) {
        this.logger.error(
          'OpenRouter /models returned unexpected shape — keeping previous catalog',
        );
        return;
      }

      const prevSize = this.catalog.length;
      this.catalog = json.data;
      this.lastFetchedAt = new Date();
      this.logger.log(
        `OpenRouter catalog refreshed: ${json.data.length} models (was ${prevSize})`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `OpenRouter catalog fetch failed: ${msg} — keeping previous catalog (size=${this.catalog.length})`,
      );
    }
  }
}
