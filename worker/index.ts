interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }>;
  run(): Promise<{ success: boolean; meta?: Record<string, unknown> }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<T[]>;
}

interface Env {
  DB: D1Database;
  APP_PASSWORD?: string;
}

type PromptRow = {
  id: string;
  title: string;
  content_html: string;
  content_text: string;
  description: string;
  tags_json: string;
  model: string;
  temperature: number;
  is_favorite: number;
  created_at: string;
  updated_at: string;
};

type VersionRow = {
  id: string;
  prompt_id: string;
  title: string;
  content_html: string;
  content_text: string;
  created_at: string;
};

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const SESSION_COOKIE = "write_skills_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_BODY_BYTES = 1_000_000;

function json(data: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extraHeaders } });
}

function error(message: string, status = 400) {
  return json({ error: message }, status);
}

function securityHeaders(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  headers.set("content-security-policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function parseCookies(request: Request) {
  const result = new Map<string, string>();
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index > 0) result.set(part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim()));
  }
  return result;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

function constantTimeEqual(a: string, b: string) {
  const max = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;
  for (let index = 0; index < max; index += 1) difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  return difference === 0;
}

async function createSession(secret: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = String(expiresAt);
  return `${payload}.${await sign(payload, secret)}`;
}

async function isAuthenticated(request: Request, env: Env) {
  if (!env.APP_PASSWORD) return true;
  const token = parseCookies(request).get(SESSION_COOKIE);
  if (!token) return false;
  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature || Number(expiresAt) <= Date.now() / 1000) return false;
  return constantTimeEqual(signature, await sign(expiresAt, env.APP_PASSWORD));
}

function validateOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) throw new Error("请求内容过大");
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new Error("请求内容过大");
  if (!text) return {};
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("请求格式无效");
  return parsed as Record<string, unknown>;
}

function cleanString(value: unknown, fallback = "", max = 200_000) {
  return typeof value === "string" ? value.trim().slice(0, max) : fallback;
}

function cleanTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 12))];
}

