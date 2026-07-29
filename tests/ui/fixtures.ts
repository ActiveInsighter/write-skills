import type {
  DocumentRecord,
  DocumentSummary,
  EditorDocumentJson,
  PageResult,
} from "@/lib/contracts"
import type { DocumentSession } from "@/stores/editor-store"

const DEFAULT_CONTENT_JSON: EditorDocumentJson = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Hello editor" }],
    },
  ],
}

export function makeDocument(
  overrides: Partial<DocumentRecord> = {},
): DocumentRecord {
  return {
    id: "document-1",
    folderId: null,
    title: "第一章",
    contentJson: DEFAULT_CONTENT_JSON,
    contentHtml: "<p>Hello editor</p>",
    contentText: "Hello editor",
    isFavorite: false,
    position: 0,
    revision: 1,
    createdAt: "2026-07-29T08:00:00.000Z",
    updatedAt: "2026-07-29T08:00:00.000Z",
    deletedAt: null,
    ...overrides,
  }
}

export function makeSummary(
  document: DocumentRecord,
  overrides: Partial<DocumentSummary> = {},
): DocumentSummary {
  return {
    id: document.id,
    folderId: document.folderId,
    title: document.title,
    excerpt: document.contentText.slice(0, 180),
    isFavorite: document.isFavorite,
    position: document.position,
    revision: document.revision,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    deletedAt: document.deletedAt,
    ...overrides,
  }
}

export function makeSession(
  document: DocumentRecord,
  overrides: Partial<DocumentSession> = {},
): DocumentSession {
  return {
    document,
    dirty: false,
    localVersion: 0,
    saveState: "idle",
    error: null,
    lastSavedAt: document.updatedAt,
    ...overrides,
  }
}

export function makePage<T>(items: T[]): PageResult<T> {
  return {
    items,
    page: 1,
    pageSize: 100,
    total: items.length,
    totalPages: items.length ? 1 : 0,
  }
}
