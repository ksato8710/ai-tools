"use client";

import Link from "next/link";

interface SessionSummary {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "completed";
  updatedAt: string;
  createdAt: string;
}

interface PresentationSessionListProps {
  sessions: SessionSummary[];
  loading: boolean;
  onDelete: (id: string) => void;
}

export default function PresentationSessionList({
  sessions,
  loading,
  onDelete,
}: PresentationSessionListProps) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Hero */}
      <div className="mb-10">
        <h1 className="font-[family-name:var(--font-nunito)] text-3xl font-extrabold text-text-primary mb-2">
          Presentation Slides
        </h1>
        <p className="text-text-secondary text-lg">
          AIエージェントと協働してプレゼンテーションスライドを設計・作成・編集
        </p>
      </div>

      {/* How it works */}
      <div className="mb-10 p-6 bg-white rounded-2xl border border-border-light">
        <h2 className="font-[family-name:var(--font-nunito)] text-lg font-bold text-text-primary mb-4">
          How it works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Step
            num={1}
            title="AIが設計をドラフト"
            description="Claude Code / Codexに「○○の営業資料を作って」と指示。想定読者・目的・アウトラインをAIがドラフトします。"
            code='POST /api/presentation { name, presentation }'
          />
          <Step
            num={2}
            title="設計を確認・調整"
            description="ブラウザでスライドをプレビュー。想定読者・目的・アウトライン・各スライドをインタラクティブに編集。"
            code="http://localhost:3000/presentation"
          />
          <Step
            num={3}
            title="反復して完成"
            description="調整結果をAIに戻し、スライドを再生成。設計⇄プレビューを繰り返して完成度を高めます。"
            code="PATCH /api/presentation/:id"
          />
        </div>
      </div>

      {/* API guide */}
      <details className="mb-10 bg-white rounded-2xl border border-border-light overflow-hidden">
        <summary className="px-6 py-4 cursor-pointer hover:bg-cream transition-colors font-[family-name:var(--font-nunito)] font-bold text-text-primary">
          API Reference
        </summary>
        <div className="px-6 pb-6 space-y-4">
          <div>
            <p className="text-sm text-text-secondary mb-2">
              AIエージェントからREST APIでセッションを操作:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
              <ApiRow method="POST" path="/api/presentation" desc="セッション作成" />
              <ApiRow method="GET" path="/api/presentation" desc="セッション一覧" />
              <ApiRow method="GET" path="/api/presentation/:id" desc="セッション取得" />
              <ApiRow method="PATCH" path="/api/presentation/:id" desc="セッション更新" />
              <ApiRow method="DELETE" path="/api/presentation/:id" desc="セッション削除" />
            </div>
          </div>
          <div>
            <p className="text-sm text-text-secondary mb-2">使用例（Claude Codeへの指示）:</p>
            <pre className="text-xs bg-cream rounded-lg p-4 overflow-x-auto text-text-primary font-mono leading-relaxed">
{`「alceoの営業資料をプレゼンスライドとして作成して」
「このプレゼンのアウトラインを見直して、課題提起をもっと強調して」
「スライド5のレイアウトをstatsに変えて、数字を目立たせて」`}
            </pre>
          </div>
        </div>
      </details>

      {/* Sessions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-[family-name:var(--font-nunito)] text-lg font-bold text-text-primary">
            Sessions
          </h2>
          {sessions.length > 0 && (
            <span className="text-sm text-text-muted">
              {sessions.length} sessions
            </span>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-text-muted">Loading...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-border-light border-dashed">
            <div className="text-text-muted mb-2">
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="mx-auto mb-3 opacity-40"
              >
                <rect x="6" y="8" width="28" height="20" rx="3" />
                <path d="M14 16h12M14 22h8" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-text-secondary font-medium mb-1">
              まだセッションがありません
            </p>
            <p className="text-sm text-text-muted">
              AIエージェントからAPIでセッションを作成すると、ここに表示されます
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/presentation/${session.id}`}
                className="block w-full text-left p-4 rounded-xl border border-border-light bg-white hover:border-border hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-text-primary truncate">
                        {session.name}
                      </h3>
                      <StatusBadge status={session.status} />
                    </div>
                    <p className="text-sm text-text-secondary truncate">
                      {session.description}
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      {formatRelativeTime(session.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDelete(session.id);
                      }}
                      className="p-2 rounded-full text-text-muted opacity-0 group-hover:opacity-100 hover:text-error hover:bg-card transition-all"
                      title="Delete session"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path
                          d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-text-muted"
                    >
                      <path
                        d="M6 4l4 4-4 4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-warning/10 text-warning",
    active: "bg-accent-leaf/10 text-accent-leaf",
    completed: "bg-card text-text-muted",
  };
  return (
    <span
      className={`px-2 py-0.5 text-xs rounded-full shrink-0 ${
        styles[status] || styles.draft
      }`}
    >
      {status}
    </span>
  );
}

function Step({
  num,
  title,
  description,
  code,
}: {
  num: number;
  title: string;
  description: string;
  code: string;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 rounded-full bg-accent-leaf text-white text-xs font-bold flex items-center justify-center shrink-0">
          {num}
        </span>
        <span className="font-medium text-text-primary text-sm">{title}</span>
      </div>
      <p className="text-sm text-text-secondary leading-relaxed mb-2">
        {description}
      </p>
      <code className="text-xs bg-cream px-2 py-1 rounded text-accent-bark font-mono">
        {code}
      </code>
    </div>
  );
}

function ApiRow({
  method,
  path,
  desc,
}: {
  method: string;
  path: string;
  desc: string;
}) {
  const colors: Record<string, string> = {
    GET: "text-accent-leaf",
    POST: "text-blue-600",
    PATCH: "text-warning",
    DELETE: "text-error",
  };
  return (
    <div className="flex items-center gap-2 bg-cream rounded-lg px-3 py-2">
      <span className={`font-bold ${colors[method] ?? "text-text-primary"}`}>
        {method}
      </span>
      <span className="text-text-primary">{path}</span>
      <span className="text-text-muted ml-auto">{desc}</span>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("ja-JP");
}
