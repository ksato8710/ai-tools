export interface Attribute {
  id: string;
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNullable: boolean;
  enumValues?: string[];
}

export interface Entity {
  id: string;
  name: string;
  attributes: Attribute[];
}

export interface Relation {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  sourceCardinality: "1" | "N";
  targetCardinality: "1" | "N";
  label?: string;
}

export interface ERDiagram {
  version: "1.0";
  id?: string;
  updatedAt?: string;
  name: string;
  entities: Entity[];
  relations: Relation[];
  layout: { [entityId: string]: { x: number; y: number } };
}

export const SQL_TYPES = [
  "INT",
  "BIGINT",
  "VARCHAR",
  "TEXT",
  "BOOLEAN",
  "DATE",
  "DATETIME",
  "TIMESTAMP",
  "DECIMAL",
  "FLOAT",
  "UUID",
  "JSON",
  "ENUM",
] as const;

export function createEntity(name: string, x: number, y: number): { entity: Entity; position: { x: number; y: number } } {
  const id = `entity_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    entity: {
      id,
      name,
      attributes: [
        {
          id: `attr_${Date.now()}_id`,
          name: "id",
          type: "INT",
          isPrimaryKey: true,
          isForeignKey: false,
          isNullable: false,
        },
      ],
    },
    position: { x, y },
  };
}

export function createAttribute(name: string): Attribute {
  return {
    id: `attr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    type: "VARCHAR",
    isPrimaryKey: false,
    isForeignKey: false,
    isNullable: true,
  };
}

export function createRelation(sourceId: string, targetId: string): Relation {
  return {
    id: `rel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    sourceEntityId: sourceId,
    targetEntityId: targetId,
    sourceCardinality: "1",
    targetCardinality: "N",
  };
}

export function cardinalityLabel(source: "1" | "N", target: "1" | "N"): string {
  return `${source}:${target}`;
}
