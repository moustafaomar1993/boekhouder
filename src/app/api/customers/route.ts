import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const customers = await prisma.customer.findMany({
    where: { userId: session.userId },
    orderBy: { name: "asc" },
  });

  return Response.json(customers);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const body = await request.json();
  const { name, email, phone, address, vatNumber, paymentTermValue, paymentTermUnit, defaultDescription, defaultUnitPrice, defaultVatRate } = body;

  if (!name || !name.trim()) {
    return Response.json({ error: "Naam is verplicht" }, { status: 400 });
  }

  const customer = await prisma.customer.create({
    data: {
      userId: session.userId,
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      vatNumber: vatNumber?.trim() || null,
      paymentTermValue: paymentTermValue || null,
      paymentTermUnit: paymentTermUnit || null,
      defaultDescription: defaultDescription || null,
      defaultUnitPrice: defaultUnitPrice || null,
      defaultVatRate: defaultVatRate ?? null,
    },
  });

  return Response.json(customer);
}
