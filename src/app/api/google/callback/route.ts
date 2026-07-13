import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeAndStore } from "@/lib/google";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state") ?? "/dashboard";
  const base = req.nextUrl.origin;
  if (!code) {
    return NextResponse.redirect(`${base}${state}?gmail=denied`);
  }
  try {
    await exchangeCodeAndStore(code);
    return NextResponse.redirect(`${base}${state}?gmail=connected`);
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(`${base}${state}?gmail=error`);
  }
}
