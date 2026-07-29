import type { Editor } from "@tiptap/react"
import { useEditorState } from "@tiptap/react"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ChevronDown,
  Code2,
  CodeXml,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  History,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Save,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react"
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useId,
  useState,
} from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const EMPTY_EDITOR_STATE = {
  canUndo: false,
  canRedo: false,
  block: "paragraph" as "paragraph" | "h1" | "h2" | "h3",
  bulletList: false,
  orderedList: false,
  taskList: false,
  blockquote: false,
  bold: false,
  italic: false,
  strike: false,
  code: false,
  underline: false,
  highlight: false,
  link: false,
  superscript: false,
  subscript: false,
  align: "left" as "left" | "center" | "right" | "justify",
}

type ToolButtonProps = {
  label: string
  children: ReactNode
  onClick: () => void
  active?: boolean
  disabled?: boolean
  shortcut?: string
  ariaKeyShortcuts?: string
  className?: string
}

function ToolButton({
  label,
  children,
  onClick,
  active,
  disabled,
  shortcut,
  ariaKeyShortcuts,
  className,
}: ToolButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          data-editor-control
          data-active={active || undefined}
          aria-label={label}
          aria-pressed={typeof active === "boolean" ? active : undefined}
          aria-keyshortcuts={ariaKeyShortcuts}
          disabled={disabled}
          onClick={onClick}
          className={cn("editor-toolbar__button", className)}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        <span>{label}</span>
        {shortcut ? (
          <kbd className="editor-toolbar__shortcut">{shortcut}</kbd>
        ) : null}
      </TooltipContent>
    </Tooltip>
  )
}

function normalizeLink(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return trimmed

  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    const url = new URL(candidate)
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol)
      ? candidate
      : null
  } catch {
    return null
  }
}

function normalizeImageUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("/")) return trimmed

  try {
    const url = new URL(trimmed)
    return url.protocol === "https:" ? trimmed : null
  } catch {
    return null
  }
}

function LinkDialog({
  editor,
  initialValue,
  open,
  onOpenChange,
}: {
  editor: Editor | null
  initialValue: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const fieldId = useId()
  const errorId = `${fieldId}-error`
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState("")

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editor) return

    const href = normalizeLink(value)
    if (!href) {
      setError("请输入有效的网页、邮箱、电话或站内链接。")
      return
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href }).run()
    onOpenChange(false)
  }

  function removeLink() {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form className="grid gap-5" onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>添加链接</DialogTitle>
            <DialogDescription>
              支持 HTTPS、邮箱、电话、锚点和站内相对路径。
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor={fieldId}>链接地址</FieldLabel>
            <Input
              id={fieldId}
              autoFocus
              inputMode="url"
              value={value}
              onChange={(event) => {
                setValue(event.target.value)
                if (error) setError("")
              }}
              placeholder="https://example.com"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
            />
            {error ? <FieldError id={errorId}>{error}</FieldError> : null}
          </Field>
          <DialogFooter className="sm:justify-between">
            <div>
              {editor?.isActive("link") ? (
                <Button type="button" variant="ghost" onClick={removeLink}>
                  <Unlink />
                  移除链接
                </Button>
              ) : null}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  取消
                </Button>
              </DialogClose>
              <Button type="submit">
                <Link2 />
                应用链接
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ImageDialog({
  editor,
  open,
  onOpenChange,
}: {
  editor: Editor | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const urlId = useId()
  const altId = useId()
  const urlErrorId = `${urlId}-error`
  const altErrorId = `${altId}-error`
  const [url, setUrl] = useState("")
  const [alt, setAlt] = useState("")
  const [errors, setErrors] = useState({ url: "", alt: "" })

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setUrl("")
      setAlt("")
      setErrors({ url: "", alt: "" })
    }
    onOpenChange(nextOpen)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editor) return

    const source = normalizeImageUrl(url)
    const nextErrors = {
      url: source ? "" : "请输入有效的 HTTPS 图片地址或站内相对路径。",
      alt: alt.trim() ? "" : "请描述图片内容，帮助无法查看图片的读者。",
    }
    setErrors(nextErrors)
    if (nextErrors.url || nextErrors.alt || !source) return

    editor
      .chain()
      .focus()
      .setImage({ src: source, alt: alt.trim(), title: alt.trim() })
      .run()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form className="grid gap-5" onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>插入图片</DialogTitle>
            <DialogDescription>
              首版仅插入图片 URL，不会把文件或二进制内容写入 D1。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field data-invalid={Boolean(errors.url)}>
              <FieldLabel htmlFor={urlId}>图片地址</FieldLabel>
              <Input
                id={urlId}
                autoFocus
                inputMode="url"
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value)
                  if (errors.url) {
                    setErrors((current) => ({ ...current, url: "" }))
                  }
                }}
                placeholder="https://example.com/image.jpg"
                aria-invalid={Boolean(errors.url)}
                aria-describedby={errors.url ? urlErrorId : undefined}
              />
              <FieldDescription>
                支持 HTTPS 和以 / 开头的站内路径。
              </FieldDescription>
              {errors.url ? (
                <FieldError id={urlErrorId}>{errors.url}</FieldError>
              ) : null}
            </Field>
            <Field data-invalid={Boolean(errors.alt)}>
              <FieldLabel htmlFor={altId}>替代文本</FieldLabel>
              <Input
                id={altId}
                value={alt}
                onChange={(event) => {
                  setAlt(event.target.value)
                  if (errors.alt) {
                    setErrors((current) => ({ ...current, alt: "" }))
                  }
                }}
                placeholder="例如：编辑器深色界面截图"
                aria-invalid={Boolean(errors.alt)}
                aria-describedby={errors.alt ? altErrorId : undefined}
              />
              {errors.alt ? (
                <FieldError id={altErrorId}>{errors.alt}</FieldError>
              ) : null}
            </Field>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                取消
              </Button>
            </DialogClose>
            <Button type="submit">
              <ImagePlus />
              插入图片
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export type EditorToolbarProps = {
  editor: Editor | null
  onSaveNow?: () => void | Promise<void>
  onCreateVersion?: () => void | Promise<void>
  saving?: boolean
}

