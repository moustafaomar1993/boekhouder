import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notes = await prisma.invoiceNote.findMany({
    where: { invoiceId: id },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(notes);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  if (!body.text?.trim()) {
    return Response.json({ error: "Notitie mag niet leeg zijn" }, { status: 400 });
  }

  const note = await prisma.invoiceNote.create({
    data: { invoiceId: id, text: body.text.trim() },
  });

  return Response.json(note);
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { noteId, text } = body;

  if (!noteId || !text?.trim()) {
    return Response.json({ error: "Notitie ID en tekst zijn verplicht" }, { status: 400 });
  }

  const note = await prisma.invoiceNote.update({
    where: { id: noteId },
    data: { text: text.trim() },
  });

  return Response.json(note);
}

export async function DELETE(request: Request) {
  const body = await request.json();
  if (!body.noteId) return Response.json({ error: "Notitie ID is verplicht" }, { status: 400 });

  await prisma.invoiceNote.delete({ where: { id: body.noteId } });
  return Response.json({ success: true });
}
