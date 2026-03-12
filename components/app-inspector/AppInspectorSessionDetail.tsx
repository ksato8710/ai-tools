"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type {
  AppInspectorSession,
  CapturedScreen,
} from "@/lib/app-inspector-schema";
import ScreenGallery from "./ScreenGallery";
import ScreenDetail from "./ScreenDetail";
import SummaryPanel from "./SummaryPanel";
import AnalysisPanel from "./AnalysisPanel";

interface Props {
  sessionId: string;
}

export default function AppInspectorSessionDetail({ sessionId }: Props) {
  const [session, setSession] = useState<AppInspectorSession | null>(null);
  const [selectedScreen, setSelectedScreen] = useState<CapturedScreen | null>(null);
  const [activeTab, setActiveTab] = useState<"gallery" | "analysis">("gallery");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/app-inspector/${sessionId}`);
      if (!res.ok) {
        setError("Session not found");
        return;
      }
      const data = await res.json();
      setSession(data);
    } catch {
      setError("Failed to load session");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-center py-20 text-text-muted text-sm">Loading session...</div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-center py-20">
          <p className="text-error text-sm mb-4">{error || "Session not found"}</p>
          <Link
            href="/app-inspector"
            className="text-sm text-accent-leaf hover:underline"
          >
            Back to App Inspector
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/app-inspector"
          className="text-sm text-text-muted hover:text-text-primary transition-colors flex items-center gap-1"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          App Inspector
        </Link>
      </div>

      <div className="space-y-6">
        {/* Session header */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-accent-leaf/10 rounded-xl flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              className="text-accent-leaf"
            >
              <rect
                x="5"
                y="2"
                width="10"
                height="16"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <line
                x1="8"
                y1="15"
                x2="12"
                y2="15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-nunito)] text-xl font-bold text-text-primary">
              {session.appName}
            </h2>
            <p className="text-xs text-text-muted font-mono">
              {session.appPackage}
            </p>
          </div>
          <div className="ml-auto">
            <StatusBadge status={session.status} />
          </div>
        </div>

        {/* Video player */}
        {session.videoPath && (
          <div className="bg-surface rounded-2xl border border-border-light p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-[family-name:var(--font-nunito)] text-sm font-bold text-text-primary">
                Capture Recording
              </h3>
              <a
                href={session.videoPath}
                download
                className="text-xs text-accent-leaf hover:underline flex items-center gap-1"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 2v6m0 0L3.5 5.5M6 8l2.5-2.5M2 10h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download
              </a>
            </div>
            <video
              src={session.videoPath}
              controls
              className="w-full max-h-[400px] rounded-lg bg-black"
            />
          </div>
        )}

        {/* Capture log */}
        {session.captureLog && session.captureLog.length > 0 && (
          <details className="bg-card rounded-xl border border-border-light">
            <summary className="px-4 py-2.5 text-xs font-medium text-text-secondary cursor-pointer hover:text-text-primary">
              Capture Log ({session.captureLog.length} entries)
            </summary>
            <div className="px-4 pb-3 max-h-48 overflow-y-auto">
              <pre className="text-[10px] text-text-muted font-mono leading-relaxed whitespace-pre-wrap">
                {session.captureLog.join("\n")}
              </pre>
            </div>
          </details>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-card rounded-xl p-1 border border-border-light">
          <TabButton
            active={activeTab === "gallery"}
            onClick={() => setActiveTab("gallery")}
          >
            キャプチャ画面
          </TabButton>
          <TabButton
            active={activeTab === "analysis"}
            onClick={() => setActiveTab("analysis")}
          >
            構造分析
          </TabButton>
        </div>

        {activeTab === "gallery" ? (
          <>
            {/* Summary */}
            {session.summary && (
              <SummaryPanel summary={session.summary} />
            )}

            {/* Screen gallery */}
            <div>
              <h3 className="font-[family-name:var(--font-nunito)] text-sm font-bold text-text-primary mb-3">
                Captured Screens
              </h3>
              <ScreenGallery
                screens={session.screens.filter((s) => s.screenshotPath)}
                onSelectScreen={setSelectedScreen}
                selectedId={selectedScreen?.id || null}
              />
            </div>

            {/* External links */}
            <ExternalLinksPanel screens={session.screens} />

            {/* Screen detail */}
            {selectedScreen && (
              <div className="bg-surface rounded-2xl border border-border-light p-5">
                <ScreenDetail screen={selectedScreen} />
              </div>
            )}
          </>
        ) : (
          <AnalysisPanel sessionId={session.id} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors
        ${active
          ? "bg-surface text-text-primary shadow-sm"
          : "text-text-muted hover:text-text-secondary"
        }
      `}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    capturing: "bg-warning/20 text-accent-bark border-warning/30 animate-pulse",
    completed: "bg-success/10 text-success border-success/20",
    error: "bg-error/10 text-error border-error/20",
  };
  const labels = {
    capturing: "Capturing...",
    completed: "Complete",
    error: "Error",
  };
  const s = styles[status as keyof typeof styles] || styles.error;
  const l = labels[status as keyof typeof labels] || status;

  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${s}`}>
      {l}
    </span>
  );
}

function ExternalLinksPanel({ screens }: { screens: { notes?: string }[] }) {
  const externalLinks: { label: string; type?: string; openedApp?: string }[] = [];
  for (const s of screens) {
    if (!s.notes) continue;
    try {
      const parsed = JSON.parse(s.notes);
      if (parsed.externalLinks) {
        externalLinks.push(...parsed.externalLinks);
      }
    } catch { /* ignore */ }
  }

  if (externalLinks.length === 0) return null;

  return (
    <div>
      <h3 className="font-[family-name:var(--font-nunito)] text-sm font-bold text-text-primary mb-3">
        外部リンク（アプリ外遷移）
      </h3>
      <div className="bg-card rounded-xl border border-border-light p-4">
        <div className="space-y-2">
          {externalLinks.map((link, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="text-warning shrink-0">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M6 2H3a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M8 2h4v4M12 2L6 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-text-primary">{link.label}</span>
              {link.openedApp && (
                <span className="text-[10px] text-text-muted font-mono">
                  -&gt; {link.openedApp}
                </span>
              )}
              {link.type === "detected-external" && (
                <span className="text-[10px] px-1.5 py-0.5 bg-warning/10 text-accent-bark rounded">
                  検出済み
                </span>
              )}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-text-muted mt-2">
          これらのリンクはアプリ外（ブラウザ等）に遷移します
        </p>
      </div>
    </div>
  );
}
