import { NextResponse } from "next/server";
import {
  getSession,
  saveSession,
  deleteSession,
} from "@/lib/presentation-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  return NextResponse.json(session);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = await request.json();

  if (body.presentation) {
    session.presentation = body.presentation;
  }
  if (body.name) {
    session.name = body.name;
  }
  if (body.description !== undefined) {
    session.description = body.description;
  }
  if (body.status) {
    session.status = body.status;
  }

  await saveSession(session);
  return NextResponse.json({ id: session.id });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const deleted = await deleteSession(sessionId);
  if (!deleted) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  return NextResponse.json({ deleted: sessionId });
}
