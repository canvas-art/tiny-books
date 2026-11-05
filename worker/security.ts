import type { MiddlewareHandler } from "hono";
import { secureHeaders } from "hono/secure-headers";

export type SecurityBindings = { RATE_LIMIT: RateLimit };

/** Runs before every route: security headers and a per-IP rate limit. */
export const baseProtection: MiddlewareHandler<{ Bindings: SecurityBindings }>[] = [
  secureHeaders(),
  async (c, next) => {
    const { success } = await c.env.RATE_LIMIT.limit({ key: c.req.header("cf-connecting-ip") ?? "local" });
    if (!success) return c.json({ error: "Too many requests. Try again in a minute." }, 429, { "Retry-After": "60" });
    await next();
  },
];

export const validId = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) > 0;
