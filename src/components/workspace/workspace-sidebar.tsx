import { Fragment, useEffect, useMemo, useState } from "react"
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
  PanelLeftOpen,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  type WorkspaceNode,
  useWorkspaceStore,
} from "@/features/workspace/workspace-store"

const DEFAULT_EXPANDED_ITEMS = ["getting-started", "writing"]

function findParentId(nodes: Record<string, WorkspaceNode>, childId: string) {
  return (
    Object.values(nodes).find((node) => node.children?.includes(childId))?.id ??
    "root"
  )
}

export function WorkspaceSidebar() {
  const nodes = useWorkspaceStore((state) => state.nodes)
  const selectedDocumentId = useWorkspaceStore(
    (state) => state.selectedDocumentId,
  )
  const sidebarOpen = useWorkspaceStore((state) => state.sidebarOpen)
  const sidebarCollapsed = useWorkspaceStore((state) => state.sidebarCollapsed)
  const selectDocument = useWorkspaceStore((state) => state.selectDocument)
  const setSidebarOpen = useWorkspaceStore((state) => state.setSidebarOpen)
  const setSidebarCollapsed = useWorkspaceStore(
    (state) => state.setSidebarCollapsed,
  )
  const createDocument = useWorkspaceStore((state) => state.createDocument)
  const createFolder = useWorkspaceStore((state) => state.createFolder)
  const deleteNode = useWorkspaceStore((state) => state.deleteNode)
  const renameNode = useWorkspaceStore((state) => state.renameNode)
  const replaceChildren = useWorkspaceStore((state) => state.replaceChildren)

  const [expandedItems, setExpandedItems] = useState<string[]>(
    DEFAULT_EXPANDED_ITEMS,
  )
  const [selectedItems, setSelectedItems] = useState<string[]>([
    selectedDocumentId,
  ])
  const activeItemId = selectedItems.at(-1) ?? selectedDocumentId

  const dataLoader = useMemo(
    () => ({
      getItem: (itemId: string) => nodes[itemId],
      getChildren: (itemId: string) => nodes[itemId]?.children ?? [],
    }),
    [nodes],
  )

  const tree = useTree<WorkspaceNode>({
    rootItemId: "root",
    state: { expandedItems, selectedItems },
    setExpandedItems,
    setSelectedItems,
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => item.getItemData().kind === "folder",
    dataLoader,
    indent: 18,
    canReorder: true,
    canRename: (item) => item.getId() !== "root",
    onDrop: createOnDropHandler((item, newChildren) => {
      replaceChildren(item.getId(), newChildren)
    }),
    onRename: (item, value) => renameNode(item.getId(), value),
    onPrimaryAction: (item) => {
      setSelectedItems([item.getId()])
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
    tree.scheduleRebuildTree()
  }, [nodes, tree])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "k"
      ) {
        return
      }

      const target = event.target as HTMLElement | null
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], [role="textbox"]',
        )
      ) {
        return
      }

      event.preventDefault()
      setSidebarCollapsed(false)
      tree.openSearch()
    }

    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [setSidebarCollapsed, tree])

  const getTargetFolder = () => {
    const activeNode = nodes[activeItemId]
    if (activeNode?.kind === "folder") return activeNode.id
    if (activeNode?.kind === "document") {
      return findParentId(nodes, activeNode.id)
    }
    return "root"
  }

  const handleCreateDocument = () => {
    const parentId = getTargetFolder()
    setExpandedItems((items) =>
      items.includes(parentId) ? items : [...items, parentId],
    )
    const id = createDocument(parentId)
    setSelectedItems([id])
  }

  const handleCreateFolder = () => {
    const parentId = getTargetFolder()
    setExpandedItems((items) =>
      items.includes(parentId) ? items : [...items, parentId],
    )
    const id = createFolder(parentId)
    setSelectedItems([id])
  }

  const handleDelete = (itemId: string, itemName: string) => {
    const confirmed = window.confirm(`确定删除“${itemName}”吗？`)
    if (!confirmed) return
    deleteNode(itemId)
    setExpandedItems((items) => items.filter((id) => id !== itemId))
    const nextSelectedId = useWorkspaceStore.getState().selectedDocumentId
    setSelectedItems(nextSelectedId ? [nextSelectedId] : [])
  }

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
        className={cn(
          "workspace-sidebar",
          sidebarOpen && "is-mobile-open",
          sidebarCollapsed && "is-collapsed",
        )}
      >
        <header className="workspace-sidebar-header">
          <div className="workspace-brand-mark" aria-hidden="true">
            <Sparkles size={17} />
          </div>
          <div className="workspace-brand-copy">
            <p className="workspace-brand-title">Write Skills</p>
            <p className="workspace-brand-subtitle">技能写作工作台</p>
          </div>
          <button
            type="button"
            className="icon-button workspace-collapse-button"
            aria-label={sidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </button>
          <button
            type="button"
            className="icon-button workspace-mobile-close"
            aria-label="关闭侧边栏"
            onClick={() => setSidebarOpen(false)}
          >
            <X />
          </button>
        </header>

        <div className="workspace-sidebar-collapsed-actions">
          <button
            type="button"
            className="icon-button"
            aria-label="新建技能"
            title="新建技能"
            onClick={handleCreateDocument}
          >
            <FilePlus2 />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="展开侧边栏"
            title="展开侧边栏"
            onClick={() => setSidebarCollapsed(false)}
          >
            <Search />
          </button>
        </div>

        <div className="workspace-sidebar-body">
          <div className="workspace-create-row">
            <button
              type="button"
              className="workspace-primary-button"
              onClick={handleCreateDocument}
            >
              <FilePlus2 />
              <span>新建技能</span>
            </button>
            <button
              type="button"
              className="icon-button bordered"
              aria-label="新建文件夹"
              title="新建文件夹"
              onClick={handleCreateFolder}
            >
              <FolderPlus />
            </button>
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
                <span>搜索目录</span>
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
                const isActive =
                  item.getId() === selectedDocumentId ||
                  item.getId() === activeItemId
                const isFolder = item.isFolder()

                return (
                  <Fragment key={item.getId()}>
                    {item.isRenaming() ? (
                      <div
                        className="workspace-tree-rename"
                        style={{
                          paddingLeft: `${item.getItemMeta().level * 18 + 31}px`,
                        }}
                      >
                        <input {...item.getRenameInputProps()} />
                      </div>
                    ) : (
                      <div
                        {...item.getProps()}
                        className={cn(
                          "workspace-tree-item",
                          isActive && "is-active",
                          activeItemId === item.getId() && "is-current",
                          item.isFocused() && "is-focused",
                          item.isMatchingSearch() && "is-search-match",
                          item.isDragTarget() && "is-drag-target",
                        )}
                        style={{
                          paddingLeft: `${item.getItemMeta().level * 18 + 7}px`,
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
                        <span
                          className="workspace-tree-icon"
                          aria-hidden="true"
                        >
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
                        <span className="workspace-tree-actions">
                          <button
                            type="button"
                            aria-label={`重命名 ${node.name}`}
                            title="重命名"
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedItems([item.getId()])
                              item.startRenaming()
                            }}
                          >
                            <Pencil />
                          </button>
                          <button
                            type="button"
                            aria-label={`删除 ${node.name}`}
                            title="删除"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleDelete(item.getId(), node.name)
                            }}
                          >
                            <Trash2 />
                          </button>
                        </span>
                      </div>
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
            <span className="workspace-status-dot" />
            <span>本地工作区</span>
            <span className="workspace-footer-hint">自动保存</span>
          </footer>
        </div>
      </aside>
    </>
  )
}
