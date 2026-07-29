import type {
  CreateFolderInput,
  DocumentListQuery,
  DuplicateDocumentInput,
  EditorDocumentJson,
  UpdateFolderInput,
  VersionKind,
} from "../src/lib/contracts"
import { badRequest, validationProblem } from "./http"
import type { ParsedDocumentContent } from "./types"

const EMPTY_DOCUMENT: EditorDocumentJson = {
  type: "doc",
  content: [{ type: "paragraph" }],
}

const EMPTY_DOCUMENT_HTML = "<p></p>"
const MAX_ID_LENGTH = 128
const MAX_TITLE_LENGTH = 200
const MAX_FOLDER_NAME_LENGTH = 120
const MAX_CONTENT_LENGTH = 600_000
const MAX_LABEL_LENGTH = 120

type Issues = Record<string, string[]>

export type ValidatedDocumentCreate = {
  folderId: string | null
  title: string
  content: ParsedDocumentContent
  isFavorite: boolean
  position: number
}

export type ValidatedDocumentUpdate = {
  expectedRevision: number
  folderId?: string | null
  title?: string
  content?: ParsedDocumentContent
  isFavorite?: boolean
  position?: number
}

export type ValidatedVersionCreate = {
  expectedRevision: number
  kind: Extract<VersionKind, "manual">
  label: string | null
}

function addIssue(issues: Issues, field: string, message: string) {
  ;(issues[field] ??= []).push(message)
}

function rejectUnknownFields(
  body: Record<string, unknown>,
  allowed: readonly string[],
  issues: Issues,
) {
  const allowedSet = new Set(allowed)
  for (const key of Object.keys(body)) {
    if (!allowedSet.has(key)) addIssue(issues, key, "不支持该字段")
  }
}

function optionalString(
  body: Record<string, unknown>,
  field: string,
  issues: Issues,
  options: {
    max: number
    min?: number
    trim?: boolean
  },
) {
  if (!(field in body)) return undefined
  if (typeof body[field] !== "string") {
    addIssue(issues, field, "必须是字符串")
    return undefined
  }
  const value = options.trim === false ? body[field] : body[field].trim()
  const min = options.min ?? 0
  if (value.length < min) addIssue(issues, field, `长度不能少于 ${min}`)
  if (value.length > options.max) {
    addIssue(issues, field, `长度不能超过 ${options.max}`)
  }
  return value
}

function optionalBoolean(
  body: Record<string, unknown>,
  field: string,
  issues: Issues,
) {
  if (!(field in body)) return undefined
  if (typeof body[field] !== "boolean") {
    addIssue(issues, field, "必须是布尔值")
    return undefined
  }
  return body[field]
}

function optionalInteger(
  body: Record<string, unknown>,
  field: string,
  issues: Issues,
  options: { max?: number; min: number },
) {
  if (!(field in body)) return undefined
  const value = body[field]
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < options.min ||
    (options.max !== undefined && value > options.max)
  ) {
    const maxMessage =
      options.max === undefined ? "" : ` 且不大于 ${options.max}`
    addIssue(issues, field, `必须是大于等于 ${options.min}${maxMessage} 的整数`)
    return undefined
  }
  return value
}

function optionalNullableId(
  body: Record<string, unknown>,
  field: string,
  issues: Issues,
) {
  if (!(field in body)) return undefined
  const value = body[field]
  if (value === null) return null
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > MAX_ID_LENGTH
  ) {
    addIssue(issues, field, "必须是有效的资源 ID 或 null")
    return undefined
  }
  return value.trim()
}

function requiredRevision(body: Record<string, unknown>, issues: Issues) {
  if (!("expectedRevision" in body)) {
    addIssue(issues, "expectedRevision", "缺少该字段")
    return undefined
  }
  return optionalInteger(body, "expectedRevision", issues, { min: 1 })
}

function parseEditorDocument(
  value: unknown,
  issues: Issues,
): { value?: EditorDocumentJson; text?: string } {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (value as { type?: unknown }).type !== "doc"
  ) {
    addIssue(issues, "contentJson", "必须是 type 为 doc 的 Tiptap JSON 对象")
    return {}
  }

  let text: string
  try {
    text = JSON.stringify(value)
  } catch {
    addIssue(issues, "contentJson", "无法序列化为 JSON")
    return {}
  }

  if (text.length > MAX_CONTENT_LENGTH) {
    addIssue(
      issues,
      "contentJson",
      `序列化后长度不能超过 ${MAX_CONTENT_LENGTH}`,
    )
  }
  return { value: value as EditorDocumentJson, text }
}

