import { NextRequest, NextResponse } from "next/server";
import { getInvoice, updateInvoiceBookkeepingStatus, updateInvoiceStatus } from "@/lib/data";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const invoice = getInvoice(id);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  let invoice;
  if (body.bookkeepingStatus) {
    invoice = updateInvoiceBookkeepingStatus(id, body.bookkeepingStatus, body.category);
  }
  if (body.status) {
    invoice = updateInvoiceStatus(id, body.status);
  }

  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(invoice);
}
