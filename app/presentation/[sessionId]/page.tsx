"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import PresentationWorkspace from "@/components/presentation/PresentationWorkspace";
import type { PresentationSession } from "@/lib/presentation-store";

export default function PresentationSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<PresentationSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/presentation/${sessionId}`);
      if (!res.ok) {
        setError("Session not found");
        return;
      }
      const data = await res.json();
      setSession(data);
    } catch {
      setError("Failed to load session");
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  if (error) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary mb-4">{error}</p>
          <a
            href="/presentation"
            className="text-accent-leaf hover:underline text-sm"
          >
            Back to sessions
          </a>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-text-muted">Loading...</div>
      </div>
    );
  }

  return (
    <PresentationWorkspace
      initialData={session.presentation}
      sessionId={session.id}
      sessionName={session.name}
    />
  );
}
