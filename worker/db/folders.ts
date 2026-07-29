import type {
  CreateFolderInput,
  FolderRecord,
  UpdateFolderInput,
} from "../../src/lib/contracts"
import { badRequest, conflict } from "../http"
import type { FolderRow } from "../types"
import { getFolderRow, requireFolderRow } from "./common"
import { mapFolder } from "./mappers"

export async function listFolders(db: D1Database): Promise<FolderRecord[]> {
  const { results } = await db
    .prepare(
      "SELECT * FROM folders ORDER BY parent_id IS NOT NULL, parent_id, position, name COLLATE NOCASE, id",
    )
    .all<FolderRow>()
  return results.map(mapFolder)
}

export async function createFolder(db: D1Database, input: CreateFolderInput) {
  const parentId = input.parentId ?? null
  if (parentId !== null) await requireFolderRow(db, parentId)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db
    .prepare(
      "INSERT INTO folders (id, parent_id, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(id, parentId, input.name, input.position ?? 0, now, now)
    .run()

  const created = await getFolderRow(db, id)
  if (!created) throw new Error("Folder insert succeeded but row was not found")
  return mapFolder(created)
}

async function isDescendant(
  db: D1Database,
  folderId: string,
  candidateParentId: string,
) {
  const row = await db
    .prepare(
      `WITH RECURSIVE descendants(id) AS (
        SELECT id FROM folders WHERE id = ?
        UNION ALL
        SELECT folders.id
        FROM folders
        INNER JOIN descendants ON folders.parent_id = descendants.id
      )
      SELECT id FROM descendants WHERE id = ? LIMIT 1`,
    )
    .bind(folderId, candidateParentId)
    .first<{ id: string }>()
  return Boolean(row)
}

export async function updateFolder(
  db: D1Database,
  id: string,
  input: UpdateFolderInput,
) {
  const current = await requireFolderRow(db, id)
  const parentId =
    input.parentId === undefined ? current.parent_id : input.parentId

  if (parentId === id) {
    throw badRequest("文件夹不能以自身为父级", "folder_cycle")
  }
  if (parentId !== null) {
    await requireFolderRow(db, parentId)
  }

  const now = new Date().toISOString()
  const result = await db
    .prepare(
      `WITH RECURSIVE descendants(id) AS (
        SELECT id FROM folders WHERE id = ?
        UNION ALL
        SELECT folders.id
        FROM folders
        INNER JOIN descendants ON folders.parent_id = descendants.id
      )
      UPDATE folders
      SET parent_id = ?, name = ?, position = ?, updated_at = ?
      WHERE id = ?
        AND (
          ? IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM descendants WHERE id = ?
          )
        )`,
    )
    .bind(
      id,
      parentId,
      input.name ?? current.name,
      input.position ?? current.position,
      now,
      id,
      parentId,
      parentId,
    )
    .run()
  if (result.meta.changes !== 1) {
    if (parentId !== null && (await isDescendant(db, id, parentId))) {
      throw badRequest("不能把文件夹移动到其子文件夹中", "folder_cycle")
    }
    throw conflict("文件夹已被其他请求修改", "folder_update_conflict")
  }

  const updated = await getFolderRow(db, id)
  if (!updated) throw new Error("Folder update succeeded but row was not found")
  return mapFolder(updated)
}

export async function deleteFolder(db: D1Database, id: string) {
  await requireFolderRow(db, id)
  const now = new Date().toISOString()
  await db.batch([
    db
      .prepare(
        `UPDATE documents
        SET folder_id = NULL, revision = revision + 1, updated_at = ?
        WHERE folder_id = ?`,
      )
      .bind(now, id),
    db
      .prepare(
        "UPDATE folders SET parent_id = NULL, updated_at = ? WHERE parent_id = ?",
      )
      .bind(now, id),
    db.prepare("DELETE FROM folders WHERE id = ?").bind(id),
  ])
  return { ok: true as const, updatedAt: now }
}