function mapPrompt(row: PromptRow) {
  let tags: string[] = [];
  try { tags = JSON.parse(row.tags_json) as string[]; } catch { tags = []; }
  return {
    id: row.id,
    title: row.title,
    contentHtml: row.content_html,
    contentText: row.content_text,
    description: row.description,
    tags,
    model: row.model,
    temperature: row.temperature,
    isFavorite: Boolean(row.is_favorite),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVersion(row: VersionRow) {
  return { id: row.id, promptId: row.prompt_id, title: row.title, contentHtml: row.content_html, contentText: row.content_text, createdAt: row.created_at };
}

async function getPrompt(db: D1Database, id: string) {
  return db.prepare("SELECT * FROM prompts WHERE id = ? LIMIT 1").bind(id).first<PromptRow>();
}

async function handleAuth(request: Request, env: Env, pathname: string) {
  if (pathname === "/api/auth/status" && request.method === "GET") {
    return json({ required: Boolean(env.APP_PASSWORD), authenticated: await isAuthenticated(request, env) });
  }
  if (pathname === "/api/auth/login" && request.method === "POST") {
    if (!env.APP_PASSWORD) return json({ required: false, authenticated: true });
    const body = await readJson(request);
    const password = cleanString(body.password, "", 512);
    if (!constantTimeEqual(password, env.APP_PASSWORD)) return error("密码错误", 401);
    const session = await createSession(env.APP_PASSWORD);
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    return json({ required: true, authenticated: true }, 200, {
      "set-cookie": `${SESSION_COOKIE}=${encodeURIComponent(session)}; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`,
    });
  }
  if (pathname === "/api/auth/logout" && request.method === "POST") {
    return json({ ok: true }, 200, { "set-cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
  }
  return null;
}

async function handlePrompts(request: Request, env: Env, url: URL) {
  const parts = url.pathname.split("/").filter(Boolean);
  const id = parts[2];
  const action = parts[3];

  if (url.pathname === "/api/prompts" && request.method === "GET") {
    const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
    const pattern = `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    const statement = query
      ? env.DB.prepare("SELECT * FROM prompts WHERE title LIKE ? ESCAPE '\\' OR content_text LIKE ? ESCAPE '\\' OR tags_json LIKE ? ESCAPE '\\' ORDER BY is_favorite DESC, updated_at DESC LIMIT 200").bind(pattern, pattern, pattern)
      : env.DB.prepare("SELECT * FROM prompts ORDER BY is_favorite DESC, updated_at DESC LIMIT 200");
    const { results } = await statement.all<PromptRow>();
    return json(results.map(mapPrompt));
  }

  if (url.pathname === "/api/prompts" && request.method === "POST") {
    const body = await readJson(request);
    const idValue = crypto.randomUUID();
    const now = new Date().toISOString();
    const title = cleanString(body.title, "未命名提示词", 200) || "未命名提示词";
    const html = cleanString(body.contentHtml, "<p></p>");
    const text = cleanString(body.contentText, "");
    const description = cleanString(body.description, "", 1000);
    const tags = cleanTags(body.tags);
    const model = cleanString(body.model, "通用", 100) || "通用";
    const temperature = Math.min(2, Math.max(0, Number(body.temperature ?? 0.7) || 0.7));
    const favorite = body.isFavorite === true ? 1 : 0;
    await env.DB.prepare("INSERT INTO prompts (id,title,content_html,content_text,description,tags_json,model,temperature,is_favorite,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind(idValue, title, html, text, description, JSON.stringify(tags), model, temperature, favorite, now, now).run();
    return json(mapPrompt((await getPrompt(env.DB, idValue))!), 201);
  }

  if (!id) return error("未找到接口", 404);
  const current = await getPrompt(env.DB, id);
  if (!current) return error("提示词不存在", 404);

  if (!action && request.method === "PATCH") {
    const body = await readJson(request);
    const title = cleanString(body.title, current.title, 200) || "未命名提示词";
    const html = cleanString(body.contentHtml, current.content_html);
    const text = cleanString(body.contentText, current.content_text);
    const description = cleanString(body.description, current.description, 1000);
    const tags = body.tags === undefined ? JSON.parse(current.tags_json) : cleanTags(body.tags);
    const model = cleanString(body.model, current.model, 100) || "通用";
    const temperature = body.temperature === undefined ? current.temperature : Math.min(2, Math.max(0, Number(body.temperature) || 0));
    const favorite = body.isFavorite === undefined ? current.is_favorite : body.isFavorite === true ? 1 : 0;
    const now = new Date().toISOString();
    await env.DB.prepare("UPDATE prompts SET title=?,content_html=?,content_text=?,description=?,tags_json=?,model=?,temperature=?,is_favorite=?,updated_at=? WHERE id=?")
      .bind(title, html, text, description, JSON.stringify(tags), model, temperature, favorite, now, id).run();
    return json(mapPrompt((await getPrompt(env.DB, id))!));
  }

  if (!action && request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM prompts WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  if (action === "duplicate" && request.method === "POST") {
    const copyId = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare("INSERT INTO prompts (id,title,content_html,content_text,description,tags_json,model,temperature,is_favorite,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,0,?,?)")
      .bind(copyId, `${current.title} - 副本`.slice(0, 200), current.content_html, current.content_text, current.description, current.tags_json, current.model, current.temperature, now, now).run();
    return json(mapPrompt((await getPrompt(env.DB, copyId))!), 201);
  }

  if (action === "versions" && request.method === "GET") {
    const { results } = await env.DB.prepare("SELECT * FROM prompt_versions WHERE prompt_id = ? ORDER BY created_at DESC LIMIT 50").bind(id).all<VersionRow>();
    return json(results.map(mapVersion));
  }

  if (action === "versions" && request.method === "POST") {
    const versionId = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare("INSERT INTO prompt_versions (id,prompt_id,title,content_html,content_text,created_at) VALUES (?,?,?,?,?,?)")
      .bind(versionId, id, current.title, current.content_html, current.content_text, now).run();
    const version = await env.DB.prepare("SELECT * FROM prompt_versions WHERE id = ?").bind(versionId).first<VersionRow>();
    return json(mapVersion(version!), 201);
  }

  return error("未找到接口", 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (!url.pathname.startsWith("/api/")) return securityHeaders(error("Not found", 404));
      if (!validateOrigin(request)) return securityHeaders(error("来源校验失败", 403));

      const authResponse = await handleAuth(request, env, url.pathname);
      if (authResponse) return securityHeaders(authResponse);
      if (!(await isAuthenticated(request, env))) return securityHeaders(error("未登录", 401));

      if (url.pathname === "/api/health" && request.method === "GET") return securityHeaders(json({ ok: true, service: "write-skills" }));
      if (url.pathname.startsWith("/api/prompts")) return securityHeaders(await handlePrompts(request, env, url));
      return securityHeaders(error("未找到接口", 404));
    } catch (reason) {
      console.error(reason);
      const message = reason instanceof SyntaxError ? "JSON 格式无效" : reason instanceof Error ? reason.message : "服务器错误";
      return securityHeaders(error(message, 500));
    }
  },
};
