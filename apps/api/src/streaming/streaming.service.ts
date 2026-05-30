import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { UserSupabaseService } from '../supabase/user-supabase.service.js';
import { ProviderRegistryService } from '../providers/provider-registry.service.js';
import type { Citation, PromptLocation } from '@prompthub/types';

/**
 * Remap retired/broken model IDs to their current replacements.
 * Applied transparently before every OpenRouter call and persisted to the DB.
 */
const MODEL_MIGRATIONS: Record<string, string> = {
  // ── Anthropic ──────────────────────────────────────────────────────────────
  // Hyphen vs dot — OpenRouter uses dot notation for 4.x models
  'anthropic/claude-sonnet-4-5': 'anthropic/claude-sonnet-4.5',
  // Legacy Anthropic names
  'anthropic/claude-lite': 'anthropic/claude-haiku-4.5',
  // claude-3.5-haiku has no Anthropic direct provider on OpenRouter (only amazon-bedrock/google-vertex)
  'anthropic/claude-3.5-haiku': 'anthropic/claude-haiku-4.5',
  // Removed from registry on 2026-05-26 — point at current Sonnet
  'anthropic/claude-sonnet-4': 'anthropic/claude-sonnet-4.6',
  // Removed — point at current Opus
  'anthropic/claude-opus-4': 'anthropic/claude-opus-4.6',
  // (claude-opus-4.7-fast used to be remapped here on the assumption it
  // wasn't a real id. It IS live on OpenRouter — left to pass through.)

  // ── Google ─────────────────────────────────────────────────────────────────
  // gemini-2.0-flash-001 retiring June 1 2026; gemini-1.5 family deprecated
  'google/gemini-2.0-flash-001': 'google/gemini-3.5-flash',
  'google/gemini-2.5-pro': 'google/gemini-3.1-pro-preview',
  'google/gemini-1.5-pro': 'google/gemini-3.1-pro-preview',
  'google/gemini-1.5-pro-002': 'google/gemini-3.1-pro-preview',
  'google/gemini-1.5-flash': 'google/gemini-3.5-flash',
  'google/gemini-1.5-flash-002': 'google/gemini-3.5-flash',
  'google/gemini-pro': 'google/gemini-3.5-flash',

  // ── OpenAI ─────────────────────────────────────────────────────────────────
  // GPT-4o family retired from registry on 2026-05-26. Targets updated to
  // current GPT-5.x family on 2026-05-27 (previous targets gpt-5.1/gpt-5-mini
  // are no longer in OpenRouter's live catalog).
  'openai/gpt-4o': 'openai/gpt-5.5',
  'openai/gpt-4o-mini': 'openai/gpt-5.4-mini',
  'openai/gpt-5.1': 'openai/gpt-5.5',
  'openai/gpt-5': 'openai/gpt-5.5',
  'openai/gpt-5-mini': 'openai/gpt-5.4-mini',

  // ── xAI ────────────────────────────────────────────────────────────────────
  // Grok-2 retired from registry on 2026-05-26
  'x-ai/grok-2': 'x-ai/grok-4.3',
  'x-ai/grok-2-1212': 'x-ai/grok-4.3',
  'x-ai/grok-3': 'x-ai/grok-4.3',
  // Grok-4 deprecated by xAI on 2026-05-26 (OpenRouter returns 404 with redirect notice)
  'x-ai/grok-4': 'x-ai/grok-4.3',
  // Grok-4 Fast deprecated by xAI on 2026-05-26 (OpenRouter returns 404 with
  // redirect notice: "xAI recommends switching to Grok 4.3"). Both paid and
  // :free variants are retired — :free callers also remap to grok-4.3 since
  // xAI has not published a free successor.
  'x-ai/grok-4-fast': 'x-ai/grok-4.3',
  'x-ai/grok-4-fast:free': 'x-ai/grok-4.3',

  // ── DeepSeek ───────────────────────────────────────────────────────────────
  'deepseek/deepseek-r1:free': 'deepseek/deepseek-v4-flash:free',
  'deepseek/deepseek-chat-v3-0324:free': 'deepseek/deepseek-v4-flash:free',

  // ── Open models ────────────────────────────────────────────────────────────
  'google/gemma-3-12b-it:free': 'google/gemma-4-31b-it:free',
  'mistralai/mistral-7b-instruct:free': 'meta-llama/llama-3.3-70b-instruct:free',
};

