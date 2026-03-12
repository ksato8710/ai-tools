"use client";

import { useState } from "react";
import {
  PresentationMetadata,
  OutlineSection,
} from "@/lib/presentation-schema";

interface PlanningPanelProps {
  metadata: PresentationMetadata;
  outline: OutlineSection[];
  onMetadataChange: (metadata: PresentationMetadata) => void;
  onOutlineChange: (outline: OutlineSection[]) => void;
  onSectionClick: (sectionId: string) => void;
  activeSectionId?: string;
}

export default function PlanningPanel({
  metadata,
  outline,
  onMetadataChange,
  onOutlineChange,
  onSectionClick,
  activeSectionId,
}: PlanningPanelProps) {
  const [editingField, setEditingField] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto p-5">
      {/* Metadata */}
      <section>
        <h3 className="text-xs font-bold tracking-widest uppercase text-text-muted mb-3">
          プレゼンテーション設計
        </h3>

        <EditableField
          label="タイトル"
          value={metadata.title}
          isEditing={editingField === "title"}
          onEdit={() => setEditingField("title")}
          onSave={(v) => {
            onMetadataChange({ ...metadata, title: v });
            setEditingField(null);
          }}
          onCancel={() => setEditingField(null)}
        />

        <EditableTextarea
          label="想定読者"
          value={metadata.targetAudience}
          isEditing={editingField === "audience"}
          onEdit={() => setEditingField("audience")}
          onSave={(v) => {
            onMetadataChange({ ...metadata, targetAudience: v });
            setEditingField(null);
          }}
          onCancel={() => setEditingField(null)}
        />

        <EditableTextarea
          label="目的"
          value={metadata.purpose}
          isEditing={editingField === "purpose"}
          onEdit={() => setEditingField("purpose")}
          onSave={(v) => {
            onMetadataChange({ ...metadata, purpose: v });
            setEditingField(null);
          }}
          onCancel={() => setEditingField(null)}
        />

        <div className="mt-3">
          <div className="text-xs font-semibold text-text-secondary mb-1.5">
            キーメッセージ
          </div>
          <ul className="space-y-1">
            {metadata.keyMessages.map((msg, i) => (
              <li
                key={i}
                className="text-sm text-text-primary flex items-start gap-2"
              >
                <span className="text-accent-leaf mt-0.5 shrink-0">{i + 1}.</span>
                <EditableInline
                  value={msg}
                  isEditing={editingField === `msg-${i}`}
                  onEdit={() => setEditingField(`msg-${i}`)}
                  onSave={(v) => {
                    const newMsgs = [...metadata.keyMessages];
                    newMsgs[i] = v;
                    onMetadataChange({ ...metadata, keyMessages: newMsgs });
                    setEditingField(null);
                  }}
                  onCancel={() => setEditingField(null)}
                />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Outline */}
      <section>
        <h3 className="text-xs font-bold tracking-widest uppercase text-text-muted mb-3">
          アウトライン
        </h3>
        <div className="space-y-2">
          {outline.map((sec, i) => (
            <div
              key={sec.id}
              className={`rounded-lg border p-3 transition-colors cursor-pointer ${
                activeSectionId === sec.id
                  ? "border-accent-leaf bg-accent-leaf/5"
                  : "border-border-light hover:border-border"
              }`}
              onClick={() => onSectionClick(sec.id)}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-muted w-5">
                  {i + 1}
                </span>
                <EditableInline
                  value={sec.title}
                  isEditing={editingField === `sec-title-${sec.id}`}
                  onEdit={() => setEditingField(`sec-title-${sec.id}`)}
                  onSave={(v) => {
                    const newOutline = outline.map((s) =>
                      s.id === sec.id ? { ...s, title: v } : s
                    );
                    onOutlineChange(newOutline);
                    setEditingField(null);
                  }}
                  onCancel={() => setEditingField(null)}
                  className="font-semibold text-sm"
                />
              </div>
              <ul className="ml-7 mt-1 space-y-0.5">
                {sec.points.map((pt, j) => (
                  <li
                    key={j}
                    className="text-xs text-text-secondary flex items-start gap-1.5"
                  >
                    <span className="opacity-40 mt-px">·</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
              <div className="ml-7 mt-1 text-xs text-text-muted">
                {sec.slideIds.length} slides
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// --- Inline editing primitives ---

function EditableField({
  label,
  value,
  isEditing,
  onEdit,
  onSave,
  onCancel,
}: {
  label: string;
  value: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);

  if (isEditing) {
    return (
      <div className="mb-3">
        <div className="text-xs font-semibold text-text-secondary mb-1">
          {label}
        </div>
        <input
          autoFocus
          className="w-full text-sm border border-accent-leaf rounded-md px-2.5 py-1.5 bg-white focus:outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave(draft);
            if (e.key === "Escape") onCancel();
          }}
          onBlur={() => onSave(draft)}
        />
      </div>
    );
  }

  return (
    <div className="mb-3 group" onClick={onEdit}>
      <div className="text-xs font-semibold text-text-secondary mb-0.5">
        {label}
      </div>
      <div className="text-sm text-text-primary cursor-pointer hover:bg-card rounded px-1 -mx-1 py-0.5 transition-colors">
        {value}
      </div>
    </div>
  );
}

function EditableTextarea({
  label,
  value,
  isEditing,
  onEdit,
  onSave,
  onCancel,
}: {
  label: string;
  value: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);

  if (isEditing) {
    return (
      <div className="mb-3">
        <div className="text-xs font-semibold text-text-secondary mb-1">
          {label}
        </div>
        <textarea
          autoFocus
          rows={3}
          className="w-full text-sm border border-accent-leaf rounded-md px-2.5 py-1.5 bg-white focus:outline-none resize-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
          }}
          onBlur={() => onSave(draft)}
        />
      </div>
    );
  }

  return (
    <div className="mb-3 group" onClick={onEdit}>
      <div className="text-xs font-semibold text-text-secondary mb-0.5">
        {label}
      </div>
      <div className="text-xs text-text-primary cursor-pointer hover:bg-card rounded px-1 -mx-1 py-1 transition-colors leading-relaxed">
        {value}
      </div>
    </div>
  );
}

function EditableInline({
  value,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  className = "",
}: {
  value: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (v: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);

  if (isEditing) {
    return (
      <input
        autoFocus
        className={`border-b border-accent-leaf bg-transparent focus:outline-none text-sm w-full ${className}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave(draft);
          if (e.key === "Escape") onCancel();
        }}
        onBlur={() => onSave(draft)}
      />
    );
  }

  return (
    <span
      className={`cursor-pointer hover:bg-card/50 rounded px-0.5 -mx-0.5 transition-colors ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        onEdit();
      }}
    >
      {value}
    </span>
  );
}
