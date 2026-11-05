import type { Context, MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { getCookie, setCookie } from "hono/cookie";
import { secureHeaders } from "hono/secure-headers";

export type SecurityBindings = {
  /** Secret. Set with `wrangler secret put ACCESS_CODE`, and in .dev.vars for local dev. */
  ACCESS_CODE?: string;
  RATE_READ: RateLimit;
  RATE_WRITE: RateLimit;
  RATE_ACCESS: RateLimit;
};

type C = { Bindings: SecurityBindings };

const COOKIE = "tb_access";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const MAX_BODY_BYTES = 16 * 1024;
const encoder = new TextEncoder();

const sha256 = (s: string) => crypto.subtle.digest("SHA-256", encoder.encode(s));

/** Constant-time comparison. Hashing first gives both sides the same length. */
async function safeEqual(a: string, b: string) {
  return crypto.subtle.timingSafeEqual(await sha256(a), await sha256(b));
}

/** The cookie holds a signature, never the code, and changing the code invalidates every cookie. */
async function accessToken(code: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(code), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode("tiny-books-access-v1"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hasAccess(c: Context<C>) {
  const code = c.env.ACCESS_CODE;
  const cookie = getCookie(c, COOKIE);
  return !!code && !!cookie && safeEqual(cookie, await accessToken(code));
}

async function overLimit(limiter: RateLimit, c: Context<C>) {
  const { success } = await limiter.limit({ key: c.req.header("cf-connecting-ip") ?? "local" });
  return !success;
}

const tooMany = (c: Context<C>) => c.json({ error: "Too many requests. Try again in a minute." }, 429, { "Retry-After": "60" });

const isWrite = (c: Context<C>) => c.req.method !== "GET" && c.req.method !== "HEAD";

/** Runs before everything else: headers, a general rate limit, the origin check and the body size cap. */
export const baseProtection: MiddlewareHandler<C>[] = [
  secureHeaders(),
  async (c, next) => {
    if (await overLimit(isWrite(c) ? c.env.RATE_WRITE : c.env.RATE_READ, c)) return tooMany(c);
    await next();
  },
  async (c, next) => {
    // Browsers always send Origin on cross-site writes, so other sites can't post with a visitor's cookie.
    const origin = c.req.header("origin");
    if (isWrite(c) && origin && new URL(origin).host !== new URL(c.req.url).host) return c.json({ error: "Forbidden" }, 403);
    await next();
  },
  bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.json({ error: "Request too large" }, 413) }),
];

export const accessStatus: MiddlewareHandler<C> = async (c) => c.json({ granted: await hasAccess(c) });

/** Exchanges the access code for a cookie. */
export const grantAccess: MiddlewareHandler<C> = async (c) => {
  if (await overLimit(c.env.RATE_ACCESS, c)) return tooMany(c);
  const expected = c.env.ACCESS_CODE;
  if (!expected) return c.json({ error: "Access isn't configured yet" }, 503);
  const body = await readBody<{ code: string }>(c);
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!(await safeEqual(code, expected))) return c.json({ error: "That code isn't right" }, 401);
  setCookie(c, COOKIE, await accessToken(expected), {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Strict",
    path: "/api",
    maxAge: COOKIE_MAX_AGE,
  });
  return c.json({ granted: true });
};

/** Every route registered after this one needs the access cookie. Fails closed if no code is configured. */
export const requireAccess: MiddlewareHandler<C> = async (c, next) => {
  if (!(await hasAccess(c))) return c.json({ error: "Access code required" }, 401);
  await next();
};

/** Parses a JSON body. Anything malformed comes back as {}, so route validation answers with a 400. */
export async function readBody<T extends object>(c: Context): Promise<Partial<T>> {
  try {
    const body = await c.req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : {};
  } catch {
    return {};
  }
}

export const validId = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) > 0;
