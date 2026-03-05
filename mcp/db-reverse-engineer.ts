import pg from "pg";
import type { Attribute, Entity, Relation, ERDiagram } from "../lib/er-schema.js";

const { Client } = pg;

const TYPE_MAP: Record<string, string> = {
  uuid: "UUID",
  text: "TEXT",
  "character varying": "VARCHAR",
  character: "VARCHAR",
  integer: "INT",
  smallint: "INT",
  bigint: "BIGINT",
  boolean: "BOOLEAN",
  date: "DATE",
  "timestamp without time zone": "TIMESTAMP",
  "timestamp with time zone": "TIMESTAMP",
  "numeric": "DECIMAL",
  "decimal": "DECIMAL",
  real: "FLOAT",
  "double precision": "FLOAT",
  json: "JSON",
  jsonb: "JSON",
  serial: "INT",
  bigserial: "BIGINT",
  bytea: "TEXT",
  "time without time zone": "TIMESTAMP",
  "time with time zone": "TIMESTAMP",
  interval: "TEXT",
  inet: "TEXT",
  cidr: "TEXT",
  macaddr: "TEXT",
  tsvector: "TEXT",
  tsquery: "TEXT",
  point: "TEXT",
  line: "TEXT",
  box: "TEXT",
  circle: "TEXT",
  polygon: "TEXT",
  "ARRAY": "JSON",
};

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function mapPgType(dataType: string, udtName: string): string {
  if (dataType === "ARRAY") return "JSON";
  if (dataType === "USER-DEFINED") return "ENUM";
  return TYPE_MAP[dataType] ?? "TEXT";
}

interface ColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
  ordinal_position: number;
}

interface ConstraintRow {
  table_name: string;
  column_name: string;
  constraint_type: string;
}

interface ForeignKeyRow {
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
  constraint_name: string;
}

interface EnumRow {
  typname: string;
  enumlabel: string;
}

function nodeHeight(entity: Entity): number {
  return 40 + entity.attributes.length * 28 + 20;
}

const NODE_WIDTH = 280;
const X_GAP = 60;
const Y_GAP = 60;
const X_STEP = NODE_WIDTH + X_GAP; // 340px

/**
 * Hierarchical layout: topological sort by FK references,
 * median-based intra-layer ordering, dynamic Y spacing.
 */
