import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readdir, readFile, writeFile, unlink, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { VariantSession, Variant } from "../lib/variant-schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = join(__dirname, "..", "data", "variant-sessions");

async function ensureDir() {
  await mkdir(SESSIONS_DIR, { recursive: true });
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function sessionPath(id: string) {
  return join(SESSIONS_DIR, `${id}.json`);
}

async function loadSession(id: string): Promise<VariantSession | null> {
  try {
    const content = await readFile(sessionPath(id), "utf-8");
    return JSON.parse(content) as VariantSession;
  } catch {
    return null;
  }
}

async function saveSession(session: VariantSession): Promise<void> {
  session.updatedAt = new Date().toISOString();
  await writeFile(sessionPath(session.id), JSON.stringify(session, null, 2));
}

const server = new McpServer({
  name: "variant-ui",
  version: "1.0.0",
});

// Tool 1: create_variant_session
server.tool(
  "create_variant_session",
  `Create a new Variant UI session.
After creating a session, open http://localhost:3000/variant-ui in the browser to view variants as they are pushed.`,
  {
    name: z.string().describe("Session name (e.g., 'Login page design')"),
    prompt: z.string().describe("The original design prompt"),
  },
  async ({ name, prompt }) => {
    await ensureDir();
    const now = new Date().toISOString();
    const session: VariantSession = {
      id: generateId("vs"),
      name,
      prompt,
      createdAt: now,
      updatedAt: now,
      variants: [],
      selectedVariantIds: [],
      status: "active",
    };
    await saveSession(session);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            sessionId: session.id,
            name: session.name,
            viewUrl: `http://localhost:3000/variant-ui`,
            message: "Session created. Push variants using push_variants tool.",
          }),
        },
      ],
    };
  }
);

// Tool 2: push_variants
server.tool(
  "push_variants",
  `Push UI design variants to a session. Each variant should be a self-contained HTML page.

Guidelines for generating variants:
- Each variant must be a complete HTML document (<!DOCTYPE html>...)
- Include all styles inline or via CDN (Tailwind CDN recommended)
- Make the design visually distinct from other variants
- Use different color schemes, layouts, typography, spacing
- The code should render beautifully standalone in an iframe`,
  {
    sessionId: z.string().describe("Session ID from create_variant_session"),
    variants: z
      .array(
        z.object({
          code: z.string().describe("Complete HTML code for the variant"),
          format: z
            .enum(["html", "react"])
            .optional()
            .describe("Code format (default: html)"),
          label: z
            .string()
            .optional()
            .describe("Short label (e.g., 'Minimal Dark')"),
          tags: z
            .array(z.string())
            .optional()
            .describe("Tags for filtering (e.g., ['dark', 'minimal'])"),
          description: z
            .string()
            .optional()
            .describe("Brief description of the design approach"),
        })
      )
      .describe("Array of variant objects to push"),
  },
  async ({ sessionId, variants }) => {
    await ensureDir();
    const session = await loadSession(sessionId);
    if (!session) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: `Session '${sessionId}' not found` }),
          },
        ],
        isError: true,
      };
    }

    const startIndex = session.variants.length;
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const variant: Variant = {
        id: generateId("var"),
        sessionId,
        index: startIndex + i,
        code: v.code,
        format: v.format ?? "html",
        metadata: {
          label: v.label,
          tags: v.tags,
          description: v.description,
        },
        createdAt: new Date().toISOString(),
        selected: false,
        starred: false,
      };
      session.variants.push(variant);
    }

    await saveSession(session);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            sessionId,
            pushed: variants.length,
            totalVariants: session.variants.length,
            message: `${variants.length} variant(s) pushed. View at http://localhost:3000/variant-ui`,
          }),
        },
      ],
    };
  }
);

// Tool 3: get_session_status
server.tool(
  "get_session_status",
  "Get the current status of a variant session, including variant count and selection state.",
  {
    sessionId: z.string().describe("Session ID"),
  },
  async ({ sessionId }) => {
    await ensureDir();
    const session = await loadSession(sessionId);
    if (!session) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: `Session '${sessionId}' not found` }),
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            sessionId: session.id,
            name: session.name,
            prompt: session.prompt,
            status: session.status,
            variantCount: session.variants.length,
            selectedCount: session.selectedVariantIds.length,
            starredCount: session.variants.filter((v) => v.starred).length,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
          }),
        },
      ],
    };
  }
);

// Tool 4: get_selected_variants
server.tool(
  "get_selected_variants",
  "Get the code of variants that the user has selected in the browser. Use this after the user has reviewed and selected their preferred designs.",
  {
    sessionId: z.string().describe("Session ID"),
  },
  async ({ sessionId }) => {
    await ensureDir();
    const session = await loadSession(sessionId);
    if (!session) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: `Session '${sessionId}' not found` }),
          },
        ],
        isError: true,
      };
    }

    const selected = session.variants.filter((v) => v.selected);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            sessionId: session.id,
            sessionName: session.name,
            selectedCount: selected.length,
            variants: selected.map((v) => ({
              id: v.id,
              index: v.index,
              label: v.metadata.label,
              format: v.format,
              code: v.code,
            })),
          }),
        },
      ],
    };
  }
);

// Tool 5: list_sessions
server.tool(
  "list_sessions",
  "List all variant UI sessions.",
  {},
  async () => {
    await ensureDir();
    const files = await readdir(SESSIONS_DIR);
    const sessions = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const content = await readFile(join(SESSIONS_DIR, file), "utf-8");
        const session = JSON.parse(content) as VariantSession;
        sessions.push({
          id: session.id,
          name: session.name,
          status: session.status,
          variantCount: session.variants.length,
          selectedCount: session.selectedVariantIds.length,
          updatedAt: session.updatedAt,
        });
      } catch {
        // skip invalid
      }
    }

    sessions.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(sessions, null, 2) },
      ],
    };
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Failed to start variant-ui MCP server:", err);
  process.exit(1);
});
