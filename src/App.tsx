import { ThemeProvider } from "next-themes"
import { SimpleEditor } from "@/components/editor/simple-editor"
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

function Workspace() {
  return (
    <div className="write-skills-app">
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
