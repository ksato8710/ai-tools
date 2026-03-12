"use client";

import Link from "next/link";
import type { AppInspectorSession } from "@/lib/app-inspector-schema";

interface Props {
  sessions: AppInspectorSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function SessionList({ sessions, activeId, onSelect, onDelete }: Props) {
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
        <div
          key={s.id}
          className={`
            relative group rounded-xl border transition-all
            ${
              activeId === s.id
                ? "bg-accent-leaf/10 border-accent-leaf/30"
                : "bg-card border-border-light hover:bg-card-hover"
            }
          `}
        >
          <Link
            href={`/app-inspector/${s.id}`}
            onClick={(e) => {
              e.preventDefault();
              onSelect(s.id);
            }}
            className="block w-full text-left px-4 py-3"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-sm text-text-primary truncate max-w-[160px]">
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
                {new Date(s.createdAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </Link>

          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(s.id);
            }}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100
                       w-6 h-6 flex items-center justify-center rounded-md
                       text-text-muted hover:text-error hover:bg-error/10
                       transition-all"
            title="セッションを削除"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 3h7M4.5 3V2a1 1 0 011-1h1a1 1 0 011 1v1M5 5.5v3M7 5.5v3M3 3l.5 7a1 1 0 001 1h3a1 1 0 001-1L9 3"
                stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
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
