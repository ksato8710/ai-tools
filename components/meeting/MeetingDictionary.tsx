"use client";

import { useState, useEffect, useCallback } from "react";
import { DictionaryEntry } from "@/lib/meeting-schema";

const CATEGORIES = [
  { value: "person", label: "人名" },
  { value: "company", label: "社名" },
  { value: "product", label: "製品名" },
  { value: "other", label: "その他" },
] as const;

const categoryLabel = (cat?: string) =>
  CATEGORIES.find((c) => c.value === cat)?.label ?? "その他";

export default function MeetingDictionary() {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [word, setWord] = useState("");
  const [category, setCategory] = useState<string>("person");
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/meeting/dictionary");
      setEntries(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const addEntry = async () => {
    if (!word.trim()) return;
    try {
      const res = await fetch("/api/meeting/dictionary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: word.trim(), category }),
      });
      setEntries(await res.json());
      setWord("");
    } catch {
      // ignore
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      const res = await fetch(`/api/meeting/dictionary?id=${id}`, {
        method: "DELETE",
      });
      setEntries(await res.json());
    } catch {
      // ignore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      addEntry();
    }
  };

  return (
    <div className="bg-card rounded-[16px] border border-border-light p-4">
      <h3 className="font-[family-name:var(--font-nunito)] font-bold text-text-primary mb-1 text-sm flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 4h10M3 8h7M3 12h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        固有名詞辞書
      </h3>
      <p className="text-[11px] text-text-muted mb-3">
        登録した単語をwhisperに事前に教えて認識精度を向上
      </p>

      {/* Add form */}
      <div className="flex gap-1.5 mb-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-2 py-1.5 text-xs border border-border-light rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-accent-leaf shrink-0"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="例: 武石、SBI証券Plus"
          className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-border-light rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-accent-leaf"
        />
        <button
          onClick={addEntry}
          disabled={!word.trim()}
          className="px-3 py-1.5 text-xs bg-accent-leaf text-white rounded-lg font-medium hover:bg-accent-leaf/90 transition-colors disabled:opacity-40 shrink-0"
        >
          追加
        </button>
      </div>

      {/* Entries list */}
      {loading ? (
        <p className="text-xs text-text-muted">読み込み中...</p>
      ) : entries.length === 0 ? (
        <p className="text-[11px] text-text-muted">未登録</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
          {entries.map((entry) => (
            <span
              key={entry.id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-cream/60 rounded-md text-xs group"
            >
              <span className="text-text-muted text-[10px]">
                {categoryLabel(entry.category)}
              </span>
              <span className="text-text-primary font-medium">
                {entry.word}
              </span>
              <button
                onClick={() => deleteEntry(entry.id)}
                className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-500 transition-all ml-0.5"
                title="削除"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
