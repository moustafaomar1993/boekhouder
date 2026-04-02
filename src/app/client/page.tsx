"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Invoice, FiscalSummary, User } from "@/lib/data";

const CLIENT_ID = "client-1";

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

function formatDate(dateStr: string) {
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return dateStr;
}

function ClientPortalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = searchParams.get("section") || "dashboard";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [fiscal, setFiscal] = useState<FiscalSummary | null>(null);
  const [client, setClient] = useState<User | null>(null);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);

  // Inkoop state
  const [purchaseDocs, setPurchaseDocs] = useState<{ id: string; fileName: string; fileUrl: string; fileType: string; fileSize: number; status: string; label: string | null; createdAt: string }[]>([]);
  const [purchaseUploading, setPurchaseUploading] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const [purchaseDragging, setPurchaseDragging] = useState(false);
  const [purchaseViewDoc, setPurchaseViewDoc] = useState<typeof purchaseDocs[0] | null>(null);

  // Verkoop tab state
  const [verkoopTab, setVerkoopTab] = useState<"factureren" | "offertes" | "herinneringen">("factureren");
  const [snelSearch, setSnelSearch] = useState("");
  const [showFactuuroverzicht, setShowFactuuroverzicht] = useState(false);

  // Invoice list state
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"date" | "invoiceNumber" | "total">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Modals
  const [paymentModal, setPaymentModal] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", date: "", notes: "" });
  const [paymentSending, setPaymentSending] = useState(false);
  const [paymentResult, setPaymentResult] = useState("");
  const [emailModal, setEmailModal] = useState<{ invoiceId: string; type: "send" | "remind" } | null>(null);
  const [emailForm, setEmailForm] = useState({ to: "", subject: "", message: "" });
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState("");

  // Data fetching
  useEffect(() => {
    fetch(`/api/invoices?clientId=${CLIENT_ID}`).then((r) => r.json()).then(setInvoices);
    fetch(`/api/fiscal?clientId=${CLIENT_ID}`).then((r) => r.json()).then(setFiscal);
    fetch(`/api/clients`).then((r) => r.json()).then((clients: User[]) => {
      setClient(clients.find((c) => c.id === CLIENT_ID) || null);
    });
    fetch("/api/customers").then((r) => r.ok ? r.json() : []).then((data) => {
      if (Array.isArray(data)) setCustomers(data);
    }).catch(() => {});
    fetch("/api/purchases").then((r) => r.ok ? r.json() : []).then((data) => {
      if (Array.isArray(data)) setPurchaseDocs(data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-actions-menu]")) setOpenMenuId(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Invoice helpers ──
  function getCreditStatus(inv: Invoice & { isCredit?: boolean; originalInvoiceId?: string | null; id: string }) {
    if (inv.isCredit) return null;
    const credits = invoices.filter((i) => (i as Invoice & { originalInvoiceId?: string }).originalInvoiceId === inv.id);
    if (credits.length === 0) return null;
    const totalCredited = credits.reduce((sum, ci) => sum + Math.abs(ci.total), 0);
    if (totalCredited >= Math.abs(inv.total)) return "full";
    return "partial";
  }

  async function handleCredit(invoiceId: string) {
    setActionLoading(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/credit`, { method: "POST" });
      if (res.ok) { const credit = await res.json(); router.push(`/client/invoices/${credit.id}/edit`); }
      else { try { const data = await res.json(); alert(data.error || "Er ging iets mis"); } catch { alert("Er ging iets mis"); } }
    } finally { setActionLoading(null); }
  }

  async function handleCopy(invoiceId: string) {
    setActionLoading(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/copy`, { method: "POST" });
      if (res.ok) { const copied = await res.json(); router.push(`/client/invoices/${copied.id}/edit`); }
    } finally { setActionLoading(null); }
  }

  const filteredInvoices = invoices.filter((inv) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesSearch = inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.items.some((item) => item.description.toLowerCase().includes(q));
      if (!matchesSearch) return false;
    }
    if (statusFilter !== "all") {
      const ext = inv as Invoice & { isCredit?: boolean };
      if (statusFilter === "credit") { if (!ext.isCredit) return false; }
      else if (inv.status !== statusFilter) return false;
    }
    if (customerFilter !== "all" && inv.customerName !== customerFilter) return false;
    if (periodFilter !== "all") {
      const now = new Date();
      const invDate = new Date(inv.date);
      if (periodFilter === "this-month") { if (invDate.getMonth() !== now.getMonth() || invDate.getFullYear() !== now.getFullYear()) return false; }
      else if (periodFilter === "last-month") { const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1); if (invDate.getMonth() !== lm.getMonth() || invDate.getFullYear() !== lm.getFullYear()) return false; }
      else if (periodFilter === "this-year") { if (invDate.getFullYear() !== now.getFullYear()) return false; }
    }
    return true;
  });

  const hasActiveFilters = searchQuery || statusFilter !== "all" || customerFilter !== "all" || periodFilter !== "all";

  function toggleSelect(id: string) { setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function toggleSelectAll() { if (selectedIds.size === filteredInvoices.length) setSelectedIds(new Set()); else setSelectedIds(new Set(filteredInvoices.map((i) => i.id))); }

  async function bulkMarkPaid() {
    const eligible = [...selectedIds].filter((id) => { const inv = invoices.find((i) => i.id === id); return inv && inv.status !== "paid" && !inv.isCredit; });
    if (eligible.length === 0) { alert("Geen facturen om als betaald te markeren."); return; }
    if (!confirm(`Weet je zeker dat je ${eligible.length} factuur/facturen als betaald wilt markeren?`)) return;
    setBulkLoading(true);
    for (const id of eligible) { await fetch(`/api/invoices/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "paid" }) }); }
    const updated = await fetch(`/api/invoices?clientId=${CLIENT_ID}`).then((r) => r.json());
    setInvoices(updated); setSelectedIds(new Set()); setBulkLoading(false);
  }

  async function bulkRemind() {
    const eligible = [...selectedIds].filter((id) => { const inv = invoices.find((i) => i.id === id); return inv && (inv.status === "sent" || inv.status === "partial" || inv.status === "overdue") && !inv.isCredit; });
    if (eligible.length === 0) { alert("Geen openstaande facturen geselecteerd voor herinnering."); return; }
    if (!confirm(`Herinnering sturen voor ${eligible.length} factuur/facturen?`)) return;
    setBulkLoading(true);
    let sent = 0;
    for (const id of eligible) {
      const inv = invoices.find((i) => i.id === id); if (!inv) continue;
      const companyName = client?.company || "Uw bedrijf";
      await fetch(`/api/invoices/${id}/remind`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: "klant@voorbeeld.nl", subject: `Herinnering factuur ${inv.invoiceNumber} - ${companyName}`, message: `Beste ${inv.customerName},\n\nVolgens onze administratie staat factuur ${inv.invoiceNumber} nog open.\n\nMet vriendelijke groet,\n${companyName}` }) });
      sent++;
    }
    alert(`${sent} herinnering(en) verstuurd.`); setSelectedIds(new Set()); setBulkLoading(false);
  }

  async function bulkDownloadPdf() {
    setBulkLoading(true);
    for (const id of [...selectedIds]) {
      try { const res = await fetch(`/api/invoices/${id}/pdf?download=1`); if (!res.ok) continue; const blob = await res.blob(); const inv = invoices.find((i) => i.id === id); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${inv?.invoiceNumber || id}.pdf`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); } catch { /* skip */ }
    }
    setBulkLoading(false);
  }

  function bulkExportCsv() {
    const selected = invoices.filter((i) => selectedIds.has(i.id));
    const header = "Factuurnummer;Klant;Datum;Vervaldatum;Status;Subtotaal;BTW;Totaal";
    const rows = selected.map((i) => `${i.invoiceNumber};${i.customerName};${i.date};${i.dueDate};${i.status};${i.subtotal.toFixed(2)};${i.vatAmount.toFixed(2)};${i.total.toFixed(2)}`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `facturen-export-${new Date().toISOString().split("T")[0]}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  function openPaymentModal(invoiceId: string) {
    const inv = invoices.find((i) => i.id === invoiceId); if (!inv) return;
    const remaining = Math.abs(inv.total) - ((inv as Invoice & { paidAmount?: number }).paidAmount || 0);
    setPaymentForm({ amount: remaining.toFixed(2), date: new Date().toISOString().split("T")[0], notes: "" }); setPaymentResult(""); setPaymentModal(invoiceId);
  }

  async function handlePayment() {
    if (!paymentModal) return; const amount = parseFloat(paymentForm.amount);
    if (!amount || amount <= 0) { setPaymentResult("Voer een geldig bedrag in"); return; }
    setPaymentSending(true); setPaymentResult("");
    try {
      const res = await fetch(`/api/invoices/${paymentModal}/payments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount, date: paymentForm.date, notes: paymentForm.notes }) });
      if (res.ok) { setPaymentResult("Betaling geregistreerd!"); const updated = await fetch(`/api/invoices?clientId=${CLIENT_ID}`).then((r) => r.json()); setInvoices(updated); setTimeout(() => setPaymentModal(null), 1200); }
      else { try { const d = await res.json(); setPaymentResult(d.error || "Mislukt"); } catch { setPaymentResult("Mislukt"); } }
    } finally { setPaymentSending(false); }
  }

  function openEmailModal(invoiceId: string, type: "send" | "remind") {
    const inv = invoices.find((i) => i.id === invoiceId); if (!inv) return;
    const companyName = client?.company || "Uw bedrijf";
    if (type === "send") { setEmailForm({ to: "", subject: `Factuur ${inv.invoiceNumber} - ${companyName}`, message: `Beste ${inv.customerName},\n\nHierbij ontvangt u factuur ${inv.invoiceNumber}.\n\nWij verzoeken u vriendelijk deze vóór ${formatDate(inv.dueDate)} te voldoen.\n\nMet vriendelijke groet,\n${companyName}` }); }
    else { setEmailForm({ to: "", subject: `Herinnering factuur ${inv.invoiceNumber} - ${companyName}`, message: `Beste ${inv.customerName},\n\nVolgens onze administratie staat factuur ${inv.invoiceNumber} nog open.\n\nWij verzoeken u vriendelijk deze zo spoedig mogelijk te voldoen.\n\nMet vriendelijke groet,\n${companyName}` }); }
    setEmailResult(""); setEmailModal({ invoiceId, type });
  }

  async function handleSendEmail() {
    if (!emailModal) return; if (!emailForm.to) { setEmailResult("E-mailadres is verplicht"); return; }
    setEmailSending(true); setEmailResult("");
    try {
      const endpoint = emailModal.type === "send" ? `/api/invoices/${emailModal.invoiceId}/send` : `/api/invoices/${emailModal.invoiceId}/remind`;
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(emailForm) });
      if (res.ok) { setEmailResult("E-mail succesvol verzonden!"); if (emailModal.type === "send") { const updated = await fetch(`/api/invoices?clientId=${CLIENT_ID}`).then((r) => r.json()); setInvoices(updated); } setTimeout(() => setEmailModal(null), 1500); }
      else { try { const data = await res.json(); setEmailResult(data.error || "Verzenden mislukt"); } catch { setEmailResult("Verzenden mislukt"); } }
    } finally { setEmailSending(false); }
  }

  function resetFilters() { setSearchQuery(""); setStatusFilter("all"); setCustomerFilter("all"); setPeriodFilter("all"); }

  // ── Inkoop helpers ──
  async function handlePurchaseUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setPurchaseUploading(true);
    setPurchaseMessage("");
    let uploaded = 0;
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/purchases/upload", { method: "POST", body: formData });
        if (res.ok) { const doc = await res.json(); setPurchaseDocs((prev) => [doc, ...prev]); uploaded++; }
        else { const data = await res.json().catch(() => ({})); setPurchaseMessage(data.error || `Fout bij ${file.name}`); }
      } catch { setPurchaseMessage(`Upload mislukt: ${file.name}`); }
    }
    if (uploaded > 0) setPurchaseMessage(`${uploaded} bestand${uploaded > 1 ? "en" : ""} geüpload`);
    setPurchaseUploading(false);
    setTimeout(() => setPurchaseMessage(""), 4000);
  }

  async function handleDeletePurchase(id: string) {
    if (!confirm("Weet je zeker dat je dit document wilt verwijderen?")) return;
    await fetch(`/api/purchases/${id}`, { method: "DELETE" });
    setPurchaseDocs((prev) => prev.filter((d) => d.id !== id));
    if (purchaseViewDoc?.id === id) setPurchaseViewDoc(null);
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const purchaseStatusLabels: Record<string, string> = { uploaded: "Geüpload", processing: "In behandeling", booked: "Geboekt" };
  const purchaseStatusColors: Record<string, string> = { uploaded: "bg-blue-100 text-blue-700", processing: "bg-amber-100 text-amber-700", booked: "bg-green-100 text-green-700" };

  // ── Computed dashboard values (use stable date to avoid hydration mismatch) ──
  const [today] = useState(() => new Date().toISOString().split("T")[0]);
  const [currentMonth] = useState(() => new Date().getMonth());
  const [currentYear] = useState(() => new Date().getFullYear());
  const thisMonthInvoices = invoices.filter((i) => { const d = new Date(i.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; });
  const omzetDezeMaand = thisMonthInvoices.filter((i) => !i.isCredit).reduce((s, i) => s + i.subtotal, 0);
  const openstaand = invoices.filter((i) => (i.status === "sent" || i.status === "partial") && !i.isCredit);
  const teLaat = invoices.filter((i) => i.status === "overdue" && !i.isCredit);
  const recentVerzonden = invoices.filter((i) => i.status === "sent" && !i.isCredit).slice(0, 5);
  const overdueReminders = invoices.filter((i) => (i.status === "overdue" || i.status === "sent") && !i.isCredit && i.dueDate < today);

  // Quarter
  const quarter = Math.floor(currentMonth / 3) + 1;

  // ── Page title ──
  const sectionTitles: Record<string, string> = { dashboard: "Dashboard", verkoop: "Verkoop", inkoop: "Inkoop", bank: "Bank", fiscaal: "BTW & Fiscaal overzicht" };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#3C2C1E]">{sectionTitles[section] || "Dashboard"}</h1>
          {client && <p className="text-sm text-[#6F5C4B]/70 mt-0.5">{client.company}</p>}
        </div>
        {section === "verkoop" && (
          <Link href="/client/invoices/new" className="bg-[#004854] text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-medium hover:bg-[#003640] transition-all shadow-sm">
            + Nieuwe factuur
          </Link>
        )}
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* DASHBOARD */}
      {/* ═══════════════════════════════════════════ */}
      {section === "dashboard" && (
        <div className="space-y-6">
          {/* Verkoop summary */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-[#3C2C1E]">Verkoop</h2>
              <Link href="/client?section=verkoop" className="text-sm text-[#00AFCB] hover:text-[#004854] font-medium transition-colors">Bekijken</Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#E6F9FC] rounded-xl p-4 border border-[#00AFCB]/10">
                <p className="text-xs text-[#004854]/60 font-medium mb-1">Omzet deze maand</p>
                <p className="text-xl font-bold text-[#004854]">{formatCurrency(omzetDezeMaand)}</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                <p className="text-xs text-amber-600 font-medium mb-1">Openstaand</p>
                <p className="text-xl font-bold text-amber-700">{openstaand.length} facturen</p>
                <p className="text-xs text-amber-500 mt-0.5">{formatCurrency(openstaand.reduce((s, i) => s + i.total, 0))}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                <p className="text-xs text-red-600 font-medium mb-1">Te laat</p>
                <p className="text-xl font-bold text-red-700">{teLaat.length} facturen</p>
                <p className="text-xs text-red-500 mt-0.5">{formatCurrency(teLaat.reduce((s, i) => s + i.total, 0))}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                <p className="text-xs text-emerald-600 font-medium mb-1">Betaald deze maand</p>
                <p className="text-xl font-bold text-emerald-700">{fiscal ? formatCurrency(fiscal.paidThisMonth) : "..."}</p>
              </div>
            </div>
          </div>

          {/* Inkoop summary */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-[#3C2C1E]">Inkoop</h2>
              <Link href="/client?section=inkoop" className="text-sm text-[#00AFCB] hover:text-[#004854] font-medium transition-colors">Bekijken</Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <p className="text-xs text-blue-600 font-medium mb-1">Geüploade documenten</p>
                <p className="text-xl font-bold text-blue-700">{purchaseDocs.length}</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                <p className="text-xs text-amber-600 font-medium mb-1">In behandeling</p>
                <p className="text-xl font-bold text-amber-700">{purchaseDocs.filter((d) => d.status === "processing").length}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                <p className="text-xs text-emerald-600 font-medium mb-1">Geboekt</p>
                <p className="text-xl font-bold text-emerald-700">{purchaseDocs.filter((d) => d.status === "booked").length}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-xs text-gray-500 font-medium mb-1">Wacht op upload</p>
                <p className="text-xl font-bold text-gray-700">{purchaseDocs.filter((d) => d.status === "uploaded").length}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bank summary */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-[#3C2C1E]">Bank</h2>
                <Link href="/client?section=bank" className="text-sm text-[#00AFCB] hover:text-[#004854] font-medium transition-colors">Bekijken</Link>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-600">Recente transacties</span>
                  <span className="text-sm font-medium text-gray-400">-</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-600">Niet-gekoppelde transacties</span>
                  <span className="text-sm font-medium text-gray-400">-</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-600">Te verwerken mutaties</span>
                  <span className="text-sm font-medium text-gray-400">-</span>
                </div>
                <p className="text-xs text-gray-400 pt-2">Bankkoppeling binnenkort beschikbaar</p>
              </div>
            </div>

            {/* BTW summary */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-[#3C2C1E]">BTW</h2>
                <Link href="/client?section=fiscaal" className="text-sm text-[#00AFCB] hover:text-[#004854] font-medium transition-colors">Bekijken</Link>
              </div>
              <div className="space-y-3">
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                  <p className="text-xs text-amber-600 font-medium mb-1">Geschatte BTW af te dragen</p>
                  <p className="text-2xl font-bold text-amber-700">{fiscal ? formatCurrency(fiscal.vatToPay) : "..."}</p>
                  <p className="text-xs text-amber-500 mt-1">Q{quarter} {currentYear}</p>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-600">BTW ontvangen</span>
                  <span className="text-sm font-semibold">{fiscal ? formatCurrency(fiscal.totalVatCollected) : "..."}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-600">BTW aftrekbaar</span>
                  <span className="text-sm font-semibold">{fiscal ? formatCurrency(fiscal.totalVatDeductible) : "..."}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Fiscaal summary */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-[#3C2C1E]">Fiscaal overzicht</h2>
              <Link href="/client?section=fiscaal" className="text-sm text-[#00AFCB] hover:text-[#004854] font-medium transition-colors">Bekijken</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#E6F9FC] rounded-xl p-4 border border-[#00AFCB]/10">
                <p className="text-xs text-[#004854]/60 font-medium mb-1">Totale omzet (excl. BTW)</p>
                <p className="text-xl font-bold text-[#004854]">{fiscal ? formatCurrency(fiscal.totalRevenue) : "..."}</p>
              </div>
              {client?.legalForm === "bv" ? (
                <div className="bg-[#6F5C4B]/5 rounded-xl p-4 border border-[#6F5C4B]/10">
                  <p className="text-xs text-[#6F5C4B] font-medium mb-1">Vennootschapsbelasting (geschat)</p>
                  <p className="text-xl font-bold text-[#3C2C1E]">-</p>
                  <p className="text-xs text-[#6F5C4B]/50 mt-0.5">Berekening volgt</p>
                </div>
              ) : (
                <div className="bg-[#6F5C4B]/5 rounded-xl p-4 border border-[#6F5C4B]/10">
                  <p className="text-xs text-[#6F5C4B] font-medium mb-1">Inkomstenbelasting (geschat)</p>
                  <p className="text-xl font-bold text-[#3C2C1E]">-</p>
                  <p className="text-xs text-[#6F5C4B]/50 mt-0.5">Berekening volgt</p>
                </div>
              )}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-xs text-gray-500 font-medium mb-1">Geschatte belastingdruk</p>
                <p className="text-xl font-bold text-gray-700">-</p>
                <p className="text-xs text-gray-400 mt-0.5">Binnenkort beschikbaar</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* VERKOOP */}
      {/* ═══════════════════════════════════════════ */}
      {section === "verkoop" && (
        <div>
          {/* Verkoop tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-fit mb-6 overflow-x-auto">
            {([["factureren", "Factureren"], ["offertes", "Offertes"], ["herinneringen", "Herinneringen"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setVerkoopTab(key); if (key === "factureren") setShowFactuuroverzicht(false); }}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${verkoopTab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Factureren */}
          {verkoopTab === "factureren" && !showFactuuroverzicht && (
            <div>
              {/* Top action area: search + factuuroverzicht */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <input type="text" value={snelSearch} onChange={(e) => setSnelSearch(e.target.value)} placeholder="Zoek klant op naam..."
                  autoFocus className="w-full border border-gray-300 rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm" />
                <button onClick={() => setShowFactuuroverzicht(true)}
                  className="w-full bg-blue-50 border border-blue-200 rounded-xl px-4 py-3.5 text-left hover:border-blue-400 hover:shadow-md transition-all group flex items-center gap-3">
                  <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <p className="font-medium text-blue-700 group-hover:text-blue-800 text-sm">Factuuroverzicht</p>
                    <p className="text-xs text-blue-500">{invoices.length} facturen</p>
                  </div>
                </button>
              </div>

              {/* Customer tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {customers.filter((c) => !snelSearch || c.name.toLowerCase().startsWith(snelSearch.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)).map((customer) => (
                  <button key={customer.id} onClick={() => router.push(`/client/invoices/new?customerId=${customer.id}`)}
                    className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-blue-400 hover:shadow-md transition-all group">
                    <p className="font-medium text-gray-900 group-hover:text-blue-600 truncate">{customer.name}</p>
                  </button>
                ))}
                <Link href="/client/customers" className="border-2 border-dashed border-gray-300 rounded-xl p-4 flex items-center justify-center min-h-[56px] hover:border-blue-400 hover:bg-blue-50/50 transition-all group">
                  <span className="text-sm font-medium text-gray-500 group-hover:text-blue-600">+ Nieuwe klant</span>
                </Link>
              </div>
              {customers.filter((c) => !snelSearch || c.name.toLowerCase().startsWith(snelSearch.toLowerCase())).length === 0 && snelSearch && (
                <p className="text-sm text-gray-500 mt-4">Geen klanten gevonden die beginnen met &ldquo;{snelSearch}&rdquo;</p>
              )}
            </div>
          )}

          {/* Factuuroverzicht (within Factureren) */}
          {verkoopTab === "factureren" && showFactuuroverzicht && (
            <div>
              <button onClick={() => setShowFactuuroverzicht(false)} className="text-sm text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Terug naar klanten
              </button>

              {/* Search & Filters */}
              <div className="mb-4 space-y-3">
                <div className="space-y-3 sm:space-y-0 sm:flex sm:flex-wrap sm:gap-3 sm:items-center">
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Zoek op factuurnummer, klant of omschrijving..."
                    className="w-full sm:flex-1 sm:min-w-[250px] border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                  <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3">
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="all">Alle statussen</option><option value="draft">Concept</option><option value="sent">Verzonden</option><option value="paid">Betaald</option><option value="partial">Deels betaald</option><option value="overdue">Verlopen</option><option value="credit">Creditfactuur</option>
                    </select>
                    <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="all">Alle klanten</option>
                      {[...new Set(invoices.map((i) => i.customerName))].sort().map((name) => (<option key={name} value={name}>{name}</option>))}
                    </select>
                    <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="all">Alle periodes</option><option value="this-month">Deze maand</option><option value="last-month">Vorige maand</option><option value="this-year">Dit jaar</option>
                    </select>
                    {hasActiveFilters && (<button onClick={resetFilters} className="text-sm text-red-500 hover:text-red-700 font-medium">Filters wissen</button>)}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-sm text-gray-400">{filteredInvoices.length} factuur/facturen</p>
                  <Link href="/client/recurring" className="text-sm text-blue-600 hover:text-blue-700 font-medium">Terugkerende facturen</Link>
                </div>
              </div>

              {/* Bulk Action Bar */}
              {selectedIds.size > 0 && (
                <div className="bg-blue-600 text-white rounded-xl px-4 sm:px-5 py-3 mb-4 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{selectedIds.size} geselecteerd</span>
                    <button onClick={() => setSelectedIds(new Set())} className="text-xs text-blue-200 hover:text-white underline">Selectie wissen</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={bulkMarkPaid} disabled={bulkLoading} className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg font-medium disabled:opacity-50">Markeer als betaald</button>
                    <button onClick={bulkRemind} disabled={bulkLoading} className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg font-medium disabled:opacity-50">Herinnering sturen</button>
                    <button onClick={bulkDownloadPdf} className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg font-medium">PDF downloaden</button>
                    <button onClick={bulkExportCsv} className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg font-medium">Exporteren (CSV)</button>
                  </div>
                </div>
              )}

              {/* Invoice list */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center">
                  <h2 className="text-base sm:text-lg font-semibold">Alle facturen</h2>
                  <Link href="/client/invoices/new" className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">+ Nieuwe factuur</Link>
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                        <th className="px-3 py-3 w-10"><input type="checkbox" checked={selectedIds.size === filteredInvoices.length && filteredInvoices.length > 0} onChange={toggleSelectAll} className="rounded w-4 h-4 text-blue-600" /></th>
                        <th className="px-5 py-3 font-medium"><button onClick={() => { if (sortField === "invoiceNumber") setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortField("invoiceNumber"); setSortDir("asc"); } }} className="flex items-center gap-1 hover:text-gray-900">Factuurnr.{sortField === "invoiceNumber" && <span className="text-blue-600">{sortDir === "asc" ? "↑" : "↓"}</span>}</button></th>
                        <th className="px-5 py-3 font-medium">Debiteur</th>
                        <th className="px-5 py-3 font-medium"><button onClick={() => { if (sortField === "date") setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortField("date"); setSortDir("desc"); } }} className="flex items-center gap-1 hover:text-gray-900">Factuurdatum{sortField === "date" && <span className="text-blue-600">{sortDir === "asc" ? "↑" : "↓"}</span>}</button></th>
                        <th className="px-5 py-3 font-medium">Vervaldatum</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                        <th className="px-5 py-3 font-medium">Boekhouding</th>
                        <th className="px-5 py-3 font-medium text-right"><button onClick={() => { if (sortField === "total") setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortField("total"); setSortDir("desc"); } }} className="flex items-center gap-1 ml-auto hover:text-gray-900">Bedrag{sortField === "total" && <span className="text-blue-600">{sortDir === "asc" ? "↑" : "↓"}</span>}</button></th>
                        <th className="px-5 py-3 font-medium text-right">Acties</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {[...filteredInvoices].sort((a, b) => { let cmp = 0; if (sortField === "invoiceNumber") cmp = a.invoiceNumber.localeCompare(b.invoiceNumber); else if (sortField === "date") cmp = a.date.localeCompare(b.date); else if (sortField === "total") cmp = a.total - b.total; return sortDir === "asc" ? cmp : -cmp; }).map((inv) => {
                        const ext = inv as Invoice & { isCredit?: boolean; originalInvoiceId?: string | null };
                        const creditStatus = getCreditStatus(ext);
                        const isFullyCredited = creditStatus === "full";
                        return (
                          <tr key={inv.id} className={`hover:bg-gray-50 ${selectedIds.has(inv.id) ? "bg-blue-50" : ""}`}>
                            <td className="px-3 py-4"><input type="checkbox" checked={selectedIds.has(inv.id)} onChange={() => toggleSelect(inv.id)} className="rounded w-4 h-4 text-blue-600" /></td>
                            <td className="px-5 py-4">
                              <Link href={`/client/invoices/${inv.id}/view`} className="font-medium text-blue-600 hover:text-blue-800 hover:underline">{inv.invoiceNumber}</Link>
                              {(inv as Invoice & { _count?: { invoiceNotes: number } })._count?.invoiceNotes ? (<span className="ml-1.5 text-amber-500" title="Heeft notities"><svg className="w-3.5 h-3.5 inline" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2z" clipRule="evenodd" /></svg></span>) : null}
                              {ext.isCredit && (<span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">Creditfactuur</span>)}
                              {creditStatus === "full" && (<span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded font-medium">Gecrediteerd</span>)}
                              {creditStatus === "partial" && (<span className="ml-2 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded font-medium">Deels gecrediteerd</span>)}
                            </td>
                            <td className="px-5 py-4 text-gray-600">{inv.customerName}</td>
                            <td className="px-5 py-4 text-gray-600">{formatDate(inv.date)}</td>
                            <td className="px-5 py-4 text-gray-600">{formatDate(inv.dueDate)}</td>
                            <td className="px-5 py-4"><StatusBadge status={inv.status} /></td>
                            <td className="px-5 py-4"><StatusBadge status={inv.bookkeepingStatus} /></td>
                            <td className="px-5 py-4 text-right font-semibold">{formatCurrency(inv.total)}</td>
                            <td className="px-5 py-4 text-right">
                              <div className="relative" data-actions-menu>
                                <button onClick={() => setOpenMenuId(openMenuId === inv.id ? null : inv.id)}
                                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${openMenuId === inv.id ? "bg-gray-800 text-white shadow-inner" : "border border-gray-300 text-gray-600 hover:bg-gray-100"}`}>
                                  Acties<svg className={`inline-block w-3.5 h-3.5 ml-1 transition-transform ${openMenuId === inv.id ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </button>
                                {openMenuId === inv.id && (
                                  <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 text-left">
                                    {inv.status === "draft" ? (<Link href={`/client/invoices/${inv.id}/edit`} onClick={() => setOpenMenuId(null)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">Bewerken</Link>) : (<Link href={`/client/invoices/${inv.id}/view`} onClick={() => setOpenMenuId(null)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">Bekijken</Link>)}
                                    <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noopener noreferrer" className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">PDF bekijken</a>
                                    <button onClick={async () => { setOpenMenuId(null); const res = await fetch(`/api/invoices/${inv.id}/pdf?download=1`); if (!res.ok) return; const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${inv.invoiceNumber}.pdf`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">PDF downloaden</button>
                                    <div className="border-t border-gray-100 my-1" />
                                    {!ext.isCredit && inv.status === "draft" && (<button onClick={() => { setOpenMenuId(null); openEmailModal(inv.id, "send"); }} className="w-full text-left px-4 py-2.5 text-sm text-green-600 hover:bg-green-50">Versturen</button>)}
                                    {!ext.isCredit && (inv.status === "sent" || inv.status === "partial" || inv.status === "overdue") && (<>
                                      <button onClick={() => { setOpenMenuId(null); openEmailModal(inv.id, "remind"); }} className="w-full text-left px-4 py-2.5 text-sm text-orange-600 hover:bg-orange-50">Herinnering sturen</button>
                                      <button onClick={() => { setOpenMenuId(null); openPaymentModal(inv.id); }} className="w-full text-left px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50">Betaling registreren</button>
                                    </>)}
                                    <div className="border-t border-gray-100 my-1" />
                                    <button onClick={() => { setOpenMenuId(null); handleCopy(inv.id); }} className="w-full text-left px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50">Kopiëren</button>
                                    {!ext.isCredit && !isFullyCredited && (<button onClick={() => { setOpenMenuId(null); handleCredit(inv.id); }} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">Crediteren</button>)}
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

                {/* Mobile card list */}
                <div className="md:hidden divide-y divide-gray-100">
                  {[...filteredInvoices].sort((a, b) => { let cmp = 0; if (sortField === "invoiceNumber") cmp = a.invoiceNumber.localeCompare(b.invoiceNumber); else if (sortField === "date") cmp = a.date.localeCompare(b.date); else if (sortField === "total") cmp = a.total - b.total; return sortDir === "asc" ? cmp : -cmp; }).map((inv) => {
                    const ext = inv as Invoice & { isCredit?: boolean; originalInvoiceId?: string | null };
                    return (
                      <Link key={inv.id} href={`/client/invoices/${inv.id}/view`} className="block px-4 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-blue-600 text-sm">{inv.invoiceNumber}</p>
                              {ext.isCredit && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] rounded font-medium">Credit</span>}
                            </div>
                            <p className="text-sm text-gray-900 truncate">{inv.customerName}</p>
                            <p className="text-xs text-gray-500 mt-1">{formatDate(inv.date)}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-semibold text-sm">{formatCurrency(inv.total)}</p>
                            <div className="mt-1"><StatusBadge status={inv.status} /></div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                  {filteredInvoices.length === 0 && (
                    <div className="px-4 py-12 text-center text-gray-400 text-sm">Geen facturen gevonden.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Offertes */}
          {verkoopTab === "offertes" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Offertes</h2>
                <Link href="/client/quotations/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">+ Nieuwe offerte</Link>
              </div>
              <p className="text-sm text-gray-500 mb-4">Beheer en verstuur offertes naar klanten.</p>
              <Link href="/client/quotations" className="text-sm text-blue-600 hover:text-blue-700 font-medium">Alle offertes bekijken &rarr;</Link>
            </div>
          )}

          {/* Herinneringen */}
          {verkoopTab === "herinneringen" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold mb-4">Herinneringen</h2>
              {overdueReminders.length === 0 ? (
                <p className="text-sm text-gray-500">Geen openstaande herinneringen.</p>
              ) : (
                <div className="space-y-3">
                  {overdueReminders.map((inv) => (
                    <div key={inv.id} className="p-4 bg-red-50 rounded-lg border border-red-100">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{inv.customerName}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{inv.invoiceNumber} &middot; Vervaldatum: {formatDate(inv.dueDate)}</p>
                        </div>
                        <span className="text-sm font-semibold flex-shrink-0">{formatCurrency(inv.total)}</span>
                      </div>
                      <div className="mt-3 sm:mt-2 sm:flex sm:justify-end">
                        <button onClick={() => openEmailModal(inv.id, "remind")} className="w-full sm:w-auto text-xs px-3 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600">Herinnering sturen</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* INKOOP */}
      {/* ═══════════════════════════════════════════ */}
      {section === "inkoop" && (
        <div className="space-y-6">
          {/* Upload area */}
          <div
            className={`bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-200 transition-colors p-6 sm:p-8 ${purchaseDragging ? "!border-[#00AFCB] !bg-[#E6F9FC]/30" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setPurchaseDragging(true); }}
            onDragLeave={() => setPurchaseDragging(false)}
            onDrop={(e) => { e.preventDefault(); setPurchaseDragging(false); handlePurchaseUpload(e.dataTransfer.files); }}
          >
            <div className="text-center">
              <div className="w-14 h-14 bg-[#E6F9FC] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-[#00AFCB]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-[#3C2C1E] mb-1">Upload bon of factuur</h3>
              <p className="text-sm text-gray-500 mb-4">Sleep bestanden hierheen of klik om te selecteren</p>
              <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#004854] text-white rounded-xl text-sm font-medium hover:bg-[#003640] cursor-pointer transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {purchaseUploading ? "Uploaden..." : "Bestand kiezen"}
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" multiple disabled={purchaseUploading}
                  onChange={(e) => handlePurchaseUpload(e.target.files)} />
              </label>
              <p className="text-xs text-gray-400 mt-3">PDF, JPG of PNG &middot; max. 10MB per bestand</p>
            </div>
          </div>

          {purchaseMessage && (
            <div className={`rounded-xl px-4 py-3 text-sm ${purchaseMessage.includes("geüpload") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {purchaseMessage}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs text-gray-500 font-medium mb-1">Totaal documenten</p>
              <p className="text-2xl font-bold text-[#004854]">{purchaseDocs.length}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs text-gray-500 font-medium mb-1">Geüpload</p>
              <p className="text-2xl font-bold text-blue-600">{purchaseDocs.filter((d) => d.status === "uploaded").length}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 col-span-2 sm:col-span-1">
              <p className="text-xs text-gray-500 font-medium mb-1">Geboekt</p>
              <p className="text-2xl font-bold text-emerald-600">{purchaseDocs.filter((d) => d.status === "booked").length}</p>
            </div>
          </div>

          {/* Document list */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 sm:p-5 border-b border-gray-100">
              <h2 className="text-base sm:text-lg font-semibold">Geüploade documenten</h2>
            </div>

            {purchaseDocs.length === 0 ? (
              <div className="p-8 sm:p-12 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <p className="text-sm text-gray-500">Nog geen documenten geüpload.</p>
                <p className="text-xs text-gray-400 mt-1">Upload je eerste bon of factuur om te beginnen.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {purchaseDocs.map((doc) => (
                  <div key={doc.id} className="px-4 sm:px-5 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 sm:gap-4">
                      {/* File icon */}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${doc.fileType === "pdf" ? "bg-red-50" : "bg-blue-50"}`}>
                        {doc.fileType === "pdf" ? (
                          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        ) : (
                          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        )}
                      </div>
                      {/* Info */}
                      <button onClick={() => setPurchaseViewDoc(doc)} className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-gray-900 truncate">{doc.label || doc.fileName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatDate(doc.createdAt.split("T")[0])} &middot; {formatFileSize(doc.fileSize)} &middot; {doc.fileType.toUpperCase()}
                        </p>
                      </button>
                      {/* Status + actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${purchaseStatusColors[doc.status] || "bg-gray-100"}`}>
                          {purchaseStatusLabels[doc.status] || doc.status}
                        </span>
                        <button onClick={() => handleDeletePurchase(doc.id)} className="text-gray-400 hover:text-red-500 p-1" title="Verwijderen">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Document detail modal */}
          {purchaseViewDoc && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPurchaseViewDoc(null)}>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold truncate">{purchaseViewDoc.label || purchaseViewDoc.fileName}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(purchaseViewDoc.createdAt.split("T")[0])} &middot; {formatFileSize(purchaseViewDoc.fileSize)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${purchaseStatusColors[purchaseViewDoc.status] || "bg-gray-100"}`}>
                      {purchaseStatusLabels[purchaseViewDoc.status] || purchaseViewDoc.status}
                    </span>
                    <button onClick={() => setPurchaseViewDoc(null)} className="text-gray-400 hover:text-gray-600 p-1">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4 sm:p-6">
                  {purchaseViewDoc.fileType === "pdf" ? (
                    <iframe src={purchaseViewDoc.fileUrl} className="w-full h-[60vh] rounded-lg border border-gray-200" />
                  ) : (
                    <img src={purchaseViewDoc.fileUrl} alt={purchaseViewDoc.fileName} className="max-w-full rounded-lg border border-gray-200 mx-auto" />
                  )}
                </div>
                <div className="p-4 sm:p-6 border-t border-gray-100 flex flex-col sm:flex-row gap-2 sm:justify-between">
                  <a href={purchaseViewDoc.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 text-center">
                    Openen in nieuw tabblad
                  </a>
                  <button onClick={() => { handleDeletePurchase(purchaseViewDoc.id); }} className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50">
                    Verwijderen
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* BANK */}
      {/* ═══════════════════════════════════════════ */}
      {section === "bank" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold mb-2">Banktransacties</h2>
            <p className="text-sm text-gray-500 mb-6">Bekijk en koppel banktransacties aan facturen.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-xl p-6">
                <p className="text-xs text-blue-600 font-medium mb-1">Recente transacties</p>
                <p className="text-2xl font-bold text-blue-700">-</p>
                <p className="text-xs text-blue-400 mt-1">Bankkoppeling vereist</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-6">
                <p className="text-xs text-amber-600 font-medium mb-1">Niet-gekoppelde transacties</p>
                <p className="text-2xl font-bold text-amber-700">-</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-6">
                <p className="text-xs text-gray-500 font-medium mb-1">Te verwerken mutaties</p>
                <p className="text-2xl font-bold text-gray-700">-</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center py-12">
            <div className="text-gray-300 mb-3"><svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg></div>
            <h3 className="text-lg font-medium text-gray-700 mb-1">Bankkoppeling</h3>
            <p className="text-sm text-gray-400">Koppel je bankrekening om transacties automatisch te importeren.</p>
            <p className="text-xs text-gray-300 mt-3">Binnenkort beschikbaar</p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* BTW & FISCAAL */}
      {/* ═══════════════════════════════════════════ */}
      {section === "fiscaal" && (
        <div className="space-y-6">
          {/* Company info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold mb-4">Fiscale gegevens</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div><p className="text-sm text-gray-500">Bedrijf</p><p className="font-medium">{client?.company}</p></div>
              <div><p className="text-sm text-gray-500">BTW-nummer</p><p className="font-medium font-mono">{client?.vatNumber}</p></div>
              <div><p className="text-sm text-gray-500">KvK-nummer</p><p className="font-medium font-mono">{client?.kvkNumber}</p></div>
            </div>
          </div>

          {/* VAT overview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold mb-4">BTW-overzicht</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex justify-between py-3 border-b border-gray-100"><span className="text-gray-600">Totale omzet (excl. BTW)</span><span className="font-semibold">{fiscal ? formatCurrency(fiscal.totalRevenue) : "..."}</span></div>
                <div className="flex justify-between py-3 border-b border-gray-100"><span className="text-gray-600">BTW ontvangen (af te dragen)</span><span className="font-semibold">{fiscal ? formatCurrency(fiscal.totalVatCollected) : "..."}</span></div>
                <div className="flex justify-between py-3 border-b border-gray-100"><span className="text-gray-600">BTW aftrekbaar (voorbelasting)</span><span className="font-semibold">{fiscal ? formatCurrency(fiscal.totalVatDeductible) : "..."}</span></div>
                <div className="flex justify-between py-3 bg-orange-50 px-4 rounded-lg"><span className="font-semibold text-orange-800">BTW af te dragen</span><span className="font-bold text-orange-600">{fiscal ? formatCurrency(fiscal.vatToPay) : "..."}</span></div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between py-3 border-b border-gray-100"><span className="text-gray-600">Totaal facturen</span><span className="font-semibold">{fiscal?.invoiceCount}</span></div>
                <div className="flex justify-between py-3 border-b border-gray-100"><span className="text-gray-600">Betaald</span><span className="font-semibold text-green-600">{fiscal?.paidCount}</span></div>
                <div className="flex justify-between py-3 border-b border-gray-100"><span className="text-gray-600">Verlopen</span><span className="font-semibold text-red-600">{fiscal?.overdueCount}</span></div>
                <div className="flex justify-between py-3 bg-blue-50 px-4 rounded-lg"><span className="font-semibold text-blue-800">Totale omzet (incl. BTW)</span><span className="font-bold text-blue-600">{fiscal ? formatCurrency(fiscal.totalRevenue + fiscal.totalVatCollected) : "..."}</span></div>
              </div>
            </div>
          </div>

          {/* Tax estimation */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold mb-4">Geschatte belastingdruk</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-orange-50 rounded-lg p-4">
                <p className="text-xs text-orange-600 font-medium mb-1">BTW af te dragen (Q{quarter})</p>
                <p className="text-xl font-bold text-orange-700">{fiscal ? formatCurrency(fiscal.vatToPay) : "..."}</p>
              </div>
              {client?.legalForm === "bv" ? (
                <div className="bg-indigo-50 rounded-lg p-4">
                  <p className="text-xs text-indigo-600 font-medium mb-1">Vennootschapsbelasting (geschat)</p>
                  <p className="text-xl font-bold text-indigo-700">-</p>
                  <p className="text-xs text-indigo-400 mt-0.5">Berekening binnenkort beschikbaar</p>
                </div>
              ) : (
                <div className="bg-indigo-50 rounded-lg p-4">
                  <p className="text-xs text-indigo-600 font-medium mb-1">Inkomstenbelasting (geschat)</p>
                  <p className="text-xl font-bold text-indigo-700">-</p>
                  <p className="text-xs text-indigo-400 mt-0.5">Berekening binnenkort beschikbaar</p>
                </div>
              )}
              <div className="bg-rose-50 rounded-lg p-4">
                <p className="text-xs text-rose-600 font-medium mb-1">Totale geschatte belastingdruk</p>
                <p className="text-xl font-bold text-rose-700">-</p>
                <p className="text-xs text-rose-400 mt-0.5">Binnenkort beschikbaar</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* MODALS */}
      {/* ═══════════════════════════════════════════ */}

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Betaling registreren</h2>
              <button onClick={() => setPaymentModal(null)} className="text-gray-400 hover:text-gray-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 space-y-4">
              {paymentResult && (<div className={`rounded-lg px-4 py-3 text-sm ${paymentResult.includes("geregistreerd") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{paymentResult}</div>)}
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Bedrag *</label><input type="number" step="0.01" min="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Datum</label><input type="date" value={paymentForm.date} onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Opmerking</label><input type="text" value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} placeholder="Bijv. bankoverschrijving" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" /></div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setPaymentModal(null)} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">Annuleren</button>
                <button onClick={handlePayment} disabled={paymentSending} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50">{paymentSending ? "Verwerken..." : "Betaling registreren"}</button>
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
              <h2 className="text-lg font-semibold">{emailModal.type === "send" ? "Factuur versturen" : "Herinnering versturen"}</h2>
              <button onClick={() => setEmailModal(null)} className="text-gray-400 hover:text-gray-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 space-y-4">
              {emailResult && (<div className={`rounded-lg px-4 py-3 text-sm ${emailResult.includes("succes") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{emailResult}</div>)}
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Aan (e-mailadres) *</label><input type="email" value={emailForm.to} onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })} placeholder="klant@voorbeeld.nl" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Onderwerp</label><input type="text" value={emailForm.subject} onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Bericht</label><textarea value={emailForm.message} onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })} rows={6} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" /><p className="text-xs text-gray-400 mt-1">De factuur wordt automatisch meegestuurd in de e-mail.</p></div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEmailModal(null)} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">Annuleren</button>
                <button onClick={handleSendEmail} disabled={emailSending} className={`flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50 ${emailModal.type === "send" ? "bg-green-600 hover:bg-green-700" : "bg-orange-600 hover:bg-orange-700"}`}>{emailSending ? "Verzenden..." : emailModal.type === "send" ? "Factuur verzenden" : "Herinnering verzenden"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientPortal() {
  return (
    <Suspense>
      <ClientPortalContent />
    </Suspense>
  );
}
