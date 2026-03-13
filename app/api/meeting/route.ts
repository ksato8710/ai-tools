import { NextResponse } from "next/server";
import { listSessions, saveSession } from "@/lib/meeting-store";
import { MeetingSession } from "@/lib/meeting-schema";

export async function GET() {
  const sessions = await listSessions();
  return NextResponse.json(sessions);
}

export async function POST(req: Request) {
  const body = await req.json();
  const id = `mtg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  const session: MeetingSession = {
    id,
    title: body.title || `会議 ${new Date().toLocaleDateString("ja-JP")}`,
    status: "ready",
    createdAt: now,
    updatedAt: now,
  };

  await saveSession(session);
  return NextResponse.json(session);
}
