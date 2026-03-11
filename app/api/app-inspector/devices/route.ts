import { NextResponse } from "next/server";
import { listDevices } from "@/lib/agent-device";

export async function GET() {
  try {
    const devices = await listDevices();
    return NextResponse.json({ devices });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ devices: [], error: message });
  }
}
