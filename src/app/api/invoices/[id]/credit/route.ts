import { prisma } from "@/lib/prisma";

async function generateNextInvoiceNumber(clientId: string): Promise<string> {
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

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const original = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true, creditInvoices: true },
  });

  if (!original) return Response.json({ error: "Factuur niet gevonden" }, { status: 404 });

  // Check if already fully credited
  const totalCredited = original.creditInvoices.reduce((sum, ci) => sum + Math.abs(ci.total), 0);
  if (totalCredited >= Math.abs(original.total)) {
    return Response.json({ error: "Deze factuur is al volledig gecrediteerd" }, { status: 400 });
  }

  const invoiceNumber = await generateNextInvoiceNumber(original.clientId);
  const today = new Date().toISOString().split("T")[0];

  // Create as draft so user can edit amounts before finalizing
  const creditInvoice = await prisma.invoice.create({
    data: {
      clientId: original.clientId,
      customerId: original.customerId,
      invoiceNumber,
      date: today,
      dueDate: today,
      customerName: original.customerName,
      customerAddress: original.customerAddress,
      subtotal: -original.subtotal,
      vatAmount: -original.vatAmount,
      total: -original.total,
      status: "draft",
      bookkeepingStatus: "pending",
      notes: `Creditfactuur voor ${original.invoiceNumber}`,
      isCredit: true,
      originalInvoiceId: original.id,
      items: {
        create: original.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
        })),
      },
    },
    include: { items: true },
  });

  return Response.json(creditInvoice, { status: 201 });
}
