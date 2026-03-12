"use client";

import { useState, useEffect } from "react";

export type CaptureMode = "screenshot" | "analysis" | "both";

interface Props {
  onStart: (appPackage: string, appName: string, maxScreens: number, mode: CaptureMode) => void;
  onAppendCapture?: (mode: CaptureMode, maxScreens: number) => void;
  isCapturing: boolean;
  selectedPackage?: string | null;
  selectedAppName?: string | null;
  onClearSelection?: () => void;
  hasActiveSession?: boolean;
}

interface DeviceStatus {
  ready: boolean;
  screenOn: boolean;
  unlocked: boolean;
  message: string;
}

export default function CaptureForm({
  onStart,
  onAppendCapture,
  isCapturing,
  selectedPackage,
  selectedAppName,
  onClearSelection,
  hasActiveSession,
}: Props) {
  const [appPackage, setAppPackage] = useState("");
  const [appName, setAppName] = useState("");
  const [maxScreens, setMaxScreens] = useState(5);
  const [mode, setMode] = useState<CaptureMode>("both");
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [checkingDevice, setCheckingDevice] = useState(false);

  useEffect(() => {
    if (selectedPackage) {
      setAppPackage(selectedPackage);
      if (selectedAppName) {
        setAppName(selectedAppName);
      }
    }
  }, [selectedPackage, selectedAppName]);

  const checkDevice = async (): Promise<boolean> => {
    setCheckingDevice(true);
    try {
      const res = await fetch("/api/app-inspector/device-status");
      const status: DeviceStatus = await res.json();
      setDeviceStatus(status);
      return status.ready;
    } catch {
      setDeviceStatus({ ready: false, screenOn: false, unlocked: false, message: "端末の状態を確認できませんでした。" });
      return false;
    } finally {
      setCheckingDevice(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appPackage.trim()) return;
    // Check device readiness before starting capture
    const ready = await checkDevice();
    if (!ready) return;
    setDeviceStatus(null);
    onStart(appPackage.trim(), appName.trim(), maxScreens, mode);
  };

  const handleAppend = async (appendMode: CaptureMode) => {
    const ready = await checkDevice();
    if (!ready) return;
    setDeviceStatus(null);
    onAppendCapture?.(appendMode, maxScreens);
  };

  return (
    <div className="space-y-4">
      {/* Mode selection */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-2">
          キャプチャモード
        </label>
        <div className="grid grid-cols-3 gap-1 bg-card rounded-lg p-1 border border-border-light">
          <ModeButton
            active={mode === "both"}
            onClick={() => setMode("both")}
            disabled={isCapturing}
          >
            両方
          </ModeButton>
          <ModeButton
            active={mode === "screenshot"}
            onClick={() => setMode("screenshot")}
            disabled={isCapturing}
          >
            画像のみ
          </ModeButton>
          <ModeButton
            active={mode === "analysis"}
            onClick={() => setMode("analysis")}
            disabled={isCapturing}
          >
            構造のみ
          </ModeButton>
        </div>
        <p className="text-[10px] text-text-muted mt-1">
          {mode === "both" && "スクリーンショット + UI構造を取得"}
          {mode === "screenshot" && "スクリーンショットのみ取得（高速）"}
          {mode === "analysis" && "UI構造ツリーのみ取得（高速）"}
        </p>
      </div>

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

        {/* Device status warning */}
        {deviceStatus && !deviceStatus.ready && (
          <div className="px-3 py-2.5 bg-warning/10 border border-warning/20 rounded-xl text-xs text-accent-bark flex items-start gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
              <path d="M7 1L1 13h12L7 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              <path d="M7 5.5v3M7 10.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <div>
              <div className="font-medium mb-0.5">{deviceStatus.message}</div>
              <div className="text-[10px] text-text-muted">
                {!deviceStatus.screenOn && "画面OFF → 電源ボタンを押してください"}
                {deviceStatus.screenOn && !deviceStatus.unlocked && "PIN/パターンでロック解除してください"}
              </div>
              <button
                type="button"
                onClick={() => checkDevice()}
                disabled={checkingDevice}
                className="mt-1.5 text-[10px] px-2 py-0.5 bg-surface rounded border border-border-light
                           hover:bg-card transition-colors disabled:opacity-50"
              >
                {checkingDevice ? "確認中..." : "再チェック"}
              </button>
            </div>
          </div>
        )}

        {/* New Capture button */}
        <button
          type="submit"
          disabled={isCapturing || checkingDevice || !appPackage.trim()}
          className="w-full py-2.5 px-4 bg-accent-leaf text-white rounded-xl text-sm font-semibold
                     hover:bg-accent-leaf-hover transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
        >
          {isCapturing || checkingDevice ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {checkingDevice ? "端末確認中…" : "Capturing…"}
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              新規キャプチャ
            </>
          )}
        </button>
      </form>

      {/* Append to active session */}
      {hasActiveSession && !isCapturing && (
        <div className="border-t border-border-light pt-4">
          <p className="text-[10px] text-text-muted mb-2 uppercase tracking-wide font-semibold">
            選択中セッションに追加
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleAppend("screenshot")}
              disabled={isCapturing}
              className="py-2 px-3 bg-card border border-border-light rounded-lg text-xs font-medium
                         text-text-primary hover:bg-cream transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + 画像を追加
            </button>
            <button
              type="button"
              onClick={() => handleAppend("analysis")}
              disabled={isCapturing}
              className="py-2 px-3 bg-card border border-border-light rounded-lg text-xs font-medium
                         text-text-primary hover:bg-cream transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + 構造を追加
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors
        ${active
          ? "bg-surface text-text-primary shadow-sm"
          : "text-text-muted hover:text-text-secondary"
        }
        disabled:opacity-50
      `}
    >
      {children}
    </button>
  );
}
