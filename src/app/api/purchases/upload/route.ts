import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function getFileExtension(mimeType: string): string {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  return "bin";
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const label = (formData.get("label") as string) || null;

  if (!file) {
    return Response.json({ error: "Geen bestand geüpload" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json({ error: "Ongeldig bestandstype. Alleen PDF, JPG en PNG zijn toegestaan." }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return Response.json({ error: "Bestand is te groot. Maximaal 10MB." }, { status: 400 });
  }

  const ext = getFileExtension(file.type);
  const timestamp = Date.now();
  const safeName = `${session.userId}-${timestamp}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "purchases");
  const filePath = path.join(uploadDir, safeName);
  const fileUrl = `/uploads/purchases/${safeName}`;

  try {
    await mkdir(uploadDir, { recursive: true });
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const document = await prisma.purchaseDocument.create({
      data: {
        userId: session.userId,
        fileName: file.name,
        fileUrl,
        fileType: ext,
        fileSize: file.size,
        status: "uploaded",
        label: label || file.name.replace(/\.[^.]+$/, ""),
      },
    });

    return Response.json(document);
  } catch {
    return Response.json({ error: "Er ging iets mis bij het uploaden" }, { status: 500 });
  }
}
