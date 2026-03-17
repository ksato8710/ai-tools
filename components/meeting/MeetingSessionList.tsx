"use client";

import { MeetingSession } from "@/lib/meeting-schema";

interface Props {
  sessions: MeetingSession[];
  onSelect: (session: MeetingSession) => void;
  onDelete: (id: string) => void;
  selectedId?: string;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function statusLabel(status: MeetingSession["status"]): { text: string; color: string } {
  switch (status) {
    case "ready":
      return { text: "準備中", color: "bg-gray-200 text-gray-600" };
    case "recording":
      return { text: "録音中", color: "bg-red-100 text-red-600" };
    case "recorded":
      return { text: "録音済み", color: "bg-blue-100 text-blue-600" };
    case "transcribing":
      return { text: "文字起こし中", color: "bg-yellow-100 text-yellow-700" };
    case "processing":
      return { text: "AI処理中", color: "bg-indigo-100 text-indigo-700" };
    case "completed":
      return { text: "完了", color: "bg-green-100 text-green-700" };
    case "error":
      return { text: "エラー", color: "bg-red-100 text-red-600" };
  }
}

export default function MeetingSessionList({ sessions, onSelect, onDelete, selectedId }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <p className="text-lg mb-2">まだセッションがありません</p>
        <p className="text-sm">「新しいセッション」ボタンで録音を始めましょう</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => {
        const { text, color } = statusLabel(session.status);
        const isSelected = session.id === selectedId;

        return (
          <div
            key={session.id}
            onClick={() => onSelect(session)}
            className={`
              p-4 rounded-[12px] border cursor-pointer transition-all duration-150
              ${isSelected
                ? "border-accent-leaf/40 bg-accent-leaf/5 shadow-sm"
                : "border-border-light bg-card hover:border-accent-leaf/20 hover:shadow-sm"
              }
            `}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-[family-name:var(--font-nunito)] font-bold text-text-primary truncate">
                  {session.title}
                </h3>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-text-secondary">
                  <span>
                    {new Date(session.createdAt).toLocaleDateString("ja-JP", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {session.duration && (
                    <span>{formatDuration(session.duration)}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${color}`}>
                  {text}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(session.id);
                  }}
                  className="text-text-muted hover:text-red-500 transition-colors p-1"
                  title="削除"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 3.5h8M5.5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1M9 6v4.5M5 6v4.5M3.5 3.5l.5 8a1 1 0 001 1h4a1 1 0 001-1l.5-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
