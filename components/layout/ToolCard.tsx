"use client";

import Link from "next/link";

interface ToolCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
  comingSoon?: boolean;
  category: string;
}

export default function ToolCard({
  title,
  description,
  icon,
  href,
  comingSoon = false,
  category,
}: ToolCardProps) {
  const content = (
    <div
      className={`
        relative group bg-card rounded-[16px] p-6 border border-border-light
        transition-all duration-200
        ${comingSoon ? "opacity-60 cursor-default" : "hover:shadow-lg hover:shadow-shadow hover:border-accent-leaf/30 hover:-translate-y-0.5 cursor-pointer"}
      `}
    >
      <div className="absolute top-4 right-4">
        <span className="text-[10px] font-medium text-text-muted bg-cream px-2 py-0.5 rounded-full border border-border-light">
          {category}
        </span>
      </div>

      {comingSoon && (
        <div className="absolute top-4 left-4">
          <span className="text-[10px] font-semibold text-accent-bark bg-warning/20 px-2 py-0.5 rounded-full">
            Coming Soon
          </span>
        </div>
      )}

      <div className="mt-4 mb-4 text-accent-leaf text-3xl">{icon}</div>

      <h3 className="font-[family-name:var(--font-nunito)] text-lg font-bold text-text-primary mb-2">
        {title}
      </h3>
      <p className="text-sm text-text-secondary leading-relaxed">
        {description}
      </p>

      {!comingSoon && (
        <div className="mt-4 flex items-center gap-1 text-sm text-accent-leaf font-medium group-hover:gap-2 transition-all">
          Open tool
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform group-hover:translate-x-0.5">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  );

  if (comingSoon || !href) return content;
  return <Link href={href}>{content}</Link>;
}
