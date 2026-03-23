import { registerClient, getUserByUsername, getUserByEmail } from "@/lib/data";
import type { ClientRegistration } from "@/lib/data";
import { hashPassword, checkPasswordStrength, createVerificationToken } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json();
  const { registration, username, password } = body as {
    registration: ClientRegistration;
    username: string;
    password: string;
  };

  if (!registration || !username || !password) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const strength = checkPasswordStrength(password);
  if (!strength.isValid) {
    return Response.json({ error: "Wachtwoord voldoet niet aan de eisen" }, { status: 400 });
  }

  if (getUserByUsername(username)) {
    return Response.json({ error: "Gebruikersnaam is al in gebruik" }, { status: 409 });
  }

  if (getUserByEmail(registration.email)) {
    return Response.json({ error: "E-mailadres is al geregistreerd" }, { status: 409 });
  }

  const passwordHash = hashPassword(password);
  const { user, administration } = registerClient(registration, username, passwordHash);

  // Create email verification token
  const verificationToken = createVerificationToken(user.id);

  // In production, send actual email. For demo, log the link.
  console.log(`[EMAIL VERIFICATION] Verificatielink voor ${registration.email}: /api/auth/verify?token=${verificationToken}`);

  return Response.json({
    success: true,
    userId: user.id,
    administrationId: administration.id,
    verificationRequired: true,
  });
}
