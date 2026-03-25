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
  const isCredit = invoice.isCredit;
  const title = isCredit ? "Creditfactuur" : "Factuur";

  const itemRows = invoice.items.map((item) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${item.description}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${item.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(item.unitPrice)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${item.vatRate}%</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(item.quantity * item.unitPrice)}</td>
    </tr>
  `).join("");

  const emailHtml = `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      ${client?.logoUrl ? `<img src="${process.env.APP_URL || 'http://localhost:3000'}${client.logoUrl}" alt="Logo" style="max-height:50px;margin-bottom:16px">` : ""}
      <p>${message.replace(/\n/g, "<br>")}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <h3 style="color:${isCredit ? '#dc2626' : '#2563eb'}">${title} ${invoice.invoiceNumber}</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0">
        <thead><tr style="background:#f8f9fa">
          <th style="padding:8px;text-align:left">Omschrijving</th>
          <th style="padding:8px;text-align:right">Aantal</th>
          <th style="padding:8px;text-align:right">Prijs</th>
          <th style="padding:8px;text-align:right">BTW</th>
          <th style="padding:8px;text-align:right">Totaal</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div style="text-align:right;font-size:13px">
        <p>Subtotaal: ${formatCurrency(invoice.subtotal)}</p>
        <p>BTW: ${formatCurrency(invoice.vatAmount)}</p>
        <p style="font-size:18px;font-weight:bold">Totaal: ${formatCurrency(invoice.total)}</p>
      </div>
      <p style="font-size:12px;color:#9ca3af;margin-top:24px">Factuurdatum: ${formatDate(invoice.date)} | Vervaldatum: ${formatDate(invoice.dueDate)}</p>
      ${client?.iban ? `<p style="font-size:12px;color:#9ca3af">Betaling: ${client.iban} t.n.v. ${client.accountHolder || client.company || ""}</p>` : ""}
    </div>
  `;

  const sent = await sendEmail({ to, subject, html: emailHtml });

  if (sent) {
    // Update invoice status to sent if it was draft
    if (invoice.status === "draft") {
      await prisma.invoice.update({ where: { id }, data: { status: "sent" } });
    }
    return Response.json({ success: true });
  }

  return Response.json({ error: "E-mail kon niet worden verzonden" }, { status: 500 });
}
