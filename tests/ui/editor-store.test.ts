import { beforeEach, describe, expect, it } from "vitest"
import { useWorkspaceStore } from "@/features/workspace/workspace-store"

const initialState = useWorkspaceStore.getState()

describe("workspace store", () => {
  beforeEach(() => {
    useWorkspaceStore.setState(initialState, true)
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

  it("renames and updates a document", () => {
    const state = useWorkspaceStore.getState()
    state.renameNode("welcome", "新的标题")
    state.updateDocumentContent("welcome", "<p>新的内容</p>")

    expect(useWorkspaceStore.getState().nodes.welcome).toMatchObject({
      name: "新的标题",
      content: "<p>新的内容</p>",
    })
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
})
