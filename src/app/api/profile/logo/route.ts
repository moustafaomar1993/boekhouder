import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("logo") as File;

  if (!file) return Response.json({ error: "Geen bestand geselecteerd" }, { status: 400 });

  const validTypes = ["image/jpeg", "image/png", "image/jpg"];
  if (!validTypes.includes(file.type)) {
    return Response.json({ error: "Alleen JPG en PNG bestanden zijn toegestaan" }, { status: 400 });
  }

  if (file.size > 2 * 1024 * 1024) {
    return Response.json({ error: "Bestand mag maximaal 2MB zijn" }, { status: 400 });
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
  const filename = `logo-${session.userId}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const uploadPath = path.join(process.cwd(), "public", "uploads", filename);

  await writeFile(uploadPath, bytes);

  const logoUrl = `/uploads/${filename}`;
  await prisma.user.update({
    where: { id: session.userId },
    data: { logoUrl },
  });

  return Response.json({ logoUrl });
}
