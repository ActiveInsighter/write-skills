import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DocumentTabs } from "@/components/shell/document-tabs"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useEditorStore } from "@/stores/editor-store"
import { makeDocument, makeSession, makeSummary } from "./fixtures"

describe("DocumentTabs", () => {
  const initialState = useEditorStore.getInitialState()

  beforeEach(() => {
    localStorage.clear()
    useEditorStore.setState(initialState, true)
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("Unexpected network request"))),
    )
  })

  afterEach(() => {
    useEditorStore.setState(initialState, true)
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("shows active and dirty state, then activates an existing tab", async () => {
    const first = makeDocument({ id: "document-1", title: "第一章" })
    const second = makeDocument({ id: "document-2", title: "第二章" })

    useEditorStore.setState({
      documents: [makeSummary(first), makeSummary(second)],
      sessions: {
        [first.id]: makeSession(first),
        [second.id]: makeSession(second, {
          dirty: true,
          localVersion: 1,
          saveState: "dirty",
        }),
      },
      activeId: first.id,
      openTabs: [first.id, second.id],
    })

    const user = userEvent.setup()
    render(
      <TooltipProvider delayDuration={0}>
        <DocumentTabs />
      </TooltipProvider>,
    )

    const firstTab = screen.getByTitle("第一章")
    const secondTab = screen.getByTitle("第二章")
    expect(screen.getByLabelText("已打开的文档")).toBeInTheDocument()
    expect(firstTab).toHaveAttribute("aria-current", "page")
    expect(secondTab).not.toHaveAttribute("aria-current")
    expect(
      within(secondTab.parentElement as HTMLElement).getByText("有未保存更改"),
    ).toBeInTheDocument()

    await user.click(secondTab)

    expect(useEditorStore.getState().activeId).toBe(second.id)
    expect(secondTab).toHaveAttribute("aria-current", "page")
    expect(firstTab).not.toHaveAttribute("aria-current")
    expect(fetch).not.toHaveBeenCalled()
  })
})
