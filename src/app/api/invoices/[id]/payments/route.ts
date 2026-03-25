import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payments = await prisma.payment.findMany({
    where: { invoiceId: id },
    orderBy: { date: "desc" },
  });
  return Response.json(payments);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { amount, date, notes } = body;

  if (!amount || amount <= 0) {
    return Response.json({ error: "Bedrag moet groter zijn dan 0" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return Response.json({ error: "Factuur niet gevonden" }, { status: 404 });

  const remaining = Math.abs(invoice.total) - invoice.paidAmount;
  if (amount > remaining + 0.01) {
    return Response.json({ error: `Bedrag mag niet hoger zijn dan het openstaande bedrag (${remaining.toFixed(2)})` }, { status: 400 });
  }

  // Create payment
  const payment = await prisma.payment.create({
    data: {
      invoiceId: id,
      amount,
      date: date || new Date().toISOString().split("T")[0],
      notes: notes || null,
    },
  });

  // Update paidAmount and status
  const newPaidAmount = invoice.paidAmount + amount;
  const invoiceTotal = Math.abs(invoice.total);
  let newStatus = invoice.status;

  if (newPaidAmount >= invoiceTotal - 0.01) {
    newStatus = "paid";
  } else if (newPaidAmount > 0) {
    newStatus = "partial";
  }

  await prisma.invoice.update({
    where: { id },
    data: { paidAmount: newPaidAmount, status: newStatus },
  });

  return Response.json({ payment, newStatus, paidAmount: newPaidAmount });
}
