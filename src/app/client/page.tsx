"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Invoice, FiscalSummary, User } from "@/lib/data";

const CLIENT_ID = "client-1"; // Demo: hardcoded client

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount);
}

const statusLabels: Record<string, string> = {
  draft: "Concept",
  sent: "Verzonden",
  paid: "Betaald",
  partial: "Deels betaald",
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
    partial: "bg-amber-100 text-amber-700",
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

const tabLabels: Record<string, string> = {
  overview: "Overzicht",
  invoices: "Facturen",
  fiscal: "Fiscaal",
};

function formatDate(dateStr: string) {
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return dateStr;
}

export default function ClientPortal() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [fiscal, setFiscal] = useState<FiscalSummary | null>(null);
  const [client, setClient] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "invoices" | "fiscal">("overview");
  const [viewMode, setViewMode] = useState<"advanced" | "simple">(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("invoiceViewMode") as "advanced" | "simple") || "advanced";
    return "advanced";
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"date" | "invoiceNumber" | "total">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showQuickInvoice, setShowQuickInvoice] = useState(false);
  const [quickForm, setQuickForm] = useState({ customerId: "", customerName: "", description: "", amount: "", vatRate: "21" });
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickResult, setQuickResult] = useState("");
  const [paymentModal, setPaymentModal] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", date: new Date().toISOString().split("T")[0], notes: "" });
  const [paymentSending, setPaymentSending] = useState(false);
  const [paymentResult, setPaymentResult] = useState("");
  const [emailModal, setEmailModal] = useState<{ invoiceId: string; type: "send" | "remind" } | null>(null);
  const [emailForm, setEmailForm] = useState({ to: "", subject: "", message: "" });
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState("");

  function getCreditStatus(inv: Invoice & { isCredit?: boolean; originalInvoiceId?: string | null; id: string }) {
    if (inv.isCredit) return null; // credit invoices don't have credit status
    const credits = invoices.filter((i) => (i as Invoice & { originalInvoiceId?: string }).originalInvoiceId === inv.id);
    if (credits.length === 0) return null;
    const totalCredited = credits.reduce((sum, ci) => sum + Math.abs(ci.total), 0);
    const originalTotal = Math.abs(inv.total);
    if (totalCredited >= originalTotal) return "full";
    return "partial";
  }

  async function handleCredit(invoiceId: string) {
    setActionLoading(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/credit`, { method: "POST" });
      if (res.ok) {
        const credit = await res.json();
        router.push(`/client/invoices/${credit.id}/edit`);
      } else {
        try {
          const data = await res.json();
          alert(data.error || "Er ging iets mis");
        } catch {
          alert("Er ging iets mis");
        }
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCopy(invoiceId: string) {
    setActionLoading(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/copy`, { method: "POST" });
      if (res.ok) {
        const copied = await res.json();
        router.push(`/client/invoices/${copied.id}/edit`);
      }
    } finally {
      setActionLoading(null);
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-actions-menu]")) setOpenMenuId(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetch(`/api/invoices?clientId=${CLIENT_ID}`).then((r) => r.json()).then(setInvoices);
    fetch(`/api/fiscal?clientId=${CLIENT_ID}`).then((r) => r.json()).then(setFiscal);
    fetch(`/api/clients`).then((r) => r.json()).then((clients: User[]) => {
      setClient(clients.find((c) => c.id === CLIENT_ID) || null);
    });
    fetch("/api/customers").then((r) => r.ok ? r.json() : []).then((data) => {
      if (Array.isArray(data)) setCustomers(data);
    }).catch(() => {});
  }, []);

  const filteredInvoices = invoices.filter((inv) => {
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesSearch = inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.items.some((item) => item.description.toLowerCase().includes(q));
      if (!matchesSearch) return false;
    }
    // Status filter
    if (statusFilter !== "all") {
      const ext = inv as Invoice & { isCredit?: boolean };
      if (statusFilter === "credit") {
        if (!ext.isCredit) return false;
      } else if (inv.status !== statusFilter) return false;
    }
    // Customer filter
    if (customerFilter !== "all" && inv.customerName !== customerFilter) return false;
    // Period filter
    if (periodFilter !== "all") {
      const now = new Date();
      const invDate = new Date(inv.date);
      if (periodFilter === "this-month") {
        if (invDate.getMonth() !== now.getMonth() || invDate.getFullYear() !== now.getFullYear()) return false;
      } else if (periodFilter === "last-month") {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        if (invDate.getMonth() !== lastMonth.getMonth() || invDate.getFullYear() !== lastMonth.getFullYear()) return false;
      } else if (periodFilter === "this-year") {
        if (invDate.getFullYear() !== now.getFullYear()) return false;
      }
    }
    return true;
  });

  const hasActiveFilters = searchQuery || statusFilter !== "all" || customerFilter !== "all" || periodFilter !== "all";

  async function handleQuickInvoice(status: "draft" | "sent") {
    const amount = parseFloat(quickForm.amount);
    if (!quickForm.customerName || !amount) { setQuickResult("Klant en bedrag zijn verplicht"); return; }
    setQuickSaving(true);
    setQuickResult("");
    try {
      const numRes = await fetch("/api/invoices/next-number").then((r) => r.ok ? r.json() : null).catch(() => null);
      const invoiceNumber = numRes?.invoiceNumber || "";
      const today = new Date().toISOString().split("T")[0];
      const vatRate = parseFloat(quickForm.vatRate);
      const vatAmount = amount * (vatRate / 100);
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: CLIENT_ID,
          customerId: quickForm.customerId || null,
          invoiceNumber,
          date: today,
          dueDate: (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().split("T")[0]; })(),
          customerName: quickForm.customerName,
          customerAddress: "",
          items: [{ description: quickForm.description || "Dienstverlening", quantity: 1, unitPrice: amount, vatRate }],
          notes: "",
          status,
        }),
      });
      if (res.ok) {
        setQuickResult(status === "sent" ? "Factuur aangemaakt en verzonden!" : "Factuur opgeslagen als concept!");
        const updated = await fetch(`/api/invoices?clientId=${CLIENT_ID}`).then((r) => r.json());
        setInvoices(updated);
        setTimeout(() => { setShowQuickInvoice(false); setQuickForm({ customerId: "", customerName: "", description: "", amount: "", vatRate: "21" }); setQuickResult(""); }, 1200);
      }
    } catch { setQuickResult("Er ging iets mis"); }
    finally { setQuickSaving(false); }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredInvoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInvoices.map((i) => i.id)));
    }
  }

  async function bulkMarkPaid() {
    const eligible = [...selectedIds].filter((id) => {
      const inv = invoices.find((i) => i.id === id);
      return inv && inv.status !== "paid" && !inv.isCredit;
    });
    if (eligible.length === 0) { alert("Geen facturen om als betaald te markeren."); return; }
    if (!confirm(`Weet je zeker dat je ${eligible.length} factuur/facturen als betaald wilt markeren?`)) return;
    setBulkLoading(true);
    for (const id of eligible) {
      await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      });
    }
    const updated = await fetch(`/api/invoices?clientId=${CLIENT_ID}`).then((r) => r.json());
    setInvoices(updated);
    setSelectedIds(new Set());
    setBulkLoading(false);
  }

  async function bulkRemind() {
    const eligible = [...selectedIds].filter((id) => {
      const inv = invoices.find((i) => i.id === id);
      return inv && (inv.status === "sent" || inv.status === "partial" || inv.status === "overdue") && !inv.isCredit;
    });
    if (eligible.length === 0) { alert("Geen openstaande facturen geselecteerd voor herinnering."); return; }
    if (!confirm(`Herinnering sturen voor ${eligible.length} factuur/facturen?`)) return;
    setBulkLoading(true);
    let sent = 0;
    for (const id of eligible) {
      const inv = invoices.find((i) => i.id === id);
      if (!inv) continue;
      const companyName = client?.company || "Uw bedrijf";
      await fetch(`/api/invoices/${id}/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "klant@voorbeeld.nl",
          subject: `Herinnering factuur ${inv.invoiceNumber} - ${companyName}`,
          message: `Beste ${inv.customerName},\n\nVolgens onze administratie staat factuur ${inv.invoiceNumber} nog open.\n\nMet vriendelijke groet,\n${companyName}`,
        }),
      });
      sent++;
    }
    alert(`${sent} herinnering(en) verstuurd.`);
    setSelectedIds(new Set());
    setBulkLoading(false);
  }

  async function bulkDownloadPdf() {
    setBulkLoading(true);
    const ids = [...selectedIds];
    for (const id of ids) {
      // Use fetch + blob to trigger real file download without popup blocker
      try {
        const res = await fetch(`/api/invoices/${id}/pdf?download=1`);
        if (!res.ok) continue;
        const blob = await res.blob();
        const inv = invoices.find((i) => i.id === id);
        const filename = `${inv?.invoiceNumber || id}.pdf`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch { /* skip failed */ }
    }
    setBulkLoading(false);
  }

  function bulkExportCsv() {
    const selected = invoices.filter((i) => selectedIds.has(i.id));
    const header = "Factuurnummer;Klant;Datum;Vervaldatum;Status;Subtotaal;BTW;Totaal";
    const rows = selected.map((i) =>
      `${i.invoiceNumber};${i.customerName};${i.date};${i.dueDate};${i.status};${i.subtotal.toFixed(2)};${i.vatAmount.toFixed(2)};${i.total.toFixed(2)}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `facturen-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openPaymentModal(invoiceId: string) {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    const remaining = Math.abs(inv.total) - (inv as Invoice & { paidAmount?: number }).paidAmount || Math.abs(inv.total);
    setPaymentForm({ amount: remaining.toFixed(2), date: new Date().toISOString().split("T")[0], notes: "" });
    setPaymentResult("");
    setPaymentModal(invoiceId);
  }

  async function handlePayment() {
    if (!paymentModal) return;
    const amount = parseFloat(paymentForm.amount);
    if (!amount || amount <= 0) { setPaymentResult("Voer een geldig bedrag in"); return; }
    setPaymentSending(true);
    setPaymentResult("");
    try {
      const res = await fetch(`/api/invoices/${paymentModal}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, date: paymentForm.date, notes: paymentForm.notes }),
      });
      if (res.ok) {
        setPaymentResult("Betaling geregistreerd!");
        const updated = await fetch(`/api/invoices?clientId=${CLIENT_ID}`).then((r) => r.json());
        setInvoices(updated);
        setTimeout(() => setPaymentModal(null), 1200);
      } else {
        try { const d = await res.json(); setPaymentResult(d.error || "Mislukt"); } catch { setPaymentResult("Mislukt"); }
      }
    } finally { setPaymentSending(false); }
  }

  function openEmailModal(invoiceId: string, type: "send" | "remind") {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    const companyName = client?.company || "Uw bedrijf";

    if (type === "send") {
      setEmailForm({
        to: "",
        subject: `Factuur ${inv.invoiceNumber} - ${companyName}`,
        message: `Beste ${inv.customerName},\n\nHierbij ontvangt u factuur ${inv.invoiceNumber}.\n\nWij verzoeken u vriendelijk deze vóór ${formatDate(inv.dueDate)} te voldoen.\n\nMet vriendelijke groet,\n${companyName}`,
      });
    } else {
      setEmailForm({
        to: "",
        subject: `Herinnering factuur ${inv.invoiceNumber} - ${companyName}`,
        message: `Beste ${inv.customerName},\n\nVolgens onze administratie staat factuur ${inv.invoiceNumber} nog open.\n\nWij verzoeken u vriendelijk deze zo spoedig mogelijk te voldoen.\n\nMet vriendelijke groet,\n${companyName}`,
      });
    }
    setEmailResult("");
    setEmailModal({ invoiceId, type });
  }

  async function handleSendEmail() {
    if (!emailModal) return;
    if (!emailForm.to) { setEmailResult("E-mailadres is verplicht"); return; }
    setEmailSending(true);
    setEmailResult("");
    try {
      const endpoint = emailModal.type === "send"
        ? `/api/invoices/${emailModal.invoiceId}/send`
        : `/api/invoices/${emailModal.invoiceId}/remind`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailForm),
      });
      if (res.ok) {
        setEmailResult("E-mail succesvol verzonden!");
        if (emailModal.type === "send") {
          const updated = await fetch(`/api/invoices?clientId=${CLIENT_ID}`).then((r) => r.json());
          setInvoices(updated);
        }
        setTimeout(() => setEmailModal(null), 1500);
      } else {
        try {
          const data = await res.json();
          setEmailResult(data.error || "Verzenden mislukt");
        } catch { setEmailResult("Verzenden mislukt"); }
      }
    } finally {
      setEmailSending(false);
    }
  }

  function resetFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setCustomerFilter("all");
    setPeriodFilter("all");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-xl font-bold text-blue-600">Boekhouder</Link>
              <span className="text-gray-300">|</span>
              <span className="text-sm text-gray-500">Klantenportaal</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/client/customers"
                className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Mijn klanten
              </Link>
              <Link
                href="/client/quotations"
                className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Offertes
              </Link>
              <Link
                href="/client/recurring"
                className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Terugkerend
              </Link>
              <Link
                href="/client/settings"
                className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Instellingen
              </Link>
              <button
                onClick={() => setShowQuickInvoice(true)}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                Snelle factuur
              </button>
              <Link
                href="/client/invoices/new"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                + Nieuwe factuur
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
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "overview" && (
          <>
            {/* Cashflow kaarten */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-blue-50 rounded-xl p-5 shadow-sm border border-blue-100">
                <p className="text-sm text-blue-700 mb-1">Totaal openstaand</p>
                <p className="text-2xl font-bold text-blue-700">{fiscal ? formatCurrency(fiscal.totalOutstanding) : "..."}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-5 shadow-sm border border-red-100">
                <p className="text-sm text-red-700 mb-1">Te laat</p>
                <p className="text-2xl font-bold text-red-700">{fiscal ? formatCurrency(fiscal.totalOverdue) : "..."}</p>
                {fiscal && fiscal.overdueCount > 0 && <p className="text-xs text-red-500 mt-1">{fiscal.overdueCount} factuur/facturen</p>}
              </div>
              <div className="bg-green-50 rounded-xl p-5 shadow-sm border border-green-100">
                <p className="text-sm text-green-700 mb-1">Betaald deze maand</p>
                <p className="text-2xl font-bold text-green-700">{fiscal ? formatCurrency(fiscal.paidThisMonth) : "..."}</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-5 shadow-sm border border-purple-100">
                <p className="text-sm text-purple-700 mb-1">Verwachte inkomsten</p>
                <p className="text-2xl font-bold text-purple-700">{fiscal ? formatCurrency(fiscal.expectedIncome) : "..."}</p>
              </div>
            </div>

            {/* Recente facturen */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-lg font-semibold">Recente facturen</h2>
                <button onClick={() => setActiveTab("invoices")} className="text-sm text-blue-600 hover:text-blue-700">
                  Alles bekijken
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {invoices.slice(0, 5).map((inv) => (
                  <div key={inv.id} className="p-5 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <p className="font-medium">{inv.invoiceNumber}</p>
                      <p className="text-sm text-gray-500">{inv.customerName} &middot; {formatDate(inv.date)}</p>
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
          <div>
          {/* View Mode Toggle */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-4">
            <button
              onClick={() => { setViewMode("advanced"); localStorage.setItem("invoiceViewMode", "advanced"); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === "advanced" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Geavanceerd overzicht
            </button>
            <button
              onClick={() => { setViewMode("simple"); localStorage.setItem("invoiceViewMode", "simple"); setSelectedIds(new Set()); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === "simple" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Eenvoudig overzicht
            </button>
          </div>

          {viewMode === "simple" ? (
            /* ===== SIMPLE VIEW ===== */
            <div className="space-y-3">
              {[...filteredInvoices].sort((a, b) => {
                const cmp = a.date.localeCompare(b.date);
                return -cmp; // newest first
              }).map((inv) => {
                const ext = inv as Invoice & { isCredit?: boolean };
                let simpleStatus = "Open";
                let statusColor = "bg-blue-100 text-blue-700";
                if (inv.status === "paid") { simpleStatus = "Betaald"; statusColor = "bg-green-100 text-green-700"; }
                else if (inv.status === "overdue") { simpleStatus = "Te laat"; statusColor = "bg-red-100 text-red-700"; }
                else if (inv.status === "partial") { simpleStatus = "Deels betaald"; statusColor = "bg-amber-100 text-amber-700"; }
                else if (inv.status === "draft") { simpleStatus = "Concept"; statusColor = "bg-gray-100 text-gray-600"; }
                if (ext.isCredit) { simpleStatus = "Creditfactuur"; statusColor = "bg-red-50 text-red-600"; }

                return (
                  <Link key={inv.id} href={`/client/invoices/${inv.id}/view`}
                    className="block bg-white rounded-xl border border-gray-100 p-5 flex items-center justify-between hover:shadow-md hover:border-blue-200 transition-all cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="text-lg font-semibold text-gray-900">{inv.customerName}</p>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>{simpleStatus}</span>
                        {(inv as Invoice & { _count?: { invoiceNotes: number } })._count?.invoiceNotes ? (
                          <span className="text-amber-500" title="Heeft notities">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2z" clipRule="evenodd" /></svg>
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-gray-400">
                        {inv.invoiceNumber} · {formatDate(inv.date)}
                        {inv.dueDate && ` · Vervaldatum: ${formatDate(inv.dueDate)}`}
                      </p>
                    </div>
                    <div className="text-right ml-6 shrink-0">
                      <p className={`text-xl font-bold ${inv.total < 0 ? "text-red-600" : "text-gray-900"}`}>{formatCurrency(inv.total)}</p>
                    </div>
                  </Link>
                );
              })}
              {filteredInvoices.length === 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
                  Geen facturen gevonden.
                </div>
              )}
            </div>
          ) : (
          /* ===== ADVANCED VIEW ===== */
          <div>
          {/* Search & Filters */}
          <div className="mb-4 space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoek op factuurnummer, klant of omschrijving..."
                className="flex-1 min-w-[250px] border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="all">Alle statussen</option>
                <option value="draft">Concept</option>
                <option value="sent">Verzonden</option>
                <option value="paid">Betaald</option>
                <option value="partial">Deels betaald</option>
                <option value="overdue">Verlopen</option>
                <option value="credit">Creditfactuur</option>
              </select>
              <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="all">Alle klanten</option>
                {[...new Set(invoices.map((i) => i.customerName))].sort().map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="all">Alle periodes</option>
                <option value="this-month">Deze maand</option>
                <option value="last-month">Vorige maand</option>
                <option value="this-year">Dit jaar</option>
              </select>
              {hasActiveFilters && (
                <button onClick={resetFilters} className="text-sm text-red-500 hover:text-red-700 font-medium">
                  Filters wissen
                </button>
              )}
            </div>
            <p className="text-sm text-gray-400">{filteredInvoices.length} factuur/facturen</p>
          </div>

          {/* Bulk Action Bar */}
          {selectedIds.size > 0 && (
            <div className="bg-blue-600 text-white rounded-xl px-5 py-3 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{selectedIds.size} geselecteerd</span>
                <button onClick={() => setSelectedIds(new Set())} className="text-xs text-blue-200 hover:text-white underline">
                  Selectie wissen
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={bulkMarkPaid} disabled={bulkLoading}
                  className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg font-medium disabled:opacity-50">
                  Markeer als betaald
                </button>
                <button onClick={bulkRemind} disabled={bulkLoading}
                  className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg font-medium disabled:opacity-50">
                  Herinnering sturen
                </button>
                <button onClick={bulkDownloadPdf}
                  className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg font-medium">
                  PDF downloaden
                </button>
                <button onClick={bulkExportCsv}
                  className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg font-medium">
                  Exporteren (CSV)
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Alle facturen</h2>
              <Link
                href="/client/invoices/new"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                + Nieuwe factuur
              </Link>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                  <th className="px-3 py-3 w-10">
                    <input type="checkbox" checked={selectedIds.size === filteredInvoices.length && filteredInvoices.length > 0}
                      onChange={toggleSelectAll} className="rounded w-4 h-4 text-blue-600" />
                  </th>
                  <th className="px-5 py-3 font-medium">
                    <button onClick={() => { if (sortField === "invoiceNumber") setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortField("invoiceNumber"); setSortDir("asc"); } }} className="flex items-center gap-1 hover:text-gray-900">
                      Factuurnr.
                      {sortField === "invoiceNumber" && <span className="text-blue-600">{sortDir === "asc" ? "↑" : "↓"}</span>}
                    </button>
                  </th>
                  <th className="px-5 py-3 font-medium">Debiteur</th>
                  <th className="px-5 py-3 font-medium">
                    <button onClick={() => { if (sortField === "date") setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortField("date"); setSortDir("desc"); } }} className="flex items-center gap-1 hover:text-gray-900">
                      Factuurdatum
                      {sortField === "date" && <span className="text-blue-600">{sortDir === "asc" ? "↑" : "↓"}</span>}
                    </button>
                  </th>
                  <th className="px-5 py-3 font-medium">Vervaldatum</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Boekhouding</th>
                  <th className="px-5 py-3 font-medium text-right">
                    <button onClick={() => { if (sortField === "total") setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortField("total"); setSortDir("desc"); } }} className="flex items-center gap-1 ml-auto hover:text-gray-900">
                      Bedrag
                      {sortField === "total" && <span className="text-blue-600">{sortDir === "asc" ? "↑" : "↓"}</span>}
                    </button>
                  </th>
                  <th className="px-5 py-3 font-medium text-right">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...filteredInvoices].sort((a, b) => {
                  let cmp = 0;
                  if (sortField === "invoiceNumber") cmp = a.invoiceNumber.localeCompare(b.invoiceNumber);
                  else if (sortField === "date") cmp = a.date.localeCompare(b.date);
                  else if (sortField === "total") cmp = a.total - b.total;
                  return sortDir === "asc" ? cmp : -cmp;
                }).map((inv) => {
                  const ext = inv as Invoice & { isCredit?: boolean; originalInvoiceId?: string | null };
                  const creditStatus = getCreditStatus(ext);
                  const isFullyCredited = creditStatus === "full";
                  return (
                  <tr key={inv.id} className={`hover:bg-gray-50 ${selectedIds.has(inv.id) ? "bg-blue-50" : ""}`}>
                    <td className="px-3 py-4">
                      <input type="checkbox" checked={selectedIds.has(inv.id)}
                        onChange={() => toggleSelect(inv.id)} className="rounded w-4 h-4 text-blue-600" />
                    </td>
                    <td className="px-5 py-4">
                      <Link href={`/client/invoices/${inv.id}/view`} className="font-medium text-blue-600 hover:text-blue-800 hover:underline">{inv.invoiceNumber}</Link>
                      {(inv as Invoice & { _count?: { invoiceNotes: number } })._count?.invoiceNotes ? (
                        <span className="ml-1.5 text-amber-500" title="Heeft notities">
                          <svg className="w-3.5 h-3.5 inline" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2z" clipRule="evenodd" /></svg>
                        </span>
                      ) : null}
                      {ext.isCredit && (
                        <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">Creditfactuur</span>
                      )}
                      {creditStatus === "full" && (
                        <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded font-medium">Gecrediteerd</span>
                      )}
                      {creditStatus === "partial" && (
                        <span className="ml-2 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded font-medium">Deels gecrediteerd</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-600">{inv.customerName}</td>
                    <td className="px-5 py-4 text-gray-600">{formatDate(inv.date)}</td>
                    <td className="px-5 py-4 text-gray-600">{formatDate(inv.dueDate)}</td>
                    <td className="px-5 py-4"><StatusBadge status={inv.status} /></td>
                    <td className="px-5 py-4"><StatusBadge status={inv.bookkeepingStatus} /></td>
                    <td className="px-5 py-4 text-right font-semibold">{formatCurrency(inv.total)}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="relative" data-actions-menu>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === inv.id ? null : inv.id)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                            openMenuId === inv.id
                              ? "bg-gray-800 text-white shadow-inner"
                              : "border border-gray-300 text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          Acties
                          <svg className={`inline-block w-3.5 h-3.5 ml-1 transition-transform ${openMenuId === inv.id ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {openMenuId === inv.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 text-left">
                            {inv.status === "draft" ? (
                              <Link href={`/client/invoices/${inv.id}/edit`} onClick={() => setOpenMenuId(null)}
                                className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">Bewerken</Link>
                            ) : (
                              <Link href={`/client/invoices/${inv.id}/view`} onClick={() => setOpenMenuId(null)}
                                className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">Bekijken</Link>
                            )}
                            <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noopener noreferrer"
                              className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">PDF bekijken</a>
                            <button onClick={async () => {
                              setOpenMenuId(null);
                              const res = await fetch(`/api/invoices/${inv.id}/pdf?download=1`);
                              if (!res.ok) return;
                              const blob = await res.blob();
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url; a.download = `${inv.invoiceNumber}.pdf`;
                              document.body.appendChild(a); a.click(); document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">PDF downloaden</button>
                            <div className="border-t border-gray-100 my-1" />
                            {!ext.isCredit && inv.status === "draft" && (
                              <button onClick={() => { setOpenMenuId(null); openEmailModal(inv.id, "send"); }}
                                className="w-full text-left px-4 py-2.5 text-sm text-green-600 hover:bg-green-50">Versturen</button>
                            )}
                            {!ext.isCredit && (inv.status === "sent" || inv.status === "partial" || inv.status === "overdue") && (
                              <>
                                <button onClick={() => { setOpenMenuId(null); openEmailModal(inv.id, "remind"); }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-orange-600 hover:bg-orange-50">Herinnering sturen</button>
                                <button onClick={() => { setOpenMenuId(null); openPaymentModal(inv.id); }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50">Betaling registreren</button>
                              </>
                            )}
                            <div className="border-t border-gray-100 my-1" />
                            <button onClick={() => { setOpenMenuId(null); handleCopy(inv.id); }}
                              className="w-full text-left px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50">Kopiëren</button>
                            {!ext.isCredit && !isFullyCredited && (
                              <button onClick={() => { setOpenMenuId(null); handleCredit(inv.id); }}
                                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">Crediteren</button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
          )}
          </div>
        )}

        {activeTab === "fiscal" && (
          <div className="space-y-6">
            {/* Bedrijfsgegevens */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold mb-4">Fiscale gegevens</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-500">Bedrijf</p>
                  <p className="font-medium">{client?.company}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">BTW-nummer</p>
                  <p className="font-medium font-mono">{client?.vatNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">KvK-nummer</p>
                  <p className="font-medium font-mono">{client?.kvkNumber}</p>
                </div>
              </div>
            </div>

            {/* BTW overzicht */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold mb-4">BTW-overzicht</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600">Totale omzet (excl. BTW)</span>
                    <span className="font-semibold">{fiscal ? formatCurrency(fiscal.totalRevenue) : "..."}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600">BTW ontvangen (af te dragen)</span>
                    <span className="font-semibold">{fiscal ? formatCurrency(fiscal.totalVatCollected) : "..."}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600">BTW aftrekbaar (voorbelasting)</span>
                    <span className="font-semibold">{fiscal ? formatCurrency(fiscal.totalVatDeductible) : "..."}</span>
                  </div>
                  <div className="flex justify-between py-3 bg-orange-50 px-4 rounded-lg">
                    <span className="font-semibold text-orange-800">BTW af te dragen</span>
                    <span className="font-bold text-orange-600">{fiscal ? formatCurrency(fiscal.vatToPay) : "..."}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600">Totaal facturen</span>
                    <span className="font-semibold">{fiscal?.invoiceCount}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600">Betaald</span>
                    <span className="font-semibold text-green-600">{fiscal?.paidCount}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600">Verlopen</span>
                    <span className="font-semibold text-red-600">{fiscal?.overdueCount}</span>
                  </div>
                  <div className="flex justify-between py-3 bg-blue-50 px-4 rounded-lg">
                    <span className="font-semibold text-blue-800">Totale omzet (incl. BTW)</span>
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

      {/* Quick Invoice Modal */}
      {showQuickInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Snelle factuur</h2>
              <button onClick={() => setShowQuickInvoice(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {quickResult && (
                <div className={`rounded-lg px-4 py-3 text-sm ${quickResult.includes("!") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{quickResult}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Klant *</label>
                <select
                  value={quickForm.customerId}
                  onChange={(e) => {
                    const c = customers.find((c) => c.id === e.target.value);
                    setQuickForm({ ...quickForm, customerId: e.target.value, customerName: c?.name || "" });
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Selecteer klant...</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {!quickForm.customerId && (
                  <input type="text" value={quickForm.customerName} onChange={(e) => setQuickForm({ ...quickForm, customerName: e.target.value })}
                    placeholder="Of typ een naam" className="w-full mt-2 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Omschrijving</label>
                <input type="text" value={quickForm.description} onChange={(e) => setQuickForm({ ...quickForm, description: e.target.value })}
                  placeholder="Bijv. Consulting diensten" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bedrag (excl. BTW) *</label>
                  <input type="number" step="0.01" min="0" value={quickForm.amount} onChange={(e) => setQuickForm({ ...quickForm, amount: e.target.value })}
                    placeholder="0,00" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">BTW</label>
                  <select value={quickForm.vatRate} onChange={(e) => setQuickForm({ ...quickForm, vatRate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="21">21%</option>
                    <option value="9">9%</option>
                    <option value="0">0%</option>
                  </select>
                </div>
              </div>
              {quickForm.amount && (
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Subtotaal</span><span>{formatCurrency(parseFloat(quickForm.amount) || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">BTW ({quickForm.vatRate}%)</span><span>{formatCurrency((parseFloat(quickForm.amount) || 0) * (parseFloat(quickForm.vatRate) / 100))}</span></div>
                  <div className="flex justify-between font-bold border-t border-gray-200 pt-1 mt-1"><span>Totaal</span><span>{formatCurrency((parseFloat(quickForm.amount) || 0) * (1 + parseFloat(quickForm.vatRate) / 100))}</span></div>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => handleQuickInvoice("draft")} disabled={quickSaving}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">Concept</button>
                <button onClick={() => handleQuickInvoice("sent")} disabled={quickSaving}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50">
                  {quickSaving ? "Bezig..." : "Factuur versturen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Betaling registreren</h2>
              <button onClick={() => setPaymentModal(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {paymentResult && (
                <div className={`rounded-lg px-4 py-3 text-sm ${paymentResult.includes("geregistreerd") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {paymentResult}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bedrag *</label>
                <input type="number" step="0.01" min="0.01" value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
                <input type="date" value={paymentForm.date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opmerking</label>
                <input type="text" value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  placeholder="Bijv. bankoverschrijving"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setPaymentModal(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">Annuleren</button>
                <button onClick={handlePayment} disabled={paymentSending}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50">
                  {paymentSending ? "Verwerken..." : "Betaling registreren"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {emailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {emailModal.type === "send" ? "Factuur versturen" : "Herinnering versturen"}
              </h2>
              <button onClick={() => setEmailModal(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {emailResult && (
                <div className={`rounded-lg px-4 py-3 text-sm ${emailResult.includes("succes") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {emailResult}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aan (e-mailadres) *</label>
                <input
                  type="email"
                  value={emailForm.to}
                  onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })}
                  placeholder="klant@voorbeeld.nl"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Onderwerp</label>
                <input
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bericht</label>
                <textarea
                  value={emailForm.message}
                  onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                  rows={6}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">De factuur wordt automatisch meegestuurd in de e-mail.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEmailModal(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={emailSending}
                  className={`flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50 ${
                    emailModal.type === "send" ? "bg-green-600 hover:bg-green-700" : "bg-orange-600 hover:bg-orange-700"
                  }`}
                >
                  {emailSending ? "Verzenden..." : emailModal.type === "send" ? "Factuur verzenden" : "Herinnering verzenden"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
