import { getUserByEmail } from "@/lib/data";
import { createResetToken } from "@/lib/auth";

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email) {
    return Response.json({ error: "E-mailadres is vereist" }, { status: 400 });
  }

  const user = getUserByEmail(email);
  if (user) {
    const token = createResetToken(user.id);

    // In production, send actual email. For demo, log the link.
    console.log(`[PASSWORD RESET] Resetlink voor ${email}: /reset-password?token=${token}`);
  }

  // Always return success to not reveal if email exists
  return Response.json({ success: true });
}
