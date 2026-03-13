"use client";

import { useState, useCallback, useRef } from "react";
import {
  PresentationMetadata,
  OutlineSection,
} from "@/lib/presentation-schema";

interface PlanningPanelProps {
  metadata: PresentationMetadata;
  outline: OutlineSection[];
  sessionId?: string;
  onMetadataChange: (metadata: PresentationMetadata) => void;
  onOutlineChange: (outline: OutlineSection[]) => void;
  onSectionClick: (sectionId: string) => void;
  onDataUpdated?: () => void;
  activeSectionId?: string;
}

type AIField = "targetAudience" | "purpose" | "keyMessages" | "outline";
type AIStatus = "idle" | "input" | "running" | "done" | "error";

interface AIState {
  field: AIField | null;
  status: AIStatus;
  instruction: string;
  progress: string;
  thinking: string;
  error: string;
  logPath: string;
  log: string[];
}

const initialAIState: AIState = {
  field: null,
  status: "idle",
  instruction: "",
  progress: "",
  thinking: "",
  error: "",
  logPath: "",
  log: [],
};

export default function PlanningPanel({
  metadata,
  outline,
  sessionId,
  onMetadataChange,
  onOutlineChange,
  onSectionClick,
  onDataUpdated,
  activeSectionId,
}: PlanningPanelProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [ai, setAI] = useState<AIState>(initialAIState);
  const abortRef = useRef<AbortController | null>(null);

  const openAI = useCallback((field: AIField) => {
    setAI({
      ...initialAIState,
      field,
      status: "input",
    });
  }, []);

  const cancelAI = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setAI(initialAIState);
  }, []);

  const executeAI = useCallback(async () => {
    if (!sessionId || !ai.field || !ai.instruction.trim()) return;

    const abort = new AbortController();
    abortRef.current = abort;

    setAI((prev) => ({
      ...prev,
      status: "running",
      progress: "接続中...",
      log: [],
      error: "",
    }));

    try {
      const res = await fetch(`/api/presentation/${sessionId}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field: ai.field,
          instruction: ai.instruction,
          context: {},
        }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        setAI((prev) => ({
          ...prev,
          status: "error",
          error: (body as Record<string, string>).error || `HTTP ${res.status}`,
        }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7);
          } else if (line.startsWith("data: ") && eventType) {
            try {
              const payload = JSON.parse(line.slice(6));
              handleEvent(eventType, payload);
            } catch {
              // skip
            }
            eventType = "";
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setAI((prev) => ({
        ...prev,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      }));
    }

    function handleEvent(event: string, payload: Record<string, unknown>) {
      const ts = new Date().toLocaleTimeString("ja-JP", { hour12: false });

      switch (event) {
        case "status": {
          const msg = payload.message as string;
          const logPath = payload.logPath as string | undefined;
          setAI((prev) => ({
            ...prev,
            progress: msg,
            ...(logPath ? { logPath } : {}),
            log: [...prev.log, `${ts} ${msg}`],
          }));
          break;
        }
        case "thinking": {
          const text = payload.text as string;
          setAI((prev) => ({
            ...prev,
            thinking: text,
            progress: "思考中...",
            log: [...prev.log, `${ts} [thinking] ${text.slice(0, 80)}`],
          }));
          break;
        }
        case "text": {
          setAI((prev) => ({
            ...prev,
            progress: "生成中...",
          }));
          break;
        }
        case "done": {
          setAI((prev) => ({
            ...prev,
            status: "done",
            progress: payload.message as string,
            log: [...prev.log, `${ts} [done] ${payload.message}`],
          }));
          onDataUpdated?.();
          break;
        }
        case "error": {
          setAI((prev) => ({
            ...prev,
            status: "error",
            error: payload.message as string,
            log: [...prev.log, `${ts} [error] ${payload.message}`],
          }));
          break;
        }
      }
    }
  }, [sessionId, ai.field, ai.instruction, onDataUpdated]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* AI Refine overlay */}
      {ai.status !== "idle" && (
        <AIRefineOverlay
          ai={ai}
          setAI={setAI}
          onExecute={executeAI}
          onCancel={cancelAI}
        />
      )}

      {/* Normal planning panel */}
      {ai.status === "idle" && (
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
              showAI={!!sessionId}
              onAI={() => openAI("targetAudience")}
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
              showAI={!!sessionId}
              onAI={() => openAI("purpose")}
            />

            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-semibold text-text-secondary">
                  キーメッセージ
                </div>
                {sessionId && (
                  <AIButton onClick={() => openAI("keyMessages")} />
                )}
              </div>
              <ul className="space-y-1">
                {metadata.keyMessages.map((msg, i) => (
                  <li
                    key={i}
                    className="text-sm text-text-primary flex items-start gap-2"
                  >
                    <span className="text-accent-leaf mt-0.5 shrink-0">
                      {i + 1}.
                    </span>
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
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold tracking-widest uppercase text-text-muted">
                アウトライン
              </h3>
              {sessionId && (
                <AIButton onClick={() => openAI("outline")} />
              )}
            </div>
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
      )}
    </div>
  );
}

// --- AI Refine Overlay ---

const FIELD_LABELS: Record<AIField, string> = {
  targetAudience: "想定読者",
  purpose: "目的",
  keyMessages: "キーメッセージ",
  outline: "アウトライン",
};

const FIELD_PLACEHOLDERS: Record<AIField, string> = {
  targetAudience:
    "例: もっと具体的に、IT企業の経営層向けに絞り込んでください",
  purpose:
    "例: 「パートナーシップ提案」の側面をもっと強調してください",
  keyMessages:
    "例: 5つに増やして、ROIに関するメッセージを追加してください",
  outline:
    "例: 導入部分をもう少し厚くして、事例セクションを追加してください",
};

function AIRefineOverlay({
  ai,
  setAI,
  onExecute,
  onCancel,
}: {
  ai: AIState;
  setAI: React.Dispatch<React.SetStateAction<AIState>>;
  onExecute: () => void;
  onCancel: () => void;
}) {
  const fieldLabel = ai.field ? FIELD_LABELS[ai.field] : "";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-light">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-accent-leaf/10 flex items-center justify-center">
              <svg
                width="11"
                height="11"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-accent-leaf"
              >
                <path
                  d="M10 6l-4-4v2.5C3 4.5 1.5 6 1.5 9c1-2 3-2.5 4.5-2.5V9L10 6z"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h3 className="text-xs font-bold text-text-primary">
              AI調整: {fieldLabel}
            </h3>
          </div>
          <button
            className="text-xs text-text-muted hover:text-text-primary"
            onClick={onCancel}
          >
            {ai.status === "running" ? "中止" : "閉じる"}
          </button>
        </div>
      </div>

      {/* Input phase */}
      {ai.status === "input" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-4 py-3 text-xs text-text-secondary border-b border-border-light bg-cream/30">
            「{fieldLabel}」をどのように調整しますか？
          </div>
          <div className="flex-1 p-3">
            <textarea
              autoFocus
              className="w-full h-full text-sm border border-border rounded-lg p-3 bg-white focus:outline-none focus:border-accent-leaf resize-none leading-relaxed"
              placeholder={ai.field ? FIELD_PLACEHOLDERS[ai.field] : ""}
              value={ai.instruction}
              onChange={(e) =>
                setAI((prev) => ({ ...prev, instruction: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  onExecute();
                }
              }}
            />
          </div>
          <div className="px-4 py-3 border-t border-border-light flex items-center gap-2">
            <button
              className="flex-1 px-3 py-2 text-xs rounded-md bg-accent-leaf text-white hover:bg-accent-leaf-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              onClick={onExecute}
              disabled={!ai.instruction.trim()}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  d="M10 6l-4-4v2.5C3 4.5 1.5 6 1.5 9c1-2 3-2.5 4.5-2.5V9L10 6z"
                  strokeLinejoin="round"
                />
              </svg>
              AIで調整
            </button>
            <span className="text-[10px] text-text-muted">Cmd+Enter</span>
          </div>
        </div>
      )}

      {/* Running phase */}
      {ai.status === "running" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-4 py-4 border-b border-border-light">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-4 h-4 border-2 border-accent-leaf border-t-transparent rounded-full animate-spin shrink-0" />
              <p className="text-xs font-medium text-text-primary">
                {ai.progress}
              </p>
            </div>
            {ai.thinking && (
              <div className="mt-2 px-3 py-2 rounded-md bg-purple-50 border border-purple-100">
                <div className="text-[10px] font-semibold text-purple-500 uppercase tracking-wider mb-0.5">
                  Thinking
                </div>
                <p className="text-[11px] text-purple-700 leading-relaxed break-words">
                  {ai.thinking}
                </p>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
            {ai.log.map((line, i) => (
              <div
                key={i}
                className={`text-[10px] font-mono leading-snug break-all ${
                  line.includes("[error]")
                    ? "text-error"
                    : line.includes("[thinking]")
                    ? "text-purple-600"
                    : line.includes("[done]")
                    ? "text-success"
                    : "text-text-muted"
                }`}
              >
                {line}
              </div>
            ))}
          </div>
          {ai.logPath && (
            <div className="px-4 py-2 border-t border-border-light bg-card/30">
              <div className="text-[10px] text-text-muted">
                <span className="font-medium">Log:</span>{" "}
                <code className="bg-card px-1 py-0.5 rounded text-[9px]">
                  {ai.logPath}
                </code>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Done phase */}
      {ai.status === "done" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
            <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center text-success text-sm mb-3">
              ✓
            </div>
            <p className="text-sm text-text-primary font-medium mb-1">
              {ai.progress}
            </p>
            <p className="text-xs text-text-muted mb-4">
              設計パネルに反映されました
            </p>
            <button
              className="px-4 py-2 text-xs rounded-md bg-accent-leaf text-white hover:bg-accent-leaf-hover transition-colors"
              onClick={onCancel}
            >
              設計画面に戻る
            </button>
          </div>
          {ai.logPath && (
            <div className="px-4 py-2 border-t border-border-light bg-card/30 mt-auto">
              <div className="text-[10px] text-text-muted">
                <span className="font-medium">Log:</span>{" "}
                <code className="bg-card px-1 py-0.5 rounded text-[9px]">
                  {ai.logPath}
                </code>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error phase */}
      {ai.status === "error" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
            <div className="w-8 h-8 rounded-full bg-error/10 flex items-center justify-center text-error text-sm mb-3">
              !
            </div>
            <p className="text-sm text-text-primary font-medium mb-1">
              調整に失敗しました
            </p>
            <p className="text-xs text-error mb-4">{ai.error}</p>
            <div className="flex gap-2">
              <button
                className="px-3 py-1.5 text-xs rounded-md bg-card text-text-secondary hover:bg-card-hover transition-colors"
                onClick={() =>
                  setAI((prev) => ({ ...prev, status: "input" }))
                }
              >
                指示を修正
              </button>
              <button
                className="px-3 py-1.5 text-xs rounded-md bg-accent-leaf text-white hover:bg-accent-leaf-hover transition-colors"
                onClick={onCancel}
              >
                閉じる
              </button>
            </div>
          </div>
          {ai.log.length > 0 && (
            <div className="flex-1 overflow-y-auto border-t border-border-light p-3 space-y-0.5">
              {ai.log.map((line, i) => (
                <div
                  key={i}
                  className={`text-[10px] font-mono leading-snug break-all ${
                    line.includes("[error]") ? "text-error" : "text-text-muted"
                  }`}
                >
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- AI Button ---

function AIButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-accent-bark/10 text-accent-bark hover:bg-accent-bark/20 transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title="AIで調整"
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          d="M10 6l-4-4v2.5C3 4.5 1.5 6 1.5 9c1-2 3-2.5 4.5-2.5V9L10 6z"
          strokeLinejoin="round"
        />
      </svg>
      AI
    </button>
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
  showAI,
  onAI,
}: {
  label: string;
  value: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (v: string) => void;
  onCancel: () => void;
  showAI?: boolean;
  onAI?: () => void;
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
    <div className="mb-3 group">
      <div className="flex items-center justify-between mb-0.5">
        <div className="text-xs font-semibold text-text-secondary">
          {label}
        </div>
        {showAI && onAI && <AIButton onClick={onAI} />}
      </div>
      <div
        className="text-xs text-text-primary cursor-pointer hover:bg-card rounded px-1 -mx-1 py-1 transition-colors leading-relaxed"
        onClick={onEdit}
      >
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
