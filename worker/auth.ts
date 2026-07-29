import type { RuntimeEnv } from "./types"

const SESSION_COOKIE = "write_skills_session"
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

function parseCookies(request: Request) {
  const cookies = new Map<string, string>()
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=")
    if (separator <= 0) continue
    const name = part.slice(0, separator).trim()
    const rawValue = part.slice(separator + 1).trim()
    try {
      cookies.set(name, decodeURIComponent(rawValue))
    } catch {
      // Ignore malformed cookies instead of failing the whole request.
    }
  }
  return cookies
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "")
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  )
  return bytesToBase64Url(new Uint8Array(signature))
}

export async function secureEqual(a: string, b: string) {
  const encoder = new TextEncoder()
  const [aHash, bHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ])
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual(
      left: ArrayBuffer | ArrayBufferView,
      right: ArrayBuffer | ArrayBufferView,
    ): boolean
  }
  return subtle.timingSafeEqual(aHash, bHash)
}

function getSessionSecret(env: RuntimeEnv) {
  return env.SESSION_SECRET ?? env.APP_PASSWORD
}

export async function createSession(env: RuntimeEnv) {
  const secret = getSessionSecret(env)
  if (!secret) throw new Error("Session requested without a session secret")
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  const nonceBytes = new Uint8Array(16)
  crypto.getRandomValues(nonceBytes)
  const payload = `${expiresAt}.${bytesToBase64Url(nonceBytes)}`
  return `${payload}.${await sign(payload, secret)}`
}

export async function isAuthenticated(request: Request, env: RuntimeEnv) {
  if (!env.APP_PASSWORD) return true
  const secret = getSessionSecret(env)
  if (!secret) return false
  const token = parseCookies(request).get(SESSION_COOKIE)
  if (!token) return false
  const parts = token.split(".")
  if (parts.length !== 3) return false
  const [expiresAtRaw, nonce, signature] = parts
  const expiresAt = Number(expiresAtRaw)
  if (
    !expiresAtRaw ||
    !nonce ||
    !signature ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Date.now() / 1000
  ) {
    return false
  }
  const expected = await sign(`${expiresAtRaw}.${nonce}`, secret)
  return secureEqual(signature, expected)
}

export function sessionCookie(token: string, requestUrl: URL) {
  const secure = requestUrl.protocol === "https:" ? "; Secure" : ""
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`
}

export function clearSessionCookie(requestUrl: URL) {
  const secure = requestUrl.protocol === "https:" ? "; Secure" : ""
  return `${SESSION_COOKIE}=; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=0`
}
