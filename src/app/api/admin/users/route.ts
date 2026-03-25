import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Geen toegang" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      company: true,
      kvkNumber: true,
      legalForm: true,
      phone: true,
      emailVerified: true,
      isNew: true,
      createdAt: true,
      username: true,
      vatNumber: true,
      vatObligation: true,
      iban: true,
      bankName: true,
      accountHolder: true,
    },
  });

  return Response.json(users);
}
