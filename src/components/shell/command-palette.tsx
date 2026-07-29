import { FilePlus2, FileText, PanelLeft, Save, Search } from "lucide-react"
import { toast } from "sonner"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { useEditorStore } from "@/stores/editor-store"

export function CommandPalette() {
  const open = useEditorStore((state) => state.commandOpen)
  const documents = useEditorStore((state) => state.documents)
  const setOpen = useEditorStore((state) => state.setCommandOpen)
  const setSidebarOpen = useEditorStore((state) => state.setSidebarOpen)
  const sidebarOpen = useEditorStore((state) => state.sidebarOpen)
  const createDocument = useEditorStore((state) => state.createDocument)
  const openDocument = useEditorStore((state) => state.openDocument)
  const saveActive = useEditorStore((state) => state.saveActive)

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="命令中心"
      description="快速打开文档或运行编辑器命令。"
    >
      <CommandInput placeholder="搜索文档或命令…" />
      <CommandList>
        <CommandEmpty>没有匹配的文档或命令。</CommandEmpty>
        <CommandGroup heading="操作">
          <CommandItem
            onSelect={() => {
              setOpen(false)
              void createDocument().catch((reason: unknown) =>
                toast.error(
                  reason instanceof Error ? reason.message : "无法创建文档",
                ),
              )
            }}
          >
            <FilePlus2 />
            新建文档
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setOpen(false)
              void saveActive()
            }}
          >
            <Save />
            立即保存
            <CommandShortcut>⌘S</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setSidebarOpen(!sidebarOpen)
              setOpen(false)
            }}
          >
            <PanelLeft />
            {sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
            <CommandShortcut>⇧⌘B</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="快速打开">
          {documents.map((document) => (
            <CommandItem
              key={document.id}
              value={`${document.title} ${document.excerpt}`}
              onSelect={() => {
                setOpen(false)
                void openDocument(document.id).catch((reason: unknown) =>
                  toast.error(
                    reason instanceof Error ? reason.message : "无法打开文档",
                  ),
                )
              }}
            >
              <FileText />
              <span className="truncate">{document.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="提示">
          <CommandItem disabled>
            <Search />
            输入标题或正文摘要即可筛选
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
