import type { AuthState, PromptInput, PromptRecord, PromptVersion } from "@/lib/types";

type ApiErrorBody = { error?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    credentials: "same-origin",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.error || `请求失败（${response.status}）`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  authStatus: () => request<AuthState>("/api/auth/status"),
  login: (password: string) =>
    request<AuthState>("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST", body: "{}" }),
  listPrompts: (query = "") => request<PromptRecord[]>(`/api/prompts?q=${encodeURIComponent(query)}`),
  createPrompt: (input?: Partial<PromptInput>) =>
    request<PromptRecord>("/api/prompts", { method: "POST", body: JSON.stringify(input ?? {}) }),
  updatePrompt: (id: string, input: Partial<PromptInput>) =>
    request<PromptRecord>(`/api/prompts/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deletePrompt: (id: string) =>
    request<{ ok: true }>(`/api/prompts/${id}`, { method: "DELETE" }),
  duplicatePrompt: (id: string) =>
    request<PromptRecord>(`/api/prompts/${id}/duplicate`, { method: "POST", body: "{}" }),
  listVersions: (id: string) => request<PromptVersion[]>(`/api/prompts/${id}/versions`),
  createVersion: (id: string) =>
    request<PromptVersion>(`/api/prompts/${id}/versions`, { method: "POST", body: "{}" }),
};
