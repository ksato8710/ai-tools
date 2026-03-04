import Header from "@/components/layout/Header";
import ToolCard from "@/components/layout/ToolCard";

export default function Home() {
  return (
    <div className="min-h-screen bg-cream">
      <Header />
      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="font-[family-name:var(--font-nunito)] text-4xl font-extrabold text-text-primary mb-3">
            AI Tools Suite
          </h1>
          <p className="text-text-secondary text-lg max-w-xl mx-auto">
            AIを活用したシンプルなツール群。設計・プレゼン・評価をもっと効率的に。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ToolCard
            title="ER Diagram"
            description="自然言語からER図を自動生成。エンティティ・リレーションの追加・編集も直感的に。"
            icon={<ERIcon />}
            href="/er-diagram"
            category="Database"
          />
          <ToolCard
            title="Presentation Slides"
            description="テキストからプレゼンスライドを自動生成。構成・デザインもAIがサポート。"
            icon={<SlidesIcon />}
            comingSoon
            category="Presentation"
          />
          <ToolCard
            title="Heuristic Evaluation"
            description="UIスクリーンショットからヒューリスティック評価を自動実行。改善提案も。"
            icon={<EvalIcon />}
            comingSoon
            category="UX / UI"
          />
        </div>
      </main>
    </div>
  );
}

function ERIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect x="2" y="4" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="18" y="18" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M14 9h4v0a5 5 0 0 1 5 5v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
      <circle cx="24" cy="22" r="1" fill="currentColor" />
    </svg>
  );
}

function SlidesIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect x="4" y="6" width="24" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <line x1="10" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="10" y1="17" x2="18" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="24" x2="18" y2="28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function EvalIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path d="M8 28V4l8 6 8-6v24l-8-6-8 6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M13 14l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
