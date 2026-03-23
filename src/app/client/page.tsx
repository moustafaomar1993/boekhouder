"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Invoice, FiscalSummary, User } from "@/lib/data";

const CLIENT_ID = "client-1"; // Demo: hardcoded client

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount);
}

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
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${colors[status] || "bg-gray-100"}`}>
      {status}
    </span>
  );
}

export default function ClientPortal() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [fiscal, setFiscal] = useState<FiscalSummary | null>(null);
  const [client, setClient] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "invoices" | "fiscal">("overview");

  useEffect(() => {
    fetch(`/api/invoices?clientId=${CLIENT_ID}`).then((r) => r.json()).then(setInvoices);
    fetch(`/api/fiscal?clientId=${CLIENT_ID}`).then((r) => r.json()).then(setFiscal);
    fetch(`/api/clients`).then((r) => r.json()).then((clients: User[]) => {
      setClient(clients.find((c) => c.id === CLIENT_ID) || null);
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-xl font-bold text-blue-600">Boekhouder</Link>
              <span className="text-gray-300">|</span>
              <span className="text-sm text-gray-500">Client Portal</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/client/invoices/new"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                + New Invoice
              </Link>
              <div className="text-right">
                <p className="text-sm font-medium">{client?.name}</p>
                <p className="text-xs text-gray-500">{client?.company}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {(["overview", "invoices", "fiscal"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "overview" && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Total Revenue</p>
                <p className="text-2xl font-bold">{fiscal ? formatCurrency(fiscal.totalRevenue) : "..."}</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 mb-1">VAT to Pay</p>
                <p className="text-2xl font-bold text-orange-600">{fiscal ? formatCurrency(fiscal.vatToPay) : "..."}</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Invoices</p>
                <p className="text-2xl font-bold">{fiscal?.invoiceCount ?? "..."}</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{fiscal?.overdueCount ?? "..."}</p>
              </div>
            </div>

            {/* Recent Invoices */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-lg font-semibold">Recent Invoices</h2>
                <button onClick={() => setActiveTab("invoices")} className="text-sm text-blue-600 hover:text-blue-700">
                  View all
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {invoices.slice(0, 5).map((inv) => (
                  <div key={inv.id} className="p-5 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <p className="font-medium">{inv.invoiceNumber}</p>
                      <p className="text-sm text-gray-500">{inv.customerName} &middot; {inv.date}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <StatusBadge status={inv.status} />
                      <p className="font-semibold w-28 text-right">{formatCurrency(inv.total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === "invoices" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold">All Invoices</h2>
              <Link
                href="/client/invoices/new"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                + New Invoice
              </Link>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                  <th className="px-5 py-3 font-medium">Invoice #</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Due Date</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Bookkeeping</th>
                  <th className="px-5 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 font-medium">{inv.invoiceNumber}</td>
                    <td className="px-5 py-4 text-gray-600">{inv.customerName}</td>
                    <td className="px-5 py-4 text-gray-600">{inv.date}</td>
                    <td className="px-5 py-4 text-gray-600">{inv.dueDate}</td>
                    <td className="px-5 py-4"><StatusBadge status={inv.status} /></td>
                    <td className="px-5 py-4"><StatusBadge status={inv.bookkeepingStatus} /></td>
                    <td className="px-5 py-4 text-right font-semibold">{formatCurrency(inv.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "fiscal" && (
          <div className="space-y-6">
            {/* Company Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold mb-4">Fiscal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-500">Company</p>
                  <p className="font-medium">{client?.company}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">VAT Number (BTW)</p>
                  <p className="font-medium font-mono">{client?.vatNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">KVK Number</p>
                  <p className="font-medium font-mono">{client?.kvkNumber}</p>
                </div>
              </div>
            </div>

            {/* Tax Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold mb-4">Tax Summary (BTW)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600">Total Revenue (excl. BTW)</span>
                    <span className="font-semibold">{fiscal ? formatCurrency(fiscal.totalRevenue) : "..."}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600">BTW Collected (output)</span>
                    <span className="font-semibold">{fiscal ? formatCurrency(fiscal.totalVatCollected) : "..."}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600">BTW Deductible (input)</span>
                    <span className="font-semibold">{fiscal ? formatCurrency(fiscal.totalVatDeductible) : "..."}</span>
                  </div>
                  <div className="flex justify-between py-3 bg-orange-50 px-4 rounded-lg">
                    <span className="font-semibold text-orange-800">BTW to Pay</span>
                    <span className="font-bold text-orange-600">{fiscal ? formatCurrency(fiscal.vatToPay) : "..."}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600">Total Invoices</span>
                    <span className="font-semibold">{fiscal?.invoiceCount}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600">Paid</span>
                    <span className="font-semibold text-green-600">{fiscal?.paidCount}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600">Overdue</span>
                    <span className="font-semibold text-red-600">{fiscal?.overdueCount}</span>
                  </div>
                  <div className="flex justify-between py-3 bg-blue-50 px-4 rounded-lg">
                    <span className="font-semibold text-blue-800">Total Revenue (incl. BTW)</span>
                    <span className="font-bold text-blue-600">
                      {fiscal ? formatCurrency(fiscal.totalRevenue + fiscal.totalVatCollected) : "..."}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
