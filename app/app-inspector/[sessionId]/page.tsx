"use client";

import { useParams } from "next/navigation";
import Header from "@/components/layout/Header";
import AppInspectorSessionDetail from "@/components/app-inspector/AppInspectorSessionDetail";

export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  return (
    <div className="min-h-screen bg-cream">
      <Header />
      <AppInspectorSessionDetail sessionId={sessionId} />
    </div>
  );
}
