"use client";

import { useState } from "react";
import { TranscriptSegment } from "@/lib/meeting-schema";

interface Props {
  segments: TranscriptSegment[];
  rawTranscript?: string;
}

export default function MeetingTranscript({ segments, rawTranscript }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    const text = showRaw
      ? rawTranscript || ""
      : segments.map((s) => `[${s.start} → ${s.end}] ${s.text}`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card rounded-[16px] border border-border-light p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-[family-name:var(--font-nunito)] font-bold text-text-primary">
          トランスクリプト
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="text-xs px-3 py-1 rounded-full border border-border-light hover:bg-cream transition-colors text-text-secondary"
          >
            {showRaw ? "タイムライン表示" : "テキスト表示"}
          </button>
          <button
            onClick={copyToClipboard}
            className="text-xs px-3 py-1 rounded-full border border-border-light hover:bg-cream transition-colors text-text-secondary"
          >
            {copied ? "コピーしました" : "コピー"}
          </button>
        </div>
      </div>

      {showRaw ? (
        <div className="bg-cream rounded-lg p-4 max-h-96 overflow-y-auto">
          <pre className="text-sm text-text-primary whitespace-pre-wrap font-sans leading-relaxed">
            {rawTranscript}
          </pre>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {segments.map((segment, i) => (
            <div key={i} className="flex gap-3 py-1.5">
              <span className="text-[11px] text-text-muted font-mono whitespace-nowrap pt-0.5 shrink-0">
                {segment.start.slice(0, 8)}
              </span>
              <p className="text-sm text-text-primary leading-relaxed">
                {segment.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
