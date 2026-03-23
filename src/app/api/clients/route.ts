import { NextResponse } from "next/server";
import { getClients } from "@/lib/data";

export async function GET() {
  return NextResponse.json(getClients());
}
