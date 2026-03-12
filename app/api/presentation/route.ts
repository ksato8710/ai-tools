import { NextResponse } from "next/server";
import {
  listSessions,
  saveSession,
  generateId,
  type PresentationSession,
} from "@/lib/presentation-store";

export async function GET() {
  const sessions = await listSessions();
  return NextResponse.json(sessions);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, description, presentation } = body;
  if (!name) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }
  const now = new Date().toISOString();
  const session: PresentationSession = {
    id: generateId(),
    name,
    description: description || "",
    status: "draft",
    createdAt: now,
    updatedAt: now,
    presentation: presentation || {
      metadata: {
        title: name,
        targetAudience: "",
        purpose: "",
        keyMessages: [],
      },
      outline: [],
      slides: [],
    },
  };
  await saveSession(session);
  return NextResponse.json({ id: session.id, name: session.name });
}
