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
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  CheckSquare2,
  ChevronDown,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
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
} from "lucide-react"
import { useTheme } from "next-themes"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useWorkspaceStore } from "@/features/workspace/workspace-store"
import { cn } from "@/lib/utils"

type ToolbarActionProps = {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}

function ToolbarAction({
  label,
  active,
  disabled,
  onClick,
  children,
}: ToolbarActionProps) {
  return (
    <button
      type="button"
      className={cn("editor-toolbar-button", active && "is-active")}
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

function ToolbarDivider() {
  return <span className="editor-toolbar-divider" aria-hidden="true" />
}

export function SimpleEditor() {
  const nodes = useWorkspaceStore((state) => state.nodes)
  const selectedDocumentId = useWorkspaceStore(
    (state) => state.selectedDocumentId,
  )
  const setSidebarOpen = useWorkspaceStore((state) => state.setSidebarOpen)
  const renameNode = useWorkspaceStore((state) => state.renameNode)
  const updateDocumentContent = useWorkspaceStore(
    (state) => state.updateDocumentContent,
  )
  const { resolvedTheme, setTheme } = useTheme()
  const [stats, setStats] = useState({ characters: 0, words: 0 })
  const loadedDocumentRef = useRef<string | null>(null)
  const activeDocumentIdRef = useRef(selectedDocumentId)
  activeDocumentIdRef.current = selectedDocumentId
  const selectedDocument = nodes[selectedDocumentId]

  const editor = useEditor({
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "simple-editor-prosemirror",
        "aria-label": "技能内容编辑区",
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
      },
    },
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
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
    },
  })

  useEffect(() => {
    if (!editor || !selectedDocument) return
    if (loadedDocumentRef.current === selectedDocumentId) return

    loadedDocumentRef.current = selectedDocumentId
    editor.commands.setContent(selectedDocument.content ?? "", {
      emitUpdate: false,
    })
    setStats({
      characters: editor.storage.characterCount.characters(),
      words: editor.storage.characterCount.words(),
    })
  }, [editor, selectedDocument, selectedDocumentId])

  if (!selectedDocument || selectedDocument.kind !== "document") return null

  const applyLink = () => {
    if (!editor) return
    const previousUrl = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("输入链接地址", previousUrl ?? "https://")
    if (url === null) return
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url.trim() })
      .run()
  }

  const insertImage = () => {
    if (!editor) return
    const url = window.prompt("输入图片地址")
    if (!url?.trim()) return
    editor.chain().focus().setImage({ src: url.trim() }).run()
  }

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  return (
    <main className="editor-workspace">
      <header className="editor-document-header">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="打开侧边栏"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu />
        </Button>
        <div className="editor-document-identity">
          <p>写作技能 / {selectedDocument.name}</p>
          <input
            value={selectedDocument.name}
            aria-label="文档标题"
            onChange={(event) => renameNode(selectedDocumentId, event.target.value)}
          />
        </div>
        <div className="editor-document-actions">
          <span className="editor-save-state">
            <span />已保存
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="切换明暗主题"
            onClick={toggleTheme}
          >
            {resolvedTheme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </div>
      </header>

      <div className="simple-editor-shell">
        <div className="editor-toolbar" role="toolbar" aria-label="文本格式工具栏">
          <div className="editor-toolbar-scroll">
            <ToolbarAction
              label="撤销"
              disabled={!editor?.can().chain().focus().undo().run()}
              onClick={() => editor?.chain().focus().undo().run()}
            >
              <Undo2 />
            </ToolbarAction>
            <ToolbarAction
              label="重做"
              disabled={!editor?.can().chain().focus().redo().run()}
              onClick={() => editor?.chain().focus().redo().run()}
            >
              <Redo2 />
            </ToolbarAction>

            <ToolbarDivider />

            <details className="editor-toolbar-menu">
              <summary className="editor-toolbar-select">
                <span>
                  {editor?.isActive("heading", { level: 1 })
                    ? "标题 1"
                    : editor?.isActive("heading", { level: 2 })
                      ? "标题 2"
                      : editor?.isActive("heading", { level: 3 })
                        ? "标题 3"
                        : "正文"}
                </span>
                <ChevronDown />
              </summary>
              <div className="editor-toolbar-menu-content">
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().setParagraph().run()}
                >
                  正文
                </button>
                <button
                  type="button"
                  onClick={() =>
                    editor?.chain().focus().toggleHeading({ level: 1 }).run()
                  }
                >
                  <Heading1 />标题 1
                </button>
                <button
                  type="button"
                  onClick={() =>
                    editor?.chain().focus().toggleHeading({ level: 2 }).run()
                  }
                >
                  <Heading2 />标题 2
                </button>
                <button
                  type="button"
                  onClick={() =>
                    editor?.chain().focus().toggleHeading({ level: 3 }).run()
                  }
                >
                  <Heading3 />标题 3
                </button>
              </div>
            </details>

            <ToolbarAction
              label="无序列表"
              active={editor?.isActive("bulletList")}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <List />
            </ToolbarAction>
            <ToolbarAction
              label="有序列表"
              active={editor?.isActive("orderedList")}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered />
            </ToolbarAction>
            <ToolbarAction
              label="任务列表"
              active={editor?.isActive("taskList")}
              onClick={() => editor?.chain().focus().toggleTaskList().run()}
            >
              <CheckSquare2 />
            </ToolbarAction>
            <ToolbarAction
              label="引用"
              active={editor?.isActive("blockquote")}
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            >
              <Quote />
            </ToolbarAction>
            <ToolbarAction
              label="代码块"
              active={editor?.isActive("codeBlock")}
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            >
              <Code2 />
            </ToolbarAction>

            <ToolbarDivider />

            <ToolbarAction
              label="加粗"
              active={editor?.isActive("bold")}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <Bold />
            </ToolbarAction>
            <ToolbarAction
              label="斜体"
              active={editor?.isActive("italic")}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <Italic />
            </ToolbarAction>
            <ToolbarAction
              label="下划线"
              active={editor?.isActive("underline")}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
            >
              <UnderlineIcon />
            </ToolbarAction>
            <ToolbarAction
              label="删除线"
              active={editor?.isActive("strike")}
              onClick={() => editor?.chain().focus().toggleStrike().run()}
            >
              <Strikethrough />
            </ToolbarAction>
            <ToolbarAction
              label="高亮"
              active={editor?.isActive("highlight")}
              onClick={() =>
                editor
                  ?.chain()
                  .focus()
                  .toggleHighlight({ color: "#fde68a" })
                  .run()
              }
            >
              <Highlighter />
            </ToolbarAction>
            <ToolbarAction
              label="链接"
              active={editor?.isActive("link")}
              onClick={applyLink}
            >
              <Link2 />
            </ToolbarAction>

            <ToolbarDivider />

            <ToolbarAction
              label="上标"
              active={editor?.isActive("superscript")}
              onClick={() => editor?.chain().focus().toggleSuperscript().run()}
            >
              <SuperscriptIcon />
            </ToolbarAction>
            <ToolbarAction
              label="下标"
              active={editor?.isActive("subscript")}
              onClick={() => editor?.chain().focus().toggleSubscript().run()}
            >
              <SubscriptIcon />
            </ToolbarAction>

            <ToolbarDivider />

            <ToolbarAction
              label="左对齐"
              active={editor?.isActive({ textAlign: "left" })}
              onClick={() => editor?.chain().focus().setTextAlign("left").run()}
            >
              <AlignLeft />
            </ToolbarAction>
            <ToolbarAction
              label="居中"
              active={editor?.isActive({ textAlign: "center" })}
              onClick={() => editor?.chain().focus().setTextAlign("center").run()}
            >
              <AlignCenter />
            </ToolbarAction>
            <ToolbarAction
              label="右对齐"
              active={editor?.isActive({ textAlign: "right" })}
              onClick={() => editor?.chain().focus().setTextAlign("right").run()}
            >
              <AlignRight />
            </ToolbarAction>
            <ToolbarAction
              label="两端对齐"
              active={editor?.isActive({ textAlign: "justify" })}
              onClick={() => editor?.chain().focus().setTextAlign("justify").run()}
            >
              <AlignJustify />
            </ToolbarAction>

            <ToolbarDivider />

            <ToolbarAction label="插入图片" onClick={insertImage}>
              <ImagePlus />
            </ToolbarAction>
            <ToolbarAction
              label="清除格式"
              onClick={() =>
                editor?.chain().focus().clearNodes().unsetAllMarks().run()
              }
            >
              <RemoveFormatting />
            </ToolbarAction>
          </div>
        </div>

        <div className="simple-editor-scroll">
          <EditorContent editor={editor} className="simple-editor-content" />
        </div>

        <footer className="editor-statusbar">
          <span>{stats.words} 个词</span>
          <span>{stats.characters} 个字符</span>
          <span className="ml-auto">HTML 富文本</span>
        </footer>
      </div>
    </main>
  )
}
