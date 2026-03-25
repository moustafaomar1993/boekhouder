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

export async function POST() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // Find users with reminders enabled
  const users = await prisma.user.findMany({
    where: { reminderEnabled: true },
    select: { id: true, company: true, reminder1Days: true, reminder2Days: true, reminder3Days: true, logoUrl: true, iban: true, accountHolder: true },
  });

  let totalSent = 0;

  for (const user of users) {
    // Find overdue invoices for this user
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        clientId: user.id,
        status: { in: ["sent", "partial", "overdue"] },
        isCredit: false,
        dueDate: { lt: todayStr },
      },
      include: { customer: true },
    });

    for (const inv of overdueInvoices) {
      const dueDate = new Date(inv.dueDate);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      let shouldSend = false;
      if (inv.remindersSent === 0 && daysOverdue >= user.reminder1Days) shouldSend = true;
      if (inv.remindersSent === 1 && daysOverdue >= user.reminder2Days) shouldSend = true;
      if (inv.remindersSent === 2 && daysOverdue >= user.reminder3Days) shouldSend = true;

      if (!shouldSend || inv.remindersSent >= 3) continue;

      const customerEmail = inv.customer?.email;
      if (!customerEmail) continue;

      const remaining = Math.abs(inv.total) - inv.paidAmount;
      const companyName = user.company || "Uw boekhouder";
      const reminderNum = inv.remindersSent + 1;

      const html = `
        <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <div style="background:#fef3c7;padding:16px;border-radius:8px;margin-bottom:16px">
            <p style="margin:0;font-weight:bold;color:#92400e">Betalingsherinnering ${reminderNum}</p>
          </div>
          <p>Beste ${inv.customerName},</p>
          <p>Volgens onze administratie staat factuur ${inv.invoiceNumber} nog open.</p>
          <p><strong>Openstaand bedrag:</strong> ${formatCurrency(remaining)}</p>
          <p><strong>Vervaldatum:</strong> ${formatDate(inv.dueDate)}</p>
          <p>Wij verzoeken u vriendelijk deze zo spoedig mogelijk te voldoen.</p>
          <p>Met vriendelijke groet,<br>${companyName}</p>
          ${user.iban ? `<p style="font-size:13px;color:#666;margin-top:16px">Betaling: ${user.iban} t.n.v. ${user.accountHolder || companyName}</p>` : ""}
        </div>
      `;

      const sent = await sendEmail({
        to: customerEmail,
        subject: `Herinnering ${reminderNum} - Factuur ${inv.invoiceNumber} - ${companyName}`,
        html,
      });

      if (sent) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: { remindersSent: inv.remindersSent + 1, status: "overdue" },
        });
        totalSent++;
      }
    }
  }

  return Response.json({ sent: totalSent });
}
