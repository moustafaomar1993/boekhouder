"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Invoice, User } from "@/lib/data";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount);
}

const statusLabels: Record<string, string> = {
  draft: "Concept",
  sent: "Verzonden",
  paid: "Betaald",
  overdue: "Verlopen",
  pending: "In afwachting",
  processing: "In verwerking",
  processed: "Verwerkt",
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    sent: "bg-blue-100 text-blue-700",
    paid: "bg-green-100 text-green-700",
    overdue: "bg-red-100 text-red-700",
    pending: "bg-yellow-100 text-yellow-700",
    processing: "bg-blue-100 text-blue-700",
    processed: "bg-green-100 text-green-700",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100"}`}>
      {statusLabels[status] || status}
    </span>
  );
}

const CATEGORIES = [
  "Omzet",
  "Kostprijs omzet",
  "Bedrijfskosten",
  "Zakelijke dienstverlening",
  "Reis- en verblijfkosten",
  "Kantoorbenodigdheden",
  "Marketing",
  "Overig",
];

function formatDate(dateStr: string) {
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return dateStr;
}

export default function InvoiceReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [clients, setClients] = useState<User[]>([]);
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/invoices/${id}`).then((r) => r.json()).then((inv) => {
      setInvoice(inv);
      setCategory(inv.category || "Omzet");
    });
    fetch("/api/clients").then((r) => r.json()).then(setClients);
  }, [id]);

  function getClient(clientId: string) {
    return clients.find((c) => c.id === clientId);
  }

  async function updateStatus(bookkeepingStatus: string) {
    setSaving(true);
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookkeepingStatus, category }),
    });
    const updated = await res.json();
    setInvoice(updated);
    setSaving(false);
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Laden...</p>
      </div>
    );
  }

  const client = getClient(invoice.clientId);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Link href="/bookkeeper" className="text-emerald-600 hover:text-emerald-700">
                &larr; Terug naar dashboard
              </Link>
            </div>
            <StatusBadge status={invoice.bookkeepingStatus} />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Factuur Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
              <p className="text-gray-500 mt-1">
                Van: <strong>{client?.company || invoice.clientId}</strong>
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{formatCurrency(invoice.total)}</p>
              <StatusBadge status={invoice.status} />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Factuurdatum</p>
              <p className="font-medium">{formatDate(invoice.date)}</p>
            </div>
            <div>
              <p className="text-gray-500">Vervaldatum</p>
              <p className="font-medium">{formatDate(invoice.dueDate)}</p>
            </div>
            <div>
              <p className="text-gray-500">Debiteur</p>
              <p className="font-medium">{invoice.customerName}</p>
            </div>
            <div>
              <p className="text-gray-500">Adres debiteur</p>
              <p className="font-medium">{invoice.customerAddress}</p>
            </div>
          </div>
        </div>

        {/* Klantgegevens */}
        {client && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold mb-3">Klantgegevens</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Naam</p>
                <p className="font-medium">{client.name}</p>
              </div>
              <div>
                <p className="text-gray-500">Bedrijf</p>
                <p className="font-medium">{client.company}</p>
              </div>
              <div>
                <p className="text-gray-500">BTW-nummer</p>
                <p className="font-medium font-mono">{client.vatNumber}</p>
              </div>
              <div>
                <p className="text-gray-500">KvK-nummer</p>
                <p className="font-medium font-mono">{client.kvkNumber}</p>
              </div>
            </div>
          </div>
        )}

        {/* Factuurregels */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold">Factuurregels</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 font-medium">Omschrijving</th>
                <th className="px-6 py-3 font-medium text-right">Aantal</th>
                <th className="px-6 py-3 font-medium text-right">Prijs per stuk</th>
                <th className="px-6 py-3 font-medium text-right">BTW %</th>
                <th className="px-6 py-3 font-medium text-right">Regeltotaal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoice.items.map((item, i) => (
                <tr key={i}>
                  <td className="px-6 py-4">{item.description}</td>
                  <td className="px-6 py-4 text-right">{item.quantity}</td>
                  <td className="px-6 py-4 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-6 py-4 text-right">{item.vatRate}%</td>
                  <td className="px-6 py-4 text-right font-medium">
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-gray-200 p-6">
            <div className="w-64 ml-auto space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotaal</span>
                <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">BTW</span>
                <span className="font-medium">{formatCurrency(invoice.vatAmount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                <span>Totaal</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Boekhouding verwerking */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Boekhouding verwerking</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Huidige status</label>
              <div className="flex items-center gap-2 py-2">
                <StatusBadge status={invoice.bookkeepingStatus} />
                {invoice.category && (
                  <span className="text-sm text-gray-500">Categorie: {invoice.category}</span>
                )}
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Opmerkingen van klant</p>
              <p className="text-sm">{invoice.notes}</p>
            </div>
          )}

          <div className="flex gap-3">
            {invoice.bookkeepingStatus === "pending" && (
              <button
                onClick={() => updateStatus("processing")}
                disabled={saving}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                Start verwerking
              </button>
            )}
            {(invoice.bookkeepingStatus === "pending" || invoice.bookkeepingStatus === "processing") && (
              <button
                onClick={() => updateStatus("processed")}
                disabled={saving}
                className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                Markeer als verwerkt
              </button>
            )}
            {invoice.bookkeepingStatus === "processed" && (
              <button
                onClick={() => updateStatus("pending")}
                disabled={saving}
                className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Heropenen
              </button>
            )}
            <button
              onClick={() => router.push("/bookkeeper")}
              className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Terug naar overzicht
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
