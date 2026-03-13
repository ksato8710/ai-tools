"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { InspectorReport } from "@/lib/app-inspector-schema";

interface ReportPanelProps {
  sessionId: string;
}

export default function ReportPanel({ sessionId }: ReportPanelProps) {
  const [report, setReport] = useState<InspectorReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<{ phase: string; message: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cursorRef = useRef(0);

  // Check for existing report on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/app-inspector/${sessionId}/report`);
        if (res.ok) {
          const data = await res.json();
          if (data.report) setReport(data.report);
        }
      } catch { /* no report yet */ }
    })();
  }, [sessionId]);

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
  }, [sessionId]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
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

  if (!report && !isGenerating) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">包括的レポート</h3>
        <p className="text-sm text-gray-600">
          キャプチャされた全画面データを基に、アプリの構造・機能・課題を包括的に分析したレポートを生成します。
        </p>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
        )}
        <button
          onClick={startGeneration}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          レポートを生成
        </button>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">レポート生成中...</h3>
        <div className="space-y-1">
          {progress.map((p, i) => (
            <div key={i} className="text-xs text-gray-600 break-words">
              <span className="text-gray-400">[{p.phase}]</span> {p.message}
            </div>
          ))}
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
        )}
      </div>
    );
  }

  // Render report
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800">包括的レポート</h3>

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">サマリー</h4>
        <p className="text-sm text-blue-800 whitespace-pre-wrap">{report!.summary}</p>
      </div>

      {/* App Overview */}
      <section>
        <h4 className="font-medium text-gray-800 mb-2">アプリ概要</h4>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
          <p><span className="font-medium">概要:</span> {report!.appOverview.description}</p>
          <p><span className="font-medium">ターゲット:</span> {report!.appOverview.targetUsers}</p>
          <p><span className="font-medium">カテゴリ:</span> {report!.appOverview.appCategory}</p>
        </div>
      </section>

      {/* Screen Map */}
      <section>
        <h4 className="font-medium text-gray-800 mb-2">画面一覧 ({report!.screenMap.length}画面)</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left p-2 border-b">画面名</th>
                <th className="text-left p-2 border-b">種別</th>
                <th className="text-left p-2 border-b">説明</th>
                <th className="text-left p-2 border-b">機能</th>
              </tr>
            </thead>
            <tbody>
              {report!.screenMap.map((screen, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-2 font-medium">{screen.label}</td>
                  <td className="p-2">
                    <span className="px-2 py-0.5 bg-gray-200 rounded text-xs">{screen.screenType}</span>
                  </td>
                  <td className="p-2 text-gray-600">{screen.description}</td>
                  <td className="p-2 text-gray-600">{screen.features.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Screen Transitions */}
      {report!.screenTransitions.length > 0 && (
        <section>
          <h4 className="font-medium text-gray-800 mb-2">画面遷移</h4>
          <div className="space-y-2">
            {report!.screenTransitions.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg p-2">
                <span className="font-medium">{t.from}</span>
                <span className="text-gray-400">&rarr;</span>
                <span className="font-medium">{t.to}</span>
                <span className="text-gray-400 mx-1">|</span>
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded">{t.trigger}</span>
                <span className="text-gray-500 text-xs">{t.description}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Feature Analysis */}
      <section>
        <h4 className="font-medium text-gray-800 mb-2">機能分析</h4>
        <div className="space-y-4">
          {report!.featureAnalysis.map((cat, ci) => (
            <div key={ci}>
              <h5 className="text-sm font-medium text-gray-700 mb-1">{cat.category}</h5>
              <div className="space-y-1">
                {cat.features.map((f, fi) => (
                  <div key={fi} className="flex items-start gap-2 text-sm bg-gray-50 rounded p-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      f.importance === "core" ? "bg-red-100 text-red-700" :
                      f.importance === "secondary" ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {f.importance === "core" ? "核心" : f.importance === "secondary" ? "副次" : "補助"}
                    </span>
                    <div>
                      <span className="font-medium">{f.name}</span>
                      <span className="text-gray-500 ml-2">{f.description}</span>
                      {f.screens.length > 0 && (
                        <span className="text-xs text-gray-400 ml-2">({f.screens.join(", ")})</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* App Structure */}
      <section>
        <h4 className="font-medium text-gray-800 mb-2">アプリ構造</h4>
        <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
          <p><span className="font-medium">ナビゲーション:</span> {report!.appStructure.navigationPattern}</p>
          <p><span className="font-medium">情報設計:</span> {report!.appStructure.informationArchitecture}</p>
          {report!.appStructure.keyFlows.length > 0 && (
            <div>
              <p className="font-medium mb-1">主要フロー:</p>
              {report!.appStructure.keyFlows.map((flow, i) => (
                <div key={i} className="ml-2 mb-2">
                  <p className="font-medium text-gray-700">{flow.name}</p>
                  <ol className="list-decimal ml-4 text-gray-600">
                    {flow.steps.map((step, si) => (
                      <li key={si}>{step}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Characteristics */}
      <section>
        <h4 className="font-medium text-gray-800 mb-2">特徴</h4>
        <ul className="list-disc ml-4 space-y-1 text-sm text-gray-700">
          {report!.characteristics.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </section>

      {/* Issues */}
      {report!.issues.length > 0 && (
        <section>
          <h4 className="font-medium text-gray-800 mb-2">課題 ({report!.issues.length}件)</h4>
          <div className="space-y-2">
            {report!.issues.map((issue, i) => (
              <div key={i} className={`rounded-lg p-3 text-sm border ${
                issue.severity === "critical" ? "bg-red-50 border-red-200" :
                issue.severity === "major" ? "bg-yellow-50 border-yellow-200" :
                "bg-blue-50 border-blue-200"
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    issue.severity === "critical" ? "bg-red-200 text-red-800" :
                    issue.severity === "major" ? "bg-yellow-200 text-yellow-800" :
                    "bg-blue-200 text-blue-800"
                  }`}>
                    {issue.severity === "critical" ? "重大" : issue.severity === "major" ? "主要" : "軽微"}
                  </span>
                  <span className="text-xs text-gray-500">{issue.category}</span>
                </div>
                <p className="text-gray-700">{issue.description}</p>
                {issue.affectedScreens.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">影響画面: {issue.affectedScreens.join(", ")}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Competitor Insights */}
      {report!.competitorInsights.length > 0 && (
        <section>
          <h4 className="font-medium text-gray-800 mb-2">競合インサイト</h4>
          <ul className="list-disc ml-4 space-y-1 text-sm text-gray-700">
            {report!.competitorInsights.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Regenerate button */}
      <div className="pt-4 border-t">
        <button
          onClick={startGeneration}
          className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          レポートを再生成
        </button>
        {report!.generatedAt && (
          <span className="text-xs text-gray-400 ml-2">
            最終生成: {new Date(report!.generatedAt).toLocaleString("ja-JP")}
          </span>
        )}
      </div>
    </div>
  );
}
