import { NextRequest, NextResponse } from "next/server";
import { getAllInvoices, getInvoicesByClient, addInvoice } from "@/lib/data";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId");
  const customerId = request.nextUrl.searchParams.get("customerId");

  if (customerId) {
    const invoices = await prisma.invoice.findMany({
      where: { customerId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(invoices);
  }

  const invoices = clientId ? await getInvoicesByClient(clientId) : await getAllInvoices();
  return NextResponse.json(invoices);
}

async function generateUniqueInvoiceNumber(clientId: string): Promise<string> {
  const year = new Date().getFullYear().toString();
  const latest = await prisma.invoice.findFirst({
    where: { clientId, invoiceNumber: { startsWith: year } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  let nextSeq = 1;
  if (latest) {
    const parsed = parseInt(latest.invoiceNumber.slice(year.length), 10);
    if (!isNaN(parsed)) nextSeq = parsed + 1;
  }

  return `${year}${nextSeq.toString().padStart(5, "0")}`;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const items = body.items || [];
  const subtotal = items.reduce((sum: number, item: { quantity: number; unitPrice: number }) => sum + item.quantity * item.unitPrice, 0);
  const vatAmount = items.reduce(
    (sum: number, item: { quantity: number; unitPrice: number; vatRate: number }) => sum + item.quantity * item.unitPrice * (item.vatRate / 100),
    0
  );

  // Check if the submitted invoice number already exists, if so generate a new one
  let invoiceNumber = body.invoiceNumber;
  if (invoiceNumber) {
    const exists = await prisma.invoice.findFirst({
      where: { clientId: body.clientId, invoiceNumber },
    });
    if (exists) {
      invoiceNumber = await generateUniqueInvoiceNumber(body.clientId);
    }
  } else {
    invoiceNumber = await generateUniqueInvoiceNumber(body.clientId);
  }

  const invoice = await addInvoice({
    clientId: body.clientId,
    customerId: body.customerId || null,
    invoiceNumber,
    date: body.date,
    dueDate: body.dueDate,
    customerName: body.customerName,
    customerAddress: body.customerAddress,
    items,
    subtotal,
    vatAmount,
    total: subtotal + vatAmount,
    status: body.status || "draft",
    notes: body.notes,
    isCredit: body.isCredit || false,
    originalInvoiceId: body.originalInvoiceId || null,
  });

  return NextResponse.json(invoice, { status: 201 });
}
