import { NextResponse } from "next/server";
import { getSession, saveSession } from "@/lib/variant-store";

// POST: toggle select/star on a variant
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { variantId, action } = await request.json();
  // action: "select" | "unselect" | "star" | "unstar"

  const variant = session.variants.find((v) => v.id === variantId);
  if (!variant) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  switch (action) {
    case "select":
      variant.selected = true;
      if (!session.selectedVariantIds.includes(variantId)) {
        session.selectedVariantIds.push(variantId);
      }
      break;
    case "unselect":
      variant.selected = false;
      session.selectedVariantIds = session.selectedVariantIds.filter(
        (id) => id !== variantId
      );
      break;
    case "star":
      variant.starred = true;
      break;
    case "unstar":
      variant.starred = false;
      break;
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  await saveSession(session);
  return NextResponse.json({ variantId, action, success: true });
}

// GET: return selected variants with code
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const selected = session.variants.filter((v) => v.selected);
  return NextResponse.json({
    sessionId: session.id,
    sessionName: session.name,
    selected,
  });
}
