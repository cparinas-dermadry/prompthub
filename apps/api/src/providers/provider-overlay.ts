/**
 * Provider overlay — locally-owned opinions that decorate OpenRouter's live
 * catalog. Everything dynamic (id, pricing, context_length, availability)
 * comes from OpenRouter via OpenRouterCatalogService. Everything opinionated
 * (which models to expose, brand colors, family defaults, display name
 * overrides) lives here.
 *
 * This file is small on purpose. If you find yourself adding more than a
 * handful of overrides per id, ask whether the catalog can serve the value
 * directly instead.
 */
import type { ProviderConfig } from './provider-config.js';

export interface FamilyMeta {
  /** Display group label — also stored as thread.provider in the DB. */
  family: string;
  /** OpenRouter id prefix used to classify catalog entries into this family. */
  catalogPrefix: string;
  /** OpenRouter provider slug used for provider.only BYOK routing. */
  openRouterProvider: string;
  /** Brand color used in the picker. */
  logoColor: string;
  /**
   * Default/highlighted model id for the family. Surfaces with isDefault=true
   * in the UI. Must be present in MODEL_ALLOWLIST.
   */
  defaultId?: string;
}

export const FAMILY_OVERLAYS: ReadonlyArray<FamilyMeta> = [
  {
    family: 'Anthropic',
    catalogPrefix: 'anthropic/',
    openRouterProvider: 'Anthropic',
    logoColor: '#D97757',
    defaultId: 'anthropic/claude-sonnet-4.6',
  },
  {
    family: 'OpenAI',
    catalogPrefix: 'openai/',
    openRouterProvider: 'OpenAI',
    logoColor: '#10A37F',
    defaultId: 'openai/gpt-5.5',
  },
  {
    family: 'Google',
    catalogPrefix: 'google/',
    openRouterProvider: 'Google AI Studio',
    logoColor: '#4285F4',
    defaultId: 'google/gemini-3.5-flash',
  },
  {
    family: 'xAI',
    catalogPrefix: 'x-ai/',
    openRouterProvider: 'xAI',
    logoColor: '#000000',
    defaultId: 'x-ai/grok-4.3',
  },
  {
    family: 'Perplexity',
    catalogPrefix: 'perplexity/',
    openRouterProvider: 'Perplexity',
    logoColor: '#20808D',
    defaultId: 'perplexity/sonar-pro',
  },
  {
    family: 'DeepSeek',
    catalogPrefix: 'deepseek/',
    openRouterProvider: 'DeepSeek',
    logoColor: '#4D6BFE',
    defaultId: 'deepseek/deepseek-v4-flash:free',
  },
  {
    family: 'Meta',
    catalogPrefix: 'meta-llama/',
    openRouterProvider: 'Meta Llama',
    logoColor: '#0064E0',
    defaultId: 'meta-llama/llama-3.3-70b-instruct:free',
  },
  {
    family: 'Mistral',
    catalogPrefix: 'mistralai/',
    openRouterProvider: 'Mistral',
    logoColor: '#FF7000',
  },
  {
    family: 'Z.ai',
    catalogPrefix: 'z-ai/',
    openRouterProvider: 'Z.ai',
    logoColor: '#0D7AEC',
  },
  {
    family: 'NVIDIA',
    catalogPrefix: 'nvidia/',
    openRouterProvider: 'NVIDIA',
    logoColor: '#76B900',
  },
];

/**
 * Allowlist of OpenRouter ids to expose in the picker. We surface flagships,
 * cheap-fast variants, and our free tier — not the full catalog.
 *
 * Add or remove ids here; the catalog service handles availability checks
 * and will warn on boot if any listed id is missing from OpenRouter's live
 * catalog.
 */
