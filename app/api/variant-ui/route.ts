import { NextResponse } from "next/server";
import { listSessions, saveSession } from "@/lib/variant-store";
import { createSession } from "@/lib/variant-schema";

export async function GET() {
  const sessions = await listSessions();
  return NextResponse.json(sessions);
}

export async function POST(request: Request) {
  const { name, prompt } = await request.json();
  if (!name || !prompt) {
    return NextResponse.json({ error: "name and prompt are required" }, { status: 400 });
  }
  const session = createSession(name, prompt);
  await saveSession(session);
  return NextResponse.json({ id: session.id, name: session.name });
}
