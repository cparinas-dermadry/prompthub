import { Injectable, Logger } from '@nestjs/common';
import type { ProviderConfig } from './provider-config.js';
import {
  BASELINE_REGISTRY,
  DEFAULT_TEMPERATURE,
  DISPLAY_NAME_OVERRIDES,
  FAMILY_OVERLAYS,
  MODEL_ALLOWLIST,
  WEB_SEARCH_CAPABLE,
  type FamilyMeta,
} from './provider-overlay.js';
import {
  OpenRouterCatalogService,
  type OpenRouterModel,
} from './openrouter-catalog.service.js';

/**
 * Merges the live OpenRouter catalog with our local overlay (brand colors,
 * allowlist, family defaults, display name overrides) and produces the
 * ProviderConfig[] consumed by the picker and StreamingService.
 *
 * Source of truth is always the live catalog. The overlay only contributes
 * opinions; if a model leaves OpenRouter, it disappears from the registry
 * automatically (and a warning is logged so we know to update the allowlist).
 *
 * Falls back to BASELINE_REGISTRY when the catalog cache is empty (i.e. the
 * boot fetch hasn't returned yet, or OpenRouter is unreachable). That keeps
 * the picker functional during cold starts and outages.
 */
@Injectable()
export class ProviderRegistryService {
  private readonly logger = new Logger(ProviderRegistryService.name);
  /**
   * Tracks the set of allowlisted ids we've already warned about as missing
   * from the live catalog. Prevents log spam on every getAll() call when an
   * id has been retired upstream.
   */
  private warnedMissingIds = new Set<string>();

  constructor(private readonly catalog: OpenRouterCatalogService) {}

  /**
   * Returns the merged registry. Cheap to call; we recompute on each request
   * so a mid-flight catalog refresh is picked up immediately. If we ever see
   * this in a profile, memoize by catalog reference.
   */
  getAll(): ProviderConfig[] {
    const live = this.catalog.getCatalog();

    if (live.length === 0) {
      // Boot path or OpenRouter unreachable — serve the frozen baseline so
      // the picker still works. The catalog service is already logging the
      // failure mode; no need to double-log here.
      return [...BASELINE_REGISTRY];
    }

    const byId = new Map<string, OpenRouterModel>();
    for (const m of live) {
      byId.set(m.id, m);
    }

    const out: ProviderConfig[] = [];

    for (const id of MODEL_ALLOWLIST) {
      const model = byId.get(id);
      if (!model) {
        if (!this.warnedMissingIds.has(id)) {
          this.logger.warn(
            `Allowlisted model '${id}' is not in the live OpenRouter catalog — hiding from picker. Update MODEL_ALLOWLIST in provider-overlay.ts.`,
          );
          this.warnedMissingIds.add(id);
        }
        continue;
      }
      if (model.deprecated) {
        if (!this.warnedMissingIds.has(id)) {
          this.logger.warn(
            `Allowlisted model '${id}' is flagged deprecated by OpenRouter — hiding from picker. Add a MODEL_MIGRATIONS entry and remove from allowlist.`,
          );
          this.warnedMissingIds.add(id);
        }
        continue;
      }

      // A model id was previously missing and is now back — clear the warn flag.
      if (this.warnedMissingIds.has(id)) {
        this.warnedMissingIds.delete(id);
      }

      const family = this.familyFor(id);
      if (!family) {
        this.logger.warn(
          `Allowlisted model '${id}' did not match any FAMILY_OVERLAYS prefix — add one in provider-overlay.ts.`,
        );
        continue;
      }

      out.push(this.toProviderConfig(model, family));
    }

    return out;
  }

  /**
   * Lookup a single ProviderConfig by id. Used by StreamingService for BYOK
   * routing decisions. Returns null if the id is unknown — callers should
   * fall back to streaming without BYOK (matching the previous behaviour).
   */
  findById(id: string): ProviderConfig | null {
    const all = this.getAll();
    return all.find((p) => p.id === id) ?? null;
  }

  /** Returns the FamilyMeta whose catalogPrefix matches the given id, or null. */
  private familyFor(id: string): FamilyMeta | null {
    for (const fam of FAMILY_OVERLAYS) {
      if (id.startsWith(fam.catalogPrefix)) return fam;
    }
    return null;
  }

  /**
   * Build a ProviderConfig by combining the live OpenRouter entry with our
   * local opinions. Pricing is OpenRouter-authoritative (per token → per 1k),
   * context window is OpenRouter-authoritative, brand/display/default come
   * from the overlay.
   */
  private toProviderConfig(
    model: OpenRouterModel,
    family: FamilyMeta,
  ): ProviderConfig {
    const inputPer1k = Number(model.pricing.prompt) * 1000;
    const outputPer1k = Number(model.pricing.completion) * 1000;

    const displayName =
      DISPLAY_NAME_OVERRIDES[model.id] ??
      stripFamilyPrefix(model.name, family.family);

    return {
      id: model.id,
      displayName,
      provider: family.family,
      openRouterProvider: family.openRouterProvider,
      byokOnly: false,
      isDefault: family.defaultId === model.id ? true : undefined,
      logoColor: family.logoColor,
      defaultTemperature: DEFAULT_TEMPERATURE,
      contextWindow: model.context_length ?? 0,
      costPer1kTokens: {
        input: Number.isFinite(inputPer1k) ? inputPer1k : 0,
        output: Number.isFinite(outputPer1k) ? outputPer1k : 0,
      },
      via: 'openrouter',
      ...(model.id.endsWith(':free') ? { free: true } : {}),
      // Pass the capability list through verbatim. Undefined when OpenRouter
      // omits the field; StreamingService treats undefined conservatively
      // (i.e. doesn't assume `temperature` is supported).
      ...(model.supported_parameters
        ? { supportedParameters: model.supported_parameters }
        : {}),
      // Web-search capability is a local opinion (curated allowlist) —
      // NOT derived from the live catalog because OpenRouter doesn't
      // expose it. See provider-overlay.ts WEB_SEARCH_CAPABLE for why.
      ...(WEB_SEARCH_CAPABLE.has(model.id) ? { supportsWebSearch: true } : {}),
    };
  }
}

/**
 * OpenRouter formats `name` as "Provider: Model Name" (e.g. "xAI: Grok 4.3").
 * For our picker we usually want just the right side, but we keep the prefix
 * for Perplexity since "Sonar Pro" alone is ambiguous — those are explicit
 * DISPLAY_NAME_OVERRIDES entries.
 */
function stripFamilyPrefix(name: string, family: string): string {
  const prefix = `${family}: `;
  if (name.startsWith(prefix)) return name.slice(prefix.length);
  return name;
}
