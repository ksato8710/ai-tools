"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import PresentationSessionList from "@/components/presentation/PresentationSessionList";

interface SessionSummary {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "completed";
  updatedAt: string;
  createdAt: string;
}

export default function PresentationPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/presentation");
      const data = await res.json();
      setSessions(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleDelete = async (id: string) => {
    await fetch(`/api/presentation/${id}`, { method: "DELETE" });
    fetchSessions();
  };

  return (
    <div className="min-h-screen bg-cream">
      <Header />
      <PresentationSessionList
        sessions={sessions}
        loading={loading}
        onDelete={handleDelete}
      />
    </div>
  );
}
