import { NextResponse } from "next/server";

const COMPETITOR_UI_VIEWER_URL = process.env.COMPETITOR_UI_VIEWER_URL || "https://competitor-ui-viewer.craftgarden.studio";

// GET: Proxy to fetch industries/categories from Competitor UI Viewer
export async function GET() {
  try {
    const res = await fetch(`${COMPETITOR_UI_VIEWER_URL}/api/industries`, {
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed to fetch" }));
      return NextResponse.json({ error: err.error }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
