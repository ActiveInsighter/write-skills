import {
  createDocument,
  duplicateDocument,
  getDocument,
  listDocuments,
  permanentlyDeleteDocument,
  restoreDocument,
  softDeleteDocument,
  updateDocument,
} from "../db/documents"
import { createVersion, listVersions, restoreVersion } from "../db/versions"
import {
  jsonResponse,
  methodNotAllowed,
  notFound,
  readJsonObject,
} from "../http"
import type { RequestContext } from "../types"
import {
  parseDocumentCreate,
  parseDocumentListQuery,
  parseDocumentUpdate,
  parseDuplicateInput,
  parsePaginationQuery,
  parsePathId,
  parseRevisionInput,
  parseVersionCreate,
} from "../validation"

export async function handleDocumentsRoute(
  context: RequestContext,
  segments: string[],
) {
  const { env, request, url } = context

  if (segments.length === 2) {
    if (request.method === "GET") {
      return jsonResponse(
        await listDocuments(env.DB, parseDocumentListQuery(url)),
      )
    }
    if (request.method === "POST") {
      const input = parseDocumentCreate(await readJsonObject(request))
      return jsonResponse(await createDocument(env.DB, input), 201)
    }
    throw methodNotAllowed(["GET", "POST"])
  }

  const documentId = parsePathId(segments[2], "文档")
  if (segments.length === 3) {
    if (request.method === "GET") {
      return jsonResponse(await getDocument(env.DB, documentId))
    }
    if (request.method === "PATCH") {
      const input = parseDocumentUpdate(await readJsonObject(request))
      return jsonResponse(await updateDocument(env.DB, documentId, input))
    }
    if (request.method === "DELETE") {
      const { expectedRevision } = parseRevisionInput(
        await readJsonObject(request),
      )
      return jsonResponse(
        await softDeleteDocument(env.DB, documentId, expectedRevision),
      )
    }
    throw methodNotAllowed(["GET", "PATCH", "DELETE"])
  }

  const action = segments[3]
  if (action === "restore" && segments.length === 4) {
    if (request.method !== "POST") throw methodNotAllowed(["POST"])
    const { expectedRevision } = parseRevisionInput(
      await readJsonObject(request),
    )
    return jsonResponse(
      await restoreDocument(env.DB, documentId, expectedRevision),
    )
  }

  if (action === "permanent" && segments.length === 4) {
    if (request.method !== "DELETE") throw methodNotAllowed(["DELETE"])
    const { expectedRevision } = parseRevisionInput(
      await readJsonObject(request),
    )
    return jsonResponse(
      await permanentlyDeleteDocument(env.DB, documentId, expectedRevision),
    )
  }

  if (action === "duplicate" && segments.length === 4) {
    if (request.method !== "POST") throw methodNotAllowed(["POST"])
    const input = parseDuplicateInput(await readJsonObject(request))
    return jsonResponse(await duplicateDocument(env.DB, documentId, input), 201)
  }

  if (action === "versions" && segments.length === 4) {
    if (request.method === "GET") {
      const { page, pageSize } = parsePaginationQuery(url)
      return jsonResponse(
        await listVersions(env.DB, documentId, page, pageSize),
      )
    }
    if (request.method === "POST") {
      const input = parseVersionCreate(await readJsonObject(request))
      return jsonResponse(await createVersion(env.DB, documentId, input), 201)
    }
    throw methodNotAllowed(["GET", "POST"])
  }

  if (
    action === "versions" &&
    segments.length === 6 &&
    segments[5] === "restore"
  ) {
    if (request.method !== "POST") throw methodNotAllowed(["POST"])
    const versionId = parsePathId(segments[4], "版本")
    const { expectedRevision } = parseRevisionInput(
      await readJsonObject(request),
    )
    return jsonResponse(
      await restoreVersion(env.DB, documentId, versionId, expectedRevision),
    )
  }

  throw notFound("接口")
}
