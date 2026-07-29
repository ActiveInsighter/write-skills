import { useState } from "react"
import {
  ChevronRight,
  Command,
  Copy,
  FileCode2,
  FileJson2,
  History,
  MoreHorizontal,
  Moon,
  Star,
  Sun,
  Trash2,
} from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { downloadText } from "@/lib/utils"
import { useEditorStore } from "@/stores/editor-store"

function safeFilename(title: string, extension: string) {
  const base =
    title
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\.+$/g, "")
      .slice(0, 80) || "untitled"
  return `${base}.${extension}`
}

export function WorkbenchHeader() {
  const { resolvedTheme, setTheme } = useTheme()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const activeId = useEditorStore((state) => state.activeId)
  const activeSession = useEditorStore((state) =>
    state.activeId ? state.sessions[state.activeId] : undefined,
  )
  const folders = useEditorStore((state) => state.folders)
  const setCommandOpen = useEditorStore((state) => state.setCommandOpen)
  const updateDraft = useEditorStore((state) => state.updateDraft)
  const duplicateDocument = useEditorStore((state) => state.duplicateDocument)
  const moveDocumentToTrash = useEditorStore(
    (state) => state.moveDocumentToTrash,
  )
  const createVersion = useEditorStore((state) => state.createVersion)

  const document = activeSession?.document
  const folder = folders.find((item) => item.id === document?.folderId)

  async function handleDuplicate() {
    if (!activeId) return
    try {
      await duplicateDocument(activeId)
      toast.success("已创建文档副本。")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "复制失败")
    }
  }

  async function handleCreateVersion() {
    if (!activeId) return
    try {
      await createVersion(activeId)
      toast.success("已创建版本快照。")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "创建版本失败")
    }
  }

  async function handleMoveToTrash() {
    if (!activeId) return
    try {
      await moveDocumentToTrash(activeId)
      toast.success("文档已移至回收站。")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "移动失败")
    } finally {
      setDeleteOpen(false)
    }
  }

  return (
    <>
      <header className="flex h-11 shrink-0 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarTrigger className="size-8" />
          </TooltipTrigger>
          <TooltipContent side="bottom">
            侧边栏
            <KbdGroup className="ml-2">
              <Kbd>Ctrl</Kbd>
              <Kbd>Shift</Kbd>
              <Kbd>B</Kbd>
            </KbdGroup>
          </TooltipContent>
        </Tooltip>

        <div
          className="hidden min-w-0 items-center gap-1 text-xs text-muted-foreground sm:flex"
          aria-label="文档位置"
        >
          <span className="shrink-0">Write Skills</span>
          <ChevronRight className="size-3.5 shrink-0 opacity-60" />
          {folder && (
            <>
              <span className="max-w-32 truncate">{folder.name}</span>
              <ChevronRight className="size-3.5 shrink-0 opacity-60" />
            </>
          )}
          <span className="max-w-64 truncate text-foreground">
            {document?.title || "编辑器"}
          </span>
        </div>

        <button
          type="button"
          className="mx-auto flex h-7 min-w-0 w-full max-w-80 items-center gap-2 rounded-md border bg-muted/35 px-2.5 text-left text-xs text-muted-foreground shadow-xs outline-none transition-colors hover:bg-muted/65 focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setCommandOpen(true)}
          aria-label="打开命令中心"
        >
          <Command className="size-3.5" />
          <span className="truncate">搜索文档或运行命令</span>
          <KbdGroup className="ml-auto hidden sm:flex">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          {document && activeId && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="hidden sm:inline-flex"
                    aria-label={
                      document.isFavorite ? "取消收藏" : "收藏当前文档"
                    }
                    aria-pressed={document.isFavorite}
                    onClick={() =>
                      updateDraft(activeId, {
                        isFavorite: !document.isFavorite,
                      })
                    }
                  >
                    <Star
                      className={
                        document.isFavorite
                          ? "fill-current text-primary"
                          : undefined
                      }
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {document.isFavorite ? "取消收藏" : "收藏"}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="hidden sm:inline-flex"
                    aria-label="创建版本快照"
                    onClick={() => void handleCreateVersion()}
                  >
                    <History />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>创建版本快照</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="更多文档操作"
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>更多操作</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onSelect={() =>
                        updateDraft(activeId, {
                          isFavorite: !document.isFavorite,
                        })
                      }
                    >
                      <Star
                        className={
                          document.isFavorite
                            ? "fill-current text-primary"
                            : undefined
                        }
                      />
                      {document.isFavorite ? "取消收藏" : "收藏文档"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => void handleCreateVersion()}
                    >
                      <History />
                      创建版本快照
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={() => void handleDuplicate()}>
                      <Copy />
                      创建副本
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        downloadText(
                          safeFilename(document.title, "html"),
                          document.contentHtml,
                          "text/html;charset=utf-8",
                        )
                      }
                    >
                      <FileCode2 />
                      导出 HTML
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        downloadText(
                          safeFilename(document.title, "json"),
                          JSON.stringify(document.contentJson, null, 2),
                          "application/json;charset=utf-8",
                        )
                      }
                    >
                      <FileJson2 />
                      导出 Tiptap JSON
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setDeleteOpen(true)}
                    >
                      <Trash2 />
                      移至回收站
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={
                  resolvedTheme === "dark" ? "切换到浅色主题" : "切换到深色主题"
                }
                onClick={() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                }
              >
                {resolvedTheme === "dark" ? <Sun /> : <Moon />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>切换主题</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>将文档移至回收站？</AlertDialogTitle>
            <AlertDialogDescription>
              “{document?.title || "未命名文档"}
              ”会从工作区移除，但仍可从回收站恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void handleMoveToTrash()}
            >
              <Trash2 />
              移至回收站
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
