import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: list exceptions (accountant sees all, client sees their own)
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const isAccountant = user.role === "bookkeeper" || user.role === "admin";

  const items = await prisma.exceptionItem.findMany({
    where: isAccountant ? {} : { userId: session.userId },
    include: {
      user: { select: { id: true, name: true, company: true, email: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(items);
}

// POST: create exception (accountant only)
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || (user.role !== "bookkeeper" && user.role !== "admin")) {
    return Response.json({ error: "Geen toegang" }, { status: 403 });
  }

  const body = await request.json();
  const { userId, type, title, description, invoiceId, purchaseDocId, bankTransactionId } = body;

  if (!userId || !type || !title || !description) {
    return Response.json({ error: "Verplichte velden ontbreken" }, { status: 400 });
  }

  const item = await prisma.exceptionItem.create({
    data: {
      userId,
      createdByUserId: session.userId,
      type,
      title,
      description,
      status: "waiting",
      invoiceId: invoiceId || null,
      purchaseDocId: purchaseDocId || null,
      bankTransactionId: bankTransactionId || null,
    },
    include: {
      user: { select: { id: true, name: true, company: true, email: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  return Response.json(item);
}
