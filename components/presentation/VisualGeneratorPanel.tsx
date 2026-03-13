"use client";

import { useState, useCallback, useMemo } from "react";
import { Slide, SlideLayout } from "@/lib/presentation-schema";

interface VisualGeneratorPanelProps {
  sessionId: string;
  slides: Slide[];
  onClose: () => void;
  onDataUpdated: () => void;
}

/** Layouts that typically benefit from background/visual imagery. */
const VISUAL_LAYOUTS: SlideLayout[] = [
  "title",
  "section-divider",
  "image-text",
  "cta",
  "quote",
];

interface SlideRow {
  index: number;
  slide: Slide;
  prompt: string;
  overlay: string;
}

type GenerationStatus = "idle" | "generating" | "done" | "error";

interface SlideGenerationState {
  status: GenerationStatus;
  error?: string;
}

/** Build a suggested prompt from slide content. */
function suggestPrompt(slide: Slide): string {
  const parts: string[] = [];

  switch (slide.layout) {
    case "title":
      parts.push(
        `Professional abstract background for a presentation titled "${slide.title}"`
      );
      if (slide.subtitle) parts.push(`about ${slide.subtitle}`);
      break;
    case "section-divider":
      parts.push(
        `Elegant section divider visual representing "${slide.title}"`
      );
      break;
    case "image-text":
      if (slide.body?.type === "image-text") {
        parts.push(
          slide.body.imagePlaceholder ||
            `Visual illustration for: ${slide.body.text.slice(0, 120)}`
        );
      } else {
        parts.push(`Illustration for "${slide.title}"`);
      }
      break;
    case "cta":
      parts.push(
        `Inspiring background image for call-to-action: "${slide.title}"`
      );
      break;
    case "quote":
      parts.push(
        `Atmospheric background for a quote slide about "${slide.title}"`
      );
      break;
    default:
      parts.push(`Background image for slide: "${slide.title}"`);
  }

  return parts.join(". ") + ". High quality, professional, minimal text.";
}

/** Suggest an overlay based on layout. */
function suggestOverlay(slide: Slide): string {
  switch (slide.layout) {
    case "title":
    case "cta":
      return "rgba(0,0,0,0.45)";
    case "section-divider":
      return "rgba(0,0,0,0.35)";
    case "quote":
      return "rgba(0,0,0,0.5)";
    case "image-text":
      return "";
    default:
      return "rgba(0,0,0,0.3)";
  }
}

