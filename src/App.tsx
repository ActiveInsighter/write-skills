import { LoaderCircle, LockKeyhole, LogOut, Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { InspectorPanel } from "@/components/editor/inspector-panel";
import { PromptEditor } from "@/components/editor/prompt-editor";
import { PromptSidebar } from "@/components/editor/prompt-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useDebouncedSave } from "@/hooks/use-debounced-save";
import { api } from "@/lib/api";
import type { AuthState, PromptRecord, PromptVersion } from "@/lib/types";

function extractVariables(text: string) {
  return [...new Set([...text.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map((match) => match[1]))];
}

function LoginScreen({ onLogin }: { onLogin: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <form className="w-full max-w-sm rounded-3xl border border-border bg-card p-7 shadow-2xl shadow-black/10" onSubmit={async (event) => { event.preventDefault(); setLoading(true); setError(""); try { await onLogin(password); } catch (reason) { setError(reason instanceof Error ? reason.message : "登录失败"); } finally { setLoading(false); } }}>
        <div className="mb-6 grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground"><LockKeyhole /></div>
        <h1 className="text-xl font-semibold">进入 Write Skills</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">请输入部署时配置的访问密码。会话凭证只保存在安全的 HttpOnly Cookie 中。</p>
        <Input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="访问密码" className="mt-6" />
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <Button className="mt-4 w-full" disabled={!password || loading}>{loading && <LoaderCircle className="animate-spin" />}登录</Button>
      </form>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [prompts, setPrompts] = useState<PromptRecord[]>([]);
  const [active, setActive] = useState<PromptRecord | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [theme, setTheme] = useState<"light" | "dark">(() => (localStorage.getItem("theme") as "light" | "dark") || "dark");

  useEffect(() => { document.documentElement.classList.toggle("dark", theme === "dark"); localStorage.setItem("theme", theme); }, [theme]);

  const loadPrompts = useCallback(async (search = "") => {
    setLoading(true);
    try {
      const rows = await api.listPrompts(search);
      setPrompts(rows);
      setActive((current) => current ? rows.find((item) => item.id === current.id) ?? rows[0] ?? null : rows[0] ?? null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    api.authStatus().then((state) => { setAuth(state); if (state.authenticated) void loadPrompts(""); }).catch(() => setAuth({ required: false, authenticated: true }));
  }, [loadPrompts]);

  useEffect(() => { if (!auth?.authenticated) return; const timer = window.setTimeout(() => void loadPrompts(query), 250); return () => window.clearTimeout(timer); }, [auth?.authenticated, loadPrompts, query]);
  useEffect(() => { if (!active) { setVersions([]); return; } api.listVersions(active.id).then(setVersions).catch(() => setVersions([])); }, [active?.id]);

  const savePrompt = useCallback(async (draft: PromptRecord) => {
    setSaveState("saving");
    try {
      const updated = await api.updatePrompt(draft.id, draft);
      setPrompts((items) => items.map((item) => item.id === updated.id ? updated : item));
      setActive(updated);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1600);
    } catch { setSaveState("error"); }
  }, []);
  useDebouncedSave(active, (draft) => draft && void savePrompt(draft), 750, Boolean(active));

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (active) void api.createVersion(active.id).then((version) => setVersions((items) => [version, ...items]));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active]);

  const variables = useMemo(() => extractVariables(active?.contentText ?? ""), [active?.contentText]);

  if (!auth) return <div className="grid min-h-screen place-items-center bg-background"><LoaderCircle className="animate-spin text-muted-foreground" /></div>;
  if (!auth.authenticated) return <LoginScreen onLogin={async (password) => { const state = await api.login(password); setAuth(state); await loadPrompts(""); }} />;

  async function createPrompt() { const created = await api.createPrompt(); setPrompts((items) => [created, ...items]); setActive(created); }
  async function deletePrompt() { if (!active || !confirm(`确定删除“${active.title}”吗？`)) return; await api.deletePrompt(active.id); const rest = prompts.filter((item) => item.id !== active.id); setPrompts(rest); setActive(rest[0] ?? null); }
  async function duplicatePrompt() { if (!active) return; const copy = await api.duplicatePrompt(active.id); setPrompts((items) => [copy, ...items]); setActive(copy); }
  async function createVersion() { if (!active) return; const version = await api.createVersion(active.id); setVersions((items) => [version, ...items]); }

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <PromptSidebar prompts={prompts} activeId={active?.id ?? null} query={query} loading={loading} onQueryChange={setQuery} onSelect={setActive} onCreate={() => void createPrompt()} />
        {active ? <PromptEditor prompt={active} saveState={saveState} onChange={(patch) => setActive((current) => current ? { ...current, ...patch } : current)} onDelete={() => void deletePrompt()} onDuplicate={() => void duplicatePrompt()} onCreateVersion={() => void createVersion()} /> : (
          <main className="grid min-w-0 flex-1 place-items-center p-6"><div className="max-w-md text-center"><h1 className="text-2xl font-semibold">开始构建高质量提示词</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">创建提示词后，编辑内容会自动保存到 Cloudflare D1，并可随时保留版本快照。</p><Button className="mt-5" onClick={() => void createPrompt()}>创建第一条提示词</Button></div></main>
        )}
        {active && <InspectorPanel prompt={active} versions={versions} variables={variables} onChange={(patch) => setActive((current) => current ? { ...current, ...patch } : current)} onCreateVersion={() => void createVersion()} />}
        <div className="fixed bottom-3 right-3 z-40 flex gap-1 rounded-xl border border-border bg-popover/90 p-1 shadow-lg backdrop-blur xl:bottom-auto xl:right-[21rem] xl:top-3">
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="切换主题">{theme === "dark" ? <Sun /> : <Moon />}</Button>
          {auth.required && <Button variant="ghost" size="icon" onClick={() => void api.logout().then(() => setAuth({ required: true, authenticated: false }))} aria-label="退出"><LogOut /></Button>}
        </div>
      </div>
    </TooltipProvider>
  );
}
