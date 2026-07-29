import { create } from "zustand"
import { persist } from "zustand/middleware"
import { api, ApiError } from "@/lib/api"
import type {
  AuthState,
  CreateDocumentInput,
  DocumentRecord,
  DocumentSummary,
  DocumentVersionSummary,
  DocumentView,
  FolderRecord,
} from "@/lib/contracts"

export type SaveState =
  "idle" | "dirty" | "saving" | "saved" | "error" | "conflict"

export type DocumentSession = {
  document: DocumentRecord
  dirty: boolean
  localVersion: number
  saveState: SaveState
  error: string | null
  lastSavedAt: string | null
}

type EditorStore = {
  auth: AuthState | null
  booting: boolean
  bootError: string | null
  folders: FolderRecord[]
  documents: DocumentSummary[]
  trash: DocumentSummary[]
  sessions: Record<string, DocumentSession>
  versions: Record<string, DocumentVersionSummary[]>
  activeId: string | null
  openTabs: string[]
  loadingDocumentId: string | null
  libraryLoading: boolean
  sidebarOpen: boolean
  commandOpen: boolean
  activeView: DocumentView | "history"
  searchQuery: string
  initialize: () => Promise<void>
  login: (password: string) => Promise<void>
  logout: () => Promise<void>
  expireSession: () => void
  setSidebarOpen: (open: boolean) => void
  setCommandOpen: (open: boolean) => void
  setActiveView: (view: DocumentView | "history") => void
  setSearchQuery: (query: string) => void
  refreshLibrary: () => Promise<void>
  openDocument: (id: string) => Promise<void>
  reloadDocument: (id: string) => Promise<void>
  closeTab: (id: string) => void
  createDocument: (input?: CreateDocumentInput) => Promise<DocumentRecord>
  updateDraft: (
    id: string,
    patch: Partial<
      Pick<
        DocumentRecord,
        | "folderId"
        | "title"
        | "contentJson"
        | "contentHtml"
        | "contentText"
        | "isFavorite"
        | "position"
      >
    >,
  ) => void
  saveDocument: (id: string) => Promise<void>
  saveActive: () => Promise<void>
  saveAll: () => Promise<void>
  duplicateDocument: (id: string) => Promise<DocumentRecord>
  moveDocumentToTrash: (id: string) => Promise<void>
  restoreDocument: (id: string) => Promise<void>
  permanentlyDeleteDocument: (id: string) => Promise<void>
  createFolder: (
    name: string,
    parentId?: string | null,
  ) => Promise<FolderRecord>
  renameFolder: (id: string, name: string) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  loadVersions: (id: string) => Promise<void>
  createVersion: (id: string, label?: string) => Promise<void>
  restoreVersion: (id: string, versionId: string) => Promise<void>
}

const saveQueues = new Map<string, Promise<void>>()
const structuralTails = new Map<string, Promise<void>>()

function acquireStructuralBarrier(ids: string[]) {
  const documentIds = [...new Set(ids)]
  const predecessors = [
    ...new Set(
      documentIds.flatMap((id) => {
        const predecessor = structuralTails.get(id)
        return predecessor ? [predecessor] : []
      }),
    ),
  ]
  const ready = Promise.all(predecessors).then(() => undefined)
  let resolveRelease!: () => void
  const released = new Promise<void>((resolve) => {
    resolveRelease = resolve
  })
  const tail = ready.then(() => released)

  for (const documentId of documentIds) {
    structuralTails.set(documentId, tail)
  }

  let done = false
  return {
    ready,
    release: () => {
      if (done) return
      done = true
      resolveRelease()
      void tail.then(() => {
        for (const documentId of documentIds) {
          if (structuralTails.get(documentId) === tail) {
            structuralTails.delete(documentId)
          }
        }
      })
    },
  }
}

async function listAllDocuments(view: DocumentView) {
  const items: DocumentSummary[] = []
  let page = 1

  while (true) {
    const result = await api.documents.list({ view, page, pageSize: 100 })
    items.push(...result.items)
    if (page >= result.totalPages) return items
    page += 1
  }
}

async function ensureSaved(get: () => EditorStore, id: string) {
  await get().saveDocument(id)
  const session = get().sessions[id]
  if (session?.dirty) {
    throw new Error(
      session.error ?? "文档仍有未保存的更改，请先恢复网络连接后重试。",
    )
  }
}

