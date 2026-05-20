// Supabase table shapes
export interface Session {
  id: string;
  user_id: string;
  name: string;
  tags: string[];
  active_providers: ProviderConfig[];
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
}

// API request/response shapes
export interface SendPromptRequest {
  sessionId: string;
  prompt: string;
  modelIds: string[];
}

export interface StreamEvent {
  threadId: string;
  token?: string;
  done?: boolean;
  error?: string;
}
