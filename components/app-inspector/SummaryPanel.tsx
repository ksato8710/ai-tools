"use client";

import type { AnalysisSummary } from "@/lib/app-inspector-schema";

interface Props {
  summary: AnalysisSummary;
}

export default function SummaryPanel({ summary }: Props) {
  return (
    <div className="space-y-4">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Screens" value={String(summary.totalScreens)} />
        <StatCard
          label="Avg Interactive"
          value={String(summary.avgInteractiveElements)}
        />
        <StatCard label="Navigation" value={summary.navigationPattern} small />
        <StatCard
          label="Components"
          value={String(summary.componentInventory.length)}
          suffix="types"
        />
      </div>

      {/* Component inventory */}
      <div>
        <h4 className="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
          Component Inventory
        </h4>
        <div className="space-y-1.5">
          {summary.componentInventory.map((c) => (
            <div key={c.type} className="flex items-center gap-2">
              <span className="text-xs font-mono text-accent-leaf w-20 truncate">
                {c.type}
              </span>
              <div className="flex-1 h-2 bg-card rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-leaf/40 rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      (c.count /
                        Math.max(
                          ...summary.componentInventory.map((x) => x.count)
                        )) *
                        100
                    )}%`,
                  }}
                />
              </div>
              <span className="text-xs text-text-muted w-8 text-right">
                {c.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  small,
}: {
  label: string;
  value: string;
  suffix?: string;
  small?: boolean;
}) {
  return (
    <div className="bg-card rounded-xl p-3 border border-border-light">
      <div className="text-[10px] text-text-muted uppercase tracking-wide mb-1">
        {label}
      </div>
      <div
        className={`font-[family-name:var(--font-nunito)] font-bold text-text-primary ${
          small ? "text-sm" : "text-xl"
        }`}
      >
        {value}
        {suffix && (
          <span className="text-xs text-text-muted font-normal ml-1">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
