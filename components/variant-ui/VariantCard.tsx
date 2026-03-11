"use client";

import { useState } from "react";
import type { Variant } from "@/lib/variant-schema";
import VariantPreview from "./VariantPreview";

interface VariantCardProps {
  variant: Variant;
  responsive: "desktop" | "mobile";
  onSelect: (id: string, selected: boolean) => void;
  onStar: (id: string, starred: boolean) => void;
  onViewCode: (variant: Variant) => void;
}

export default function VariantCard({
  variant,
  responsive,
  onSelect,
  onStar,
  onViewCode,
}: VariantCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`relative rounded-xl border-2 transition-all ${
        variant.selected
          ? "border-accent-leaf shadow-lg shadow-shadow"
          : "border-border-light hover:border-border"
      } bg-white overflow-hidden`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-light bg-cream">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-text-muted">
            #{variant.index + 1}
          </span>
          {variant.metadata.label && (
            <span className="text-sm font-medium text-text-primary truncate">
              {variant.metadata.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onStar(variant.id, !variant.starred)}
            className={`p-1.5 rounded-full transition-colors ${
              variant.starred
                ? "text-warning"
                : "text-text-muted hover:text-warning"
            }`}
            title={variant.starred ? "Unstar" : "Star"}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill={variant.starred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
              <path d="M8 1.5l2.09 4.26 4.71.69-3.4 3.32.8 4.69L8 12.26l-4.2 2.2.8-4.69-3.4-3.32 4.71-.69z" />
            </svg>
          </button>
          <button
            onClick={() => onSelect(variant.id, !variant.selected)}
            className={`p-1.5 rounded-full transition-colors ${
              variant.selected
                ? "text-accent-leaf"
                : "text-text-muted hover:text-accent-leaf"
            }`}
            title={variant.selected ? "Unselect" : "Select"}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              {variant.selected ? (
                <path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <circle cx="8" cy="8" r="6" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="pointer-events-none">
        <VariantPreview code={variant.code} format={variant.format} responsive={responsive} />
      </div>

      {/* Hover overlay */}
      {hovered && (
        <div className="absolute inset-0 top-[41px] bg-black/5 flex items-end justify-center pb-4 pointer-events-none">
          <button
            onClick={() => onViewCode(variant)}
            className="pointer-events-auto px-4 py-2 bg-white/95 backdrop-blur rounded-full text-sm font-medium text-text-primary border border-border shadow-md hover:bg-white transition-colors"
          >
            View Code
          </button>
        </div>
      )}

      {/* Tags */}
      {variant.metadata.tags && variant.metadata.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-4 py-2 border-t border-border-light">
          {variant.metadata.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs rounded-full bg-card text-text-secondary"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
