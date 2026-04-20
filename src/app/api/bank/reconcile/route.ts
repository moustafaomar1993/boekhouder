import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notificationTemplates } from "@/lib/notifications";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || (user.role !== "bookkeeper" && user.role !== "admin")) {
    return Response.json({ error: "Geen toegang" }, { status: 403 });
  }

  const body = await request.json();
  const { invoiceIds, purchaseDocIds, bankTransactionIds } = body as {
    invoiceIds?: string[];
    purchaseDocIds?: string[];
    bankTransactionIds?: string[];
  };

  if ((!invoiceIds?.length && !purchaseDocIds?.length) || !bankTransactionIds?.length) {
    return Response.json({ error: "Selecteer documenten en banktransacties om af te letteren" }, { status: 400 });
  }

  try {
    // Update invoice statuses
    if (invoiceIds?.length) {
      await prisma.invoice.updateMany({
        where: { id: { in: invoiceIds } },
        data: { bookkeepingStatus: "reconciled", status: "paid" },
      });
    }

    // Update purchase document statuses
    if (purchaseDocIds?.length) {
      await prisma.purchaseDocument.updateMany({
        where: { id: { in: purchaseDocIds } },
        data: { status: "booked", bookedAt: new Date() },
      });
    }

    // Update bank transaction statuses
    await prisma.bankTransaction.updateMany({
      where: { id: { in: bankTransactionIds } },
      data: { status: "reconciled" },
    });

    // Create notification for reconciliation
    const totalDocs = (invoiceIds?.length || 0) + (purchaseDocIds?.length || 0);
    if (totalDocs > 0 && session.userId) {
      notificationTemplates.bankReconciled(session.userId, totalDocs).catch(() => {});
    }

    return Response.json({
      success: true,
      reconciled: {
        invoices: invoiceIds?.length || 0,
        purchaseDocs: purchaseDocIds?.length || 0,
        bankTransactions: bankTransactionIds?.length || 0,
      },
      message: "Aflettering succesvol uitgevoerd.",
    });
  } catch {
    return Response.json({ error: "Er ging iets mis bij het afletteren" }, { status: 500 });
  }
}
