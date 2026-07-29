export type JsonPrimitive = boolean | number | string | null
export type JsonValue =
  JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export type EditorMarkJson = {
  type: string
  attrs?: Record<string, JsonValue>
}

export type EditorNodeJson = {
  type: string
  attrs?: Record<string, JsonValue>
  content?: EditorNodeJson[]
  marks?: EditorMarkJson[]
  text?: string
}

export type EditorDocumentJson = EditorNodeJson & {
  type: "doc"
}

export type ProblemDetails = {
  type: string
  title: string
  status: number
  detail: string
  instance: string
  code: string
  requestId: string
  errors?: Record<string, string[]>
}

export type AuthState = {
  required: boolean
  authenticated: boolean
}

export type LoginInput = {
  password: string
}

export type OkResponse = {
  ok: true
}

export type DeleteFolderResponse = OkResponse & {
  updatedAt: string
}

export type FolderRecord = {
  id: string
  parentId: string | null
  name: string
  position: number
  createdAt: string
  updatedAt: string
}

export type CreateFolderInput = {
  name: string
  parentId?: string | null
  position?: number
}

export type UpdateFolderInput = {
  name?: string
  parentId?: string | null
  position?: number
}

export type DocumentView = "all" | "favorites" | "trash"

export type DocumentSummary = {
  id: string
  folderId: string | null
  title: string
  excerpt: string
  isFavorite: boolean
  position: number
  revision: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type DocumentRecord = {
  id: string
  folderId: string | null
  title: string
  contentJson: EditorDocumentJson
  contentHtml: string
  contentText: string
  isFavorite: boolean
  position: number
  revision: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type PageResult<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type DocumentListQuery = {
  view?: DocumentView
  q?: string
  folderId?: string | "root"
  page?: number
  pageSize?: number
}

export type CreateDocumentInput = {
  folderId?: string | null
  title?: string
  contentJson?: EditorDocumentJson
  contentHtml?: string
  contentText?: string
  isFavorite?: boolean
  position?: number
}

export type UpdateDocumentInput = {
  expectedRevision: number
  folderId?: string | null
  title?: string
  contentJson?: EditorDocumentJson
  contentHtml?: string
  contentText?: string
  isFavorite?: boolean
  position?: number
}

export type DocumentRevisionInput = {
  expectedRevision: number
}

export type DuplicateDocumentInput = {
  expectedRevision?: number
  folderId?: string | null
  title?: string
}

export type VersionKind = "manual" | "before_restore" | "legacy"

export type DocumentVersionSummary = {
  id: string
  documentId: string
  sourceRevision: number
  title: string
  excerpt: string
  kind: VersionKind
  label: string | null
  createdAt: string
}

export type CreateVersionInput = {
  expectedRevision: number
  label?: string
}

export type RestoreVersionInput = {
  expectedRevision: number
}

export type RestoreVersionResponse = {
  document: DocumentRecord
  snapshot: DocumentVersionSummary
}

export type EditorApiContract = {
  "GET /api/auth/status": { response: AuthState }
  "POST /api/auth/login": { body: LoginInput; response: AuthState }
  "POST /api/auth/logout": { response: OkResponse }
  "GET /api/folders": { response: FolderRecord[] }
  "POST /api/folders": { body: CreateFolderInput; response: FolderRecord }
  "PATCH /api/folders/:folderId": {
    body: UpdateFolderInput
    response: FolderRecord
  }
  "DELETE /api/folders/:folderId": { response: DeleteFolderResponse }
  "GET /api/documents": {
    query: DocumentListQuery
    response: PageResult<DocumentSummary>
  }
  "GET /api/documents/:documentId": { response: DocumentRecord }
  "POST /api/documents": { body: CreateDocumentInput; response: DocumentRecord }
  "PATCH /api/documents/:documentId": {
    body: UpdateDocumentInput
    response: DocumentRecord
  }
  "DELETE /api/documents/:documentId": {
    body: DocumentRevisionInput
    response: DocumentRecord
  }
  "POST /api/documents/:documentId/restore": {
    body: DocumentRevisionInput
    response: DocumentRecord
  }
  "DELETE /api/documents/:documentId/permanent": {
    body: DocumentRevisionInput
    response: OkResponse
  }
  "POST /api/documents/:documentId/duplicate": {
    body: DuplicateDocumentInput
    response: DocumentRecord
  }
  "GET /api/documents/:documentId/versions": {
    response: PageResult<DocumentVersionSummary>
  }
  "POST /api/documents/:documentId/versions": {
    body: CreateVersionInput
    response: DocumentVersionSummary
  }
  "POST /api/documents/:documentId/versions/:versionId/restore": {
    body: RestoreVersionInput
    response: RestoreVersionResponse
  }
}
