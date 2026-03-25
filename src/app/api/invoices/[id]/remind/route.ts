import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount);
}

function formatDate(dateStr: string) {
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return dateStr;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { to, subject, message } = body;

  if (!to) return Response.json({ error: "E-mailadres is verplicht" }, { status: 400 });

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!invoice) return Response.json({ error: "Factuur niet gevonden" }, { status: 404 });

  const client = await prisma.user.findUnique({ where: { id: invoice.clientId } });

  const emailHtml = `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      ${client?.logoUrl ? `<img src="${process.env.APP_URL || 'http://localhost:3000'}${client.logoUrl}" alt="Logo" style="max-height:50px;margin-bottom:16px">` : ""}
      <p>${message.replace(/\n/g, "<br>")}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <div style="background:#fef3c7;padding:16px;border-radius:8px;margin-bottom:16px">
        <p style="margin:0;font-weight:bold;color:#92400e">Betalingsherinnering</p>
        <p style="margin:4px 0 0;color:#92400e;font-size:14px">Factuur ${invoice.invoiceNumber} | Vervaldatum: ${formatDate(invoice.dueDate)}</p>
      </div>
      <div style="font-size:14px">
        <p><strong>Openstaand bedrag:</strong> ${formatCurrency(invoice.total)}</p>
        <p><strong>Factuurdatum:</strong> ${formatDate(invoice.date)}</p>
        <p><strong>Vervaldatum:</strong> ${formatDate(invoice.dueDate)}</p>
      </div>
      ${client?.iban ? `<p style="font-size:13px;color:#666;margin-top:16px">Betaling: ${client.iban} t.n.v. ${client.accountHolder || client.company || ""}</p>` : ""}
      <p style="font-size:12px;color:#9ca3af;margin-top:24px">Dit is een automatische herinnering.</p>
    </div>
  `;

  const sent = await sendEmail({ to, subject, html: emailHtml });

  if (sent) {
    return Response.json({ success: true });
  }

  return Response.json({ error: "E-mail kon niet worden verzonden" }, { status: 500 });
}