function toSummary(document: DocumentRecord): DocumentSummary {
  return {
    id: document.id,
    folderId: document.folderId,
    title: document.title,
    excerpt: document.contentText.trim().slice(0, 180),
    isFavorite: document.isFavorite,
    position: document.position,
    revision: document.revision,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    deletedAt: document.deletedAt,
  }
}

function upsertSummary(items: DocumentSummary[], summary: DocumentSummary) {
  return [summary, ...items.filter((item) => item.id !== summary.id)].sort(
    (left, right) => right.updatedAt.localeCompare(left.updatedAt),
  )
}

function getErrorMessage(reason: unknown) {
  if (reason instanceof ApiError && reason.status === 409) {
    return "远端文档已更新，请重新载入或创建副本。"
  }
  return reason instanceof Error ? reason.message : "操作失败，请稍后重试。"
}

async function runSaveLoop(id: string) {
  while (true) {
    const state = useEditorStore.getState()
    const session = state.sessions[id]
    if (!session?.dirty) return

    const snapshot = session.document
    const snapshotVersion = session.localVersion

    useEditorStore.setState((current) => ({
      sessions: {
        ...current.sessions,
        [id]: {
          ...current.sessions[id],
          saveState: "saving",
          error: null,
        },
      },
    }))

    try {
      const updated = await api.documents.update(id, {
        expectedRevision: snapshot.revision,
        folderId: snapshot.folderId,
        title: snapshot.title,
        contentJson: snapshot.contentJson,
        contentHtml: snapshot.contentHtml,
        contentText: snapshot.contentText,
        isFavorite: snapshot.isFavorite,
        position: snapshot.position,
      })

      useEditorStore.setState((current) => {
        const latest = current.sessions[id]
        if (!latest) return current

        const changedWhileSaving = latest.localVersion !== snapshotVersion
        const document = changedWhileSaving
          ? {
              ...latest.document,
              revision: updated.revision,
              updatedAt: updated.updatedAt,
            }
          : updated
        const summary = toSummary(document)

        return {
          sessions: {
            ...current.sessions,
            [id]: {
              ...latest,
              document,
              dirty: changedWhileSaving,
              saveState: changedWhileSaving ? "dirty" : "saved",
              error: null,
              lastSavedAt: updated.updatedAt,
            },
          },
          documents: document.deletedAt
            ? current.documents.filter((item) => item.id !== id)
            : upsertSummary(current.documents, summary),
          trash: document.deletedAt
            ? upsertSummary(current.trash, summary)
            : current.trash.filter((item) => item.id !== id),
        }
      })
    } catch (reason) {
      useEditorStore.setState((current) => {
        const latest = current.sessions[id]
        if (!latest) return current

        return {
          sessions: {
            ...current.sessions,
            [id]: {
              ...latest,
              dirty: true,
              saveState:
                reason instanceof ApiError && reason.status === 409
                  ? "conflict"
                  : "error",
              error: getErrorMessage(reason),
            },
          },
        }
      })
      return
    }
  }
}

