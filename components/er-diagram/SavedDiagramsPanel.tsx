"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";

interface DiagramEntry {
  id: string;
  name: string;
  updatedAt: string;
}

interface SavedDiagramsPanelProps {
  onLoad: (id: string) => void;
  onClose: () => void;
}

export default function SavedDiagramsPanel({
  onLoad,
  onClose,
}: SavedDiagramsPanelProps) {
  const [diagrams, setDiagrams] = useState<DiagramEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDiagrams = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/diagrams");
      const data = await res.json();
      setDiagrams(data);
    } catch {
      console.error("Failed to fetch diagrams");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagrams();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this diagram?")) return;
    try {
      await fetch(`/api/diagrams/${id}`, { method: "DELETE" });
      setDiagrams((prev) => prev.filter((d) => d.id !== id));
    } catch {
      console.error("Failed to delete diagram");
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="w-72 bg-surface border-l border-border-light flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
        <h3 className="text-sm font-semibold text-text-primary font-heading">
          Saved Diagrams
        </h3>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && (
          <p className="text-text-muted text-xs text-center py-4">Loading...</p>
        )}
        {!loading && diagrams.length === 0 && (
          <p className="text-text-muted text-xs text-center py-4">
            No saved diagrams
          </p>
        )}
        {diagrams.map((d) => (
          <div
            key={d.id}
            className="bg-card rounded-xl p-3 border border-border-light hover:border-border transition-colors"
          >
            <p className="text-sm font-medium text-text-primary truncate">
              {d.name}
            </p>
            <p className="text-xs text-text-muted mt-1">{formatDate(d.updatedAt)}</p>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="primary" onClick={() => onLoad(d.id)}>
                Open
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(d.id)}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
