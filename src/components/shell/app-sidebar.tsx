import { useEffect, useMemo, useState } from "react"
import {
  ArchiveRestore,
  ChevronRight,
  Clock3,
  FileClock,
  FilePenLine,
  FilePlus2,
  FileText,
  Files,
  Folder,
  FolderPlus,
  History,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type {
  DocumentSummary,
  DocumentView,
  FolderRecord,
} from "@/lib/contracts"
import { formatRelativeTime } from "@/lib/utils"
import { useEditorStore } from "@/stores/editor-store"

type ActivityView = DocumentView | "history"

const activities: Array<{
  id: ActivityView
  label: string
  icon: typeof Files
}> = [
  { id: "all", label: "资源管理器", icon: Files },
  { id: "favorites", label: "收藏", icon: Star },
  { id: "history", label: "版本历史", icon: History },
  { id: "trash", label: "回收站", icon: Trash2 },
]

function ActivityButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: typeof Files
  label: string
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={active ? "secondary" : "ghost"}
          size="icon"
          aria-label={label}
          aria-pressed={active}
          onClick={onClick}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

function DocumentMenuItem({
  document,
  activeId,
  onOpen,
}: {
  document: DocumentSummary
  activeId: string | null
  onOpen: (id: string) => void
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={activeId === document.id}
        aria-current={activeId === document.id ? "page" : undefined}
        tooltip={`${document.title} · ${formatRelativeTime(document.updatedAt)}`}
        onClick={() => onOpen(document.id)}
      >
        <FileText />
        <span>{document.title || "未命名文档"}</span>
        {document.isFavorite && <Star className="ml-auto fill-current" />}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function FolderGroup({
  folder,
  folders,
  documents,
  activeId,
  onOpen,
  onCreateDocument,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
}: {
  folder: FolderRecord
  folders: FolderRecord[]
  documents: DocumentSummary[]
  activeId: string | null
  onOpen: (id: string) => void
  onCreateDocument: (folderId: string) => void
  onCreateFolder: (parentId: string) => void
  onDeleteFolder: (folder: FolderRecord) => void
  onRenameFolder: (folder: FolderRecord) => void
}) {
  const childFolders = folders.filter(
    (candidate) => candidate.parentId === folder.id,
  )
  const folderDocuments = documents.filter(
    (document) => document.folderId === folder.id,
  )

  return (
    <SidebarMenuItem>
      <Collapsible defaultOpen className="group/folder">
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            <ChevronRight className="transition-transform group-data-[state=open]/folder:rotate-90" />
            <Folder />
            <span>{folder.name}</span>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction
              showOnHover
              aria-label={`${folder.name} 文件夹操作`}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontal />
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => onCreateDocument(folder.id)}>
                <FilePlus2 />
                新建文档
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onCreateFolder(folder.id)}>
                <FolderPlus />
                新建子文件夹
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onRenameFolder(folder)}>
                <Pencil />
                重命名
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => onDeleteFolder(folder)}
              >
                <Trash2 />
                删除文件夹
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <CollapsibleContent>
          <SidebarMenu className="ml-3 w-[calc(100%-0.75rem)] border-l pl-2">
            {childFolders.length === 0 && folderDocuments.length === 0 ? (
              <SidebarMenuItem>
                <span className="block px-2 py-1.5 text-xs text-muted-foreground">
                  空文件夹
                </span>
              </SidebarMenuItem>
            ) : (
              <>
                {childFolders.map((child) => (
                  <FolderGroup
                    key={child.id}
                    folder={child}
                    folders={folders}
                    documents={documents}
                    activeId={activeId}
                    onOpen={onOpen}
                    onCreateDocument={onCreateDocument}
                    onCreateFolder={onCreateFolder}
                    onDeleteFolder={onDeleteFolder}
                    onRenameFolder={onRenameFolder}
                  />
                ))}
                {folderDocuments.map((document) => (
                  <DocumentMenuItem
                    key={document.id}
                    document={document}
                    activeId={activeId}
                    onOpen={onOpen}
                  />
                ))}
              </>
            )}
          </SidebarMenu>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  )
}

