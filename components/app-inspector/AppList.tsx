"use client";

import { useState, useEffect, useMemo } from "react";

interface InstalledApp {
  packageName: string;
  appName: string;
  isSystemApp: boolean;
}

interface Props {
  onSelect: (packageName: string, appName: string) => void;
  isCapturing: boolean;
}

export default function AppList({ onSelect, isCapturing }: Props) {
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchApps = async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (showAll) params.set("all", "true");
      if (refresh) params.set("refresh", "true");
      const res = await fetch(`/api/app-inspector/apps?${params}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setApps(data.apps || []);
        setLoaded(true);
      }
    } catch {
      setError("端末との接続に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loaded) {
      fetchApps();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAll]);

  const filtered = useMemo(() => {
    if (!search.trim()) return apps;
    const q = search.toLowerCase();
    return apps.filter(
      (a) =>
        a.packageName.toLowerCase().includes(q) ||
        a.appName.toLowerCase().includes(q)
    );
  }, [apps, search]);

  if (!loaded && !loading) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={fetchApps}
          disabled={isCapturing}
          className="w-full py-2.5 px-4 bg-card border border-border-light rounded-xl text-sm font-medium
                     text-text-primary hover:bg-cream transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="shrink-0"
          >
            <rect
              x="4"
              y="2"
              width="8"
              height="12"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <line
              x1="6"
              y1="11"
              x2="10"
              y2="11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          端末のアプリ一覧を取得
        </button>
        <p className="text-[11px] text-text-muted text-center">
          ADB接続済みの端末からインストール済みアプリを取得します
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
          インストール済みアプリ
        </h3>
        <button
          type="button"
          onClick={() => fetchApps(true)}
          disabled={loading || isCapturing}
          className="text-[11px] text-accent-leaf hover:underline disabled:opacity-50"
        >
          {loading ? "取得中…" : "更新"}
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 bg-error/10 border border-error/20 rounded-lg text-xs text-error">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
        >
          <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M9 9l3 3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="アプリ名・パッケージ名で検索…"
          className="w-full pl-8 pr-3 py-2 bg-surface border border-border-light rounded-lg text-xs
                     focus:outline-none focus:border-accent-leaf/50 focus:ring-1 focus:ring-accent-leaf/20
                     placeholder:text-text-muted"
        />
      </div>

      {/* Toggle system apps */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={showAll}
          onChange={(e) => setShowAll(e.target.checked)}
          className="accent-accent-leaf w-3.5 h-3.5"
        />
        <span className="text-[11px] text-text-muted">
          システムアプリも表示
        </span>
      </label>

      {/* Loading state with progress hint */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <span className="inline-block w-5 h-5 border-2 border-accent-leaf/30 border-t-accent-leaf rounded-full animate-spin" />
          <p className="text-[11px] text-text-muted">
            アプリ情報を取得中…（初回は時間がかかります）
          </p>
        </div>
      ) : (
        <div className="max-h-[360px] overflow-y-auto -mx-1 px-1 space-y-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-4">
              {search ? "一致するアプリがありません" : "アプリが見つかりません"}
            </p>
          ) : (
            <>
              <p className="text-[10px] text-text-muted mb-1">
                {filtered.length}件{search && ` (${apps.length}件中)`}
              </p>
              {filtered.map((app) => (
                <button
                  key={app.packageName}
                  type="button"
                  onClick={() => onSelect(app.packageName, app.appName)}
                  disabled={isCapturing}
                  className="w-full text-left px-3 py-2.5 rounded-lg border border-transparent
                             hover:bg-accent-leaf/5 hover:border-accent-leaf/20
                             transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                             group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text-primary truncate">
                        {app.appName !== app.packageName ? app.appName : shortName(app.packageName)}
                      </div>
                      <div className="text-[10px] font-mono text-text-muted truncate">
                        {app.packageName}
                      </div>
                    </div>
                    {app.isSystemApp && (
                      <span className="shrink-0 text-[9px] px-1.5 py-0.5 bg-card rounded text-text-muted">
                        system
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-accent-leaf opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                    このアプリを解析 →
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Extract a readable short name from a package name: last segment, capitalized */
function shortName(pkg: string): string {
  const last = pkg.split(".").pop() || pkg;
  return last.charAt(0).toUpperCase() + last.slice(1);
}
