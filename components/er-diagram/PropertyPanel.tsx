"use client";

import { useState } from "react";
import type { Entity, Attribute } from "@/lib/er-schema";
import { SQL_TYPES, createAttribute } from "@/lib/er-schema";
import Button from "@/components/ui/Button";

interface PropertyPanelProps {
  entity: Entity | null;
  onUpdateEntity: (entity: Entity) => void;
  onClose: () => void;
}

export default function PropertyPanel({ entity, onUpdateEntity, onClose }: PropertyPanelProps) {
  const [newAttrName, setNewAttrName] = useState("");

  if (!entity) return null;

  const handleEntityNameChange = (name: string) => {
    onUpdateEntity({ ...entity, name });
  };

  const handleAddAttribute = () => {
    const name = newAttrName.trim();
    if (!name) return;
    onUpdateEntity({
      ...entity,
      attributes: [...entity.attributes, createAttribute(name)],
    });
    setNewAttrName("");
  };

  const handleUpdateAttribute = (attrId: string, updates: Partial<Attribute>) => {
    const merged = { ...updates };
    // Clear enumValues when switching away from ENUM type
    if (merged.type && merged.type !== "ENUM") {
      merged.enumValues = undefined;
    }
    // Initialize enumValues when switching to ENUM type
    if (merged.type === "ENUM") {
      const attr = entity.attributes.find((a) => a.id === attrId);
      if (!attr?.enumValues) {
        merged.enumValues = [];
      }
    }
    onUpdateEntity({
      ...entity,
      attributes: entity.attributes.map((a) =>
        a.id === attrId ? { ...a, ...merged } : a
      ),
    });
  };

  const handleAddEnumValue = (attrId: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const attr = entity.attributes.find((a) => a.id === attrId);
    if (!attr || attr.enumValues?.includes(trimmed)) return;
    handleUpdateAttribute(attrId, {
      enumValues: [...(attr.enumValues ?? []), trimmed],
    });
  };

  const handleRemoveEnumValue = (attrId: string, value: string) => {
    const attr = entity.attributes.find((a) => a.id === attrId);
    if (!attr) return;
    handleUpdateAttribute(attrId, {
      enumValues: (attr.enumValues ?? []).filter((v) => v !== value),
    });
  };

  const handleDeleteAttribute = (attrId: string) => {
    onUpdateEntity({
      ...entity,
      attributes: entity.attributes.filter((a) => a.id !== attrId),
    });
  };

  return (
    <aside className="w-72 bg-surface border-l border-border-light flex flex-col h-full">
      <div className="p-4 border-b border-border-light flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-nunito)] font-bold text-sm text-text-primary">
          Properties
        </h2>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-primary text-sm cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Entity name */}
        <div className="p-4 border-b border-border-light">
          <label className="block text-[11px] font-medium text-text-muted mb-1 uppercase tracking-wide">
            Entity Name
          </label>
          <input
            type="text"
            value={entity.name}
            onChange={(e) => handleEntityNameChange(e.target.value)}
            className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-cream focus:outline-none focus:border-accent-leaf"
          />
        </div>

        {/* Attributes */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-[11px] font-medium text-text-muted uppercase tracking-wide">
              Attributes
            </label>
          </div>

          <div className="space-y-2 mb-4">
            {entity.attributes.map((attr) => (
              <div
                key={attr.id}
                className="bg-card rounded-lg p-3 border border-border-light"
              >
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={attr.name}
                    onChange={(e) => handleUpdateAttribute(attr.id, { name: e.target.value })}
                    className="flex-1 px-2 py-1 text-xs rounded border border-border bg-surface focus:outline-none focus:border-accent-leaf"
                  />
                  <button
                    onClick={() => handleDeleteAttribute(attr.id)}
                    className="text-text-muted hover:text-error text-xs cursor-pointer shrink-0"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <select
                    value={attr.type}
                    onChange={(e) => handleUpdateAttribute(attr.id, { type: e.target.value })}
                    className="flex-1 px-2 py-1 text-xs rounded border border-border bg-surface focus:outline-none focus:border-accent-leaf cursor-pointer"
                  >
                    {SQL_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {attr.type === "ENUM" && (
                  <div className="mb-2">
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {(attr.enumValues ?? []).map((val) => (
                        <span
                          key={val}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-accent-leaf/10 text-accent-leaf rounded-md border border-accent-leaf/20"
                        >
                          {val}
                          <button
                            onClick={() => handleRemoveEnumValue(attr.id, val)}
                            className="text-accent-leaf/60 hover:text-error ml-0.5 cursor-pointer"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                      {(attr.enumValues ?? []).length === 0 && (
                        <span className="text-[10px] text-text-muted italic">No values</span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Add enum value + Enter"
                      className="w-full px-2 py-1 text-xs rounded border border-border bg-surface focus:outline-none focus:border-accent-leaf"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleAddEnumValue(attr.id, (e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }}
                    />
                  </div>
                )}

                <div className="flex gap-3 text-[11px]">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={attr.isPrimaryKey}
                      onChange={(e) => handleUpdateAttribute(attr.id, { isPrimaryKey: e.target.checked })}
                      className="accent-accent-leaf"
                    />
                    PK
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={attr.isForeignKey}
                      onChange={(e) => handleUpdateAttribute(attr.id, { isForeignKey: e.target.checked })}
                      className="accent-accent-leaf"
                    />
                    FK
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!attr.isNullable}
                      onChange={(e) => handleUpdateAttribute(attr.id, { isNullable: !e.target.checked })}
                      className="accent-accent-leaf"
                    />
                    NOT NULL
                  </label>
                </div>
              </div>
            ))}
          </div>

          {/* Add attribute */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newAttrName}
              onChange={(e) => setNewAttrName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddAttribute()}
              placeholder="New attribute"
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-border bg-cream focus:outline-none focus:border-accent-leaf"
            />
            <Button size="sm" onClick={handleAddAttribute} disabled={!newAttrName.trim()}>
              Add
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
