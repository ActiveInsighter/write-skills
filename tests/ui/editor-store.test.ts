import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { DocumentRecord, FolderRecord } from "@/lib/contracts"
import { useEditorStore } from "@/stores/editor-store"
import { makeDocument, makePage, makeSession, makeSummary } from "./fixtures"

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function requestPath(input: RequestInfo | URL) {
  if (typeof input === "string") return input
  if (input instanceof URL) return `${input.pathname}${input.search}`
  const url = new URL(input.url)
  return `${url.pathname}${url.search}`
}

describe("editor store", () => {
  const initialState = useEditorStore.getInitialState()
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

  beforeEach(() => {
    localStorage.clear()
    useEditorStore.setState(initialState, true)
    fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    useEditorStore.setState(initialState, true)
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("initializes the library and opens the first server document", async () => {
    const document = makeDocument()
    const summary = makeSummary(document)

    fetchMock.mockImplementation(async (input) => {
      const path = requestPath(input)
      if (path === "/api/auth/status") {
        return jsonResponse({ required: true, authenticated: true })
      }
      if (path === "/api/folders") return jsonResponse([])
      if (path === "/api/documents?view=all&page=1&pageSize=100") {
        return jsonResponse(makePage([summary]))
      }
      if (path === "/api/documents?view=trash&page=1&pageSize=100") {
        return jsonResponse(makePage([]))
      }
      if (path === `/api/documents/${document.id}`) {
        return jsonResponse(document)
      }
      throw new Error(`Unexpected request: ${path}`)
    })

    await useEditorStore.getState().initialize()

    const state = useEditorStore.getState()
    expect(state.booting).toBe(false)
    expect(state.bootError).toBeNull()
    expect(state.auth).toEqual({ required: true, authenticated: true })
    expect(state.documents).toEqual([summary])
    expect(state.activeId).toBe(document.id)
    expect(state.openTabs).toEqual([document.id])
    expect(state.sessions[document.id]).toMatchObject({
      document,
      dirty: false,
      localVersion: 0,
      saveState: "idle",
    })
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it("updates a draft synchronously and marks its session dirty", () => {
    const document = makeDocument()
    useEditorStore.setState({
      documents: [makeSummary(document)],
      sessions: { [document.id]: makeSession(document) },
      activeId: document.id,
      openTabs: [document.id],
    })

    useEditorStore.getState().updateDraft(document.id, {
      title: "重写后的标题",
      contentText: "新的正文摘要",
    })

    const state = useEditorStore.getState()
    const session = state.sessions[document.id]
    expect(session.document).toMatchObject({
      title: "重写后的标题",
      contentText: "新的正文摘要",
    })
    expect(session).toMatchObject({
      dirty: true,
      localVersion: 1,
      saveState: "dirty",
      error: null,
    })
    expect(state.documents[0]).toMatchObject({
      id: document.id,
      title: "重写后的标题",
      excerpt: "新的正文摘要",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("serializes saves and persists edits made while a request is in flight", async () => {
    const document = makeDocument()
    const firstSave = deferred<Response>()
    const requestBodies: Array<Record<string, unknown>> = []

    fetchMock.mockImplementation(async (input, init) => {
      const path = requestPath(input)
      if (
        path !== `/api/documents/${document.id}` ||
        init?.method !== "PATCH"
      ) {
        throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${path}`)
      }

      const body = JSON.parse(String(init.body)) as Record<string, unknown>
      requestBodies.push(body)
      if (requestBodies.length === 1) return firstSave.promise

      return jsonResponse({
        ...document,
        ...body,
        revision: 3,
        updatedAt: "2026-07-29T08:02:00.000Z",
      } satisfies DocumentRecord)
    })

    useEditorStore.setState({
      documents: [makeSummary(document)],
      sessions: { [document.id]: makeSession(document) },
      activeId: document.id,
      openTabs: [document.id],
    })

    useEditorStore.getState().updateDraft(document.id, { title: "第一次编辑" })

    const save = useEditorStore.getState().saveDocument(document.id)
    const duplicateSave = useEditorStore.getState().saveDocument(document.id)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    useEditorStore
      .getState()
      .updateDraft(document.id, { title: "请求期间的第二次编辑" })

    firstSave.resolve(
      jsonResponse({
        ...document,
        title: "第一次编辑",
        revision: 2,
        updatedAt: "2026-07-29T08:01:00.000Z",
      }),
    )

    await Promise.all([save, duplicateSave])

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(requestBodies).toEqual([
      expect.objectContaining({
        expectedRevision: 1,
        title: "第一次编辑",
      }),
      expect.objectContaining({
        expectedRevision: 2,
        title: "请求期间的第二次编辑",
      }),
    ])

    const session = useEditorStore.getState().sessions[document.id]
    expect(session.document).toMatchObject({
      title: "请求期间的第二次编辑",
      revision: 3,
    })
    expect(session).toMatchObject({
      dirty: false,
      localVersion: 2,
      saveState: "saved",
      error: null,
      lastSavedAt: "2026-07-29T08:02:00.000Z",
    })
  })

  it("rolls back the active tab when opening a document fails", async () => {
    const current = makeDocument()
    const unavailable = makeDocument({
      id: "document-2",
      title: "暂时不可用",
    })
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          title: "服务不可用",
          status: 503,
          detail: "D1 暂时不可用",
        },
        503,
      ),
    )
    useEditorStore.setState({
      documents: [makeSummary(current), makeSummary(unavailable)],
      sessions: { [current.id]: makeSession(current) },
      activeId: current.id,
      openTabs: [current.id],
    })

    await expect(
      useEditorStore.getState().openDocument(unavailable.id),
    ).rejects.toThrow("D1 暂时不可用")

    expect(useEditorStore.getState()).toMatchObject({
      activeId: current.id,
      openTabs: [current.id],
      loadingDocumentId: null,
    })
  })

  it("opens a valid fallback after moving the active document to trash", async () => {
    const active = makeDocument()
    const fallback = makeDocument({ id: "document-2", title: "第二章" })
    const deleted = {
      ...active,
      revision: 2,
      deletedAt: "2026-07-29T09:00:00.000Z",
      updatedAt: "2026-07-29T09:00:00.000Z",
    }
    fetchMock.mockImplementation(async (input, init) => {
      const path = requestPath(input)
      if (path === `/api/documents/${active.id}` && init?.method === "DELETE") {
        return jsonResponse(deleted)
      }
      if (path === `/api/documents/${fallback.id}`) {
        return jsonResponse(fallback)
      }
      throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${path}`)
    })
    useEditorStore.setState({
      documents: [makeSummary(active), makeSummary(fallback)],
      sessions: { [active.id]: makeSession(active) },
      activeId: active.id,
      openTabs: [active.id],
    })

    await useEditorStore.getState().moveDocumentToTrash(active.id)

    const state = useEditorStore.getState()
    expect(state.activeId).toBe(fallback.id)
    expect(state.openTabs).toEqual([fallback.id])
    expect(state.sessions[fallback.id]?.document).toEqual(fallback)
    expect(state.trash[0]).toMatchObject({ id: active.id, revision: 2 })
  })

  it("synchronizes sessions, trash, and child folders after folder deletion", async () => {
    const folder: FolderRecord = {
      id: "folder-1",
      parentId: null,
      name: "产品",
      position: 0,
      createdAt: "2026-07-29T08:00:00.000Z",
      updatedAt: "2026-07-29T08:00:00.000Z",
    }
    const child: FolderRecord = {
      ...folder,
      id: "folder-2",
      parentId: folder.id,
      name: "草稿",
    }
    const active = makeDocument({ folderId: folder.id })
    const trashed = makeDocument({
      id: "document-2",
      folderId: folder.id,
      deletedAt: "2026-07-29T08:30:00.000Z",
    })
    const updatedAt = "2026-07-29T09:00:00.000Z"
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, updatedAt }))
    useEditorStore.setState({
      folders: [folder, child],
      documents: [makeSummary(active)],
      trash: [makeSummary(trashed)],
      sessions: {
        [active.id]: makeSession(active),
        [trashed.id]: makeSession(trashed),
      },
    })

    await useEditorStore.getState().deleteFolder(folder.id)

    const state = useEditorStore.getState()
    expect(state.folders).toEqual([
      expect.objectContaining({ id: child.id, parentId: null, updatedAt }),
    ])
    expect(state.documents[0]).toMatchObject({
      folderId: null,
      revision: 2,
      updatedAt,
    })
    expect(state.trash[0]).toMatchObject({
      folderId: null,
      revision: 2,
      updatedAt,
    })
    expect(state.sessions[active.id]?.document).toMatchObject({
      folderId: null,
      revision: 2,
    })
  })

  it("waits for an in-flight save before deleting its folder", async () => {
    const folder: FolderRecord = {
      id: "folder-1",
      parentId: null,
      name: "产品",
      position: 0,
      createdAt: "2026-07-29T08:00:00.000Z",
      updatedAt: "2026-07-29T08:00:00.000Z",
    }
    const document = makeDocument({
      folderId: folder.id,
      title: "待保存的草稿",
    })
    const saveResponse = deferred<Response>()
    const saveUpdatedAt = "2026-07-29T08:30:00.000Z"
    const deleteUpdatedAt = "2026-07-29T09:00:00.000Z"
    const requestOrder: string[] = []

    fetchMock.mockImplementation(async (input, init) => {
      const path = requestPath(input)
      if (
        path === `/api/documents/${document.id}` &&
        init?.method === "PATCH"
      ) {
        requestOrder.push("PATCH")
        return saveResponse.promise
      }
      if (path === `/api/folders/${folder.id}` && init?.method === "DELETE") {
        requestOrder.push("DELETE")
        return jsonResponse({ ok: true, updatedAt: deleteUpdatedAt })
      }
      throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${path}`)
    })

    useEditorStore.setState({
      folders: [folder],
      documents: [makeSummary(document)],
      sessions: {
        [document.id]: makeSession(document, {
          dirty: true,
          localVersion: 1,
          saveState: "dirty",
        }),
      },
    })

    const save = useEditorStore.getState().saveDocument(document.id)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const deletion = useEditorStore.getState().deleteFolder(folder.id)
    await Promise.resolve()

    expect(requestOrder).toEqual(["PATCH"])
    expect(fetchMock).toHaveBeenCalledTimes(1)

    saveResponse.resolve(
      jsonResponse({
        ...document,
        revision: 2,
        updatedAt: saveUpdatedAt,
      } satisfies DocumentRecord),
    )

    await Promise.all([save, deletion])

    expect(requestOrder).toEqual(["PATCH", "DELETE"])
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const state = useEditorStore.getState()
    expect(state.documents[0]).toMatchObject({
      folderId: null,
      revision: 3,
      updatedAt: deleteUpdatedAt,
    })
    expect(state.sessions[document.id]).toMatchObject({
      dirty: false,
      saveState: "saved",
      lastSavedAt: deleteUpdatedAt,
      document: {
        folderId: null,
        revision: 3,
        updatedAt: deleteUpdatedAt,
      },
    })
  })

  it("queues edits made during folder deletion behind the new revision", async () => {
    const folder: FolderRecord = {
      id: "folder-1",
      parentId: null,
      name: "产品",
      position: 0,
      createdAt: "2026-07-29T08:00:00.000Z",
      updatedAt: "2026-07-29T08:00:00.000Z",
    }
    const targetFolder: FolderRecord = {
      ...folder,
      id: "folder-2",
      name: "已整理",
    }
    const document = makeDocument({ folderId: folder.id })
    const deleteResponse = deferred<Response>()
    const deleteUpdatedAt = "2026-07-29T09:00:00.000Z"
    const saveUpdatedAt = "2026-07-29T09:01:00.000Z"
    const requestOrder: string[] = []
    const saveBodies: Array<Record<string, unknown>> = []

    fetchMock.mockImplementation(async (input, init) => {
      const path = requestPath(input)
      if (path === `/api/folders/${folder.id}` && init?.method === "DELETE") {
        requestOrder.push("DELETE")
        return deleteResponse.promise
      }
      if (
        path === `/api/documents/${document.id}` &&
        init?.method === "PATCH"
      ) {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>
        requestOrder.push("PATCH")
        saveBodies.push(body)
        return jsonResponse({
          ...document,
          folderId: targetFolder.id,
          title: "删除期间的新编辑",
          revision: 3,
          updatedAt: saveUpdatedAt,
        } satisfies DocumentRecord)
      }
      throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${path}`)
    })

    useEditorStore.setState({
      folders: [folder, targetFolder],
      documents: [makeSummary(document)],
      sessions: { [document.id]: makeSession(document) },
    })

    const deletion = useEditorStore.getState().deleteFolder(folder.id)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    useEditorStore.getState().updateDraft(document.id, {
      folderId: targetFolder.id,
      title: "删除期间的新编辑",
    })
    const save = useEditorStore.getState().saveDocument(document.id)
    await Promise.resolve()

    expect(requestOrder).toEqual(["DELETE"])
    expect(fetchMock).toHaveBeenCalledTimes(1)

    deleteResponse.resolve(
      jsonResponse({ ok: true, updatedAt: deleteUpdatedAt }),
    )
    await Promise.all([deletion, save])

    expect(requestOrder).toEqual(["DELETE", "PATCH"])
    expect(saveBodies).toEqual([
      expect.objectContaining({
        expectedRevision: 2,
        folderId: targetFolder.id,
        title: "删除期间的新编辑",
      }),
    ])

    const state = useEditorStore.getState()
    expect(state.documents[0]).toMatchObject({
      folderId: targetFolder.id,
      title: "删除期间的新编辑",
      revision: 3,
      updatedAt: saveUpdatedAt,
    })
    expect(state.sessions[document.id]).toMatchObject({
      dirty: false,
      saveState: "saved",
      document: {
        folderId: targetFolder.id,
        title: "删除期间的新编辑",
        revision: 3,
        updatedAt: saveUpdatedAt,
      },
    })
  })

  it("does not delete a folder when its pending document save fails", async () => {
    const folder: FolderRecord = {
      id: "folder-1",
      parentId: null,
      name: "产品",
      position: 0,
      createdAt: "2026-07-29T08:00:00.000Z",
      updatedAt: "2026-07-29T08:00:00.000Z",
    }
    const document = makeDocument({ folderId: folder.id })
    const requestOrder: string[] = []

    fetchMock.mockImplementation(async (input, init) => {
      const path = requestPath(input)
      if (
        path === `/api/documents/${document.id}` &&
        init?.method === "PATCH"
      ) {
        requestOrder.push("PATCH")
        return jsonResponse(
          {
            title: "保存失败",
            status: 500,
            detail: "暂时无法保存文档",
          },
          500,
        )
      }
      if (path === `/api/folders/${folder.id}` && init?.method === "DELETE") {
        requestOrder.push("DELETE")
        return jsonResponse({
          ok: true,
          updatedAt: "2026-07-29T09:00:00.000Z",
        })
      }
      throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${path}`)
    })

    useEditorStore.setState({
      folders: [folder],
      documents: [makeSummary(document)],
      sessions: {
        [document.id]: makeSession(document, {
          dirty: true,
          localVersion: 1,
          saveState: "dirty",
        }),
      },
    })

    await expect(
      useEditorStore.getState().deleteFolder(folder.id),
    ).rejects.toThrow("暂时无法保存文档")

    expect(requestOrder).toEqual(["PATCH"])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(useEditorStore.getState()).toMatchObject({
      folders: [folder],
      documents: [
        expect.objectContaining({ folderId: folder.id, revision: 1 }),
      ],
      sessions: {
        [document.id]: expect.objectContaining({
          dirty: true,
          saveState: "error",
          error: "暂时无法保存文档",
          document: expect.objectContaining({
            folderId: folder.id,
            revision: 1,
          }),
        }),
      },
    })
  })

  it("preserves dirty drafts when authentication expires or logout cannot save", async () => {
    const document = makeDocument()
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          title: "未登录",
          status: 401,
          detail: "会话已过期",
        },
        401,
      ),
    )
    useEditorStore.setState({
      auth: { required: true, authenticated: true },
      documents: [makeSummary(document)],
      sessions: {
        [document.id]: makeSession(document, {
          dirty: true,
          localVersion: 1,
          saveState: "dirty",
        }),
      },
      activeId: document.id,
      openTabs: [document.id],
    })

    useEditorStore.getState().expireSession()
    expect(useEditorStore.getState().sessions[document.id]?.dirty).toBe(true)

    await expect(useEditorStore.getState().logout()).rejects.toThrow(
      "会话已过期",
    )
    expect(useEditorStore.getState()).toMatchObject({
      auth: { required: true, authenticated: false },
      activeId: document.id,
      openTabs: [document.id],
    })
    expect(useEditorStore.getState().sessions[document.id]?.dirty).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
