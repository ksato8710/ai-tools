import { NextResponse } from "next/server";
import { listSessions, saveSession } from "@/lib/app-inspector-store";
import { createSession } from "@/lib/app-inspector-schema";

export async function GET() {
  const sessions = await listSessions();
  return NextResponse.json(sessions);
}

export async function POST(request: Request) {
  const { appPackage, appName, deviceName } = await request.json();
  if (!appPackage) {
    return NextResponse.json(
      { error: "appPackage is required" },
      { status: 400 }
    );
  }
  const session = createSession(
    appPackage,
    appName || appPackage.split(".").pop() || appPackage,
    deviceName || "default"
  );
  await saveSession(session);
  return NextResponse.json({ id: session.id, appPackage: session.appPackage });
}