interface Thread {
  id: string;
  model_id: string;
  model_config: Record<string, unknown>;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Build the invisible "you are answering a user located in …" system message
 * for the GEO/SEO visibility testing feature. Brand-agnostic by design — the
 * point is to observe which brands the model surfaces on its own, so we do
 * NOT name any specific brand or product category in this framing.
 *
 * Returns null when no location is set, so the caller can skip prepending.
 */
function buildLocationFraming(location: PromptLocation | undefined): string | null {
  if (!location) return null;
  const where = location.label
    ? location.label
    : [location.city, location.region, location.country].filter(Boolean).join(', ');
  if (!where) return null;
  // Keep this short and brand-neutral. Mention timezone only if provided —
  // it nudges date/time-sensitive answers (events, "current" recommendations).
  const tzClause = location.timezone ? ` Their local timezone is ${location.timezone}.` : '';
  return (
    `You are answering a user located in ${where}.${tzClause} ` +
    `Answer naturally for that locale — consider local availability, ` +
    `regulations, popular brands, and language norms appropriate to the region. ` +
    `Do not mention this location instruction in your response.`
  );
}

/**
 * Phase 2 notes for this service specifically:
 *
 * StreamingService is the one with the most exotic async lifecycle — fanOut
 * holds an open SSE connection for many seconds while N parallel
 * streamThread tasks read from OpenRouter, write SSE events, and (on
 * abort or error) call persistAssistantMessage to save partial content.
 *
 * Because UserSupabaseService is request-scoped, this whole chain is now
 * request-scoped. The request-scoped instance lives until the controller
 * promise resolves (i.e. until res.end() returns and `sendPrompt` exits),
 * so:
 *   - the user-message INSERT before streaming starts uses the live client,
 *   - each streamThread's persistAssistantMessage at success/abort/error
 *     time also uses the same live client,
 *   - on client disconnect, the abort handler fires inside the controller's
 *     promise — still within the request lifecycle — so persistence still
 *     works under RLS.
 *
 * If we ever detach work to run AFTER the controller returns (e.g. a true
 * fire-and-forget background save), we'd need a different strategy because
 * request-scoped services are torn down once the response is sent.
 */
@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);

  constructor(
    private readonly supabase: UserSupabaseService,
    private readonly registry: ProviderRegistryService,
  ) {}

  async fanOut(
    sessionId: string,
    prompt: string,
    threadIds: string[],
    userId: string,
    res: Response,
    location?: PromptLocation,
  ): Promise<void> {
    const threads = await this.loadOwnedThreads(sessionId, threadIds, userId);
    if (!threads) {
      res.status(404).end();
      return;
    }

    // Save user message to all threads — only fan-out does this; retry
    // reuses the existing last user message instead. The location stamp
    // here is the source of truth for "what locale was this turn run
    // under?" — kept even if the session's default changes later.
    await this.supabase.db.from('messages').insert(
      threads.map((t: Thread) => ({
        thread_id: t.id,
        role: 'user',
        content: prompt,
        location: location ?? null,
      })),
    );

    await this.runStreams(threads, prompt, () => undefined, userId, res, location);
  }

  /**
   * Re-stream one or more threads from a specific turn.
   *
   * For each thread:
   *  1. Resolve the rewind point: either the explicit `fromMessageId` override
   *     or, if not given, the latest user message in the thread.
   *  2. If an edited prompt was supplied, update that user message's content.
   *  3. If a location was supplied on retry, update the rewind-point user
   *     message's location stamp so the retried turn reflects the current
   *     locale (not the one the original turn used).
   *  4. Delete every message timestamped AFTER the rewind point — both user
   *     AND assistant. This is the "silent invalidation" of subsequent turns
   *     when the user retries an earlier turn (matches ChatGPT/Claude.ai UX).
   *  5. Re-stream via the existing streamThread machinery, which loads
   *     history from the DB (now truncated at the rewind point + edited).
   *
   * Called by POST /streaming/retry. Does NOT insert a new user message.
   */
  async retryThreads(
    sessionId: string,
    threadIds: string[],
    overrides: Map<string, { prompt?: string; fromMessageId?: string }>,
    userId: string,
    res: Response,
    location?: PromptLocation,
  ): Promise<void> {
    const threads = await this.loadOwnedThreads(sessionId, threadIds, userId);
    if (!threads) {
      res.status(404).end();
      return;
    }

    const retryableThreadIds = new Set<string>();

    for (const thread of threads) {
      const override = overrides.get(thread.id);
      const rewindPoint = await this.resolveRewindPoint(thread.id, override?.fromMessageId);

      if (!rewindPoint) {
        this.logger.warn(
          `Retry requested for thread ${thread.id} but no valid rewind point — skipping`,
        );
        continue;
      }

      // Build the update patch lazily — if neither the prompt nor the
      // location changed, we skip the round-trip entirely.
      const patch: Record<string, unknown> = {};
      if (
        override?.prompt !== undefined &&
        override.prompt !== rewindPoint.content
      ) {
        patch.content = override.prompt;
      }
      if (location !== undefined) {
        // Stamp the rewind-point user message with the location this retry
        // is running under. Pass `null` to clear by sending location=null
        // from the controller (currently we only set it positively).
        patch.location = location;
      }
      if (Object.keys(patch).length > 0) {
        await this.supabase.db
          .from('messages')
          .update(patch)
          .eq('id', rewindPoint.id);
      }

      // Wipe everything that came AFTER the rewind point. This deletes both
      // subsequent user messages AND assistant messages — the user-facing
      // semantic is "retrying turn N invalidates turns N+1, N+2, ...".
      // gt() on timestamp is safe: timestamps are monotonic per-thread.
      await this.supabase.db
        .from('messages')
        .delete()
        .eq('thread_id', thread.id)
        .gt('timestamp', rewindPoint.timestamp);

      retryableThreadIds.add(thread.id);
    }

    if (retryableThreadIds.size === 0) {
      res
        .status(400)
        .json({ error: 'No retryable threads (no valid rewind point found)' });
      return;
    }

    const retryable = threads.filter((t) => retryableThreadIds.has(t.id));
    await this.runStreams(retryable, '', () => undefined, userId, res, location);
  }

  /**
   * Resolve which user message is the rewind point for a retry.
   *
   * If `fromMessageId` is provided, validate that it exists, belongs to this
   * thread, and is role='user' — return it. Otherwise (or if invalid), fall
   * back to the latest user message in the thread. Returns null if the
   * thread has no user messages at all.
   */
  private async resolveRewindPoint(
    threadId: string,
    fromMessageId: string | undefined,
  ): Promise<{ id: string; content: string; timestamp: string } | null> {
    if (fromMessageId) {
      const { data: explicit } = await this.supabase.db
        .from('messages')
        .select('id, content, timestamp, role, thread_id')
        .eq('id', fromMessageId)
        .maybeSingle();

      if (explicit && explicit.thread_id === threadId && explicit.role === 'user') {
        return {
          id: explicit.id as string,
          content: explicit.content as string,
          timestamp: explicit.timestamp as string,
        };
      }
      this.logger.warn(
        `Invalid fromMessageId ${fromMessageId} for thread ${threadId} (wrong thread, wrong role, or missing). Falling back to latest user message.`,
      );
    }

    const { data: latest } = await this.supabase.db
      .from('messages')
      .select('id, content, timestamp')
      .eq('thread_id', threadId)
      .eq('role', 'user')
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latest) return null;
    return {
      id: latest.id as string,
      content: latest.content as string,
      timestamp: latest.timestamp as string,
    };
  }

  /**
   * Verify session ownership and load the requested threads in one round-trip.
   * Returns null (with no response written) if either the session or threads
   * lookup fails — callers must res.status(404).end() in that case.
   */
  private async loadOwnedThreads(
    sessionId: string,
    threadIds: string[],
    userId: string,
  ): Promise<Thread[] | null> {
    const { data: session } = await this.supabase.db
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (!session) return null;

    const { data: threads } = await this.supabase.db
      .from('threads')
      .select('id, model_id, model_config')
      .in('id', threadIds)
      .eq('session_id', sessionId);

    if (!threads || threads.length === 0) return null;
    return threads as Thread[];
  }

  /**
   * Shared SSE choreography for fan-out and retry. Sets up the response
   * headers, wires the client-disconnect abort signal, kicks off one
   * streamThread per thread in parallel, and emits the terminal `done`
   * event when all have settled.
   *
   * `promptResolver` lets retryThreads supply a per-thread prompt — if it
   * returns undefined, the shared `prompt` argument is used instead.
   */
  private async runStreams(
    threads: Thread[],
    prompt: string,
    promptResolver: (t: Thread) => string | undefined,
    userId: string,
    res: Response,
    location: PromptLocation | undefined,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // When the client disconnects, abort every in-flight OpenRouter request
    // so we stop burning credits/tokens for output nobody will ever see.
    const abortController = new AbortController();
    const onClose = (): void => abortController.abort();
    res.req.on('close', onClose);

    try {
      await Promise.allSettled(
        threads.map((thread: Thread) =>
          this.streamThread(
            thread,
            promptResolver(thread) ?? prompt,
            userId,
            res,
            abortController.signal,
            location,
          ),
        ),
      );

      if (!res.req.destroyed) {
        res.write('event: done\ndata: {}\n\n');
        res.end();
      }
    } finally {
      res.req.off('close', onClose);
    }
  }

  private async streamThread(
    thread: Thread,
    prompt: string,
    userId: string,
    res: Response,
    clientAbort: AbortSignal,
    location: PromptLocation | undefined,
  ): Promise<void> {
    const { id: threadId, model_id: modelId, model_config: modelConfig } = thread;
    // Accumulator is declared outside the try so the catch/finally can
    // persist whatever we received before an abort/error.
    let fullContent = '';
    // Web-search citations accumulated across all `url_citation` annotations
    // seen in the SSE stream. Deduped by URL before emit/persist.
    const citationsByUrl = new Map<string, Citation>();
    // Sentinel: have we already emitted a `citations` SSE event for this
    // thread? We push one as soon as any citations arrive so the client can
    // render them while the answer is still streaming.
    let citationsEmittedKey = '';

    // Transparently migrate retired model IDs
    const resolvedModelId = MODEL_MIGRATIONS[modelId] ?? modelId;
    if (resolvedModelId !== modelId) {
      this.logger.log(`Migrating model ${modelId} → ${resolvedModelId} for thread ${threadId}`);
      // Persist the update so future calls don't need the remap
      await this.supabase.db
        .from('threads')
        .update({ model_id: resolvedModelId })
        .eq('id', threadId);
    }

    // Load conversation history — most recent 40 messages, oldest first.
    // We order DESC + limit so Postgres can use the (thread_id, timestamp)
    // index and avoid sorting the full table, then reverse client-side so
    // the LLM receives them in chronological order.
    const { data: history } = await this.supabase.db
      .from('messages')
      .select('role, content')
      .eq('thread_id', threadId)
      .order('timestamp', { ascending: false })
      .limit(40);

    const historyMessages: Message[] = (history ?? [])
      .slice()
      .reverse()
      .map((m: Message) => ({ role: m.role, content: m.content }));

    // Compose the leading system message from two sources:
    //   1. model_config.system_prompt — per-thread user-set system prompt
    //      (previously silently dropped; wiring it in is correct).
    //   2. Location framing — invisible "you are answering a user located in
    //      {label}" instruction generated from the active PromptLocation.
    //
    // When both are present we join with a newline; either alone is fine.
    // Neither set → no system message, exact same wire shape as before.
    const userSystemPrompt =
      typeof modelConfig['system_prompt'] === 'string' && modelConfig['system_prompt'].trim()
        ? (modelConfig['system_prompt'] as string).trim()
        : null;
    const locationFraming = buildLocationFraming(location);
    const systemContent = [userSystemPrompt, locationFraming]
      .filter((s): s is string => Boolean(s))
      .join('\n\n');

    const messages: Message[] = systemContent
      ? [{ role: 'system', content: systemContent }, ...historyMessages]
      : historyMessages;

    // Look up model config for BYOK routing and validation
    const modelConfig_ = this.registry.findById(resolvedModelId);
    if (!modelConfig_) {
      this.logger.warn(`Model ${resolvedModelId} not found in provider registry — proceeding without BYOK routing`);
    }

    // Reasoning-family models (GPT-5.x, Claude Opus 4.7, …) reject
    // `temperature` with a 400 at the provider. OpenRouter advertises this
    // via supported_parameters — only send the field if we've confirmed
    // it's accepted. When the registry has no entry (baseline fallback
    // path), default to sending it: the BASELINE_REGISTRY models are
    // older non-reasoning ones that all accept temperature.
    const supportsTemperature =
      modelConfig_?.supportedParameters === undefined
        ? true
        : modelConfig_.supportedParameters.includes('temperature');

    // Decide whether to attach the openrouter:web_search server tool.
    //
    // CRITICAL — engine selection: we use `engine: "native"`, NOT the default
    // `"auto"`. Per OpenRouter docs, `user_location` is honored ONLY by the
    // native provider search; `auto` silently falls back to Exa (which
    // ignores user_location). For a GEO/SEO testing tool that fallback
    // defeats the entire point of the feature.
    //
    // Gate: model must be in WEB_SEARCH_CAPABLE (curated allowlist — OpenRouter
    // does not advertise web-search support through supported_parameters)
    // AND a location must be set. Without a location we skip the tool — this
    // is a location-testing feature, not a generic "enable web search" toggle.
    const useWebSearch = Boolean(
      location && modelConfig_?.supportsWebSearch,
    );

    this.logger.log(
      `[${threadId}] model=${resolvedModelId} temperature=${supportsTemperature ? 'on' : 'off'} ` +
        `location=${location?.country ?? 'none'} webSearch=${useWebSearch ? 'native' : 'off'}`,
    );

    try {
      let response: globalThis.Response | null = null;

      // Retry up to 3 times on 429 or transient network errors (connect timeout, etc.)
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          // Combine the per-attempt timeout with the client-disconnect signal
          // so closing the tab cancels in-flight fetches immediately.
          const signal = AbortSignal.any([clientAbort, AbortSignal.timeout(90_000)]);
          // Build body conditionally — see supportsTemperature above. The
          // shape stays identical for non-reasoning models, so this is a
          // strict superset of the previous behaviour.
          const requestBody: Record<string, unknown> = {
            model: resolvedModelId,
            messages,
            stream: true,
          };
          if (supportsTemperature) {
            requestBody.temperature =
              (modelConfig['temperature'] as number) ?? 0.7;
          }
          if (useWebSearch && location) {
            requestBody.tools = [
              {
                type: 'openrouter:web_search',
                parameters: {
                  engine: 'native',
                  max_results: 5,
                  user_location: {
                    type: 'approximate',
                    country: location.country,
                    ...(location.region ? { region: location.region } : {}),
                    ...(location.city ? { city: location.city } : {}),
                    ...(location.timezone ? { timezone: location.timezone } : {}),
                  },
                },
              },
            ];
          }

          response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            signal,
            headers: {
              Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://prompthub.app',
              'X-Title': 'PromptHub',
            },
            body: JSON.stringify(requestBody),
          });
        } catch (fetchErr) {
          // Retry transient network errors (connect timeout, DNS, etc.)
          if (attempt < 2) {
            const waitMs = (attempt + 1) * 3000; // 3s, 6s
            this.logger.warn(`Network error on attempt ${attempt + 1} for ${resolvedModelId}, retrying in ${waitMs}ms: ${String(fetchErr)}`);
            await new Promise((r) => setTimeout(r, waitMs));
            continue;
          }
          throw fetchErr;
        }

        if (response.status !== 429) break;

        const waitMs = (attempt + 1) * 2000; // 2s, 4s, 6s
        this.logger.warn(`429 rate-limit for ${resolvedModelId}, retrying in ${waitMs}ms (attempt ${attempt + 1})`);
        await new Promise((r) => setTimeout(r, waitMs));
      }

      if (!response || !response.ok || !response.body) {
        const errText = await response?.text() ?? 'No response';
        this.logger.error(`OpenRouter error for ${resolvedModelId}: ${errText}`);

        const status = response?.status ?? 0;
        let message = `Model error (${status || 'unknown'})`;

        if (status === 400) {
          message = `Invalid model ID or request (400): ${resolvedModelId}. Check OpenRouter's model list.`;
        } else if (status === 401 || status === 403) {
          message = 'OpenRouter authentication failed. Verify OPENROUTER_API_KEY is valid.';
        } else if (status === 402) {
          message = 'OpenRouter credits exhausted (402). Top up your OpenRouter account to continue.';
        } else if (status === 429) {
          message = 'Rate limited by model provider. Please retry in a few seconds.';
        }

        this.writeEvent(res, threadId, { type: 'error', message });
        return;
      }

      const reader = response!.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Cancel the reader immediately on client disconnect — otherwise a
      // slow LLM can leave us stuck in `await reader.read()` long after the
      // client tab is gone. We attach AFTER the reader exists; if abort
      // already fired in the small race window between fetch and here, the
      // very first `if (clientAbort.aborted) break;` at loop top catches it.
      const onClientAbort = (): void => {
        reader.cancel().catch(() => undefined);
      };
      clientAbort.addEventListener('abort', onClientAbort);

      try {
        while (true) {
          if (clientAbort.aborted) break;
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? ''; // keep incomplete line in buffer

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              // OpenRouter's delta carries `content` for normal tokens AND
              // `annotations` for citations / other server-tool outputs.
              // We parse both; we may also see consolidated annotations on
              // the final message object (`message.annotations`) — handle
              // that as a fallback when delta annotations are absent.
              const parsed = JSON.parse(data) as {
                choices?: Array<{
                  delta?: {
                    content?: string;
                    annotations?: Array<{
                      type?: string;
                      url_citation?: {
                        url?: string;
                        title?: string;
                        content?: string;
                      };
                    }>;
                  };
                  message?: {
                    annotations?: Array<{
                      type?: string;
                      url_citation?: {
                        url?: string;
                        title?: string;
                        content?: string;
                      };
                    }>;
                  };
                }>;
              };
              const choice = parsed.choices?.[0];
              const token = choice?.delta?.content;
              if (token) {
                fullContent += token;
                this.writeEvent(res, threadId, { type: 'token', token });
              }

              // Accumulate citations from delta.annotations and (fallback)
              // message.annotations. Dedupe by URL so multiple search calls
              // pointing at the same source don't double-render.
              const newAnnotations = [
                ...(choice?.delta?.annotations ?? []),
                ...(choice?.message?.annotations ?? []),
              ];
              if (newAnnotations.length > 0) {
                for (const ann of newAnnotations) {
                  if (ann.type !== 'url_citation') continue;
                  const u = ann.url_citation?.url;
                  if (!u) continue;
                  if (citationsByUrl.has(u)) continue;
                  citationsByUrl.set(u, {
                    url: u,
                    ...(ann.url_citation?.title ? { title: ann.url_citation.title } : {}),
                    ...(ann.url_citation?.content
                      ? { snippet: ann.url_citation.content }
                      : {}),
                    domain: safeHostname(u),
                  });
                }
                // Emit a fresh `citations` event whenever we've added a
                // new URL. We send the cumulative array each time so the
                // client just replaces its local copy; the deduped key
                // prevents redundant emits when the same set is repeated.
                const key = Array.from(citationsByUrl.keys()).sort().join('|');
                if (key !== citationsEmittedKey && citationsByUrl.size > 0) {
                  citationsEmittedKey = key;
                  this.writeEvent(res, threadId, {
                    type: 'citations',
                    citations: Array.from(citationsByUrl.values()),
                  });
                }
              }
            } catch {
              // malformed SSE line — skip
            }
          }
        }
      } finally {
        // Always detach the listener and release the lock; cancel the
        // underlying stream on abort so the upstream connection closes
        // cleanly.
        clientAbort.removeEventListener('abort', onClientAbort);
        if (clientAbort.aborted) {
          await reader.cancel().catch(() => undefined);
        }
        reader.releaseLock();
      }

      const finalCitations =
        citationsByUrl.size > 0 ? Array.from(citationsByUrl.values()) : null;

      // If the client aborted mid-stream, persist whatever we have but skip
      // the end event — the response is already closed.
      if (clientAbort.aborted) {
        await this.persistAssistantMessage(
          threadId,
          fullContent,
          location,
          finalCitations,
        );
        return;
      }

      // Save completed assistant message to Supabase
      const savedMessageId = await this.persistAssistantMessage(
        threadId,
        fullContent,
        location,
        finalCitations,
      );
      this.writeEvent(res, threadId, { type: 'end', messageId: savedMessageId });
    } catch (err) {
      // Persist whatever streamed before the failure so the user keeps the
      // partial answer even on network blips / mid-stream errors.
      const finalCitations =
        citationsByUrl.size > 0 ? Array.from(citationsByUrl.values()) : null;
      await this.persistAssistantMessage(threadId, fullContent, location, finalCitations);
      const isAbort = (err as Error).name === 'AbortError' || clientAbort.aborted;
      if (isAbort) {
        this.logger.log(`Stream aborted for thread ${threadId} (client disconnect)`);
        return;
      }
      this.logger.error(`Stream error for thread ${threadId}:`, err);
      this.writeEvent(res, threadId, { type: 'error', message: 'Stream failed' });
    }
  }

  /**
   * Insert the assistant's accumulated content as a message, returning the
   * new row's id (or undefined if there was nothing to save / the insert
   * failed). Used by both the happy path and the abort/error paths so
   * partial responses don't get lost.
   *
   * `location` is the locale stamp this turn ran under (null when unset).
   * `citations` is the deduped url_citation set from openrouter:web_search
   * (null when the model didn't search or isn't search-capable).
   */
  private async persistAssistantMessage(
    threadId: string,
    content: string,
    location: PromptLocation | undefined,
    citations: Citation[] | null,
  ): Promise<string | undefined> {
    if (!content) return undefined;
    try {
      const { data: saved, error } = await this.supabase.db
        .from('messages')
        .insert({
          thread_id: threadId,
          role: 'assistant',
          content,
          location: location ?? null,
          citations: citations ?? null,
        })
        .select('id')
        .single();
      if (error) {
        this.logger.error(`Failed to persist assistant message: ${error.message}`);
        return undefined;
      }
      return saved?.id as string | undefined;
    } catch (err) {
      this.logger.error(`Failed to persist assistant message:`, err);
      return undefined;
    }
  }

  private writeEvent(res: Response, threadId: string, data: object): void {
    try {
      res.write(`event: ${threadId}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      // client disconnected — ignore
    }
  }
}

/**
 * Best-effort host extraction for citation display. Falls back to undefined
 * if the URL doesn't parse — never throws.
 */
function safeHostname(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}
