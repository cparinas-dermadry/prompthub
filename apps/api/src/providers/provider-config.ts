/**
 * Provider/model registry — single source of truth for the model picker.
 *
 * Shape matches `ProviderConfig` in @prompthub/types (the shared package).
 * If you add a field here, mirror it in packages/types/src/index.ts.
 */
export interface ProviderConfig {
  id: string;
  displayName: string;
  /** UI grouping label — also stored as thread.provider in the DB */
  provider: string;
  /** OpenRouter provider slug (kept for reference/future use) */
  openRouterProvider: string;
  /** When true, route exclusively through provider.only to use BYOK keys. False = use OpenRouter credits. */
  byokOnly: boolean;
  logoColor: string;
  defaultTemperature: number;
  contextWindow: number;
  /** Per-1k-token pricing in USD. Free models use { input: 0, output: 0 }. */
  costPer1kTokens: {
    input: number;
    output: number;
  };
  via: 'openrouter';
  free?: boolean;
  /** Marks the recommended/default model for its provider group */
  isDefault?: boolean;
}

// =============================================================================
// PROVIDER REGISTRY
// Last synced with OpenRouter live catalog: 2026-05-26
// All paid entries route through OpenRouter credits (byokOnly: false).
// =============================================================================
export const PROVIDER_REGISTRY: ProviderConfig[] = [
  // ── Anthropic — Claude ───────────────────────────────────────────────────────
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
    id: 'anthropic/claude-opus-4.6',
    displayName: 'Claude Opus 4.6',
    provider: 'Anthropic',
    openRouterProvider: 'Anthropic',
    byokOnly: false,
    logoColor: '#D97757',
    defaultTemperature: 0.7,
    contextWindow: 1000000,
    costPer1kTokens: { input: 0.005, output: 0.025 },
    via: 'openrouter',
  },
  {
    id: 'anthropic/claude-sonnet-4.5',
    displayName: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    openRouterProvider: 'Anthropic',
    byokOnly: false,
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

  // ── OpenAI — GPT ─────────────────────────────────────────────────────────────
  {
    id: 'openai/gpt-5.1',
    displayName: 'GPT-5.1',
    provider: 'OpenAI',
    openRouterProvider: 'OpenAI',
    byokOnly: false,
    isDefault: true,
    logoColor: '#10A37F',
    defaultTemperature: 0.7,
    contextWindow: 400000,
    costPer1kTokens: { input: 0.00125, output: 0.01 },
    via: 'openrouter',
  },
  {
    id: 'openai/gpt-5',
    displayName: 'GPT-5',
    provider: 'OpenAI',
    openRouterProvider: 'OpenAI',
    byokOnly: false,
    logoColor: '#10A37F',
    defaultTemperature: 0.7,
    contextWindow: 400000,
    costPer1kTokens: { input: 0.00125, output: 0.01 },
    via: 'openrouter',
  },
  {
    id: 'openai/gpt-5-mini',
    displayName: 'GPT-5 Mini',
    provider: 'OpenAI',
    openRouterProvider: 'OpenAI',
    byokOnly: false,
    logoColor: '#10A37F',
    defaultTemperature: 0.7,
    contextWindow: 400000,
    costPer1kTokens: { input: 0.00025, output: 0.002 },
    via: 'openrouter',
  },

  // ── Google — Gemini ──────────────────────────────────────────────────────────
  {
    id: 'google/gemini-3.5-flash',
    displayName: 'Gemini 3.5 Flash',
    provider: 'Google',
    openRouterProvider: 'Google AI Studio',
    byokOnly: false,
    isDefault: true,
    logoColor: '#4285F4',
    defaultTemperature: 0.7,
    contextWindow: 1000000,
    costPer1kTokens: { input: 0.0015, output: 0.009 },
    via: 'openrouter',
  },
  {
    id: 'google/gemini-3.1-pro-preview',
    displayName: 'Gemini 3.1 Pro (Preview)',
    provider: 'Google',
    openRouterProvider: 'Google AI Studio',
    byokOnly: false,
    logoColor: '#4285F4',
    defaultTemperature: 0.7,
    contextWindow: 1000000,
    costPer1kTokens: { input: 0.002, output: 0.012 },
    via: 'openrouter',
  },
  {
    id: 'google/gemini-3-flash-preview',
    displayName: 'Gemini 3 Flash (Preview)',
    provider: 'Google',
    openRouterProvider: 'Google AI Studio',
    byokOnly: false,
    logoColor: '#4285F4',
    defaultTemperature: 0.7,
    contextWindow: 1000000,
    costPer1kTokens: { input: 0.0005, output: 0.003 },
    via: 'openrouter',
  },

  // ── xAI — Grok ───────────────────────────────────────────────────────────────
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
    id: 'x-ai/grok-4-fast',
    displayName: 'Grok 4 Fast',
    provider: 'xAI',
    openRouterProvider: 'xAI',
    byokOnly: false,
    logoColor: '#000000',
    defaultTemperature: 0.7,
    contextWindow: 2000000,
    // Grok 4 Fast is positioned as SOTA-efficiency; rough estimate pending precise
    // pricing display on OpenRouter. Update if you see drift in usage reports.
    costPer1kTokens: { input: 0.0002, output: 0.0005 },
    via: 'openrouter',
  },
  // x-ai/grok-4 was deprecated by xAI on 2026-05-26 — see MODEL_MIGRATIONS in
  // streaming.service.ts for the remap to grok-4.3.

  // ── Perplexity — Sonar ───────────────────────────────────────────────────────
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
    id: 'perplexity/sonar-reasoning-pro',
    displayName: 'Perplexity Sonar Reasoning Pro',
    provider: 'Perplexity',
    openRouterProvider: 'Perplexity',
    byokOnly: false,
    logoColor: '#20808D',
    defaultTemperature: 0.7,
    contextWindow: 128000,
    costPer1kTokens: { input: 0.002, output: 0.008 },
    via: 'openrouter',
  },
  {
    id: 'perplexity/sonar',
    displayName: 'Perplexity Sonar',
    provider: 'Perplexity',
    openRouterProvider: 'Perplexity',
    byokOnly: false,
    logoColor: '#20808D',
    defaultTemperature: 0.7,
    contextWindow: 127000,
    costPer1kTokens: { input: 0.001, output: 0.001 },
    via: 'openrouter',
  },

  // ── Free models ──────────────────────────────────────────────────────────────
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
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    displayName: 'Llama 3.3 70B',
    provider: 'Meta',
    openRouterProvider: 'Meta Llama',
    byokOnly: false,
    isDefault: true,
    logoColor: '#0064E0',
    defaultTemperature: 0.7,
    contextWindow: 131072,
    costPer1kTokens: { input: 0, output: 0 },
    via: 'openrouter',
    free: true,
  },
  {
    id: 'google/gemma-4-31b-it:free',
    displayName: 'Gemma 4 31B',
    provider: 'Google',
    openRouterProvider: 'Google AI Studio',
    byokOnly: false,
    logoColor: '#4285F4',
    defaultTemperature: 0.7,
    contextWindow: 262144,
    costPer1kTokens: { input: 0, output: 0 },
    via: 'openrouter',
    free: true,
  },
  {
    id: 'x-ai/grok-4-fast:free',
    displayName: 'Grok 4 Fast (Free)',
    provider: 'xAI',
    openRouterProvider: 'xAI',
    byokOnly: false,
    logoColor: '#000000',
    defaultTemperature: 0.7,
    contextWindow: 2000000,
    costPer1kTokens: { input: 0, output: 0 },
    via: 'openrouter',
    free: true,
  },
  {
    id: 'z-ai/glm-4.5-air:free',
    displayName: 'GLM 4.5 Air',
    provider: 'Z.ai',
    openRouterProvider: 'Z.ai',
    byokOnly: false,
    logoColor: '#0D7AEC',
    defaultTemperature: 0.7,
    contextWindow: 131072,
    costPer1kTokens: { input: 0, output: 0 },
    via: 'openrouter',
    free: true,
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    displayName: 'Nemotron 3 Super 120B',
    provider: 'NVIDIA',
    openRouterProvider: 'NVIDIA',
    byokOnly: false,
    logoColor: '#76B900',
    defaultTemperature: 0.7,
    contextWindow: 1000000,
    costPer1kTokens: { input: 0, output: 0 },
    via: 'openrouter',
    free: true,
  },

  // ── Additional paid models ───────────────────────────────────────────────────
  {
    id: 'mistralai/mistral-large-2',
    displayName: 'Mistral Large 2',
    provider: 'Mistral',
    openRouterProvider: 'Mistral',
    byokOnly: false,
    logoColor: '#FF7000',
    defaultTemperature: 0.7,
    contextWindow: 128000,
    costPer1kTokens: { input: 0.002, output: 0.006 },
    via: 'openrouter',
  },
];
