import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readdir, readFile, writeFile, unlink, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseMermaidER } from "./mermaid-parser.js";
import { reverseEngineerPostgres } from "./db-reverse-engineer.js";
import type { Entity, Relation, ERDiagram } from "../lib/er-schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIAGRAMS_DIR = join(__dirname, "..", "data", "diagrams");

function parseEnumDefinitions(
  raw: string | undefined
): Record<string, string[]> | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

async function ensureDiagramsDir() {
  await mkdir(DIAGRAMS_DIR, { recursive: true });
}

function generateId(): string {
  return `diagram_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function gridLayout(entities: Entity[]): Record<string, { x: number; y: number }> {
  const layout: Record<string, { x: number; y: number }> = {};
  const cols = Math.max(1, Math.ceil(Math.sqrt(entities.length)));
  entities.forEach((entity, i) => {
    layout[entity.id] = {
      x: (i % cols) * 300,
      y: Math.floor(i / cols) * 250,
    };
  });
  return layout;
}

const server = new McpServer({
  name: "er-diagram",
  version: "1.0.0",
});

// Tool 1: parse_mermaid_er
server.tool(
  "parse_mermaid_er",
  "Parse Mermaid ER diagram text into ERDiagram JSON without saving. Use create_diagram to parse and save in one step.",
  {
    mermaidText: z.string().describe("Mermaid erDiagram text"),
    enumDefinitions: z
      .string()
      .optional()
      .describe('JSON string of ENUM type definitions, e.g. {"status":["active","inactive"]}'),
  },
  async ({ mermaidText, enumDefinitions }) => {
    const diagram = parseMermaidER(mermaidText, parseEnumDefinitions(enumDefinitions));
    return {
      content: [{ type: "text" as const, text: JSON.stringify(diagram, null, 2) }],
    };
  }
);

// Tool 2: create_diagram
server.tool(
  "create_diagram",
  `Create and save an ER diagram from Mermaid erDiagram text.

## Mermaid erDiagram format

\`\`\`
erDiagram
  table_name {
    type column_name [PK] [FK] [UK]
  }
  table_a ||--o{ table_b : "label"
\`\`\`

## Supported types
uuid, text, varchar, int/integer, bigint, boolean, date, timestamp/timestamptz, decimal/numeric, float/real, json/jsonb

Any unrecognized type name is treated as ENUM — provide its values via enumDefinitions.

## Relation cardinalities
- \`||\` = exactly one (1)
- \`o|\` = zero or one (1)
- \`|{\` or \`o{\` = many (N)

Examples: \`||--o{\` = 1:N, \`||--||\` = 1:1, \`o|--o{\` = 0..1:N`,
  {
    name: z.string().describe("Diagram name"),
    mermaidText: z.string().optional().describe("Mermaid erDiagram text to parse"),
    entities: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          attributes: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              type: z.string(),
              isPrimaryKey: z.boolean(),
              isForeignKey: z.boolean(),
              isNullable: z.boolean(),
              enumValues: z.array(z.string()).optional(),
            })
          ),
        })
      )
      .optional()
      .describe("Entity array (alternative to mermaidText)"),
    relations: z
      .array(
        z.object({
          id: z.string(),
          sourceEntityId: z.string(),
          targetEntityId: z.string(),
          sourceCardinality: z.enum(["1", "N"]),
          targetCardinality: z.enum(["1", "N"]),
          label: z.string().optional(),
        })
      )
      .optional()
      .describe("Relation array (used with entities)"),
    enumDefinitions: z
      .string()
      .optional()
      .describe('JSON string of ENUM type definitions (used with mermaidText)'),
  },
  async ({ name, mermaidText, entities, relations, enumDefinitions }) => {
    await ensureDiagramsDir();

    let diagram: ERDiagram;

    if (mermaidText) {
      diagram = parseMermaidER(mermaidText, parseEnumDefinitions(enumDefinitions));
      diagram.name = name;
    } else if (entities) {
      diagram = {
        version: "1.0",
        name,
        entities,
        relations: relations ?? [],
        layout: gridLayout(entities),
      };
    } else {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: "Provide either mermaidText or entities" }),
          },
        ],
        isError: true,
      };
    }

    const id = generateId();
    diagram.id = id;
    diagram.updatedAt = new Date().toISOString();

    const filePath = join(DIAGRAMS_DIR, `${id}.json`);
    await writeFile(filePath, JSON.stringify(diagram, null, 2));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            id,
            name: diagram.name,
            entityCount: diagram.entities.length,
            relationCount: diagram.relations.length,
            filePath,
          }),
        },
      ],
    };
  }
);

