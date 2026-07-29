export type PromptRecord = {
  id: string;
  title: string;
  contentHtml: string;
  contentText: string;
  description: string;
  tags: string[];
  model: string;
  temperature: number;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PromptVersion = {
  id: string;
  promptId: string;
  title: string;
  contentHtml: string;
  contentText: string;
  createdAt: string;
};

export type PromptInput = Pick<
  PromptRecord,
  "title" | "contentHtml" | "contentText" | "description" | "tags" | "model" | "temperature" | "isFavorite"
>;

export type AuthState = {
  required: boolean;
  authenticated: boolean;
};
