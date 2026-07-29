import { lazy, Suspense, useEffect, useRef } from "react"
import { FilePenLine, LoaderCircle, RefreshCw } from "lucide-react"
import { ThemeProvider } from "next-themes"
import { toast } from "sonner"
import { CommandPalette } from "@/components/shell/command-palette"
import { AppSidebar } from "@/components/shell/app-sidebar"
import { DocumentTabs } from "@/components/shell/document-tabs"
import { WorkbenchHeader } from "@/components/shell/workbench-header"
import { LoginPage } from "@/components/pages/login-page"
import { Button } from "@/components/ui/button"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useEditorStore } from "@/stores/editor-store"

const EditorPage = lazy(() => import("@/components/pages/editor-page"))

function BootScreen({
  error,
  onRetry,
}: {
  error: string | null
  onRetry: () => void
}) {
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="mb-5 grid size-12 place-items-center rounded-xl border bg-card text-primary shadow-sm">
          <FilePenLine className="size-5" />
        </div>
        <p className="text-sm font-semibold">Write Skills</p>
        {error ? (
          <>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {error}
            </p>
            <Button className="mt-5" variant="outline" onClick={onRetry}>
              <RefreshCw />
              重新连接
            </Button>
          </>
        ) : (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" />
            正在准备工作区…
          </div>
        )}
      </div>
    </main>
  )
}

function Workspace() {
  const initialized = useRef(false)
  const auth = useEditorStore((state) => state.auth)
  const booting = useEditorStore((state) => state.booting)
  const bootError = useEditorStore((state) => state.bootError)
  const sidebarOpen = useEditorStore((state) => state.sidebarOpen)
  const initialize = useEditorStore((state) => state.initialize)
  const createDocument = useEditorStore((state) => state.createDocument)
  const saveAll = useEditorStore((state) => state.saveAll)
  const expireSession = useEditorStore((state) => state.expireSession)
  const setCommandOpen = useEditorStore((state) => state.setCommandOpen)
  const setSidebarOpen = useEditorStore((state) => state.setSidebarOpen)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    void initialize()
  }, [initialize])

  useEffect(() => {
    function handleUnauthorized() {
      expireSession()
    }

    window.addEventListener("write-skills:unauthorized", handleUnauthorized)
    return () =>
      window.removeEventListener(
        "write-skills:unauthorized",
        handleUnauthorized,
      )
  }, [expireSession])

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return
      const key = event.key.toLowerCase()

      if (key === "k" || (event.shiftKey && key === "p")) {
        event.preventDefault()
        setCommandOpen(true)
      }

      if (key === "n" && auth?.authenticated) {
        event.preventDefault()
        void createDocument().catch((reason: unknown) =>
          toast.error(
            reason instanceof Error ? reason.message : "无法创建文档",
          ),
        )
      }
    }

    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [auth?.authenticated, createDocument, setCommandOpen])

  useEffect(() => {
    function retryPendingSaves() {
      void saveAll()
    }

    window.addEventListener("online", retryPendingSaves)
    return () => window.removeEventListener("online", retryPendingSaves)
  }, [saveAll])

  useEffect(() => {
    function warnAboutUnsavedChanges(event: BeforeUnloadEvent) {
      const hasDirtyDocument = Object.values(
        useEditorStore.getState().sessions,
      ).some((session) => session.dirty)
      if (!hasDirtyDocument) return
      event.preventDefault()
    }

    window.addEventListener("beforeunload", warnAboutUnsavedChanges)
    return () =>
      window.removeEventListener("beforeunload", warnAboutUnsavedChanges)
  }, [])

  if (booting || (!auth && !bootError)) {
    return <BootScreen error={null} onRetry={() => void initialize()} />
  }

  if (bootError) {
    return (
      <BootScreen
        error={bootError}
        onRetry={() => {
          initialized.current = true
          void initialize()
        }}
      />
    )
  }

  if (!auth?.authenticated) {
    return <LoginPage />
  }

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      className="h-svh min-h-0 overflow-hidden"
    >
      <AppSidebar />
      <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
        <WorkbenchHeader />
        <DocumentTabs />
        <Suspense
          fallback={
            <div className="grid min-h-0 flex-1 place-items-center bg-muted/20 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <LoaderCircle className="size-4 animate-spin" />
                正在加载编辑器…
              </span>
            </div>
          }
        >
          <EditorPage />
        </Suspense>
      </SidebarInset>
      <CommandPalette />
    </SidebarProvider>
  )
}

export default function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider delayDuration={350}>
        <Workspace />
        <Toaster position="bottom-right" richColors closeButton />
      </TooltipProvider>
    </ThemeProvider>
  )
}
