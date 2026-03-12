import { NextResponse } from "next/server";
import { ensureDeviceReady } from "@/lib/agent-device";

export async function GET() {
  const status = await ensureDeviceReady();
  return NextResponse.json(status);
}
