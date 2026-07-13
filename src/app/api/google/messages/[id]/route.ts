import { NextRequest, NextResponse } from "next/server";
import { getMessage } from "@/lib/google";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    return NextResponse.json(await getMessage(id));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "メールの取得に失敗しました。" },
      { status: 500 }
    );
  }
}
