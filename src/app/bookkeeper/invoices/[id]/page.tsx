"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Invoice, User } from "@/lib/data";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount);
}

const statusLabels: Record<string, string> = {
  draft: "Concept", sent: "Verzonden", paid: "Betaald", overdue: "Verlopen",
  pending: "In afwachting", processing: "In verwerking", processed: "Verwerkt",
  to_book: "Te boeken", booked: "Geboekt",
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700", sent: "bg-blue-100 text-blue-700", paid: "bg-green-100 text-green-700",
    overdue: "bg-red-100 text-red-700", pending: "bg-yellow-100 text-yellow-700",
    processing: "bg-blue-100 text-blue-700", processed: "bg-green-100 text-green-700",
    to_book: "bg-amber-100 text-amber-700", booked: "bg-emerald-100 text-emerald-700",
  };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100"}`}>{statusLabels[status] || status}</span>;
}

const CATEGORIES = ["Omzet", "Kostprijs omzet", "Bedrijfskosten", "Zakelijke dienstverlening", "Reis- en verblijfkosten", "Kantoorbenodigdheden", "Marketing", "Overig"];

function formatDate(dateStr: string) {
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return dateStr;
}

interface CustomerData {
  id: string; name: string; email: string | null; phone: string | null;
  address: string | null; vatNumber: string | null; city: string | null; postalCode: string | null;
}

