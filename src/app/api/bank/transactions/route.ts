import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || (user.role !== "bookkeeper" && user.role !== "admin")) {
    return Response.json({ error: "Geen toegang" }, { status: 403 });
  }

  const url = new URL(request.url);
  const clientFilter = url.searchParams.get("clientId");
  const statusFilter = url.searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (clientFilter && clientFilter !== "all") where.userId = clientFilter;
  if (statusFilter && statusFilter !== "all") where.status = statusFilter;

  const transactions = await prisma.bankTransaction.findMany({
    where,
    include: { user: { select: { id: true, name: true, company: true } } },
    orderBy: { transactionDate: "desc" },
  });

  return Response.json(transactions);
}
