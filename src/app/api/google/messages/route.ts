import { NextRequest, NextResponse } from "next/server";
import { listMessages } from "@/lib/google";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") ?? "";
    return NextResponse.json({ messages: await listMessages(q) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gmailの取得に失敗しました。" },
      { status: 500 }
    );
  }
}