export const MODEL_ALLOWLIST: ReadonlySet<string> = new Set([
  // ── Anthropic ──────────────────────────────────────────────────────────────
  'anthropic/claude-opus-4.7',
  'anthropic/claude-opus-4.7-fast',
  'anthropic/claude-sonnet-4.6',
  'anthropic/claude-opus-4.6',
  'anthropic/claude-haiku-4.5',

  // ── OpenAI ─────────────────────────────────────────────────────────────────
  'openai/gpt-5.5',
  'openai/gpt-5.5-pro',
  'openai/gpt-5.4',
  'openai/gpt-5.4-mini',
  'openai/gpt-5.4-nano',

  // ── Google ─────────────────────────────────────────────────────────────────
  'google/gemini-3.5-flash',
  'google/gemini-3.1-pro-preview',
  'google/gemini-3.1-flash-lite',

  // ── xAI ────────────────────────────────────────────────────────────────────
  'x-ai/grok-4.3',
  'x-ai/grok-4.20',

  // ── Perplexity ─────────────────────────────────────────────────────────────
  'perplexity/sonar-pro',
  'perplexity/sonar-reasoning-pro',
  'perplexity/sonar',

  // ── Free tier ──────────────────────────────────────────────────────────────
  'deepseek/deepseek-v4-flash:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-4-31b-it:free',
  'z-ai/glm-4.5-air:free',
  'nvidia/nemotron-3-super-120b-a12b:free',

  // ── Paid extras ────────────────────────────────────────────────────────────
  'mistralai/mistral-large-2',
]);

/**
 * Models with a usable NATIVE web-search path through OpenRouter.
 *
 * IMPORTANT — why this is a manual allowlist and not a flag on the catalog:
 *   OpenRouter's `openrouter:web_search` server tool supports multiple
 *   engines, but `user_location` is **only honored by `engine: "native"`**
 *   (per https://openrouter.ai/docs/guides/features/server-tools/web-search).
 *   With `engine: "auto"`, requests on models without a native search path
 *   silently fall back to Exa — where `user_location` is dropped on the
 *   floor. For a GEO/SEO testing tool that defeats the whole point.
 *
 *   So we restrict the web-search-grounded path to models we've confirmed
 *   have a real native search engine, and set `engine: "native"` explicitly
 *   on the request. Anything not in this set runs framing-only (system
 *   message) without the tool — still useful, just less authoritative.
 *
 * Maintenance:
 *   - Keep this list tight. Add a model only after confirming via
 *     OpenRouter docs that it has a native search engine that honors
 *     `user_location`.
 *   - Perplexity Sonar models have built-in search but their native path
 *     has limitations (e.g. domain filtering not supported via server
 *     tool path per OpenRouter docs). They DO honor user_location.country
 *     so they're in. Re-verify if behavior changes.
 *   - GPT-5.5 / GPT-5.5-pro have native web search through OpenAI.
 *   - Claude Opus / Sonnet 4.6 have native web search through Anthropic.
 *   - xAI Grok 4.3 has native search.
 *   - Gemini grounding via OpenRouter is patchy; left OFF until verified.
 */
export const WEB_SEARCH_CAPABLE: ReadonlySet<string> = new Set([
  // OpenAI native search
  'openai/gpt-5.5',
  'openai/gpt-5.5-pro',
  // Anthropic native search
  'anthropic/claude-opus-4.7',
  'anthropic/claude-opus-4.6',
  'anthropic/claude-sonnet-4.6',
  // xAI native search
  'x-ai/grok-4.3',
  'x-ai/grok-4.20',
  // Perplexity Sonar (inherently search-grounded)
  'perplexity/sonar',
  'perplexity/sonar-pro',
  'perplexity/sonar-reasoning-pro',
]);

/**
 * Per-id display name overrides. Default is OpenRouter's `name` field with the
 * "Provider: " prefix stripped. Add an entry here only when the upstream name
 * is too long or off-brand for our picker.
 */
