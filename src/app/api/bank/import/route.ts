import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseMT940, transactionHash } from "@/lib/mt940";
import { notificationTemplates } from "@/lib/notifications";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || (user.role !== "bookkeeper" && user.role !== "admin")) {
    return Response.json({ error: "Geen toegang" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const clientId = formData.get("clientId") as string | null;

  if (!file) return Response.json({ error: "Geen bestand geüpload" }, { status: 400 });
  if (!clientId) return Response.json({ error: "Selecteer een klant" }, { status: 400 });

  // Verify client exists
  const client = await prisma.user.findUnique({ where: { id: clientId } });
  if (!client) return Response.json({ error: "Klant niet gevonden" }, { status: 404 });

  const content = await file.text();

  if (!content.includes(":20:") && !content.includes(":25:") && !content.includes(":61:")) {
    return Response.json({ error: "Ongeldig bestandsformaat. Dit lijkt geen geldig MT940-bestand te zijn." }, { status: 400 });
  }

  const result = parseMT940(content);
  if (!result.success) {
    return Response.json({ error: result.error || "MT940-bestand kon niet worden verwerkt" }, { status: 400 });
  }

  const batchId = `${clientId}-${Date.now()}`;
  let imported = 0;
  let duplicates = 0;

  for (const t of result.transactions) {
    const hash = transactionHash(clientId, t);

    try {
      await prisma.bankTransaction.create({
        data: {
          userId: clientId,
          bankAccount: t.bankAccount || result.bankAccount || null,
          transactionDate: t.date,
          amount: t.amount,
          direction: t.direction,
          description: t.description,
          counterparty: t.counterparty || null,
          counterpartyAccount: t.counterpartyAccount || null,
          status: "new",
          importBatchId: batchId,
          importHash: hash,
          rawData: t.rawData,
        },
      });
      imported++;
    } catch (err) {
      // Unique constraint violation = duplicate
      if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
        duplicates++;
      } else {
        throw err;
      }
    }
  }

  // Create notification for bank import
  if (imported > 0 && session.userId) {
    notificationTemplates.bankImport(session.userId, imported, result.bankAccount || "onbekend").catch(() => {});
  }

  return Response.json({
    success: true,
    imported,
    duplicates,
    total: result.transactions.length,
    bankAccount: result.bankAccount,
    dateRange: result.dateRange,
    message: duplicates > 0
      ? `${imported} transactie(s) geïmporteerd, ${duplicates} duplica(a)t(en) overgeslagen.`
      : `${imported} transactie(s) succesvol geïmporteerd.`,
  });
}
