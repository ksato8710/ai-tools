"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import type { PresentationData, DesignSystem } from "@/lib/presentation-schema";
import {
  runAllChecks,
  CHECK_CATEGORIES,
  type CheckReport,
  type CheckResult,
  type CheckSeverity,
} from "@/lib/presentation-checker";
import {
  generateFixPrompt,
  generateBulkFixPrompt,
} from "@/lib/presentation-fix-prompt";

interface CheckPanelProps {
  data: PresentationData;
  ds: DesignSystem;
  sessionId?: string;
  onNavigateSlide: (index: number) => void;
  onDataUpdated: () => void;
}

type FixStatus = "idle" | "prompting" | "running" | "done" | "error";

interface FixProgress {
  phase: string;
  message: string;
  thinking?: string;
  logPath?: string;
  textPreview?: string;
  cost?: string;
}

export default function CheckPanel({
  data,
  ds,
  sessionId,
  onNavigateSlide,
  onDataUpdated,
}: CheckPanelProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [fixStatus, setFixStatus] = useState<FixStatus>("idle");
  const [fixError, setFixError] = useState<string | null>(null);
  const [fixPromptPreview, setFixPromptPreview] = useState<string | null>(null);
  const [fixTarget, setFixTarget] = useState<"single" | "bulk">("single");
  const [fixTargetResult, setFixTargetResult] = useState<CheckResult | null>(null);
  const [fixProgress, setFixProgress] = useState<FixProgress>({
    phase: "",
    message: "",
  });
  const [fixLog, setFixLog] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const report = useMemo(() => runAllChecks(data, ds), [data, ds]);

  const filteredResults = activeCategory
    ? report.results.filter((r) => r.checkId === activeCategory)
    : report.results;

  const actionableResults = report.results.filter(
    (r) => r.severity === "error" || r.severity === "warning"
  );

  const countByCategory = useMemo(() => {
    const map: Record<string, { errors: number; warnings: number; infos: number }> = {};
    for (const cat of CHECK_CATEGORIES) {
      map[cat.id] = { errors: 0, warnings: 0, infos: 0 };
    }
    for (const r of report.results) {
      if (!map[r.checkId]) continue;
      if (r.severity === "error") map[r.checkId].errors++;
      else if (r.severity === "warning") map[r.checkId].warnings++;
      else map[r.checkId].infos++;
    }
    return map;
  }, [report]);

  // --- Fix handlers ---

  const handleFixSingle = useCallback(
    (result: CheckResult) => {
      if (!sessionId) return;
      const prompt = generateFixPrompt(result, data, sessionId);
      setFixPromptPreview(prompt);
      setFixTarget("single");
      setFixTargetResult(result);
      setFixStatus("prompting");
      setFixError(null);
      setFixLog([]);
      setFixProgress({ phase: "", message: "" });
    },
    [data, sessionId]
  );

  const handleFixBulk = useCallback(() => {
    if (!sessionId) return;
    const prompt = generateBulkFixPrompt(actionableResults, data, sessionId);
    setFixPromptPreview(prompt);
    setFixTarget("bulk");
    setFixTargetResult(null);
    setFixStatus("prompting");
    setFixError(null);
    setFixLog([]);
    setFixProgress({ phase: "", message: "" });
  }, [actionableResults, data, sessionId]);

  const handleCopyPrompt = useCallback(() => {
    if (fixPromptPreview) {
      navigator.clipboard.writeText(fixPromptPreview);
    }
  }, [fixPromptPreview]);

  const handleExecuteFix = useCallback(async () => {
    if (!sessionId || !fixPromptPreview) return;
    setFixStatus("running");
    setFixError(null);
    setFixLog([]);
    setFixProgress({ phase: "starting", message: "接続中..." });

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch(`/api/presentation/${sessionId}/fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: fixPromptPreview,
          slideId:
            fixTarget === "single" && fixTargetResult
              ? fixTargetResult.slideId
              : undefined,
        }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        setFixError((body as Record<string, string>).error || `HTTP ${res.status}`);
        setFixStatus("error");
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
              handleSSEEvent(eventType, payload);
            } catch {
              // skip invalid JSON
            }
            eventType = "";
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setFixError(err instanceof Error ? err.message : "Unknown error");
      setFixStatus("error");
    }

    function handleSSEEvent(event: string, payload: Record<string, unknown>) {
      const ts = new Date().toLocaleTimeString("ja-JP", { hour12: false });

      switch (event) {
        case "status": {
          const msg = payload.message as string;
          const phase = payload.phase as string;
          const logPath = payload.logPath as string | undefined;
          setFixProgress((prev) => ({
            ...prev,
            phase,
            message: msg,
            ...(logPath ? { logPath } : {}),
          }));
          setFixLog((prev) => [...prev, `${ts} [${phase}] ${msg}`]);
          break;
        }
        case "thinking": {
          const text = payload.text as string;
          setFixProgress((prev) => ({
            ...prev,
            phase: "thinking",
            thinking: text,
            message: "思考中...",
          }));
          setFixLog((prev) => [
            ...prev,
            `${ts} [thinking] ${text.slice(0, 100)}`,
          ]);
          break;
        }
        case "text": {
          const text = payload.text as string;
          setFixProgress((prev) => ({
            ...prev,
            phase: "generating",
            textPreview: text,
            message: "JSON生成中...",
          }));
          setFixLog((prev) => [
            ...prev,
            `${ts} [text] ${text.slice(0, 80)}`,
          ]);
          break;
        }
        case "done": {
          const msg = payload.message as string;
          setFixProgress((prev) => ({
            ...prev,
            phase: "done",
            message: msg,
          }));
          setFixLog((prev) => [...prev, `${ts} [done] ${msg}`]);
          setFixStatus("done");
          onDataUpdated();
          break;
        }
        case "error": {
          const msg = payload.message as string;
          setFixLog((prev) => [...prev, `${ts} [error] ${msg}`]);
          setFixError(msg);
          setFixStatus("error");
          break;
        }
      }
    }
  }, [sessionId, fixPromptPreview, fixTarget, fixTargetResult, onDataUpdated]);

  const handleCancelFix = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setFixStatus("idle");
    setFixPromptPreview(null);
    setFixError(null);
    setFixLog([]);
    setFixProgress({ phase: "", message: "" });
  }, []);

  // --- Fix prompt/execution view ---
  if (fixStatus !== "idle") {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-5 py-3 border-b border-border-light">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold tracking-widest uppercase text-text-muted">
              {fixStatus === "prompting"
                ? "AI修正プロンプト"
                : fixStatus === "running"
                ? "Claude Code 実行中"
                : fixStatus === "done"
                ? "修正完了"
                : "エラー"}
            </h3>
            <button
              className="text-xs text-text-muted hover:text-text-primary"
              onClick={handleCancelFix}
            >
              {fixStatus === "running" ? "中止" : "戻る"}
            </button>
          </div>
        </div>

        {fixStatus === "prompting" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-5 py-3 border-b border-border-light bg-cream/50">
              <div className="text-xs text-text-secondary">
                {fixTarget === "bulk" ? (
                  <span>
                    <strong>{actionableResults.length}件</strong>の問題をまとめて修正
                  </span>
                ) : fixTargetResult ? (
                  <span>
                    Slide #{fixTargetResult.slideIndex + 1}: {fixTargetResult.message}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex-1 overflow-hidden p-3">
              <textarea
                className="w-full h-full text-[11px] font-mono border border-border rounded-lg p-3 bg-white focus:outline-none focus:border-accent-leaf resize-none leading-relaxed"
                value={fixPromptPreview || ""}
                onChange={(e) => setFixPromptPreview(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="px-4 py-3 border-t border-border-light flex items-center gap-2">
              <button
                className="flex-1 px-3 py-2 text-xs rounded-md bg-accent-leaf text-white hover:bg-accent-leaf-hover transition-colors flex items-center justify-center gap-1.5"
                onClick={handleExecuteFix}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M10 6l-4-4v2.5C3 4.5 1.5 6 1.5 9c1-2 3-2.5 4.5-2.5V9L10 6z" strokeLinejoin="round" />
                </svg>
                Claude Code で修正
              </button>
              <button
                className="px-3 py-2 text-xs rounded-md bg-card text-text-secondary hover:bg-card-hover transition-colors"
                onClick={handleCopyPrompt}
                title="プロンプトをコピーして手動でClaude Codeに貼り付け"
              >
                コピー
              </button>
            </div>
          </div>
        )}

        {fixStatus === "running" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Progress header */}
            <div className="px-5 py-4 border-b border-border-light">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-5 h-5 border-2 border-accent-leaf border-t-transparent rounded-full animate-spin shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">
                    {fixProgress.message}
                  </p>
                  <p className="text-[10px] text-text-muted">
                    Phase: {fixProgress.phase}
                  </p>
                </div>
              </div>

              {/* Thinking preview */}
              {fixProgress.thinking && (
                <div className="mt-2 px-3 py-2 rounded-md bg-purple-50 border border-purple-100">
                  <div className="text-[10px] font-semibold text-purple-500 uppercase tracking-wider mb-0.5">
                    Thinking
                  </div>
                  <p className="text-[11px] text-purple-700 leading-relaxed break-words">
                    {fixProgress.thinking}
                  </p>
                </div>
              )}

              {/* Text preview */}
              {fixProgress.textPreview && (
                <div className="mt-2 px-3 py-2 rounded-md bg-blue-50 border border-blue-100">
                  <div className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider mb-0.5">
                    Output Preview
                  </div>
                  <p className="text-[11px] text-blue-700 font-mono break-all">
                    {fixProgress.textPreview}
                  </p>
                </div>
              )}
            </div>

            {/* Live log */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 py-2 border-b border-border-light bg-card/50 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Live Log
                </span>
                <span className="text-[10px] text-text-muted tabular-nums">
                  {fixLog.length} entries
                </span>
              </div>
              <div className="p-3 space-y-0.5">
                {fixLog.map((line, i) => (
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
            </div>

            {/* Log file path */}
            {fixProgress.logPath && (
              <div className="px-4 py-2 border-t border-border-light bg-card/30">
                <div className="text-[10px] text-text-muted">
                  <span className="font-medium">Log:</span>{" "}
                  <code className="bg-card px-1 py-0.5 rounded text-[9px]">
                    {fixProgress.logPath}
                  </code>
                </div>
              </div>
            )}
          </div>
        )}

        {fixStatus === "done" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex flex-col items-center justify-center px-8 text-center py-8">
              <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center text-success text-lg mb-4">
                ✓
              </div>
              <p className="text-sm text-text-primary font-medium mb-1">
                {fixProgress.message || "修正が適用されました"}
              </p>
              <p className="text-xs text-text-muted mb-4">
                スライドが更新されました。チェックを再実行して確認してください。
              </p>
              <button
                className="px-4 py-2 text-xs rounded-md bg-accent-leaf text-white hover:bg-accent-leaf-hover transition-colors"
                onClick={handleCancelFix}
              >
                チェック画面に戻る
              </button>
            </div>

            {/* Log summary */}
            {fixLog.length > 0 && (
              <div className="flex-1 overflow-y-auto border-t border-border-light">
                <div className="px-4 py-2 border-b border-border-light bg-card/50 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    Execution Log
                  </span>
                </div>
                <div className="p-3 space-y-0.5">
                  {fixLog.map((line, i) => (
                    <div
                      key={i}
                      className={`text-[10px] font-mono leading-snug break-all ${
                        line.includes("[error]")
                          ? "text-error"
                          : line.includes("[done]")
                          ? "text-success"
                          : "text-text-muted"
                      }`}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {fixProgress.logPath && (
              <div className="px-4 py-2 border-t border-border-light bg-card/30">
                <div className="text-[10px] text-text-muted">
                  <span className="font-medium">Log:</span>{" "}
                  <code className="bg-card px-1 py-0.5 rounded text-[9px]">
                    {fixProgress.logPath}
                  </code>
                </div>
              </div>
            )}
          </div>
        )}

        {fixStatus === "error" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex flex-col items-center justify-center px-8 text-center py-8">
              <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center text-error text-lg mb-4">
                !
              </div>
              <p className="text-sm text-text-primary font-medium mb-1">
                修正に失敗しました
              </p>
              <p className="text-xs text-error mb-2">{fixError}</p>
              <div className="flex gap-2">
                <button
                  className="px-3 py-1.5 text-xs rounded-md bg-card text-text-secondary hover:bg-card-hover transition-colors"
                  onClick={() => setFixStatus("prompting")}
                >
                  プロンプトに戻る
                </button>
                <button
                  className="px-3 py-1.5 text-xs rounded-md bg-accent-leaf text-white hover:bg-accent-leaf-hover transition-colors"
                  onClick={handleCopyPrompt}
                >
                  コピーして手動実行
                </button>
              </div>
            </div>

            {/* Error log */}
            {fixLog.length > 0 && (
              <div className="flex-1 overflow-y-auto border-t border-border-light">
                <div className="px-4 py-2 border-b border-border-light bg-card/50">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    Execution Log
                  </span>
                </div>
                <div className="p-3 space-y-0.5">
                  {fixLog.map((line, i) => (
                    <div
                      key={i}
                      className={`text-[10px] font-mono leading-snug break-all ${
                        line.includes("[error]")
                          ? "text-error"
                          : "text-text-muted"
                      }`}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {fixProgress.logPath && (
              <div className="px-4 py-2 border-t border-border-light bg-card/30">
                <div className="text-[10px] text-text-muted">
                  <span className="font-medium">Log:</span>{" "}
                  <code className="bg-card px-1 py-0.5 rounded text-[9px]">
                    {fixProgress.logPath}
                  </code>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- Normal check results view ---
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 py-3 border-b border-border-light">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold tracking-widest uppercase text-text-muted">
            品質チェック
          </h3>
          <SummaryBadges summary={report.summary} />
        </div>
        <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-card">
          {report.summary.errors > 0 && (
            <div
              className="bg-error rounded-full"
              style={{
                width: `${(report.summary.errors / report.summary.total) * 100}%`,
              }}
            />
          )}
          {report.summary.warnings > 0 && (
            <div
              className="bg-warning rounded-full"
              style={{
                width: `${(report.summary.warnings / report.summary.total) * 100}%`,
              }}
            />
          )}
          <div
            className="bg-success rounded-full"
            style={{
              width: `${(report.summary.passed / report.summary.total) * 100}%`,
            }}
          />
        </div>
      </div>

      {sessionId && actionableResults.length > 0 && (
        <div className="px-4 py-2 border-b border-border-light">
          <button
            className="w-full px-3 py-2 text-xs rounded-md bg-accent-bark/10 text-accent-bark hover:bg-accent-bark/20 transition-colors flex items-center justify-center gap-1.5"
            onClick={handleFixBulk}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 6l-4-4v2.5C3 4.5 1.5 6 1.5 9c1-2 3-2.5 4.5-2.5V9L10 6z" strokeLinejoin="round" />
            </svg>
            {actionableResults.length}件の問題をまとめてAIに修正依頼
          </button>
        </div>
      )}

      <div className="px-4 py-3 border-b border-border-light">
        <div className="flex flex-wrap gap-1.5">
          <CategoryChip
            label="すべて"
            count={report.results.length}
            active={activeCategory === null}
            onClick={() => setActiveCategory(null)}
          />
          {CHECK_CATEGORIES.map((cat) => {
            const counts = countByCategory[cat.id];
            const total = counts.errors + counts.warnings + counts.infos;
            return (
              <CategoryChip
                key={cat.id}
                label={cat.name}
                icon={cat.icon}
                count={total}
                hasError={counts.errors > 0}
                hasWarning={counts.warnings > 0}
                active={activeCategory === cat.id}
                onClick={() =>
                  setActiveCategory(
                    activeCategory === cat.id ? null : cat.id
                  )
                }
              />
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="text-2xl mb-2 opacity-40">✓</div>
            <p className="text-sm text-text-secondary font-medium">
              {activeCategory
                ? "この観点では問題ありません"
                : "すべてのチェックをパスしました"}
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {filteredResults.map((result, i) => (
              <ResultCard
                key={`${result.slideId}-${result.checkId}-${i}`}
                result={result}
                showFix={!!sessionId && result.severity !== "info"}
                onNavigate={
                  result.slideIndex >= 0
                    ? () => onNavigateSlide(result.slideIndex)
                    : undefined
                }
                onFix={() => handleFixSingle(result)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Sub-components ---

function SummaryBadges({ summary }: { summary: CheckReport["summary"] }) {
  return (
    <div className="flex items-center gap-1.5">
      {summary.errors > 0 && (
        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-error/10 text-error">
          {summary.errors}
        </span>
      )}
      {summary.warnings > 0 && (
        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-warning/10 text-warning">
          {summary.warnings}
        </span>
      )}
      {summary.infos > 0 && (
        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-card text-text-muted">
          {summary.infos}
        </span>
      )}
    </div>
  );
}

function CategoryChip({
  label,
  icon,
  count,
  hasError,
  hasWarning,
  active,
  onClick,
}: {
  label: string;
  icon?: string;
  count: number;
  hasError?: boolean;
  hasWarning?: boolean;
  active: boolean;
  onClick: () => void;
}) {
  const dotColor = hasError
    ? "bg-error"
    : hasWarning
    ? "bg-warning"
    : count > 0
    ? "bg-card-hover"
    : "";

  return (
    <button
      className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-full border transition-colors ${
        active
          ? "border-accent-leaf bg-accent-leaf/5 text-text-primary"
          : "border-border-light text-text-secondary hover:border-border"
      }`}
      onClick={onClick}
    >
      {icon && <span className="opacity-50">{icon}</span>}
      <span>{label}</span>
      {count > 0 && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      )}
    </button>
  );
}

