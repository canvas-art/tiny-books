export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Reads from the Worker. Only the snapshot and the book text go over the network. */
export async function request<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}
