import { NextRequest, NextResponse } from "next/server";
import { listInstalledApps } from "@/lib/agent-device";
import type { InstalledApp } from "@/lib/agent-device";

// In-memory cache to avoid re-scanning APKs every request
let cache: { key: string; apps: InstalledApp[]; ts: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function GET(request: NextRequest) {
  const userOnly = request.nextUrl.searchParams.get("all") !== "true";
  const refresh = request.nextUrl.searchParams.get("refresh") === "true";
  const cacheKey = userOnly ? "user" : "all";

  if (!refresh && cache && cache.key === cacheKey && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json({ apps: cache.apps, cached: true });
  }

  try {
    const apps = await listInstalledApps(userOnly);
    cache = { key: cacheKey, apps, ts: Date.now() };
    return NextResponse.json({ apps });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ apps: [], error: message }, { status: 500 });
  }
}
