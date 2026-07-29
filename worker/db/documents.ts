import type {
  DocumentRecord,
  DocumentSummary,
  DuplicateDocumentInput,
  PageResult,
} from "../../src/lib/contracts"
import { conflict } from "../http"
import type { DocumentRow, DocumentSummaryRow } from "../types"
import type {
  ValidatedDocumentCreate,
  ValidatedDocumentUpdate,
} from "../validation"
import {
  assertFolderExists,
  escapeLike,
  getDocumentRow,
  requireDocumentRow,
} from "./common"
import { mapDocument, mapDocumentSummary } from "./mappers"

type ListDocumentsInput = {
  folderId?: string | null
  page: number
  pageSize: number
  q: string
  view: "all" | "favorites" | "trash"
}

function assertExpectedRevision(current: DocumentRow, expected: number) {
  if (current.revision !== expected) {
    throw conflict(
      `文档已更新（当前 revision 为 ${current.revision}），请刷新后重试`,
    )
  }
}

function assertEditable(current: DocumentRow) {
  if (current.deleted_at !== null) {
    throw conflict("回收站中的文档只能恢复或永久删除", "document_in_trash")
  }
}

export async function listDocuments(
  db: D1Database,
  input: ListDocumentsInput,
): Promise<PageResult<DocumentSummary>> {
  const clauses: string[] = []
  const bindings: unknown[] = []

  if (input.view === "trash") {
    clauses.push("deleted_at IS NOT NULL")
  } else {
    clauses.push("deleted_at IS NULL")
    if (input.view === "favorites") clauses.push("is_favorite = 1")
  }

  if ("folderId" in input) {
    if (input.folderId === null) {
      clauses.push("folder_id IS NULL")
    } else {
      clauses.push("folder_id = ?")
      bindings.push(input.folderId)
    }
  }

  if (input.q) {
    const pattern = `%${escapeLike(input.q)}%`
    clauses.push(
      "(title LIKE ? ESCAPE '\\' OR content_text LIKE ? ESCAPE '\\')",
    )
    bindings.push(pattern, pattern)
  }

  const where = clauses.join(" AND ")
  const order =
    input.view === "trash"
      ? "deleted_at DESC, id"
      : "is_favorite DESC, updated_at DESC, id"
  const offset = (input.page - 1) * input.pageSize

  const count = await db
    .prepare(`SELECT COUNT(*) AS total FROM documents WHERE ${where}`)
    .bind(...bindings)
    .first<{ total: number }>()
  const { results } = await db
    .prepare(
      `SELECT
        id,
        folder_id,
        title,
        substr(content_text, 1, 240) AS excerpt,
        is_favorite,
        position,
        revision,
        created_at,
        updated_at,
        deleted_at
      FROM documents
      WHERE ${where}
      ORDER BY ${order}
      LIMIT ? OFFSET ?`,
    )
    .bind(...bindings, input.pageSize, offset)
    .all<DocumentSummaryRow>()

  const total = count?.total ?? 0
  return {
    items: results.map(mapDocumentSummary),
    page: input.page,
    pageSize: input.pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / input.pageSize),
  }
}

export async function getDocument(db: D1Database, id: string) {
  return mapDocument(await requireDocumentRow(db, id))
}

export async function createDocument(
  db: D1Database,
  input: ValidatedDocumentCreate,
) {
  await assertFolderExists(db, input.folderId)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db
    .prepare(
      `INSERT INTO documents (
        id,
        folder_id,
        title,
        content_json,
        content_html,
        content_text,
        is_favorite,
        position,
        revision,
        created_at,
        updated_at,
        deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NULL)`,
    )
    .bind(
      id,
      input.folderId,
      input.title,
      input.content.contentJsonText,
      input.content.contentHtml,
      input.content.contentText,
      input.isFavorite ? 1 : 0,
      input.position,
      now,
      now,
    )
    .run()

  const created = await getDocumentRow(db, id)
  if (!created)
    throw new Error("Document insert succeeded but row was not found")
  return mapDocument(created)
}

