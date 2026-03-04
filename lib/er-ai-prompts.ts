import type { ERDiagram } from "./er-schema";

export function generateERPrompt(userInput: string): string {
  return `You are a database design expert. Based on the following description, generate an ER diagram in JSON format.

User's request: "${userInput}"

Return ONLY valid JSON matching this exact structure (no markdown, no explanation):
{
  "entities": [
    {
      "id": "entity_<unique>",
      "name": "EntityName",
      "attributes": [
        {
          "id": "attr_<unique>",
          "name": "column_name",
          "type": "INT|VARCHAR|TEXT|BOOLEAN|DATE|DATETIME|TIMESTAMP|DECIMAL|FLOAT|UUID|JSON",
          "isPrimaryKey": true/false,
          "isForeignKey": true/false,
          "isNullable": true/false
        }
      ]
    }
  ],
  "relations": [
    {
      "id": "rel_<unique>",
      "sourceEntityId": "entity_<id>",
      "targetEntityId": "entity_<id>",
      "sourceCardinality": "1"|"N",
      "targetCardinality": "1"|"N",
      "label": "optional relationship description"
    }
  ]
}

Guidelines:
- Every entity must have a primary key (usually "id" with INT or UUID type)
- Use foreign keys to reference related entities
- Use appropriate SQL data types
- Include created_at and updated_at TIMESTAMP columns where appropriate
- Use snake_case for column names
- Entity names should be PascalCase
- Generate realistic, practical database schemas`;
}

export function suggestEntitiesPrompt(diagram: ERDiagram): string {
  const entityNames = diagram.entities.map((e) => e.name).join(", ");
  return `You are a database design expert. Given an ER diagram with these entities: [${entityNames}], suggest additional entities that might be missing.

Current entities and their attributes:
${diagram.entities.map((e) => `- ${e.name}: ${e.attributes.map((a) => a.name).join(", ")}`).join("\n")}

Return ONLY valid JSON array of suggested entities (same format as above, no markdown):
[
  {
    "id": "entity_<unique>",
    "name": "EntityName",
    "attributes": [...],
    "reason": "Why this entity is needed"
  }
]

Suggest 2-4 entities that would complement the existing design.`;
}

export function suggestAttributesPrompt(entityName: string, existingAttributes: string[]): string {
  return `You are a database design expert. For an entity named "${entityName}" that already has these columns: [${existingAttributes.join(", ")}], suggest additional columns.

Return ONLY valid JSON array (no markdown):
[
  {
    "id": "attr_<unique>",
    "name": "column_name",
    "type": "INT|VARCHAR|TEXT|BOOLEAN|DATE|DATETIME|TIMESTAMP|DECIMAL|FLOAT|UUID|JSON",
    "isPrimaryKey": false,
    "isForeignKey": false,
    "isNullable": true/false,
    "reason": "Why this attribute is useful"
  }
]

Suggest 3-6 commonly needed attributes for this type of entity.`;
}

export function normalizationCheckPrompt(diagram: ERDiagram): string {
  return `You are a database normalization expert. Analyze this ER diagram for normalization issues:

Entities:
${diagram.entities.map((e) => `${e.name}: ${e.attributes.map((a) => `${a.name}(${a.type}${a.isPrimaryKey ? ",PK" : ""}${a.isForeignKey ? ",FK" : ""})`).join(", ")}`).join("\n")}

Relations:
${diagram.relations.map((r) => {
  const src = diagram.entities.find((e) => e.id === r.sourceEntityId)?.name ?? r.sourceEntityId;
  const tgt = diagram.entities.find((e) => e.id === r.targetEntityId)?.name ?? r.targetEntityId;
  return `${src} ${r.sourceCardinality}:${r.targetCardinality} ${tgt}`;
}).join("\n")}

Return ONLY valid JSON (no markdown):
{
  "currentLevel": "1NF|2NF|3NF|BCNF",
  "issues": [
    {
      "entity": "EntityName",
      "issue": "Description of normalization issue",
      "suggestion": "How to fix it",
      "severity": "high|medium|low"
    }
  ],
  "overallAssessment": "Brief summary of the design quality"
}`;
}
