export interface VariantSession {
  id: string;
  name: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
  variants: Variant[];
  selectedVariantIds: string[];
  status: "active" | "completed";
}

export interface Variant {
  id: string;
  sessionId: string;
  index: number;
  code: string;
  format: "html" | "react";
  metadata: {
    label?: string;
    tags?: string[];
    description?: string;
  };
  createdAt: string;
  selected: boolean;
  starred: boolean;
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createSession(name: string, prompt: string): VariantSession {
  const now = new Date().toISOString();
  return {
    id: generateId("vs"),
    name,
    prompt,
    createdAt: now,
    updatedAt: now,
    variants: [],
    selectedVariantIds: [],
    status: "active",
  };
}

export function createVariant(
  sessionId: string,
  index: number,
  code: string,
  opts?: {
    format?: "html" | "react";
    label?: string;
    tags?: string[];
    description?: string;
  }
): Variant {
  return {
    id: generateId("var"),
    sessionId,
    index,
    code,
    format: opts?.format ?? "html",
    metadata: {
      label: opts?.label,
      tags: opts?.tags,
      description: opts?.description,
    },
    createdAt: new Date().toISOString(),
    selected: false,
    starred: false,
  };
}
