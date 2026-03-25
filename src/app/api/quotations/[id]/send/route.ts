import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { randomUUID } from "crypto";

function fmt(n: number) { return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n); }
function fmtDate(d: string) { const p = d.split("-"); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : d; }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { to, subject, message } = body;

  if (!to) return Response.json({ error: "E-mailadres is verplicht" }, { status: 400 });

  const q = await prisma.quotation.findUnique({ where: { id }, include: { items: true } });
  if (!q) return Response.json({ error: "Offerte niet gevonden" }, { status: 404 });

  const client = await prisma.user.findUnique({ where: { id: q.clientId } });
  const acceptToken = randomUUID();
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const acceptUrl = `${appUrl}/quotation-accept?token=${acceptToken}`;

  const itemRows = q.items.map((i) => `
    <tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${i.description}</td>
    <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${i.quantity}</td>
    <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${fmt(i.unitPrice)}</td>
    <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${fmt(i.quantity * i.unitPrice)}</td></tr>
  `).join("");

  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      ${client?.logoUrl ? `<img src="${appUrl}${client.logoUrl}" alt="Logo" style="max-height:50px;margin-bottom:16px">` : ""}
      <p>${message.replace(/\n/g, "<br>")}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <h3 style="color:#2563eb">Offerte ${q.quotationNumber}</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0">
        <thead><tr style="background:#f8f9fa">
          <th style="padding:6px 8px;text-align:left">Omschrijving</th>
          <th style="padding:6px 8px;text-align:right">Aantal</th>
          <th style="padding:6px 8px;text-align:right">Prijs</th>
          <th style="padding:6px 8px;text-align:right">Totaal</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div style="text-align:right;font-size:13px">
        <p>Subtotaal: ${fmt(q.subtotal)}</p>
        <p>BTW: ${fmt(q.vatAmount)}</p>
        <p style="font-size:18px;font-weight:bold">Totaal: ${fmt(q.total)}</p>
      </div>
      <p style="font-size:12px;color:#666">Geldig tot: ${fmtDate(q.validUntil)}</p>
      <div style="text-align:center;margin:30px 0">
        <a href="${acceptUrl}" style="background:#16a34a;color:white;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;display:inline-block">
          Offerte accepteren
        </a>
      </div>
      <p style="font-size:12px;color:#9ca3af">Klik op de knop om deze offerte te accepteren.</p>
    </div>
  `;

  const sent = await sendEmail({ to, subject, html });

  if (sent) {
    await prisma.quotation.update({
      where: { id },
      data: { status: "sent", acceptToken, sentAt: new Date() },
    });
    return Response.json({ success: true });
  }

  return Response.json({ error: "E-mail kon niet worden verzonden" }, { status: 500 });
}
