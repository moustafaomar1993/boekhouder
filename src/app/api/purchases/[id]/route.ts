import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.purchaseDocument.findFirst({
    where: { id, userId: session.userId },
  });

  if (!doc) return Response.json({ error: "Document niet gevonden" }, { status: 404 });
  return Response.json(doc);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.purchaseDocument.findFirst({
    where: { id, userId: session.userId },
  });

  if (!doc) return Response.json({ error: "Document niet gevonden" }, { status: 404 });

  // Delete file from disk
  try {
    const filePath = path.join(process.cwd(), "public", doc.fileUrl);
    await unlink(filePath);
  } catch { /* file may not exist */ }

  await prisma.purchaseDocument.delete({ where: { id } });
  return Response.json({ success: true });
}
