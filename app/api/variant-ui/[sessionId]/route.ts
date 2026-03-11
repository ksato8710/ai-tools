import { NextResponse } from "next/server";
import { getSession, saveSession, deleteSession } from "@/lib/variant-store";
import { createVariant } from "@/lib/variant-schema";

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

// PATCH: push variants to session
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { variants, status } = await request.json();

  if (variants && Array.isArray(variants)) {
    const startIndex = session.variants.length;
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const variant = createVariant(sessionId, startIndex + i, v.code, {
        format: v.format,
        label: v.label,
        tags: v.tags,
        description: v.description,
      });
      session.variants.push(variant);
    }
  }

  if (status === "active" || status === "completed") {
    session.status = status;
  }

  await saveSession(session);
  return NextResponse.json({
    id: session.id,
    variantCount: session.variants.length,
  });
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
