import type {
  DocumentRecord,
  DocumentSummary,
  DocumentVersionSummary,
  EditorDocumentJson,
  FolderRecord,
} from "../../src/lib/contracts"
import type {
  DocumentRow,
  DocumentSummaryRow,
  DocumentVersionSummaryRow,
  FolderRow,
} from "../types"

export function mapFolder(row: FolderRow): FolderRecord {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function parseContentJson(value: string): EditorDocumentJson {
  const parsed = JSON.parse(value) as unknown
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    (parsed as { type?: unknown }).type !== "doc"
  ) {
    throw new Error("Stored document content is not valid Tiptap JSON")
  }
  return parsed as EditorDocumentJson
}

export function mapDocument(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    folderId: row.folder_id,
    title: row.title,
    contentJson: parseContentJson(row.content_json),
    contentHtml: row.content_html,
    contentText: row.content_text,
    isFavorite: Boolean(row.is_favorite),
    position: row.position,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

export function mapDocumentSummary(row: DocumentSummaryRow): DocumentSummary {
  return {
    id: row.id,
    folderId: row.folder_id,
    title: row.title,
    excerpt: row.excerpt,
    isFavorite: Boolean(row.is_favorite),
    position: row.position,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

export function mapVersionSummary(
  row: DocumentVersionSummaryRow,
): DocumentVersionSummary {
  return {
    id: row.id,
    documentId: row.document_id,
    sourceRevision: row.source_revision,
    title: row.title,
    excerpt: row.excerpt,
    kind: row.kind,
    label: row.label,
    createdAt: row.created_at,
  }
}
