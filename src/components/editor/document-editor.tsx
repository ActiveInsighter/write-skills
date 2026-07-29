import CharacterCount from "@tiptap/extension-character-count"
import Highlight from "@tiptap/extension-highlight"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import SubscriptExtension from "@tiptap/extension-subscript"
import SuperscriptExtension from "@tiptap/extension-superscript"
import TaskItem from "@tiptap/extension-task-item"
import TaskList from "@tiptap/extension-task-list"
import TextAlign from "@tiptap/extension-text-align"
import Typography from "@tiptap/extension-typography"
import UnderlineExtension from "@tiptap/extension-underline"
import { EditorContent, type Editor, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  Circle,
  CircleCheck,
  Cloud,
  CloudOff,
  LoaderCircle,
  RefreshCw,
  WifiOff,
} from "lucide-react"
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { EditorToolbar } from "@/components/editor/editor-toolbar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { DocumentRecord, EditorDocumentJson } from "@/lib/contracts"
import "@/styles/editor.css"

export type DocumentEditorPatch = Partial<
  Pick<DocumentRecord, "title" | "contentJson" | "contentHtml" | "contentText">
>

export type DocumentSaveState =
  "idle" | "dirty" | "saving" | "saved" | "error" | "offline"

export type DocumentEditorProps = {
  document: DocumentRecord
  saveState: DocumentSaveState
  onChange: (patch: DocumentEditorPatch) => void
  onSaveNow: () => void | Promise<void>
  onCreateVersion: () => void | Promise<void>
}

type EditorStats = {
  characters: number
  words: number
}

const EMPTY_DOCUMENT = "<p></p>"

const SAVE_STATE_META: Record<
  DocumentSaveState,
  { label: string; icon: ReactNode; tone: string }
> = {
  idle: {
    label: "自动保存已开启",
    icon: <Cloud aria-hidden="true" />,
    tone: "neutral",
  },
  dirty: {
    label: "有未保存的更改",
    icon: <Circle aria-hidden="true" className="fill-current" />,
    tone: "warning",
  },
  saving: {
    label: "正在保存",
    icon: <LoaderCircle aria-hidden="true" className="animate-spin" />,
    tone: "warning",
  },
  saved: {
    label: "所有更改均已保存",
    icon: <CircleCheck aria-hidden="true" />,
    tone: "success",
  },
  error: {
    label: "保存失败，本地更改仍被保留",
    icon: <CloudOff aria-hidden="true" />,
    tone: "danger",
  },
  offline: {
    label: "当前离线，将在恢复连接后保存",
    icon: <WifiOff aria-hidden="true" />,
    tone: "warning",
  },
}

function isCanonicalDocument(value: unknown): value is EditorDocumentJson {
  return Boolean(
    value &&
    typeof value === "object" &&
    "type" in value &&
    value.type === "doc",
  )
}

function usesLegacyHtml(document: DocumentRecord) {
  return document.contentJson.attrs?.legacyHtml === true
}

function contentFromDocument(document: DocumentRecord) {
  if (isCanonicalDocument(document.contentJson) && !usesLegacyHtml(document)) {
    return document.contentJson
  }
  return document.contentHtml?.trim() || EMPTY_DOCUMENT
}

function contentMatchesDocument(
  currentJson: EditorDocumentJson,
  currentHtml: string,
  document: DocumentRecord,
) {
  if (isCanonicalDocument(document.contentJson) && !usesLegacyHtml(document)) {
    return JSON.stringify(currentJson) === JSON.stringify(document.contentJson)
  }
  return currentHtml === (document.contentHtml?.trim() || EMPTY_DOCUMENT)
}