function parseContentFields(
  body: Record<string, unknown>,
  issues: Issues,
  required: boolean,
) {
  const contentFields = ["contentJson", "contentHtml", "contentText"] as const
  const present = contentFields.filter((field) => field in body)
  if (present.length === 0) {
    if (!required) return undefined
    return {
      contentJson: EMPTY_DOCUMENT,
      contentJsonText: JSON.stringify(EMPTY_DOCUMENT),
      contentHtml: EMPTY_DOCUMENT_HTML,
      contentText: "",
    } satisfies ParsedDocumentContent
  }

  if (present.length !== contentFields.length) {
    for (const field of contentFields) {
      if (!(field in body)) {
        addIssue(
          issues,
          field,
          "更新正文时 contentJson、contentHtml、contentText 必须同时提供",
        )
      }
    }
    return undefined
  }

  const parsedJson = parseEditorDocument(body.contentJson, issues)
  const contentHtml = optionalString(body, "contentHtml", issues, {
    max: MAX_CONTENT_LENGTH,
    trim: false,
  })
  const contentText = optionalString(body, "contentText", issues, {
    max: MAX_CONTENT_LENGTH,
    trim: false,
  })

  if (
    !parsedJson.value ||
    parsedJson.text === undefined ||
    contentHtml === undefined ||
    contentText === undefined
  ) {
    return undefined
  }

  return {
    contentJson: parsedJson.value,
    contentJsonText: parsedJson.text,
    contentHtml,
    contentText,
  } satisfies ParsedDocumentContent
}

function throwIssues(issues: Issues) {
  if (Object.keys(issues).length > 0) throw validationProblem(issues)
}

export function parseLoginInput(body: Record<string, unknown>) {
  const issues: Issues = {}
  rejectUnknownFields(body, ["password"], issues)
  const password = optionalString(body, "password", issues, {
    max: 512,
    min: 1,
    trim: false,
  })
  if (!("password" in body)) addIssue(issues, "password", "缺少该字段")
  throwIssues(issues)
  return { password: password! }
}

export function parseFolderCreate(
  body: Record<string, unknown>,
): CreateFolderInput {
  const issues: Issues = {}
  rejectUnknownFields(body, ["name", "parentId", "position"], issues)
  const name = optionalString(body, "name", issues, {
    max: MAX_FOLDER_NAME_LENGTH,
    min: 1,
  })
  if (!("name" in body)) addIssue(issues, "name", "缺少该字段")
  const parentId = optionalNullableId(body, "parentId", issues)
  const position = optionalInteger(body, "position", issues, { min: 0 })
  throwIssues(issues)
  return {
    name: name!,
    ...(parentId !== undefined ? { parentId } : {}),
    ...(position !== undefined ? { position } : {}),
  }
}

export function parseFolderUpdate(
  body: Record<string, unknown>,
): UpdateFolderInput {
  const issues: Issues = {}
  rejectUnknownFields(body, ["name", "parentId", "position"], issues)
  const name = optionalString(body, "name", issues, {
    max: MAX_FOLDER_NAME_LENGTH,
    min: 1,
  })
  const parentId = optionalNullableId(body, "parentId", issues)
  const position = optionalInteger(body, "position", issues, { min: 0 })
  if (!["name", "parentId", "position"].some((field) => field in body)) {
    addIssue(issues, "$", "至少提供一个要更新的字段")
  }
  throwIssues(issues)
  return {
    ...(name !== undefined ? { name } : {}),
    ...(parentId !== undefined ? { parentId } : {}),
    ...(position !== undefined ? { position } : {}),
  }
}

export function parseDocumentCreate(
  body: Record<string, unknown>,
): ValidatedDocumentCreate {
  const issues: Issues = {}
  rejectUnknownFields(
    body,
    [
      "folderId",
      "title",
      "contentJson",
      "contentHtml",
      "contentText",
      "isFavorite",
      "position",
    ],
    issues,
  )
  const folderId = optionalNullableId(body, "folderId", issues)
  const title = optionalString(body, "title", issues, {
    max: MAX_TITLE_LENGTH,
    min: 0,
  })
  const isFavorite = optionalBoolean(body, "isFavorite", issues)
  const position = optionalInteger(body, "position", issues, { min: 0 })
  const content = parseContentFields(body, issues, true)
  throwIssues(issues)
  return {
    folderId: folderId ?? null,
    title: title || "未命名文档",
    content: content!,
    isFavorite: isFavorite ?? false,
    position: position ?? 0,
  }
}