export function EditorToolbar({
  editor,
  onSaveNow,
  onCreateVersion,
  saving = false,
}: EditorToolbarProps) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [imageOpen, setImageOpen] = useState(false)
  const [linkDialogSession, setLinkDialogSession] = useState(0)
  const [imageDialogSession, setImageDialogSession] = useState(0)

  const state =
    useEditorState({
      editor,
      selector: ({ editor: currentEditor }) => {
        if (!currentEditor) return EMPTY_EDITOR_STATE

        const block = currentEditor.isActive("heading", { level: 1 })
          ? "h1"
          : currentEditor.isActive("heading", { level: 2 })
            ? "h2"
            : currentEditor.isActive("heading", { level: 3 })
              ? "h3"
              : "paragraph"
        const align = currentEditor.isActive({ textAlign: "center" })
          ? "center"
          : currentEditor.isActive({ textAlign: "right" })
            ? "right"
            : currentEditor.isActive({ textAlign: "justify" })
              ? "justify"
              : "left"

        return {
          canUndo: currentEditor.can().undo(),
          canRedo: currentEditor.can().redo(),
          block,
          bulletList: currentEditor.isActive("bulletList"),
          orderedList: currentEditor.isActive("orderedList"),
          taskList: currentEditor.isActive("taskList"),
          blockquote: currentEditor.isActive("blockquote"),
          bold: currentEditor.isActive("bold"),
          italic: currentEditor.isActive("italic"),
          strike: currentEditor.isActive("strike"),
          code: currentEditor.isActive("code"),
          underline: currentEditor.isActive("underline"),
          highlight: currentEditor.isActive("highlight"),
          link: currentEditor.isActive("link"),
          superscript: currentEditor.isActive("superscript"),
          subscript: currentEditor.isActive("subscript"),
          align,
        }
      },
    }) ?? EMPTY_EDITOR_STATE

  const blockLabel = {
    paragraph: "正文",
    h1: "标题 1",
    h2: "标题 2",
    h3: "标题 3",
  }[state.block]

  function requestLinkDialog() {
    setLinkDialogSession((current) => current + 1)
    setLinkOpen(true)
  }

  function requestImageDialog() {
    setImageDialogSession((current) => current + 1)
    setImageOpen(true)
  }

  function handleToolbarKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return
    }

    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        "button[data-editor-control]:not(:disabled)",
      ),
    )
    if (!controls.length) return

    const activeIndex = controls.indexOf(
      event.currentTarget.ownerDocument.activeElement as HTMLButtonElement,
    )
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? controls.length - 1
          : event.key === "ArrowLeft"
            ? (activeIndex - 1 + controls.length) % controls.length
            : (activeIndex + 1) % controls.length

    event.preventDefault()
    controls[nextIndex]?.focus()
  }

  return (
    <>
      <div
        className="editor-toolbar"
        role="toolbar"
        aria-label="文档格式工具栏"
        aria-controls="document-editor-content"
        aria-busy={!editor}
        onKeyDown={handleToolbarKeyDown}
      >
        <div className="editor-toolbar__scroller">
          <div
            className="editor-toolbar__group"
            role="group"
            aria-label="历史操作"
          >
            <ToolButton
              label="撤销"
              shortcut="⌘Z"
              ariaKeyShortcuts="Control+Z Meta+Z"
              disabled={!editor || !state.canUndo}
              onClick={() => editor?.chain().focus().undo().run()}
            >
              <Undo2 />
            </ToolButton>
            <ToolButton
              label="重做"
              shortcut="⇧⌘Z"
              ariaKeyShortcuts="Control+Shift+Z Meta+Shift+Z"
              disabled={!editor || !state.canRedo}
              onClick={() => editor?.chain().focus().redo().run()}
            >
              <Redo2 />
            </ToolButton>
          </div>

          <Separator
            orientation="vertical"
            className="editor-toolbar__separator"
          />

          <div
            className="editor-toolbar__group"
            role="group"
            aria-label="段落样式"
          >
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      data-editor-control
                      aria-label={`段落样式：${blockLabel}`}
                      disabled={!editor}
                      className="editor-toolbar__select"
                    >
                      <Pilcrow />
                      <span>{blockLabel}</span>
                      <ChevronDown className="editor-toolbar__chevron" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>
                  段落样式
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="min-w-44">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onSelect={() =>
                      editor?.chain().focus().setParagraph().run()
                    }
                  >
                    <Pilcrow />
                    正文
                    {state.block === "paragraph" ? (
                      <Check className="ml-auto" />
                    ) : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      editor?.chain().focus().setHeading({ level: 1 }).run()
                    }
                  >
                    <Heading1 />
                    标题 1
                    {state.block === "h1" ? (
                      <Check className="ml-auto" />
                    ) : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      editor?.chain().focus().setHeading({ level: 2 }).run()
                    }
                  >
                    <Heading2 />
                    标题 2
                    {state.block === "h2" ? (
                      <Check className="ml-auto" />
                    ) : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      editor?.chain().focus().setHeading({ level: 3 }).run()
                    }
                  >
                    <Heading3 />
                    标题 3
                    {state.block === "h3" ? (
                      <Check className="ml-auto" />
                    ) : null}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Separator
            orientation="vertical"
            className="editor-toolbar__separator"
          />

          <div
            className="editor-toolbar__group"
            role="group"
            aria-label="列表与引用"
          >
            <ToolButton
              label="无序列表"
              active={state.bulletList}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <List />
            </ToolButton>
            <ToolButton
              label="有序列表"
              active={state.orderedList}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered />
            </ToolButton>
            <ToolButton
              label="任务列表"
              active={state.taskList}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleTaskList().run()}
            >
              <ListChecks />
            </ToolButton>
            <ToolButton
              label="引用"
              active={state.blockquote}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            >
              <Quote />
            </ToolButton>
          </div>

          <Separator
            orientation="vertical"
            className="editor-toolbar__separator"
          />

          <div
            className="editor-toolbar__group"
            role="group"
            aria-label="文字格式"
          >
            <ToolButton
              label="粗体"
              shortcut="⌘B"
              ariaKeyShortcuts="Control+B Meta+B"
              active={state.bold}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <Bold />
            </ToolButton>
            <ToolButton
              label="斜体"
              shortcut="⌘I"
              ariaKeyShortcuts="Control+I Meta+I"
              active={state.italic}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <Italic />
            </ToolButton>
            <ToolButton
              label="删除线"
              active={state.strike}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleStrike().run()}
            >
              <Strikethrough />
            </ToolButton>
            <ToolButton
              label="行内代码"
              active={state.code}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleCode().run()}
            >
              <Code2 />
            </ToolButton>
            <ToolButton
              label="下划线"
              shortcut="⌘U"
              ariaKeyShortcuts="Control+U Meta+U"
              active={state.underline}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
            >
              <Underline />
            </ToolButton>
            <ToolButton
              label="高亮"
              active={state.highlight}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleHighlight().run()}
            >
              <Highlighter />
            </ToolButton>
            <ToolButton
              label={state.link ? "编辑链接" : "添加链接"}
              active={state.link}
              disabled={!editor}
              onClick={requestLinkDialog}
            >
              <Link2 />
            </ToolButton>
          </div>

          <Separator
            orientation="vertical"
            className="editor-toolbar__separator"
          />

          <div
            className="editor-toolbar__group"
            role="group"
            aria-label="上下标"
          >
            <ToolButton
              label="上标"
              active={state.superscript}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleSuperscript().run()}
            >
              <Superscript />
            </ToolButton>
            <ToolButton
              label="下标"
              active={state.subscript}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleSubscript().run()}
            >
              <Subscript />
            </ToolButton>
          </div>

          <Separator
            orientation="vertical"
            className="editor-toolbar__separator"
          />

          <div
            className="editor-toolbar__group"
            role="group"
            aria-label="文本对齐"
          >
            <ToolButton
              label="左对齐"
              active={state.align === "left"}
              disabled={!editor}
              onClick={() => editor?.chain().focus().setTextAlign("left").run()}
            >
              <AlignLeft />
            </ToolButton>
            <ToolButton
              label="居中对齐"
              active={state.align === "center"}
              disabled={!editor}
              onClick={() =>
                editor?.chain().focus().setTextAlign("center").run()
              }
            >
              <AlignCenter />
            </ToolButton>
            <ToolButton
              label="右对齐"
              active={state.align === "right"}
              disabled={!editor}
              onClick={() =>
                editor?.chain().focus().setTextAlign("right").run()
              }
            >
              <AlignRight />
            </ToolButton>
            <ToolButton
              label="两端对齐"
              active={state.align === "justify"}
              disabled={!editor}
              onClick={() =>
                editor?.chain().focus().setTextAlign("justify").run()
              }
            >
              <AlignJustify />
            </ToolButton>
          </div>

          <Separator
            orientation="vertical"
            className="editor-toolbar__separator"
          />

          <div
            className="editor-toolbar__group"
            role="group"
            aria-label="插入内容"
          >
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      data-editor-control
                      aria-label="插入内容"
                      disabled={!editor}
                      className="editor-toolbar__select editor-toolbar__add"
                    >
                      <ImagePlus />
                      <span>添加</span>
                      <ChevronDown className="editor-toolbar__chevron" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>
                  插入内容
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="min-w-44">
                <DropdownMenuGroup>
                  <DropdownMenuItem onSelect={requestImageDialog}>
                    <ImagePlus />
                    图片 URL
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onSelect={() =>
                      editor?.chain().focus().setHorizontalRule().run()
                    }
                  >
                    <Minus />
                    分隔线
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      editor?.chain().focus().toggleCodeBlock().run()
                    }
                  >
                    <CodeXml />
                    代码块
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {(onSaveNow || onCreateVersion) && (
          <div className="editor-toolbar__actions">
            <Separator
              orientation="vertical"
              className="editor-toolbar__separator"
            />
            {onSaveNow ? (
              <ToolButton
                label={saving ? "正在保存" : "立即保存"}
                shortcut="⌘S"
                ariaKeyShortcuts="Control+S Meta+S"
                disabled={!editor || saving}
                onClick={() => void onSaveNow()}
              >
                <Save />
              </ToolButton>
            ) : null}
            {onCreateVersion ? (
              <ToolButton
                label="创建版本"
                shortcut="⇧⌘S"
                ariaKeyShortcuts="Control+Shift+S Meta+Shift+S"
                disabled={!editor || saving}
                onClick={() => void onCreateVersion()}
              >
                <History />
              </ToolButton>
            ) : null}
          </div>
        )}
      </div>

      <LinkDialog
        key={`link-dialog-${linkDialogSession}`}
        editor={editor}
        initialValue={String(editor?.getAttributes("link").href ?? "")}
        open={linkOpen}
        onOpenChange={setLinkOpen}
      />
      <ImageDialog
        key={`image-dialog-${imageDialogSession}`}
        editor={editor}
        open={imageOpen}
        onOpenChange={setImageOpen}
      />
    </>
  )
}
