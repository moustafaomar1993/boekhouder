import { NextRequest, NextResponse } from "next/server";
import { getInvoice, updateInvoiceBookkeepingStatus, updateInvoiceStatus } from "@/lib/data";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const invoice = await getInvoice(id);
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
    invoice = await updateInvoiceBookkeepingStatus(id, body.bookkeepingStatus, body.category, body.vatType);
  }
  if (body.status) {
    invoice = await updateInvoiceStatus(id, body.status);
  }

  // Handle per-line bookings
  if (body.lineBookings && Array.isArray(body.lineBookings)) {
    for (const lb of body.lineBookings) {
      if (lb.itemId) {
        await prisma.invoiceItem.update({
          where: { id: lb.itemId },
          data: {
            ...(lb.category !== undefined && { category: lb.category || null }),
            ...(lb.vatCode !== undefined && { vatCode: lb.vatCode || null }),
          },
        });
      }
    }
    // Re-fetch to include updated items
    invoice = await prisma.invoice.findUnique({ where: { id }, include: { items: true } });
  }

  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.invoice.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
