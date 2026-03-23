import { getUserByEmail } from "@/lib/data";
import { createVerificationToken } from "@/lib/auth";

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email) {
    return Response.json({ error: "E-mailadres is vereist" }, { status: 400 });
  }

  const user = getUserByEmail(email);
  if (!user) {
    // Don't reveal if user exists or not
    return Response.json({ success: true });
  }

  if (user.emailVerified) {
    return Response.json({ error: "Dit account is al geverifieerd" }, { status: 400 });
  }

  const token = createVerificationToken(user.id);

  // In production, send actual email. For demo, log the link.
  console.log(`[EMAIL VERIFICATION] Nieuwe verificatielink voor ${email}: /api/auth/verify?token=${token}`);

  return Response.json({ success: true });
}
