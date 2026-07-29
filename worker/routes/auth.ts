import type { AuthState } from "../../src/lib/contracts"
import {
  clearSessionCookie,
  createSession,
  isAuthenticated,
  secureEqual,
  sessionCookie,
} from "../auth"
import {
  assertOptionalEmptyJsonBody,
  HttpProblem,
  jsonResponse,
  methodNotAllowed,
  readJsonObject,
} from "../http"
import type { RequestContext } from "../types"
import { parseLoginInput } from "../validation"

export async function handleAuthRoute(
  context: RequestContext,
): Promise<Response | null> {
  const { env, request, url } = context

  if (url.pathname === "/api/auth/status") {
    if (request.method !== "GET") throw methodNotAllowed(["GET"])
    const state: AuthState = {
      required: Boolean(env.APP_PASSWORD),
      authenticated: await isAuthenticated(request, env),
    }
    return jsonResponse(state)
  }

  if (url.pathname === "/api/auth/login") {
    if (request.method !== "POST") throw methodNotAllowed(["POST"])
    const input = parseLoginInput(await readJsonObject(request))
    if (!env.APP_PASSWORD) {
      return jsonResponse({
        required: false,
        authenticated: true,
      } satisfies AuthState)
    }
    if (!(await secureEqual(input.password, env.APP_PASSWORD))) {
      throw new HttpProblem({
        code: "invalid_credentials",
        detail: "密码错误",
        status: 401,
        title: "登录失败",
      })
    }
    const token = await createSession(env)
    return jsonResponse(
      { required: true, authenticated: true } satisfies AuthState,
      200,
      { "set-cookie": sessionCookie(token, url) },
    )
  }

  if (url.pathname === "/api/auth/logout") {
    if (request.method !== "POST") throw methodNotAllowed(["POST"])
    await assertOptionalEmptyJsonBody(request)
    return jsonResponse({ ok: true }, 200, {
      "set-cookie": clearSessionCookie(url),
    })
  }

  return null
}
