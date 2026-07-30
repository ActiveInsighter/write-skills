import { Fragment, useEffect, useMemo } from "react"
import {
  createOnDropHandler,
  dragAndDropFeature,
  hotkeysCoreFeature,
  keyboardDragAndDropFeature,
  renamingFeature,
  searchFeature,
  selectionFeature,
  syncDataLoaderFeature,
} from "@headless-tree/core"
import { AssistiveTreeDescription, useTree } from "@headless-tree/react"
import {
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  PanelLeftClose,
  Search,
  Sparkles,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  type WorkspaceNode,
  useWorkspaceStore,
} from "@/features/workspace/workspace-store"

export function WorkspaceSidebar() {
  const nodes = useWorkspaceStore((state) => state.nodes)
  const selectedDocumentId = useWorkspaceStore(
    (state) => state.selectedDocumentId,
  )
  const sidebarOpen = useWorkspaceStore((state) => state.sidebarOpen)
  const selectDocument = useWorkspaceStore((state) => state.selectDocument)
  const setSidebarOpen = useWorkspaceStore((state) => state.setSidebarOpen)
  const createDocument = useWorkspaceStore((state) => state.createDocument)
  const createFolder = useWorkspaceStore((state) => state.createFolder)
  const renameNode = useWorkspaceStore((state) => state.renameNode)
  const replaceChildren = useWorkspaceStore((state) => state.replaceChildren)

  const dataLoader = useMemo(
    () => ({
      getItem: (itemId: string) => nodes[itemId],
      getChildren: (itemId: string) => nodes[itemId]?.children ?? [],
    }),
    [nodes],
  )

  const tree = useTree<WorkspaceNode>({
    rootItemId: "root",
    initialState: {
      expandedItems: ["getting-started", "writing"],
      selectedItems: [selectedDocumentId],
    },
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => item.getItemData().kind === "folder",
    dataLoader,
    indent: 18,
    canReorder: true,
    onDrop: createOnDropHandler((item, newChildren) => {
      replaceChildren(item.getId(), newChildren)
    }),
    onRename: (item, value) => renameNode(item.getId(), value),
    onPrimaryAction: (item) => {
      if (item.isFolder()) {
        if (item.isExpanded()) item.collapse()
        else item.expand()
        return
      }
      selectDocument(item.getId())
    },
    features: [
      syncDataLoaderFeature,
      selectionFeature,
      hotkeysCoreFeature,
      dragAndDropFeature,
      keyboardDragAndDropFeature,
      renamingFeature,
      searchFeature,
    ],
  })

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        tree.openSearch()
      }
    }

    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [tree])

  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          aria-label="关闭侧边栏"
          className="workspace-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn("workspace-sidebar", sidebarOpen && "is-mobile-open")}
      >
        <header className="workspace-sidebar-header">
          <div className="workspace-brand-mark" aria-hidden="true">
            <Sparkles size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="workspace-brand-title">Write Skills</p>
            <p className="workspace-brand-subtitle">个人技能工作台</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="关闭侧边栏"
            onClick={() => setSidebarOpen(false)}
          >
            <PanelLeftClose />
          </Button>
        </header>

        <div className="workspace-create-row">
          <Button
            type="button"
            className="flex-1 justify-start"
            onClick={() => createDocument("writing")}
          >
            <FilePlus2 />
            新建技能
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="新建文件夹"
            onClick={() => createFolder("root")}
          >
            <FolderPlus />
          </Button>
        </div>

        <div className="workspace-search-shell">
          {tree.isSearchOpen() ? (
            <>
              <Search size={15} aria-hidden="true" />
              <input
                {...tree.getSearchInputElementProps()}
                autoFocus
                className="workspace-search-input"
                placeholder="搜索技能或文件夹"
              />
              <button
                type="button"
                className="workspace-search-close"
                aria-label="关闭搜索"
                onClick={() => tree.closeSearch()}
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="workspace-search-trigger"
              onClick={() => tree.openSearch()}
            >
              <Search size={15} />
              <span>搜索</span>
              <kbd>⌘ K</kbd>
            </button>
          )}
        </div>

        <div className="workspace-section-label">
          <span>全部技能</span>
          {tree.isSearchOpen() && (
            <span>{tree.getSearchMatchingItems().length} 项匹配</span>
          )}
        </div>

        <div className="workspace-tree-scroll">
          <div {...tree.getContainerProps()} className="workspace-tree">
            <AssistiveTreeDescription tree={tree} />
            {tree.getItems().map((item) => {
              const node = item.getItemData()
              const isActive = item.getId() === selectedDocumentId
              const isFolder = item.isFolder()

              return (
                <Fragment key={item.getId()}>
                  {item.isRenaming() ? (
                    <div
                      className="workspace-tree-rename"
                      style={{
                        paddingLeft: `${item.getItemMeta().level * 18 + 30}px`,
                      }}
                    >
                      <input {...item.getRenameInputProps()} />
                    </div>
                  ) : (
                    <button
                      {...item.getProps()}
                      type="button"
                      className={cn(
                        "workspace-tree-item",
                        isActive && "is-active",
                        item.isFocused() && "is-focused",
                        item.isMatchingSearch() && "is-search-match",
                        item.isDragTarget() && "is-drag-target",
                      )}
                      style={{
                        paddingLeft: `${item.getItemMeta().level * 18 + 8}px`,
                      }}
                      onDoubleClick={() => item.startRenaming()}
                    >
                      <span className="workspace-tree-chevron">
                        {isFolder && (
                          <ChevronRight
                            size={14}
                            className={cn(item.isExpanded() && "is-expanded")}
                          />
                        )}
                      </span>
                      <span className="workspace-tree-icon" aria-hidden="true">
                        {isFolder ? (
                          item.isExpanded() ? (
                            <FolderOpen size={16} />
                          ) : (
                            <Folder size={16} />
                          )
                        ) : (
                          <FileText size={16} />
                        )}
                      </span>
                      <span className="workspace-tree-name">{node.name}</span>
                    </button>
                  )}
                </Fragment>
              )
            })}
            <div
              className="workspace-tree-drag-line"
              style={tree.getDragLineStyle()}
            />
          </div>
        </div>

        <footer className="workspace-sidebar-footer">
          <div className="workspace-status-dot" />
          <span>本地工作区</span>
          <span className="ml-auto">自动保存</span>
        </footer>
      </aside>
    </>
  )
}
