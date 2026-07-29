import { Clock3, Hash, Save, SlidersHorizontal, Variable } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { PromptRecord, PromptVersion } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

export function InspectorPanel({ prompt, versions, variables, onChange, onCreateVersion }: {
  prompt: PromptRecord;
  versions: PromptVersion[];
  variables: string[];
  onChange: (patch: Partial<PromptRecord>) => void;
  onCreateVersion: () => void;
}) {
  return (
    <aside className="hidden w-80 shrink-0 border-l border-border bg-sidebar xl:flex xl:flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-border px-4"><SlidersHorizontal className="size-4 text-muted-foreground" /><span className="text-sm font-semibold">提示词设置</span></div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 p-4">
          <section>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Variable className="size-3.5" />变量</div>
            <div className="flex min-h-16 flex-wrap content-start gap-1.5 rounded-xl border border-border bg-background/60 p-3">
              {variables.length ? variables.map((variable) => <Badge key={variable} className="font-mono text-[10px]">{`{{${variable}}}`}</Badge>) : <span className="text-xs leading-5 text-muted-foreground">在内容中输入 <code>{"{{variable}}"}</code> 即可声明变量。</span>}
            </div>
          </section>
          <Separator />
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><SlidersHorizontal className="size-3.5" />模型参数</div>
            <label className="grid gap-1.5 text-xs text-muted-foreground">模型
              <select value={prompt.model} onChange={(event) => onChange({ model: event.target.value })} className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/20">
                <option>GPT-5.6</option><option>GPT-5</option><option>Claude Sonnet</option><option>Gemini Pro</option><option>通用</option>
              </select>
            </label>
            <label className="grid gap-2 text-xs text-muted-foreground">Temperature <span className="font-mono text-foreground">{prompt.temperature.toFixed(1)}</span>
              <input type="range" min="0" max="2" step="0.1" value={prompt.temperature} onChange={(event) => onChange({ temperature: Number(event.target.value) })} className="accent-primary" />
            </label>
            <label className="flex items-center justify-between text-sm"><span>收藏</span><Switch checked={prompt.isFavorite} onCheckedChange={(checked) => onChange({ isFavorite: checked })} /></label>
            <label className="grid gap-1.5 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><Hash className="size-3.5" />标签</span>
              <Input value={prompt.tags.join(", ")} onChange={(event) => onChange({ tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 12) })} placeholder="写作, 开发, 分析" />
            </label>
          </section>
          <Separator />
          <section>
            <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Clock3 className="size-3.5" />版本历史</div><Button variant="outline" size="sm" onClick={onCreateVersion}><Save />保存版本</Button></div>
            <div className="space-y-2">
              {versions.length === 0 && <p className="rounded-xl border border-dashed border-border p-3 text-xs leading-5 text-muted-foreground">保存关键版本，之后可查看每次快照。</p>}
              {versions.slice(0, 8).map((version, index) => <div key={version.id} className="rounded-xl border border-border bg-background/60 p-3"><div className="flex items-center justify-between gap-3"><span className="truncate text-xs font-medium">版本 {versions.length - index}</span><span className="shrink-0 text-[10px] text-muted-foreground">{formatRelativeTime(version.createdAt)}</span></div><p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{version.contentText || "空白版本"}</p></div>)}
            </div>
          </section>
        </div>
      </ScrollArea>
    </aside>
  );
}
