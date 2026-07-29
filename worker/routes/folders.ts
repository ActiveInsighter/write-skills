import {
  createFolder,
  deleteFolder,
  listFolders,
  updateFolder,
} from "../db/folders"
import {
  assertOptionalEmptyJsonBody,
  jsonResponse,
  methodNotAllowed,
  notFound,
  readJsonObject,
} from "../http"
import type { RequestContext } from "../types"
import {
  parseFolderCreate,
  parseFolderUpdate,
  parsePathId,
} from "../validation"

export async function handleFoldersRoute(
  context: RequestContext,
  segments: string[],
) {
  const { env, request } = context

  if (segments.length === 2) {
    if (request.method === "GET") {
      return jsonResponse(await listFolders(env.DB))
    }
    if (request.method === "POST") {
      const input = parseFolderCreate(await readJsonObject(request))
      return jsonResponse(await createFolder(env.DB, input), 201)
    }
    throw methodNotAllowed(["GET", "POST"])
  }

  if (segments.length !== 3) throw notFound("接口")
  const folderId = parsePathId(segments[2], "文件夹")
  if (request.method === "PATCH") {
    const input = parseFolderUpdate(await readJsonObject(request))
    return jsonResponse(await updateFolder(env.DB, folderId, input))
  }
  if (request.method === "DELETE") {
    await assertOptionalEmptyJsonBody(request)
    return jsonResponse(await deleteFolder(env.DB, folderId))
  }
  throw methodNotAllowed(["PATCH", "DELETE"])
}
