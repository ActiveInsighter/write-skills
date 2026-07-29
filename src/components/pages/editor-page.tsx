import { useEffect, useState } from "react"
import {
  AlertTriangle,
  FilePlus2,
  LoaderCircle,
  RefreshCw,
  Split,
} from "lucide-react"
import { toast } from "sonner"
import {
  DocumentEditor,
  type DocumentSaveState,
} from "@/components/editor/document-editor"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { useAutosave } from "@/hooks/use-autosave"
import { useEditorStore } from "@/stores/editor-store"

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return online
}

export function EditorPage() {
  useAutosave()
  const online = useOnline()

  const activeId = useEditorStore((state) => state.activeId)
  const session = useEditorStore((state) =>
    state.activeId ? state.sessions[state.activeId] : undefined,
  )
  const loadingDocumentId = useEditorStore((state) => state.loadingDocumentId)
  const documents = useEditorStore((state) => state.documents)
  const createDocument = useEditorStore((state) => state.createDocument)
  const createVersion = useEditorStore((state) => state.createVersion)
  const reloadDocument = useEditorStore((state) => state.reloadDocument)
  const saveDocument = useEditorStore((state) => state.saveDocument)
  const updateDraft = useEditorStore((state) => state.updateDraft)

  useEffect(() => {
    if (online && activeId && session?.dirty && session.saveState === "error") {
      void saveDocument(activeId)
    }
  }, [activeId, online, saveDocument, session?.dirty, session?.saveState])

  if (activeId && (!session || loadingDocumentId === activeId)) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center bg-muted/20">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          正在打开文档…
        </div>
      </div>
    )
  }

  if (!activeId || !session) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center bg-muted/20 p-6">
        <Empty className="max-w-lg border bg-card/70 shadow-sm">
          <EmptyHeader>
            <div className="mb-2 grid size-12 place-items-center rounded-xl border bg-muted text-muted-foreground">
              <FilePlus2 className="size-5" />
            </div>
            <EmptyTitle>
              {documents.length ? "选择一篇文档开始编辑" : "创建第一篇文档"}
            </EmptyTitle>
            <EmptyDescription>
              文档内容会自动保存到 Cloudflare D1；按 Ctrl+Shift+S
              可以随时创建版本快照。
            </EmptyDescription>
          </EmptyHeader>
          <Button
            onClick={() =>
              void createDocument().catch((reason: unknown) =>
                toast.error(
                  reason instanceof Error ? reason.message : "创建失败",
                ),
              )
            }
          >
            <FilePlus2 />
            新建文档
          </Button>
        </Empty>
      </div>
    )
  }

  const activeSession = session
  const editorSaveState: DocumentSaveState =
    !online && activeSession.dirty
      ? "offline"
      : activeSession.saveState === "conflict"
        ? "error"
        : activeSession.saveState

  async function preserveConflictAsCopy() {
    const document = activeSession.document
    try {
      await createDocument({
        folderId: document.folderId,
        title: `${document.title || "未命名文档"}（冲突副本）`,
        contentJson: document.contentJson,
        contentHtml: document.contentHtml,
        contentText: document.contentText,
        isFavorite: document.isFavorite,
      })
      toast.success("本地内容已保留为新文档。")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "创建副本失败")
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {activeSession.saveState === "conflict" && (
        <Alert
          variant="destructive"
          className="m-2 mb-0 shrink-0 rounded-md"
          role="alert"
        >
          <AlertTriangle />
          <AlertTitle>检测到远端修订冲突</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>
              另一标签页或设备已更新此文档。请选择保留本地副本，或重新载入远端内容。
            </span>
            <span className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void preserveConflictAsCopy()}
              >
                <Split />
                保留为副本
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() =>
                  void reloadDocument(activeSession.document.id)
                    .then(() => toast.success("已载入远端最新版本。"))
                    .catch((reason: unknown) =>
                      toast.error(
                        reason instanceof Error ? reason.message : "载入失败",
                      ),
                    )
                }
              >
                <RefreshCw />
                载入远端
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      )}

      <DocumentEditor
        key={activeSession.document.id}
        document={activeSession.document}
        saveState={editorSaveState}
        onChange={(patch) => updateDraft(activeSession.document.id, patch)}
        onSaveNow={() => saveDocument(activeSession.document.id)}
        onCreateVersion={async () => {
          try {
            await createVersion(activeSession.document.id)
            toast.success("已创建版本快照。")
          } catch (reason) {
            toast.error(
              reason instanceof Error ? reason.message : "创建版本失败",
            )
          }
        }}
      />
    </div>
  )
}

export default EditorPage
