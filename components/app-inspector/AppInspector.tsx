"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  AppInspectorSession,
  CapturedScreen,
} from "@/lib/app-inspector-schema";
import SessionList from "./SessionList";
import CaptureForm from "./CaptureForm";
import type { CaptureMode } from "./CaptureForm";
import AppList from "./AppList";
import ScreenGallery from "./ScreenGallery";
import ScreenDetail from "./ScreenDetail";
import SummaryPanel from "./SummaryPanel";
import AnalysisPanel from "./AnalysisPanel";

interface CaptureProgress {
  phase: string;
  message: string;
}

interface CapturedScreenEvent {
  screenId: string;
  label: string;
  index: number;
}

export default function AppInspector() {
  return (
    <Suspense fallback={null}>
      <AppInspectorInner />
    </Suspense>
  );
}

function AppInspectorInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessions, setSessions] = useState<AppInspectorSession[]>([]);
  const [activeSession, setActiveSession] =
    useState<AppInspectorSession | null>(null);
  const [selectedScreen, setSelectedScreen] = useState<CapturedScreen | null>(
    null
  );
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [selectedAppName, setSelectedAppName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"gallery" | "analysis">("gallery");
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState<CaptureProgress[]>([]);
  const [capturedScreens, setCapturedScreens] = useState<CapturedScreenEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [captureLogPath, setCaptureLogPath] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/app-inspector");
      const data = await res.json();
      setSessions(data);
      return data as AppInspectorSession[];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Auto-select session from URL query param on initial load
  useEffect(() => {
    const sessionId = searchParams.get("session");
    if (sessionId && !activeSession) {
      handleSelectSession(sessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Select session and update URL
  const handleSelectSession = async (id: string) => {
    try {
      const res = await fetch(`/api/app-inspector/${id}`);
      const data = await res.json();
      setActiveSession(data);
      setSelectedScreen(null);
      setError(null);
      // Update URL without full navigation
      router.push(`/app-inspector?session=${id}`, { scroll: false });
    } catch {
      setError("Failed to load session");
    }
  };

  // Delete session
  const handleDeleteSession = async (id: string) => {
    if (!confirm("このセッションを削除しますか？")) return;
    try {
      const res = await fetch(`/api/app-inspector/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (activeSession?.id === id) {
          setActiveSession(null);
          setSelectedScreen(null);
        }
        await loadSessions();
      } else {
        setError("削除に失敗しました");
      }
    } catch {
      setError("削除に失敗しました");
    }
  };

  // Start capture and poll for progress
  const startCaptureStream = async (sessionId: string, maxScreens: number, mode: CaptureMode) => {
    setIsCapturing(true);
    setCaptureProgress([]);
    setCapturedScreens([]);
    setError(null);

    // Stop any existing polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    // POST to start capture (returns immediately)
    try {
      const res = await fetch(`/api/app-inspector/${sessionId}/capture/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxScreens, mode }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "キャプチャの開始に失敗しました");
        setIsCapturing(false);
        return;
      }
    } catch {
      setError("キャプチャの開始に失敗しました");
      setIsCapturing(false);
      return;
    }

    // Poll for progress every 1 second
    let cursor = 0;
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/app-inspector/${sessionId}/capture/stream?after=${cursor}`
        );
        if (!res.ok) return;
        const { entries, total, done } = await res.json();

        for (const entry of entries as { event: string; data: Record<string, unknown> }[]) {
          if (entry.event === "progress") {
            setCaptureProgress((prev) => [...prev, entry.data as unknown as CaptureProgress]);
          } else if (entry.event === "screen") {
            setCapturedScreens((prev) => [...prev, entry.data as unknown as CapturedScreenEvent]);
          } else if (entry.event === "log-path") {
            setCaptureLogPath((entry.data as { logPath?: string }).logPath || null);
          } else if (entry.event === "error") {
            setError((entry.data as { message?: string }).message || "Capture failed");
          }
        }
        cursor = total;

        if (done) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          setIsCapturing(false);
          await loadSessions();
          await handleSelectSession(sessionId);
        }
      } catch {
        // Polling failure — don't stop, just retry next interval
      }
    }, 1000);
  };

  // Start new capture
  const handleStartCapture = async (
    appPackage: string,
    appName: string,
    maxScreens: number,
    mode: CaptureMode
  ) => {
    setError(null);

    try {
      // Create session first
      const createRes = await fetch("/api/app-inspector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appPackage,
          appName: appName || appPackage,
          deviceName: "default",
        }),
      });
      const { id } = await createRes.json();

      // Start capture with polling
      await startCaptureStream(id, maxScreens, mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Capture failed");
    }
  };

  // Append capture to active session
  const handleAppendCapture = async (mode: CaptureMode, maxScreens: number) => {
    if (!activeSession) return;
    await startCaptureStream(activeSession.id, maxScreens, mode);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Title */}
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-nunito)] text-3xl font-extrabold text-text-primary">
          App Inspector
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Android端末の他アプリを自動操作し、スクリーンショットとUI構造を分析
        </p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-error/10 border border-error/20 rounded-xl text-sm text-error">
          {error}
        </div>
      )}

      {/* Capture progress panel */}
      {isCapturing && captureProgress.length > 0 && (
        <CaptureProgressPanel progress={captureProgress} capturedScreens={capturedScreens} logPath={captureLogPath} />
      )}

      <div className="flex gap-6">
        {/* Left sidebar */}
        <div className="w-[280px] shrink-0 space-y-6">
          {/* App list from device */}
          <div className="bg-surface rounded-2xl border border-border-light p-5">
            <h2 className="font-[family-name:var(--font-nunito)] text-sm font-bold text-text-primary mb-4">
              端末のアプリ
            </h2>
            <AppList
              onSelect={(pkg, name) => {
                setSelectedPackage(pkg);
                setSelectedAppName(name !== pkg ? name : null);
              }}
              isCapturing={isCapturing}
            />
          </div>

          {/* Capture form */}
          <div className="bg-surface rounded-2xl border border-border-light p-5">
            <h2 className="font-[family-name:var(--font-nunito)] text-sm font-bold text-text-primary mb-4">
              Capture
            </h2>
            <CaptureForm
              onStart={handleStartCapture}
              onAppendCapture={handleAppendCapture}
              isCapturing={isCapturing}
              selectedPackage={selectedPackage}
              selectedAppName={selectedAppName}
              onClearSelection={() => {
                setSelectedPackage(null);
                setSelectedAppName(null);
              }}
              hasActiveSession={!!activeSession}
            />
          </div>

          {/* Session list */}
          <div>
            <h2 className="font-[family-name:var(--font-nunito)] text-sm font-bold text-text-primary mb-3">
              Sessions
            </h2>
            <SessionList
              sessions={sessions}
              activeId={activeSession?.id || null}
              onSelect={handleSelectSession}
              onDelete={handleDeleteSession}
            />
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {!activeSession ? (
            <EmptyState />
          ) : (
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
                    {activeSession.appName}
                  </h2>
                  <p className="text-xs text-text-muted font-mono">
                    {activeSession.appPackage}
                  </p>
                </div>
              </div>

              {/* Video player */}
              {activeSession.videoPath && (
                <div className="bg-surface rounded-2xl border border-border-light p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-[family-name:var(--font-nunito)] text-sm font-bold text-text-primary">
                      Capture Recording
                    </h3>
                    <a
                      href={activeSession.videoPath}
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
                    src={activeSession.videoPath}
                    controls
                    className="w-full max-h-[400px] rounded-lg bg-black"
                  />
                </div>
              )}

              {/* Capture log */}
              {activeSession.captureLog && activeSession.captureLog.length > 0 && (
                <details className="bg-card rounded-xl border border-border-light">
                  <summary className="px-4 py-2.5 text-xs font-medium text-text-secondary cursor-pointer hover:text-text-primary">
                    Capture Log ({activeSession.captureLog.length} entries)
                  </summary>
                  <div className="px-4 pb-3 max-h-48 overflow-y-auto">
                    <pre className="text-[10px] text-text-muted font-mono leading-relaxed whitespace-pre-wrap">
                      {activeSession.captureLog.join("\n")}
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
                  {activeSession.summary && (
                    <SummaryPanel summary={activeSession.summary} />
                  )}

                  {/* Screen gallery */}
                  <div>
                    <h3 className="font-[family-name:var(--font-nunito)] text-sm font-bold text-text-primary mb-3">
                      Captured Screens
                    </h3>
                    <ScreenGallery
                      screens={activeSession.screens.filter((s) => s.screenshotPath)}
                      onSelectScreen={setSelectedScreen}
                      selectedId={selectedScreen?.id || null}
                    />
                  </div>

                  {/* External links */}
                  <ExternalLinksPanel screens={activeSession.screens} />

                  {/* Screen detail */}
                  {selectedScreen && (
                    <div className="bg-surface rounded-2xl border border-border-light p-5">
                      <ScreenDetail screen={selectedScreen} />
                    </div>
                  )}
                </>
              ) : (
                <AnalysisPanel sessionId={activeSession.id} />
              )}
            </div>
          )}
        </div>
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

function ExternalLinksPanel({ screens }: { screens: { notes?: string }[] }) {
  // Parse external links from screen notes
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
                  → {link.openedApp}
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

const CAPTURE_PHASE_LABELS: Record<string, string> = {
  init: "初期化",
  "device-check": "端末確認",
  recording: "録画",
  "app-open": "アプリ起動",
  "round-0": "初回探索",
  "home-capture": "ホーム画面取得",
  discover: "ターゲット探索",
  explore: "画面探索",
  target: "ターゲット操作",
  summary: "サマリー生成",
  complete: "完了",
};

/** round-N-analysis / round-N-capture を動的にマッチ */
function getPhaseLabelDynamic(phase: string): string {
  if (CAPTURE_PHASE_LABELS[phase]) return CAPTURE_PHASE_LABELS[phase];
  const analysisMatch = phase.match(/^round-(\d+)-analysis$/);
  if (analysisMatch) return `R${analysisMatch[1]} 分析`;
  const captureMatch = phase.match(/^round-(\d+)-capture$/);
  if (captureMatch) return `R${captureMatch[1]} 取得`;
  return phase;
}

function CaptureProgressPanel({
  progress,
  capturedScreens,
  logPath,
}: {
  progress: CaptureProgress[];
  capturedScreens: CapturedScreenEvent[];
  logPath: string | null;
}) {
  return (
    <div className="mb-4 bg-surface rounded-2xl border border-border-light p-5">
      <div className="flex items-center gap-3 mb-2">
        <span className="inline-block w-5 h-5 border-2 border-accent-leaf/30 border-t-accent-leaf rounded-full animate-spin" />
        <span className="text-sm font-medium text-text-primary">
          キャプチャ実行中...
        </span>
        {capturedScreens.length > 0 && (
          <span className="text-xs text-text-muted ml-auto">
            {capturedScreens.length} screens captured
          </span>
        )}
      </div>
      {logPath && (
        <div className="mb-3 px-3 py-1.5 bg-card rounded-lg">
          <span className="text-[10px] text-text-muted font-mono break-all select-all">
            Log: {logPath}
          </span>
        </div>
      )}

      {/* Progress pipeline — deduplicate same-phase entries, show latest message */}
      <div className="space-y-1.5 mb-3">
        {(() => {
          // Collapse consecutive same-phase entries to the latest one
          const deduped: CaptureProgress[] = [];
          for (const step of progress) {
            const last = deduped[deduped.length - 1];
            if (last && last.phase === step.phase) {
              deduped[deduped.length - 1] = step; // overwrite with latest
            } else {
              deduped.push({ ...step });
            }
          }
          return deduped.map((step, i) => {
            const isLatest = i === deduped.length - 1;
            const phaseLabel = getPhaseLabelDynamic(step.phase);
            return (
              <div
                key={`${step.phase}-${i}`}
                className={`flex items-start gap-2 text-xs ${
                  isLatest ? "text-text-primary" : "text-text-muted"
                }`}
              >
                <span className="w-4 shrink-0 text-center mt-0.5">
                  {isLatest ? (
                    <span className="inline-block w-2 h-2 bg-accent-leaf rounded-full animate-pulse" />
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-success">
                      <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="font-medium w-16 shrink-0">{phaseLabel}</span>
                <span className="break-words min-w-0">{step.message}</span>
              </div>
            );
          });
        })()}
      </div>

      {/* Captured screens list */}
      {capturedScreens.length > 0 && (
        <div className="border-t border-border-light pt-3">
          <div className="text-[10px] text-text-muted uppercase tracking-wide mb-1.5">
            取得済み画面
          </div>
          <div className="flex flex-wrap gap-1.5">
            {capturedScreens.map((s) => (
              <span
                key={s.screenId}
                className="text-[11px] px-2 py-1 bg-accent-leaf/10 text-accent-leaf rounded-lg"
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-[500px] text-center">
      <div className="w-16 h-16 bg-card rounded-2xl flex items-center justify-center mb-4">
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          className="text-text-muted"
        >
          <rect
            x="8"
            y="3"
            width="16"
            height="26"
            rx="3"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="13"
            y1="25"
            x2="19"
            y2="25"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="16" cy="14" r="4" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M16 10v0m0 8v0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <h3 className="font-[family-name:var(--font-nunito)] text-lg font-bold text-text-primary mb-2">
        Android端末を接続してキャプチャ開始
      </h3>
      <p className="text-sm text-text-muted max-w-md">
        左のフォームにパッケージ名を入力して「新規キャプチャ」をクリック。
        agent-deviceがアプリを自動操作し、スクリーンショットとUI構造を取得します。
      </p>
      <div className="mt-6 bg-card rounded-xl p-4 text-left text-xs text-text-secondary font-mono max-w-sm">
        <div className="text-text-muted mb-1"># Prerequisites</div>
        <div>npm install -g agent-device</div>
        <div>adb devices # verify connection</div>
      </div>
    </div>
  );
}
