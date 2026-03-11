"use client";

import { useState } from "react";
import type { Variant } from "@/lib/variant-schema";

interface VariantCodePanelProps {
  variant: Variant;
  onClose: () => void;
}

export default function VariantCodePanel({ variant, onClose }: VariantCodePanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(variant.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-2xl bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light">
          <div>
            <h3 className="font-[family-name:var(--font-nunito)] font-bold text-text-primary">
              #{variant.index + 1} {variant.metadata.label || "Variant"}
            </h3>
            <span className="text-xs text-text-muted uppercase">{variant.format}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 text-sm rounded-full border border-border text-text-secondary hover:bg-card transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-text-muted hover:text-text-primary hover:bg-card transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Code */}
        <div className="flex-1 overflow-auto p-6">
          <pre className="text-sm font-mono text-text-primary whitespace-pre-wrap break-words leading-relaxed">
            <code>{variant.code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
