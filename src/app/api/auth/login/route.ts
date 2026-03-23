import { getUserByUsername } from "@/lib/data";
import { createSession, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return Response.json({ error: "Gebruikersnaam en wachtwoord zijn vereist" }, { status: 400 });
  }

  const user = getUserByUsername(username);
  if (!user || !user.passwordHash) {
    return Response.json({ error: "Ongeldige gebruikersnaam of wachtwoord" }, { status: 401 });
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return Response.json({ error: "Ongeldige gebruikersnaam of wachtwoord" }, { status: 401 });
  }

  if (!user.emailVerified) {
    return Response.json({
      error: "Verifieer eerst uw e-mailadres voordat u kunt inloggen",
      emailNotVerified: true,
      email: user.email,
    }, { status: 403 });
  }

  await createSession(user.id);

  return Response.json({
    success: true,
    user: { id: user.id, name: user.name, role: user.role, company: user.company },
  });
}
