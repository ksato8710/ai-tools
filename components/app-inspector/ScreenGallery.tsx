"use client";

import { useState } from "react";
import Image from "next/image";
import type { CapturedScreen } from "@/lib/app-inspector-schema";

interface Props {
  screens: CapturedScreen[];
  onSelectScreen: (screen: CapturedScreen) => void;
  selectedId: string | null;
}

export default function ScreenGallery({
  screens,
  onSelectScreen,
  selectedId,
}: Props) {
  const [view, setView] = useState<"grid" | "flow">("grid");

  if (screens.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        キャプチャされた画面がありません
      </div>
    );
  }

  return (
    <div>
      {/* View toggle */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setView("grid")}
          className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
            view === "grid"
              ? "bg-accent-leaf/10 border-accent-leaf/30 text-accent-leaf"
              : "border-border-light text-text-muted hover:bg-card-hover"
          }`}
        >
          Grid
        </button>
        <button
          onClick={() => setView("flow")}
          className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
            view === "flow"
              ? "bg-accent-leaf/10 border-accent-leaf/30 text-accent-leaf"
              : "border-border-light text-text-muted hover:bg-card-hover"
          }`}
        >
          Flow
        </button>
        <span className="text-xs text-text-muted ml-auto">
          {screens.length} screens
        </span>
      </div>

      {view === "grid" ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {screens.map((screen) => (
            <ScreenCard
              key={screen.id}
              screen={screen}
              isSelected={selectedId === screen.id}
              onClick={() => onSelectScreen(screen)}
            />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {screens.map((screen, i) => (
            <div key={screen.id} className="flex items-center shrink-0">
              <ScreenCard
                screen={screen}
                isSelected={selectedId === screen.id}
                onClick={() => onSelectScreen(screen)}
                compact
              />
              {i < screens.length - 1 && (
                <svg
                  width="32"
                  height="16"
                  viewBox="0 0 32 16"
                  className="text-border mx-1 shrink-0"
                >
                  <path
                    d="M0 8h24m0 0l-6-6m6 6l-6 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScreenCard({
  screen,
  isSelected,
  onClick,
  compact,
}: {
  screen: CapturedScreen;
  isSelected: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        text-left rounded-xl border overflow-hidden transition-all
        ${compact ? "w-[140px]" : ""}
        ${
          isSelected
            ? "border-accent-leaf shadow-md ring-2 ring-accent-leaf/20"
            : "border-border-light hover:border-accent-leaf/30 hover:shadow-sm"
        }
      `}
    >
      <div
        className={`relative bg-card ${compact ? "h-[200px]" : "aspect-[9/16]"}`}
      >
        <Image
          src={screen.screenshotPath}
          alt={screen.label}
          fill
          className="object-cover object-top"
          sizes="(max-width: 768px) 50vw, 33vw"
        />
        <div className="absolute top-2 left-2">
          <span className="bg-text-primary/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            #{screen.index + 1}
          </span>
        </div>
      </div>
      <div className="p-2.5">
        <div className="text-xs font-semibold text-text-primary truncate">
          {screen.label}
        </div>
        <div className="flex items-center gap-2 mt-1 text-[10px] text-text-muted">
          <span>{screen.totalElements} elements</span>
          <span>·</span>
          <span>{screen.interactiveElements} interactive</span>
        </div>
      </div>
    </button>
  );
}
