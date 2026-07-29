import { exports as workerExports } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import type {
  AuthState,
  DocumentRecord,
  DocumentSummary,
  DocumentVersionSummary,
  FolderRecord,
  PageResult,
  ProblemDetails,
  RestoreVersionResponse,
} from "../../src/lib/contracts"

const ORIGIN = "https://editor.test"

type ApiOptions = {
  body?: unknown
  contentType?: string
  cookie?: string
  method?: string
  origin?: boolean
}

async function api(path: string, options: ApiOptions = {}) {
  const headers = new Headers({ Accept: "application/json" })
  if (options.origin !== false && options.method && options.method !== "GET") {
    headers.set("Origin", ORIGIN)
  }
  if (options.body !== undefined) {
    headers.set("Content-Type", options.contentType ?? "application/json")
  }
  if (options.cookie) headers.set("Cookie", options.cookie)

  return workerExports.default.fetch(`${ORIGIN}${path}`, {
    method: options.method,
    headers,
    body:
      options.body === undefined
        ? undefined
        : typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body),
  })
}

async function responseJson<T>(response: Response) {
  return response.json() as Promise<T>
}

async function login() {
  const response = await api("/api/auth/login", {
    method: "POST",
    body: { password: "test-password" },
  })
  expect(response.status).toBe(200)
  const cookie = response.headers.get("set-cookie")
  expect(cookie).toBeTruthy()
  return cookie!.split(";", 1)[0]!
}

describe("authentication and request policy", () => {
  it("requires login, validates credentials, and enforces same-origin writes", async () => {
    const statusResponse = await api("/api/auth/status")
    expect(statusResponse.status).toBe(200)
    expect(await responseJson<AuthState>(statusResponse)).toEqual({
      required: true,
      authenticated: false,
    })

    const protectedResponse = await api("/api/folders")
    expect(protectedResponse.status).toBe(401)
    expect((await responseJson<ProblemDetails>(protectedResponse)).code).toBe(
      "unauthorized",
    )

    const failedLogin = await api("/api/auth/login", {
      method: "POST",
      body: { password: "incorrect" },
    })
    expect(failedLogin.status).toBe(401)
    const failedProblem = await responseJson<ProblemDetails>(failedLogin)
    expect(failedProblem.code).toBe("invalid_credentials")
    expect(failedProblem.detail).not.toContain("test-password")

    const cookie = await login()
    const foldersResponse = await api("/api/folders", { cookie })
    expect(foldersResponse.status).toBe(200)

    const missingOrigin = await api("/api/folders", {
      method: "POST",
      body: { name: "Blocked" },
      cookie,
      origin: false,
    })
    expect(missingOrigin.status).toBe(403)

    const invalidContentType = await api("/api/folders", {
      method: "POST",
      body: "{}",
      contentType: "text/plain",
      cookie,
    })
    expect(invalidContentType.status).toBe(415)
  })

  it("rejects JSON bodies larger than 750 KiB", async () => {
    const response = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "x".repeat(750 * 1024) }),
    })
    expect(response.status).toBe(413)
    expect((await responseJson<ProblemDetails>(response)).code).toBe(
      "body_too_large",
    )
  })
})

