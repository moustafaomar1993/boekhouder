import { prisma } from "@/lib/prisma";
import { addInvoice } from "@/lib/data";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = await prisma.quotation.findUnique({ where: { id }, include: { items: true } });
  if (!q) return Response.json({ error: "Niet gevonden" }, { status: 404 });
  if (q.status !== "accepted") return Response.json({ error: "Alleen geaccepteerde offertes kunnen worden omgezet" }, { status: 400 });

  // Generate next invoice number
  const year = new Date().getFullYear().toString();
  const latest = await prisma.invoice.findFirst({
    where: { clientId: q.clientId, invoiceNumber: { startsWith: year } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  let seq = 1;
  if (latest) { const p = parseInt(latest.invoiceNumber.slice(year.length), 10); if (!isNaN(p)) seq = p + 1; }
  const invoiceNumber = `${year}${seq.toString().padStart(5, "0")}`;
  const today = new Date().toISOString().split("T")[0];

  // Get customer payment terms for due date
  let dueDate = (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().split("T")[0]; })();
  if (q.customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: q.customerId } });
    if (customer?.paymentTermValue && customer?.paymentTermUnit) {
      const d = new Date();
      if (customer.paymentTermUnit === "days") d.setDate(d.getDate() + customer.paymentTermValue);
      else if (customer.paymentTermUnit === "weeks") d.setDate(d.getDate() + customer.paymentTermValue * 7);
      else d.setMonth(d.getMonth() + customer.paymentTermValue);
      dueDate = d.toISOString().split("T")[0];
    }
  }

  const invoice = await addInvoice({
    clientId: q.clientId,
    customerId: q.customerId,
    invoiceNumber,
    date: today,
    dueDate,
    customerName: q.customerName,
    customerAddress: q.customerAddress,
    items: q.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, vatRate: i.vatRate })),
    subtotal: q.subtotal,
    vatAmount: q.vatAmount,
    total: q.total,
    status: "draft",
    notes: `Gebaseerd op offerte ${q.quotationNumber}`,
  });

  // Update quotation status
  await prisma.quotation.update({
    where: { id },
    data: { status: "converted", convertedInvoiceId: invoice.id },
  });

  // Update invoice with source quotation
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { sourceQuotationId: q.id },
  });

  return Response.json(invoice, { status: 201 });
}
