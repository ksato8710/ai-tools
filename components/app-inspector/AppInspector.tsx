"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  AppInspectorSession,
  CapturedScreen,
} from "@/lib/app-inspector-schema";
import SessionList from "./SessionList";
import CaptureForm from "./CaptureForm";
import AppList from "./AppList";
import ScreenGallery from "./ScreenGallery";
import ScreenDetail from "./ScreenDetail";
import SummaryPanel from "./SummaryPanel";

export default function AppInspector() {
  const [sessions, setSessions] = useState<AppInspectorSession[]>([]);
  const [activeSession, setActiveSession] =
    useState<AppInspectorSession | null>(null);
  const [selectedScreen, setSelectedScreen] = useState<CapturedScreen | null>(
    null
  );
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [selectedAppName, setSelectedAppName] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/app-inspector");
      const data = await res.json();
      setSessions(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Select session
  const handleSelectSession = async (id: string) => {
    try {
      const res = await fetch(`/api/app-inspector/${id}`);
      const data = await res.json();
      setActiveSession(data);
      setSelectedScreen(null);
      setError(null);
    } catch {
      setError("Failed to load session");
    }
  };

  // Start capture
  const handleStartCapture = async (
    appPackage: string,
    appName: string,
    maxScreens: number
  ) => {
    setIsCapturing(true);
    setError(null);

    try {
      // Create session
      const createRes = await fetch("/api/app-inspector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appPackage,
          appName: appName || appPackage,
          deviceName: "default",
        }),
      });
      const { id } = await createRes.json();

      // Start capture
      const captureRes = await fetch(`/api/app-inspector/${id}/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxScreens }),
      });

      if (!captureRes.ok) {
        const err = await captureRes.json();
        setError(err.error || "Capture failed");
      }

      // Reload
      await loadSessions();
      await handleSelectSession(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Capture failed");
    } finally {
      setIsCapturing(false);
    }
  };

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
              New Capture
            </h2>
            <CaptureForm
              onStart={handleStartCapture}
              isCapturing={isCapturing}
              selectedPackage={selectedPackage}
              selectedAppName={selectedAppName}
              onClearSelection={() => {
                setSelectedPackage(null);
                setSelectedAppName(null);
              }}
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
                <div>
                  <h2 className="font-[family-name:var(--font-nunito)] text-xl font-bold text-text-primary">
                    {activeSession.appName}
                  </h2>
                  <p className="text-xs text-text-muted font-mono">
                    {activeSession.appPackage}
                  </p>
                </div>
              </div>

              {/* Summary */}
              {activeSession.summary && (
                <SummaryPanel summary={activeSession.summary} />
              )}

              {/* Screen gallery */}
              <div>
                <h3 className="font-[family-name:var(--font-nunito)] text-sm font-bold text-text-primary mb-3">
                  Captured Screens
                </h3>
                <ScreenGallery
                  screens={activeSession.screens}
                  onSelectScreen={setSelectedScreen}
                  selectedId={selectedScreen?.id || null}
                />
              </div>

              {/* Screen detail */}
              {selectedScreen && (
                <div className="bg-surface rounded-2xl border border-border-light p-5">
                  <ScreenDetail screen={selectedScreen} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
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
        左のフォームにパッケージ名を入力して「Start Capture」をクリック。
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
