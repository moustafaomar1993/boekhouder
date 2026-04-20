import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: list all journal entries
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || (user.role !== "bookkeeper" && user.role !== "admin")) {
    return Response.json({ error: "Geen toegang" }, { status: 403 });
  }

  const entries = await prisma.journalEntry.findMany({
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(entries);
}

// POST: create a new journal entry
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || (user.role !== "bookkeeper" && user.role !== "admin")) {
    return Response.json({ error: "Geen toegang" }, { status: 403 });
  }

  const body = await request.json();
  const { date, description, type, lines } = body as {
    date: string;
    description: string;
    type?: string;
    lines: { ledgerAccount: string; debit: number; credit: number; description?: string; vatCode?: string }[];
  };

  if (!date || !description || !lines || lines.length === 0) {
    return Response.json({ error: "Verplichte velden ontbreken" }, { status: 400 });
  }

  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);

  // Debit must equal credit
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return Response.json({ error: "Debet en credit zijn niet in balans" }, { status: 400 });
  }

  // Generate reference number
  const entryType = type || "memoriaal";
  const prefix = entryType === "beginbalans" ? "BB" : "MEM";
  const count = await prisma.journalEntry.count({ where: { type: entryType } });
  const reference = `${prefix}-${String(count + 1).padStart(3, "0")}`;

  const entry = await prisma.journalEntry.create({
    data: {
      date,
      reference,
      description,
      type: entryType,
      totalDebit,
      totalCredit,
      status: "draft",
      lines: {
        create: lines.map((l) => ({
          ledgerAccount: l.ledgerAccount,
          debit: l.debit || 0,
          credit: l.credit || 0,
          description: l.description || null,
          vatCode: l.vatCode || null,
        })),
      },
    },
    include: { lines: true },
  });

  return Response.json(entry);
}