function ResultCard({
  result,
  showFix,
  onNavigate,
  onFix,
}: {
  result: CheckResult;
  showFix: boolean;
  onNavigate?: () => void;
  onFix: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-lg border p-3 ${
        result.severity === "error"
          ? "border-error/30 bg-error/3"
          : result.severity === "warning"
          ? "border-warning/30 bg-warning/3"
          : "border-border-light"
      }`}
    >
      <div className="flex items-start gap-2">
        <SeverityIcon severity={result.severity} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {result.slideIndex >= 0 && (
              <button
                className="text-[10px] px-1.5 py-0.5 rounded bg-card text-text-muted hover:text-text-primary hover:bg-card-hover transition-colors shrink-0"
                onClick={onNavigate}
              >
                #{result.slideIndex + 1}
              </button>
            )}
            <span className="text-xs text-text-primary leading-snug">
              {result.message}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            {result.detail && (
              <button
                className="text-[10px] text-accent-leaf hover:underline"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "閉じる" : "詳細"}
              </button>
            )}
            {showFix && (
              <button
                className="text-[10px] px-1.5 py-0.5 rounded bg-accent-bark/10 text-accent-bark hover:bg-accent-bark/20 transition-colors"
                onClick={onFix}
              >
                AIに修正依頼
              </button>
            )}
          </div>
          {expanded && result.detail && (
            <p className="text-[11px] text-text-secondary mt-1 leading-relaxed">
              {result.detail}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SeverityIcon({ severity }: { severity: CheckSeverity }) {
  if (severity === "error") {
    return (
      <span className="w-4 h-4 rounded-full bg-error flex items-center justify-center text-white text-[10px] shrink-0 mt-0.5">
        !
      </span>
    );
  }
  if (severity === "warning") {
    return (
      <span className="w-4 h-4 rounded-full bg-warning flex items-center justify-center text-white text-[10px] shrink-0 mt-0.5">
        !
      </span>
    );
  }
  return (
    <span className="w-4 h-4 rounded-full bg-card flex items-center justify-center text-text-muted text-[10px] shrink-0 mt-0.5">
      i
    </span>
  );
}
