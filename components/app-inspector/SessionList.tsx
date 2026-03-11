"use client";

import type { AppInspectorSession } from "@/lib/app-inspector-schema";

interface Props {
  sessions: AppInspectorSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export default function SessionList({ sessions, activeId, onSelect }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted text-sm">
        まだ分析セッションがありません。
        <br />
        新規キャプチャを開始してください。
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={`
            w-full text-left px-4 py-3 rounded-xl border transition-all
            ${
              activeId === s.id
                ? "bg-accent-leaf/10 border-accent-leaf/30"
                : "bg-card border-border-light hover:bg-card-hover"
            }
          `}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-sm text-text-primary truncate max-w-[180px]">
              {s.appName}
            </span>
            <StatusBadge status={s.status} />
          </div>
          <div className="text-xs text-text-muted truncate">
            {s.appPackage}
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-text-muted">
              {s.screens.length} screens
            </span>
            <span className="text-xs text-text-muted">
              {new Date(s.createdAt).toLocaleDateString("ja-JP")}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    capturing:
      "bg-warning/20 text-accent-bark border-warning/30 animate-pulse",
    completed: "bg-success/10 text-success border-success/20",
    error: "bg-error/10 text-error border-error/20",
  };
  const labels = {
    capturing: "Capturing…",
    completed: "Complete",
    error: "Error",
  };
  const s = styles[status as keyof typeof styles] || styles.error;
  const l = labels[status as keyof typeof labels] || status;

  return (
    <span
      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${s}`}
    >
      {l}
    </span>
  );
}
