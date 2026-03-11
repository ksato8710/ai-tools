"use client";

import type { Variant } from "@/lib/variant-schema";
import VariantCard from "./VariantCard";

interface VariantGridProps {
  variants: Variant[];
  columns: 1 | 2 | 3;
  responsive: "desktop" | "mobile";
  onSelect: (id: string, selected: boolean) => void;
  onStar: (id: string, starred: boolean) => void;
  onViewCode: (variant: Variant) => void;
}

export default function VariantGrid({
  variants,
  columns,
  responsive,
  onSelect,
  onStar,
  onViewCode,
}: VariantGridProps) {
  if (variants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-text-muted">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4 opacity-40">
          <rect x="6" y="6" width="16" height="16" rx="2" />
          <rect x="26" y="6" width="16" height="16" rx="2" />
          <rect x="6" y="26" width="16" height="16" rx="2" />
          <rect x="26" y="26" width="16" height="16" rx="2" />
        </svg>
        <p className="text-lg font-medium mb-1">Waiting for variants...</p>
        <p className="text-sm">AI agent will push UI variations here</p>
      </div>
    );
  }

  const gridCols =
    columns === 1
      ? "grid-cols-1"
      : columns === 2
      ? "grid-cols-1 md:grid-cols-2"
      : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

  return (
    <div className={`grid ${gridCols} gap-6 p-6`}>
      {variants.map((variant) => (
        <VariantCard
          key={variant.id}
          variant={variant}
          responsive={responsive}
          onSelect={onSelect}
          onStar={onStar}
          onViewCode={onViewCode}
        />
      ))}
    </div>
  );
}
