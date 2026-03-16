"use client";

import { useState, useEffect, useCallback } from "react";
import { MeetingSession } from "@/lib/meeting-schema";
import MeetingSessionList from "./MeetingSessionList";
import MeetingRecorder from "./MeetingRecorder";
import MeetingDictionary from "./MeetingDictionary";

export default function MeetingWorkspace() {
  const [sessions, setSessions] = useState<MeetingSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<MeetingSession | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/meeting");
      const data = await res.json();
      setSessions(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const createSession = async () => {
    setIsCreating(true);
    try {
      const title = `会議 ${new Date().toLocaleDateString("ja-JP")} ${new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`;
      const res = await fetch("/api/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const session = await res.json();
      setSessions((prev) => [session, ...prev]);
      setSelectedSession(session);
    } catch {
      // ignore
    } finally {
      setIsCreating(false);
    }
  };

  const deleteSession = async (id: string) => {
    await fetch(`/api/meeting/${id}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (selectedSession?.id === id) {
      setSelectedSession(null);
    }
  };

  const handleSessionUpdate = (updated: MeetingSession) => {
    setSelectedSession(updated);
    setSessions((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-accent-leaf/20 border-t-accent-leaf rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-140px)]">
      {/* Sidebar */}
      <div className="w-80 shrink-0 flex flex-col">
        <button
          onClick={createSession}
          disabled={isCreating}
          className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-3 bg-accent-leaf text-white rounded-full font-medium hover:bg-accent-leaf/90 transition-colors disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          新しいセッション
        </button>
        <div className="flex-1 overflow-y-auto">
          <MeetingSessionList
            sessions={sessions}
            selectedId={selectedSession?.id}
            onSelect={setSelectedSession}
            onDelete={deleteSession}
          />
        </div>
        <div className="mt-4 shrink-0">
          <MeetingDictionary />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedSession ? (
          <div>
            {/* Session Header */}
            <div className="mb-6">
              <h2 className="font-[family-name:var(--font-nunito)] text-2xl font-bold text-text-primary">
                {selectedSession.title}
              </h2>
              <p className="text-sm text-text-secondary mt-1">
                {new Date(selectedSession.createdAt).toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            <MeetingRecorder
              key={selectedSession.id}
              session={selectedSession}
              onUpdate={handleSessionUpdate}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-text-secondary">
            <div className="text-center">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="mx-auto mb-4 text-text-muted">
                <rect x="20" y="8" width="24" height="36" rx="12" stroke="currentColor" strokeWidth="2.5" />
                <path d="M14 30v4a18 18 0 0036 0v-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="32" y1="52" x2="32" y2="58" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="24" y1="58" x2="40" y2="58" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <p className="text-lg mb-1">セッションを選択、または新規作成</p>
              <p className="text-sm text-text-muted">
                会議の録音・文字起こし・AI議事録生成ができます
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
