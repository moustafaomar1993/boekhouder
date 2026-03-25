"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  vatNumber: string | null;
  paymentTermValue: number | null;
  paymentTermUnit: string | null;
  defaultDescription: string | null;
  defaultUnitPrice: number | null;
  defaultVatRate: number | null;
}

const CLIENT_ID = "client-1";

function calculateDueDate(invoiceDate: string, termValue: number = 1, termUnit: string = "months"): string {
  const date = new Date(invoiceDate);
  if (termUnit === "days") date.setDate(date.getDate() + termValue);
  else if (termUnit === "weeks") date.setDate(date.getDate() + termValue * 7);
  else date.setMonth(date.getMonth() + termValue);
  return date.toISOString().split("T")[0];
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount);
}

function formatDate(dateStr: string) {
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return dateStr;
}

export default function NewInvoice() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [lineTemplates, setLineTemplates] = useState<{ id: string; name: string; description: string; unitPrice: number; vatRate: number }[]>([]);
  const [companyInfo, setCompanyInfo] = useState<{ company: string; logoUrl: string | null; vatNumber: string | null; kvkNumber: string | null; iban: string | null; bankName: string | null; accountHolder: string | null } | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: "", email: "", phone: "", address: "", vatNumber: "" });
  const [newCustomerError, setNewCustomerError] = useState("");
  const [newCustomerSaving, setNewCustomerSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    invoiceNumber: "",
    date: new Date().toISOString().split("T")[0],
    dueDate: calculateDueDate(new Date().toISOString().split("T")[0]),
    customerName: "",
    customerAddress: "",
    notes: "",
  });
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0, vatRate: 21 },
  ]);

  useEffect(() => {
    fetch("/api/customers").then((r) => {
      if (!r.ok) return;
      return r.json();
    }).then((data) => {
      if (Array.isArray(data)) setCustomers(data);
    }).catch(() => {});

    // Fetch next invoice number
    fetch("/api/invoices/next-number").then((r) => {
      if (!r.ok) return;
      return r.json();
    }).then((data) => {
      if (data?.invoiceNumber) {
        setForm((prev) => ({ ...prev, invoiceNumber: data.invoiceNumber }));
      }
    }).catch(() => {});

    // Fetch line templates
    fetch("/api/line-templates").then((r) => r.ok ? r.json() : []).then((data) => {
      if (Array.isArray(data)) setLineTemplates(data);
    }).catch(() => {});

    // Fetch company profile for preview
    fetch("/api/profile").then((r) => {
      if (!r.ok) return;
      return r.json();
    }).then((data) => {
      if (data) setCompanyInfo(data);
    }).catch(() => {});
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredCustomers = customers.filter((c) => {
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.email && c.email.toLowerCase().includes(q));
  });

  function selectCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.name);
    const dueDate = customer.paymentTermValue && customer.paymentTermUnit
      ? calculateDueDate(form.date, customer.paymentTermValue, customer.paymentTermUnit)
      : calculateDueDate(form.date);
    setForm({
      ...form,
      customerName: customer.name,
      customerAddress: customer.address || "",
      dueDate,
    });
    // Pre-fill line items from customer defaults
    if (customer.defaultDescription) {
      setItems([{
        description: customer.defaultDescription,
        quantity: 1,
        unitPrice: customer.defaultUnitPrice || 0,
        vatRate: customer.defaultVatRate ?? 21,
      }]);
    }
    setShowDropdown(false);
  }

  function clearCustomer() {
    setSelectedCustomer(null);
    setCustomerSearch("");
    setForm({ ...form, customerName: "", customerAddress: "" });
  }

  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault();
    setNewCustomerError("");
    if (!newCustomerForm.name.trim()) {
      setNewCustomerError("Naam is verplicht");
      return;
    }
    setNewCustomerSaving(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCustomerForm),
      });
      if (!res.ok) {
        const data = await res.json();
        setNewCustomerError(data.error || "Er ging iets mis");
        return;
      }
      const newCustomer = await res.json();
      setCustomers((prev) => [...prev, newCustomer]);
      selectCustomer(newCustomer);
      setShowNewCustomerForm(false);
      setNewCustomerForm({ name: "", email: "", phone: "", address: "", vatNumber: "" });
    } finally {
      setNewCustomerSaving(false);
    }
  }

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const vatAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice * (item.vatRate / 100),
    0
  );
  const total = subtotal + vatAmount;

  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0, vatRate: 21 }]);
  }

  function removeItem(index: number) {
    if (items.length > 1) setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(status: "draft" | "sent") {
    setSaving(true);
    await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: CLIENT_ID,
        customerId: selectedCustomer?.id || null,
        invoiceNumber: form.invoiceNumber,
        date: form.date,
        dueDate: form.dueDate,
        customerName: form.customerName,
        customerAddress: form.customerAddress,
        items,
        notes: form.notes,
        status,
      }),
    });
    router.push("/client");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Link href="/client" className="text-blue-600 hover:text-blue-700">
                &larr; Terug
              </Link>
              <span className="text-gray-300">|</span>
              <h1 className="text-lg font-semibold">Nieuwe verkoopfactuur</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">

          {/* Customer Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Klant / Debiteur</label>
            <div className="relative" ref={dropdownRef}>
              {selectedCustomer ? (
                <div className="flex items-center justify-between border border-blue-200 bg-blue-50 rounded-lg px-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{selectedCustomer.name}</p>
                    {selectedCustomer.address && (
                      <p className="text-xs text-gray-500">{selectedCustomer.address}</p>
                    )}
                  </div>
                  <button
                    onClick={clearCustomer}
                    className="text-gray-400 hover:text-gray-600 ml-3"
                    title="Klant wijzigen"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Zoek een klant of typ een naam..."
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  {showDropdown && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => selectCustomer(c)}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                          >
                            <p className="text-sm font-medium">{c.name}</p>
                            {c.address && <p className="text-xs text-gray-500">{c.address}</p>}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          Geen klanten gevonden
                        </div>
                      )}
                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          setShowNewCustomerForm(true);
                          setNewCustomerForm({ ...newCustomerForm, name: customerSearch });
                        }}
                        className="w-full text-left px-4 py-3 text-blue-600 hover:bg-blue-50 border-t border-gray-100 text-sm font-medium"
                      >
                        + Nieuwe klant toevoegen
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Inline New Customer Form */}
          {showNewCustomerForm && (
            <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Nieuwe klant toevoegen</h3>
                <button
                  onClick={() => setShowNewCustomerForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {newCustomerError && (
                <div className="bg-red-50 text-red-700 rounded-lg px-3 py-2 text-sm mb-3">{newCustomerError}</div>
              )}
              <form onSubmit={handleCreateCustomer} className="space-y-3">
                <div>
                  <input
                    type="text"
                    value={newCustomerForm.name}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                    placeholder="Naam klant *"
                    autoFocus
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="email"
                    value={newCustomerForm.email}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                    placeholder="E-mailadres"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                  />
                  <input
                    type="tel"
                    value={newCustomerForm.phone}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                    placeholder="Telefoonnummer"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newCustomerForm.address}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                    placeholder="Adres"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                  />
                  <input
                    type="text"
                    value={newCustomerForm.vatNumber}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, vatNumber: e.target.value })}
                    placeholder="BTW-nummer"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewCustomerForm(false)}
                    className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Annuleren
                  </button>
                  <button
                    type="submit"
                    disabled={newCustomerSaving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {newCustomerSaving ? "Opslaan..." : "Klant toevoegen"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Factuurgegevens */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Factuurnummer</label>
              <input
                type="text"
                value={form.invoiceNumber}
                readOnly
                placeholder="Wordt automatisch gegenereerd"
                className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 cursor-not-allowed outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Factuurdatum</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vervaldatum</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Manual customer fields (shown when no customer selected) */}
          {!selectedCustomer && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Naam debiteur</label>
                <input
                  type="text"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  placeholder="Bedrijfsnaam"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adres debiteur</label>
                <input
                  type="text"
                  value={form.customerAddress}
                  onChange={(e) => setForm({ ...form, customerAddress: e.target.value })}
                  placeholder="Straat, Plaats"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* Factuurregels */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Factuurregels</h3>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    {index === 0 && <label className="block text-xs text-gray-500 mb-1">Omschrijving</label>}
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                      placeholder="Dienst of product"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    {index === 0 && <label className="block text-xs text-gray-500 mb-1">Aantal</label>}
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    {index === 0 && <label className="block text-xs text-gray-500 mb-1">Prijs per stuk</label>}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(index, "unitPrice", Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    {index === 0 && <label className="block text-xs text-gray-500 mb-1">BTW %</label>}
                    <select
                      value={item.vatRate}
                      onChange={(e) => updateItem(index, "vatRate", Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value={21}>21%</option>
                      <option value={9}>9%</option>
                      <option value={0}>0%</option>
                    </select>
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button
                      onClick={() => removeItem(index)}
                      className="text-red-400 hover:text-red-600 p-2"
                      title="Regel verwijderen"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={addItem}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + Regel toevoegen
            </button>
            {lineTemplates.length > 0 && (
              <select
                onChange={(e) => {
                  const t = lineTemplates.find((t) => t.id === e.target.value);
                  if (t) {
                    setItems((prev) => [...prev, { description: t.description, quantity: 1, unitPrice: t.unitPrice, vatRate: t.vatRate }]);
                    e.target.value = "";
                  }
                }}
                defaultValue=""
                className="mt-3 ml-4 text-sm text-blue-600 border border-blue-200 rounded-lg px-3 py-1.5 outline-none"
              >
                <option value="" disabled>Kies sjabloon...</option>
                {lineTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({formatCurrency(t.unitPrice)})</option>
                ))}
              </select>
            )}
          </div>

          {/* Opmerkingen */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Opmerkingen</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Betalingsvoorwaarden, extra informatie..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Totalen */}
          <div className="border-t border-gray-200 pt-4">
            <div className="w-64 ml-auto space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotaal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">BTW</span>
                <span className="font-medium">{formatCurrency(vatAmount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                <span>Totaal incl. BTW</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Acties */}
          <div className="flex gap-3 justify-end border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="px-4 py-2 border border-purple-200 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-50 mr-auto"
            >
              {showPreview ? "Voorbeeld sluiten" : "Voorbeeld"}
            </button>
            <Link href="/client" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Annuleren
            </Link>
            <button
              onClick={() => handleSubmit("draft")}
              disabled={saving}
              className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Opslaan als concept
            </button>
            <button
              onClick={() => handleSubmit("sent")}
              disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Factuur versturen
            </button>
          </div>
        </div>
      </main>

      {/* Preview Panel */}
      {showPreview && (
        <div className="fixed top-0 right-0 w-[480px] h-full bg-white border-l border-gray-200 shadow-xl z-50 overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-gray-700">Voorbeeld factuur</h2>
            <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-6">
            <div className="border border-gray-200 rounded-lg p-6 bg-white text-sm" style={{ fontSize: "12px" }}>
              {/* Invoice header */}
              <div className="flex justify-between mb-6">
                <div>
                  <p className="text-xl font-bold text-blue-600">Factuur</p>
                  <p className="text-gray-500">{form.invoiceNumber || "—"}</p>
                </div>
                <div className="text-right text-gray-500" style={{ fontSize: "11px" }}>
                  {companyInfo?.logoUrl && (
                    <img src={companyInfo.logoUrl} alt="Logo" className="ml-auto mb-2" style={{ maxHeight: "40px", maxWidth: "120px", objectFit: "contain" }} />
                  )}
                  <p className="font-semibold text-gray-700">{companyInfo?.company || "Uw bedrijf"}</p>
                  {companyInfo?.vatNumber && <p>BTW: {companyInfo.vatNumber}</p>}
                  {companyInfo?.kvkNumber && <p>KvK: {companyInfo.kvkNumber}</p>}
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-4 mb-6 pb-4 border-b border-gray-100">
                <div>
                  <p className="text-gray-400 uppercase" style={{ fontSize: "10px" }}>Factuurgegevens</p>
                  <p><strong>Datum:</strong> {form.date ? formatDate(form.date) : "—"}</p>
                  <p><strong>Vervaldatum:</strong> {form.dueDate ? formatDate(form.dueDate) : "—"}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase" style={{ fontSize: "10px" }}>Debiteur</p>
                  <p className="font-semibold">{form.customerName || "—"}</p>
                  <p>{form.customerAddress || "—"}</p>
                </div>
              </div>

              {/* Items table */}
              <table className="w-full mb-4" style={{ fontSize: "11px" }}>
                <thead>
                  <tr className="text-gray-400 uppercase border-b border-gray-200" style={{ fontSize: "9px" }}>
                    <th className="text-left py-2">Omschrijving</th>
                    <th className="text-right py-2">Aantal</th>
                    <th className="text-right py-2">Prijs</th>
                    <th className="text-right py-2">BTW</th>
                    <th className="text-right py-2">Totaal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2">{item.description || "—"}</td>
                      <td className="text-right py-2">{item.quantity}</td>
                      <td className="text-right py-2">{formatCurrency(item.unitPrice)}</td>
                      <td className="text-right py-2">{item.vatRate}%</td>
                      <td className="text-right py-2 font-medium">{formatCurrency(item.quantity * item.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="w-48 ml-auto space-y-1" style={{ fontSize: "11px" }}>
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotaal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">BTW</span>
                  <span>{formatCurrency(vatAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2 mt-2">
                  <span>Totaal</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              {form.notes && (
                <div className="mt-4 p-3 bg-gray-50 rounded text-gray-500" style={{ fontSize: "11px" }}>
                  <strong>Opmerkingen:</strong> {form.notes}
                </div>
              )}

              {companyInfo?.iban && (
                <div className="mt-4 pt-3 border-t border-gray-100 text-gray-400" style={{ fontSize: "10px" }}>
                  <p>Betaling: {companyInfo.iban}{companyInfo.bankName ? ` (${companyInfo.bankName})` : ""} t.n.v. {companyInfo.accountHolder || companyInfo.company || ""}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