export async function updateDocument(
  db: D1Database,
  id: string,
  input: ValidatedDocumentUpdate,
) {
  const current = await requireDocumentRow(db, id)
  assertEditable(current)
  assertExpectedRevision(current, input.expectedRevision)

  const folderId =
    input.folderId === undefined ? current.folder_id : input.folderId
  await assertFolderExists(db, folderId)
  const now = new Date().toISOString()
  const result = await db
    .prepare(
      `UPDATE documents
      SET
        folder_id = ?,
        title = ?,
        content_json = ?,
        content_html = ?,
        content_text = ?,
        is_favorite = ?,
        position = ?,
        revision = revision + 1,
        updated_at = ?
      WHERE id = ? AND revision = ? AND deleted_at IS NULL`,
    )
    .bind(
      folderId,
      input.title ?? current.title,
      input.content?.contentJsonText ?? current.content_json,
      input.content?.contentHtml ?? current.content_html,
      input.content?.contentText ?? current.content_text,
      input.isFavorite === undefined
        ? current.is_favorite
        : input.isFavorite
          ? 1
          : 0,
      input.position ?? current.position,
      now,
      id,
      input.expectedRevision,
    )
    .run()
  if (result.meta.changes !== 1) {
    throw conflict("文档在保存期间被其他请求更新，请刷新后重试")
  }

  const updated = await getDocumentRow(db, id)
  if (!updated)
    throw new Error("Document update succeeded but row was not found")
  return mapDocument(updated)
}

export async function softDeleteDocument(
  db: D1Database,
  id: string,
  expectedRevision: number,
) {
  const current = await requireDocumentRow(db, id)
  assertEditable(current)
  assertExpectedRevision(current, expectedRevision)
  const now = new Date().toISOString()
  const result = await db
    .prepare(
      `UPDATE documents
      SET deleted_at = ?, updated_at = ?, revision = revision + 1
      WHERE id = ? AND revision = ? AND deleted_at IS NULL`,
    )
    .bind(now, now, id, expectedRevision)
    .run()
  if (result.meta.changes !== 1) {
    throw conflict("文档在删除期间被其他请求更新，请刷新后重试")
  }
  const deleted = await getDocumentRow(db, id)
  if (!deleted)
    throw new Error("Document delete succeeded but row was not found")
  return mapDocument(deleted)
}

export async function restoreDocument(
  db: D1Database,
  id: string,
  expectedRevision: number,
) {
  const current = await requireDocumentRow(db, id)
  if (current.deleted_at === null) {
    throw conflict("文档不在回收站中", "document_not_in_trash")
  }
  assertExpectedRevision(current, expectedRevision)
  const now = new Date().toISOString()
  const result = await db
    .prepare(
      `UPDATE documents
      SET deleted_at = NULL, updated_at = ?, revision = revision + 1
      WHERE id = ? AND revision = ? AND deleted_at IS NOT NULL`,
    )
    .bind(now, id, expectedRevision)
    .run()
  if (result.meta.changes !== 1) {
    throw conflict("文档在恢复期间被其他请求更新，请刷新后重试")
  }
  const restored = await getDocumentRow(db, id)
  if (!restored) {
    throw new Error("Document restore succeeded but row was not found")
  }
  return mapDocument(restored)
}

export async function permanentlyDeleteDocument(
  db: D1Database,
  id: string,
  expectedRevision: number,
) {
  const current = await requireDocumentRow(db, id)
  if (current.deleted_at === null) {
    throw conflict("只能永久删除回收站中的文档", "document_not_in_trash")
  }
  assertExpectedRevision(current, expectedRevision)
  const result = await db
    .prepare(
      "DELETE FROM documents WHERE id = ? AND revision = ? AND deleted_at IS NOT NULL",
    )
    .bind(id, expectedRevision)
    .run()
  if (result.meta.changes < 1) {
    throw conflict("文档在永久删除期间被其他请求更新，请刷新后重试")
  }
  return { ok: true as const }
}

export async function duplicateDocument(
  db: D1Database,
  id: string,
  input: DuplicateDocumentInput,
): Promise<DocumentRecord> {
  const current = await requireDocumentRow(db, id)
  if (input.expectedRevision !== undefined) {
    assertExpectedRevision(current, input.expectedRevision)
  }
  const folderId =
    input.folderId === undefined ? current.folder_id : input.folderId
  await assertFolderExists(db, folderId)

  const copyId = crypto.randomUUID()
  const now = new Date().toISOString()
  const defaultTitle = `${current.title.slice(0, 195)} 副本`.slice(0, 200)
  await db
    .prepare(
      `INSERT INTO documents (
        id,
        folder_id,
        title,
        content_json,
        content_html,
        content_text,
        is_favorite,
        position,
        revision,
        created_at,
        updated_at,
        deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 1, ?, ?, NULL)`,
    )
    .bind(
      copyId,
      folderId,
      input.title ?? defaultTitle,
      current.content_json,
      current.content_html,
      current.content_text,
      current.position,
      now,
      now,
    )
    .run()
  const copy = await getDocumentRow(db, copyId)
  if (!copy)
    throw new Error("Document duplicate succeeded but row was not found")
  return mapDocument(copy)
}
