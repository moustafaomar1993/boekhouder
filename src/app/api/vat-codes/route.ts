import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || (user.role !== "bookkeeper" && user.role !== "admin")) {
    return Response.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "";
  const active = searchParams.get("active");

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (active === "true") where.isActive = true;
  if (active === "false") where.isActive = false;

  const vatCodes = await prisma.vatCode.findMany({
    where,
    orderBy: [{ type: "asc" }, { code: "asc" }],
    include: { ledgerAccount: true },
  });

  return Response.json(vatCodes);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || (user.role !== "bookkeeper" && user.role !== "admin")) {
    return Response.json({ error: "Geen toegang" }, { status: 403 });
  }

  const body = await request.json();
  const { code, name, description, percentage, type, rubricCode, ledgerAccountId } = body;

  if (!code || !name || percentage === undefined || !type) {
    return Response.json({ error: "Verplichte velden ontbreken" }, { status: 400 });
  }

  if (!["sales", "purchase"].includes(type)) {
    return Response.json({ error: "Type moet 'sales' of 'purchase' zijn" }, { status: 400 });
  }

  const existing = await prisma.vatCode.findUnique({ where: { code } });
  if (existing) {
    return Response.json({ error: "BTW-code bestaat al" }, { status: 400 });
  }

  const vatCode = await prisma.vatCode.create({
    data: {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description?.trim() || null,
      percentage: parseFloat(percentage),
      type,
      rubricCode: rubricCode || null,
      ledgerAccountId: ledgerAccountId || null,
      isSystem: false,
    },
    include: { ledgerAccount: true },
  });

  return Response.json(vatCode);
}