function hierarchicalLayout(
  entities: Entity[],
  relations: Relation[]
): Record<string, { x: number; y: number }> {
  const idToEntity = new Map<string, Entity>();
  for (const e of entities) idToEntity.set(e.id, e);

  // Build adjacency for median ordering
  const children = new Map<string, Set<string>>(); // parent -> children
  const parents = new Map<string, Set<string>>();   // child -> parents
  const connected = new Set<string>();

  // Non-self-referencing edges for layer assignment
  const edges: { parent: string; child: string }[] = [];

  for (const r of relations) {
    const parent = r.sourceEntityId; // "1" side (referenced)
    const child = r.targetEntityId;  // "N" side (FK holder)

    if (!children.has(parent)) children.set(parent, new Set());
    children.get(parent)!.add(child);

    if (!parents.has(child)) parents.set(child, new Set());
    parents.get(child)!.add(parent);

    connected.add(parent);
    connected.add(child);

    // Skip self-references for layer assignment
    if (parent !== child) {
      edges.push({ parent, child });
    }
  }

  const connectedEntities = entities.filter((e) => connected.has(e.id));
  const isolatedEntities = entities.filter((e) => !connected.has(e.id));

  // Layer assignment via iterative relaxation (longest-path)
  // Ensures child is always at least 1 layer below parent
  const layerOf = new Map<string, number>();
  for (const e of connectedEntities) layerOf.set(e.id, 0);

  let changed = true;
  let iterations = 0;
  while (changed && iterations < 100) {
    changed = false;
    iterations++;
    for (const { parent, child } of edges) {
      const pLayer = layerOf.get(parent) ?? 0;
      const cLayer = layerOf.get(child) ?? 0;
      if (cLayer <= pLayer) {
        layerOf.set(child, pLayer + 1);
        changed = true;
      }
    }
  }

  // Group by layer
  const layers = new Map<number, string[]>();
  for (const [id, layer] of layerOf) {
    if (!layers.has(layer)) layers.set(layer, []);
    layers.get(layer)!.push(id);
  }

  const sortedLayerIndices = [...layers.keys()].sort((a, b) => a - b);

  // Median-based intra-layer ordering to reduce edge crossings
  // For each node, compute median position of its connected nodes in adjacent layers
  for (let pass = 0; pass < 4; pass++) {
    for (const li of sortedLayerIndices) {
      const nodesInLayer = layers.get(li)!;
      const prevLayer = layers.get(li - 1);

      if (!prevLayer || prevLayer.length === 0) continue;

      // Build position map for previous layer
      const prevPos = new Map<string, number>();
      prevLayer.forEach((id, idx) => prevPos.set(id, idx));

      // For each node in current layer, find median of parent positions
      const medians: { id: string; median: number }[] = nodesInLayer.map(
        (id) => {
          const p = parents.get(id);
          if (!p || p.size === 0) return { id, median: Infinity };
          const positions = [...p]
            .map((pid) => prevPos.get(pid))
            .filter((v): v is number => v !== undefined)
            .sort((a, b) => a - b);
          if (positions.length === 0) return { id, median: Infinity };
          const mid = Math.floor(positions.length / 2);
          return { id, median: positions[mid] };
        }
      );

      medians.sort((a, b) => a.median - b.median);
      layers.set(
        li,
        medians.map((m) => m.id)
      );
    }
  }

  // Compute positions with dynamic Y spacing
  const layout: Record<string, { x: number; y: number }> = {};
  let currentY = 0;

  for (const li of sortedLayerIndices) {
    const nodesInLayer = layers.get(li)!;
    // Find max height in this layer
    let maxH = 0;
    for (const id of nodesInLayer) {
      const entity = idToEntity.get(id);
      if (entity) {
        const h = nodeHeight(entity);
        if (h > maxH) maxH = h;
      }
    }

    // Center the layer horizontally
    for (let i = 0; i < nodesInLayer.length; i++) {
      layout[nodesInLayer[i]] = { x: i * X_STEP, y: currentY };
    }

    currentY += maxH + Y_GAP;
  }

  // Place isolated tables in a grid at the bottom
  if (isolatedEntities.length > 0) {
    currentY += 40; // extra gap before isolated section
    const isoCols = Math.max(1, Math.ceil(Math.sqrt(isolatedEntities.length)));
    let maxRowH = 0;
    for (let i = 0; i < isolatedEntities.length; i++) {
      const col = i % isoCols;
      const row = Math.floor(i / isoCols);
      if (col === 0 && i > 0) {
        currentY += maxRowH + Y_GAP;
        maxRowH = 0;
      }
      layout[isolatedEntities[i].id] = { x: col * X_STEP, y: currentY };
      const h = nodeHeight(isolatedEntities[i]);
      if (h > maxRowH) maxRowH = h;
    }
  }

  return layout;
}