export function AppSidebar() {
  const auth = useEditorStore((state) => state.auth)
  const activeId = useEditorStore((state) => state.activeId)
  const activeView = useEditorStore((state) => state.activeView)
  const documents = useEditorStore((state) => state.documents)
  const trash = useEditorStore((state) => state.trash)
  const folders = useEditorStore((state) => state.folders)
  const versions = useEditorStore((state) =>
    state.activeId ? state.versions[state.activeId] : undefined,
  )
  const searchQuery = useEditorStore((state) => state.searchQuery)
  const libraryLoading = useEditorStore((state) => state.libraryLoading)
  const createDocument = useEditorStore((state) => state.createDocument)
  const createFolder = useEditorStore((state) => state.createFolder)
  const deleteFolder = useEditorStore((state) => state.deleteFolder)
  const loadVersions = useEditorStore((state) => state.loadVersions)
  const logout = useEditorStore((state) => state.logout)
  const openDocument = useEditorStore((state) => state.openDocument)
  const permanentlyDeleteDocument = useEditorStore(
    (state) => state.permanentlyDeleteDocument,
  )
  const restoreDocument = useEditorStore((state) => state.restoreDocument)
  const restoreVersion = useEditorStore((state) => state.restoreVersion)
  const renameFolder = useEditorStore((state) => state.renameFolder)
  const setActiveView = useEditorStore((state) => state.setActiveView)
  const setSearchQuery = useEditorStore((state) => state.setSearchQuery)

  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [folderParentId, setFolderParentId] = useState<string | null>(null)
  const [folderName, setFolderName] = useState("")
  const [folderError, setFolderError] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<FolderRecord | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [renameError, setRenameError] = useState("")
  const [folderDeleteTarget, setFolderDeleteTarget] =
    useState<FolderRecord | null>(null)

  useEffect(() => {
    if (activeView === "history" && activeId) {
      void loadVersions(activeId)
    }
  }, [activeId, activeView, loadVersions])

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("zh-CN")
    const source =
      activeView === "trash"
        ? trash
        : activeView === "favorites"
          ? documents.filter((document) => document.isFavorite)
          : documents

    if (!normalizedQuery) return source
    return source.filter((document) =>
      `${document.title} ${document.excerpt}`
        .toLocaleLowerCase("zh-CN")
        .includes(normalizedQuery),
    )
  }, [activeView, documents, searchQuery, trash])

  const rootDocuments = filteredDocuments.filter(
    (document) => document.folderId === null,
  )
  const rootFolders = folders.filter((folder) => folder.parentId === null)

  function handleCreateDocument(folderId: string | null = null) {
    void createDocument({ folderId }).catch((reason: unknown) => {
      toast.error(reason instanceof Error ? reason.message : "无法创建文档")
    })
  }

  function handleOpenDocument(id: string) {
    void openDocument(id).catch((reason: unknown) =>
      toast.error(reason instanceof Error ? reason.message : "无法打开文档"),
    )
  }

  async function handleCreateFolder() {
    const name = folderName.trim()
    if (!name) {
      setFolderError("请输入文件夹名称。")
      return
    }
    try {
      await createFolder(name, folderParentId)
      setFolderName("")
      setFolderError("")
      setFolderDialogOpen(false)
      setFolderParentId(null)
    } catch (reason) {
      setFolderError(reason instanceof Error ? reason.message : "创建失败")
    }
  }

  async function handleRenameFolder() {
    if (!renameTarget) return
    const name = renameValue.trim()
    if (!name) {
      setRenameError("请输入文件夹名称。")
      return
    }
    try {
      await renameFolder(renameTarget.id, name)
      setRenameTarget(null)
      setRenameValue("")
      setRenameError("")
      toast.success("文件夹已重命名。")
    } catch (reason) {
      setRenameError(reason instanceof Error ? reason.message : "重命名失败")
    }
  }

  async function handleDeleteFolder() {
    if (!folderDeleteTarget) return
    try {
      await deleteFolder(folderDeleteTarget.id)
      toast.success("文件夹已删除，内容已移到上一级。")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "删除失败")
    } finally {
      setFolderDeleteTarget(null)
    }
  }

  const viewLabel =
    activeView === "all"
      ? "资源管理器"
      : activeView === "favorites"
        ? "收藏"
        : activeView === "history"
          ? "版本历史"
          : "回收站"

  return (
    <>
      <Sidebar
        collapsible="icon"
        className="[--sidebar-width:20rem] [--sidebar-width-icon:3rem]"
      >
        <div className="flex h-full min-w-0">
          <div className="workbench-activity-bar flex w-12 shrink-0 flex-col items-center border-r py-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Write Skills"
              className="mb-2"
              onClick={() => setActiveView("all")}
            >
              <FilePenLine />
            </Button>
            <div className="flex flex-1 flex-col gap-1">
              {activities.map((activity) => (
                <ActivityButton
                  key={activity.id}
                  active={activeView === activity.id}
                  icon={activity.icon}
                  label={activity.label}
                  onClick={() => setActiveView(activity.id)}
                />
              ))}
            </div>
            {auth?.required && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="退出登录"
                    onClick={() =>
                      void logout().catch((reason: unknown) =>
                        toast.error(
                          reason instanceof Error ? reason.message : "退出失败",
                        ),
                      )
                    }
                  >
                    <Avatar size="sm">
                      <AvatarFallback>WS</AvatarFallback>
                    </Avatar>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <span className="flex items-center gap-2">
                    <LogOut className="size-3.5" />
                    退出登录
                  </span>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className="workbench-explorer flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
            <SidebarHeader className="border-b">
              <div className="flex h-9 items-center justify-between px-1">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">Write Skills</p>
                  <p className="truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Editorial workspace
                  </p>
                </div>
                <div className="flex gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="新建文件夹"
                        onClick={() => {
                          setFolderParentId(null)
                          setFolderDialogOpen(true)
                        }}
                      >
                        <FolderPlus />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>新建文件夹</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="新建文档"
                        onClick={() => handleCreateDocument()}
                      >
                        <FilePlus2 />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>新建文档</TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <InputGroup>
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="搜索标题与正文"
                  aria-label="搜索文档"
                />
              </InputGroup>
            </SidebarHeader>

            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>{viewLabel}</SidebarGroupLabel>
                {activeView !== "history" && activeView !== "trash" && (
                  <SidebarGroupAction
                    aria-label="新建文档"
                    onClick={() => handleCreateDocument()}
                  >
                    <Plus />
                  </SidebarGroupAction>
                )}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {libraryLoading &&
                      Array.from({ length: 6 }, (_, index) => (
                        <SidebarMenuSkeleton key={index} showIcon />
                      ))}

                    {!libraryLoading && activeView === "all" && (
                      <>
                        {rootFolders.map((folder) => (
                          <FolderGroup
                            key={folder.id}
                            folder={folder}
                            folders={folders}
                            documents={filteredDocuments}
                            activeId={activeId}
                            onOpen={handleOpenDocument}
                            onCreateDocument={(folderId) =>
                              handleCreateDocument(folderId)
                            }
                            onCreateFolder={(parentId) => {
                              setFolderParentId(parentId)
                              setFolderDialogOpen(true)
                            }}
                            onDeleteFolder={setFolderDeleteTarget}
                            onRenameFolder={(target) => {
                              setRenameTarget(target)
                              setRenameValue(target.name)
                              setRenameError("")
                            }}
                          />
                        ))}
                        {rootDocuments.map((document) => (
                          <DocumentMenuItem
                            key={document.id}
                            document={document}
                            activeId={activeId}
                            onOpen={handleOpenDocument}
                          />
                        ))}
                      </>
                    )}

                    {!libraryLoading &&
                      activeView === "favorites" &&
                      filteredDocuments.map((document) => (
                        <DocumentMenuItem
                          key={document.id}
                          document={document}
                          activeId={activeId}
                          onOpen={handleOpenDocument}
                        />
                      ))}

                    {activeView === "history" &&
                      (!activeId ? (
                        <SidebarMenuItem>
                          <span className="block px-2 py-8 text-center text-xs text-muted-foreground">
                            打开文档后查看版本历史
                          </span>
                        </SidebarMenuItem>
                      ) : (
                        (versions ?? []).map((version) => (
                          <SidebarMenuItem key={version.id}>
                            <SidebarMenuButton
                              tooltip={version.excerpt || "空白版本"}
                              onClick={() =>
                                void restoreVersion(activeId, version.id)
                                  .then(() =>
                                    toast.success(
                                      "已恢复此版本，并保留恢复前快照。",
                                    ),
                                  )
                                  .catch((reason: unknown) =>
                                    toast.error(
                                      reason instanceof Error
                                        ? reason.message
                                        : "恢复失败",
                                    ),
                                  )
                              }
                            >
                              <FileClock />
                              <span>
                                {version.label ||
                                  `修订 ${version.sourceRevision}`}
                              </span>
                            </SidebarMenuButton>
                            <SidebarMenuBadge>
                              {formatRelativeTime(version.createdAt)}
                            </SidebarMenuBadge>
                          </SidebarMenuItem>
                        ))
                      ))}

                    {activeView === "trash" &&
                      filteredDocuments.map((document) => (
                        <SidebarMenuItem key={document.id}>
                          <SidebarMenuButton
                            tooltip={document.title}
                            onClick={() =>
                              void restoreDocument(document.id)
                                .then(() => toast.success("文档已恢复。"))
                                .catch((reason: unknown) =>
                                  toast.error(
                                    reason instanceof Error
                                      ? reason.message
                                      : "恢复失败",
                                  ),
                                )
                            }
                          >
                            <ArchiveRestore />
                            <span>{document.title}</span>
                          </SidebarMenuButton>
                          <SidebarMenuAction
                            showOnHover
                            aria-label={`永久删除 ${document.title}`}
                            onClick={() => setDeleteTarget(document.id)}
                          >
                            <Trash2 />
                          </SidebarMenuAction>
                        </SidebarMenuItem>
                      ))}

                    {!libraryLoading &&
                      activeView !== "history" &&
                      filteredDocuments.length === 0 && (
                        <SidebarMenuItem>
                          <div className="flex flex-col items-center gap-2 px-3 py-10 text-center text-xs text-muted-foreground">
                            {activeView === "trash" ? (
                              <Trash2 className="size-5" />
                            ) : activeView === "favorites" ? (
                              <Star className="size-5" />
                            ) : (
                              <FileText className="size-5" />
                            )}
                            <span>
                              {searchQuery
                                ? "没有匹配的文档"
                                : activeView === "trash"
                                  ? "回收站为空"
                                  : activeView === "favorites"
                                    ? "还没有收藏文档"
                                    : "创建第一篇文档"}
                            </span>
                          </div>
                        </SidebarMenuItem>
                      )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t">
              <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <Clock3 className="size-3.5" />
                自动保存 · D1
              </div>
            </SidebarFooter>
          </div>
        </div>
        <SidebarRail />
      </Sidebar>

      <Dialog
        open={folderDialogOpen}
        onOpenChange={(open) => {
          setFolderDialogOpen(open)
          if (!open) {
            setFolderParentId(null)
            setFolderError("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建文件夹</DialogTitle>
            <DialogDescription>
              {folderParentId
                ? "在当前文件夹下创建子文件夹。"
                : "文件夹用于整理工作区中的文档。"}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={Boolean(folderError)}>
              <FieldLabel htmlFor="folder-name">文件夹名称</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <Folder />
                </InputGroupAddon>
                <InputGroupInput
                  id="folder-name"
                  autoFocus
                  value={folderName}
                  aria-invalid={Boolean(folderError)}
                  onChange={(event) => {
                    setFolderName(event.target.value)
                    setFolderError("")
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleCreateFolder()
                  }}
                  placeholder="例如：产品文档"
                />
              </InputGroup>
              <FieldError>{folderError}</FieldError>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFolderDialogOpen(false)}
            >
              取消
            </Button>
            <Button type="button" onClick={() => void handleCreateFolder()}>
              <FolderPlus data-icon="inline-start" />
              创建文件夹
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null)
            setRenameValue("")
            setRenameError("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名文件夹</DialogTitle>
            <DialogDescription>
              文档与子文件夹会保留在原位置。
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={Boolean(renameError)}>
              <FieldLabel htmlFor="folder-rename">文件夹名称</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <Folder />
                </InputGroupAddon>
                <InputGroupInput
                  id="folder-rename"
                  autoFocus
                  value={renameValue}
                  aria-invalid={Boolean(renameError)}
                  onChange={(event) => {
                    setRenameValue(event.target.value)
                    setRenameError("")
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleRenameFolder()
                  }}
                />
              </InputGroup>
              <FieldError>{renameError}</FieldError>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenameTarget(null)}
            >
              取消
            </Button>
            <Button type="button" onClick={() => void handleRenameFolder()}>
              <Pencil />
              保存名称
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={folderDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setFolderDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除文件夹？</AlertDialogTitle>
            <AlertDialogDescription>
              “{folderDeleteTarget?.name}
              ”会被删除，其中的文档和子文件夹会移到根目录，内容不会丢失。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void handleDeleteFolder()}
            >
              <Trash2 />
              删除文件夹
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>永久删除文档？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作会同时删除全部版本记录，且无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!deleteTarget) return
                void permanentlyDeleteDocument(deleteTarget)
                  .then(() => toast.success("文档已永久删除。"))
                  .catch((reason: unknown) =>
                    toast.error(
                      reason instanceof Error ? reason.message : "删除失败",
                    ),
                  )
                  .finally(() => setDeleteTarget(null))
              }}
            >
              永久删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
