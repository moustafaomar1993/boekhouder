import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || (user.role !== "bookkeeper" && user.role !== "admin")) {
    return Response.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const tx = await prisma.bankTransaction.findUnique({ where: { id } });
  if (!tx) return Response.json({ error: "Transactie niet gevonden" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.status) data.status = body.status;

  const updated = await prisma.bankTransaction.update({
    where: { id },
    data,
    include: { user: { select: { id: true, name: true, company: true } } },
  });

  return Response.json(updated);
}
