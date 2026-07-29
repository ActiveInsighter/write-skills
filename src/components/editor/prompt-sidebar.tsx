import { FileText, Plus, Search, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PromptRecord } from "@/lib/types";
import { cn, formatRelativeTime } from "@/lib/utils";

export function PromptSidebar({ prompts, activeId, query, loading, onQueryChange, onSelect, onCreate }: {
  prompts: PromptRecord[];
  activeId: string | null;
  query: string;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onSelect: (prompt: PromptRecord) => void;
  onCreate: () => void;
}) {
  return (
    <aside className="hidden min-w-0 border-r border-border bg-sidebar md:flex md:w-72 md:flex-col lg:w-80">
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><Sparkles className="size-4" /></div>
          <div><div className="text-sm font-semibold tracking-tight">Write Skills</div><div className="text-[11px] text-muted-foreground">Prompt workspace</div></div>
        </div>
        <Button size="icon" onClick={onCreate} aria-label="新建提示词"><Plus /></Button>
      </div>
      <div className="p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索标题、内容或标签" className="pl-9" />
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-2 pb-3">
        <div className="space-y-1">
          {loading && <div className="px-3 py-8 text-center text-sm text-muted-foreground">正在载入提示词…</div>}
          {!loading && prompts.length === 0 && (
            <div className="mx-2 rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <FileText className="mx-auto mb-3 size-7 text-muted-foreground" />
              <p className="text-sm font-medium">还没有提示词</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">创建第一条提示词，内容会自动保存到 D1。</p>
            </div>
          )}
          {prompts.map((prompt) => (
            <button
              key={prompt.id}
              onClick={() => onSelect(prompt)}
              className={cn("group w-full rounded-xl border border-transparent px-3 py-3 text-left transition hover:bg-accent/70", activeId === prompt.id && "border-border bg-accent shadow-sm")}
            >
              <div className="flex items-start gap-3">
                <div className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground", activeId === prompt.id && "bg-primary/10 text-primary")}><FileText className="size-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5"><span className="truncate text-sm font-medium">{prompt.title || "未命名提示词"}</span>{prompt.isFavorite && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />}</div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{prompt.contentText || "空白提示词"}</p>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground"><span>{prompt.tags[0] ? `#${prompt.tags[0]}` : prompt.model}</span><span>{formatRelativeTime(prompt.updatedAt)}</span></div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
