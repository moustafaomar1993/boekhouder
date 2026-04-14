import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || (user.role !== "bookkeeper" && user.role !== "admin")) {
    return Response.json({ error: "Geen toegang" }, { status: 403 });
  }

  const body = await request.json();
  const { invoiceIds, bookkeepingStatus, category, ledgerAccountId, vatType } = body;

  if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    return Response.json({ error: "Geen facturen geselecteerd" }, { status: 400 });
  }

  if (!bookkeepingStatus) {
    return Response.json({ error: "Boekingsstatus is verplicht" }, { status: 400 });
  }

  const now = new Date();
  const updateData: Record<string, unknown> = {
    bookkeepingStatus,
    ...(category !== undefined && { category }),
    ...(ledgerAccountId !== undefined && { ledgerAccountId }),
    ...(vatType !== undefined && { vatType }),
    ...(bookkeepingStatus === "booked" ? { bookedAt: now } : { bookedAt: null }),
  };

  const result = await prisma.invoice.updateMany({
    where: { id: { in: invoiceIds } },
    data: updateData,
  });

  return Response.json({
    success: true,
    count: result.count,
    message: `${result.count} facturen verwerkt`,
  });
}