export const useEditorStore = create<EditorStore>()(
  persist(
    (set, get) => ({
      auth: null,
      booting: true,
      bootError: null,
      folders: [],
      documents: [],
      trash: [],
      sessions: {},
      versions: {},
      activeId: null,
      openTabs: [],
      loadingDocumentId: null,
      libraryLoading: false,
      sidebarOpen: true,
      commandOpen: false,
      activeView: "all",
      searchQuery: "",

      initialize: async () => {
        set({ booting: true, bootError: null })
        try {
          const auth = await api.auth.status()
          set({ auth })
          if (auth.authenticated) {
            await get().refreshLibrary()
            const preferred = get().activeId
            const fallback =
              get().documents.find((item) => item.id === preferred)?.id ??
              get().documents[0]?.id
            if (fallback) await get().openDocument(fallback)
          }
        } catch (reason) {
          set({ bootError: getErrorMessage(reason) })
        } finally {
          set({ booting: false })
        }
      },

      login: async (password) => {
        const auth = await api.auth.login({ password })
        set({ auth, bootError: null })
        const preferredId = get().activeId
        await get().refreshLibrary()
        const targetId =
          get().documents.find((document) => document.id === preferredId)?.id ??
          get().documents[0]?.id
        if (targetId) await get().openDocument(targetId)
      },

      logout: async () => {
        await get().saveAll()
        const unsaved = Object.values(get().sessions).find(
          (session) => session.dirty,
        )
        if (unsaved) {
          throw new Error(unsaved.error ?? "仍有文档未保存，暂时无法安全退出。")
        }
        await api.auth.logout()
        set({
          auth: { required: true, authenticated: false },
          folders: [],
          documents: [],
          trash: [],
          sessions: {},
          versions: {},
          activeId: null,
          openTabs: [],
        })
      },

      expireSession: () =>
        set({ auth: { required: true, authenticated: false } }),

      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      setActiveView: (activeView) => set({ activeView }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),

      refreshLibrary: async () => {
        set({ libraryLoading: true })
        try {
          const [folders, documents, trash] = await Promise.all([
            api.folders.list(),
            listAllDocuments("all"),
            listAllDocuments("trash"),
          ])
          set((state) => {
            const validIds = new Set(
              [...documents, ...trash].map((document) => document.id),
            )
            return {
              folders,
              documents,
              trash,
              openTabs: state.openTabs.filter((id) => validIds.has(id)),
              activeId:
                state.activeId && validIds.has(state.activeId)
                  ? state.activeId
                  : null,
            }
          })
        } finally {
          set({ libraryLoading: false })
        }
      },

      openDocument: async (id) => {
        const initialState = get()
        const previousId = initialState.activeId
        const wasOpen = initialState.openTabs.includes(id)
        if (previousId && previousId !== id) {
          void get().saveDocument(previousId)
        }

        set((state) => ({
          activeId: id,
          openTabs: state.openTabs.includes(id)
            ? state.openTabs
            : [...state.openTabs, id],
        }))

        if (get().sessions[id]) return

        set({ loadingDocumentId: id })
        try {
          const document = await api.documents.get(id)
          set((state) => ({
            sessions: {
              ...state.sessions,
              [id]: {
                document,
                dirty: false,
                localVersion: 0,
                saveState: "idle",
                error: null,
                lastSavedAt: document.updatedAt,
              },
            },
          }))
        } catch (reason) {
          set((state) => {
            if (state.activeId !== id) return state
            return {
              activeId: previousId,
              openTabs: wasOpen
                ? state.openTabs
                : state.openTabs.filter((tabId) => tabId !== id),
            }
          })
          throw reason
        } finally {
          set((state) => ({
            loadingDocumentId:
              state.loadingDocumentId === id ? null : state.loadingDocumentId,
          }))
        }
      },

      reloadDocument: async (id) => {
        set({ loadingDocumentId: id })
        try {
          const document = await api.documents.get(id)
          set((state) => ({
            sessions: {
              ...state.sessions,
              [id]: {
                document,
                dirty: false,
                localVersion: (state.sessions[id]?.localVersion ?? 0) + 1,
                saveState: "saved",
                error: null,
                lastSavedAt: document.updatedAt,
              },
            },
            documents: document.deletedAt
              ? state.documents.filter((item) => item.id !== id)
              : upsertSummary(state.documents, toSummary(document)),
            trash: document.deletedAt
              ? upsertSummary(state.trash, toSummary(document))
              : state.trash.filter((item) => item.id !== id),
          }))
        } finally {
          set((state) => ({
            loadingDocumentId:
              state.loadingDocumentId === id ? null : state.loadingDocumentId,
          }))
        }
      },

      closeTab: (id) => {
        const state = get()
        void state.saveDocument(id)
        const index = state.openTabs.indexOf(id)
        const openTabs = state.openTabs.filter((tabId) => tabId !== id)
        const activeId =
          state.activeId === id
            ? (openTabs[Math.max(0, index - 1)] ?? openTabs.at(-1) ?? null)
            : state.activeId
        set({ openTabs, activeId })
        if (activeId && !state.sessions[activeId]) {
          void get().openDocument(activeId)
        }
      },

      createDocument: async (input = {}) => {
        const document = await api.documents.create(input)
        set((state) => ({
          documents: upsertSummary(state.documents, toSummary(document)),
          sessions: {
            ...state.sessions,
            [document.id]: {
              document,
              dirty: false,
              localVersion: 0,
              saveState: "saved",
              error: null,
              lastSavedAt: document.updatedAt,
            },
          },
          activeId: document.id,
          openTabs: [
            ...state.openTabs.filter((id) => id !== document.id),
            document.id,
          ],
          activeView: "all",
        }))
        return document
      },

      updateDraft: (id, patch) => {
        set((state) => {
          const session = state.sessions[id]
          if (!session) return state

          const document = { ...session.document, ...patch }
          return {
            sessions: {
              ...state.sessions,
              [id]: {
                ...session,
                document,
                dirty: true,
                localVersion: session.localVersion + 1,
                saveState: "dirty",
                error: null,
              },
            },
            documents: document.deletedAt
              ? state.documents
              : upsertSummary(state.documents, toSummary(document)),
          }
        })
      },

      saveDocument: async (id) => {
        const queued = saveQueues.get(id)
        if (queued) return queued

        const predecessor = structuralTails.get(id)
        const work = predecessor
          ? predecessor.then(() => runSaveLoop(id))
          : runSaveLoop(id)
        const promise = work.finally(() => {
          if (saveQueues.get(id) === promise) saveQueues.delete(id)
        })
        saveQueues.set(id, promise)
        return promise
      },

      saveActive: async () => {
        const activeId = get().activeId
        if (activeId) await get().saveDocument(activeId)
      },

      saveAll: async () => {
        const dirtyIds = Object.entries(get().sessions)
          .filter(([, session]) => session.dirty)
          .map(([id]) => id)
        await Promise.all(dirtyIds.map((id) => get().saveDocument(id)))
      },

      duplicateDocument: async (id) => {
        await ensureSaved(get, id)
        const current = get().sessions[id]?.document
        const document = await api.documents.duplicate(id, {
          expectedRevision: current?.revision,
        })
        set((state) => ({
          documents: upsertSummary(state.documents, toSummary(document)),
          sessions: {
            ...state.sessions,
            [document.id]: {
              document,
              dirty: false,
              localVersion: 0,
              saveState: "saved",
              error: null,
              lastSavedAt: document.updatedAt,
            },
          },
          activeId: document.id,
          openTabs: [...state.openTabs, document.id],
        }))
        return document
      },

      moveDocumentToTrash: async (id) => {
        await ensureSaved(get, id)
        const session = get().sessions[id]
        if (!session) return
        const document = await api.documents.moveToTrash(
          id,
          session.document.revision,
        )
        const state = get()
        const documents = state.documents.filter((item) => item.id !== id)
        const openTabs = state.openTabs.filter((tabId) => tabId !== id)
        const nextActiveId =
          state.activeId === id
            ? (openTabs.at(-1) ?? documents[0]?.id ?? null)
            : state.activeId
        set({
          documents,
          trash: upsertSummary(state.trash, toSummary(document)),
          sessions: {
            ...state.sessions,
            [id]: { ...session, document, dirty: false, saveState: "saved" },
          },
          openTabs,
          activeId: nextActiveId,
        })
        if (nextActiveId && !get().sessions[nextActiveId]) {
          await get().openDocument(nextActiveId)
        }
      },

      restoreDocument: async (id) => {
        const current =
          get().sessions[id]?.document ?? (await api.documents.get(id))
        const document = await api.documents.restore(id, current.revision)
        set((state) => ({
          documents: upsertSummary(state.documents, toSummary(document)),
          trash: state.trash.filter((item) => item.id !== id),
          sessions: {
            ...state.sessions,
            [id]: {
              document,
              dirty: false,
              localVersion: 0,
              saveState: "saved",
              error: null,
              lastSavedAt: document.updatedAt,
            },
          },
        }))
      },

      permanentlyDeleteDocument: async (id) => {
        const document =
          get().sessions[id]?.document ?? (await api.documents.get(id))
        await api.documents.permanentlyDelete(id, document.revision)
        set((state) => {
          const sessions = { ...state.sessions }
          delete sessions[id]
          return {
            trash: state.trash.filter((item) => item.id !== id),
            sessions,
            openTabs: state.openTabs.filter((tabId) => tabId !== id),
            activeId: state.activeId === id ? null : state.activeId,
          }
        })
      },

      createFolder: async (name, parentId = null) => {
        const folder = await api.folders.create({ name, parentId })
        set((state) => ({ folders: [...state.folders, folder] }))
        return folder
      },

      renameFolder: async (id, name) => {
        const folder = await api.folders.update(id, { name })
        set((state) => ({
          folders: state.folders.map((item) =>
            item.id === id ? folder : item,
          ),
        }))
      },

      deleteFolder: async (id) => {
        const initialState = get()
        const affectedDocumentIds = [
          ...new Set([
            ...Object.entries(initialState.sessions)
              .filter(([, session]) => session.document.folderId === id)
              .map(([documentId]) => documentId),
            ...initialState.documents
              .filter((document) => document.folderId === id)
              .map((document) => document.id),
            ...initialState.trash
              .filter((document) => document.folderId === id)
              .map((document) => document.id),
          ]),
        ]
        const drain = Promise.all(
          affectedDocumentIds.flatMap((documentId) =>
            initialState.sessions[documentId]
              ? [ensureSaved(get, documentId)]
              : [],
          ),
        )
        const barrier = acquireStructuralBarrier(affectedDocumentIds)

        try {
          await Promise.all([barrier.ready, drain])

          const beforeDelete = get()
          const deletedDocumentIds = affectedDocumentIds.filter(
            (documentId) => {
              const session = beforeDelete.sessions[documentId]
              if (session) {
                return session.dirty || session.document.folderId === id
              }
              return [...beforeDelete.documents, ...beforeDelete.trash].some(
                (document) =>
                  document.id === documentId && document.folderId === id,
              )
            },
          )
          const deletedDocumentIdSet = new Set(deletedDocumentIds)
          const baseRevisions = new Map<string, number>()
          for (const documentId of deletedDocumentIds) {
            const revision =
              beforeDelete.sessions[documentId]?.document.revision ??
              beforeDelete.documents.find(
                (document) => document.id === documentId,
              )?.revision ??
              beforeDelete.trash.find((document) => document.id === documentId)
                ?.revision
            if (revision !== undefined) {
              baseRevisions.set(documentId, revision)
            }
          }

          const result = await api.folders.delete(id)
          set((state) => {
            const sessions = Object.fromEntries(
              Object.entries(state.sessions).map(([documentId, session]) => {
                if (!deletedDocumentIdSet.has(documentId)) {
                  return [documentId, session]
                }

                const document = {
                  ...session.document,
                  folderId:
                    session.document.folderId === id
                      ? null
                      : session.document.folderId,
                  revision:
                    (baseRevisions.get(documentId) ??
                      session.document.revision) + 1,
                  updatedAt: result.updatedAt,
                }
                return [
                  documentId,
                  {
                    ...session,
                    document,
                    lastSavedAt: session.dirty
                      ? session.lastSavedAt
                      : result.updatedAt,
                  },
                ]
              }),
            )
            const synchronizeSummary = (document: DocumentSummary) => {
              if (!deletedDocumentIdSet.has(document.id)) return document

              const sessionDocument = sessions[document.id]?.document
              if (sessionDocument) return toSummary(sessionDocument)

              return {
                ...document,
                folderId: null,
                revision:
                  (baseRevisions.get(document.id) ?? document.revision) + 1,
                updatedAt: result.updatedAt,
              }
            }

            return {
              folders: state.folders
                .filter((item) => item.id !== id)
                .map((item) =>
                  item.parentId === id
                    ? {
                        ...item,
                        parentId: null,
                        updatedAt: result.updatedAt,
                      }
                    : item,
                ),
              documents: state.documents.map(synchronizeSummary),
              trash: state.trash.map(synchronizeSummary),
              sessions,
            }
          })
        } finally {
          barrier.release()
        }
      },

      loadVersions: async (id) => {
        const page = await api.documents.listVersions(id)
        set((state) => ({
          versions: { ...state.versions, [id]: page.items },
        }))
      },

      createVersion: async (id, label) => {
        await ensureSaved(get, id)
        const session = get().sessions[id]
        if (!session) throw new Error("请先打开文档。")
        const version = await api.documents.createVersion(id, {
          expectedRevision: session.document.revision,
          label,
        })
        set((state) => ({
          versions: {
            ...state.versions,
            [id]: [version, ...(state.versions[id] ?? [])],
          },
        }))
      },

      restoreVersion: async (id, versionId) => {
        await ensureSaved(get, id)
        const session = get().sessions[id]
        if (!session) throw new Error("请先打开文档。")
        const restored = await api.documents.restoreVersion(id, versionId, {
          expectedRevision: session.document.revision,
        })
        set((state) => ({
          sessions: {
            ...state.sessions,
            [id]: {
              ...session,
              document: restored.document,
              dirty: false,
              localVersion: session.localVersion + 1,
              saveState: "saved",
              error: null,
              lastSavedAt: restored.document.updatedAt,
            },
          },
          documents: upsertSummary(
            state.documents,
            toSummary(restored.document),
          ),
          versions: {
            ...state.versions,
            [id]: [
              restored.snapshot,
              ...(state.versions[id] ?? []).filter(
                (item) => item.id !== restored.snapshot.id,
              ),
            ],
          },
        }))
      },
    }),
    {
      name: "write-skills-ui",
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        activeView: state.activeView,
        openTabs: state.openTabs,
        activeId: state.activeId,
      }),
    },
  ),
)
