import CharacterCount from "@tiptap/extension-character-count"
import Highlight from "@tiptap/extension-highlight"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import Subscript from "@tiptap/extension-subscript"
import Superscript from "@tiptap/extension-superscript"
import TaskItem from "@tiptap/extension-task-item"
import TaskList from "@tiptap/extension-task-list"
import TextAlign from "@tiptap/extension-text-align"
import Typography from "@tiptap/extension-typography"
import UnderlineExtension from "@tiptap/extension-underline"
import {
  EditorContent,
  EditorContext,
  type Editor,
  useEditor,
} from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  Check,
  ChevronDown,
  Code2,
  FilePlus2,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  LoaderCircle,
  Menu,
  Moon,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Subscript as SubscriptIcon,
  Sun,
  Superscript as SuperscriptIcon,
  Underline as UnderlineIcon,
  Undo2,
  X,
} from "lucide-react"
import { useTheme } from "next-themes"
import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react"
import { useWorkspaceStore } from "@/features/workspace/workspace-store"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

const HIGHLIGHT_COLORS = [
  { name: "黄色", value: "#fde68a" },
  { name: "绿色", value: "#bbf7d0" },
  { name: "蓝色", value: "#bfdbfe" },
  { name: "紫色", value: "#ddd6fe" },
  { name: "粉色", value: "#fbcfe8" },
]

type ToolbarButtonProps = {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={cn("tiptap-toolbar-button", active && "is-active")}
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function ToolbarSeparator() {
  return <span className="tiptap-toolbar-separator" aria-hidden="true" />
}

function HeadingMenu({ editor }: { editor: Editor | null }) {
  const currentLabel = editor?.isActive("heading", { level: 1 })
    ? "标题 1"
    : editor?.isActive("heading", { level: 2 })
      ? "标题 2"
      : editor?.isActive("heading", { level: 3 })
        ? "标题 3"
        : editor?.isActive("heading", { level: 4 })
          ? "标题 4"
          : "正文"

  return (
    <details className="tiptap-toolbar-menu">
      <summary className="tiptap-toolbar-select">
        <span>{currentLabel}</span>
        <ChevronDown />
      </summary>
      <div className="tiptap-toolbar-menu-content">
        <button
          type="button"
          onClick={() => editor?.chain().focus().setParagraph().run()}
        >
          正文
        </button>
        {[1, 2, 3, 4].map((level) => (
          <button
            type="button"
            key={level}
            className={cn(
              editor?.isActive("heading", { level }) && "is-active",
            )}
            onClick={() =>
              editor
                ?.chain()
                .focus()
                .toggleHeading({ level: level as 1 | 2 | 3 | 4 })
                .run()
            }
          >
            标题 {level}
          </button>
        ))}
      </div>
    </details>
  )
}

function LinkPanel({
  editor,
  value,
  onChange,
  onApply,
  onClose,
}: {
  editor: Editor | null
  value: string
  onChange: (value: string) => void
  onApply: () => void
  onClose?: () => void
}) {
  return (
    <div className="tiptap-inline-panel link-panel">
      <div className="tiptap-inline-panel-heading">
        <span>链接地址</span>
        {onClose && (
          <button type="button" aria-label="关闭链接面板" onClick={onClose}>
            <X />
          </button>
        )}
      </div>
      <div className="tiptap-link-input-row">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onApply()
          }}
          placeholder="https://example.com"
          aria-label="链接地址"
          autoFocus
        />
        <button type="button" onClick={onApply}>
          应用
        </button>
      </div>
      {editor?.isActive("link") && (
        <button
          type="button"
          className="tiptap-panel-text-button"
          onClick={() => {
            editor.chain().focus().extendMarkRange("link").unsetLink().run()
            onClose?.()
          }}
        >
          移除当前链接
        </button>
      )}
    </div>
  )
}

function HighlightPanel({
  editor,
  onClose,
}: {
  editor: Editor | null
  onClose?: () => void
}) {
  return (
    <div className="tiptap-inline-panel highlight-panel">
      <div className="tiptap-inline-panel-heading">
        <span>高亮颜色</span>
        {onClose && (
          <button type="button" aria-label="关闭高亮面板" onClick={onClose}>
            <X />
          </button>
        )}
      </div>
      <div className="tiptap-highlight-grid">
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            type="button"
            key={color.value}
            aria-label={color.name}
            title={color.name}
            style={{ backgroundColor: color.value }}
            onClick={() => {
              editor
                ?.chain()
                .focus()
                .toggleHighlight({ color: color.value })
                .run()
              onClose?.()
            }}
          />
        ))}
        <button
          type="button"
          className="remove-highlight"
          aria-label="移除高亮"
          title="移除高亮"
          onClick={() => {
            editor?.chain().focus().unsetHighlight().run()
            onClose?.()
          }}
        >
          <X />
        </button>
      </div>
    </div>
  )
}