describe("folders and documents", () => {
  it("supports folder trees, summary pagination, optimistic writes, trash, and duplicate", async () => {
    const cookie = await login()
    const parentResponse = await api("/api/folders", {
      method: "POST",
      body: { name: "Workspace" },
      cookie,
    })
    expect(parentResponse.status).toBe(201)
    const parent = await responseJson<FolderRecord>(parentResponse)

    const childResponse = await api("/api/folders", {
      method: "POST",
      body: { name: "Drafts", parentId: parent.id },
      cookie,
    })
    const child = await responseJson<FolderRecord>(childResponse)

    const cycleResponse = await api(
      `/api/folders/${encodeURIComponent(parent.id)}`,
      {
        method: "PATCH",
        body: { parentId: child.id },
        cookie,
      },
    )
    expect(cycleResponse.status).toBe(400)
    expect((await responseJson<ProblemDetails>(cycleResponse)).code).toBe(
      "folder_cycle",
    )

    const createResponse = await api("/api/documents", {
      method: "POST",
      body: {
        folderId: child.id,
        title: "First document",
        contentJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Hello" }],
            },
          ],
        },
        contentHtml: "<p>Hello</p>",
        contentText: "Hello",
        isFavorite: true,
      },
      cookie,
    })
    expect(createResponse.status).toBe(201)
    const created = await responseJson<DocumentRecord>(createResponse)
    expect(created.revision).toBe(1)

    const listResponse = await api(
      `/api/documents?folderId=${encodeURIComponent(child.id)}&page=1&pageSize=10`,
      { cookie },
    )
    const list = await responseJson<PageResult<DocumentSummary>>(listResponse)
    expect(list.total).toBe(1)
    expect(list.items[0]?.excerpt).toBe("Hello")
    expect(list.items[0]).not.toHaveProperty("contentHtml")

    const updateResponse = await api(
      `/api/documents/${encodeURIComponent(created.id)}`,
      {
        method: "PATCH",
        body: { expectedRevision: 1, title: "Updated document" },
        cookie,
      },
    )
    const updated = await responseJson<DocumentRecord>(updateResponse)
    expect(updated.revision).toBe(2)
    expect(updated.title).toBe("Updated document")

    const favorites = await responseJson<PageResult<DocumentSummary>>(
      await api("/api/documents?view=favorites&q=Updated", { cookie }),
    )
    expect(favorites.total).toBe(1)
    expect(favorites.items[0]?.id).toBe(created.id)

    const staleUpdate = await api(
      `/api/documents/${encodeURIComponent(created.id)}`,
      {
        method: "PATCH",
        body: { expectedRevision: 1, title: "Stale title" },
        cookie,
      },
    )
    expect(staleUpdate.status).toBe(409)
    expect((await responseJson<ProblemDetails>(staleUpdate)).code).toBe(
      "revision_conflict",
    )

    const trashResponse = await api(
      `/api/documents/${encodeURIComponent(created.id)}`,
      {
        method: "DELETE",
        body: { expectedRevision: 2 },
        cookie,
      },
    )
    const trashed = await responseJson<DocumentRecord>(trashResponse)
    expect(trashed.revision).toBe(3)
    expect(trashed.deletedAt).toBeTruthy()

    const activeList = await responseJson<PageResult<DocumentSummary>>(
      await api("/api/documents?view=all", { cookie }),
    )
    const trashList = await responseJson<PageResult<DocumentSummary>>(
      await api("/api/documents?view=trash", { cookie }),
    )
    expect(activeList.total).toBe(0)
    expect(trashList.total).toBe(1)

    const restoreResponse = await api(
      `/api/documents/${encodeURIComponent(created.id)}/restore`,
      {
        method: "POST",
        body: { expectedRevision: 3 },
        cookie,
      },
    )
    const restored = await responseJson<DocumentRecord>(restoreResponse)
    expect(restored.revision).toBe(4)
    expect(restored.deletedAt).toBeNull()

    const duplicateResponse = await api(
      `/api/documents/${encodeURIComponent(created.id)}/duplicate`,
      {
        method: "POST",
        body: { expectedRevision: 4 },
        cookie,
      },
    )
    const duplicate = await responseJson<DocumentRecord>(duplicateResponse)
    expect(duplicate.id).not.toBe(created.id)
    expect(duplicate.revision).toBe(1)
    expect(duplicate.title).toContain("副本")

    const parentDocument = await responseJson<DocumentRecord>(
      await api("/api/documents", {
        method: "POST",
        body: { folderId: parent.id, title: "Move with folder deletion" },
        cookie,
      }),
    )
    const deleteFolderResponse = await api(
      `/api/folders/${encodeURIComponent(parent.id)}`,
      {
        method: "DELETE",
        body: {},
        cookie,
      },
    )
    expect(deleteFolderResponse.status).toBe(200)
    const folders = await responseJson<FolderRecord[]>(
      await api("/api/folders", { cookie }),
    )
    expect(
      folders.find((folder) => folder.id === child.id)?.parentId,
    ).toBeNull()
    const movedDocument = await responseJson<DocumentRecord>(
      await api(`/api/documents/${parentDocument.id}`, { cookie }),
    )
    expect(movedDocument.folderId).toBeNull()
    expect(movedDocument.revision).toBe(2)
  })

  it("atomically rejects concurrent folder moves that would create a cycle", async () => {
    const cookie = await login()
    const [leftResponse, rightResponse] = await Promise.all([
      api("/api/folders", {
        method: "POST",
        body: { name: "Left" },
        cookie,
      }),
      api("/api/folders", {
        method: "POST",
        body: { name: "Right" },
        cookie,
      }),
    ])
    const [left, right] = await Promise.all([
      responseJson<FolderRecord>(leftResponse),
      responseJson<FolderRecord>(rightResponse),
    ])

    const moves = await Promise.all([
      api(`/api/folders/${encodeURIComponent(left.id)}`, {
        method: "PATCH",
        body: { parentId: right.id },
        cookie,
      }),
      api(`/api/folders/${encodeURIComponent(right.id)}`, {
        method: "PATCH",
        body: { parentId: left.id },
        cookie,
      }),
    ])

    expect(moves.map((response) => response.status).sort()).toEqual([200, 400])
    const rejected = moves.find((response) => response.status === 400)
    expect(rejected).toBeDefined()
    expect((await responseJson<ProblemDetails>(rejected!)).code).toBe(
      "folder_cycle",
    )

    const folders = await responseJson<FolderRecord[]>(
      await api("/api/folders", { cookie }),
    )
    const storedLeft = folders.find((folder) => folder.id === left.id)
    const storedRight = folders.find((folder) => folder.id === right.id)
    expect(
      storedLeft?.parentId === right.id && storedRight?.parentId === left.id,
    ).toBe(false)
  })

  it("only permanently deletes documents already in trash", async () => {
    const cookie = await login()
    const created = await responseJson<DocumentRecord>(
      await api("/api/documents", {
        method: "POST",
        body: { title: "Disposable" },
        cookie,
      }),
    )
    const activeDelete = await api(
      `/api/documents/${encodeURIComponent(created.id)}/permanent`,
      {
        method: "DELETE",
        body: { expectedRevision: 1 },
        cookie,
      },
    )
    expect(activeDelete.status).toBe(409)

    await api(`/api/documents/${encodeURIComponent(created.id)}`, {
      method: "DELETE",
      body: { expectedRevision: 1 },
      cookie,
    })
    const permanentDelete = await api(
      `/api/documents/${encodeURIComponent(created.id)}/permanent`,
      {
        method: "DELETE",
        body: { expectedRevision: 2 },
        cookie,
      },
    )
    expect(permanentDelete.status).toBe(200)
    expect(await responseJson(permanentDelete)).toEqual({ ok: true })

    const missing = await api(
      `/api/documents/${encodeURIComponent(created.id)}`,
      { cookie },
    )
    expect(missing.status).toBe(404)
  })
})

