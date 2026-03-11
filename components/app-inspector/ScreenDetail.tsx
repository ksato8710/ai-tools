"use client";

import { useState } from "react";
import Image from "next/image";
import type { CapturedScreen } from "@/lib/app-inspector-schema";

interface Props {
  screen: CapturedScreen;
}

export default function ScreenDetail({ screen }: Props) {
  const [tab, setTab] = useState<"screenshot" | "tree" | "elements">(
    "screenshot"
  );

  const elements = parseElements(screen.snapshotTree);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-[family-name:var(--font-nunito)] text-lg font-bold text-text-primary">
            #{screen.index + 1} {screen.label}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {screen.totalElements} elements · {screen.interactiveElements}{" "}
            interactive
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-card rounded-xl p-1">
        {(["screenshot", "tree", "elements"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
              tab === t
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {t === "screenshot"
              ? "Screenshot"
              : t === "tree"
                ? "UI Tree"
                : "Elements"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "screenshot" && (
        <div className="relative w-full max-w-[320px] mx-auto">
          <div className="relative aspect-[9/19.5] rounded-2xl overflow-hidden border-4 border-text-primary/10 shadow-lg">
            <Image
              src={screen.screenshotPath}
              alt={screen.label}
              fill
              className="object-cover object-top"
              sizes="320px"
              priority
            />
          </div>
        </div>
      )}

      {tab === "tree" && (
        <div className="bg-text-primary rounded-xl p-4 overflow-auto max-h-[500px]">
          <pre className="text-xs text-green-400 font-mono whitespace-pre leading-relaxed">
            {screen.snapshotTree || "(No snapshot data)"}
          </pre>
        </div>
      )}

      {tab === "elements" && (
        <div className="space-y-1 max-h-[500px] overflow-auto">
          {elements.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-sm">
              No elements parsed
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border-light">
                  <th className="text-left py-2 px-2 font-medium">Ref</th>
                  <th className="text-left py-2 px-2 font-medium">Type</th>
                  <th className="text-left py-2 px-2 font-medium">Label</th>
                </tr>
              </thead>
              <tbody>
                {elements.map((el, i) => (
                  <tr
                    key={i}
                    className="border-b border-border-light/50 hover:bg-card/50"
                  >
                    <td className="py-1.5 px-2 font-mono text-accent-leaf">
                      {el.ref}
                    </td>
                    <td className="py-1.5 px-2">
                      <span className="inline-block bg-card px-1.5 py-0.5 rounded text-text-secondary">
                        {el.type}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-text-primary truncate max-w-[200px]">
                      {el.label || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function parseElements(
  raw: string
): { ref: string; type: string; label: string }[] {
  const elements: { ref: string; type: string; label: string }[] = [];
  if (!raw) return elements;
  const lines = raw.split("\n");
  for (const line of lines) {
    const match = line.match(
      /(@\w+)\s+\[(\w+(?:\s+\w+)*)\]\s*"?([^"]*)"?/
    );
    if (match) {
      elements.push({
        ref: match[1],
        type: match[2],
        label: match[3].trim(),
      });
    }
  }
  return elements;
}
