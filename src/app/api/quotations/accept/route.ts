import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();
  const { token } = body;

  if (!token) return Response.json({ error: "Token ontbreekt" }, { status: 400 });

  const q = await prisma.quotation.findUnique({ where: { acceptToken: token } });
  if (!q) return Response.json({ error: "Offerte niet gevonden of link is ongeldig" }, { status: 404 });
  if (q.status === "accepted" || q.status === "converted") return Response.json({ error: "Deze offerte is al geaccepteerd" }, { status: 400 });
  if (q.status === "expired") return Response.json({ error: "Deze offerte is verlopen" }, { status: 400 });

  await prisma.quotation.update({
    where: { id: q.id },
    data: { status: "accepted", acceptedAt: new Date() },
  });

  return Response.json({ success: true, quotationNumber: q.quotationNumber });
}