describe("document versions", () => {
  it("creates snapshots and snapshots the current document before restore", async () => {
    const cookie = await login()
    const created = await responseJson<DocumentRecord>(
      await api("/api/documents", {
        method: "POST",
        body: { title: "Version one" },
        cookie,
      }),
    )
    const manual = await responseJson<DocumentVersionSummary>(
      await api(`/api/documents/${encodeURIComponent(created.id)}/versions`, {
        method: "POST",
        body: { expectedRevision: 1, label: "Milestone" },
        cookie,
      }),
    )
    expect(manual.kind).toBe("manual")
    expect(manual.sourceRevision).toBe(1)

    const updated = await responseJson<DocumentRecord>(
      await api(`/api/documents/${encodeURIComponent(created.id)}`, {
        method: "PATCH",
        body: { expectedRevision: 1, title: "Version two" },
        cookie,
      }),
    )
    expect(updated.revision).toBe(2)

    const restore = await responseJson<RestoreVersionResponse>(
      await api(
        `/api/documents/${encodeURIComponent(created.id)}/versions/${encodeURIComponent(manual.id)}/restore`,
        {
          method: "POST",
          body: { expectedRevision: 2 },
          cookie,
        },
      ),
    )
    expect(restore.document.title).toBe("Version one")
    expect(restore.document.revision).toBe(3)
    expect(restore.snapshot.kind).toBe("before_restore")
    expect(restore.snapshot.sourceRevision).toBe(2)

    const versions = await responseJson<PageResult<DocumentVersionSummary>>(
      await api(`/api/documents/${encodeURIComponent(created.id)}/versions`, {
        cookie,
      }),
    )
    expect(versions.total).toBe(2)
    expect(versions.items.map((item) => item.kind).sort()).toEqual([
      "before_restore",
      "manual",
    ])
  })
})
