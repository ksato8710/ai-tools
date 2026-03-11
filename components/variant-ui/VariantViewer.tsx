"use client";

import { useState, useEffect, useCallback } from "react";
import type { VariantSession, Variant } from "@/lib/variant-schema";
import SessionList from "./SessionList";
import VariantToolbar from "./VariantToolbar";
import VariantGrid from "./VariantGrid";
import VariantCodePanel from "./VariantCodePanel";

type SessionSummary = Pick<
  VariantSession,
  "id" | "name" | "prompt" | "status" | "updatedAt" | "createdAt"
>;

export default function VariantViewer() {
  // Session list state
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Active session state
  const [activeSession, setActiveSession] = useState<VariantSession | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // View controls
  const [columns, setColumns] = useState<1 | 2 | 3>(2);
  const [filter, setFilter] = useState<"all" | "starred" | "selected">("all");
  const [responsive, setResponsive] = useState<"desktop" | "mobile">("desktop");
  const [codeVariant, setCodeVariant] = useState<Variant | null>(null);

  // Fetch session list
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/variant-ui");
      const data = await res.json();
      setSessions(data);
    } catch {
      // silently fail
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  // Fetch active session detail
  const fetchActiveSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/variant-ui/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setActiveSession(data);
    } catch {
      // silently fail
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Poll active session for new variants (3s)
  useEffect(() => {
    if (!activeSessionId) return;
    fetchActiveSession(activeSessionId);
    const interval = setInterval(() => fetchActiveSession(activeSessionId), 3000);
    return () => clearInterval(interval);
  }, [activeSessionId, fetchActiveSession]);

  // Select/Star handlers
  const handleAction = async (
    variantId: string,
    action: "select" | "unselect" | "star" | "unstar"
  ) => {
    if (!activeSessionId) return;
    await fetch(`/api/variant-ui/${activeSessionId}/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId, action }),
    });
    fetchActiveSession(activeSessionId);
  };

  const handleSelect = (id: string, selected: boolean) =>
    handleAction(id, selected ? "select" : "unselect");

  const handleStar = (id: string, starred: boolean) =>
    handleAction(id, starred ? "star" : "unstar");

  const handleDeleteSession = async (id: string) => {
    await fetch(`/api/variant-ui/${id}`, { method: "DELETE" });
    fetchSessions();
    if (activeSessionId === id) {
      setActiveSessionId(null);
      setActiveSession(null);
    }
  };

  // Filter variants
  const filteredVariants = activeSession
    ? activeSession.variants.filter((v) => {
        if (filter === "starred") return v.starred;
        if (filter === "selected") return v.selected;
        return true;
      })
    : [];

  // Session list view
  if (!activeSessionId) {
    return (
      <div className="min-h-screen bg-cream">
        <SessionList
          sessions={sessions}
          loading={sessionsLoading}
          onSelect={(id) => setActiveSessionId(id)}
          onDelete={handleDeleteSession}
        />
      </div>
    );
  }

  // Session detail view
  return (
    <div className="min-h-screen bg-cream">
      <VariantToolbar
        sessionName={activeSession?.name ?? "Loading..."}
        sessionPrompt={activeSession?.prompt ?? ""}
        variantCount={activeSession?.variants.length ?? 0}
        selectedCount={activeSession?.selectedVariantIds.length ?? 0}
        columns={columns}
        onColumnsChange={setColumns}
        filter={filter}
        onFilterChange={setFilter}
        responsive={responsive}
        onResponsiveChange={setResponsive}
        onBack={() => {
          setActiveSessionId(null);
          setActiveSession(null);
          fetchSessions();
        }}
      />
      <VariantGrid
        variants={filteredVariants}
        columns={columns}
        responsive={responsive}
        onSelect={handleSelect}
        onStar={handleStar}
        onViewCode={setCodeVariant}
      />
      {codeVariant && (
        <VariantCodePanel
          variant={codeVariant}
          onClose={() => setCodeVariant(null)}
        />
      )}
    </div>
  );
}
