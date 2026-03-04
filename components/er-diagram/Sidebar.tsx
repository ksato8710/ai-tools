"use client";

import { useState } from "react";
import type { Entity } from "@/lib/er-schema";
import Button from "@/components/ui/Button";

interface SidebarProps {
  entities: Entity[];
  selectedEntityId: string | null;
  onSelectEntity: (id: string) => void;
  onAddEntity: (name: string) => void;
  onDeleteEntity: (id: string) => void;
}

export default function Sidebar({
  entities,
  selectedEntityId,
  onSelectEntity,
  onAddEntity,
  onDeleteEntity,
}: SidebarProps) {
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    onAddEntity(name);
    setNewName("");
    setIsAdding(false);
  };

  return (
    <aside className="w-60 bg-surface border-r border-border-light flex flex-col h-full">
      <div className="p-4 border-b border-border-light flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-nunito)] font-bold text-sm text-text-primary">
          Entities
        </h2>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="w-7 h-7 rounded-full bg-accent-leaf text-white flex items-center justify-center text-lg hover:bg-accent-leaf-hover transition-colors cursor-pointer"
          title="Add entity"
        >
          +
        </button>
      </div>

      {isAdding && (
        <div className="p-3 border-b border-border-light bg-card">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Entity name"
            className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:border-accent-leaf"
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setNewName(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {entities.length === 0 ? (
          <div className="p-4 text-sm text-text-muted text-center">
            No entities yet.
            <br />
            Click + to add one.
          </div>
        ) : (
          entities.map((entity) => (
            <div
              key={entity.id}
              className={`
                group flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors border-b border-border-light
                ${selectedEntityId === entity.id ? "bg-accent-leaf/10 border-l-2 border-l-accent-leaf" : "hover:bg-card"}
              `}
              onClick={() => onSelectEntity(entity.id)}
            >
              <div>
                <div className="text-sm font-medium text-text-primary">{entity.name}</div>
                <div className="text-[11px] text-text-muted">
                  {entity.attributes.length} attribute{entity.attributes.length !== 1 ? "s" : ""}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteEntity(entity.id); }}
                className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-error transition-all text-xs cursor-pointer"
                title="Delete entity"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
