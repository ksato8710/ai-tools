"use client";

import type { Entity } from "@/lib/er-schema";

interface EnumListPanelProps {
  entities: Entity[];
  onUpdateEntity: (entity: Entity) => void;
  onClose: () => void;
}

export default function EnumListPanel({ entities, onUpdateEntity, onClose }: EnumListPanelProps) {
  const enumAttrs = entities.flatMap((entity) =>
    entity.attributes
      .filter((attr) => attr.type === "ENUM")
      .map((attr) => ({ entity, attr }))
  );

  const handleAddValue = (entityId: string, attrId: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const entity = entities.find((e) => e.id === entityId);
    if (!entity) return;
    const attr = entity.attributes.find((a) => a.id === attrId);
    if (!attr || attr.enumValues?.includes(trimmed)) return;
    onUpdateEntity({
      ...entity,
      attributes: entity.attributes.map((a) =>
        a.id === attrId ? { ...a, enumValues: [...(a.enumValues ?? []), trimmed] } : a
      ),
    });
  };

  const handleRemoveValue = (entityId: string, attrId: string, value: string) => {
    const entity = entities.find((e) => e.id === entityId);
    if (!entity) return;
    onUpdateEntity({
      ...entity,
      attributes: entity.attributes.map((a) =>
        a.id === attrId ? { ...a, enumValues: (a.enumValues ?? []).filter((v) => v !== value) } : a
      ),
    });
  };

  return (
    <aside className="w-80 bg-surface border-l border-border-light flex flex-col h-full">
      <div className="p-4 border-b border-border-light flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-nunito)] font-bold text-sm text-text-primary">
          Enum Types
        </h2>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-primary text-sm cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {enumAttrs.length === 0 ? (
          <p className="text-xs text-text-muted italic text-center mt-8">
            No ENUM attributes in this diagram.
          </p>
        ) : (
          <div className="space-y-4">
            {enumAttrs.map(({ entity, attr }) => (
              <div key={`${entity.id}-${attr.id}`} className="bg-card rounded-lg p-3 border border-border-light">
                <div className="text-xs font-semibold text-text-primary mb-2">
                  <span className="text-accent-leaf">{entity.name}</span>
                  <span className="text-text-muted">.{attr.name}</span>
                </div>

                <div className="flex flex-wrap gap-1 mb-2">
                  {(attr.enumValues ?? []).map((val) => (
                    <span
                      key={val}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-accent-leaf/10 text-accent-leaf rounded-md border border-accent-leaf/20"
                    >
                      {val}
                      <button
                        onClick={() => handleRemoveValue(entity.id, attr.id, val)}
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
                  placeholder="Add value + Enter"
                  className="w-full px-2 py-1 text-xs rounded border border-border bg-surface focus:outline-none focus:border-accent-leaf"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddValue(entity.id, attr.id, (e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
