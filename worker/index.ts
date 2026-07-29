import { isAuthenticated } from "./auth"
import {
  assertSameOrigin,
  emptyResponse,
  HttpProblem,
  internalErrorResponse,
  jsonResponse,
  notFound,
  problemResponse,
  structuredError,
  structuredRequestLog,
  unauthorized,
  withSecurityHeaders,
} from "./http"
import { handleAuthRoute } from "./routes/auth"
import { handleDocumentsRoute } from "./routes/documents"
import { handleFoldersRoute } from "./routes/folders"
import type { RequestContext, RuntimeEnv } from "./types"

async function routeApi(context: RequestContext) {
  const { request, url } = context
  assertSameOrigin(request)

  if (request.method === "OPTIONS") return emptyResponse()

  const authResponse = await handleAuthRoute(context)
  if (authResponse) return authResponse

  if (url.pathname === "/api/health") {
    if (request.method !== "GET") {
      throw new HttpProblem({
        code: "method_not_allowed",
        detail: "该资源仅支持：GET",
        status: 405,
        title: "请求方法不受支持",
      })
    }
    return jsonResponse({ ok: true, service: "write-skills" })
  }

  if (!(await isAuthenticated(request, context.env))) throw unauthorized()

  const segments = url.pathname.split("/").filter(Boolean)
  if (segments[0] !== "api") throw notFound("接口")
  if (segments[1] === "folders") {
    const response = await handleFoldersRoute(context, segments)
    return response
  }
  if (segments[1] === "documents") {
    const response = await handleDocumentsRoute(context, segments)
    return response
  }
  throw notFound("接口")
}

async function handleRequest(context: RequestContext) {
  if (context.url.pathname.startsWith("/api/")) {
    const response = await routeApi(context)
    return response
  }
  const response = await context.env.ASSETS.fetch(context.request)
  return response
}

export default {
  async fetch(request: Request, env: RuntimeEnv): Promise<Response> {
    const startedAt = Date.now()
    const context: RequestContext = {
      env,
      request,
      requestId: request.headers.get("cf-ray") ?? crypto.randomUUID(),
      url: new URL(request.url),
    }

    let response: Response
    try {
      response = await handleRequest(context)
    } catch (error) {
      if (error instanceof HttpProblem) {
        response = problemResponse(error, context)
      } else {
        structuredError(context, error, Date.now() - startedAt)
        response = internalErrorResponse(context)
      }
    }

    const secured = withSecurityHeaders(response, context.requestId)
    structuredRequestLog(context, secured, Date.now() - startedAt)
    return secured
  },
} satisfies ExportedHandler<Env>