export default function VisualGeneratorPanel({
  sessionId,
  slides,
  onClose,
  onDataUpdated,
}: VisualGeneratorPanelProps) {
  // Build the list of candidate slides
  const candidates: SlideRow[] = useMemo(() => {
    return slides
      .map((slide, index) => ({
        index,
        slide,
        prompt: suggestPrompt(slide),
        overlay: suggestOverlay(slide),
      }))
      .filter((row) => VISUAL_LAYOUTS.includes(row.slide.layout));
  }, [slides]);

  // Per-slide prompt overrides
  const [prompts, setPrompts] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const c of candidates) {
      m[c.slide.id] = c.prompt;
    }
    return m;
  });

  // Per-slide overlay overrides
  const [overlays, setOverlays] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const c of candidates) {
      m[c.slide.id] = c.overlay;
    }
    return m;
  });

  // Per-slide generation state
  const [genStates, setGenStates] = useState<
    Record<string, SlideGenerationState>
  >({});

  // Whether a "generate all" operation is running
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  // Selection for batch generation
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const c of candidates) {
      m[c.slide.id] = true;
    }
    return m;
  });

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  );

  const completedCount = useMemo(
    () =>
      Object.values(genStates).filter((s) => s.status === "done").length,
    [genStates]
  );

  const totalInProgress = useMemo(
    () =>
      Object.values(genStates).filter((s) => s.status === "generating").length,
    [genStates]
  );

  const updateGenState = useCallback(
    (slideId: string, state: SlideGenerationState) => {
      setGenStates((prev) => ({ ...prev, [slideId]: state }));
    },
    []
  );

  const generateForSlide = useCallback(
    async (slideId: string) => {
      const prompt = prompts[slideId];
      const overlay = overlays[slideId];
      if (!prompt) return;

      updateGenState(slideId, { status: "generating" });

      try {
        const res = await fetch(
          `/api/presentation/${sessionId}/generate-image`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              slideId,
              prompt,
              overlay: overlay || undefined,
            }),
          }
        );
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        updateGenState(slideId, { status: "done" });
      } catch (err) {
        updateGenState(slideId, {
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [sessionId, prompts, overlays, updateGenState]
  );

  const handleGenerateAll = useCallback(async () => {
    setIsGeneratingAll(true);

    const toGenerate = candidates.filter((c) => selected[c.slide.id]);

    // Generate sequentially to avoid overwhelming the API
    for (const candidate of toGenerate) {
      await generateForSlide(candidate.slide.id);
    }

    setIsGeneratingAll(false);
    onDataUpdated();
  }, [candidates, selected, generateForSlide, onDataUpdated]);

  const handleGenerateSingle = useCallback(
    async (slideId: string) => {
      await generateForSlide(slideId);
      onDataUpdated();
    },
    [generateForSlide, onDataUpdated]
  );

  const toggleSelectAll = useCallback(() => {
    const allSelected = candidates.every((c) => selected[c.slide.id]);
    const m: Record<string, boolean> = {};
    for (const c of candidates) {
      m[c.slide.id] = !allSelected;
    }
    setSelected(m);
  }, [candidates, selected]);

  const layoutLabel = (layout: SlideLayout): string => {
    const map: Record<string, string> = {
      title: "Title",
      "section-divider": "Section",
      "image-text": "Image+Text",
      cta: "CTA",
      quote: "Quote",
    };
    return map[layout] || layout;
  };

  const statusIcon = (state?: SlideGenerationState) => {
    if (!state || state.status === "idle") return null;
    if (state.status === "generating") {
      return (
        <svg
          className="w-4 h-4 animate-spin text-accent-leaf"
          viewBox="0 0 16 16"
          fill="none"
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="28"
            strokeDashoffset="8"
            strokeLinecap="round"
          />
        </svg>
      );
    }
    if (state.status === "done") {
      return (
        <svg
          className="w-4 h-4 text-green-600"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            d="M4 8l3 3 5-5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    if (state.status === "error") {
      return (
        <svg
          className="w-4 h-4 text-red-500"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
        </svg>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-white rounded-xl shadow-xl border border-border-light flex flex-col overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light shrink-0">
          <div>
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <span className="text-lg">🎨</span>
              ビジュアル生成
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              スライドに背景画像やビジュアルを自動生成します
            </p>
          </div>
          <button
            className="w-7 h-7 rounded-full bg-card hover:bg-card-hover flex items-center justify-center text-text-secondary transition-colors"
            onClick={onClose}
            title="Close"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M3 3l8 8M11 3l-8 8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border-light bg-card/50 shrink-0">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={candidates.every((c) => selected[c.slide.id])}
                onChange={toggleSelectAll}
                className="rounded border-border-light text-accent-leaf focus:ring-accent-leaf"
              />
              全選択
            </label>
            <span className="text-xs text-text-muted">
              {selectedCount} / {candidates.length} 件選択
            </span>
            {completedCount > 0 && (
              <span className="text-xs text-green-600">
                {completedCount} 件完了
              </span>
            )}
          </div>
          <button
            className="px-4 py-1.5 text-xs font-medium rounded-md bg-accent-leaf text-white hover:bg-accent-leaf/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            disabled={selectedCount === 0 || isGeneratingAll}
            onClick={handleGenerateAll}
          >
            {isGeneratingAll ? (
              <>
                <svg
                  className="w-3.5 h-3.5 animate-spin"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <circle
                    cx="8"
                    cy="8"
                    r="6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="28"
                    strokeDashoffset="8"
                    strokeLinecap="round"
                  />
                </svg>
                生成中... ({completedCount + totalInProgress}/{selectedCount})
              </>
            ) : (
              <>一括生成 ({selectedCount}件)</>
            )}
          </button>
        </div>

        {/* Slide list */}
        <div className="flex-1 overflow-y-auto">
          {candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-muted">
              <p className="text-sm">
                ビジュアル生成対象のスライドが見つかりません
              </p>
              <p className="text-xs mt-1">
                title, section-divider, image-text, cta, quote
                レイアウトのスライドが対象です
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border-light">
              {candidates.map((row) => {
                const state = genStates[row.slide.id];
                const isGenerating = state?.status === "generating";
                const isDone = state?.status === "done";
                const isError = state?.status === "error";
                const hasExistingImage = !!row.slide.backgroundImage;

                return (
                  <div
                    key={row.slide.id}
                    className={`px-6 py-3 ${
                      isDone ? "bg-green-50/50" : isError ? "bg-red-50/50" : ""
                    }`}
                  >
                    {/* Top row: checkbox, slide info, status, generate button */}
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected[row.slide.id] ?? false}
                        onChange={(e) =>
                          setSelected((prev) => ({
                            ...prev,
                            [row.slide.id]: e.target.checked,
                          }))
                        }
                        disabled={isGeneratingAll}
                        className="mt-1 rounded border-border-light text-accent-leaf focus:ring-accent-leaf"
                      />

                      <div className="flex-1 min-w-0">
                        {/* Slide info line */}
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-mono text-text-muted bg-card rounded px-1.5 py-0.5 shrink-0">
                            #{row.index + 1}
                          </span>
                          <span className="text-xs font-medium text-accent-leaf bg-accent-leaf/10 rounded px-1.5 py-0.5 shrink-0">
                            {layoutLabel(row.slide.layout)}
                          </span>
                          <span className="text-sm text-text-primary font-medium truncate">
                            {row.slide.title}
                          </span>
                          {hasExistingImage && (
                            <span className="text-[10px] text-text-muted bg-card rounded px-1.5 py-0.5 shrink-0">
                              画像あり
                            </span>
                          )}
                          <div className="ml-auto shrink-0 flex items-center gap-1.5">
                            {statusIcon(state)}
                          </div>
                        </div>

                        {/* Prompt input */}
                        <div className="flex gap-2">
                          <textarea
                            className="flex-1 text-xs text-text-secondary bg-card border border-border-light rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-accent-leaf focus:border-accent-leaf placeholder:text-text-muted/50"
                            rows={2}
                            value={prompts[row.slide.id] ?? ""}
                            onChange={(e) =>
                              setPrompts((prev) => ({
                                ...prev,
                                [row.slide.id]: e.target.value,
                              }))
                            }
                            placeholder="Image generation prompt..."
                            disabled={isGenerating}
                          />
                          <div className="flex flex-col gap-1.5 shrink-0">
                            <button
                              className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-accent-bark text-white hover:bg-accent-bark-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                              disabled={
                                isGenerating ||
                                isGeneratingAll ||
                                !prompts[row.slide.id]
                              }
                              onClick={() =>
                                handleGenerateSingle(row.slide.id)
                              }
                            >
                              {isGenerating ? "生成中..." : "生成"}
                            </button>
                            {/* Overlay input */}
                            <input
                              type="text"
                              className="w-full text-[10px] text-text-muted bg-card border border-border-light rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent-leaf placeholder:text-text-muted/50"
                              value={overlays[row.slide.id] ?? ""}
                              onChange={(e) =>
                                setOverlays((prev) => ({
                                  ...prev,
                                  [row.slide.id]: e.target.value,
                                }))
                              }
                              placeholder="overlay (e.g. rgba(0,0,0,0.4))"
                              disabled={isGenerating}
                              title="Background overlay color"
                            />
                          </div>
                        </div>

                        {/* Error message */}
                        {isError && state?.error && (
                          <p className="text-[11px] text-red-500 mt-1">
                            Error: {state.error}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border-light bg-card/30 shrink-0 flex items-center justify-between">
          <p className="text-[11px] text-text-muted">
            POST /api/presentation/{sessionId}/generate-image per slide
          </p>
          <button
            className="px-4 py-1.5 text-xs rounded-md bg-card text-text-secondary hover:bg-card-hover transition-colors"
            onClick={onClose}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
