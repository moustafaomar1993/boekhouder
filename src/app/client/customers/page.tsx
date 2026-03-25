"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  vatNumber: string | null;
  paymentTermValue: number | null;
  paymentTermUnit: string | null;
  createdAt: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", vatNumber: "", paymentTermValue: "", paymentTermUnit: "months" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    try {
      const res = await fetch("/api/customers");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setCustomers(data);
      }
    } catch {
      // Not logged in or network error
    }
    setLoading(false);
  }

  function resetForm() {
    setForm({ name: "", email: "", phone: "", address: "", vatNumber: "", paymentTermValue: "", paymentTermUnit: "months" });
    setEditingId(null);
    setShowForm(false);
    setError("");
  }

  function startEdit(customer: Customer) {
    setForm({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      vatNumber: customer.vatNumber || "",
      paymentTermValue: customer.paymentTermValue?.toString() || "",
      paymentTermUnit: customer.paymentTermUnit || "months",
    });
    setEditingId(customer.id);
    setShowForm(true);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Naam is verplicht");
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/customers/${editingId}` : "/api/customers";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          paymentTermValue: form.paymentTermValue ? parseInt(form.paymentTermValue, 10) : null,
          paymentTermUnit: form.paymentTermValue ? form.paymentTermUnit : null,
        }),
      });
      if (!res.ok) {
        try {
          const data = await res.json();
          setError(data.error || "Er ging iets mis");
        } catch {
          setError(res.status === 401 ? "Je bent niet ingelogd" : "Er ging iets mis");
        }
        return;
      }
      await fetchCustomers();
      resetForm();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Weet je zeker dat je deze klant wilt verwijderen?")) return;
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    await fetchCustomers();
  }

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.email && c.email.toLowerCase().includes(q));
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Link href="/client" className="text-blue-600 hover:text-blue-700">
                &larr; Terug
              </Link>
              <span className="text-gray-300">|</span>
              <h1 className="text-lg font-semibold">Mijn klanten</h1>
            </div>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              + Nieuwe klant
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Empty state */}
        {customers.length === 0 && !showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">Je hebt nog geen klanten</h2>
            <p className="text-gray-500 mb-6">Voeg je eerste klant toe om facturen te kunnen maken.</p>
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Eerste klant toevoegen
            </button>
          </div>
        )}

        {/* Create/Edit form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">
              {editingId ? "Klant bewerken" : "Nieuwe klant toevoegen"}
            </h2>
            {error && (
              <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Naam *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Bedrijfsnaam of naam klant"
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mailadres</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="klant@voorbeeld.nl"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefoonnummer</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="0612345678"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adres</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Straat 1, 1234 AB Plaats"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">BTW-nummer</label>
                  <input
                    type="text"
                    value={form.vatNumber}
                    onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
                    placeholder="NL123456789B01"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Betalingstermijn</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    value={form.paymentTermValue}
                    onChange={(e) => setForm({ ...form, paymentTermValue: e.target.value })}
                    placeholder="Bijv. 14, 1, 2"
                    className="w-24 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <select
                    value={form.paymentTermUnit}
                    onChange={(e) => setForm({ ...form, paymentTermUnit: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="days">Dagen</option>
                    <option value="weeks">Weken</option>
                    <option value="months">Maanden</option>
                  </select>
                  <span className="text-xs text-gray-400 self-center">Leeg = standaard 1 maand</span>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Opslaan..." : editingId ? "Opslaan" : "Klant toevoegen"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Customer list */}
        {customers.length > 0 && (
          <>
            {customers.length > 5 && (
              <div className="mb-4">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Zoek op naam of e-mail..."
                  className="w-full max-w-sm border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            )}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-3 font-medium">Naam</th>
                    <th className="px-5 py-3 font-medium">E-mail</th>
                    <th className="px-5 py-3 font-medium">Telefoon</th>
                    <th className="px-5 py-3 font-medium">Adres</th>
                    <th className="px-5 py-3 font-medium text-right">Acties</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <p className="font-medium">{c.name}</p>
                        {c.vatNumber && <p className="text-xs text-gray-400 mt-0.5">{c.vatNumber}</p>}
                      </td>
                      <td className="px-5 py-4 text-gray-600 text-sm">{c.email || "—"}</td>
                      <td className="px-5 py-4 text-gray-600 text-sm">{c.phone || "—"}</td>
                      <td className="px-5 py-4 text-gray-600 text-sm">{c.address || "—"}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => startEdit(c)}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Bewerken
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="text-sm text-red-500 hover:text-red-700 font-medium"
                          >
                            Verwijderen
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-gray-400">
                        Geen klanten gevonden.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-gray-400 mt-3">{filtered.length} klant(en)</p>
          </>
        )}
      </main>
    </div>
  );
}
