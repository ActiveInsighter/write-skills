import type { ProblemDetails } from "../src/lib/contracts"
import type { RequestContext } from "./types"

export const MAX_BODY_BYTES = 750 * 1024

const PROBLEM_BASE = "https://write-skills.dev/problems"
const JSON_CONTENT_TYPE = "application/json; charset=utf-8"

type ProblemOptions = {
  code: string
  detail: string
  errors?: Record<string, string[]>
  status: number
  title: string
}

export class HttpProblem extends Error {
  readonly code: string
  readonly errors?: Record<string, string[]>
  readonly status: number
  readonly title: string

  constructor({ code, detail, errors, status, title }: ProblemOptions) {
    super(detail)
    this.name = "HttpProblem"
    this.code = code
    this.errors = errors
    this.status = status
    this.title = title
  }
}

export function badRequest(detail: string, code = "bad_request") {
  return new HttpProblem({
    code,
    detail,
    status: 400,
    title: "请求无效",
  })
}

export function forbidden(detail = "请求来源未通过校验") {
  return new HttpProblem({
    code: "forbidden",
    detail,
    status: 403,
    title: "禁止访问",
  })
}

export function unauthorized(detail = "请先登录") {
  return new HttpProblem({
    code: "unauthorized",
    detail,
    status: 401,
    title: "未登录",
  })
}

export function notFound(resource = "资源") {
  return new HttpProblem({
    code: "not_found",
    detail: `${resource}不存在`,
    status: 404,
    title: "未找到",
  })
}

export function conflict(detail: string, code = "revision_conflict") {
  return new HttpProblem({
    code,
    detail,
    status: 409,
    title: "状态冲突",
  })
}

export function validationProblem(errors: Record<string, string[]>) {
  return new HttpProblem({
    code: "validation_failed",
    detail: "请求字段未通过校验",
    errors,
    status: 422,
    title: "字段校验失败",
  })
}

export function methodNotAllowed(methods: string[]) {
  return new HttpProblem({
    code: "method_not_allowed",
    detail: `该资源仅支持：${methods.join(", ")}`,
    status: 405,
    title: "请求方法不受支持",
  })
}

export function jsonResponse(
  data: unknown,
  status = 200,
  headers?: HeadersInit,
) {
  const responseHeaders = new Headers(headers)
  responseHeaders.set("content-type", JSON_CONTENT_TYPE)
  responseHeaders.set("cache-control", "no-store")
  return new Response(JSON.stringify(data), {
    headers: responseHeaders,
    status,
  })
}

export function emptyResponse(status = 204, headers?: HeadersInit) {
  return new Response(null, { headers, status })
}

export function problemResponse(problem: HttpProblem, context: RequestContext) {
  const body: ProblemDetails = {
    type: `${PROBLEM_BASE}/${problem.code}`,
    title: problem.title,
    status: problem.status,
    detail: problem.message,
    instance: context.url.pathname,
    code: problem.code,
    requestId: context.requestId,
    ...(problem.errors ? { errors: problem.errors } : {}),
  }
  const headers =
    problem.status === 405
      ? { allow: problem.message.replace("该资源仅支持：", "") }
      : undefined
  return jsonResponse(body, problem.status, headers)
}

export function internalErrorResponse(context: RequestContext) {
  const body: ProblemDetails = {
    type: `${PROBLEM_BASE}/internal_error`,
    title: "服务器错误",
    status: 500,
    detail: "服务器暂时无法完成请求，请稍后重试",
    instance: context.url.pathname,
    code: "internal_error",
    requestId: context.requestId,
  }
  return jsonResponse(body, 500)
}

export function withSecurityHeaders(response: Response, requestId: string) {
  const headers = new Headers(response.headers)
  const contentType = headers.get("content-type") ?? ""
  const isHtml = contentType.toLowerCase().includes("text/html")

  headers.set("x-content-type-options", "nosniff")
  headers.set("x-frame-options", "DENY")
  headers.set("referrer-policy", "strict-origin-when-cross-origin")
  headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  )
  headers.set("cross-origin-opener-policy", "same-origin")
  headers.set("x-request-id", requestId)

  if (isHtml) {
    headers.set(
      "content-security-policy",
      [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "connect-src 'self'",
        "font-src 'self'",
        "worker-src 'self' blob:",
      ].join("; "),
    )
    headers.set("cache-control", "no-cache")
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
}

function isJsonContentType(value: string | null) {
  if (!value) return false
  const mediaType = value.split(";", 1)[0]?.trim().toLowerCase()
  return mediaType === "application/json" || mediaType?.endsWith("+json")
}

async function readBoundedBody(request: Request) {
  const contentLengthHeader = request.headers.get("content-length")
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader)
    if (!Number.isFinite(contentLength) || contentLength < 0) {
      throw badRequest("Content-Length 无效", "invalid_content_length")
    }
    if (contentLength > MAX_BODY_BYTES) {
      throw new HttpProblem({
        code: "body_too_large",
        detail: "JSON 请求体不能超过 750 KiB",
        status: 413,
        title: "请求体过大",
      })
    }
  }

  if (!request.body) return ""

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel("request body exceeds limit")
        throw new HttpProblem({
          code: "body_too_large",
          detail: "JSON 请求体不能超过 750 KiB",
          status: 413,
          title: "请求体过大",
        })
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(body)
}

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  if (!isJsonContentType(request.headers.get("content-type"))) {
    throw new HttpProblem({
      code: "unsupported_media_type",
      detail: "请求体必须使用 application/json",
      status: 415,
      title: "不支持的媒体类型",
    })
  }

  let text: string
  try {
    text = await readBoundedBody(request)
  } catch (error) {
    if (error instanceof HttpProblem) throw error
    if (error instanceof TypeError) {
      throw badRequest("请求体不是有效的 UTF-8 文本", "invalid_encoding")
    }
    throw error
  }

  if (!text.trim()) return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw badRequest("请求体不是有效的 JSON", "invalid_json")
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw badRequest("JSON 顶层必须是对象", "invalid_json_object")
  }
  return parsed as Record<string, unknown>
}

export async function assertOptionalEmptyJsonBody(request: Request) {
  if (!request.body) return
  const body = await readJsonObject(request)
  if (Object.keys(body).length > 0) {
    throw validationProblem({ $: ["该请求不接受字段"] })
  }
}

export function assertSameOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return
  const origin = request.headers.get("origin")
  if (!origin || origin !== new URL(request.url).origin) {
    throw forbidden()
  }
}

export function structuredError(
  context: RequestContext,
  error: unknown,
  durationMs: number,
) {
  const normalized =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { name: "UnknownError", message: String(error) }
  console.error(
    JSON.stringify({
      event: "request.failed",
      requestId: context.requestId,
      method: context.request.method,
      path: context.url.pathname,
      durationMs,
      error: normalized,
    }),
  )
}

export function structuredRequestLog(
  context: RequestContext,
  response: Response,
  durationMs: number,
) {
  console.log(
    JSON.stringify({
      event: "request.completed",
      requestId: context.requestId,
      method: context.request.method,
      path: context.url.pathname,
      status: response.status,
      durationMs,
    }),
  )
}
