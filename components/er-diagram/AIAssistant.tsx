"use client";

import { useState } from "react";
import type { ERDiagram, Entity, Relation } from "@/lib/er-schema";
import Button from "@/components/ui/Button";

type AIAction = "generate" | "suggest-entities" | "suggest-attributes" | "normalization-check";

interface AIAssistantProps {
  diagram: ERDiagram;
  selectedEntity: Entity | null;
  onApplyGenerated: (entities: Entity[], relations: Relation[], layout: ERDiagram["layout"]) => void;
  onApplyEntities: (entities: Entity[]) => void;
  onApplyAttributes: (entityId: string, attributes: Entity["attributes"]) => void;
  onClose: () => void;
}

export default function AIAssistant({
  diagram,
  selectedEntity,
  onApplyGenerated,
  onApplyEntities,
  onApplyAttributes,
  onClose,
}: AIAssistantProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | Array<unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<AIAction>("generate");

  const callAI = async (action: AIAction, data: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "AI request failed");
      setResult(json.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = () => {
    if (!input.trim()) return;
    callAI("generate", { input: input.trim() });
  };

  const handleSuggestEntities = () => {
    if (diagram.entities.length === 0) {
      setError("Add at least one entity first.");
      return;
    }
    callAI("suggest-entities", { diagram });
  };

  const handleSuggestAttributes = () => {
    if (!selectedEntity) {
      setError("Select an entity first.");
      return;
    }
    callAI("suggest-attributes", {
      entityName: selectedEntity.name,
      existingAttributes: selectedEntity.attributes.map((a) => a.name),
    });
  };

  const handleNormalizationCheck = () => {
    if (diagram.entities.length === 0) {
      setError("Add at least one entity first.");
      return;
    }
    callAI("normalization-check", { diagram });
  };

  const handleApply = () => {
    if (!result) return;

    if (activeAction === "generate") {
      const r = result as { entities: Entity[]; relations: Relation[] };
      const layout: ERDiagram["layout"] = {};
      r.entities.forEach((e, i) => {
        layout[e.id] = { x: 100 + (i % 3) * 300, y: 100 + Math.floor(i / 3) * 250 };
      });
      onApplyGenerated(r.entities, r.relations, layout);
    } else if (activeAction === "suggest-entities") {
      onApplyEntities(result as Entity[]);
    } else if (activeAction === "suggest-attributes" && selectedEntity) {
      const attrs = (result as Array<Entity["attributes"][number]>);
      onApplyAttributes(selectedEntity.id, attrs);
    }

    setResult(null);
    setInput("");
  };

  return (
    <aside className="w-80 bg-surface border-l border-border-light flex flex-col h-full">
      <div className="p-4 border-b border-border-light flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-nunito)] font-bold text-sm text-text-primary flex items-center gap-2">
          <span className="text-accent-leaf">✦</span> AI Assistant
        </h2>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary text-sm cursor-pointer">
          ✕
        </button>
      </div>

      {/* Action tabs */}
      <div className="flex border-b border-border-light overflow-x-auto">
        {(
          [
            ["generate", "Generate"],
            ["suggest-entities", "Entities"],
            ["suggest-attributes", "Attributes"],
            ["normalization-check", "Normalize"],
          ] as [AIAction, string][]
        ).map(([action, label]) => (
          <button
            key={action}
            onClick={() => { setActiveAction(action); setResult(null); setError(null); }}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeAction === action
                ? "text-accent-leaf border-b-2 border-accent-leaf"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Input area */}
        {activeAction === "generate" && (
          <div className="mb-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe your database... e.g., &quot;ECサイトのER図を作って&quot;"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-cream focus:outline-none focus:border-accent-leaf resize-none"
              rows={3}
            />
            <Button
              size="sm"
              className="mt-2 w-full"
              onClick={handleGenerate}
              disabled={loading || !input.trim()}
            >
              {loading ? "Generating..." : "Generate ER Diagram"}
            </Button>
          </div>
        )}

        {activeAction === "suggest-entities" && (
          <div className="mb-4">
            <p className="text-xs text-text-secondary mb-2">
              Analyze current entities and suggest missing ones.
            </p>
            <Button
              size="sm"
              className="w-full"
              onClick={handleSuggestEntities}
              disabled={loading}
            >
              {loading ? "Analyzing..." : "Suggest Entities"}
            </Button>
          </div>
        )}

        {activeAction === "suggest-attributes" && (
          <div className="mb-4">
            <p className="text-xs text-text-secondary mb-2">
              {selectedEntity
                ? `Suggest attributes for "${selectedEntity.name}"`
                : "Select an entity to get attribute suggestions."}
            </p>
            <Button
              size="sm"
              className="w-full"
              onClick={handleSuggestAttributes}
              disabled={loading || !selectedEntity}
            >
              {loading ? "Suggesting..." : "Suggest Attributes"}
            </Button>
          </div>
        )}

        {activeAction === "normalization-check" && (
          <div className="mb-4">
            <p className="text-xs text-text-secondary mb-2">
              Check normalization level and get improvement suggestions.
            </p>
            <Button
              size="sm"
              className="w-full"
              onClick={handleNormalizationCheck}
              disabled={loading}
            >
              {loading ? "Checking..." : "Run Normalization Check"}
            </Button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 bg-error/10 text-error text-xs rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-3">
            <div className="text-[11px] font-medium text-text-muted uppercase tracking-wide">
              Results
            </div>

            <div className="bg-card rounded-lg p-3 text-xs max-h-64 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-text-secondary">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>

            {activeAction !== "normalization-check" && (
              <Button size="sm" className="w-full" onClick={handleApply}>
                Apply to Diagram
              </Button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
