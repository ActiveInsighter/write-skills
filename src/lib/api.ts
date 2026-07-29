import type {
  AuthState,
  CreateDocumentInput,
  CreateFolderInput,
  CreateVersionInput,
  DeleteFolderResponse,
  DocumentListQuery,
  DocumentRecord,
  DocumentSummary,
  DocumentVersionSummary,
  DuplicateDocumentInput,
  FolderRecord,
  LoginInput,
  OkResponse,
  PageResult,
  ProblemDetails,
  RestoreVersionInput,
  RestoreVersionResponse,
  UpdateDocumentInput,
  UpdateFolderInput,
} from "@/lib/contracts"

export class ApiError extends Error {
  readonly status: number
  readonly problem: ProblemDetails | null

  constructor(status: number, problem: ProblemDetails | null) {
    super(problem?.detail ?? `请求失败（${status}）`)
    this.name = "ApiError"
    this.status = status
    this.problem = problem
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown
}

async function request<T>(
  path: string,
  { body, headers, ...init }: RequestOptions = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
  })

  if (!response.ok) {
    const problem = await response
      .json()
      .then((value: unknown) => value as ProblemDetails)
      .catch(() => null)

    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("write-skills:unauthorized"))
    }

    throw new ApiError(response.status, problem)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

function documentListUrl(query: DocumentListQuery = {}) {
  const params = new URLSearchParams()

  if (query.view) params.set("view", query.view)
  if (query.q) params.set("q", query.q)
  if (query.folderId) params.set("folderId", query.folderId)
  if (query.page) params.set("page", String(query.page))
  if (query.pageSize) params.set("pageSize", String(query.pageSize))

  const search = params.toString()
  return `/api/documents${search ? `?${search}` : ""}`
}

export const api = {
  auth: {
    status: () => request<AuthState>("/api/auth/status"),
    login: (input: LoginInput) =>
      request<AuthState>("/api/auth/login", { method: "POST", body: input }),
    logout: () =>
      request<OkResponse>("/api/auth/logout", { method: "POST", body: {} }),
  },
  folders: {
    list: () => request<FolderRecord[]>("/api/folders"),
    create: (input: CreateFolderInput) =>
      request<FolderRecord>("/api/folders", { method: "POST", body: input }),
    update: (id: string, input: UpdateFolderInput) =>
      request<FolderRecord>(`/api/folders/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: input,
      }),
    delete: (id: string) =>
      request<DeleteFolderResponse>(`/api/folders/${encodeURIComponent(id)}`, {
        method: "DELETE",
        body: {},
      }),
  },
  documents: {
    list: (query?: DocumentListQuery) =>
      request<PageResult<DocumentSummary>>(documentListUrl(query)),
    get: (id: string) =>
      request<DocumentRecord>(`/api/documents/${encodeURIComponent(id)}`),
    create: (input: CreateDocumentInput = {}) =>
      request<DocumentRecord>("/api/documents", {
        method: "POST",
        body: input,
      }),
    update: (id: string, input: UpdateDocumentInput) =>
      request<DocumentRecord>(`/api/documents/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: input,
      }),
    moveToTrash: (id: string, expectedRevision: number) =>
      request<DocumentRecord>(`/api/documents/${encodeURIComponent(id)}`, {
        method: "DELETE",
        body: { expectedRevision },
      }),
    restore: (id: string, expectedRevision: number) =>
      request<DocumentRecord>(
        `/api/documents/${encodeURIComponent(id)}/restore`,
        { method: "POST", body: { expectedRevision } },
      ),
    permanentlyDelete: (id: string, expectedRevision: number) =>
      request<OkResponse>(
        `/api/documents/${encodeURIComponent(id)}/permanent`,
        { method: "DELETE", body: { expectedRevision } },
      ),
    duplicate: (id: string, input: DuplicateDocumentInput = {}) =>
      request<DocumentRecord>(
        `/api/documents/${encodeURIComponent(id)}/duplicate`,
        { method: "POST", body: input },
      ),
    listVersions: (id: string) =>
      request<PageResult<DocumentVersionSummary>>(
        `/api/documents/${encodeURIComponent(id)}/versions`,
      ),
    createVersion: (id: string, input: CreateVersionInput) =>
      request<DocumentVersionSummary>(
        `/api/documents/${encodeURIComponent(id)}/versions`,
        { method: "POST", body: input },
      ),
    restoreVersion: (
      id: string,
      versionId: string,
      input: RestoreVersionInput,
    ) =>
      request<RestoreVersionResponse>(
        `/api/documents/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}/restore`,
        { method: "POST", body: input },
      ),
  },
}
