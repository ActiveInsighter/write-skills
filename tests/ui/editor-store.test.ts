import { beforeEach, describe, expect, it } from "vitest"
import {
  initialWorkspaceNodes,
  useWorkspaceStore,
} from "@/features/workspace/workspace-store"

const initialState = useWorkspaceStore.getState()

describe("workspace store", () => {
  beforeEach(() => {
    useWorkspaceStore.setState(
      {
        ...initialState,
        nodes: structuredClone(initialWorkspaceNodes),
        selectedDocumentId: "welcome",
        sidebarOpen: false,
        sidebarCollapsed: false,
      },
      true,
    )
  })

  it("creates and selects a local document", () => {
    const id = useWorkspaceStore.getState().createDocument("writing")
    const state = useWorkspaceStore.getState()

    expect(state.nodes[id]).toMatchObject({
      id,
      kind: "document",
      name: "未命名技能",
    })
    expect(state.selectedDocumentId).toBe(id)
    expect(state.nodes.writing.children).toContain(id)
  })

  it("uses unique names for sibling items", () => {
    const first = useWorkspaceStore.getState().createDocument("writing")
    const second = useWorkspaceStore.getState().createDocument("writing")

    expect(useWorkspaceStore.getState().nodes[first].name).toBe("未命名技能")
    expect(useWorkspaceStore.getState().nodes[second].name).toBe("未命名技能 2")
  })

  it("renames and updates a document", () => {
    const state = useWorkspaceStore.getState()
    state.renameNode("welcome", "新的标题")
    state.updateDocumentContent("welcome", "<p>新的内容</p>")

    expect(useWorkspaceStore.getState().nodes.welcome).toMatchObject({
      name: "新的标题",
      content: "<p>新的内容</p>",
    })
  })

  it("removes a folder and all of its descendants", () => {
    const folderId = useWorkspaceStore.getState().createFolder("root")
    const documentId = useWorkspaceStore.getState().createDocument(folderId)

    useWorkspaceStore.getState().deleteNode(folderId)

    const state = useWorkspaceStore.getState()
    expect(state.nodes[folderId]).toBeUndefined()
    expect(state.nodes[documentId]).toBeUndefined()
    expect(state.nodes.root.children).not.toContain(folderId)
    expect(state.selectedDocumentId).toBe("welcome")
  })

  it("reorders folder children", () => {
    useWorkspaceStore
      .getState()
      .replaceChildren("writing", ["summary", "rewrite", "research"])

    expect(useWorkspaceStore.getState().nodes.writing.children).toEqual([
      "summary",
      "rewrite",
      "research",
    ])
  })

  it("stores the desktop sidebar preference", () => {
    useWorkspaceStore.getState().setSidebarCollapsed(true)
    expect(useWorkspaceStore.getState().sidebarCollapsed).toBe(true)
  })
})
