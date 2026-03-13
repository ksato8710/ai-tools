"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { AppStructureAnalysis, ScreenType } from "@/lib/app-inspector-analysis";
import { SCREEN_TYPE_LABELS } from "@/lib/app-inspector-analysis";

interface ExtendedAnalysis extends AppStructureAnalysis {
  analysisMethod?: "llm" | "rules";
  llmEnhanced?: boolean;
  appDescription?: string;
  uxInsights?: string[];
  competitorNotes?: string[];
  featureList?: {
    category: string;
    features: { name: string; description: string; screenType: string }[];
  }[];
}

interface ProgressStep {
  phase: string;
  message: string;
  timestamp: number;
}

interface Props {
  sessionId: string;
}

const PHASE_LABELS: Record<string, string> = {
  init: "初期化",
  rules: "ルール読み込み",
  prepare: "データ準備",
  llm: "LLM分析",
  parse: "結果解析",
  convert: "変換",
  feedback: "ルール学習",
  complete: "完了",
  fallback: "フォールバック",
  error: "エラー",
};

export default function AnalysisPanel({ sessionId }: Props) {
  const [analysis, setAnalysis] = useState<ExtendedAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressStep[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const runStreamingAnalysis = useCallback((rules?: boolean) => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setProgress([]);

    // Close any existing connection
    eventSourceRef.current?.close();

    const params = new URLSearchParams();
    if (rules) params.set("rules", "true");
    const qs = params.toString();
    const url = `/api/app-inspector/${sessionId}/analysis/stream${qs ? `?${qs}` : ""}`;

    if (rules) {
      // Non-streaming for rules-only
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) setError(data.error);
          else setAnalysis(data);
        })
        .catch(() => setError("分析データの取得に失敗しました"))
        .finally(() => setLoading(false));
      return;
    }

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener("progress", (e) => {
      const data = JSON.parse(e.data);
      setProgress((prev) => [...prev, { ...data, timestamp: Date.now() }]);
    });

    es.addEventListener("result", (e) => {
      const data = JSON.parse(e.data);
      setAnalysis(data);
    });

    es.addEventListener("done", () => {
      setLoading(false);
      es.close();
      eventSourceRef.current = null;
    });

    es.onerror = () => {
      setLoading(false);
      setError("分析ストリームが切断されました");
      es.close();
      eventSourceRef.current = null;
    };
  }, [sessionId]);

  // Auto-run analysis on mount
  useEffect(() => {
    runStreamingAnalysis();
    return () => {
      eventSourceRef.current?.close();
    };
  }, [runStreamingAnalysis]);

  // Loading state with progress pipeline
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-surface rounded-2xl border border-border-light p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-block w-5 h-5 border-2 border-accent-leaf/30 border-t-accent-leaf rounded-full animate-spin" />
            <span className="text-sm font-medium text-text-primary">
              LLM構造分析中...
            </span>
          </div>

          {/* Progress pipeline — deduplicate same-phase entries */}
          <div className="space-y-1.5">
            {(() => {
              const deduped: ProgressStep[] = [];
              for (const step of progress) {
                const last = deduped[deduped.length - 1];
                if (last && last.phase === step.phase) {
                  deduped[deduped.length - 1] = step;
                } else {
                  deduped.push({ ...step });
                }
              }
              return deduped;
            })().map((step, i, arr) => {
              const isLatest = i === arr.length - 1;
              const phaseLabel = PHASE_LABELS[step.phase] || step.phase;
              return (
                <div
                  key={i}
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
            })}
            {progress.length === 0 && (
              <div className="text-xs text-text-muted">接続中...</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="px-4 py-3 bg-error/10 border border-error/20 rounded-xl text-sm text-error">
        {error || "分析データがありません"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section heading */}
      <div className="flex items-center justify-between">
        <h3 className="font-[family-name:var(--font-nunito)] text-sm font-bold text-text-primary">
          構造分析
        </h3>
      </div>

      {/* Analysis method badge + re-run buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
              analysis.analysisMethod === "llm"
                ? "bg-accent-leaf/10 text-accent-leaf border-accent-leaf/20"
                : "bg-warning/10 text-accent-bark border-warning/20"
            }`}
          >
            {analysis.analysisMethod === "llm" ? "LLM分析" : "ルールベース分析"}
          </span>
          {analysis.llmEnhanced && (
            <span className="text-[10px] text-text-muted">Claude API</span>
          )}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => runStreamingAnalysis()}
            disabled={loading}
            className="text-[10px] px-2 py-1 rounded-lg border border-border-light
                       text-text-muted hover:text-text-primary hover:bg-card transition-colors
                       disabled:opacity-50"
          >
            LLM再分析
          </button>
          <button
            onClick={() => runStreamingAnalysis(true)}
            disabled={loading}
            className="text-[10px] px-2 py-1 rounded-lg border border-border-light
                       text-text-muted hover:text-text-primary hover:bg-card transition-colors
                       disabled:opacity-50"
          >
            ルールのみ
          </button>
        </div>
      </div>

      {/* App Description (LLM only) */}
      {analysis.appDescription && (
        <div className="bg-accent-leaf/5 rounded-xl border border-accent-leaf/15 p-4">
          <div className="text-[10px] text-accent-leaf uppercase tracking-wide font-semibold mb-1.5">
            アプリ概要
          </div>
          <p className="text-sm text-text-primary leading-relaxed">
            {analysis.appDescription}
          </p>
        </div>
      )}

      {/* Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="有効画面数" value={`${analysis.validScreenCount} / ${analysis.totalScreenCount}`} />
        <StatCard label="ナビゲーション" value={analysis.navigation.pattern} small />
        <StatCard label="タブ数" value={String(analysis.navigation.tabs.length)} />
        <StatCard label="検出機能数" value={String(analysis.features.length)} />
      </div>

      {/* Screen Map */}
      <Section title="画面構成マップ">
        <div className="flex flex-wrap gap-2">
          {analysis.screens.map((s) => {
            const info = SCREEN_TYPE_LABELS[s.screenType as ScreenType] || SCREEN_TYPE_LABELS.unknown;
            const desc = (s as ScreenAnalysisWithDesc).description;
            return (
              <div
                key={s.screenIndex}
                className={`
                  px-3 py-2 rounded-xl border text-xs max-w-[220px]
                  ${s.isTargetApp
                    ? "bg-surface border-border-light"
                    : "bg-error/5 border-error/20 opacity-60"
                  }
                `}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-sm">{info.icon}</span>
                  <span className="font-medium text-text-primary">
                    Screen {s.screenIndex + 1}
                  </span>
                </div>
                <div className="text-[10px] text-text-muted">
                  {info.ja}
                </div>
                {desc && (
                  <div className="text-[10px] text-text-secondary mt-0.5 line-clamp-2">
                    {desc}
                  </div>
                )}
                {!s.isTargetApp && (
                  <div className="text-[10px] text-error mt-0.5">
                    対象アプリ外
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Navigation Structure */}
      {analysis.navigation.tabs.length > 0 && (
        <Section title="ナビゲーション構造">
          <div className="space-y-3">
            <div>
              <div className="text-[10px] text-text-muted uppercase tracking-wide mb-1.5">
                タブ（ボトムナビゲーション）
              </div>
              <div className="flex flex-wrap gap-1.5">
                {analysis.navigation.tabs.map((tab) => (
                  <span
                    key={tab}
                    className="px-2.5 py-1.5 bg-accent-leaf/10 text-accent-leaf rounded-lg text-xs font-medium"
                  >
                    {tab}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* Detected Features */}
      {analysis.features.length > 0 && (
        <Section title="検出された機能・メニュー項目">
          <div className="flex flex-wrap gap-1.5">
            {analysis.features.map((f) => (
              <span
                key={f}
                className="px-2 py-1 bg-card rounded-lg text-xs text-text-primary border border-border-light"
              >
                {f}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Feature List (LLM only) */}
      {analysis.featureList && analysis.featureList.length > 0 && (
        <Section title="機能一覧（LLM分析）">
          {analysis.featureList.map((cat) => (
            <div key={cat.category} className="mb-4">
              <div className="text-xs font-medium text-text-primary mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-leaf" />
                {cat.category}
              </div>
              <div className="space-y-1.5 ml-3">
                {cat.features.map((f) => (
                  <div key={f.name} className="flex items-start gap-2 text-xs">
                    <span className="text-text-primary font-medium shrink-0">{f.name}</span>
                    <span className="text-text-muted">{f.description}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-surface rounded text-text-muted shrink-0">
                      {SCREEN_TYPE_LABELS[f.screenType as ScreenType]?.ja || f.screenType}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* UX Insights (LLM only) */}
      {analysis.uxInsights && analysis.uxInsights.length > 0 && (
        <Section title="UXインサイト">
          <div className="space-y-2">
            {analysis.uxInsights.map((insight, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="text-accent-leaf shrink-0 mt-0.5">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="text-text-primary">{insight}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Competitor Notes (LLM only) */}
      {analysis.competitorNotes && analysis.competitorNotes.length > 0 && (
        <Section title="競合分析メモ">
          <div className="space-y-2">
            {analysis.competitorNotes.map((note, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="text-warning shrink-0 mt-0.5">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M6 3.5v3M6 8v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="text-text-primary">{note}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Screen Type Distribution */}
      {analysis.screenTypes.length > 0 && (
        <Section title="画面タイプ分布">
          <div className="space-y-2">
            {analysis.screenTypes.map(({ type, count }) => {
              const info = SCREEN_TYPE_LABELS[type as ScreenType] || SCREEN_TYPE_LABELS.unknown;
              const pct = Math.round((count / Math.max(analysis.validScreenCount, 1)) * 100);
              return (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-sm w-6 text-center">{info.icon}</span>
                  <span className="text-xs text-text-primary w-24">{info.ja}</span>
                  <div className="flex-1 h-2 bg-card rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-leaf/40 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-text-muted w-16 text-right">
                    {count}画面 ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Per-Screen Detail */}
      <Section title="画面別詳細分析">
        <div className="space-y-3">
          {analysis.screens
            .filter((s) => s.isTargetApp)
            .map((s) => {
              const info = SCREEN_TYPE_LABELS[s.screenType as ScreenType] || SCREEN_TYPE_LABELS.unknown;
              const desc = (s as ScreenAnalysisWithDesc).description;
              return (
                <div
                  key={s.screenIndex}
                  className="bg-card rounded-xl border border-border-light p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{info.icon}</span>
                      <span className="text-sm font-medium text-text-primary">
                        Screen {s.screenIndex + 1}: {s.label}
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-surface rounded text-text-muted">
                      {info.ja}
                    </span>
                  </div>

                  {desc && (
                    <p className="text-xs text-text-secondary mb-3 leading-relaxed">
                      {desc}
                    </p>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                    <div>
                      <span className="text-text-muted">階層深度: </span>
                      <span className="text-text-primary font-medium">{s.depth}</span>
                    </div>
                    <div>
                      <span className="text-text-muted">要素数: </span>
                      <span className="text-text-primary font-medium">
                        {s.elementBreakdown.reduce((sum, e) => sum + e.count, 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted">ナビ: </span>
                      <span className="text-text-primary font-medium">
                        {s.navigation.tabs.length > 0 ? `${s.navigation.tabs.length}タブ` : "なし"}
                      </span>
                    </div>
                  </div>

                  {s.sections.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {s.sections.map((sec) => (
                        <span
                          key={sec.name}
                          className="text-[10px] px-1.5 py-0.5 bg-accent-leaf/10 text-accent-leaf rounded"
                        >
                          {sec.name} ({sec.elementCount})
                        </span>
                      ))}
                    </div>
                  )}

                  {s.elementBreakdown.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {s.elementBreakdown.slice(0, 6).map(({ type, count }) => (
                        <span
                          key={type}
                          className="text-[10px] px-1.5 py-0.5 bg-surface rounded text-text-muted"
                        >
                          {type}: {count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </Section>
    </div>
  );
}

type ScreenAnalysisWithDesc = { description?: string };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function StatCard({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="bg-card rounded-xl p-3 border border-border-light">
      <div className="text-[10px] text-text-muted uppercase tracking-wide mb-1">
        {label}
      </div>
      <div
        className={`font-[family-name:var(--font-nunito)] font-bold text-text-primary ${
          small ? "text-sm" : "text-xl"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
