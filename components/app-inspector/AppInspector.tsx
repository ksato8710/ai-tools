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
import ReportPanel from "./ReportPanel";
import WorkflowStepper from "./WorkflowStepper";
import type { WorkflowStep } from "./WorkflowStepper";
import type { InspectorReport } from "@/lib/app-inspector-schema";

interface CaptureProgress {
  phase: string;
  message: string;
}

interface CapturedScreenEvent {
  screenId: string;
  label: string;
  index: number;
  screenshotPath?: string;
}

interface AnalysisSnapshot {
  round: number;
  coveredFeatures: string[];
  uncapturedCount: number;
  uncapturedTargets: { featureName: string; priority: number }[];
  newDiscoveries: string[];
  summary: string;
  isComplete: boolean;
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
  // activeTab state removed — content flows vertically
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturePhase, setCapturePhase] = useState<"idle" | "capturing" | "review" | "done">("idle");
  const [captureProgress, setCaptureProgress] = useState<CaptureProgress[]>([]);
  const [capturedScreens, setCapturedScreens] = useState<CapturedScreenEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [captureLogPath, setCaptureLogPath] = useState<string | null>(null);
  const [analysisSnapshots, setAnalysisSnapshots] = useState<AnalysisSnapshot[]>([]);
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("capture");
  const [sessionReport, setSessionReport] = useState<InspectorReport | null>(null);
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
      const data = await res.json() as AppInspectorSession;
      setActiveSession(data);
      setSelectedScreen(null);
      setError(null);
      // If the session is already completed/errored (loaded from history), go to "done" phase
      // so analysis/report are immediately visible
      if (!isCapturing && (data.status === "completed" || data.status === "error") && capturePhase !== "review") {
        setCapturePhase("done");
        const hasScreens = (data.screens || []).length > 0;
        setWorkflowStep(deriveWorkflowStep("done", hasScreens, !!data.report));
        if (data.report) setSessionReport(data.report);
      }
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
  const startCaptureStream = async (sessionId: string, maxScreens: number, mode: CaptureMode, userFeedback?: string) => {
    setIsCapturing(true);
    setCapturePhase("capturing");
    setWorkflowStep("capture");
    setCaptureProgress([]);
    setCapturedScreens([]);
    setAnalysisSnapshots([]);
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
        body: JSON.stringify({ maxScreens, mode, userFeedback }),
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
          } else if (entry.event === "analysis-result") {
            setAnalysisSnapshots((prev) => [...prev, entry.data as unknown as AnalysisSnapshot]);
          } else if (entry.event === "error") {
            const errMsg = (entry.data as { message?: string }).message || "Capture failed";
            setError(errMsg);
            setCaptureProgress((prev) => [...prev, { phase: "error", message: errMsg }]);
          }
        }
        cursor = total;

        if (done) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          setIsCapturing(false);
          setCapturePhase("review");
          setWorkflowStep("review");
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
      const newSession = await createRes.json();

      // Select the new session immediately so the UI shows it
      await handleSelectSession(newSession.id);

      // Start capture with polling
      await startCaptureStream(newSession.id, maxScreens, mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Capture failed");
    }
  };

  // Append capture to active session
  const handleAppendCapture = async (mode: CaptureMode, maxScreens: number) => {
    if (!activeSession) return;
    await startCaptureStream(activeSession.id, maxScreens, mode);
  };

  // Continue capture with user feedback
  const handleContinueCapture = async (feedback: string) => {
    if (!activeSession) return;
    await startCaptureStream(activeSession.id, 30, "both", feedback);
  };

  // User is satisfied — proceed to analysis/report
  const handleProceedToAnalysis = () => {
    setCapturePhase("done");
    setWorkflowStep("report");
  };

  // Derive workflow step from capturePhase when loading existing sessions
  const deriveWorkflowStep = useCallback((phase: string, hasScreens: boolean, hasReport: boolean): WorkflowStep => {
    if (phase === "capturing") return "capture";
    if (phase === "review") return "review";
    if (phase === "done" && hasReport) return "share";
    if (phase === "done") return "report";
    if (hasScreens) return "review";
    return "capture";
  }, []);

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
              activeSessionName={activeSession?.appName}
              activeSessionScreenCount={activeSession?.screens?.length ?? 0}
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
                <div className="flex-1">
                  <h2 className="font-[family-name:var(--font-nunito)] text-xl font-bold text-text-primary">
                    {activeSession.appName}
                  </h2>
                  <p className="text-xs text-text-muted font-mono">
                    {activeSession.appPackage}
                  </p>
                </div>
                <CopySessionInfoButton sessionId={activeSession.id} appName={activeSession.appName} appPackage={activeSession.appPackage} />
              </div>

              {/* Workflow stepper */}
              <WorkflowStepper
                currentStep={workflowStep}
                onStepClick={(step) => {
                  setWorkflowStep(step);
                  // Allow going back to review from report/share
                  if (step === "review" && capturePhase === "done") {
                    setCapturePhase("review");
                  }
                }}
                screenCount={(activeSession.screens || []).length}
                hasReport={!!sessionReport || !!activeSession.report}
              />

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

              {/* ── Step 1: Capture ─────────────────────────────────── */}
              {workflowStep === "capture" && (
                <>
                  <CaptureActivityPanel
                    isCapturing={isCapturing}
                    progress={captureProgress}
                    capturedScreens={capturedScreens}
                    logPath={captureLogPath}
                    captureLog={activeSession.captureLog}
                    sessionError={activeSession.error}
                    analysisSnapshots={analysisSnapshots}
                  />

                  {/* Show captured screens so far */}
                  {(activeSession.screens || []).some((s) => s.screenshotPath) && (
                    <div>
                      <h3 className="font-[family-name:var(--font-nunito)] text-sm font-bold text-text-primary mb-3">
                        取得済み画面 ({(activeSession.screens || []).filter((s) => s.screenshotPath).length}画面)
                      </h3>
                      <ScreenGallery
                        screens={(activeSession.screens || []).filter((s) => s.screenshotPath)}
                        onSelectScreen={setSelectedScreen}
                        selectedId={selectedScreen?.id || null}
                      />
                    </div>
                  )}

                  {/* Auto-advance hint when not capturing */}
                  {!isCapturing && (activeSession.screens || []).length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-800">キャプチャ完了</p>
                        <p className="text-xs text-green-600 mt-0.5">{(activeSession.screens || []).length}画面を取得しました。確認画面に進みましょう。</p>
                      </div>
                      <button
                        onClick={() => setWorkflowStep("review")}
                        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors"
                      >
                        確認に進む
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* ── Step 2: Review ──────────────────────────────────── */}
              {workflowStep === "review" && (
                <>
                  {/* Screen gallery with summary */}
                  {(activeSession.screens || []).some((s) => s.screenshotPath) && (
                    <div className="space-y-6">
                      {activeSession.summary && (
                        <SummaryPanel summary={activeSession.summary} />
                      )}

                      <div>
                        <h3 className="font-[family-name:var(--font-nunito)] text-sm font-bold text-text-primary mb-3">
                          取得済みスクリーンショット ({(activeSession.screens || []).filter((s) => s.screenshotPath).length}画面)
                        </h3>
                        <ScreenGallery
                          screens={(activeSession.screens || []).filter((s) => s.screenshotPath)}
                          onSelectScreen={setSelectedScreen}
                          selectedId={selectedScreen?.id || null}
                        />
                      </div>

                      <ExternalLinksPanel screens={activeSession.screens || []} />

                      {selectedScreen && (
                        <div className="bg-surface rounded-2xl border border-border-light p-5">
                          <ScreenDetail screen={selectedScreen} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Review decision panel */}
                  {(activeSession.screens || []).length > 0 && (
                    <CaptureReviewPanel
                      screenCount={(activeSession.screens || []).length}
                      lastAnalysis={analysisSnapshots[analysisSnapshots.length - 1] || null}
                      onContinue={(feedback) => {
                        setWorkflowStep("capture");
                        handleContinueCapture(feedback);
                      }}
                      onProceed={handleProceedToAnalysis}
                    />
                  )}
                </>
              )}

              {/* ── Step 3: Report ──────────────────────────────────── */}
              {workflowStep === "report" && (activeSession.screens || []).length > 0 && (
                <>
                  <ReportPanel
                    sessionId={activeSession.id}
                    screens={activeSession.screens}
                    onReportReady={(report) => {
                      setSessionReport(report);
                    }}
                  />

                  {/* Advance to share when report is ready */}
                  {(sessionReport || activeSession.report) && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-indigo-800">レポート完成</p>
                        <p className="text-xs text-indigo-600 mt-0.5">Competitor UI Viewer に登録して共有できます</p>
                      </div>
                      <button
                        onClick={() => setWorkflowStep("share")}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
                      >
                        登録・共有に進む
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* ── Step 4: Share ────────────────────────────────────── */}
              {workflowStep === "share" && (activeSession.screens || []).length > 0 && (
                <>
                  <RegisterButton sessionId={activeSession.id} appName={activeSession.appName} />

                  {/* Also show the report in read-only mode for reference */}
                  <details className="group">
                    <summary className="text-sm font-medium text-text-muted cursor-pointer hover:text-text-primary transition-colors flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      レポート内容を確認
                    </summary>
                    <div className="mt-4">
                      <ReportPanel
                        sessionId={activeSession.id}
                        screens={activeSession.screens}
                        onReportReady={(report) => setSessionReport(report)}
                      />
                    </div>
                  </details>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
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
  error: "エラー",
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

function CaptureActivityPanel({
  isCapturing,
  progress,
  capturedScreens,
  logPath,
  captureLog,
  sessionError,
  analysisSnapshots = [],
}: {
  isCapturing: boolean;
  progress: CaptureProgress[];
  capturedScreens: CapturedScreenEvent[];
  logPath: string | null;
  captureLog?: string[];
  sessionError?: string;
  analysisSnapshots?: AnalysisSnapshot[];
}) {
  // During capture: show live progress (or initial "starting" state)
  if (isCapturing) {
    return (
      <div className="bg-surface rounded-2xl border border-accent-leaf/30 p-5">
        <div className="flex items-center gap-3 mb-2">
          <span className="inline-block w-5 h-5 border-2 border-accent-leaf/30 border-t-accent-leaf rounded-full animate-spin" />
          <span className="text-sm font-medium text-text-primary">
            キャプチャ実行中...
          </span>
          {capturedScreens.length > 0 && (
            <span className="text-xs text-text-muted ml-auto">
              {capturedScreens.length} 画面取得済み
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

        {/* Progress pipeline — deduplicate same-phase entries */}
        <div className="space-y-1.5 mb-3">
          {progress.length === 0 ? (
            <div className="flex items-start gap-2 text-xs text-text-primary">
              <span className="w-4 shrink-0 text-center mt-0.5">
                <span className="inline-block w-2 h-2 bg-accent-leaf rounded-full animate-pulse" />
              </span>
              <span className="font-medium w-16 shrink-0">準備中</span>
              <span>キャプチャを開始しています...</span>
            </div>
          ) : (
            (() => {
              const deduped: CaptureProgress[] = [];
              for (const step of progress) {
                const last = deduped[deduped.length - 1];
                if (last && last.phase === step.phase) {
                  deduped[deduped.length - 1] = step;
                } else {
                  deduped.push({ ...step });
                }
              }
              return deduped.map((step, i) => {
                const isLatest = i === deduped.length - 1;
                const isError = step.phase === "error";
                const phaseLabel = getPhaseLabelDynamic(step.phase);
                return (
                  <div
                    key={`${step.phase}-${i}`}
                    className={`flex items-start gap-2 text-xs ${
                      isError ? "text-error" : isLatest ? "text-text-primary" : "text-text-muted"
                    }`}
                  >
                    <span className="w-4 shrink-0 text-center mt-0.5">
                      {isError ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-error">
                          <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
                          <path d="M4 4l4 4M8 4l-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        </svg>
                      ) : isLatest ? (
                        <span className="inline-block w-2 h-2 bg-accent-leaf rounded-full animate-pulse" />
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-success">
                          <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className={`font-medium w-16 shrink-0 ${isError ? "text-error" : ""}`}>{phaseLabel}</span>
                    <span className="break-words min-w-0">{step.message}</span>
                  </div>
                );
              });
            })()
          )}
        </div>

        {/* Intermediate output — screenshots + analysis */}
        {capturedScreens.length > 0 && (
          <div className="border-t border-border-light pt-3 space-y-3">
            <div className="text-[10px] text-text-muted uppercase tracking-wide font-semibold">
              中間アウトプット — {capturedScreens.length} 画面取得済み
            </div>

            {/* Screenshot thumbnails */}
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
              {capturedScreens.map((s) => (
                <div key={s.screenId} className="group relative">
                  {s.screenshotPath ? (
                    <img
                      src={s.screenshotPath}
                      alt={s.label}
                      className="w-full aspect-[9/16] object-cover rounded-lg border border-border-light bg-card"
                    />
                  ) : (
                    <div className="w-full aspect-[9/16] rounded-lg border border-border-light bg-card flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-text-muted">
                        <rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                        <circle cx="8" cy="7" r="2" stroke="currentColor" strokeWidth="1" />
                      </svg>
                    </div>
                  )}
                  <div className="mt-1 text-[10px] text-text-muted truncate text-center" title={s.label}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Analysis snapshots from each round */}
            {analysisSnapshots.length > 0 && (
              <div className="space-y-2">
                {analysisSnapshots.map((snap) => (
                  <div key={snap.round} className="bg-card rounded-lg border border-border-light p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-semibold text-accent-leaf px-1.5 py-0.5 bg-accent-leaf/10 rounded">
                        R{snap.round}
                      </span>
                      <span className="text-[11px] text-text-primary font-medium">
                        AI分析結果
                      </span>
                      <span className="text-[10px] text-text-muted ml-auto">
                        把握 {snap.coveredFeatures.length}件 / 未取得 {snap.uncapturedCount}件
                      </span>
                    </div>
                    <p className="text-[11px] text-text-secondary mb-2">{snap.summary}</p>
                    {snap.uncapturedTargets.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {snap.uncapturedTargets.map((t) => (
                          <span
                            key={t.featureName}
                            className="text-[10px] px-1.5 py-0.5 bg-warning/10 text-accent-bark rounded border border-warning/20"
                          >
                            {t.featureName}
                          </span>
                        ))}
                        {snap.uncapturedCount > snap.uncapturedTargets.length && (
                          <span className="text-[10px] text-text-muted">
                            +{snap.uncapturedCount - snap.uncapturedTargets.length}件
                          </span>
                        )}
                      </div>
                    )}
                    {snap.isComplete && (
                      <div className="text-[10px] text-success font-medium mt-1.5 flex items-center gap-1">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        すべての主要機能をカバー
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // After capture: show completed log (collapsible)
  if (!captureLog || captureLog.length === 0) return null;

  return (
    <details className={`rounded-xl border ${sessionError ? "bg-error/5 border-error/20" : "bg-card border-border-light"}`}>
      <summary className="px-4 py-2.5 text-xs font-medium text-text-secondary cursor-pointer hover:text-text-primary flex items-center gap-2">
        {sessionError ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-error shrink-0">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M6 3.5v3M6 8v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-success shrink-0">
            <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <span>{sessionError ? "キャプチャエラー" : "キャプチャ完了"} ({captureLog.length} entries)</span>
      </summary>
      {sessionError && (
        <div className="mx-4 mt-2 px-3 py-2 bg-error/10 rounded-lg text-xs text-error break-words">
          {sessionError}
        </div>
      )}
      <div className="px-4 pb-3 max-h-48 overflow-y-auto">
        <pre className="text-[10px] text-text-muted font-mono leading-relaxed whitespace-pre-wrap">
          {captureLog.join("\n")}
        </pre>
      </div>
    </details>
  );
}

function CaptureReviewPanel({
  screenCount,
  lastAnalysis,
  onContinue,
  onProceed,
}: {
  screenCount: number;
  lastAnalysis: AnalysisSnapshot | null;
  onContinue: (feedback: string) => void;
  onProceed: () => void;
}) {
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = () => {
    if (!feedback.trim()) return;
    setIsSubmitting(true);
    onContinue(feedback.trim());
  };

  return (
    <div className="bg-surface rounded-2xl border-2 border-accent-leaf/40 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-accent-leaf/10 rounded-xl flex items-center justify-center shrink-0">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-accent-leaf">
            <path d="M10 2a8 8 0 100 16 8 8 0 000-16z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <h3 className="font-[family-name:var(--font-nunito)] text-base font-bold text-text-primary">
            キャプチャ完了 — 続けますか？
          </h3>
          <p className="text-sm text-text-secondary mt-0.5">
            現在 <span className="font-semibold text-accent-leaf">{screenCount}画面</span> を取得しています。
            さらにキャプチャを追加するか、分析に進むかを選んでください。
          </p>
        </div>
      </div>

      {/* Last analysis summary */}
      {lastAnalysis && (
        <div className="bg-card rounded-xl border border-border-light p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-accent-leaf px-1.5 py-0.5 bg-accent-leaf/10 rounded">
              AI分析
            </span>
            <span className="text-text-muted">
              把握済み {lastAnalysis.coveredFeatures.length}件 / 未取得 {lastAnalysis.uncapturedCount}件
            </span>
          </div>
          <p className="text-xs text-text-secondary">{lastAnalysis.summary}</p>
          {lastAnalysis.uncapturedTargets.length > 0 && (
            <div>
              <div className="text-[10px] text-text-muted mb-1 uppercase tracking-wide">未取得ターゲット:</div>
              <div className="flex flex-wrap gap-1">
                {lastAnalysis.uncapturedTargets.map((t) => (
                  <span
                    key={t.featureName}
                    className="text-[10px] px-1.5 py-0.5 bg-warning/10 text-accent-bark rounded border border-warning/20"
                  >
                    {t.featureName} (P{t.priority})
                  </span>
                ))}
                {lastAnalysis.uncapturedCount > lastAnalysis.uncapturedTargets.length && (
                  <span className="text-[10px] text-text-muted">
                    +{lastAnalysis.uncapturedCount - lastAnalysis.uncapturedTargets.length}件
                  </span>
                )}
              </div>
            </div>
          )}
          {lastAnalysis.isComplete && (
            <div className="text-xs text-success font-medium flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              AIは主要機能をカバー済みと判定しています
            </div>
          )}
        </div>
      )}

      {/* Feedback input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-text-primary block">
          追加キャプチャの指示（任意）
        </label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="例: 設定画面の中をもっと詳しく見てほしい、マップ機能のすべての画面を取得してほしい、ログイン後の画面がまだ取れていない..."
          className="w-full px-3 py-2.5 text-sm border border-border-light rounded-xl bg-white resize-none focus:outline-none focus:ring-2 focus:ring-accent-leaf/30 focus:border-accent-leaf placeholder:text-text-muted"
          rows={3}
          disabled={isSubmitting}
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleContinue}
          disabled={!feedback.trim() || isSubmitting}
          className="px-4 py-2.5 bg-accent-leaf text-white rounded-xl hover:bg-accent-leaf/90 transition-colors text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              キャプチャ中...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              追加キャプチャを実行
            </>
          )}
        </button>

        <button
          onClick={onProceed}
          disabled={isSubmitting}
          className="px-4 py-2.5 border border-border-light text-text-secondary rounded-xl hover:bg-card transition-colors text-sm font-medium disabled:opacity-40"
        >
          このまま分析に進む
        </button>
      </div>
    </div>
  );
}

function CopySessionInfoButton({ sessionId, appName, appPackage }: { sessionId: string; appName: string; appPackage: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = `App: ${appName} (${appPackage})\nSession ID: ${sessionId}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-muted hover:text-text-primary bg-cream border border-border-light rounded-lg hover:border-accent-leaf/30 transition-all shrink-0"
      title="セッション情報をコピー"
    >
      {copied ? (
        <>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-accent-leaf">
            <path d="M3 7l3 3 5-5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          コピー済み
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="4.5" y="4.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M9.5 4.5V3a1.5 1.5 0 00-1.5-1.5H3A1.5 1.5 0 001.5 3v5A1.5 1.5 0 003 9.5h1.5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          セッション情報をコピー
        </>
      )}
    </button>
  );
}

interface CompetitorCategory {
  id: string;
  name: string;
  name_en?: string;
}

interface CompetitorIndustry {
  id: string;
  name: string;
  name_en?: string;
  icon: string;
  categories: CompetitorCategory[];
}

function RegisterButton({ sessionId, appName }: { sessionId: string; appName: string }) {
  const [status, setStatus] = useState<"idle" | "selecting" | "registering" | "done" | "error">("idle");
  const [result, setResult] = useState<{ inspectionId?: string; screensUploaded?: number; totalScreens?: number; viewerUrl?: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);

  // Category selection state
  const [industries, setIndustries] = useState<CompetitorIndustry[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [selectedIndustryId, setSelectedIndustryId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  const selectedIndustry = industries.find((i) => i.id === selectedIndustryId);

  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      const res = await fetch("/api/app-inspector/competitor-categories");
      const data = await res.json();
      if (res.ok && data.industries) {
        setIndustries(data.industries);
      }
    } catch {
      // Silently fail — user can still register without category
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleStartRegister = async () => {
    setStatus("selecting");
    setErrorMsg(null);
    setErrorDetails([]);
    await fetchCategories();
  };

  const handleRegister = async () => {
    setStatus("registering");
    setErrorMsg(null);
    setErrorDetails([]);
    try {
      const res = await fetch(`/api/app-inspector/${sessionId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industryId: selectedIndustryId || undefined,
          categoryId: selectedCategoryId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorDetails(data.details || []);
        throw new Error(data.error || "Registration failed");
      }
      setResult(data);
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Registration failed");
      setStatus("error");
    }
  };

  const resetToIdle = () => {
    setStatus("idle");
    setResult(null);
    setSelectedIndustryId("");
    setSelectedCategoryId("");
  };

  return (
    <div className="bg-surface rounded-2xl border border-border-light p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-indigo-600">
            <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 7h6M5 10h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Competitor UI Viewer に登録</h3>
          <p className="text-[11px] text-text-muted">取得したUI情報・分析結果を競合UIビューアに送信します</p>
        </div>
      </div>

      {status === "idle" && (
        <button
          onClick={handleStartRegister}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 7h8m0 0L6 4m3 3L6 10M11 2v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {appName} を登録
        </button>
      )}

      {status === "selecting" && (
        <div className="space-y-3">
          <p className="text-xs text-text-secondary font-medium">登録先カテゴリを選択</p>

          {loadingCategories ? (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span className="inline-block w-3 h-3 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              カテゴリを読み込み中...
            </div>
          ) : (
            <>
              <select
                value={selectedIndustryId}
                onChange={(e) => { setSelectedIndustryId(e.target.value); setSelectedCategoryId(""); }}
                className="w-full px-3 py-2 text-sm border border-border-light rounded-lg bg-white focus:outline-none focus:border-indigo-400"
              >
                <option value="">業界を選択...</option>
                {industries.map((ind) => (
                  <option key={ind.id} value={ind.id}>
                    {ind.icon} {ind.name}
                  </option>
                ))}
              </select>

              {selectedIndustry && (
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border-light rounded-lg bg-white focus:outline-none focus:border-indigo-400"
                >
                  <option value="">カテゴリを選択...</option>
                  {selectedIndustry.categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleRegister}
              disabled={!selectedIndustryId || !selectedCategoryId}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              登録する
            </button>
            <button
              onClick={handleRegister}
              className="px-3 py-2 text-xs text-text-muted hover:text-text-secondary hover:underline"
            >
              カテゴリなしで登録
            </button>
            <button
              onClick={resetToIdle}
              className="px-3 py-2 text-xs text-text-muted hover:text-text-secondary hover:underline"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {status === "registering" && (
        <div className="flex items-center gap-2 text-sm text-indigo-600">
          <span className="inline-block w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          登録中... スクリーンショットをアップロードしています
        </div>
      )}

      {status === "done" && result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-sm text-green-800 font-medium">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7l3 3 5-5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            登録完了
          </div>
          <p className="text-xs text-green-700">
            {result.screensUploaded}/{result.totalScreens} 画面のスクリーンショットをアップロードしました
          </p>
          <div className="flex items-center gap-3">
            {result.viewerUrl && (
              <a
                href={result.viewerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1"
              >
                Competitor UI Viewer で確認
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M4 1h5v5M9 1L4 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            )}
            <button
              onClick={resetToIdle}
              className="text-xs text-text-muted hover:text-text-secondary hover:underline"
            >
              再アップロード
            </button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
          <p className="text-xs text-red-700 font-medium">{errorMsg}</p>
          {errorDetails.length > 0 && (
            <details className="text-xs text-red-600">
              <summary className="cursor-pointer hover:underline">エラー詳細を表示</summary>
              <ul className="mt-1 space-y-0.5 pl-3 list-disc text-[11px]">
                {errorDetails.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </details>
          )}
          <button
            onClick={() => setStatus("selecting")}
            className="text-xs text-red-600 hover:underline"
          >
            再試行
          </button>
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
