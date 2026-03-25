import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, company: true, vatNumber: true, kvkNumber: true, phone: true, iban: true, bankName: true, accountHolder: true, logoUrl: true, legalForm: true, reminderEnabled: true, reminder1Days: true, reminder2Days: true, reminder3Days: true, quotationValidityDays: true },
  });

  return Response.json(user);
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const body = await request.json();
  const stringFields = ["name", "company", "phone", "vatNumber", "kvkNumber", "iban", "bankName", "accountHolder", "legalForm"];
  const intFields = ["reminder1Days", "reminder2Days", "reminder3Days", "quotationValidityDays"];
  const boolFields = ["reminderEnabled"];

  const data: Record<string, string | number | boolean | null> = {};
  for (const field of stringFields) {
    if (body[field] !== undefined) data[field] = body[field]?.trim() || null;
  }
  for (const field of intFields) {
    if (body[field] !== undefined) data[field] = parseInt(body[field], 10) || 7;
  }
  for (const field of boolFields) {
    if (body[field] !== undefined) data[field] = !!body[field];
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data,
    select: { id: true, name: true, email: true, company: true, vatNumber: true, kvkNumber: true, phone: true, iban: true, bankName: true, accountHolder: true, logoUrl: true, legalForm: true, reminderEnabled: true, reminder1Days: true, reminder2Days: true, reminder3Days: true, quotationValidityDays: true },
  });

  return Response.json(user);
}
