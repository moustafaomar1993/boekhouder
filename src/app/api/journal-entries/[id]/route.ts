import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: single journal entry
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || (user.role !== "bookkeeper" && user.role !== "admin")) {
    return Response.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;
  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: { lines: true },
  });

  if (!entry) return Response.json({ error: "Niet gevonden" }, { status: 404 });

  return Response.json(entry);
}

// PATCH: update journal entry (only drafts)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || (user.role !== "bookkeeper" && user.role !== "admin")) {
    return Response.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.journalEntry.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Niet gevonden" }, { status: 404 });

  const body = await request.json();

  // If marking as booked
  if (body.status === "booked" && existing.status === "draft") {
    const entry = await prisma.journalEntry.update({
      where: { id },
      data: { status: "booked", bookedAt: new Date() },
      include: { lines: true },
    });
    return Response.json(entry);
  }

  // If reopening
  if (body.status === "draft" && existing.status === "booked") {
    const entry = await prisma.journalEntry.update({
      where: { id },
      data: { status: "draft", bookedAt: null },
      include: { lines: true },
    });
    return Response.json(entry);
  }

  // Full update (only drafts)
  if (existing.status !== "draft") {
    return Response.json({ error: "Alleen concept-boekingen kunnen worden bewerkt" }, { status: 400 });
  }

  const { date, description, type, lines } = body as {
    date?: string;
    description?: string;
    type?: string;
    lines?: { ledgerAccount: string; debit: number; credit: number; description?: string; vatCode?: string }[];
  };

  const updateData: Record<string, unknown> = {};
  if (date) updateData.date = date;
  if (description) updateData.description = description;
  if (type) updateData.type = type;

  if (lines && lines.length > 0) {
    const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return Response.json({ error: "Debet en credit zijn niet in balans" }, { status: 400 });
    }

    updateData.totalDebit = totalDebit;
    updateData.totalCredit = totalCredit;

    // Delete old lines and create new ones
    await prisma.journalLine.deleteMany({ where: { journalEntryId: id } });
    await prisma.journalLine.createMany({
      data: lines.map((l) => ({
        journalEntryId: id,
        ledgerAccount: l.ledgerAccount,
        debit: l.debit || 0,
        credit: l.credit || 0,
        description: l.description || null,
        vatCode: l.vatCode || null,
      })),
    });
  }

  const entry = await prisma.journalEntry.update({
    where: { id },
    data: updateData,
    include: { lines: true },
  });

  return Response.json(entry);
}

// DELETE: delete journal entry (only drafts)
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || (user.role !== "bookkeeper" && user.role !== "admin")) {
    return Response.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.journalEntry.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Niet gevonden" }, { status: 404 });

  if (existing.status !== "draft") {
    return Response.json({ error: "Alleen concept-boekingen kunnen worden verwijderd" }, { status: 400 });
  }

  await prisma.journalEntry.delete({ where: { id } });

  return Response.json({ success: true });
}
