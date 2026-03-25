const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

interface SendEmailOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, toName, subject, html }: SendEmailOptions): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || "noreply@boekhouder.nl";

  if (!apiKey) {
    console.log(`[EMAIL] No BREVO_API_KEY set. Would send to ${to}: ${subject}`);
    return false;
  }

  try {
    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { name: "Boekhouder", email: fromEmail },
        to: [{ email: to, name: toName || to }],
        subject,
        htmlContent: html,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error(`[EMAIL] Brevo error: ${res.status} ${error}`);
      return false;
    }

    console.log(`[EMAIL] Sent to ${to}: ${subject}`);
    return true;
  } catch (err) {
    console.error(`[EMAIL] Failed to send:`, err);
    return false;
  }
}

export function sendVerificationEmail(to: string, name: string, token: string) {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const verifyUrl = `${appUrl}/verify?token=${token}`;

  return sendEmail({
    to,
    toName: name,
    subject: "Verifieer uw e-mailadres - Boekhouder",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e40af;">Welkom bij Boekhouder!</h2>
        <p>Hallo ${name},</p>
        <p>Bedankt voor uw registratie. Klik op de onderstaande knop om uw e-mailadres te verifi&euml;ren:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verifyUrl}"
             style="background-color: #1e40af; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            E-mailadres verifi&euml;ren
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">Of kopieer deze link in uw browser:</p>
        <p style="color: #6b7280; font-size: 14px; word-break: break-all;">${verifyUrl}</p>
        <p style="color: #6b7280; font-size: 14px;">Deze link is 24 uur geldig.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">Dit bericht is automatisch verzonden door Boekhouder.</p>
      </div>
    `,
  });
}

export function sendPasswordResetEmail(to: string, name: string, token: string) {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  return sendEmail({
    to,
    toName: name,
    subject: "Wachtwoord herstellen - Boekhouder",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e40af;">Wachtwoord herstellen</h2>
        <p>Hallo ${name},</p>
        <p>U heeft een verzoek ingediend om uw wachtwoord te herstellen. Klik op de onderstaande knop om een nieuw wachtwoord in te stellen:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}"
             style="background-color: #1e40af; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Wachtwoord herstellen
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">Of kopieer deze link in uw browser:</p>
        <p style="color: #6b7280; font-size: 14px; word-break: break-all;">${resetUrl}</p>
        <p style="color: #6b7280; font-size: 14px;">Deze link is 1 uur geldig en kan slechts eenmaal worden gebruikt.</p>
        <p style="color: #6b7280; font-size: 14px;">Heeft u dit verzoek niet ingediend? Dan kunt u dit bericht negeren.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">Dit bericht is automatisch verzonden door Boekhouder.</p>
      </div>
    `,
  });
}