export async function reverseEngineerPostgres(
  connectionString: string,
  options?: { schema?: string; excludeTables?: string[] }
): Promise<ERDiagram> {
  const schema = options?.schema ?? "public";
  const excludeTables = options?.excludeTables ?? [];

  const client = new Client({ connectionString });
  await client.connect();

  try {
    // 1. Get all tables
    const tablesResult = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [schema]
    );

    const tableNames = tablesResult.rows
      .map((r) => r.table_name)
      .filter((t) => !excludeTables.includes(t));

    if (tableNames.length === 0) {
      return {
        version: "1.0",
        name: "Empty Schema",
        entities: [],
        relations: [],
        layout: {},
      };
    }

    // 2. Get all columns
    const columnsResult = await client.query<ColumnRow>(
      `SELECT table_name, column_name, data_type, udt_name, is_nullable, ordinal_position
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = ANY($2)
       ORDER BY table_name, ordinal_position`,
      [schema, tableNames]
    );

    // 3. Get PK / UNIQUE constraints
    const constraintsResult = await client.query<ConstraintRow>(
      `SELECT tc.table_name, kcu.column_name, tc.constraint_type
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = $1
         AND tc.table_name = ANY($2)
         AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')`,
      [schema, tableNames]
    );

    // 4. Get foreign keys
    const fkResult = await client.query<ForeignKeyRow>(
      `SELECT
         kcu.table_name AS source_table,
         kcu.column_name AS source_column,
         ccu.table_name AS target_table,
         ccu.column_name AS target_column,
         tc.constraint_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON tc.constraint_name = ccu.constraint_name
         AND tc.table_schema = ccu.table_schema
       WHERE tc.table_schema = $1
         AND tc.table_name = ANY($2)
         AND tc.constraint_type = 'FOREIGN KEY'`,
      [schema, tableNames]
    );

    // 5. Get ENUM values
    const enumResult = await client.query<EnumRow>(
      `SELECT t.typname, e.enumlabel
       FROM pg_type t
       JOIN pg_enum e ON t.oid = e.enumtypid
       JOIN pg_namespace n ON t.typnamespace = n.oid
       WHERE n.nspname = $1
       ORDER BY t.typname, e.enumsortorder`,
      [schema]
    );

    // Build enum map: typname -> values[]
    const enumMap: Record<string, string[]> = {};
    for (const row of enumResult.rows) {
      if (!enumMap[row.typname]) enumMap[row.typname] = [];
      enumMap[row.typname].push(row.enumlabel);
    }

    // Build constraint lookup: "table.column" -> constraint_type[]
    const constraintMap: Record<string, Set<string>> = {};
    for (const row of constraintsResult.rows) {
      const key = `${row.table_name}.${row.column_name}`;
      if (!constraintMap[key]) constraintMap[key] = new Set();
      constraintMap[key].add(row.constraint_type);
    }

    // Build FK column set for isForeignKey
    const fkColumnSet = new Set<string>();
    for (const row of fkResult.rows) {
      fkColumnSet.add(`${row.source_table}.${row.source_column}`);
    }

    // Build entities
    const entityNameToId: Record<string, string> = {};
    const entities: Entity[] = [];

    // Group columns by table
    const columnsByTable: Record<string, ColumnRow[]> = {};
    for (const col of columnsResult.rows) {
      if (!columnsByTable[col.table_name]) columnsByTable[col.table_name] = [];
      columnsByTable[col.table_name].push(col);
    }

    for (const tableName of tableNames) {
      const id = generateId("entity");
      entityNameToId[tableName] = id;

      const columns = columnsByTable[tableName] ?? [];
      const attributes: Attribute[] = columns.map((col) => {
        const key = `${col.table_name}.${col.column_name}`;
        const constraints = constraintMap[key];
        const isPrimaryKey = constraints?.has("PRIMARY KEY") ?? false;
        const isForeignKey = fkColumnSet.has(key);
        const mappedType = mapPgType(col.data_type, col.udt_name);
        const enumValues =
          mappedType === "ENUM" ? enumMap[col.udt_name] : undefined;

        return {
          id: generateId("attr"),
          name: col.column_name,
          type: mappedType,
          isPrimaryKey,
          isForeignKey,
          isNullable: col.is_nullable === "YES" && !isPrimaryKey,
          enumValues,
        };
      });

      entities.push({ id, name: tableName, attributes });
    }

    // Build relations from FK constraints (deduplicate by constraint_name)
    const seenConstraints = new Set<string>();
    const relations: Relation[] = [];

    for (const fk of fkResult.rows) {
      if (seenConstraints.has(fk.constraint_name)) continue;
      seenConstraints.add(fk.constraint_name);

      const sourceId = entityNameToId[fk.source_table];
      const targetId = entityNameToId[fk.target_table];
      if (!sourceId || !targetId) continue;

      relations.push({
        id: generateId("rel"),
        sourceEntityId: targetId, // referenced table = "1" side
        targetEntityId: sourceId, // FK table = "N" side
        sourceCardinality: "1",
        targetCardinality: "N",
        label: fk.source_column,
      });
    }

    // Hierarchical layout based on FK reference graph
    const layout = hierarchicalLayout(entities, relations);

    return {
      version: "1.0",
      name: "Reverse Engineered Schema",
      entities,
      relations,
      layout,
    };
  } finally {
    await client.end();
  }
}
