import Header from "@/components/layout/Header";
import MeetingWorkspace from "@/components/meeting/MeetingWorkspace";

export default function MeetingPage() {
  return (
    <div className="min-h-screen bg-cream">
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <MeetingWorkspace />
      </main>
    </div>
  );
}
