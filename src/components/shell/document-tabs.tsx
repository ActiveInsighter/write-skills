import { Circle, FileText, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useEditorStore } from "@/stores/editor-store"

export function DocumentTabs() {
  const activeId = useEditorStore((state) => state.activeId)
  const openTabs = useEditorStore((state) => state.openTabs)
  const documents = useEditorStore((state) => state.documents)
  const trash = useEditorStore((state) => state.trash)
  const sessions = useEditorStore((state) => state.sessions)
  const openDocument = useEditorStore((state) => state.openDocument)
  const closeTab = useEditorStore((state) => state.closeTab)

  if (openTabs.length === 0) {
    return (
      <div className="flex h-9 shrink-0 items-center border-b bg-muted/20 px-3 text-xs text-muted-foreground">
        未打开文档
      </div>
    )
  }

  return (
    <div
      className="flex h-9 shrink-0 overflow-x-auto border-b bg-muted/20"
      aria-label="已打开的文档"
    >
      {openTabs.map((id) => {
        const session = sessions[id]
        const summary = [...documents, ...trash].find((item) => item.id === id)
        const title = session?.document.title || summary?.title || "未命名文档"
        const dirty = session?.dirty ?? false

        return (
          <div
            key={id}
            className={cn(
              "group/tab relative flex min-w-36 max-w-60 shrink-0 items-center border-r",
              activeId === id && "bg-background",
            )}
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 px-3 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              aria-current={activeId === id ? "page" : undefined}
              onClick={() =>
                void openDocument(id).catch((reason: unknown) =>
                  toast.error(
                    reason instanceof Error ? reason.message : "无法打开文档",
                  ),
                )
              }
              title={title}
            >
              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{title}</span>
              {dirty && (
                <>
                  <Circle
                    className="size-2.5 shrink-0 fill-primary text-primary"
                    aria-hidden="true"
                  />
                  <span className="sr-only">有未保存更改</span>
                </>
              )}
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="mr-1 opacity-0 group-focus-within/tab:opacity-100 group-hover/tab:opacity-100"
                  aria-label={`关闭 ${title}`}
                  onClick={() => closeTab(id)}
                >
                  <X />
                </Button>
              </TooltipTrigger>
              <TooltipContent>关闭</TooltipContent>
            </Tooltip>
            {activeId === id && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
            )}
          </div>
        )
      })}
    </div>
  )
}
