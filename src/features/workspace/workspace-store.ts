import { create } from "zustand"
import { persist } from "zustand/middleware"

export type WorkspaceNodeKind = "folder" | "document"

export interface WorkspaceNode {
  id: string
  name: string
  kind: WorkspaceNodeKind
  children?: string[]
  content?: string
  updatedAt: string
}

interface WorkspaceState {
  nodes: Record<string, WorkspaceNode>
  selectedDocumentId: string
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  selectDocument: (id: string) => void
  setSidebarOpen: (open: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  renameNode: (id: string, name: string) => void
  updateDocumentContent: (id: string, content: string) => void
  createDocument: (parentId?: string) => string
  createFolder: (parentId?: string) => string
  deleteNode: (id: string) => void
  replaceChildren: (parentId: string, children: string[]) => void
}

const now = new Date().toISOString()

const welcomeContent = `
<h1>把提示词整理成真正可复用的技能</h1>
<p>Write Skills 是一个专注写作的工作台。左侧用目录组织技能，右侧使用 Tiptap 编辑正文。</p>
<h2>推荐结构</h2>
<ul>
  <li><p><strong>目标</strong>：这项技能最终要完成什么。</p></li>
  <li><p><strong>输入</strong>：开始前需要哪些材料。</p></li>
  <li><p><strong>步骤</strong>：按什么顺序处理任务。</p></li>
  <li><p><strong>输出</strong>：结果采用什么格式与标准。</p></li>
</ul>
<blockquote><p>先确定结构，再补充约束、示例和边界条件。</p></blockquote>
<p>你可以使用标题、列表、任务清单、引用、代码块、链接、图片和高亮。</p>
`

export const initialWorkspaceNodes: Record<string, WorkspaceNode> = {
  root: {
    id: "root",
    name: "工作区",
    kind: "folder",
    children: ["getting-started", "writing", "archive"],
    updatedAt: now,
  },
  "getting-started": {
    id: "getting-started",
    name: "开始使用",
    kind: "folder",
    children: ["welcome", "editor-guide"],
    updatedAt: now,
  },
  welcome: {
    id: "welcome",
    name: "欢迎使用 Write Skills",
    kind: "document",
    content: welcomeContent,
    updatedAt: now,
  },
  "editor-guide": {
    id: "editor-guide",
    name: "编辑器快捷方式",
    kind: "document",
    content:
      '<h1>编辑器快捷方式</h1><p>使用 <code>Ctrl/Cmd + B</code> 加粗，使用工具栏插入链接与图片。</p><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>熟悉工具栏</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>创建第一个技能</p></div></li></ul>',
    updatedAt: now,
  },
  writing: {
    id: "writing",
    name: "写作技能",
    kind: "folder",
    children: ["rewrite", "research", "summary"],
    updatedAt: now,
  },
  rewrite: {
    id: "rewrite",
    name: "专业改写",
    kind: "document",
    content:
      "<h1>专业改写</h1><p>把用户提供的原文改写得更清晰、准确、自然，同时保留原意。</p><h2>处理原则</h2><ol><li><p>先判断受众与使用场景。</p></li><li><p>修复结构、语法和表达问题。</p></li><li><p>避免加入未经提供的新事实。</p></li></ol>",
    updatedAt: now,
  },
  research: {
    id: "research",
    name: "资料研究",
    kind: "document",
    content:
      "<h1>资料研究</h1><p>围绕明确问题查找可靠资料，区分事实、观点与推断，并提供可核验来源。</p>",
    updatedAt: now,
  },
  summary: {
    id: "summary",
    name: "长文总结",
    kind: "document",
    content:
      "<h1>长文总结</h1><p>提取关键结论、证据、限制和后续行动，不机械复述原文。</p>",
    updatedAt: now,
  },
  archive: {
    id: "archive",
    name: "归档",
    kind: "folder",
    children: [],
    updatedAt: now,
  },
}

function makeId(prefix: WorkspaceNodeKind) {
  const value =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  return `${prefix}-${value}`
}

function getFolderId(nodes: Record<string, WorkspaceNode>, preferred?: string) {
  if (preferred && nodes[preferred]?.kind === "folder") return preferred
  return nodes.writing?.kind === "folder" ? "writing" : "root"
}

function getDescendantIds(
  nodes: Record<string, WorkspaceNode>,
  nodeId: string,
): string[] {
  const node = nodes[nodeId]
  if (!node) return []
  return [
    nodeId,
    ...(node.children ?? []).flatMap((childId) =>
      getDescendantIds(nodes, childId),
    ),
  ]
}

function getFirstDocumentId(nodes: Record<string, WorkspaceNode>) {
  const queue = [...(nodes.root?.children ?? [])]
  while (queue.length > 0) {
    const id = queue.shift()
    if (!id) continue
    const node = nodes[id]
    if (!node) continue
    if (node.kind === "document") return id
    queue.unshift(...(node.children ?? []))
  }
  return ""
}

function makeUniqueName(
  nodes: Record<string, WorkspaceNode>,
  parentId: string,
  baseName: string,
) {
  const siblingNames = new Set(
    (nodes[parentId]?.children ?? []).map((id) => nodes[id]?.name),
  )
  if (!siblingNames.has(baseName)) return baseName

  let suffix = 2
  while (siblingNames.has(`${baseName} ${suffix}`)) suffix += 1
  return `${baseName} ${suffix}`
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      nodes: initialWorkspaceNodes,
      selectedDocumentId: "welcome",
      sidebarOpen: false,
      sidebarCollapsed: false,

      selectDocument: (id) => {
        if (get().nodes[id]?.kind !== "document") return
        set({ selectedDocumentId: id, sidebarOpen: false })
      },

      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

      renameNode: (id, name) => {
        const node = get().nodes[id]
        if (!node || id === "root") return
        const normalizedName = name.replace(/\s+/g, " ").slice(0, 80)
        if (!normalizedName.trim()) return

        set((state) => ({
          nodes: {
            ...state.nodes,
            [id]: {
              ...state.nodes[id],
              name: normalizedName,
              updatedAt: new Date().toISOString(),
            },
          },
        }))
      },

      updateDocumentContent: (id, content) => {
        if (get().nodes[id]?.kind !== "document") return
        set((state) => ({
          nodes: {
            ...state.nodes,
            [id]: {
              ...state.nodes[id],
              content,
              updatedAt: new Date().toISOString(),
            },
          },
        }))
      },

      createDocument: (parentId) => {
        const state = get()
        const parent = getFolderId(state.nodes, parentId)
        const id = makeId("document")
        const createdAt = new Date().toISOString()
        const name = makeUniqueName(state.nodes, parent, "未命名技能")

        set((current) => ({
          nodes: {
            ...current.nodes,
            [id]: {
              id,
              name,
              kind: "document",
              content: `<h1>${name}</h1><p>从这里开始写作…</p>`,
              updatedAt: createdAt,
            },
            [parent]: {
              ...current.nodes[parent],
              children: [...(current.nodes[parent].children ?? []), id],
              updatedAt: createdAt,
            },
          },
          selectedDocumentId: id,
          sidebarOpen: false,
        }))

        return id
      },

      createFolder: (parentId) => {
        const state = get()
        const parent = getFolderId(state.nodes, parentId ?? "root")
        const id = makeId("folder")
        const createdAt = new Date().toISOString()
        const name = makeUniqueName(state.nodes, parent, "新建文件夹")

        set((current) => ({
          nodes: {
            ...current.nodes,
            [id]: {
              id,
              name,
              kind: "folder",
              children: [],
              updatedAt: createdAt,
            },
            [parent]: {
              ...current.nodes[parent],
              children: [...(current.nodes[parent].children ?? []), id],
              updatedAt: createdAt,
            },
          },
        }))

        return id
      },

      deleteNode: (id) => {
        if (id === "root" || !get().nodes[id]) return

        set((state) => {
          const deletedIds = new Set(getDescendantIds(state.nodes, id))
          const nodes = Object.fromEntries(
            Object.entries(state.nodes)
              .filter(([nodeId]) => !deletedIds.has(nodeId))
              .map(([nodeId, node]) => [
                nodeId,
                node.kind === "folder"
                  ? {
                      ...node,
                      children: (node.children ?? []).filter(
                        (childId) => !deletedIds.has(childId),
                      ),
                    }
                  : node,
              ]),
          ) as Record<string, WorkspaceNode>

          const selectedDocumentId = deletedIds.has(state.selectedDocumentId)
            ? getFirstDocumentId(nodes)
            : state.selectedDocumentId

          return { nodes, selectedDocumentId }
        })
      },

      replaceChildren: (parentId, children) => {
        if (get().nodes[parentId]?.kind !== "folder") return
        const uniqueChildren = [...new Set(children)].filter(
          (childId) => childId !== parentId && Boolean(get().nodes[childId]),
        )

        set((state) => ({
          nodes: {
            ...state.nodes,
            [parentId]: {
              ...state.nodes[parentId],
              children: uniqueChildren,
              updatedAt: new Date().toISOString(),
            },
          },
        }))
      },
    }),
    {
      name: "write-skills-workspace-v2",
      version: 2,
      partialize: (state) => ({
        nodes: state.nodes,
        selectedDocumentId: state.selectedDocumentId,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
      merge: (persisted, current) => {
        const restored = persisted as Partial<WorkspaceState> | undefined
        const nodes = restored?.nodes ?? current.nodes
        const selectedDocumentId =
          restored?.selectedDocumentId &&
          nodes[restored.selectedDocumentId]?.kind === "document"
            ? restored.selectedDocumentId
            : getFirstDocumentId(nodes) || current.selectedDocumentId

        return {
          ...current,
          ...restored,
          nodes,
          selectedDocumentId,
          sidebarOpen: false,
        }
      },
    },
  ),
)