export function DocumentEditor({
  document,
  saveState,
  onChange,
  onSaveNow,
  onCreateVersion,
}: DocumentEditorProps) {
  const [initialContent] = useState(() => contentFromDocument(document))
  const lastSyncedContentKey = useRef<string | null>(null)
  const onChangeRef = useRef(onChange)
  const [stats, setStats] = useState<EditorStats>({
    characters: document.contentText.length,
    words: 0,
  })

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        underline: false,
      }),
      CharacterCount,
      Highlight.configure({ multicolor: false }),
      Link.configure({
        autolink: true,
        defaultProtocol: "https",
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
        },
      }),
      Placeholder.configure({
        placeholder: "开始写作，或使用上方工具栏插入内容…",
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
      }),
      Typography,
      Image.configure({
        allowBase64: false,
        inline: false,
      }),
      UnderlineExtension,
      SuperscriptExtension,
      SubscriptExtension,
    ],
    [],
  )

  const syncStats = useCallback((currentEditor: Editor) => {
    setStats({
      characters: currentEditor.storage.characterCount.characters(),
      words: currentEditor.storage.characterCount.words(),
    })
  }, [])

  const editor = useEditor({
    extensions,
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id: "document-editor-content",
        class: "document-editor__prose",
        role: "textbox",
        "aria-label": "文档正文",
        "aria-multiline": "true",
        spellcheck: "true",
      },
    },
    onCreate: ({ editor: currentEditor }) => {
      setStats({
        characters: currentEditor.storage.characterCount.characters(),
        words: currentEditor.storage.characterCount.words(),
      })
    },
    onUpdate: ({ editor: currentEditor }) => {
      const contentJson = currentEditor.getJSON() as EditorDocumentJson
      onChangeRef.current({
        contentJson,
        contentHtml: currentEditor.getHTML(),
        contentText: currentEditor.getText({ blockSeparator: "\n" }),
      })
      setStats({
        characters: currentEditor.storage.characterCount.characters(),
        words: currentEditor.storage.characterCount.words(),
      })
    },
  })

  useEffect(() => {
    if (!editor) return
    const externalContentKey = `${document.id}:${document.revision}`
    if (lastSyncedContentKey.current === externalContentKey) return
    lastSyncedContentKey.current = externalContentKey

    const currentJson = editor.getJSON() as EditorDocumentJson
    if (contentMatchesDocument(currentJson, editor.getHTML(), document)) {
      return
    }

    editor.commands.setContent(contentFromDocument(document), {
      emitUpdate: false,
      errorOnInvalidContent: false,
    })
    const frame = window.requestAnimationFrame(() => syncStats(editor))
    return () => window.cancelAnimationFrame(frame)
  }, [document, editor, syncStats])

  useEffect(() => {
    function handleSaveShortcut(event: KeyboardEvent) {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "s"
      ) {
        return
      }

      event.preventDefault()
      if (event.shiftKey) {
        void onCreateVersion()
      } else {
        void onSaveNow()
      }
    }

    window.addEventListener("keydown", handleSaveShortcut)
    return () => window.removeEventListener("keydown", handleSaveShortcut)
  }, [onCreateVersion, onSaveNow])

  function handleTitleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return
    event.preventDefault()
    editor?.commands.focus("start")
  }

  const saveMeta = SAVE_STATE_META[saveState]

  return (
    <section
      className="document-editor"
      aria-label={`正在编辑：${document.title || "未命名文档"}`}
    >
      <div className="document-editor__toolbar-shell">
        <EditorToolbar
          editor={editor}
          saving={saveState === "saving"}
          onSaveNow={onSaveNow}
          onCreateVersion={onCreateVersion}
        />
      </div>

      <div className="document-editor__viewport">
        <article className="document-editor__canvas">
          <header className="document-editor__header">
            <label className="sr-only" htmlFor="document-editor-title">
              文档标题
            </label>
            <Input
              id="document-editor-title"
              value={document.title}
              onChange={(event) => onChange({ title: event.target.value })}
              onKeyDown={handleTitleKeyDown}
              placeholder="未命名文档"
              autoComplete="off"
              className="document-editor__title"
            />
            <p className="document-editor__hint">
              输入标题后按 Enter 可直接进入正文
            </p>
          </header>

          <EditorContent editor={editor} />
        </article>
      </div>

      <footer className="document-editor__statusbar">
        <div
          className="document-editor__save-state"
          data-tone={saveMeta.tone}
          aria-live="polite"
          aria-atomic="true"
        >
          {saveMeta.icon}
          <span>{saveMeta.label}</span>
          {saveState === "error" ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => void onSaveNow()}
              className="document-editor__retry"
            >
              <RefreshCw />
              重试
            </Button>
          ) : null}
        </div>
        <div className="document-editor__stats" aria-label="文档统计">
          <span>{stats.characters.toLocaleString()} 字符</span>
          <span aria-hidden="true">·</span>
          <span>{stats.words.toLocaleString()} 词</span>
        </div>
      </footer>
    </section>
  )
}
