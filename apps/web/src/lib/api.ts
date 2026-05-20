/**
 * Typed API client for PromptHub backend.
 * All functions take a `getToken` function from Clerk's useAuth() hook.
 */

import type { Session, Thread, Message, ProviderConfig } from '@prompthub/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type GetToken = () => Promise<string | null>;

async function request<T>(
  getToken: GetToken,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${options.method ?? 'GET'} ${path} → ${res.status}: ${body}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export function getSessions(getToken: GetToken, search?: string): Promise<Session[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  return request<Session[]>(getToken, `/sessions${qs}`);
}

export function getSession(getToken: GetToken, id: string): Promise<Session> {
  return request<Session>(getToken, `/sessions/${id}`);
}

export function createSession(
  getToken: GetToken,
  body: { name: string; tags?: string[]; activeProviders?: string[] },
): Promise<Session> {
  return request<Session>(getToken, '/sessions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateSession(
  getToken: GetToken,
  id: string,
  body: Partial<{ name: string; tags: string[]; activeProviders: string[] }>,
): Promise<Session> {
  return request<Session>(getToken, `/sessions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteSession(getToken: GetToken, id: string): Promise<void> {
  return request<void>(getToken, `/sessions/${id}`, { method: 'DELETE' });
}

// ─── Providers ───────────────────────────────────────────────────────────────

export function getProviders(getToken: GetToken): Promise<ProviderConfig[]> {
  return request<ProviderConfig[]>(getToken, '/providers');
}

// ─── Threads ─────────────────────────────────────────────────────────────────

export function createThread(
  getToken: GetToken,
  body: { sessionId: string; modelId: string; displayName: string; provider: string; modelConfig?: Record<string, unknown> },
): Promise<Thread> {
  return request<Thread>(getToken, '/threads', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateThread(
  getToken: GetToken,
  id: string,
  body: { modelId: string; displayName: string; modelConfig?: Record<string, unknown> },
): Promise<Thread> {
  return request<Thread>(getToken, `/threads/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteThread(getToken: GetToken, id: string): Promise<void> {
  return request<void>(getToken, `/threads/${id}`, { method: 'DELETE' });
}

// ─── Highlights ──────────────────────────────────────────────────────────────

export function getHighlights(getToken: GetToken, sessionId: string): Promise<Message[]> {
  return request<Message[]>(getToken, `/sessions/${sessionId}/highlights`);
}

export function toggleBookmark(getToken: GetToken, messageId: string): Promise<Message> {
  return request<Message>(getToken, `/messages/${messageId}/bookmark`, { method: 'PATCH' });
}
