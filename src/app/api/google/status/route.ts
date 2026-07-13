import { NextResponse } from "next/server";
import { getConnection, isGoogleConfigured } from "@/lib/google";

export async function GET() {
  const configured = isGoogleConfigured();
  if (!configured) return NextResponse.json({ configured, connected: false, email: null });
  const { connected, email } = await getConnection();
  return NextResponse.json({ configured, connected, email });
}