export function parseDocumentUpdate(
  body: Record<string, unknown>,
): ValidatedDocumentUpdate {
  const issues: Issues = {}
  rejectUnknownFields(
    body,
    [
      "expectedRevision",
      "folderId",
      "title",
      "contentJson",
      "contentHtml",
      "contentText",
      "isFavorite",
      "position",
    ],
    issues,
  )
  const expectedRevision = requiredRevision(body, issues)
  const folderId = optionalNullableId(body, "folderId", issues)
  const title = optionalString(body, "title", issues, {
    max: MAX_TITLE_LENGTH,
    min: 0,
  })
  const isFavorite = optionalBoolean(body, "isFavorite", issues)
  const position = optionalInteger(body, "position", issues, { min: 0 })
  const content = parseContentFields(body, issues, false)
  if (
    ![
      "folderId",
      "title",
      "contentJson",
      "contentHtml",
      "contentText",
      "isFavorite",
      "position",
    ].some((field) => field in body)
  ) {
    addIssue(issues, "$", "至少提供一个要更新的字段")
  }
  throwIssues(issues)
  return {
    expectedRevision: expectedRevision!,
    ...(folderId !== undefined ? { folderId } : {}),
    ...(title !== undefined ? { title: title || "未命名文档" } : {}),
    ...(content ? { content } : {}),
    ...(isFavorite !== undefined ? { isFavorite } : {}),
    ...(position !== undefined ? { position } : {}),
  }
}

export function parseRevisionInput(body: Record<string, unknown>) {
  const issues: Issues = {}
  rejectUnknownFields(body, ["expectedRevision"], issues)
  const expectedRevision = requiredRevision(body, issues)
  throwIssues(issues)
  return { expectedRevision: expectedRevision! }
}

export function parseDuplicateInput(
  body: Record<string, unknown>,
): DuplicateDocumentInput {
  const issues: Issues = {}
  rejectUnknownFields(body, ["expectedRevision", "folderId", "title"], issues)
  const expectedRevision = optionalInteger(body, "expectedRevision", issues, {
    min: 1,
  })
  const folderId = optionalNullableId(body, "folderId", issues)
  const title = optionalString(body, "title", issues, {
    max: MAX_TITLE_LENGTH,
    min: 1,
  })
  throwIssues(issues)
  return {
    ...(expectedRevision !== undefined ? { expectedRevision } : {}),
    ...(folderId !== undefined ? { folderId } : {}),
    ...(title !== undefined ? { title } : {}),
  }
}

export function parseVersionCreate(
  body: Record<string, unknown>,
): ValidatedVersionCreate {
  const issues: Issues = {}
  rejectUnknownFields(body, ["expectedRevision", "label"], issues)
  const expectedRevision = requiredRevision(body, issues)
  const label = optionalString(body, "label", issues, {
    max: MAX_LABEL_LENGTH,
    min: 1,
  })
  throwIssues(issues)
  return {
    expectedRevision: expectedRevision!,
    kind: "manual",
    label: label ?? null,
  }
}

export function parseDocumentListQuery(url: URL): Required<
  Pick<DocumentListQuery, "page" | "pageSize" | "q" | "view">
> & {
  folderId?: string | null
} {
  const view = url.searchParams.get("view") ?? "all"
  if (!["all", "favorites", "trash"].includes(view)) {
    throw badRequest("view 必须是 all、favorites 或 trash", "invalid_view")
  }
  const q = (url.searchParams.get("q") ?? "").trim()
  if (q.length > 100) {
    throw badRequest("搜索词不能超过 100 个字符", "query_too_long")
  }
  const page = parsePositiveQueryInteger(url, "page", 1, 10_000)
  const pageSize = parsePositiveQueryInteger(url, "pageSize", 30, 100)
  const rawFolderId = url.searchParams.get("folderId")
  if (
    rawFolderId !== null &&
    (rawFolderId.trim().length === 0 || rawFolderId.length > MAX_ID_LENGTH)
  ) {
    throw badRequest("folderId 无效", "invalid_folder_id")
  }
  return {
    view: view as "all" | "favorites" | "trash",
    q,
    page,
    pageSize,
    ...(rawFolderId !== null
      ? { folderId: rawFolderId === "root" ? null : rawFolderId.trim() }
      : {}),
  }
}

export function parsePaginationQuery(url: URL) {
  return {
    page: parsePositiveQueryInteger(url, "page", 1, 10_000),
    pageSize: parsePositiveQueryInteger(url, "pageSize", 30, 100),
  }
}

function parsePositiveQueryInteger(
  url: URL,
  field: string,
  fallback: number,
  max: number,
) {
  const raw = url.searchParams.get(field)
  if (raw === null) return fallback
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw badRequest(
      `${field} 必须是 1 到 ${max} 的整数`,
      `invalid_${field.toLowerCase()}`,
    )
  }
  return value
}

export function parsePathId(value: string | undefined, resource: string) {
  if (!value) throw badRequest(`缺少${resource} ID`, "missing_resource_id")
  let decoded: string
  try {
    decoded = decodeURIComponent(value)
  } catch {
    throw badRequest(`${resource} ID 编码无效`, "invalid_resource_id")
  }
  if (
    decoded.trim().length === 0 ||
    decoded.length > MAX_ID_LENGTH ||
    decoded.includes("/")
  ) {
    throw badRequest(`${resource} ID 无效`, "invalid_resource_id")
  }
  return decoded.trim()
}
