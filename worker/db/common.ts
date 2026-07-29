import { notFound } from "../http"
import type { DocumentRow, FolderRow } from "../types"

export async function getFolderRow(db: D1Database, id: string) {
  return db
    .prepare("SELECT * FROM folders WHERE id = ? LIMIT 1")
    .bind(id)
    .first<FolderRow>()
}

export async function requireFolderRow(db: D1Database, id: string) {
  const row = await getFolderRow(db, id)
  if (!row) throw notFound("文件夹")
  return row
}

export async function assertFolderExists(db: D1Database, id: string | null) {
  if (id === null) return
  await requireFolderRow(db, id)
}

export async function getDocumentRow(db: D1Database, id: string) {
  return db
    .prepare("SELECT * FROM documents WHERE id = ? LIMIT 1")
    .bind(id)
    .first<DocumentRow>()
}

export async function requireDocumentRow(db: D1Database, id: string) {
  const row = await getDocumentRow(db, id)
  if (!row) throw notFound("文档")
  return row
}

export function escapeLike(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_")
}
