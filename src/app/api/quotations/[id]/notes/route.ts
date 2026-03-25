import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notes = await prisma.quotationNote.findMany({ where: { quotationId: id }, orderBy: { createdAt: "desc" } });
  return Response.json(notes);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  if (!body.text?.trim()) return Response.json({ error: "Tekst is verplicht" }, { status: 400 });
  const note = await prisma.quotationNote.create({ data: { quotationId: id, text: body.text.trim() } });
  return Response.json(note);
}

export async function DELETE(request: Request) {
  const body = await request.json();
  if (!body.noteId) return Response.json({ error: "ID is verplicht" }, { status: 400 });
  await prisma.quotationNote.delete({ where: { id: body.noteId } });
  return Response.json({ success: true });
}
