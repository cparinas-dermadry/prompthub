import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { SupabaseService } from '../supabase/supabase.service.js';
import { PROVIDER_REGISTRY } from '../providers/provider-config.js';

/**
 * Remap retired/broken model IDs to their current replacements.
 * Applied transparently before every OpenRouter call and persisted to the DB.
 */
const MODEL_MIGRATIONS: Record<string, string> = {
  // Hyphen vs dot — OpenRouter uses dot notation for 4.x models
  'anthropic/claude-sonnet-4-5': 'anthropic/claude-sonnet-4.5',
  // Legacy Anthropic names
  'anthropic/claude-lite': 'anthropic/claude-haiku-4.5',
  // claude-3.5-haiku has no Anthropic direct provider on OpenRouter (only amazon-bedrock/google-vertex)
  'anthropic/claude-3.5-haiku': 'anthropic/claude-haiku-4.5',
  // Google — gemini-2.0-flash-001 retiring June 1 2026; gemini-1.5 family deprecated
  'google/gemini-2.0-flash-001': 'google/gemini-3.5-flash',
  'google/gemini-1.5-pro': 'google/gemini-2.5-pro',
  'google/gemini-1.5-pro-002': 'google/gemini-2.5-pro',
  'google/gemini-1.5-flash': 'google/gemini-3.5-flash',
  'google/gemini-1.5-flash-002': 'google/gemini-3.5-flash',
  'google/gemini-pro': 'google/gemini-3.5-flash',
  // DeepSeek
  'deepseek/deepseek-r1:free': 'deepseek/deepseek-v4-flash:free',
  'deepseek/deepseek-chat-v3-0324:free': 'deepseek/deepseek-v4-flash:free',
  // Google open models
  'google/gemma-3-12b-it:free': 'google/gemma-4-31b-it:free',
  // Mistral
  'mistralai/mistral-7b-instruct:free': 'meta-llama/llama-3.3-70b-instruct:free',
};

interface Thread {
  id: string;
  model_id: string;
  model_config: Record<string, unknown>;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async fanOut(
    sessionId: string,
    prompt: string,
    threadIds: string[],
    userId: string,
    res: Response,
  ): Promise<void> {
    // Verify session ownership
    const { data: session } = await this.supabase.db
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (!session) {
      res.status(404).end();
      return;
    }

    // Load threads
    const { data: threads } = await this.supabase.db
      .from('threads')
      .select('id, model_id, model_config')
      .in('id', threadIds)
      .eq('session_id', sessionId);

    if (!threads || threads.length === 0) {
      res.status(404).end();
      return;
    }

    // Save user message to all threads
    await this.supabase.db.from('messages').insert(
      threads.map((t: Thread) => ({
        thread_id: t.id,
        role: 'user',
        content: prompt,
      })),
    );

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // When the client disconnects, abort every in-flight OpenRouter request
    // so we stop burning credits/tokens for output nobody will ever see.
    // Each streamThread also persists whatever it accumulated up to that
    // point, so the user's history isn't lost on a flaky tab close.
    const abortController = new AbortController();
    const onClose = (): void => abortController.abort();
    res.req.on('close', onClose);

    try {
      // Fan out — fire all model requests concurrently, don't await all
      await Promise.allSettled(
        threads.map((thread: Thread) =>
          this.streamThread(thread, prompt, userId, res, abortController.signal),
        ),
      );

      // Only emit the done event if the client is still listening
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
  ): Promise<void> {
    const { id: threadId, model_id: modelId, model_config: modelConfig } = thread;
    // Accumulator is declared outside the try so the catch/finally can
    // persist whatever we received before an abort/error.
    let fullContent = '';

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

    const messages: Message[] = (history ?? [])
      .slice()
      .reverse()
      .map((m: Message) => ({ role: m.role, content: m.content }));

    // Look up model config for BYOK routing and validation
    const modelConfig_ = PROVIDER_REGISTRY.find((p) => p.id === resolvedModelId);
    if (!modelConfig_) {
      this.logger.warn(`Model ${resolvedModelId} not found in PROVIDER_REGISTRY — proceeding without BYOK routing`);
    }

    const byokOnly = modelConfig_?.byokOnly ?? false;
    const openRouterProvider = modelConfig_?.openRouterProvider;

    if (byokOnly && !openRouterProvider) {
      this.logger.error(`Model ${resolvedModelId} has byokOnly=true but openRouterProvider is missing`);
      this.writeEvent(res, threadId, { type: 'error', message: 'Server config error: missing openRouterProvider for BYOK model' });
      return;
    }

    this.logger.log(
      `[${threadId}] model=${resolvedModelId} provider=${openRouterProvider ?? 'any'} byokOnly=${byokOnly} providerOnly=${byokOnly ? 'yes' : 'no'}`
    );

    try {
      let response: globalThis.Response | null = null;

      // Retry up to 3 times on 429 or transient network errors (connect timeout, etc.)
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          // Combine the per-attempt timeout with the client-disconnect signal
          // so closing the tab cancels in-flight fetches immediately.
          const signal = AbortSignal.any([clientAbort, AbortSignal.timeout(90_000)]);
          response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            signal,
            headers: {
              Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://prompthub.app',
              'X-Title': 'PromptHub',
            },
            body: JSON.stringify({
              model: resolvedModelId,
              messages,
              stream: true,
              temperature: (modelConfig['temperature'] as number) ?? 0.7,
              // Force BYOK provider routing — only when configured
              ...(byokOnly && openRouterProvider
                ? { provider: { only: [openRouterProvider] } }
                : {}),
            }),
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
          message = byokOnly
            ? `BYOK provider "${openRouterProvider ?? '?'}" rejected the request (402). Verify your provider key is active in OpenRouter BYOK settings.`
            : 'OpenRouter credits unavailable (402). Add BYOK keys in OpenRouter settings or purchase credits.';
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
              const parsed = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const token = parsed.choices?.[0]?.delta?.content;
              if (token) {
                fullContent += token;
                this.writeEvent(res, threadId, { type: 'token', token });
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

      // If the client aborted mid-stream, persist whatever we have but skip
      // the end event — the response is already closed.
      if (clientAbort.aborted) {
        await this.persistAssistantMessage(threadId, fullContent);
        return;
      }

      // Save completed assistant message to Supabase
      const savedMessageId = await this.persistAssistantMessage(threadId, fullContent);
      this.writeEvent(res, threadId, { type: 'end', messageId: savedMessageId });
    } catch (err) {
      // Persist whatever streamed before the failure so the user keeps the
      // partial answer even on network blips / mid-stream errors.
      await this.persistAssistantMessage(threadId, fullContent);
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
   */
  private async persistAssistantMessage(
    threadId: string,
    content: string,
  ): Promise<string | undefined> {
    if (!content) return undefined;
    try {
      const { data: saved, error } = await this.supabase.db
        .from('messages')
        .insert({
          thread_id: threadId,
          role: 'assistant',
          content,
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
