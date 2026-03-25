"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface RecurringInvoice {
  id: string;
  customerId: string;
  interval: string;
  nextDate: string;
  templateData: string;
  autoSend: boolean;
  active: boolean;
  customer: { name: string };
}

interface Customer {
  id: string;
  name: string;
}

const intervalLabels: Record<string, string> = {
  weekly: "Wekelijks",
  monthly: "Maandelijks",
  quarterly: "Per kwartaal",
  yearly: "Jaarlijks",
};

function formatDate(dateStr: string) {
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return dateStr;
}

export default function RecurringPage() {
  const [items, setItems] = useState<RecurringInvoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customerId: "", interval: "monthly", nextDate: "", description: "", unitPrice: "", vatRate: "21", autoSend: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/recurring-invoices").then((r) => r.ok ? r.json() : []),
      fetch("/api/customers").then((r) => r.ok ? r.json() : []),
    ]).then(([rec, custs]) => {
      if (Array.isArray(rec)) setItems(rec);
      if (Array.isArray(custs)) setCustomers(custs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const templateData = {
      items: [{ description: form.description || "Dienstverlening", quantity: 1, unitPrice: parseFloat(form.unitPrice) || 0, vatRate: parseFloat(form.vatRate) }],
    };
    const res = await fetch("/api/recurring-invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: form.customerId, interval: form.interval, nextDate: form.nextDate, templateData, autoSend: form.autoSend }),
    });
    if (res.ok) {
      const newItem = await res.json();
      setItems((prev) => [...prev, newItem]);
      setShowForm(false);
      setForm({ customerId: "", interval: "monthly", nextDate: "", description: "", unitPrice: "", vatRate: "21", autoSend: false });
    }
    setSaving(false);
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/recurring-invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, active: !active } : i));
  }

  async function handleDelete(id: string) {
    if (!confirm("Weet je zeker dat je deze terugkerende factuur wilt verwijderen?")) return;
    await fetch(`/api/recurring-invoices/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Link href="/client" className="text-blue-600 hover:text-blue-700">&larr; Terug</Link>
              <span className="text-gray-300">|</span>
              <h1 className="text-lg font-semibold">Terugkerende facturen</h1>
            </div>
            <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              + Nieuw
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Nieuwe terugkerende factuur</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Klant *</label>
                  <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecteer...</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interval *</label>
                  <select value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="weekly">Wekelijks</option>
                    <option value="monthly">Maandelijks</option>
                    <option value="quarterly">Per kwartaal</option>
                    <option value="yearly">Jaarlijks</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Startdatum *</label>
                  <input type="date" value={form.nextDate} onChange={(e) => setForm({ ...form, nextDate: e.target.value })} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bedrag (excl. BTW)</label>
                  <input type="number" step="0.01" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                    placeholder="0,00" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Omschrijving</label>
                  <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Bijv. Maandelijkse retainer" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.autoSend} onChange={(e) => setForm({ ...form, autoSend: e.target.checked })} className="rounded" />
                Automatisch versturen
              </label>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Annuleren</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Opslaan..." : "Aanmaken"}
                </button>
              </div>
            </form>
          </div>
        )}

        {items.length === 0 && !showForm ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <h2 className="text-xl font-semibold mb-2">Geen terugkerende facturen</h2>
            <p className="text-gray-500 mb-4">Maak een terugkerende factuur aan om automatisch facturen te genereren.</p>
            <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700">
              Eerste terugkerende factuur aanmaken
            </button>
          </div>
        ) : items.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 font-medium">Klant</th>
                  <th className="px-5 py-3 font-medium">Interval</th>
                  <th className="px-5 py-3 font-medium">Volgende datum</th>
                  <th className="px-5 py-3 font-medium">Auto-versturen</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 font-medium">{item.customer.name}</td>
                    <td className="px-5 py-4 text-gray-600">{intervalLabels[item.interval] || item.interval}</td>
                    <td className="px-5 py-4 text-gray-600">{formatDate(item.nextDate)}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.autoSend ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {item.autoSend ? "Ja" : "Nee"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.active ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                        {item.active ? "Actief" : "Gepauzeerd"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => toggleActive(item.id, item.active)}
                          className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 font-medium">
                          {item.active ? "Pauzeren" : "Activeren"}
                        </button>
                        <button onClick={() => handleDelete(item.id)}
                          className="text-xs px-2.5 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-medium">
                          Verwijderen
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
