import type { Attribute, Entity, Relation, ERDiagram } from "../lib/er-schema";

const TYPE_MAP: Record<string, string> = {
  uuid: "UUID",
  text: "TEXT",
  int: "INT",
  integer: "INT",
  bigint: "BIGINT",
  boolean: "BOOLEAN",
  bool: "BOOLEAN",
  date: "DATE",
  datetime: "DATETIME",
  timestamptz: "TIMESTAMP",
  timestamp: "TIMESTAMP",
  decimal: "DECIMAL",
  numeric: "DECIMAL",
  float: "FLOAT",
  real: "FLOAT",
  json: "JSON",
  jsonb: "JSON",
  varchar: "VARCHAR",
  string: "VARCHAR",
  serial: "INT",
  bigserial: "BIGINT",
};

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function resolveType(
  rawType: string,
  enumDefinitions?: Record<string, string[]>
): { type: string; enumValues?: string[] } {
  const lower = rawType.toLowerCase();
  if (TYPE_MAP[lower]) {
    return { type: TYPE_MAP[lower] };
  }
  // Unknown type → treat as ENUM
  const enumValues = enumDefinitions?.[rawType] ?? enumDefinitions?.[lower];
  return { type: "ENUM", enumValues };
}

interface ParsedAttribute {
  name: string;
  rawType: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique: boolean;
  comment?: string;
}

function parseAttributeLine(line: string): ParsedAttribute | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("%%")) return null;

  // Format: type name [PK] [FK] [UK] ["comment"]
  // Extract comment first
  let comment: string | undefined;
  let rest = trimmed;
  const commentMatch = rest.match(/"([^"]*)"\s*$/);
  if (commentMatch) {
    comment = commentMatch[1];
    rest = rest.slice(0, rest.length - commentMatch[0].length).trim();
  }

  const tokens = rest.split(/\s+/);
  if (tokens.length < 2) return null;

  const rawType = tokens[0];
  const name = tokens[1];
  const markers = tokens.slice(2).map((m) => m.toUpperCase());

  return {
    name,
    rawType,
    isPrimaryKey: markers.includes("PK"),
    isForeignKey: markers.includes("FK"),
    isUnique: markers.includes("UK"),
    comment,
  };
}

interface ParsedRelation {
  sourceEntity: string;
  targetEntity: string;
  sourceCardinality: "1" | "N";
  targetCardinality: "1" | "N";
  label?: string;
}

function parseCardinality(marker: string): "1" | "N" {
  // Right side markers (after --)
  if (marker.includes("{") || marker.includes("}")) return "N";
  return "1";
}

function parseRelationLine(line: string): ParsedRelation | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("%%")) return null;

  // Format: entity1 <markers>--<markers> entity2 : "label"
  const match = trimmed.match(
    /^(\w+)\s+([|o}{]+)--([|o}{]+)\s+(\w+)\s*(?::\s*"?([^"]*)"?\s*)?$/
  );
  if (!match) return null;

  const [, sourceEntity, leftMarker, rightMarker, targetEntity, label] = match;

  return {
    sourceEntity,
    targetEntity,
    sourceCardinality: parseCardinality(leftMarker),
    targetCardinality: parseCardinality(rightMarker),
    label: label?.trim(),
  };
}

export function parseMermaidER(
  mermaidText: string,
  enumDefinitions?: Record<string, string[]>
): ERDiagram {
  const lines = mermaidText.split("\n");
  const entities: Entity[] = [];
  const relations: Relation[] = [];
  const layout: Record<string, { x: number; y: number }> = {};
  const entityNameToId: Record<string, string> = {};

  let currentEntityName: string | null = null;
  let currentAttributes: Attribute[] = [];
  let braceDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("%%")) continue;

    // Skip erDiagram directive
    if (trimmed === "erDiagram") continue;

    // Entity block start: entity_name {
    if (trimmed.match(/^\w+\s*\{/) && !trimmed.includes("--")) {
      const nameMatch = trimmed.match(/^(\w+)\s*\{/);
      if (nameMatch) {
        currentEntityName = nameMatch[1];
        currentAttributes = [];
        braceDepth = 1;
        // Check if closing brace is on same line
        if (trimmed.includes("}")) {
          braceDepth = 0;
          finishEntity();
        }
        continue;
      }
    }

    // Inside entity block
    if (currentEntityName && braceDepth > 0) {
      if (trimmed === "}") {
        braceDepth = 0;
        finishEntity();
        continue;
      }

      const parsed = parseAttributeLine(trimmed);
      if (parsed) {
        const { type, enumValues } = resolveType(parsed.rawType, enumDefinitions);
        currentAttributes.push({
          id: generateId("attr"),
          name: parsed.name,
          type,
          isPrimaryKey: parsed.isPrimaryKey,
          isForeignKey: parsed.isForeignKey,
          isNullable: !parsed.isPrimaryKey,
          enumValues,
        });
      }
      continue;
    }

    // Relation line
    const relation = parseRelationLine(trimmed);
    if (relation) {
      // Ensure entities exist for relations (create stubs if needed)
      ensureEntity(relation.sourceEntity);
      ensureEntity(relation.targetEntity);

      relations.push({
        id: generateId("rel"),
        sourceEntityId: entityNameToId[relation.sourceEntity],
        targetEntityId: entityNameToId[relation.targetEntity],
        sourceCardinality: relation.sourceCardinality,
        targetCardinality: relation.targetCardinality,
        label: relation.label,
      });
    }
  }

  // Apply grid layout
  const cols = Math.ceil(Math.sqrt(entities.length));
  entities.forEach((entity, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    layout[entity.id] = { x: col * 300, y: row * 250 };
  });

  return {
    version: "1.0",
    name: "Parsed ER Diagram",
    entities,
    relations,
    layout,
  };

  function finishEntity() {
    if (!currentEntityName) return;
    const id = generateId("entity");
    entityNameToId[currentEntityName] = id;
    entities.push({
      id,
      name: currentEntityName,
      attributes: currentAttributes,
    });
    currentEntityName = null;
    currentAttributes = [];
  }

  function ensureEntity(name: string) {
    if (!entityNameToId[name]) {
      const id = generateId("entity");
      entityNameToId[name] = id;
      entities.push({ id, name, attributes: [] });
    }
  }
}
