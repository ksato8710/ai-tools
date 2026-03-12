"use client";

import { useState } from "react";
import { Slide, SlideLayout } from "@/lib/presentation-schema";

interface SlideEditorPanelProps {
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
  onSlideChange: (slide: Slide) => void;
}

const layoutOptions: { value: SlideLayout; label: string }[] = [
  { value: "title", label: "Title" },
  { value: "section-divider", label: "Section Divider" },
  { value: "bullets", label: "Bullets" },
  { value: "two-column", label: "Two Column" },
  { value: "stats", label: "Stats" },
  { value: "quote", label: "Quote" },
  { value: "image-text", label: "Image + Text" },
  { value: "cta", label: "CTA" },
];

export default function SlideEditorPanel({
  slide,
  slideIndex,
  totalSlides,
  onSlideChange,
}: SlideEditorPanelProps) {
  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold tracking-widest uppercase text-text-muted">
          スライド編集
        </h3>
        <span className="text-xs text-text-muted">
          {slideIndex + 1} / {totalSlides}
        </span>
      </div>

      {/* Layout selector */}
      <div>
        <label className="text-xs font-semibold text-text-secondary mb-1 block">
          レイアウト
        </label>
        <select
          className="w-full text-sm border border-border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:border-accent-leaf"
          value={slide.layout}
          onChange={(e) =>
            onSlideChange({ ...slide, layout: e.target.value as SlideLayout })
          }
        >
          {layoutOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Title */}
      <FieldInput
        label="タイトル"
        value={slide.title}
        onChange={(v) => onSlideChange({ ...slide, title: v })}
      />

      {/* Subtitle */}
      <FieldInput
        label="サブタイトル"
        value={slide.subtitle || ""}
        onChange={(v) => onSlideChange({ ...slide, subtitle: v || undefined })}
      />

      {/* Body - JSON editor for now, can be replaced with structured editors */}
      <div>
        <label className="text-xs font-semibold text-text-secondary mb-1 block">
          コンテンツ (JSON)
        </label>
        <JsonEditor
          value={slide.body}
          onChange={(body) => onSlideChange({ ...slide, body })}
        />
      </div>

      {/* Speaker notes */}
      <div>
        <label className="text-xs font-semibold text-text-secondary mb-1 block">
          スピーカーノート
        </label>
        <textarea
          rows={3}
          className="w-full text-sm border border-border rounded-md px-2.5 py-1.5 bg-white focus:outline-none focus:border-accent-leaf resize-none"
          value={slide.notes || ""}
          onChange={(e) =>
            onSlideChange({ ...slide, notes: e.target.value || undefined })
          }
          placeholder="プレゼン時のメモを入力..."
        />
      </div>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-text-secondary mb-1 block">
        {label}
      </label>
      <input
        className="w-full text-sm border border-border rounded-md px-2.5 py-1.5 bg-white focus:outline-none focus:border-accent-leaf"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function JsonEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (v: Slide["body"]) => void;
}) {
  const [text, setText] = useState(() =>
    value ? JSON.stringify(value, null, 2) : ""
  );
  const [error, setError] = useState<string | null>(null);

  const handleBlur = () => {
    if (!text.trim()) {
      onChange(undefined);
      setError(null);
      return;
    }
    try {
      const parsed = JSON.parse(text);
      onChange(parsed);
      setError(null);
    } catch {
      setError("Invalid JSON");
    }
  };

  return (
    <div>
      <textarea
        rows={10}
        className={`w-full text-xs font-mono border rounded-md px-2.5 py-2 bg-white focus:outline-none resize-none ${
          error ? "border-error" : "border-border focus:border-accent-leaf"
        }`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        spellCheck={false}
      />
      {error && <div className="text-xs text-error mt-1">{error}</div>}
    </div>
  );
}
