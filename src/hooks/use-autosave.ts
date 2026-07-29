import { useEffect } from "react"
import { useEditorStore } from "@/stores/editor-store"

export function useAutosave(delay = 750) {
  const activeId = useEditorStore((state) => state.activeId)
  const localVersion = useEditorStore((state) =>
    activeId ? state.sessions[activeId]?.localVersion : undefined,
  )
  const dirty = useEditorStore((state) =>
    activeId ? state.sessions[activeId]?.dirty : false,
  )
  const saveDocument = useEditorStore((state) => state.saveDocument)

  useEffect(() => {
    if (!activeId || !dirty) return
    const timer = window.setTimeout(() => {
      void saveDocument(activeId)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [activeId, delay, dirty, localVersion, saveDocument])

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden" && activeId) {
        void saveDocument(activeId)
      }
    }
    document.addEventListener("visibilitychange", flush)
    return () => document.removeEventListener("visibilitychange", flush)
  }, [activeId, saveDocument])
}
