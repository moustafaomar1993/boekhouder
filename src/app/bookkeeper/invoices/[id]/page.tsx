"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Invoice, User } from "@/lib/data";

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

const CATEGORIES = [
  "Revenue",
  "Cost of Goods Sold",
  "Operating Expenses",
  "Professional Services",
  "Travel & Entertainment",
  "Office Supplies",
  "Marketing",
  "Other",
];

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
      setCategory(inv.category || "Revenue");
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
        <p className="text-gray-500">Loading...</p>
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
                &larr; Back to Dashboard
              </Link>
            </div>
            <StatusBadge status={invoice.bookkeepingStatus} />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Invoice Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
              <p className="text-gray-500 mt-1">
                From: <strong>{client?.company || invoice.clientId}</strong>
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{formatCurrency(invoice.total)}</p>
              <StatusBadge status={invoice.status} />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Invoice Date</p>
              <p className="font-medium">{invoice.date}</p>
            </div>
            <div>
              <p className="text-gray-500">Due Date</p>
              <p className="font-medium">{invoice.dueDate}</p>
            </div>
            <div>
              <p className="text-gray-500">Customer</p>
              <p className="font-medium">{invoice.customerName}</p>
            </div>
            <div>
              <p className="text-gray-500">Customer Address</p>
              <p className="font-medium">{invoice.customerAddress}</p>
            </div>
          </div>
        </div>

        {/* Client Info */}
        {client && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold mb-3">Client Information</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Name</p>
                <p className="font-medium">{client.name}</p>
              </div>
              <div>
                <p className="text-gray-500">Company</p>
                <p className="font-medium">{client.company}</p>
              </div>
              <div>
                <p className="text-gray-500">VAT Number</p>
                <p className="font-medium font-mono">{client.vatNumber}</p>
              </div>
              <div>
                <p className="text-gray-500">KVK Number</p>
                <p className="font-medium font-mono">{client.kvkNumber}</p>
              </div>
            </div>
          </div>
        )}

        {/* Line Items */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold">Line Items</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 font-medium">Description</th>
                <th className="px-6 py-3 font-medium text-right">Qty</th>
                <th className="px-6 py-3 font-medium text-right">Unit Price</th>
                <th className="px-6 py-3 font-medium text-right">VAT %</th>
                <th className="px-6 py-3 font-medium text-right">Line Total</th>
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
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">VAT</span>
                <span className="font-medium">{formatCurrency(invoice.vatAmount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                <span>Total</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bookkeeping Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Bookkeeping Processing</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Status</label>
              <div className="flex items-center gap-2 py-2">
                <StatusBadge status={invoice.bookkeepingStatus} />
                {invoice.category && (
                  <span className="text-sm text-gray-500">Category: {invoice.category}</span>
                )}
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Notes from client</p>
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
                Start Processing
              </button>
            )}
            {(invoice.bookkeepingStatus === "pending" || invoice.bookkeepingStatus === "processing") && (
              <button
                onClick={() => updateStatus("processed")}
                disabled={saving}
                className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                Mark as Processed
              </button>
            )}
            {invoice.bookkeepingStatus === "processed" && (
              <button
                onClick={() => updateStatus("pending")}
                disabled={saving}
                className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Reopen
              </button>
            )}
            <button
              onClick={() => router.push("/bookkeeper")}
              className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Back to List
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
