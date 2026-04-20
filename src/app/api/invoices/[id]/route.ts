import { NextRequest, NextResponse } from "next/server";
import { getInvoice, updateInvoiceBookkeepingStatus, updateInvoiceStatus } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { notificationTemplates } from "@/lib/notifications";
import { cookies } from "next/headers";

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

  // Get session user for notifications
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  let sessionUserId: string | null = null;
  if (sessionId) {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (session) sessionUserId = session.userId;
  }

  let invoice;
  if (body.bookkeepingStatus) {
    invoice = await updateInvoiceBookkeepingStatus(id, body.bookkeepingStatus, body.category, body.vatType);
    // Create notification when invoice is booked
    if (body.bookkeepingStatus === "booked" && invoice && sessionUserId) {
      notificationTemplates.invoiceBooked(sessionUserId, invoice.invoiceNumber, invoice.customerName, invoice.id).catch(() => {});
    }
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

  // Handle editable invoice fields (factuurgegevens)
  const directUpdates: Record<string, unknown> = {};
  if (body.date !== undefined) directUpdates.date = body.date;
  if (body.dueDate !== undefined) directUpdates.dueDate = body.dueDate;
  if (body.customerName !== undefined) directUpdates.customerName = body.customerName;
  if (body.customerAddress !== undefined) directUpdates.customerAddress = body.customerAddress;
  if (body.subtotal !== undefined) directUpdates.subtotal = Number(body.subtotal);
  if (body.vatAmount !== undefined) directUpdates.vatAmount = Number(body.vatAmount);
  if (body.notes !== undefined) directUpdates.notes = body.notes;
  if (body.subtotal !== undefined || body.vatAmount !== undefined) {
    const current = await prisma.invoice.findUnique({ where: { id } });
    if (current) {
      const newSubtotal = body.subtotal !== undefined ? Number(body.subtotal) : current.subtotal;
      const newVat = body.vatAmount !== undefined ? Number(body.vatAmount) : current.vatAmount;
      directUpdates.total = newSubtotal + newVat;
    }
  }

  if (Object.keys(directUpdates).length > 0) {
    invoice = await prisma.invoice.update({
      where: { id },
      data: directUpdates,
      include: { items: true },
    });
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
