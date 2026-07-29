PRAGMA defer_foreign_keys = TRUE;

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (parent_id IS NULL OR parent_id <> id),
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  folder_id TEXT,
  title TEXT NOT NULL DEFAULT '未命名文档' CHECK (length(title) BETWEEN 1 AND 200),
  content_json TEXT NOT NULL CHECK (json_valid(content_json)),
  content_html TEXT NOT NULL DEFAULT '<p></p>',
  content_text TEXT NOT NULL DEFAULT '',
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  source_revision INTEGER NOT NULL CHECK (source_revision >= 1),
  title TEXT NOT NULL,
  content_json TEXT NOT NULL CHECK (json_valid(content_json)),
  content_html TEXT NOT NULL,
  content_text TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual', 'before_restore', 'legacy')),
  label TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_folders_parent_position
  ON folders(parent_id, position, name);
CREATE INDEX IF NOT EXISTS idx_documents_active_updated
  ON documents(deleted_at, updated_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_documents_favorite_updated
  ON documents(is_favorite, deleted_at, updated_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_documents_folder_position
  ON documents(folder_id, deleted_at, position, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_versions_document_created
  ON document_versions(document_id, created_at DESC, id);

INSERT OR IGNORE INTO documents (
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
)
SELECT
  id,
  NULL,
  CASE
    WHEN length(trim(title)) = 0 THEN '未命名文档'
    ELSE substr(trim(title), 1, 200)
  END,
  json_object(
    'type', 'doc',
    'attrs', json_object('legacyHtml', json('true'))
  ),
  content_html,
  content_text,
  is_favorite,
  0,
  1,
  created_at,
  updated_at,
  NULL
FROM prompts;

INSERT OR IGNORE INTO document_versions (
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
SELECT
  id,
  prompt_id,
  1,
  CASE
    WHEN length(trim(title)) = 0 THEN '未命名文档'
    ELSE substr(trim(title), 1, 200)
  END,
  json_object(
    'type', 'doc',
    'attrs', json_object('legacyHtml', json('true'))
  ),
  content_html,
  content_text,
  'legacy',
  '从旧版提示词迁移',
  created_at
FROM prompt_versions
WHERE EXISTS (
  SELECT 1
  FROM documents
  WHERE documents.id = prompt_versions.prompt_id
);

PRAGMA defer_foreign_keys = FALSE;
