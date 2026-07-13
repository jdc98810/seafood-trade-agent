import { NextRequest, NextResponse } from "next/server";
import { buildAuthUrl, isGoogleConfigured } from "@/lib/google";

// Googleログイン開始。state に戻り先パスを載せる。
export async function GET(req: NextRequest) {
  if (!isGoogleConfigured()) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が未設定です。" },
      { status: 400 }
    );
  }
  const returnTo = req.nextUrl.searchParams.get("returnTo") ?? "/dashboard";
  return NextResponse.redirect(buildAuthUrl(returnTo));
}
