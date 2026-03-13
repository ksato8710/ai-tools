"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  PresentationData,
  PresentationMetadata,
  OutlineSection,
  Slide,
  DesignSystem,
  defaultDesignSystem,
  designSystemToTheme,
} from "@/lib/presentation-schema";
import { builtInDesignSystems } from "@/lib/presentation-design-systems";
import { generatePptx } from "@/lib/presentation-pptx";
import SlideRenderer from "./SlideRenderer";
import PlanningPanel from "./PlanningPanel";
import SlideEditorPanel from "./SlideEditorPanel";
import DesignSystemPanel from "./DesignSystemPanel";
import CheckPanel from "./CheckPanel";
import VisualGeneratorPanel from "./VisualGeneratorPanel";

interface PresentationWorkspaceProps {
  initialData: PresentationData;
  sessionId?: string;
  sessionName?: string;
}

type ViewMode = "planning" | "slides";
type RightPanel = "editor" | "design" | "check" | "json" | "none";

export default function PresentationWorkspace({
  initialData,
  sessionId,
  sessionName,
}: PresentationWorkspaceProps) {
  const [data, setData] = useState<PresentationData>(initialData);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    "saved"
  );
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("slides");
  const [rightPanel, setRightPanel] = useState<RightPanel>("editor");
  const [showVisualGen, setShowVisualGen] = useState(false);

  // Resolve the active design system
  const ds: DesignSystem = data.designSystem || defaultDesignSystem;

  const activeSlide = data.slides[activeSlideIndex];
  const activeSectionId = activeSlide?.sectionId;

  const handleMetadataChange = useCallback(
    (metadata: PresentationMetadata) => {
      setData((prev) => ({ ...prev, metadata }));
    },
    []
  );

  const handleOutlineChange = useCallback((outline: OutlineSection[]) => {
    setData((prev) => ({ ...prev, outline }));
  }, []);

  const handleSlideChange = useCallback((updatedSlide: Slide) => {
    setData((prev) => ({
      ...prev,
      slides: prev.slides.map((s) =>
        s.id === updatedSlide.id ? updatedSlide : s
      ),
    }));
  }, []);

  const handleDesignSystemChange = useCallback((newDs: DesignSystem) => {
    setData((prev) => ({
      ...prev,
      designSystem: newDs,
      // Also sync the legacy theme for PPTX export backward compat
      theme: designSystemToTheme(newDs),
    }));
  }, []);

  const handleSectionClick = useCallback(
    (sectionId: string) => {
      const firstSlideIndex = data.slides.findIndex(
        (s) => s.sectionId === sectionId
      );
      if (firstSlideIndex >= 0) {
        setActiveSlideIndex(firstSlideIndex);
      }
    },
    [data.slides]
  );

  const navigateSlide = useCallback(
    (direction: -1 | 1) => {
      setActiveSlideIndex((prev) => {
        const next = prev + direction;
        if (next < 0) return 0;
        if (next >= data.slides.length) return data.slides.length - 1;
        return next;
      });
    },
    [data.slides.length]
  );

  // Auto-save to API when data changes (debounced)
  useEffect(() => {
    if (!sessionId) return;
    setSaveStatus("unsaved");
    const timer = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await fetch(`/api/presentation/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ presentation: data }),
        });
        setSaveStatus("saved");
      } catch {
        setSaveStatus("unsaved");
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [data, sessionId]);

  const [downloading, setDownloading] = useState(false);

  const handleDownloadPptx = useCallback(async () => {
    setDownloading(true);
    try {
      const blob = await generatePptx(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.metadata.title || "presentation"}.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PPTX generation failed:", err);
    } finally {
      setDownloading(false);
    }
  }, [data]);

  const jsonOutput = useMemo(() => JSON.stringify(data, null, 2), [data]);

  const toggleRightPanel = (panel: RightPanel) => {
    setRightPanel((prev) => (prev === panel ? "none" : panel));
  };

  return (
    <div className="flex flex-col h-screen bg-cream">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-border-light bg-white/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-4">
          {sessionId && (
            <a
              href="/presentation"
              className="w-7 h-7 rounded-full bg-card hover:bg-card-hover flex items-center justify-center text-text-secondary transition-colors"
              title="Back to sessions"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3L4 7l4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          )}
          <h1 className="font-heading text-lg font-bold text-text-primary">
            {sessionName || "Presentation Studio"}
          </h1>
          {sessionId && (
            <span className="text-xs text-text-muted">
              {saveStatus === "saving"
                ? "Saving..."
                : saveStatus === "saved"
                ? "Saved"
                : "Unsaved"}
            </span>
          )}
          <div className="flex rounded-full bg-card p-0.5">
            <button
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                viewMode === "planning"
                  ? "bg-white text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => setViewMode("planning")}
            >
              設計
            </button>
            <button
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                viewMode === "slides"
                  ? "bg-white text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => setViewMode("slides")}
            >
              スライド
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Design system indicator */}
          <div className="flex items-center gap-1.5 mr-2">
            <div
              className="w-3 h-3 rounded-full border border-white/50"
              style={{ background: ds.colors.accent }}
              title={ds.name}
            />
            <span className="text-[10px] text-text-muted">{ds.name}</span>
          </div>

          <button
            className="px-3 py-1.5 text-xs rounded-md bg-accent-bark text-white hover:bg-accent-bark-hover transition-colors disabled:opacity-50 flex items-center gap-1.5"
            onClick={handleDownloadPptx}
            disabled={downloading}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 2v7M4 7l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 10v2h10v-2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {downloading ? "生成中..." : "PPTX"}
          </button>
          <button
            className="px-3 py-1.5 text-xs rounded-md bg-card text-text-secondary hover:bg-card-hover transition-colors flex items-center gap-1"
            onClick={() => setShowVisualGen(true)}
            title="AI画像生成"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" />
              <circle cx="4.5" cy="4.5" r="1" />
              <path d="M1.5 8.5l2.5-3 2 2 1.5-1.5 3 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            ビジュアル
          </button>
          <button
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              rightPanel === "editor"
                ? "bg-accent-leaf text-white"
                : "bg-card text-text-secondary hover:bg-card-hover"
            }`}
            onClick={() => toggleRightPanel("editor")}
          >
            編集
          </button>
          <button
            className={`px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1 ${
              rightPanel === "design"
                ? "bg-accent-leaf text-white"
                : "bg-card text-text-secondary hover:bg-card-hover"
            }`}
            onClick={() => toggleRightPanel("design")}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="6" cy="6" r="4.5" />
              <circle cx="6" cy="6" r="1.5" />
            </svg>
            テーマ
          </button>
          <button
            className={`px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1 ${
              rightPanel === "check"
                ? "bg-accent-leaf text-white"
                : "bg-card text-text-secondary hover:bg-card-hover"
            }`}
            onClick={() => toggleRightPanel("check")}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 6l2.5 2.5L9 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            チェック
          </button>
          <button
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              rightPanel === "json"
                ? "bg-accent-leaf text-white"
                : "bg-card text-text-secondary hover:bg-card-hover"
            }`}
            onClick={() => toggleRightPanel("json")}
          >
            JSON
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <aside className="w-72 border-r border-border-light bg-white shrink-0 overflow-hidden flex flex-col">
          {viewMode === "planning" ? (
            <PlanningPanel
              metadata={data.metadata}
              outline={data.outline}
              sessionId={sessionId}
              onMetadataChange={handleMetadataChange}
              onOutlineChange={handleOutlineChange}
              onSectionClick={handleSectionClick}
              onDataUpdated={async () => {
                if (!sessionId) return;
                try {
                  const res = await fetch(`/api/presentation/${sessionId}`);
                  if (res.ok) {
                    const session = await res.json();
                    if (session.presentation) {
                      setData(session.presentation);
                    }
                  }
                } catch (err) {
                  console.error("Failed to reload session:", err);
                }
              }}
              activeSectionId={activeSectionId}
            />
          ) : (
            <div className="flex flex-col h-full">
              <div className="px-4 py-3 border-b border-border-light">
                <h3 className="text-xs font-bold tracking-widest uppercase text-text-muted">
                  スライド一覧
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {data.slides.map((slide, i) => (
                  <div key={slide.id} className="flex gap-2 items-start">
                    <span className="text-xs text-text-muted mt-1 w-4 text-right shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <SlideRenderer
                        slide={slide}
                        ds={ds}
                        scale={0.24}
                        onClick={() => setActiveSlideIndex(i)}
                        isActive={i === activeSlideIndex}
                      />
                      <div className="text-[10px] text-text-muted mt-1 truncate px-0.5">
                        {slide.title}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Center - Main slide view */}
        <main className="flex-1 flex flex-col items-center justify-center bg-[#E8E6E0] overflow-hidden relative">
          {activeSlide && (
            <>
              <div className="flex items-center justify-center flex-1">
                <SlideRenderer slide={activeSlide} ds={ds} scale={0.85} />
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-4 pb-4">
                <button
                  className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
                  onClick={() => navigateSlide(-1)}
                  disabled={activeSlideIndex === 0}
                >
                  ‹
                </button>
                <span className="text-sm text-text-secondary font-medium tabular-nums">
                  {activeSlideIndex + 1} / {data.slides.length}
                </span>
                <button
                  className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
                  onClick={() => navigateSlide(1)}
                  disabled={activeSlideIndex === data.slides.length - 1}
                >
                  ›
                </button>
              </div>

              {activeSlide.notes && (
                <div className="absolute bottom-14 left-1/2 -translate-x-1/2 max-w-lg bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-sm border border-border-light">
                  <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-0.5">
                    Notes
                  </div>
                  <div className="text-xs text-text-secondary leading-relaxed">
                    {activeSlide.notes}
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        {/* Right panel */}
        {rightPanel !== "none" && (
          <aside className="w-80 border-l border-border-light bg-white shrink-0 overflow-hidden">
            {rightPanel === "json" ? (
              <div className="h-full flex flex-col">
                <div className="px-4 py-3 border-b border-border-light flex items-center justify-between">
                  <h3 className="text-xs font-bold tracking-widest uppercase text-text-muted">
                    JSON出力
                  </h3>
                  <button
                    className="text-xs text-accent-leaf hover:underline"
                    onClick={() => navigator.clipboard.writeText(jsonOutput)}
                  >
                    コピー
                  </button>
                </div>
                <pre className="flex-1 overflow-auto p-4 text-[11px] font-mono text-text-secondary leading-relaxed">
                  {jsonOutput}
                </pre>
              </div>
            ) : rightPanel === "design" ? (
              <DesignSystemPanel
                current={ds}
                builtIn={builtInDesignSystems}
                onChange={handleDesignSystemChange}
              />
            ) : rightPanel === "check" ? (
              <CheckPanel
                data={data}
                ds={ds}
                sessionId={sessionId}
                onNavigateSlide={setActiveSlideIndex}
                onDataUpdated={async () => {
                  if (!sessionId) return;
                  try {
                    const res = await fetch(`/api/presentation/${sessionId}`);
                    if (res.ok) {
                      const session = await res.json();
                      if (session.presentation) {
                        setData(session.presentation);
                      }
                    }
                  } catch (err) {
                    console.error("Failed to reload session:", err);
                  }
                }}
              />
            ) : activeSlide ? (
              <SlideEditorPanel
                slide={activeSlide}
                slideIndex={activeSlideIndex}
                totalSlides={data.slides.length}
                onSlideChange={handleSlideChange}
              />
            ) : null}
          </aside>
        )}
      </div>

      <KeyboardHandler
        onPrev={() => navigateSlide(-1)}
        onNext={() => navigateSlide(1)}
      />

      {showVisualGen && sessionId && (
        <VisualGeneratorPanel
          sessionId={sessionId}
          slides={data.slides}
          onClose={() => setShowVisualGen(false)}
          onDataUpdated={async () => {
            try {
              const res = await fetch(`/api/presentation/${sessionId}`);
              if (res.ok) {
                const session = await res.json();
                if (session.presentation) {
                  setData(session.presentation);
                }
              }
            } catch (err) {
              console.error("Failed to reload session:", err);
            }
          }}
        />
      )}
    </div>
  );
}

function KeyboardHandler({
  onPrev,
  onNext,
}: {
  onPrev: () => void;
  onNext: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      )
        return;

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        onPrev();
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onPrev, onNext]);

  return null;
}
