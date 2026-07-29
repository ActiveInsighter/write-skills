import type {
  DocumentVersionSummary,
  PageResult,
  RestoreVersionResponse,
} from "../../src/lib/contracts"
import { conflict, notFound } from "../http"
import type { DocumentVersionRow, DocumentVersionSummaryRow } from "../types"
import type { ValidatedVersionCreate } from "../validation"
import { getDocumentRow, requireDocumentRow } from "./common"
import { mapDocument, mapVersionSummary } from "./mappers"

async function getVersionRow(
  db: D1Database,
  documentId: string,
  versionId: string,
) {
  return db
    .prepare(
      "SELECT * FROM document_versions WHERE id = ? AND document_id = ? LIMIT 1",
    )
    .bind(versionId, documentId)
    .first<DocumentVersionRow>()
}

async function requireVersionRow(
  db: D1Database,
  documentId: string,
  versionId: string,
) {
  const row = await getVersionRow(db, documentId, versionId)
  if (!row) throw notFound("版本")
  return row
}

async function getVersionSummaryRow(db: D1Database, versionId: string) {
  return db
    .prepare(
      `SELECT
        id,
        document_id,
        source_revision,
        title,
        substr(content_text, 1, 240) AS excerpt,
        kind,
        label,
        created_at
      FROM document_versions
      WHERE id = ?
      LIMIT 1`,
    )
    .bind(versionId)
    .first<DocumentVersionSummaryRow>()
}

function assertExpectedRevision(currentRevision: number, expected: number) {
  if (currentRevision !== expected) {
    throw conflict(
      `文档已更新（当前 revision 为 ${currentRevision}），请刷新后重试`,
    )
  }
}

export async function listVersions(
  db: D1Database,
  documentId: string,
  page: number,
  pageSize: number,
): Promise<PageResult<DocumentVersionSummary>> {
  await requireDocumentRow(db, documentId)
  const offset = (page - 1) * pageSize
  const count = await db
    .prepare(
      "SELECT COUNT(*) AS total FROM document_versions WHERE document_id = ?",
    )
    .bind(documentId)
    .first<{ total: number }>()
  const { results } = await db
    .prepare(
      `SELECT
        id,
        document_id,
        source_revision,
        title,
        substr(content_text, 1, 240) AS excerpt,
        kind,
        label,
        created_at
      FROM document_versions
      WHERE document_id = ?
      ORDER BY created_at DESC, id
      LIMIT ? OFFSET ?`,
    )
    .bind(documentId, pageSize, offset)
    .all<DocumentVersionSummaryRow>()
  const total = count?.total ?? 0
  return {
    items: results.map(mapVersionSummary),
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  }
}

export async function createVersion(
  db: D1Database,
  documentId: string,
  input: ValidatedVersionCreate,
) {
  const current = await requireDocumentRow(db, documentId)
  if (current.deleted_at !== null) {
    throw conflict("回收站中的文档不能创建新版本", "document_in_trash")
  }
  assertExpectedRevision(current.revision, input.expectedRevision)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const result = await db
    .prepare(
      `INSERT INTO document_versions (
        id,
        document_id,
        source_revision,
        title,
        content_json,
        content_html,
        content_text,
        kind,
        label,
        created_at
      )
      SELECT ?, id, revision, title, content_json, content_html, content_text, ?, ?, ?
      FROM documents
      WHERE id = ? AND revision = ? AND deleted_at IS NULL`,
    )
    .bind(id, input.kind, input.label, now, documentId, input.expectedRevision)
    .run()
  if (result.meta.changes !== 1) {
    throw conflict("文档在创建版本期间被其他请求更新，请刷新后重试")
  }

  const created = await getVersionSummaryRow(db, id)
  if (!created)
    throw new Error("Version insert succeeded but row was not found")
  return mapVersionSummary(created)
}

export async function restoreVersion(
  db: D1Database,
  documentId: string,
  versionId: string,
  expectedRevision: number,
): Promise<RestoreVersionResponse> {
  const current = await requireDocumentRow(db, documentId)
  if (current.deleted_at !== null) {
    throw conflict("请先从回收站恢复文档，再恢复历史版本", "document_in_trash")
  }
  assertExpectedRevision(current.revision, expectedRevision)
  const version = await requireVersionRow(db, documentId, versionId)

  const snapshotId = crypto.randomUUID()
  const now = new Date().toISOString()
  const snapshotLabel = `恢复版本前自动快照 · revision ${current.revision}`
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO document_versions (
          id,
          document_id,
          source_revision,
          title,
          content_json,
          content_html,
          content_text,
          kind,
          label,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'before_restore', ?, ?)`,
      )
      .bind(
        snapshotId,
        documentId,
        current.revision,
        current.title,
        current.content_json,
        current.content_html,
        current.content_text,
        snapshotLabel,
        now,
      ),
    db
      .prepare(
        `UPDATE documents
        SET
          title = ?,
          content_json = ?,
          content_html = ?,
          content_text = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE id = ? AND revision = ? AND deleted_at IS NULL`,
      )
      .bind(
        version.title,
        version.content_json,
        version.content_html,
        version.content_text,
        now,
        documentId,
        expectedRevision,
      ),
  ])

  if (results[1]?.meta.changes !== 1) {
    await db
      .prepare("DELETE FROM document_versions WHERE id = ?")
      .bind(snapshotId)
      .run()
    throw conflict("文档在恢复版本期间被其他请求更新，请刷新后重试")
  }

  const [updated, snapshot] = await Promise.all([
    getDocumentRow(db, documentId),
    getVersionSummaryRow(db, snapshotId),
  ])
  if (!updated || !snapshot) {
    throw new Error("Version restore succeeded but result rows were not found")
  }
  return {
    document: mapDocument(updated),
    snapshot: mapVersionSummary(snapshot),
  }
}