// Tool 3: list_diagrams
server.tool(
  "list_diagrams",
  "List all saved ER diagrams.",
  {},
  async () => {
    await ensureDiagramsDir();
    const files = await readdir(DIAGRAMS_DIR);
    const diagrams = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const content = await readFile(join(DIAGRAMS_DIR, file), "utf-8");
        const diagram = JSON.parse(content) as ERDiagram;
        diagrams.push({
          id: diagram.id ?? file.replace(".json", ""),
          name: diagram.name,
          entityCount: diagram.entities.length,
          updatedAt: diagram.updatedAt,
        });
      } catch {
        // Skip invalid files
      }
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(diagrams, null, 2) }],
    };
  }
);

// Tool 4: get_diagram
server.tool(
  "get_diagram",
  "Get a saved ER diagram by ID.",
  {
    id: z.string().describe("Diagram ID"),
  },
  async ({ id }) => {
    await ensureDiagramsDir();
    const filePath = join(DIAGRAMS_DIR, `${id}.json`);
    try {
      const content = await readFile(filePath, "utf-8");
      return {
        content: [{ type: "text" as const, text: content }],
      };
    } catch {
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ error: `Diagram '${id}' not found` }) },
        ],
        isError: true,
      };
    }
  }
);

// Tool 5: delete_diagram
server.tool(
  "delete_diagram",
  "Delete a saved ER diagram by ID.",
  {
    id: z.string().describe("Diagram ID"),
  },
  async ({ id }) => {
    await ensureDiagramsDir();
    const filePath = join(DIAGRAMS_DIR, `${id}.json`);
    try {
      await unlink(filePath);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ deleted: id }) },
        ],
      };
    } catch {
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ error: `Diagram '${id}' not found` }) },
        ],
        isError: true,
      };
    }
  }
);

// Tool 6: reverse_engineer_db
server.tool(
  "reverse_engineer_db",
  `Reverse-engineer a PostgreSQL database schema into an ER diagram.
Connects to the database, reads information_schema + pg_enum, and saves the result.`,
  {
    connectionString: z.string().describe("PostgreSQL connection string (e.g. postgresql://user:pass@host:5432/db)"),
    name: z.string().describe("Diagram name"),
    schema: z.string().optional().describe('Database schema to inspect (default: "public")'),
    excludeTables: z
      .string()
      .optional()
      .describe("Comma-separated list of tables to exclude"),
  },
  async ({ connectionString, name, schema, excludeTables }) => {
    await ensureDiagramsDir();

    try {
      const exclude = excludeTables
        ? excludeTables.split(",").map((t) => t.trim()).filter(Boolean)
        : undefined;

      const diagram = await reverseEngineerPostgres(connectionString, {
        schema: schema ?? "public",
        excludeTables: exclude,
      });

      diagram.name = name;
      const id = generateId();
      diagram.id = id;
      diagram.updatedAt = new Date().toISOString();

      const filePath = join(DIAGRAMS_DIR, `${id}.json`);
      await writeFile(filePath, JSON.stringify(diagram, null, 2));

      // Count enum attributes
      const enumCount = diagram.entities.reduce(
        (sum, e) => sum + e.attributes.filter((a) => a.type === "ENUM").length,
        0
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              id,
              name: diagram.name,
              entityCount: diagram.entities.length,
              relationCount: diagram.relations.length,
              enumAttributeCount: enumCount,
              filePath,
            }),
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: `DB reverse engineering failed: ${message}` }),
          },
        ],
        isError: true,
      };
    }
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Failed to start MCP server:", err);
  process.exit(1);
});
