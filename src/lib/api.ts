/**
 * Shared API fetch helper that properly unwraps response envelopes.
 * All API routes return { documents: [...] }, { users: [...] }, { types: [...] }, etc.
 * This helper extracts the actual data from the envelope.
 */

const ENVELOPE_KEYS = [
  'documents', 'users', 'user', 'types', 'type', 'folders', 'folder',
  'document', 'success', 'results', 'data',
  'processes', 'process', 'tasks', 'task',
  'tags', 'tag',
] as const;

type EnvelopeKey = (typeof ENVELOPE_KEYS)[number];

function unwrapResponse<T>(json: Record<string, unknown>): T {
  // Try to find a known envelope key
  for (const key of ENVELOPE_KEYS) {
    if (key in json && json[key] !== undefined && json[key] !== null) {
      return json[key] as T;
    }
  }
  // If no known key, return the whole object
  return json as T;
}

export async function apiFetch<T>(
  url: string,
  token: string,
  options?: RequestInit
): Promise<T> {
  const separator = url.includes('?') ? '&' : '?';
  const res = await fetch(
    `${url}${separator}token=${encodeURIComponent(token)}`,
    {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Ошибка сервера' }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  const json = await res.json();
  return unwrapResponse<T>(json);
}
