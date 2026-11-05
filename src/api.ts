import { useCallback, useEffect, useState } from "react";

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

// Last good response per GET path. Lets screens render instantly when you come back to them,
// while a fresh copy loads in the background (stale-while-revalidate).
const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const method = init?.method ?? (init?.body ? "POST" : "GET");
  const res = await fetch(`/api${path}`, {
    method,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? `Request failed (${res.status})`, res.status);
  if (method === "GET") cache.set(path, data);
  // A write (finishing a chapter, a quiz, a new group…) makes cached screens stale: refresh them quietly.
  else for (const key of cache.keys()) void prefetch(key);
  return data as T;
}

/** Warm the cache for a screen the user is likely to open next. Duplicate calls share one request. */
export function prefetch(path: string) {
  if (inflight.has(path)) return inflight.get(path);
  const p = api(path).catch(() => undefined).finally(() => inflight.delete(path));
  inflight.set(path, p);
  return p;
}

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(() => (path ? (cache.get(path) as T) ?? null : null));
  const [error, setError] = useState<ApiError | null>(null);
  const load = useCallback(async () => {
    if (!path) return;
    try { setData(await api<T>(path)); setError(null); }
    catch (e) { setError(e instanceof ApiError ? e : new ApiError(String(e), 0)); }
  }, [path]);
  useEffect(() => {
    if (path && cache.has(path)) setData(cache.get(path) as T);
    void load();
  }, [path, load]);
  return { data, error, loading: data == null && !error, reload: load };
}
