import { NextRequest, NextResponse } from "next/server";
import { getFiscalSummary } from "@/lib/data";

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }
  return NextResponse.json(await getFiscalSummary(clientId));
}
