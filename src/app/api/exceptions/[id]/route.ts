import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH: update exception (accountant can resolve, both can update)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const item = await prisma.exceptionItem.findUnique({ where: { id } });
  if (!item) return Response.json({ error: "Niet gevonden" }, { status: 404 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const isAccountant = user.role === "bookkeeper" || user.role === "admin";
  const isOwner = item.userId === session.userId;

  if (!isAccountant && !isOwner) {
    return Response.json({ error: "Geen toegang" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};

  // Accountant can resolve
  if (isAccountant && body.status === "resolved") {
    data.status = "resolved";
    data.resolvedAt = new Date();
  }

  // Accountant can reopen
  if (isAccountant && body.status === "waiting") {
    data.status = "waiting";
    data.resolvedAt = null;
  }

  const updated = await prisma.exceptionItem.update({
    where: { id },
    data,
    include: {
      user: { select: { id: true, name: true, company: true, email: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  return Response.json(updated);
}
