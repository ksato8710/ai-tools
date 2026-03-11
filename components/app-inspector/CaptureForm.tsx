"use client";

import { useState, useEffect } from "react";

interface Props {
  onStart: (appPackage: string, appName: string, maxScreens: number) => void;
  isCapturing: boolean;
  selectedPackage?: string | null;
  selectedAppName?: string | null;
  onClearSelection?: () => void;
}

export default function CaptureForm({
  onStart,
  isCapturing,
  selectedPackage,
  selectedAppName,
  onClearSelection,
}: Props) {
  const [appPackage, setAppPackage] = useState("");
  const [appName, setAppName] = useState("");
  const [maxScreens, setMaxScreens] = useState(5);

  useEffect(() => {
    if (selectedPackage) {
      setAppPackage(selectedPackage);
      if (selectedAppName) {
        setAppName(selectedAppName);
      }
    }
  }, [selectedPackage, selectedAppName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appPackage.trim()) return;
    onStart(appPackage.trim(), appName.trim(), maxScreens);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          Package Name *
        </label>
        {selectedPackage ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2.5 bg-accent-leaf/5 border border-accent-leaf/20 rounded-xl text-xs font-mono text-text-primary truncate">
              {selectedPackage}
            </div>
            <button
              type="button"
              onClick={() => {
                setAppPackage("");
                onClearSelection?.();
              }}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg
                         hover:bg-card transition-colors text-text-muted hover:text-text-primary"
              title="選択を解除"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M4 4l6 6M10 4l-6 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        ) : (
          <input
            type="text"
            value={appPackage}
            onChange={(e) => setAppPackage(e.target.value)}
            placeholder="jp.saitamacity.rsa"
            disabled={isCapturing}
            className="w-full px-3 py-2.5 bg-surface border border-border-light rounded-xl text-sm
                       focus:outline-none focus:border-accent-leaf/50 focus:ring-1 focus:ring-accent-leaf/20
                       disabled:opacity-50 placeholder:text-text-muted"
          />
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          App Name (optional)
        </label>
        <input
          type="text"
          value={appName}
          onChange={(e) => setAppName(e.target.value)}
          placeholder="さいたま市みんなのアプリ"
          disabled={isCapturing}
          className="w-full px-3 py-2.5 bg-surface border border-border-light rounded-xl text-sm
                     focus:outline-none focus:border-accent-leaf/50 focus:ring-1 focus:ring-accent-leaf/20
                     disabled:opacity-50 placeholder:text-text-muted"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          Max Screens: {maxScreens}
        </label>
        <input
          type="range"
          min={1}
          max={20}
          value={maxScreens}
          onChange={(e) => setMaxScreens(Number(e.target.value))}
          disabled={isCapturing}
          className="w-full accent-accent-leaf"
        />
        <div className="flex justify-between text-[10px] text-text-muted mt-0.5">
          <span>1</span>
          <span>20</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={isCapturing || !appPackage.trim()}
        className="w-full py-2.5 px-4 bg-accent-leaf text-white rounded-xl text-sm font-semibold
                   hover:bg-accent-leaf-hover transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center justify-center gap-2"
      >
        {isCapturing ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Capturing…
          </>
        ) : (
          <>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="shrink-0"
            >
              <rect
                x="2"
                y="3"
                width="12"
                height="10"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Start Capture
          </>
        )}
      </button>
    </form>
  );
}
