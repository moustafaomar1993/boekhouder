import { getSession, hashPassword, checkPasswordStrength } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Geen toegang" }, { status: 403 });

  const body = await request.json();
  const { name, email, role, password, company, kvkNumber, legalForm, phone } = body;

  if (!name || !email || !role || !password) {
    return Response.json({ error: "Naam, e-mail, rol en wachtwoord zijn verplicht" }, { status: 400 });
  }

  if (!["client", "bookkeeper", "admin"].includes(role)) {
    return Response.json({ error: "Ongeldige rol" }, { status: 400 });
  }

  const strength = checkPasswordStrength(password);
  if (!strength.isValid) {
    return Response.json({ error: "Wachtwoord moet minimaal 8 tekens bevatten, 1 hoofdletter en 1 cijfer" }, { status: 400 });
  }

  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return Response.json({ error: "Dit e-mailadres is al in gebruik" }, { status: 409 });
  }

  // Check if username already exists
  const existingUsername = await prisma.user.findUnique({ where: { username: email } });
  if (existingUsername) {
    return Response.json({ error: "Deze gebruikersnaam is al in gebruik" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      role,
      username: email,
      passwordHash,
      emailVerified: true, // Admin-created accounts are pre-verified
      isNew: role === "client",
      company: company || null,
      kvkNumber: kvkNumber || null,
      legalForm: legalForm || null,
      phone: phone || null,
    },
  });

  // Create administration for clients
  if (role === "client" && legalForm) {
    const taxType = legalForm === "bv" ? "vennootschapsbelasting" : "inkomstenbelasting";
    await prisma.administration.create({
      data: { clientId: user.id, taxType },
    });
  }

  return Response.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}
