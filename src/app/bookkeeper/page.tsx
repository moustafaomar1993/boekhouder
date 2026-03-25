"use client";

import { useState, useEffect } from "react";
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

const filterLabels: Record<string, string> = {
  all: "Alles",
  pending: "In afwachting",
  processing: "In verwerking",
  processed: "Verwerkt",
};

export default function BookkeeperDashboard() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<User[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "processing" | "processed">("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/invoices").then((r) => r.json()).then(setInvoices);
    fetch("/api/clients").then((r) => r.json()).then(setClients);
  }, []);

  const filtered = invoices.filter((inv) => {
    if (filter !== "all" && inv.bookkeepingStatus !== filter) return false;
    if (clientFilter !== "all" && inv.clientId !== clientFilter) return false;
    return true;
  });

  const pendingCount = invoices.filter((i) => i.bookkeepingStatus === "pending").length;
  const processingCount = invoices.filter((i) => i.bookkeepingStatus === "processing").length;
  const processedCount = invoices.filter((i) => i.bookkeepingStatus === "processed").length;
  const totalRevenue = invoices.reduce((sum, i) => sum + i.subtotal, 0);

  function getClientName(clientId: string) {
    return clients.find((c) => c.id === clientId)?.company || clientId;
  }

  function formatDate(dateStr: string) {
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dateStr;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-xl font-bold text-emerald-600">Boekhouder</Link>
              <span className="text-gray-300">|</span>
              <span className="text-sm text-gray-500">Boekhouder Dashboard</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">Pieter van den Berg</p>
              <p className="text-xs text-gray-500">Boekhouder</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">Totaal facturen</p>
            <p className="text-2xl font-bold">{invoices.length}</p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-5 shadow-sm border border-yellow-100">
            <p className="text-sm text-yellow-700 mb-1">In afwachting</p>
            <p className="text-2xl font-bold text-yellow-700">{pendingCount}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-5 shadow-sm border border-blue-100">
            <p className="text-sm text-blue-700 mb-1">In verwerking</p>
            <p className="text-2xl font-bold text-blue-700">{processingCount}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-5 shadow-sm border border-green-100">
            <p className="text-sm text-green-700 mb-1">Verwerkt</p>
            <p className="text-2xl font-bold text-green-700">{processedCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6 items-center">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {(["all", "pending", "processing", "processed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {filterLabels[f]}
              </button>
            ))}
          </div>
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          >
            <option value="all">Alle klanten</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.company}</option>
            ))}
          </select>
          <span className="text-sm text-gray-500 ml-auto">
            Totale omzet: <strong>{formatCurrency(totalRevenue)}</strong>
          </span>
        </div>

        {/* Invoice Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 font-medium">Factuurnr.</th>
                <th className="px-5 py-3 font-medium">Klant</th>
                <th className="px-5 py-3 font-medium">Debiteur</th>
                <th className="px-5 py-3 font-medium">Datum</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Boekhouding</th>
                <th className="px-5 py-3 font-medium text-right">Bedrag</th>
                <th className="px-5 py-3 font-medium text-right">Actie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4 font-medium">{inv.invoiceNumber}</td>
                  <td className="px-5 py-4 text-gray-600 text-sm">{getClientName(inv.clientId)}</td>
                  <td className="px-5 py-4 text-gray-600">{inv.customerName}</td>
                  <td className="px-5 py-4 text-gray-600">{formatDate(inv.date)}</td>
                  <td className="px-5 py-4"><StatusBadge status={inv.status} /></td>
                  <td className="px-5 py-4"><StatusBadge status={inv.bookkeepingStatus} /></td>
                  <td className="px-5 py-4 text-right font-semibold">{formatCurrency(inv.total)}</td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/bookkeeper/invoices/${inv.id}`}
                      className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      Bekijken
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-gray-400">
                    Geen facturen gevonden met deze filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
