import type {
  DocumentVersionSummary,
  EditorDocumentJson,
  VersionKind,
} from "../src/lib/contracts"

export type RuntimeEnv = Env & {
  APP_PASSWORD?: string
  SESSION_SECRET?: string
}

export type RequestContext = {
  env: RuntimeEnv
  request: Request
  requestId: string
  url: URL
}

export type FolderRow = {
  id: string
  parent_id: string | null
  name: string
  position: number
  created_at: string
  updated_at: string
}

export type DocumentRow = {
  id: string
  folder_id: string | null
  title: string
  content_json: string
  content_html: string
  content_text: string
  is_favorite: number
  position: number
  revision: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type DocumentSummaryRow = Omit<
  DocumentRow,
  "content_json" | "content_html" | "content_text"
> & {
  excerpt: string
}

export type DocumentVersionRow = {
  id: string
  document_id: string
  source_revision: number
  title: string
  content_json: string
  content_html: string
  content_text: string
  kind: VersionKind
  label: string | null
  created_at: string
}

export type DocumentVersionSummaryRow = Omit<
  DocumentVersionRow,
  "content_json" | "content_html" | "content_text"
> & {
  excerpt: string
}

export type ParsedDocumentContent = {
  contentJson: EditorDocumentJson
  contentJsonText: string
  contentHtml: string
  contentText: string
}

export type RestoreVersionResult = {
  document: DocumentRow
  snapshot: DocumentVersionSummary
}
