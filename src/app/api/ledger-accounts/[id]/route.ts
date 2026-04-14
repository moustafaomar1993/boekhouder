import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || (user.role !== "bookkeeper" && user.role !== "admin")) {
    return Response.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;
  const account = await prisma.ledgerAccount.findUnique({
    where: { id },
    include: { defaultVatCode: true, vatCodesPosting: true },
  });

  if (!account) return Response.json({ error: "Rekening niet gevonden" }, { status: 404 });
  return Response.json(account);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || (user.role !== "bookkeeper" && user.role !== "admin")) {
    return Response.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;
  const account = await prisma.ledgerAccount.findUnique({ where: { id } });
  if (!account) return Response.json({ error: "Rekening niet gevonden" }, { status: 404 });

  const body = await request.json();
  const { accountNumber, name, description, accountType, category, statementSection, normalBalance, isBalanceSheet, isActive, vatCodeId, sortOrder } = body;

  // System accounts: restrict changing accountNumber and accountType
  if (account.isSystem) {
    if (accountNumber !== undefined && accountNumber !== account.accountNumber) {
      return Response.json({ error: "Rekeningnummer van systeemrekening kan niet worden gewijzigd" }, { status: 400 });
    }
    if (accountType !== undefined && accountType !== account.accountType) {
      return Response.json({ error: "Type van systeemrekening kan niet worden gewijzigd" }, { status: 400 });
    }
  }

  // Check unique accountNumber if changed
  if (accountNumber !== undefined && accountNumber !== account.accountNumber) {
    if (!/^\d{4}$/.test(accountNumber)) {
      return Response.json({ error: "Rekeningnummer moet 4 cijfers zijn" }, { status: 400 });
    }
    const existing = await prisma.ledgerAccount.findUnique({ where: { accountNumber } });
    if (existing) {
      return Response.json({ error: "Rekeningnummer bestaat al" }, { status: 400 });
    }
  }

  const updated = await prisma.ledgerAccount.update({
    where: { id },
    data: {
      ...(accountNumber !== undefined && { accountNumber }),
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(accountType !== undefined && { accountType }),
      ...(category !== undefined && { category: category.trim() }),
      ...(statementSection !== undefined && { statementSection: statementSection?.trim() || null }),
      ...(normalBalance !== undefined && { normalBalance }),
      ...(isBalanceSheet !== undefined && { isBalanceSheet }),
      ...(isActive !== undefined && { isActive }),
      ...(vatCodeId !== undefined && { vatCodeId: vatCodeId || null }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
    include: { defaultVatCode: true },
  });

  return Response.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || (user.role !== "bookkeeper" && user.role !== "admin")) {
    return Response.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { id } = await params;
  const account = await prisma.ledgerAccount.findUnique({ where: { id } });
  if (!account) return Response.json({ error: "Rekening niet gevonden" }, { status: 404 });

  if (account.isSystem) {
    return Response.json({ error: "Systeemrekening kan niet worden verwijderd" }, { status: 400 });
  }

  // Check if any VAT codes reference this account
  const linkedVatCodes = await prisma.vatCode.count({ where: { ledgerAccountId: id } });
  if (linkedVatCodes > 0) {
    return Response.json({ error: "Rekening wordt gebruikt door BTW-codes en kan niet worden verwijderd" }, { status: 400 });
  }

  await prisma.ledgerAccount.delete({ where: { id } });
  return Response.json({ success: true });
}
