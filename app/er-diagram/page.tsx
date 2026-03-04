"use client";

import Header from "@/components/layout/Header";
import EREditor from "@/components/er-diagram/EREditor";

export default function ERDiagramPage() {
  return (
    <div className="h-screen flex flex-col bg-cream">
      <Header />
      <EREditor />
    </div>
  );
}
