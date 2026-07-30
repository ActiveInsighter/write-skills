import { create } from "zustand"

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
  selectDocument: (id: string) => void
  setSidebarOpen: (open: boolean) => void
  renameNode: (id: string, name: string) => void
  updateDocumentContent: (id: string, content: string) => void
  createDocument: (parentId?: string) => string
  createFolder: (parentId?: string) => string
  replaceChildren: (parentId: string, children: string[]) => void
}

const now = new Date().toISOString()

const welcomeContent = `
<h1>把好提示词，写成可复用的技能</h1>
<p>这里是你的写作工作台。左侧用于组织目录，右侧专注编辑内容。</p>
<h2>推荐结构</h2>
<ul>
  <li><p><strong>目标</strong>：这项技能最终要完成什么。</p></li>
  <li><p><strong>输入</strong>：需要用户提供哪些信息。</p></li>
  <li><p><strong>流程</strong>：按什么顺序处理任务。</p></li>
  <li><p><strong>输出</strong>：结果应采用什么格式。</p></li>
</ul>
<blockquote><p>先把结构写清楚，再补充约束与示例。</p></blockquote>
<p>你可以使用标题、列表、任务清单、引用、代码块、链接、图片和高亮。</p>
`

const initialNodes: Record<string, WorkspaceNode> = {
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
      "<h1>编辑器快捷方式</h1><p>使用 <code>Ctrl/Cmd + B</code> 加粗，使用 <code>Ctrl/Cmd + K</code> 添加链接。</p><ul data-type=\"taskList\"><li data-type=\"taskItem\" data-checked=\"true\"><label><input type=\"checkbox\" checked=\"checked\"><span></span></label><div><p>熟悉工具栏</p></div></li><li data-type=\"taskItem\" data-checked=\"false\"><label><input type=\"checkbox\"><span></span></label><div><p>创建第一个技能</p></div></li></ul>",
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

function makeId(prefix: string) {
  const value =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  return `${prefix}-${value}`
}

function resolveFolder(nodes: Record<string, WorkspaceNode>, preferred?: string) {
  if (preferred && nodes[preferred]?.kind === "folder") return preferred
  return "writing"
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  nodes: initialNodes,
  selectedDocumentId: "welcome",
  sidebarOpen: false,

  selectDocument: (id) => {
    if (get().nodes[id]?.kind !== "document") return
    set({ selectedDocumentId: id, sidebarOpen: false })
  },

  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

  renameNode: (id, name) => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    set((state) => ({
      nodes: {
        ...state.nodes,
        [id]: {
          ...state.nodes[id],
          name: trimmedName,
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
    const id = makeId("document")
    const parent = resolveFolder(get().nodes, parentId)
    const createdAt = new Date().toISOString()

    set((state) => ({
      nodes: {
        ...state.nodes,
        [id]: {
          id,
          name: "未命名技能",
          kind: "document",
          content: "<h1>未命名技能</h1><p>从这里开始写作…</p>",
          updatedAt: createdAt,
        },
        [parent]: {
          ...state.nodes[parent],
          children: [...(state.nodes[parent].children ?? []), id],
          updatedAt: createdAt,
        },
      },
      selectedDocumentId: id,
      sidebarOpen: false,
    }))

    return id
  },

  createFolder: (parentId) => {
    const id = makeId("folder")
    const parent = resolveFolder(get().nodes, parentId ?? "root")
    const createdAt = new Date().toISOString()

    set((state) => ({
      nodes: {
        ...state.nodes,
        [id]: {
          id,
          name: "新建文件夹",
          kind: "folder",
          children: [],
          updatedAt: createdAt,
        },
        [parent]: {
          ...state.nodes[parent],
          children: [...(state.nodes[parent].children ?? []), id],
          updatedAt: createdAt,
        },
      },
    }))

    return id
  },

  replaceChildren: (parentId, children) => {
    if (get().nodes[parentId]?.kind !== "folder") return
    set((state) => ({
      nodes: {
        ...state.nodes,
        [parentId]: {
          ...state.nodes[parentId],
          children,
          updatedAt: new Date().toISOString(),
        },
      },
    }))
  },
}))
