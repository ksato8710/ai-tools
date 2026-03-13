"use client";

import { MeetingSummary as MeetingSummaryType } from "@/lib/meeting-schema";

interface Props {
  summary: MeetingSummaryType;
}

export default function MeetingSummaryPanel({ summary }: Props) {
  return (
    <div className="bg-card rounded-[16px] border border-border-light p-6 space-y-5">
      <h3 className="font-[family-name:var(--font-nunito)] font-bold text-text-primary text-lg">
        AI議事録
      </h3>

      {/* Overview */}
      <div>
        <h4 className="text-sm font-semibold text-text-secondary mb-1.5">概要</h4>
        <p className="text-sm text-text-primary leading-relaxed">{summary.overview}</p>
      </div>

      {/* Key Points */}
      {summary.keyPoints.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-text-secondary mb-1.5">要点</h4>
          <ul className="space-y-1.5">
            {summary.keyPoints.map((point, i) => (
              <li key={i} className="flex gap-2 text-sm text-text-primary">
                <span className="text-accent-leaf shrink-0 mt-0.5">-</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Decisions */}
      {summary.decisions.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-text-secondary mb-1.5">決定事項</h4>
          <ul className="space-y-1.5">
            {summary.decisions.map((decision, i) => (
              <li key={i} className="flex gap-2 text-sm text-text-primary">
                <span className="text-accent-bark shrink-0 mt-0.5">-</span>
                <span>{decision}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Items */}
      {summary.actionItems.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-text-secondary mb-1.5">アクションアイテム</h4>
          <div className="space-y-2">
            {summary.actionItems.map((item, i) => (
              <div
                key={i}
                className="bg-cream rounded-lg p-3 border border-border-light"
              >
                <p className="text-sm text-text-primary font-medium">{item.task}</p>
                <div className="flex gap-3 mt-1">
                  {item.assignee && (
                    <span className="text-xs text-text-muted">
                      担当: {item.assignee}
                    </span>
                  )}
                  {item.deadline && (
                    <span className="text-xs text-text-muted">
                      期限: {item.deadline}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