function MainToolbar({
  editor,
  isMobile,
  onOpenLink,
  onOpenHighlight,
  onImageUpload,
}: {
  editor: Editor | null
  isMobile: boolean
  onOpenLink: () => void
  onOpenHighlight: () => void
  onImageUpload: () => void
}) {
  return (
    <>
      <div className="tiptap-toolbar-group">
        <ToolbarButton
          label="撤销"
          disabled={!editor?.can().chain().focus().undo().run()}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 />
        </ToolbarButton>
        <ToolbarButton
          label="重做"
          disabled={!editor?.can().chain().focus().redo().run()}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 />
        </ToolbarButton>
      </div>

      <ToolbarSeparator />

      <div className="tiptap-toolbar-group">
        <HeadingMenu editor={editor} />
        <ToolbarButton
          label="无序列表"
          active={editor?.isActive("bulletList")}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List />
        </ToolbarButton>
        <ToolbarButton
          label="有序列表"
          active={editor?.isActive("orderedList")}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </ToolbarButton>
        <ToolbarButton
          label="任务列表"
          active={editor?.isActive("taskList")}
          onClick={() => editor?.chain().focus().toggleTaskList().run()}
        >
          <ListChecks />
        </ToolbarButton>
        <ToolbarButton
          label="引用"
          active={editor?.isActive("blockquote")}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quote />
        </ToolbarButton>
        <ToolbarButton
          label="代码块"
          active={editor?.isActive("codeBlock")}
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
        >
          <Code2 />
        </ToolbarButton>
      </div>

      <ToolbarSeparator />

      <div className="tiptap-toolbar-group">
        <ToolbarButton
          label="加粗"
          active={editor?.isActive("bold")}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold />
        </ToolbarButton>
        <ToolbarButton
          label="斜体"
          active={editor?.isActive("italic")}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </ToolbarButton>
        <ToolbarButton
          label="删除线"
          active={editor?.isActive("strike")}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <Strikethrough />
        </ToolbarButton>
        <ToolbarButton
          label="行内代码"
          active={editor?.isActive("code")}
          onClick={() => editor?.chain().focus().toggleCode().run()}
        >
          <Code2 />
        </ToolbarButton>
        <ToolbarButton
          label="下划线"
          active={editor?.isActive("underline")}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon />
        </ToolbarButton>
        <ToolbarButton
          label="高亮"
          active={editor?.isActive("highlight")}
          onClick={onOpenHighlight}
        >
          <Highlighter />
        </ToolbarButton>
        <ToolbarButton
          label="链接"
          active={editor?.isActive("link")}
          onClick={onOpenLink}
        >
          <Link2 />
        </ToolbarButton>
      </div>

      <ToolbarSeparator />

      <div className="tiptap-toolbar-group">
        <ToolbarButton
          label="上标"
          active={editor?.isActive("superscript")}
          onClick={() => editor?.chain().focus().toggleSuperscript().run()}
        >
          <SuperscriptIcon />
        </ToolbarButton>
        <ToolbarButton
          label="下标"
          active={editor?.isActive("subscript")}
          onClick={() => editor?.chain().focus().toggleSubscript().run()}
        >
          <SubscriptIcon />
        </ToolbarButton>
      </div>

      <ToolbarSeparator />

      <div className="tiptap-toolbar-group">
        <ToolbarButton
          label="左对齐"
          active={editor?.isActive({ textAlign: "left" })}
          onClick={() => editor?.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft />
        </ToolbarButton>
        <ToolbarButton
          label="居中"
          active={editor?.isActive({ textAlign: "center" })}
          onClick={() => editor?.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter />
        </ToolbarButton>
        <ToolbarButton
          label="右对齐"
          active={editor?.isActive({ textAlign: "right" })}
          onClick={() => editor?.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight />
        </ToolbarButton>
        <ToolbarButton
          label="两端对齐"
          active={editor?.isActive({ textAlign: "justify" })}
          onClick={() => editor?.chain().focus().setTextAlign("justify").run()}
        >
          <AlignJustify />
        </ToolbarButton>
      </div>

      <ToolbarSeparator />

      <div className="tiptap-toolbar-group">
        <ToolbarButton label="插入图片" onClick={onImageUpload}>
          <ImagePlus />
        </ToolbarButton>
        {!isMobile && (
          <ToolbarButton
            label="清除格式"
            onClick={() =>
              editor?.chain().focus().clearNodes().unsetAllMarks().run()
            }
          >
            <RemoveFormatting />
          </ToolbarButton>
        )}
      </div>
    </>
  )
}

export function SimpleEditor() {
  const nodes = useWorkspaceStore((state) => state.nodes)
  const selectedDocumentId = useWorkspaceStore(
    (state) => state.selectedDocumentId,
  )
  const setSidebarOpen = useWorkspaceStore((state) => state.setSidebarOpen)
  const createDocument = useWorkspaceStore((state) => state.createDocument)
  const renameNode = useWorkspaceStore((state) => state.renameNode)
  const updateDocumentContent = useWorkspaceStore(
    (state) => state.updateDocumentContent,
  )
  const selectedDocument = nodes[selectedDocumentId]
  const isMobile = useIsMobile()
  const { resolvedTheme, setTheme } = useTheme()

  const [mobileView, setMobileView] = useState<"main" | "highlight" | "link">(
    "main",
  )
  const [desktopPanel, setDesktopPanel] = useState<"highlight" | "link" | null>(
    null,
  )
  const [linkValue, setLinkValue] = useState("https://")
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved")
  const [stats, setStats] = useState({ characters: 0, words: 0 })

  const loadedDocumentRef = useRef<string | null>(null)
  const activeDocumentIdRef = useRef(selectedDocumentId)
  const saveTimerRef = useRef<number | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    activeDocumentIdRef.current = selectedDocumentId
  }, [selectedDocumentId])

  const editor = useEditor({
    immediatelyRender: false,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": "技能内容编辑区",
        class: "simple-editor",
      },
    },
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        link: false,
        underline: false,
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      Link.configure({
        autolink: true,
        defaultProtocol: "https",
        openOnClick: false,
        enableClickSelection: true,
      }),
      Image.configure({ allowBase64: true }),
      UnderlineExtension,
      Typography,
      Subscript,
      Superscript,
      Placeholder.configure({
        placeholder: "输入 / 开始写作，或从工具栏选择格式…",
      }),
      CharacterCount,
    ],
    content: selectedDocument?.content ?? "",
    onCreate: ({ editor: currentEditor }) => {
      setStats({
        characters: currentEditor.storage.characterCount.characters(),
        words: currentEditor.storage.characterCount.words(),
      })
    },
    onUpdate: ({ editor: currentEditor }) => {
      updateDocumentContent(
        activeDocumentIdRef.current,
        currentEditor.getHTML(),
      )
      setStats({
        characters: currentEditor.storage.characterCount.characters(),
        words: currentEditor.storage.characterCount.words(),
      })
      setSaveState("saving")
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = window.setTimeout(() => {
        setSaveState("saved")
      }, 450)
    },
  })

  useEffect(() => {
    if (!editor || !selectedDocument || selectedDocument.kind !== "document") {
      return
    }
    if (loadedDocumentRef.current === selectedDocumentId) return

    loadedDocumentRef.current = selectedDocumentId
    editor.commands.setContent(selectedDocument.content ?? "", {
      emitUpdate: false,
    })
    setStats({
      characters: editor.storage.characterCount.characters(),
      words: editor.storage.characterCount.words(),
    })
    setDesktopPanel(null)
    setMobileView("main")
    setSaveState("saved")
  }, [editor, selectedDocument, selectedDocumentId])

  useEffect(
    () => () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    },
    [],
  )

  const toolbarView = isMobile ? mobileView : "main"

  const openLinkPanel = () => {
    const href = editor?.getAttributes("link").href as string | undefined
    setLinkValue(href || "https://")
    if (isMobile) setMobileView("link")
    else setDesktopPanel((panel) => (panel === "link" ? null : "link"))
  }

  const applyLink = () => {
    if (!editor) return
    const href = linkValue.trim()
    if (!href || href === "https://") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run()
    }
    setDesktopPanel(null)
    setMobileView("main")
  }

  const openHighlightPanel = () => {
    if (isMobile) setMobileView("highlight")
    else
      setDesktopPanel((panel) => (panel === "highlight" ? null : "highlight"))
  }

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || !editor) return
    if (file.size > 1.5 * 1024 * 1024) {
      window.alert("本地图片不能超过 1.5 MB")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== "string") return
      editor
        .chain()
        .focus()
        .setImage({ src: reader.result, alt: file.name })
        .run()
    }
    reader.readAsDataURL(file)
  }

  if (!selectedDocument || selectedDocument.kind !== "document") {
    return (
      <main className="editor-workspace empty-editor-workspace">
        <div className="editor-empty-state">
          <div className="editor-empty-icon">
            <FilePlus2 />
          </div>
          <h1>创建第一项技能</h1>
          <p>从一个空白文档开始，整理目标、步骤、约束和输出格式。</p>
          <button type="button" onClick={() => createDocument("root")}>
            <FilePlus2 />
            新建技能
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="editor-workspace">
      <header className="editor-document-header">
        <button
          type="button"
          className="icon-button editor-menu-button"
          aria-label="打开侧边栏"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu />
        </button>

        <div className="editor-document-identity">
          <p>技能库 / {selectedDocument.name}</p>
          <input
            value={selectedDocument.name}
            aria-label="文档标题"
            onChange={(event) =>
              renameNode(selectedDocumentId, event.target.value)
            }
          />
        </div>

        <div className="editor-document-actions">
          <span className={cn("editor-save-state", saveState)}>
            {saveState === "saving" ? (
              <LoaderCircle className="spin" />
            ) : (
              <Check />
            )}
            {saveState === "saving" ? "保存中" : "已保存"}
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label="切换明暗主题"
            title="切换明暗主题"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            {resolvedTheme === "dark" ? <Sun /> : <Moon />}
          </button>
        </div>
      </header>

      <div className="simple-editor-wrapper">
        <EditorContext.Provider value={{ editor }}>
          <div className="tiptap-toolbar-shell">
            <div
              className="tiptap-toolbar"
              role="toolbar"
              aria-label="文本格式工具栏"
            >
              {toolbarView === "main" ? (
                <MainToolbar
                  editor={editor}
                  isMobile={isMobile}
                  onOpenLink={openLinkPanel}
                  onOpenHighlight={openHighlightPanel}
                  onImageUpload={() => imageInputRef.current?.click()}
                />
              ) : (
                <>
                  <div className="tiptap-toolbar-group mobile-panel-heading">
                    <ToolbarButton
                      label="返回主工具栏"
                      onClick={() => setMobileView("main")}
                    >
                      <ArrowLeft />
                    </ToolbarButton>
                    <span>
                      {toolbarView === "highlight" ? "高亮颜色" : "编辑链接"}
                    </span>
                  </div>
                  <ToolbarSeparator />
                  {toolbarView === "highlight" ? (
                    <HighlightPanel
                      editor={editor}
                      onClose={() => setMobileView("main")}
                    />
                  ) : (
                    <LinkPanel
                      editor={editor}
                      value={linkValue}
                      onChange={setLinkValue}
                      onApply={applyLink}
                    />
                  )}
                </>
              )}
            </div>

            {desktopPanel && !isMobile && (
              <div className="tiptap-floating-panel">
                {desktopPanel === "highlight" ? (
                  <HighlightPanel
                    editor={editor}
                    onClose={() => setDesktopPanel(null)}
                  />
                ) : (
                  <LinkPanel
                    editor={editor}
                    value={linkValue}
                    onChange={setLinkValue}
                    onApply={applyLink}
                    onClose={() => setDesktopPanel(null)}
                  />
                )}
              </div>
            )}
          </div>

          <input
            ref={imageInputRef}
            className="sr-only"
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
          />

          <div className="simple-editor-scroll">
            <EditorContent
              editor={editor}
              role="presentation"
              className="simple-editor-content"
            />
          </div>
        </EditorContext.Provider>

        <footer className="editor-statusbar">
          <span>{stats.words} 个词</span>
          <span>{stats.characters} 个字符</span>
          <span className="editor-status-spacer" />
          <span>HTML 富文本</span>
        </footer>
      </div>
    </main>
  )
}