export default function InvoiceReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [clients, setClients] = useState<User[]>([]);
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  // Debtor management state
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [relatedInvoices, setRelatedInvoices] = useState<Invoice[]>([]);
  const [duplicateWarnings, setDuplicateWarnings] = useState<string[]>([]);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderEmail, setReminderEmail] = useState("");
  const [reminderSubject, setReminderSubject] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderSending, setReminderSending] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditLoading, setCreditLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/invoices/${id}`).then((r) => r.json()).then((inv) => {
      setInvoice(inv);
      setCategory(inv.category || "Omzet");
    });
    fetch("/api/clients").then((r) => r.json()).then(setClients);
  }, [id]);

  // Fetch customer details and related invoices for debtor management
  useEffect(() => {
    if (!invoice) return;
    // Fetch customer contact details
    if (invoice.customerId) {
      fetch(`/api/customers/${invoice.customerId}`).then((r) => r.ok ? r.json() : null).then((c) => {
        if (c) setCustomer(c);
      }).catch(() => {});
    }
    // Fetch all invoices for this client to find related/duplicate invoices
    fetch(`/api/invoices?clientId=${invoice.clientId}`).then((r) => r.json()).then((allInvs: Invoice[]) => {
      if (!Array.isArray(allInvs)) return;
      // Related invoices for the same debtor
      const related = allInvs.filter((i) => i.customerName === invoice.customerName && i.id !== invoice.id);
      setRelatedInvoices(related);
      // Duplicate checks
      const warnings: string[] = [];
      const sameNumber = allInvs.filter((i) => i.invoiceNumber === invoice.invoiceNumber && i.id !== invoice.id);
      if (sameNumber.length > 0) warnings.push(`Factuurnummer "${invoice.invoiceNumber}" komt ${sameNumber.length + 1}x voor.`);
      const similarAmount = related.filter((i) => Math.abs(i.total - invoice.total) < 0.01 && i.date === invoice.date && i.id !== invoice.id);
      if (similarAmount.length > 0) warnings.push(`${similarAmount.length} factuur/facturen met exact hetzelfde bedrag en datum voor deze debiteur.`);
      setDuplicateWarnings(warnings);
    }).catch(() => {});
  }, [invoice]);

  function getClient(clientId: string) {
    return clients.find((c) => c.id === clientId);
  }

  async function updateStatus(bookkeepingStatus: string) {
    setSaving(true);
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookkeepingStatus, category }),
    });
    const updated = await res.json();
    setInvoice(updated);
    setSaving(false);
  }

  function openReminderModal() {
    if (!invoice) return;
    setReminderEmail(customer?.email || "");
    setReminderSubject(`Herinnering: Factuur ${invoice.invoiceNumber}`);
    setReminderMessage(`Geachte heer/mevrouw,\n\nGraag herinneren wij u aan de openstaande factuur ${invoice.invoiceNumber} ter waarde van ${formatCurrency(invoice.total)}. De vervaldatum was ${formatDate(invoice.dueDate)}.\n\nWij verzoeken u vriendelijk het openstaande bedrag zo spoedig mogelijk over te maken.\n\nMet vriendelijke groet`);
    setReminderSent(false);
    setShowReminderModal(true);
  }

  async function sendReminder() {
    if (!reminderEmail) return;
    setReminderSending(true);
    try {
      const res = await fetch(`/api/invoices/${id}/remind`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: reminderEmail, subject: reminderSubject, message: reminderMessage }),
      });
      if (res.ok) {
        setReminderSent(true);
        // Update local invoice reminder count
        if (invoice) setInvoice({ ...invoice, remindersSent: (invoice.remindersSent || 0) + 1 });
      }
    } catch { /* */ }
    finally { setReminderSending(false); }
  }

  async function createCreditInvoice() {
    setCreditLoading(true);
    try {
      const res = await fetch(`/api/invoices/${id}/credit`, { method: "POST" });
      if (res.ok) {
        const creditInv = await res.json();
        setShowCreditModal(false);
        router.push(`/bookkeeper/invoices/${creditInv.id}`);
      }
    } catch { /* */ }
    finally { setCreditLoading(false); }
  }

  if (!invoice) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Laden...</p></div>;
  }

  const client = getClient(invoice.clientId);
  const isOverdueOrSent = invoice.status === "sent" || invoice.status === "overdue";
  const daysOverdue = (() => {
    const due = new Date(invoice.dueDate);
    const now = new Date();
    const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  })();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/bookkeeper?section=verkoop" className="text-[#00AFCB] hover:text-[#004854] text-sm font-medium">&larr; Terug naar Verkoop</Link>
            <div className="flex items-center gap-2">
              <StatusBadge status={invoice.status} />
              <StatusBadge status={invoice.bookkeepingStatus} />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Duplicate warnings */}
        {duplicateWarnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              <div>
                <p className="text-sm font-semibold text-amber-800">Mogelijke duplicaat / controle</p>
                {duplicateWarnings.map((w, i) => <p key={i} className="text-sm text-amber-700 mt-0.5">{w}</p>)}
              </div>
            </div>
          </div>
        )}

        {/* Invoice header + quick actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#3C2C1E]">{invoice.invoiceNumber}</h1>
              <p className="text-sm text-gray-500 mt-1">Van: <strong>{client?.company || invoice.clientId}</strong></p>
              {invoice.isCredit && <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Creditfactuur</span>}
            </div>
            <div className="text-left sm:text-right">
              <p className="text-2xl sm:text-3xl font-bold text-[#3C2C1E]">{formatCurrency(invoice.total)}</p>
              {daysOverdue > 0 && isOverdueOrSent && <p className="text-xs text-red-500 mt-1">{daysOverdue} dagen over vervaldatum</p>}
            </div>
          </div>

          {/* Quick action buttons */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
            {isOverdueOrSent && (
              <button onClick={openReminderModal} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                Herinnering sturen
              </button>
            )}
            {!invoice.isCredit && (
              <button onClick={() => setShowCreditModal(true)} className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>
                Creditfactuur maken
              </button>
            )}
            <Link href={`/bookkeeper/invoices/${id}`} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              Vernieuwen
            </Link>
          </div>
          {invoice.remindersSent > 0 && (
            <p className="text-xs text-gray-400 mt-3">{invoice.remindersSent} herinnering(en) verstuurd</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column: invoice details */}
          <div className="lg:col-span-2 space-y-5">
            {/* Invoice info grid */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-[#3C2C1E] mb-3">Factuurgegevens</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div><p className="text-gray-500 text-xs">Factuurdatum</p><p className="font-medium">{formatDate(invoice.date)}</p></div>
                <div><p className="text-gray-500 text-xs">Vervaldatum</p><p className="font-medium">{formatDate(invoice.dueDate)}</p></div>
                <div><p className="text-gray-500 text-xs">Debiteur</p><p className="font-medium">{invoice.customerName}</p></div>
                <div><p className="text-gray-500 text-xs">Adres</p><p className="font-medium text-xs">{invoice.customerAddress}</p></div>
              </div>
            </div>

            {/* Invoice lines */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100"><h2 className="text-sm font-semibold text-[#3C2C1E]">Factuurregels</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-2.5 font-medium">Omschrijving</th><th className="px-3 py-2.5 font-medium text-right">Aantal</th>
                    <th className="px-3 py-2.5 font-medium text-right">Prijs</th><th className="px-3 py-2.5 font-medium text-right">BTW</th>
                    <th className="px-3 py-2.5 font-medium text-right">Totaal</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {invoice.items.map((item, i) => (
                      <tr key={i}>
                        <td className="px-5 py-3 text-sm">{item.description}</td>
                        <td className="px-3 py-3 text-sm text-right">{item.quantity}</td>
                        <td className="px-3 py-3 text-sm text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-3 py-3 text-sm text-right text-gray-500">{item.vatRate}%</td>
                        <td className="px-3 py-3 text-sm text-right font-medium">{formatCurrency(item.quantity * item.unitPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-gray-200 p-5">
                <div className="w-56 ml-auto space-y-1.5">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotaal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">BTW</span><span>{formatCurrency(invoice.vatAmount)}</span></div>
                  <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-1.5"><span>Totaal</span><span>{formatCurrency(invoice.total)}</span></div>
                </div>
              </div>
            </div>

            {/* Bookkeeping processing */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-[#3C2C1E] mb-4">Boekhouding verwerking</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Categorie</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none">
                    {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <div className="flex items-center gap-2 py-2">
                    <StatusBadge status={invoice.bookkeepingStatus} />
                    {invoice.category && <span className="text-xs text-gray-400">{invoice.category}</span>}
                  </div>
                </div>
              </div>
              {invoice.notes && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500 mb-0.5">Opmerkingen</p><p className="text-sm">{invoice.notes}</p></div>
              )}
              <div className="flex flex-wrap gap-2">
                {(invoice.bookkeepingStatus === "pending" || invoice.bookkeepingStatus === "to_book" || invoice.bookkeepingStatus === "processing") && (
                  <button onClick={() => updateStatus("booked")} disabled={saving} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">Boeken</button>
                )}
                {(invoice.bookkeepingStatus === "booked" || invoice.bookkeepingStatus === "processed") && (
                  <button onClick={() => updateStatus("to_book")} disabled={saving} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">Heropenen</button>
                )}
                <button onClick={() => router.push("/bookkeeper?section=verkoop")} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Terug naar overzicht</button>
              </div>
            </div>
          </div>

          {/* Right column: debtor info + related invoices */}
          <div className="space-y-5">
            {/* Debtor contact card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-[#3C2C1E] mb-3">Debiteurgegevens</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Naam</p>
                  <p className="text-sm font-medium">{invoice.customerName}</p>
                </div>
                {customer?.email && (
                  <div>
                    <p className="text-xs text-gray-500">E-mail</p>
                    <a href={`mailto:${customer.email}`} className="text-sm text-[#00AFCB] hover:text-[#004854] font-medium">{customer.email}</a>
                  </div>
                )}
                {customer?.phone && (
                  <div>
                    <p className="text-xs text-gray-500">Telefoon</p>
                    <a href={`tel:${customer.phone}`} className="text-sm text-[#00AFCB] hover:text-[#004854] font-medium flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      {customer.phone}
                    </a>
                  </div>
                )}
                {customer?.address && (
                  <div>
                    <p className="text-xs text-gray-500">Adres</p>
                    <p className="text-sm text-gray-700">{customer.address}{customer.postalCode ? `, ${customer.postalCode}` : ""}{customer.city ? ` ${customer.city}` : ""}</p>
                  </div>
                )}
                {customer?.vatNumber && (
                  <div>
                    <p className="text-xs text-gray-500">BTW-nummer</p>
                    <p className="text-sm font-mono text-gray-700">{customer.vatNumber}</p>
                  </div>
                )}
                {!customer && (
                  <p className="text-xs text-gray-400">Geen debiteurgegevens beschikbaar. De debiteur is mogelijk niet gekoppeld aan een klantrecord.</p>
                )}
              </div>
            </div>

            {/* Client info */}
            {client && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="text-sm font-semibold text-[#3C2C1E] mb-3">Klant (factureerder)</h2>
                <div className="space-y-2 text-sm">
                  <div><span className="text-xs text-gray-500">Bedrijf</span><p className="font-medium">{client.company}</p></div>
                  <div><span className="text-xs text-gray-500">Contactpersoon</span><p>{client.name}</p></div>
                  {client.phone && <div><span className="text-xs text-gray-500">Telefoon</span><p><a href={`tel:${client.phone}`} className="text-[#00AFCB]">{client.phone}</a></p></div>}
                </div>
              </div>
            )}

            {/* Related invoices for this debtor */}
            {relatedInvoices.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="text-sm font-semibold text-[#3C2C1E] mb-3">Andere facturen voor {invoice.customerName}</h2>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {relatedInvoices.slice(0, 10).map((ri) => (
                    <Link key={ri.id} href={`/bookkeeper/invoices/${ri.id}`} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#004854]">{ri.invoiceNumber}</p>
                        <p className="text-[10px] text-gray-400">{formatDate(ri.date)}</p>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <span className="text-xs font-medium">{formatCurrency(ri.total)}</span>
                        <StatusBadge status={ri.status} />
                      </div>
                    </Link>
                  ))}
                  {relatedInvoices.length > 10 && <p className="text-xs text-gray-400 text-center">+{relatedInvoices.length - 10} meer</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Reminder modal */}
      {showReminderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowReminderModal(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#3C2C1E]">Herinnering sturen</h3>
              <button onClick={() => setShowReminderModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            {reminderSent ? (
              <div className="p-6 text-center">
                <svg className="w-12 h-12 text-emerald-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-sm font-medium text-gray-700">Herinnering verstuurd!</p>
                <button onClick={() => setShowReminderModal(false)} className="mt-4 px-4 py-2 bg-[#00AFCB] text-white rounded-lg text-sm font-medium hover:bg-[#008FA8]">Sluiten</button>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Aan (e-mailadres)</label>
                  <input type="email" value={reminderEmail} onChange={(e) => setReminderEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00AFCB]/30" placeholder="email@debiteur.nl" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Onderwerp</label>
                  <input type="text" value={reminderSubject} onChange={(e) => setReminderSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00AFCB]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Bericht</label>
                  <textarea value={reminderMessage} onChange={(e) => setReminderMessage(e.target.value)} rows={6}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00AFCB]/30 resize-none" />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowReminderModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Annuleren</button>
                  <button onClick={sendReminder} disabled={reminderSending || !reminderEmail}
                    className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50">
                    {reminderSending ? "Verzenden..." : "Verstuur herinnering"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Credit invoice confirmation modal */}
      {showCreditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreditModal(false)}>
          <div className="bg-white rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-[#3C2C1E]">Creditfactuur maken</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">Weet je zeker dat je een creditfactuur wilt aanmaken voor factuur <strong>{invoice.invoiceNumber}</strong>?</p>
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Origineel bedrag</span><span className="font-medium">{formatCurrency(invoice.total)}</span></div>
                <div className="flex justify-between mt-1"><span className="text-gray-500">Credit bedrag</span><span className="font-medium text-red-600">-{formatCurrency(invoice.total)}</span></div>
              </div>
              <p className="text-xs text-gray-400">De creditfactuur wordt aangemaakt als concept. Je kunt deze daarna bewerken en versturen.</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCreditModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Annuleren</button>
                <button onClick={createCreditInvoice} disabled={creditLoading}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50">
                  {creditLoading ? "Aanmaken..." : "Creditfactuur aanmaken"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
