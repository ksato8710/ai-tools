"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Attribute } from "@/lib/er-schema";

export interface EntityNodeData {
  label: string;
  attributes: Attribute[];
  selected?: boolean;
  onSelect?: (id: string) => void;
  [key: string]: unknown;
}

function EntityNodeComponent({ id, data }: NodeProps) {
  const nodeData = data as unknown as EntityNodeData;
  const { label, attributes, selected, onSelect } = nodeData;

  return (
    <div
      className={`
        min-w-[200px] bg-surface rounded-[12px] border-2 transition-colors shadow-sm
        ${selected ? "border-accent-leaf shadow-md shadow-shadow" : "border-border hover:border-accent-leaf/50"}
      `}
      onClick={() => onSelect?.(id)}
    >
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-accent-leaf !border-2 !border-surface" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-accent-leaf !border-2 !border-surface" />

      {/* Entity header */}
      <div className="bg-accent-leaf text-white px-4 py-2 rounded-t-[10px] font-[family-name:var(--font-nunito)] font-bold text-sm">
        {label}
      </div>

      {/* Attributes */}
      <div className="divide-y divide-border-light">
        {attributes.map((attr) => (
          <div
            key={attr.id}
            className="px-4 py-1.5 flex items-center gap-2 text-xs"
          >
            <span className="flex items-center gap-1 flex-1 min-w-0">
              {attr.isPrimaryKey && (
                <span className="text-warning font-bold text-[10px]" title="Primary Key">PK</span>
              )}
              {attr.isForeignKey && (
                <span className="text-accent-bark font-bold text-[10px]" title="Foreign Key">FK</span>
              )}
              <span className={`truncate ${attr.isPrimaryKey ? "font-semibold" : ""}`}>
                {attr.name}
              </span>
            </span>
            <span className="text-text-muted shrink-0">
              {attr.type === "ENUM" && attr.enumValues?.length
                ? (() => {
                    const joined = attr.enumValues.join(",");
                    return joined.length > 20
                      ? `ENUM(${attr.enumValues.slice(0, 2).join(",")},...)`
                      : `ENUM(${joined})`;
                  })()
                : attr.type}
            </span>
            {!attr.isNullable && (
              <span className="text-error text-[10px] font-medium shrink-0">NN</span>
            )}
          </div>
        ))}
        {attributes.length === 0 && (
          <div className="px-4 py-2 text-xs text-text-muted italic">
            No attributes
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(EntityNodeComponent);
