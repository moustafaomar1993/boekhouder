import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId");
  const where = clientId ? { clientId } : {};
  const quotations = await prisma.quotation.findMany({
    where,
    include: { items: true, _count: { select: { quotationNotes: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(quotations);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const items = body.items || [];
  const subtotal = items.reduce((s: number, i: { quantity: number; unitPrice: number }) => s + i.quantity * i.unitPrice, 0);
  const vatAmount = items.reduce((s: number, i: { quantity: number; unitPrice: number; vatRate: number }) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0);

  const quotation = await prisma.quotation.create({
    data: {
      clientId: body.clientId,
      customerId: body.customerId || null,
      quotationNumber: body.quotationNumber,
      date: body.date,
      validUntil: body.validUntil,
      customerName: body.customerName,
      customerAddress: body.customerAddress || "",
      subtotal,
      vatAmount,
      total: subtotal + vatAmount,
      status: body.status || "draft",
      notes: body.notes || null,
      items: { create: items },
    },
    include: { items: true },
  });

  return NextResponse.json(quotation, { status: 201 });
}
