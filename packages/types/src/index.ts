// Supabase table shapes
export interface Session {
  id: string;
  user_id: string;
  name: string;
  tags: string[];
  active_providers: ProviderConfig[];
  /**
   * Per-session location used for GEO/SEO/AEO visibility testing.
   * Applied server-side as an invisible system message + (for search-capable
   * models) the OpenRouter `user_location` parameter. Null = no location set.
   */
  location: PromptLocation | null;
  created_at: string;
  updated_at: string;
}

export interface Thread {
  id: string;
  session_id: string;
  model_id: string;
  display_name: string;
  provider: string;
  model_config: ModelConfig;
  created_at: string;
}

export interface Message {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant';
  content: string;
  is_bookmarked: boolean;
  /**
   * The location the message was generated under (null when the session had
   * no location set at the time). Stamped on both user and assistant rows so
   * history stays accurate even if the session's default location later
   * changes. Brand-agnostic; no real-person data.
   */
  location: PromptLocation | null;
  /**
   * Web-search citations gathered by openrouter:web_search server tool.
   * Only populated on assistant rows produced by search-capable models.
   * Null when the model didn't use web search (or wasn't search-capable).
   */
  citations: Citation[] | null;
  timestamp: string;
}

// Config shapes
export interface ModelConfig {
  system_prompt?: string;
  temperature?: number;
  use_direct_api?: boolean;
}

export interface ProviderConfig {
  id: string;
  displayName: string;
  provider: string;
  /** OpenRouter provider slug for provider.only BYOK routing */
  openRouterProvider: string;
  /** When true, route exclusively through provider.only to use BYOK keys */
  byokOnly: boolean;
  logoColor: string;
  defaultTemperature: number;
  contextWindow: number;
  costPer1kTokens: {
    input: number;
    output: number;
  };
  via: 'openrouter' | 'direct';
  free?: boolean;
  isDefault?: boolean;
  /**
   * OpenRouter's `supported_parameters` list for this model. Used server-side
   * by StreamingService to gate fields like `temperature` that reasoning
   * models reject. Mirrors the field on apps/api ProviderConfig.
   */
  supportedParameters?: readonly string[];
  /**
   * True when the model has a usable NATIVE web-search path through
   * OpenRouter — meaning the `openrouter:web_search` server tool with
   * `engine: "native"` will actually honor `user_location` instead of
   * silently falling back to Exa (which ignores location).
   *
   * Populated from a hand-curated allowlist in provider-overlay.ts, NOT
   * from `supported_parameters`. OpenRouter does not advertise web-search
   * capability through that field.
   */
  supportsWebSearch?: boolean;
}

/**
 * A declared "test from here" query location used by the GEO/SEO visibility
 * testing harness. NOT a real-person location — it's the synthetic country
 * we want the model (and grounded web search) to answer from.
 *
 * `country` is the only ~required field when present (ISO-3166 alpha-2).
 * Everything else refines the framing/search hint.
 */
export interface PromptLocation {
  /** ISO-3166 alpha-2, e.g. "SG", "PH", "CA". */
  country: string;
  /** State / province / administrative region, e.g. "Ontario". */
  region?: string;
  /** City, e.g. "Toronto". */
  city?: string;
  /** IANA timezone, e.g. "America/Toronto". */
  timezone?: string;
  /** Human-friendly display label, e.g. "Toronto, ON, Canada". */
  label?: string;
}

/**
 * A single web-search citation returned by openrouter:web_search and
 * persisted alongside the assistant message that produced it.
 */
export interface Citation {
  url: string;
  title?: string;
  /** Short snippet excerpt returned by the search engine. */
  snippet?: string;
  /** Host-only convenience field (derived; may be omitted). */
  domain?: string;
}

// API request/response shapes
export interface SendPromptRequest {
  sessionId: string;
  prompt: string;
  modelIds: string[];
  /**
   * Optional per-request location. Always populated from the active
   * session in the frontend. Single location now; the field is shaped
   * for a future `locations?: PromptLocation[]` multi-region fan-out
   * without breaking the single-location case.
   */
  location?: PromptLocation;
}

export interface StreamEvent {
  threadId: string;
  token?: string;
  done?: boolean;
  error?: string;
  /** Emitted once per thread when the model called web search. */
  citations?: Citation[];
}