export const DISPLAY_NAME_OVERRIDES: Readonly<Record<string, string>> = {
  'google/gemini-3.1-pro-preview': 'Gemini 3.1 Pro (Preview)',
  'google/gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
  'google/gemma-4-31b-it:free': 'Gemma 4 31B',
  'meta-llama/llama-3.3-70b-instruct:free': 'Llama 3.3 70B',
  'deepseek/deepseek-v4-flash:free': 'DeepSeek V4 Flash',
  'z-ai/glm-4.5-air:free': 'GLM 4.5 Air',
  'nvidia/nemotron-3-super-120b-a12b:free': 'Nemotron 3 Super 120B',
  'perplexity/sonar-pro': 'Perplexity Sonar Pro',
  'perplexity/sonar-reasoning-pro': 'Perplexity Sonar Reasoning Pro',
  'perplexity/sonar': 'Perplexity Sonar',
};

export const DEFAULT_TEMPERATURE = 0.7;

/**
 * Frozen baseline used as a fallback if the OpenRouter catalog fetch fails
 * on boot AND we have no cached snapshot yet. The dynamic catalog is always
 * preferred — this just keeps /providers responsive if OpenRouter is briefly
 * unavailable during startup. Update it occasionally (e.g. when a model on
 * here is fully retired) but don't treat it as the source of truth.
 *
 * Last refreshed: 2026-05-27 (mirrors prior static PROVIDER_REGISTRY).
 */
export const BASELINE_REGISTRY: ReadonlyArray<ProviderConfig> = [
  {
    id: 'anthropic/claude-sonnet-4.6',
    displayName: 'Claude Sonnet 4.6',
    provider: 'Anthropic',
    openRouterProvider: 'Anthropic',
    byokOnly: false,
    isDefault: true,
    logoColor: '#D97757',
    defaultTemperature: 0.7,
    contextWindow: 1000000,
    costPer1kTokens: { input: 0.003, output: 0.015 },
    via: 'openrouter',
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    displayName: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    openRouterProvider: 'Anthropic',
    byokOnly: false,
    logoColor: '#D97757',
    defaultTemperature: 0.7,
    contextWindow: 200000,
    costPer1kTokens: { input: 0.001, output: 0.005 },
    via: 'openrouter',
  },
  {
    id: 'openai/gpt-5.5',
    displayName: 'GPT-5.5',
    provider: 'OpenAI',
    openRouterProvider: 'OpenAI',
    byokOnly: false,
    isDefault: true,
    logoColor: '#10A37F',
    defaultTemperature: 0.7,
    contextWindow: 1050000,
    costPer1kTokens: { input: 0.005, output: 0.03 },
    via: 'openrouter',
  },
  {
    id: 'google/gemini-3.5-flash',
    displayName: 'Gemini 3.5 Flash',
    provider: 'Google',
    openRouterProvider: 'Google AI Studio',
    byokOnly: false,
    isDefault: true,
    logoColor: '#4285F4',
    defaultTemperature: 0.7,
    contextWindow: 1048576,
    costPer1kTokens: { input: 0.0015, output: 0.009 },
    via: 'openrouter',
  },
  {
    id: 'x-ai/grok-4.3',
    displayName: 'Grok 4.3',
    provider: 'xAI',
    openRouterProvider: 'xAI',
    byokOnly: false,
    isDefault: true,
    logoColor: '#000000',
    defaultTemperature: 0.7,
    contextWindow: 1000000,
    costPer1kTokens: { input: 0.00125, output: 0.0025 },
    via: 'openrouter',
  },
  {
    id: 'perplexity/sonar-pro',
    displayName: 'Perplexity Sonar Pro',
    provider: 'Perplexity',
    openRouterProvider: 'Perplexity',
    byokOnly: false,
    isDefault: true,
    logoColor: '#20808D',
    defaultTemperature: 0.7,
    contextWindow: 200000,
    costPer1kTokens: { input: 0.003, output: 0.015 },
    via: 'openrouter',
  },
  {
    id: 'deepseek/deepseek-v4-flash:free',
    displayName: 'DeepSeek V4 Flash',
    provider: 'DeepSeek',
    openRouterProvider: 'DeepSeek',
    byokOnly: false,
    isDefault: true,
    logoColor: '#4D6BFE',
    defaultTemperature: 0.7,
    contextWindow: 1000000,
    costPer1kTokens: { input: 0, output: 0 },
    via: 'openrouter',
    free: true,
  },
];
