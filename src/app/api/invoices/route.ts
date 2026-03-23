import { NextRequest, NextResponse } from "next/server";
import { getAllInvoices, getInvoicesByClient, addInvoice } from "@/lib/data";
import type { Invoice, InvoiceItem } from "@/lib/data";

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId");
  const invoices = clientId ? getInvoicesByClient(clientId) : getAllInvoices();
  return NextResponse.json(invoices);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const items: InvoiceItem[] = body.items || [];
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const vatAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice * (item.vatRate / 100),
    0
  );

  const invoice: Invoice = {
    id: `inv-${Date.now()}`,
    clientId: body.clientId,
    invoiceNumber: body.invoiceNumber,
    date: body.date,
    dueDate: body.dueDate,
    customerName: body.customerName,
    customerAddress: body.customerAddress,
    items,
    subtotal,
    vatAmount,
    total: subtotal + vatAmount,
    status: body.status || "draft",
    bookkeepingStatus: "pending",
    notes: body.notes,
    createdAt: new Date().toISOString(),
  };

  addInvoice(invoice);
  return NextResponse.json(invoice, { status: 201 });
}
