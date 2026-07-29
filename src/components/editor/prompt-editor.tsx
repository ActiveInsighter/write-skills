import CharacterCount from "@tiptap/extension-character-count";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import Typography from "@tiptap/extension-typography";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Check, Copy, Download, Ellipsis, Save, Star, Trash2, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import type { PromptRecord } from "@/lib/types";
import { cn, downloadText } from "@/lib/utils";
import { EditorToolbar } from "./editor-toolbar";

export function PromptEditor({ prompt, saveState, onChange, onDelete, onDuplicate, onCreateVersion }: {
  prompt: PromptRecord;
  saveState: "idle" | "saving" | "saved" | "error";
  onChange: (patch: Partial<PromptRecord>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onCreateVersion: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false }),
      Placeholder.configure({ placeholder: "从目标、角色、背景、约束与输出格式开始书写…" }),
      CharacterCount,
      Highlight.configure({ multicolor: false }),
      Typography,
      Link.configure({ openOnClick: false, autolink: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: prompt.contentHtml,
    editorProps: {
      attributes: {
        class: "tiptap prose-editor min-h-[calc(100vh-12rem)] max-w-none focus:outline-none",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange({ contentHtml: currentEditor.getHTML(), contentText: currentEditor.getText({ blockSeparator: "\n" }) });
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== prompt.contentHtml) editor.commands.setContent(prompt.contentHtml, { emitUpdate: false });
  }, [editor, prompt.id, prompt.contentHtml]);

  const stats = useMemo(() => ({
    characters: editor?.storage.characterCount.characters() ?? prompt.contentText.length,
    words: editor?.storage.characterCount.words() ?? 0,
  }), [editor, prompt.contentText]);

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt.contentText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-background">
      <header className="flex h-16 items-center gap-3 border-b border-border px-4 lg:px-6">
        <div className="min-w-0 flex-1">
          <Input value={prompt.title} onChange={(event) => onChange({ title: event.target.value })} placeholder="未命名提示词" className="h-auto border-0 bg-transparent px-0 text-base font-semibold shadow-none focus:ring-0 lg:text-lg" />
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {saveState === "saving" && <><span className="size-1.5 animate-pulse rounded-full bg-amber-400" />正在保存</>}
            {saveState === "saved" && <><Check className="size-3 text-emerald-500" />已保存到 D1</>}
            {saveState === "error" && <><span className="size-1.5 rounded-full bg-destructive" />保存失败</>}
            {saveState === "idle" && <>自动保存已开启</>}
          </div>
        </div>
        <Tooltip content={prompt.isFavorite ? "取消收藏" : "收藏"}><Button variant="ghost" size="icon" onClick={() => onChange({ isFavorite: !prompt.isFavorite })}><Star className={cn(prompt.isFavorite && "fill-amber-400 text-amber-400")} /></Button></Tooltip>
        <Tooltip content="复制纯文本"><Button variant="outline" size="icon" onClick={copyPrompt}>{copied ? <Check /> : <Copy />}</Button></Tooltip>
        <Button variant="outline" className="hidden sm:inline-flex" onClick={onCreateVersion}><Save />保存版本</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><Ellipsis /></Button></DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onDuplicate}><Copy />创建副本</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => downloadText(`${prompt.title || "prompt"}.txt`, prompt.contentText)}><Download />导出纯文本</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => downloadText(`${prompt.title || "prompt"}.json`, JSON.stringify(prompt, null, 2), "application/json")}><Download />导出 JSON</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onDelete}><Trash2 />删除提示词</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <EditorToolbar editor={editor} />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-4xl px-6 py-8 sm:px-10 lg:px-14 lg:py-12">
          <div className="mb-7 flex items-center justify-between rounded-2xl border border-primary/15 bg-primary/[0.035] px-4 py-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-2"><WandSparkles className="size-4 text-primary" />建议按“角色 → 目标 → 背景 → 约束 → 输出格式”组织提示词。</span>
            <span className="hidden font-mono sm:inline">⌘ / Ctrl + S 保存版本</span>
          </div>
          <EditorContent editor={editor} />
        </div>
      </div>
      <footer className="flex h-9 items-center justify-between border-t border-border px-4 text-[11px] text-muted-foreground lg:px-6">
        <span>{stats.characters} 字符 · {stats.words} 词</span>
        <span>{prompt.model} · Temperature {prompt.temperature.toFixed(1)}</span>
      </footer>
    </main>
  );
}
