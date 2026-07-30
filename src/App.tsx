import { ThemeProvider } from "next-themes"
import { SimpleEditor } from "@/components/editor/simple-editor"
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useWorkspaceStore } from "@/features/workspace/workspace-store"
import { cn } from "@/lib/utils"

function Workspace() {
  const sidebarCollapsed = useWorkspaceStore(
    (state) => state.sidebarCollapsed,
  )

  return (
    <div
      className={cn(
        "write-skills-app",
        sidebarCollapsed && "sidebar-is-collapsed",
      )}
    >
      <WorkspaceSidebar />
      <SimpleEditor />
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="write-skills-theme"
    >
      <TooltipProvider delayDuration={300}>
        <Workspace />
      </TooltipProvider>
    </ThemeProvider>
  )
}
