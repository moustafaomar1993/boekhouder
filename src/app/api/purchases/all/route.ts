import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Accountant endpoint: fetch ALL purchase documents across all clients
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  // Verify user is bookkeeper or admin
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || (user.role !== "bookkeeper" && user.role !== "admin")) {
    return Response.json({ error: "Geen toegang" }, { status: 403 });
  }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");
  const clientFilter = url.searchParams.get("clientId");

  const where: Record<string, unknown> = {};
  if (statusFilter && statusFilter !== "all") where.status = statusFilter;
  if (clientFilter && clientFilter !== "all") where.userId = clientFilter;

  const documents = await prisma.purchaseDocument.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, company: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(documents);
}
