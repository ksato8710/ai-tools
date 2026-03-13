"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { InspectorReport, CapturedScreen } from "@/lib/app-inspector-schema";

const SCREEN_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  home:         { label: "ホーム",   color: "bg-blue-100 text-blue-700" },
  list:         { label: "リスト",   color: "bg-green-100 text-green-700" },
  detail:       { label: "詳細",     color: "bg-purple-100 text-purple-700" },
  form:         { label: "フォーム", color: "bg-amber-100 text-amber-700" },
  settings:     { label: "設定",     color: "bg-slate-100 text-slate-700" },
  menu:         { label: "メニュー", color: "bg-teal-100 text-teal-700" },
  search:       { label: "検索",     color: "bg-indigo-100 text-indigo-700" },
  unknown:      { label: "その他",   color: "bg-gray-100 text-gray-600" },
};

interface ReportPanelProps {
  sessionId: string;
  screens?: CapturedScreen[];
  onReportReady?: (report: InspectorReport) => void;
}

export default function ReportPanel({ sessionId, screens, onReportReady }: ReportPanelProps) {
  const [report, setReport] = useState<InspectorReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<{ phase: string; message: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cursorRef = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/app-inspector/${sessionId}/report`);
        if (res.ok) {
          const data = await res.json();
          if (data.report) {
            setReport(data.report);
            onReportReady?.(data.report);
          }
        }
      } catch { /* no report yet */ }
    })();
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const pollProgress = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/app-inspector/${sessionId}/report?progress=true&after=${cursorRef.current}`);
        const data = await res.json();
        if (data.entries?.length > 0) {
          for (const entry of data.entries) {
            if (entry.event === "progress") {
              setProgress((prev) => [...prev, entry.data]);
            } else if (entry.event === "result") {
              setReport(entry.data.report);
              onReportReady?.(entry.data.report);
            } else if (entry.event === "error") {
              setError(entry.data.message);
            }
          }
          cursorRef.current = data.total;
        }
        if (data.done) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setIsGenerating(false);
        }
      } catch { /* ignore */ }
    }, 1000);
  }, [sessionId, onReportReady]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const startGeneration = async () => {
    setIsGenerating(true);
    setProgress([]);
    setError(null);
    cursorRef.current = 0;
    try {
      await fetch(`/api/app-inspector/${sessionId}/report`, { method: "POST" });
      pollProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
      setIsGenerating(false);
    }
  };

  // ─── Generate prompt ─────────────────────────────────────────────────
  if (!report && !isGenerating) {
    return (
      <div className="bg-surface rounded-2xl border border-border-light p-8 text-center">
        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">📊</span>
        </div>
        <h3 className="text-base font-semibold text-text-primary mb-2">AI分析レポートを生成</h3>
        <p className="text-sm text-text-muted mb-5 max-w-md mx-auto">
          キャプチャされた全画面データを基に、アプリの構造・機能・UX課題を包括的に分析します
        </p>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 mb-4 max-w-md mx-auto">{error}</div>
        )}
        <button
          onClick={startGeneration}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"
        >
          レポートを生成
        </button>
      </div>
    );
  }

  // ─── Generating state ─────────────────────────────────────────────────
  if (isGenerating) {
    return (
      <div className="bg-surface rounded-2xl border border-border-light p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-block w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <h3 className="text-base font-semibold text-text-primary">AI分析レポートを生成中...</h3>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 max-h-48 overflow-y-auto">
          {progress.map((p, i) => (
            <div key={i} className="text-xs font-mono text-gray-300 leading-relaxed">
              <span className="text-gray-500">[{p.phase}]</span> {p.message}
            </div>
          ))}
          {progress.length === 0 && (
            <div className="text-xs text-gray-500 font-mono">Initializing...</div>
          )}
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 mt-4">{error}</div>
        )}
      </div>
    );
  }

  // ─── Render report (Competitor UI Viewer style) ───────────────────────
  const r = report!;

  // Build screen → screenshot mapping by index
  const screenshotByIndex = new Map<number, CapturedScreen>();
  if (screens) {
    screens.forEach((s, i) => screenshotByIndex.set(i, s));
  }

  return (
    <div className="space-y-5">
      {/* Summary banner */}
      <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-indigo-700 mb-2 flex items-center gap-2">
          <span>📋</span> 総合サマリー
        </h3>
        <p className="text-sm text-text-primary leading-relaxed">{r.summary}</p>
      </div>

      {/* App Overview */}
      <div className="bg-surface rounded-2xl border border-border-light p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <span>📱</span> アプリ概要
        </h3>
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">概要</p>
            <p className="text-sm text-text-primary leading-relaxed">{r.appOverview.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[11px] font-medium text-text-muted mb-1">ターゲットユーザー</p>
              <p className="text-xs text-text-primary">{r.appOverview.targetUsers}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[11px] font-medium text-text-muted mb-1">カテゴリ</p>
              <p className="text-xs text-text-primary">{r.appOverview.appCategory}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Screen-by-screen analysis */}
      {r.screenMap.length > 0 && (
        <div className="bg-surface rounded-2xl border border-border-light p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <span>📐</span> 画面別詳細分析
            <span className="text-[11px] font-normal text-text-muted">({r.screenMap.length}画面)</span>
          </h3>
          <div className="space-y-4">
            {r.screenMap.map((screen, i) => {
              const typeInfo = SCREEN_TYPE_LABELS[screen.screenType] || SCREEN_TYPE_LABELS.unknown;
              const captured = screenshotByIndex.get(i);
              return (
                <div key={i} className="border border-border-light rounded-xl overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    {/* Screenshot */}
                    <div className="md:w-44 lg:w-52 shrink-0 bg-gray-50 flex items-center justify-center p-3">
                      {captured?.screenshotPath ? (
                        <img
                          src={captured.screenshotPath}
                          alt={screen.label}
                          className="max-h-72 w-auto object-contain rounded-lg shadow-sm"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-text-muted">
                          <svg className="w-8 h-8 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="m21 15-5-5L5 21" />
                          </svg>
                          <span className="text-[11px]">スクリーンショットなし</span>
                        </div>
                      )}
                    </div>
                    {/* Analysis content */}
                    <div className="flex-1 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-sm font-semibold text-text-primary">{screen.label}</h4>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary leading-relaxed mb-3">{screen.description}</p>
                      {screen.features.length > 0 && (
                        <div>
                          <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1.5">この画面の機能</p>
                          <div className="flex flex-wrap gap-1.5">
                            {screen.features.map((f, fi) => (
                              <span key={fi} className="inline-flex px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[11px]">
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-1 space-y-5">
          {/* Features */}
          <div className="bg-surface rounded-2xl border border-border-light p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span>🔍</span> 機能分析
            </h3>
            <div className="space-y-4">
              {r.featureAnalysis.map((cat, ci) => (
                <div key={ci}>
                  <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 border-b border-border-light pb-1">
                    {cat.category}
                  </h4>
                  <div className="space-y-1.5">
                    {cat.features.map((f, fi) => (
                      <div key={fi} className="flex items-start gap-2 text-xs">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0 mt-0.5 ${
                          f.importance === "core" ? "bg-indigo-100 text-indigo-700" :
                          f.importance === "secondary" ? "bg-amber-100 text-amber-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>{f.importance}</span>
                        <span className="text-text-primary">{f.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* UX Characteristics */}
          <div className="bg-surface rounded-2xl border border-border-light p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span>⭐</span> UX特性・強み
            </h3>
            <ul className="space-y-2">
              {r.characteristics.map((c, i) => (
                <li key={i} className="text-xs text-text-primary bg-green-50 rounded-lg px-3 py-2 leading-relaxed">{c}</li>
              ))}
            </ul>
          </div>

          {/* App Structure */}
          <div className="bg-surface rounded-2xl border border-border-light p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span>🏗️</span> アプリ構造
            </h3>
            {r.appStructure.navigationPattern && (
              <div className="mb-3">
                <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">ナビゲーション</p>
                <p className="text-xs text-text-primary bg-gray-50 rounded-lg px-3 py-2">{r.appStructure.navigationPattern}</p>
              </div>
            )}
            {r.appStructure.informationArchitecture && (
              <div className="mb-3">
                <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">情報設計</p>
                <p className="text-xs text-text-secondary leading-relaxed">{r.appStructure.informationArchitecture}</p>
              </div>
            )}
            {r.appStructure.keyFlows.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2">主要フロー</p>
                <div className="space-y-3">
                  {r.appStructure.keyFlows.map((flow, i) => (
                    <div key={i}>
                      <p className="text-xs font-medium text-text-primary mb-1">{flow.name}</p>
                      <ol className="space-y-0.5">
                        {flow.steps.map((step, j) => (
                          <li key={j} className="flex items-start gap-2 text-[11px] text-text-secondary">
                            <span className="text-indigo-500 font-medium shrink-0 w-3 text-right">{j + 1}.</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Screen Transitions */}
          {r.screenTransitions.length > 0 && (
            <div className="bg-surface rounded-2xl border border-border-light p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <span>🗺️</span> 画面遷移フロー
              </h3>
              <div className="space-y-2">
                {r.screenTransitions.map((t, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-medium text-text-primary bg-white px-2 py-0.5 rounded border border-border-light">{t.from}</span>
                      <span className="text-text-muted">→</span>
                      <span className="text-xs font-medium text-text-primary bg-white px-2 py-0.5 rounded border border-border-light">{t.to}</span>
                    </div>
                    <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">{t.trigger}</span>
                    <span className="text-[11px] text-text-secondary">{t.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Issues */}
          {r.issues.length > 0 && (
            <div className="bg-surface rounded-2xl border border-border-light p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <span>⚠️</span> 課題・改善点
                <span className="text-[11px] font-normal text-text-muted">({r.issues.length}件)</span>
              </h3>
              <div className="space-y-2">
                {r.issues.map((issue, i) => (
                  <div key={i} className={`rounded-xl px-3 py-2.5 border-l-[3px] ${
                    issue.severity === "critical" ? "bg-red-50 border-l-red-500" :
                    issue.severity === "major" ? "bg-amber-50 border-l-amber-500" :
                    "bg-blue-50 border-l-blue-500"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        issue.severity === "critical" ? "bg-red-100 text-red-700" :
                        issue.severity === "major" ? "bg-amber-100 text-amber-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>{issue.severity === "critical" ? "重大" : issue.severity === "major" ? "主要" : "軽微"}</span>
                      <span className="text-[10px] text-text-muted">{issue.category}</span>
                    </div>
                    <p className="text-xs text-text-primary leading-relaxed">{issue.description}</p>
                    {issue.affectedScreens.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {issue.affectedScreens.map((s, si) => (
                          <span key={si} className="text-[10px] text-text-muted bg-white px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Competitive Analysis */}
          {r.competitorInsights.length > 0 && (
            <div className="bg-surface rounded-2xl border border-border-light p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <span>🏆</span> 競合ポジショニング
              </h3>
              <ul className="space-y-2">
                {r.competitorInsights.map((insight, i) => (
                  <li key={i} className="text-xs text-text-primary bg-gray-50 rounded-xl px-3 py-2.5 leading-relaxed">{insight}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Regenerate footer */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={startGeneration}
          className="px-3 py-1.5 text-xs text-text-muted border border-border-light rounded-lg hover:bg-gray-50 transition-colors"
        >
          レポートを再生成
        </button>
        {r.generatedAt && (
          <span className="text-[11px] text-text-muted">
            最終生成: {new Date(r.generatedAt).toLocaleString("ja-JP")}
          </span>
        )}
      </div>
    </div>
  );
}
