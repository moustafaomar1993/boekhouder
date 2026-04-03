"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Invoice, User } from "@/lib/data";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount);
}

function formatDate(dateStr: string) {
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return dateStr;
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

// Shell component for future modules
function ModuleShell({ title, description, sections }: { title: string; description: string; sections: { title: string; description: string; icon?: string }[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#3C2C1E]">{title}</h1>
        <p className="text-sm text-[#6F5C4B]/70 mt-1">{description}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((s, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6">
            <h3 className="text-base font-semibold text-[#3C2C1E] mb-1">{s.title}</h3>
            <p className="text-sm text-gray-500 mb-4">{s.description}</p>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-400">Binnenkort beschikbaar</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BookkeeperContent() {
  const searchParams = useSearchParams();
  const section = searchParams.get("section") || "dashboard";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<User[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [bookingLoading, setBookingLoading] = useState<string | null>(null);

  // Inkoop state
  interface PurchaseDoc {
    id: string; userId: string; fileName: string; fileUrl: string; fileType: string; fileSize: number;
    status: string; label: string | null; supplierName: string | null; invoiceNumber: string | null;
    amount: number | null; vatAmount: number | null; totalAmount: number | null; documentDate: string | null;
    category: string | null; description: string | null; vatType: string | null; notes: string | null;
    bookedAt: string | null; createdAt: string; updatedAt: string;
    user: { id: string; name: string; company: string | null; email: string };
  }
  const [purchaseDocs, setPurchaseDocs] = useState<PurchaseDoc[]>([]);
  const [purchaseFilter, setPurchaseFilter] = useState("all");
  const [purchaseClientFilter, setPurchaseClientFilter] = useState("all");

  // Bank state
  interface BankTx {
    id: string; userId: string; bankAccount: string | null; transactionDate: string;
    amount: number; direction: string; description: string; counterparty: string | null;
    counterpartyAccount: string | null; status: string; importBatchId: string; createdAt: string;
    user: { id: string; name: string; company: string | null };
  }
  const [bankTxs, setBankTxs] = useState<BankTx[]>([]);
  const [bankFilter, setBankFilter] = useState("all");
  const [bankClientFilter, setBankClientFilter] = useState("all");
  const [bankImporting, setBankImporting] = useState(false);
  const [bankImportResult, setBankImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [bankImportClient, setBankImportClient] = useState("");
  const [bankViewTx, setBankViewTx] = useState<BankTx | null>(null);
  const [bankActionLoading, setBankActionLoading] = useState<string | null>(null);

  // Exception state
  interface ExceptionItemData {
    id: string; userId: string; type: string; title: string; description: string; status: string;
    invoiceId: string | null; purchaseDocId: string | null; bankTransactionId: string | null;
    customerResponse: string | null; customerNotes: string | null; customerFileUrl: string | null; customerFileName: string | null;
    respondedAt: string | null; resolvedAt: string | null; createdAt: string;
    user: { id: string; name: string; company: string | null; email: string };
    createdBy: { id: string; name: string };
  }
  const [exceptions, setExceptions] = useState<ExceptionItemData[]>([]);
  const [showCreateException, setShowCreateException] = useState(false);

  // Accountant tasks (customer-assigned)
  interface AccTask { id: string; userId: string; title: string; description: string | null; date: string; time: string | null; completed: boolean; category: string | null; createdAt: string }
  const [accTasks, setAccTasks] = useState<AccTask[]>([]);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [taskForm, setTaskForm] = useState({ userId: "", title: "", description: "", date: new Date().toISOString().split("T")[0], time: "" });
  const [taskSaving, setTaskSaving] = useState(false);

  // Accountant agenda
  const [agendaDate, setAgendaDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [agendaMonth, setAgendaMonth] = useState(() => new Date());

  // Accountant berichten
  interface AccConvo { id: string; userId: string; subject: string; lastMessage: string | null; lastAt: string; unreadByAccountant: boolean; user: { id: string; name: string; company: string | null } }
  interface AccMsg { id: string; senderRole: string; text: string; createdAt: string; sender: { id: string; name: string; role: string } }
  const [accConvos, setAccConvos] = useState<AccConvo[]>([]);
  const [accActiveConvo, setAccActiveConvo] = useState<(AccConvo & { messages: AccMsg[] }) | null>(null);
  const [accMsgInput, setAccMsgInput] = useState("");
  const [accMsgSending, setAccMsgSending] = useState(false);
  const [aiDraft, setAiDraft] = useState("");
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [aiDraftError, setAiDraftError] = useState("");
  const [exceptionForm, setExceptionForm] = useState({ userId: "", type: "missing_document", title: "", description: "", invoiceId: "", purchaseDocId: "", bankTransactionId: "" });
  const [exceptionSaving, setExceptionSaving] = useState(false);

  // Afletteren state
  const [reconDocTab, setReconDocTab] = useState<"verkoop" | "inkoop">("verkoop");
  const [reconRelationFilter, setReconRelationFilter] = useState("all");
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<Set<string>>(new Set());
  const [selectedBankTxIds, setSelectedBankTxIds] = useState<Set<string>>(new Set());
  const [reconLoading, setReconLoading] = useState(false);
  const [reconMessage, setReconMessage] = useState("");
  const [purchaseViewDoc, setPurchaseViewDoc] = useState<PurchaseDoc | null>(null);
  const [purchaseActionLoading, setPurchaseActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/invoices").then((r) => r.json()).then(setInvoices);
    fetch("/api/clients").then((r) => r.json()).then(setClients);
    fetch("/api/purchases/all").then((r) => r.ok ? r.json() : []).then((d) => { if (Array.isArray(d)) setPurchaseDocs(d); }).catch(() => {});
    fetch("/api/bank/transactions").then((r) => r.ok ? r.json() : []).then((d) => { if (Array.isArray(d)) setBankTxs(d); }).catch(() => {});
    fetch("/api/exceptions").then((r) => r.ok ? r.json() : []).then((d) => { if (Array.isArray(d)) setExceptions(d); }).catch(() => {});
    fetch("/api/conversations").then((r) => r.ok ? r.json() : []).then((d) => { if (Array.isArray(d)) setAccConvos(d); }).catch(() => {});
  }, []);

  async function handleBook(invoiceId: string) {
    setBookingLoading(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookkeepingStatus: "booked" }),
      });
      if (res.ok) {
        setInvoices((prev) => prev.map((inv) => inv.id === invoiceId ? { ...inv, bookkeepingStatus: "booked" } : inv));
      }
    } catch { /* */ }
    finally { setBookingLoading(null); }
  }

  async function handleUnbook(invoiceId: string) {
    setBookingLoading(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookkeepingStatus: "to_book" }),
      });
      if (res.ok) {
        setInvoices((prev) => prev.map((inv) => inv.id === invoiceId ? { ...inv, bookkeepingStatus: "to_book" } : inv));
      }
    } catch { /* */ }
    finally { setBookingLoading(null); }
  }

  async function updatePurchaseStatus(docId: string, status: string) {
    setPurchaseActionLoading(docId);
    try {
      const res = await fetch(`/api/purchases/${docId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPurchaseDocs((prev) => prev.map((d) => d.id === docId ? updated : d));
        if (purchaseViewDoc?.id === docId) setPurchaseViewDoc(updated);
      }
    } catch { /* */ }
    finally { setPurchaseActionLoading(null); }
  }

  const filteredPurchases = purchaseDocs.filter((d) => {
    if (purchaseFilter !== "all" && d.status !== purchaseFilter) return false;
    if (purchaseClientFilter !== "all" && d.userId !== purchaseClientFilter) return false;
    return true;
  });

  const purchaseStatusLabels: Record<string, string> = { uploaded: "Geüpload", processing: "In behandeling", booked: "Geboekt" };
  const purchaseStatusColors: Record<string, string> = { uploaded: "bg-blue-100 text-blue-700", processing: "bg-amber-100 text-amber-700", booked: "bg-emerald-100 text-emerald-700" };

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Unique clients from purchase docs
  const purchaseClients = [...new Map(purchaseDocs.map((d) => [d.userId, d.user])).values()];

  // Bank helpers
  async function handleBankImport(files: FileList | null) {
    if (!files || files.length === 0 || !bankImportClient) return;
    setBankImporting(true);
    setBankImportResult(null);
    const formData = new FormData();
    formData.append("file", files[0]);
    formData.append("clientId", bankImportClient);
    try {
      const res = await fetch("/api/bank/import", { method: "POST", body: formData });
      const data = await res.json();
      setBankImportResult({ success: res.ok, message: data.message || data.error || "Onbekend resultaat" });
      if (res.ok) {
        const txRes = await fetch("/api/bank/transactions");
        if (txRes.ok) { const txs = await txRes.json(); if (Array.isArray(txs)) setBankTxs(txs); }
      }
    } catch { setBankImportResult({ success: false, message: "Import mislukt" }); }
    finally { setBankImporting(false); }
  }

  async function updateBankTxStatus(txId: string, status: string) {
    setBankActionLoading(txId);
    try {
      const res = await fetch(`/api/bank/transactions/${txId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setBankTxs((prev) => prev.map((t) => t.id === txId ? updated : t));
        if (bankViewTx?.id === txId) setBankViewTx(updated);
      }
    } catch { /* */ }
    finally { setBankActionLoading(null); }
  }

  const filteredBankTxs = bankTxs.filter((t) => {
    if (bankFilter !== "all" && t.status !== bankFilter) return false;
    if (bankClientFilter !== "all" && t.userId !== bankClientFilter) return false;
    return true;
  });

  const bankStatusLabels: Record<string, string> = { new: "Nieuw", processing: "In behandeling", matched: "Gematcht", reconciled: "Afgeletterd" };
  const bankStatusColors: Record<string, string> = { new: "bg-blue-100 text-blue-700", processing: "bg-amber-100 text-amber-700", matched: "bg-purple-100 text-purple-700", reconciled: "bg-emerald-100 text-emerald-700" };
  const bankClients = [...new Map(bankTxs.map((t) => [t.userId, t.user])).values()];

  // Exception helpers
  async function createException() {
    if (!exceptionForm.userId || !exceptionForm.title || !exceptionForm.description) return;
    setExceptionSaving(true);
    try {
      const res = await fetch("/api/exceptions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exceptionForm),
      });
      if (res.ok) {
        const item = await res.json();
        setExceptions((prev) => [item, ...prev]);
        setShowCreateException(false);
        setExceptionForm({ userId: "", type: "missing_document", title: "", description: "", invoiceId: "", purchaseDocId: "", bankTransactionId: "" });
      }
    } catch { /* */ }
    finally { setExceptionSaving(false); }
  }

  async function resolveException(id: string) {
    const res = await fetch(`/api/exceptions/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    if (res.ok) {
      const updated = await res.json();
      setExceptions((prev) => prev.map((e) => e.id === id ? updated : e));
    }
  }

  // Task creation for customers
  async function createCustomerTask() {
    if (!taskForm.userId || !taskForm.title.trim() || !taskForm.date) return;
    setTaskSaving(true);
    try {
      // Create task via a direct DB call through a simple endpoint
      const res = await fetch("/api/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...taskForm, assignedByAccountant: true }),
      });
      // The task API creates for the session user, but we need to create for a specific user
      // So we'll use a dedicated accountant endpoint
      if (!res.ok) {
        // Fallback: create exception as task
        await fetch("/api/exceptions", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: taskForm.userId,
            type: "task",
            title: taskForm.title,
            description: taskForm.description || "Taak van uw boekhouder",
          }),
        });
      }
      setShowCreateTask(false);
      setTaskForm({ userId: "", title: "", description: "", date: new Date().toISOString().split("T")[0], time: "" });
      // Refresh exceptions
      const exRes = await fetch("/api/exceptions");
      if (exRes.ok) { const d = await exRes.json(); if (Array.isArray(d)) setExceptions(d); }
    } catch { /* */ }
    finally { setTaskSaving(false); }
  }

  // Accountant berichten helpers
  async function generateAiDraft() {
    if (!accActiveConvo) return;
    setAiDraftLoading(true);
    setAiDraftError("");
    setAiDraft("");
    try {
      const res = await fetch("/api/ai/draft-reply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: accActiveConvo.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setAiDraft(data.draft);
      } else {
        setAiDraftError(data.error || "Kan geen concept genereren");
      }
    } catch { setAiDraftError("Verbindingsfout"); }
    finally { setAiDraftLoading(false); }
  }

  async function sendAiDraft() {
    if (!aiDraft.trim() || !accActiveConvo) return;
    setAccMsgSending(true);
    try {
      const res = await fetch(`/api/conversations/${accActiveConvo.id}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiDraft }),
      });
      if (res.ok) {
        const msg = await res.json();
        setAccActiveConvo((prev) => prev ? { ...prev, messages: [...prev.messages, msg] } : null);
        setAccConvos((prev) => prev.map((c) => c.id === accActiveConvo.id ? { ...c, lastMessage: msg.text.substring(0, 100), lastAt: new Date().toISOString() } : c));
        setAiDraft("");
      }
    } catch { /* */ }
    finally { setAccMsgSending(false); }
  }

  function useAiDraftAsInput() {
    setAccMsgInput(aiDraft);
    setAiDraft("");
  }

  async function openAccConvo(id: string) {
    setAiDraft(""); setAiDraftError("");
    const res = await fetch(`/api/conversations/${id}`);
    if (res.ok) {
      const data = await res.json();
      setAccActiveConvo(data);
      setAccConvos((prev) => prev.map((c) => c.id === id ? { ...c, unreadByAccountant: false } : c));
    }
  }

  async function sendAccMessage() {
    if (!accMsgInput.trim() || !accActiveConvo) return;
    setAccMsgSending(true);
    try {
      const res = await fetch(`/api/conversations/${accActiveConvo.id}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: accMsgInput }),
      });
      if (res.ok) {
        const msg = await res.json();
        setAccActiveConvo((prev) => prev ? { ...prev, messages: [...prev.messages, msg] } : null);
        setAccConvos((prev) => prev.map((c) => c.id === accActiveConvo.id ? { ...c, lastMessage: msg.text.substring(0, 100), lastAt: new Date().toISOString() } : c));
        setAccMsgInput("");
      }
    } catch { /* */ }
    finally { setAccMsgSending(false); }
  }

  function accFormatTimeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Zojuist";
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} uur`;
    const days = Math.floor(hours / 24);
    return days < 7 ? `${days}d` : new Date(dateStr).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
  }

  // Agenda helpers
  function getAccCalendarDays() {
    const year = agendaMonth.getFullYear();
    const month = agendaMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const days: (number | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }
  const accMonthNames = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

  // Combine exceptions as "tasks" for the accountant overview
  const allAccountantTasks = [
    ...exceptions.map((e) => ({ id: e.id, type: "exception" as const, title: e.title, customer: e.user.company || e.user.name, status: e.status, date: e.createdAt.split("T")[0], isException: true })),
  ];
  const openAccountantTasks = allAccountantTasks.filter((t) => t.status !== "resolved");
  const resolvedAccountantTasks = allAccountantTasks.filter((t) => t.status === "resolved");

  const exceptionStatusLabels: Record<string, string> = { waiting: "Wacht op klant", responded: "Reactie ontvangen", resolved: "Opgelost" };
  const exceptionStatusColors: Record<string, string> = { waiting: "bg-amber-100 text-amber-700", responded: "bg-blue-100 text-blue-700", resolved: "bg-emerald-100 text-emerald-700" };

  // Afletteren helpers
  const openInvoices = invoices.filter((i) => i.status !== "paid" && i.bookkeepingStatus !== "reconciled" && !i.isCredit);
  const openPurchaseDocs = purchaseDocs.filter((d) => d.status !== "booked" || !d.bookedAt);
  const unreconciledBankTxs = bankTxs.filter((t) => t.status !== "reconciled");

  const reconFilteredInvoices = reconRelationFilter === "all" ? openInvoices : openInvoices.filter((i) => i.customerName === reconRelationFilter);
  const reconFilteredPurchases = reconRelationFilter === "all" ? openPurchaseDocs : openPurchaseDocs.filter((d) => d.supplierName === reconRelationFilter);
  const reconFilteredBankTxs = reconRelationFilter === "all" ? unreconciledBankTxs : unreconciledBankTxs.filter((t) => t.counterparty === reconRelationFilter || t.description.includes(reconRelationFilter));

  // All unique relations for filter
  const allRelations = [...new Set([
    ...openInvoices.map((i) => i.customerName),
    ...openPurchaseDocs.map((d) => d.supplierName).filter(Boolean) as string[],
  ])].sort();

  const selectedDocTotal = [...selectedInvoiceIds].reduce((sum, id) => {
    const inv = invoices.find((i) => i.id === id);
    return sum + (inv?.total || 0);
  }, 0) + [...selectedPurchaseIds].reduce((sum, id) => {
    const doc = purchaseDocs.find((d) => d.id === id);
    return sum + (doc?.totalAmount || doc?.amount || 0);
  }, 0);

  const selectedBankTotal = [...selectedBankTxIds].reduce((sum, id) => {
    const tx = bankTxs.find((t) => t.id === id);
    if (!tx) return sum;
    return sum + (tx.direction === "credit" ? tx.amount : -tx.amount);
  }, 0);

  const reconDifference = Math.abs(selectedDocTotal - Math.abs(selectedBankTotal));
  const reconMatch = selectedDocTotal > 0 && Math.abs(selectedDocTotal - Math.abs(selectedBankTotal)) < 0.01;
  const hasSelection = selectedInvoiceIds.size > 0 || selectedPurchaseIds.size > 0 || selectedBankTxIds.size > 0;

  function toggleInvoiceSelect(id: string) { setSelectedInvoiceIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function togglePurchaseSelect(id: string) { setSelectedPurchaseIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function toggleBankTxSelect(id: string) { setSelectedBankTxIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }

  async function handleReconcile() {
    if (!reconMatch) return;
    setReconLoading(true);
    setReconMessage("");
    try {
      const res = await fetch("/api/bank/reconcile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceIds: [...selectedInvoiceIds],
          purchaseDocIds: [...selectedPurchaseIds],
          bankTransactionIds: [...selectedBankTxIds],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setReconMessage(data.message);
        // Refresh data
        const [invRes, purchRes, txRes] = await Promise.all([
          fetch("/api/invoices").then((r) => r.json()),
          fetch("/api/purchases/all").then((r) => r.ok ? r.json() : []),
          fetch("/api/bank/transactions").then((r) => r.ok ? r.json() : []),
        ]);
        setInvoices(invRes);
        if (Array.isArray(purchRes)) setPurchaseDocs(purchRes);
        if (Array.isArray(txRes)) setBankTxs(txRes);
        setSelectedInvoiceIds(new Set());
        setSelectedPurchaseIds(new Set());
        setSelectedBankTxIds(new Set());
        setTimeout(() => setReconMessage(""), 4000);
      } else {
        setReconMessage(data.error || "Afletteren mislukt");
      }
    } catch { setReconMessage("Er ging iets mis"); }
    finally { setReconLoading(false); }
  }

  const filtered = invoices.filter((inv) => {
    if (filter !== "all" && inv.bookkeepingStatus !== filter) return false;
    if (clientFilter !== "all" && inv.clientId !== clientFilter) return false;
    return true;
  });

  const toBookCount = invoices.filter((i) => i.bookkeepingStatus === "to_book" || i.bookkeepingStatus === "pending").length;
  const bookedCount = invoices.filter((i) => i.bookkeepingStatus === "booked" || i.bookkeepingStatus === "processed").length;
  const pendingCount = invoices.filter((i) => i.bookkeepingStatus === "pending").length;
  const processingCount = invoices.filter((i) => i.bookkeepingStatus === "processing").length;
  const processedCount = invoices.filter((i) => i.bookkeepingStatus === "processed").length;
  const totalRevenue = invoices.reduce((sum, i) => sum + i.subtotal, 0);

  function getClientName(clientId: string) {
    return clients.find((c) => c.id === clientId)?.company || clientId;
  }

  const sectionTitles: Record<string, string> = {
    dashboard: "Dashboard", verkoop: "Verkoop", inkoop: "Inkoop", bank: "Bank",
    kas: "Kas", afletteren: "Afletteren", taken: "Taken", berichten: "Berichten",
    agenda: "Agenda", fiscaal: "BTW & Fiscaal", instellingen: "Instellingen",
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      {/* ═══ DASHBOARD ═══ */}
      {section === "dashboard" && (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-[#3C2C1E]">Dashboard</h1>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500 font-medium mb-1">Totaal facturen</p>
              <p className="text-2xl font-bold text-[#004854]">{invoices.length}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-5 shadow-sm border border-amber-100">
              <p className="text-xs text-amber-700 font-medium mb-1">Te boeken</p>
              <p className="text-2xl font-bold text-amber-700">{toBookCount}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-5 shadow-sm border border-emerald-100">
              <p className="text-xs text-emerald-700 font-medium mb-1">Geboekt</p>
              <p className="text-2xl font-bold text-emerald-700">{bookedCount}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-5 shadow-sm border border-green-100">
              <p className="text-xs text-green-700 font-medium mb-1">Verwerkt</p>
              <p className="text-2xl font-bold text-green-700">{processedCount}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-base font-semibold text-[#3C2C1E] mb-3">Overzicht</h2>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-50"><span className="text-sm text-gray-600">Totale omzet klanten</span><span className="text-sm font-semibold">{formatCurrency(totalRevenue)}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-50"><span className="text-sm text-gray-600">Actieve klanten</span><span className="text-sm font-semibold">{clients.filter((c) => c.role === "client").length}</span></div>
                <div className="flex justify-between py-2"><span className="text-sm text-gray-600">Te verwerken facturen</span><span className="text-sm font-semibold text-amber-600">{pendingCount + processingCount}</span></div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-base font-semibold text-[#3C2C1E] mb-3">Recente activiteit</h2>
              {invoices.slice(0, 5).map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{inv.invoiceNumber}</p>
                    <p className="text-xs text-gray-400">{inv.customerName}</p>
                  </div>
                  <StatusBadge status={inv.bookkeepingStatus} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ VERKOOP (existing invoice table) ═══ */}
      {section === "verkoop" && (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-[#3C2C1E]">Verkoop</h1>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-center">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
              {["all", "to_book", "pending", "booked", "processed"].map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {{ all: "Alles", to_book: "Te boeken", pending: "In afwachting", booked: "Geboekt", processed: "Verwerkt" }[f]}
                </button>
              ))}
            </div>
            <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none">
              <option value="all">Alle klanten</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
            <span className="text-sm text-gray-500 sm:ml-auto">Totale omzet: <strong>{formatCurrency(totalRevenue)}</strong></span>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
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
                      <div className="flex gap-2 justify-end">
                        {(inv.bookkeepingStatus === "pending" || inv.bookkeepingStatus === "to_book" || inv.bookkeepingStatus === "processing") && (
                          <button onClick={() => handleBook(inv.id)} disabled={bookingLoading === inv.id}
                            className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50">
                            {bookingLoading === inv.id ? "..." : "Boeken"}
                          </button>
                        )}
                        {(inv.bookkeepingStatus === "booked" || inv.bookkeepingStatus === "processed") && (
                          <button onClick={() => handleUnbook(inv.id)} disabled={bookingLoading === inv.id}
                            className="text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50">
                            {bookingLoading === inv.id ? "..." : "Heropenen"}
                          </button>
                        )}
                        <Link href={`/bookkeeper/invoices/${inv.id}`} className="text-sm text-[#00AFCB] hover:text-[#004854] font-medium py-1">Bekijken</Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-gray-400">Geen facturen gevonden.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((inv) => (
              <div key={inv.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <Link href={`/bookkeeper/invoices/${inv.id}`} className="block">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#004854]">{inv.invoiceNumber}</p>
                      <p className="text-sm text-gray-900 mt-0.5">{inv.customerName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{getClientName(inv.clientId)} &middot; {formatDate(inv.date)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold text-sm">{formatCurrency(inv.total)}</p>
                      <div className="mt-1"><StatusBadge status={inv.bookkeepingStatus} /></div>
                    </div>
                  </div>
                </Link>
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  {(inv.bookkeepingStatus === "pending" || inv.bookkeepingStatus === "to_book" || inv.bookkeepingStatus === "processing") && (
                    <button onClick={() => handleBook(inv.id)} disabled={bookingLoading === inv.id}
                      className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50">
                      {bookingLoading === inv.id ? "..." : "Boeken"}
                    </button>
                  )}
                  {(inv.bookkeepingStatus === "booked" || inv.bookkeepingStatus === "processed") && (
                    <button onClick={() => handleUnbook(inv.id)} disabled={bookingLoading === inv.id}
                      className="text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50">
                      {bookingLoading === inv.id ? "..." : "Heropenen"}
                    </button>
                  )}
                  <Link href={`/bookkeeper/invoices/${inv.id}`} className="text-xs text-[#00AFCB] hover:text-[#004854] font-medium py-1.5 ml-auto">Bekijken</Link>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-12 text-center text-gray-400">Geen facturen gevonden.</div>}
          </div>
        </div>
      )}

      {/* ═══ INKOOP ═══ */}
      {section === "inkoop" && (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-[#3C2C1E]">Inkoop</h1>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500 font-medium mb-1">Totaal</p>
              <p className="text-2xl font-bold text-[#004854]">{purchaseDocs.length}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 shadow-sm border border-blue-100">
              <p className="text-xs text-blue-700 font-medium mb-1">Geüpload</p>
              <p className="text-2xl font-bold text-blue-700">{purchaseDocs.filter((d) => d.status === "uploaded").length}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 shadow-sm border border-amber-100">
              <p className="text-xs text-amber-700 font-medium mb-1">In behandeling</p>
              <p className="text-2xl font-bold text-amber-700">{purchaseDocs.filter((d) => d.status === "processing").length}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 shadow-sm border border-emerald-100">
              <p className="text-xs text-emerald-700 font-medium mb-1">Geboekt</p>
              <p className="text-2xl font-bold text-emerald-700">{purchaseDocs.filter((d) => d.status === "booked").length}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-center">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
              {["all", "uploaded", "processing", "booked"].map((f) => (
                <button key={f} onClick={() => setPurchaseFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${purchaseFilter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {{ all: "Alles", uploaded: "Geüpload", processing: "In behandeling", booked: "Geboekt" }[f]}
                </button>
              ))}
            </div>
            <select value={purchaseClientFilter} onChange={(e) => setPurchaseClientFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none">
              <option value="all">Alle klanten</option>
              {purchaseClients.map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
            </select>
            <span className="text-sm text-gray-400 sm:ml-auto">{filteredPurchases.length} document(en)</span>
          </div>

          {/* Document list */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            {filteredPurchases.length === 0 ? (
              <div className="p-8 sm:p-12 text-center">
                <p className="text-sm text-gray-500">Geen inkoopdocumenten gevonden.</p>
                <p className="text-xs text-gray-400 mt-1">Wanneer klanten documenten uploaden verschijnen ze hier.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filteredPurchases.map((doc) => (
                  <button key={doc.id} onClick={() => setPurchaseViewDoc(doc)}
                    className="w-full text-left px-4 sm:px-5 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${doc.fileType === "pdf" ? "bg-red-50" : "bg-blue-50"}`}>
                        {doc.fileType === "pdf" ? (
                          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        ) : (
                          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{doc.label || doc.fileName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {doc.user.company || doc.user.name} &middot; {formatDate(doc.createdAt.split("T")[0])} &middot; {formatFileSize(doc.fileSize)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${purchaseStatusColors[doc.status] || "bg-gray-100"}`}>
                          {purchaseStatusLabels[doc.status] || doc.status}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Document detail modal */}
          {purchaseViewDoc && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPurchaseViewDoc(null)}>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold truncate">{purchaseViewDoc.label || purchaseViewDoc.fileName}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {purchaseViewDoc.user.company || purchaseViewDoc.user.name} &middot; {formatDate(purchaseViewDoc.createdAt.split("T")[0])} &middot; {formatFileSize(purchaseViewDoc.fileSize)}
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

                {/* Content */}
                <div className="flex-1 overflow-auto">
                  <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
                    {/* Preview */}
                    <div className="p-4 sm:p-6">
                      {purchaseViewDoc.fileType === "pdf" ? (
                        <iframe src={purchaseViewDoc.fileUrl} className="w-full h-[50vh] rounded-lg border border-gray-200" />
                      ) : (
                        <img src={purchaseViewDoc.fileUrl} alt={purchaseViewDoc.fileName} className="max-w-full rounded-lg border border-gray-200" />
                      )}
                    </div>

                    {/* Metadata & actions */}
                    <div className="p-4 sm:p-6 space-y-4">
                      <h3 className="text-sm font-semibold text-gray-700">Boekingsgegevens</h3>

                      {/* Metadata fields (display-only for now, ready for future editing) */}
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between py-1.5 border-b border-gray-50">
                          <span className="text-gray-500">Leverancier</span>
                          <span className="font-medium text-gray-900">{purchaseViewDoc.supplierName || <span className="text-gray-300 italic">Onbekend</span>}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-gray-50">
                          <span className="text-gray-500">Factuurnummer</span>
                          <span className="font-medium text-gray-900">{purchaseViewDoc.invoiceNumber || <span className="text-gray-300 italic">—</span>}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-gray-50">
                          <span className="text-gray-500">Documentdatum</span>
                          <span className="font-medium text-gray-900">{purchaseViewDoc.documentDate ? formatDate(purchaseViewDoc.documentDate) : <span className="text-gray-300 italic">—</span>}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-gray-50">
                          <span className="text-gray-500">Bedrag excl. BTW</span>
                          <span className="font-medium text-gray-900">{purchaseViewDoc.amount != null ? formatCurrency(purchaseViewDoc.amount) : <span className="text-gray-300 italic">—</span>}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-gray-50">
                          <span className="text-gray-500">BTW</span>
                          <span className="font-medium text-gray-900">{purchaseViewDoc.vatAmount != null ? formatCurrency(purchaseViewDoc.vatAmount) : <span className="text-gray-300 italic">—</span>}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-gray-50">
                          <span className="text-gray-500">Totaal incl. BTW</span>
                          <span className="font-semibold text-gray-900">{purchaseViewDoc.totalAmount != null ? formatCurrency(purchaseViewDoc.totalAmount) : <span className="text-gray-300 italic">—</span>}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-gray-50">
                          <span className="text-gray-500">Categorie</span>
                          <span className="font-medium text-gray-900">{purchaseViewDoc.category || <span className="text-gray-300 italic">—</span>}</span>
                        </div>
                        {purchaseViewDoc.notes && (
                          <div className="pt-2">
                            <p className="text-gray-500 text-xs mb-1">Opmerkingen</p>
                            <p className="text-sm text-gray-700">{purchaseViewDoc.notes}</p>
                          </div>
                        )}
                      </div>

                      {/* Future AI suggestion area */}
                      <div className="bg-gray-50 rounded-lg p-3 border border-dashed border-gray-200">
                        <p className="text-xs text-gray-400 text-center">AI-suggesties binnenkort beschikbaar</p>
                      </div>

                      {purchaseViewDoc.bookedAt && (
                        <p className="text-xs text-emerald-600">Geboekt op {new Date(purchaseViewDoc.bookedAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 sm:p-6 border-t border-gray-100 flex flex-wrap gap-2 sm:gap-3">
                  {(purchaseViewDoc.status === "uploaded") && (
                    <button onClick={() => updatePurchaseStatus(purchaseViewDoc.id, "processing")} disabled={purchaseActionLoading === purchaseViewDoc.id}
                      className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                      In behandeling zetten
                    </button>
                  )}
                  {(purchaseViewDoc.status === "uploaded" || purchaseViewDoc.status === "processing") && (
                    <button onClick={() => updatePurchaseStatus(purchaseViewDoc.id, "booked")} disabled={purchaseActionLoading === purchaseViewDoc.id}
                      className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                      Boeken
                    </button>
                  )}
                  {purchaseViewDoc.status === "booked" && (
                    <button onClick={() => updatePurchaseStatus(purchaseViewDoc.id, "processing")} disabled={purchaseActionLoading === purchaseViewDoc.id}
                      className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
                      Heropenen
                    </button>
                  )}
                  <a href={purchaseViewDoc.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 ml-auto">
                    Openen in nieuw tabblad
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ BANK ═══ */}
      {section === "bank" && (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-[#3C2C1E]">Bank</h1>

          {/* Import area */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6">
            <h2 className="text-base font-semibold text-[#3C2C1E] mb-1">MT940 importeren</h2>
            <p className="text-sm text-gray-500 mb-4">Upload een MT940 bankafschrift om transacties te importeren.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <select value={bankImportClient} onChange={(e) => setBankImportClient(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none sm:w-48">
                <option value="">Selecteer klant...</option>
                {clients.filter((c) => c.role === "client").map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
              </select>
              <label className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                bankImportClient ? "bg-[#004854] text-white hover:bg-[#003640]" : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                {bankImporting ? "Importeren..." : "MT940 bestand kiezen"}
                <input type="file" className="hidden" accept=".sta,.mt940,.txt,.940" disabled={!bankImportClient || bankImporting}
                  onChange={(e) => handleBankImport(e.target.files)} />
              </label>
            </div>
            {bankImportResult && (
              <div className={`mt-3 rounded-lg px-4 py-3 text-sm ${bankImportResult.success ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {bankImportResult.message}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500 font-medium mb-1">Totaal</p>
              <p className="text-2xl font-bold text-[#004854]">{bankTxs.length}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 shadow-sm border border-blue-100">
              <p className="text-xs text-blue-700 font-medium mb-1">Nieuw</p>
              <p className="text-2xl font-bold text-blue-700">{bankTxs.filter((t) => t.status === "new").length}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 shadow-sm border border-amber-100">
              <p className="text-xs text-amber-700 font-medium mb-1">In behandeling</p>
              <p className="text-2xl font-bold text-amber-700">{bankTxs.filter((t) => t.status === "processing").length}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 shadow-sm border border-emerald-100">
              <p className="text-xs text-emerald-700 font-medium mb-1">Afgeletterd</p>
              <p className="text-2xl font-bold text-emerald-700">{bankTxs.filter((t) => t.status === "reconciled").length}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-center">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
              {["all", "new", "processing", "matched", "reconciled"].map((f) => (
                <button key={f} onClick={() => setBankFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${bankFilter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {{ all: "Alles", new: "Nieuw", processing: "In behandeling", matched: "Gematcht", reconciled: "Afgeletterd" }[f]}
                </button>
              ))}
            </div>
            <select value={bankClientFilter} onChange={(e) => setBankClientFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none">
              <option value="all">Alle klanten</option>
              {bankClients.map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
            </select>
            <span className="text-sm text-gray-400 sm:ml-auto">{filteredBankTxs.length} transactie(s)</span>
          </div>

          {/* Transaction list */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            {filteredBankTxs.length === 0 ? (
              <div className="p-8 sm:p-12 text-center">
                <p className="text-sm text-gray-500">Geen banktransacties gevonden.</p>
                <p className="text-xs text-gray-400 mt-1">Importeer een MT940-bestand om te beginnen.</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-500 border-b border-gray-100 bg-gray-50">
                        <th className="px-5 py-3 font-medium">Datum</th>
                        <th className="px-5 py-3 font-medium">Klant</th>
                        <th className="px-5 py-3 font-medium">Omschrijving</th>
                        <th className="px-5 py-3 font-medium">Tegenpartij</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                        <th className="px-5 py-3 font-medium text-right">Bedrag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredBankTxs.map((tx) => (
                        <tr key={tx.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setBankViewTx(tx)}>
                          <td className="px-5 py-4 text-sm text-gray-600">{formatDate(tx.transactionDate)}</td>
                          <td className="px-5 py-4 text-sm text-gray-600">{tx.user.company || tx.user.name}</td>
                          <td className="px-5 py-4 text-sm text-gray-900 max-w-[250px] truncate">{tx.description}</td>
                          <td className="px-5 py-4 text-sm text-gray-600">{tx.counterparty || "—"}</td>
                          <td className="px-5 py-4"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${bankStatusColors[tx.status] || "bg-gray-100"}`}>{bankStatusLabels[tx.status] || tx.status}</span></td>
                          <td className={`px-5 py-4 text-right font-semibold text-sm ${tx.direction === "credit" ? "text-emerald-600" : "text-red-600"}`}>
                            {tx.direction === "credit" ? "+" : "-"}{formatCurrency(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-gray-50">
                  {filteredBankTxs.map((tx) => (
                    <button key={tx.id} onClick={() => setBankViewTx(tx)} className="w-full text-left px-4 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-gray-900 truncate">{tx.description}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{tx.user.company || tx.user.name} &middot; {formatDate(tx.transactionDate)}</p>
                          {tx.counterparty && <p className="text-xs text-gray-400 mt-0.5">{tx.counterparty}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`font-semibold text-sm ${tx.direction === "credit" ? "text-emerald-600" : "text-red-600"}`}>
                            {tx.direction === "credit" ? "+" : "-"}{formatCurrency(tx.amount)}
                          </p>
                          <div className="mt-1"><span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${bankStatusColors[tx.status] || "bg-gray-100"}`}>{bankStatusLabels[tx.status]}</span></div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Future bank connection */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 text-center">
            <p className="text-sm text-gray-500 font-medium">Bank koppelen</p>
            <p className="text-xs text-gray-400 mt-1">Directe bankkoppeling is binnenkort beschikbaar</p>
          </div>

          {/* Transaction detail modal */}
          {bankViewTx && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setBankViewTx(null)}>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-semibold">Transactie details</h2>
                    <p className="text-xs text-gray-500 mt-0.5">{bankViewTx.user.company || bankViewTx.user.name}</p>
                  </div>
                  <button onClick={() => setBankViewTx(null)} className="text-gray-400 hover:text-gray-600 p-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-3">
                  <div className="text-center py-4">
                    <p className={`text-3xl font-bold ${bankViewTx.direction === "credit" ? "text-emerald-600" : "text-red-600"}`}>
                      {bankViewTx.direction === "credit" ? "+" : "-"}{formatCurrency(bankViewTx.amount)}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">{bankViewTx.direction === "credit" ? "Bijschrijving" : "Afschrijving"}</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-2 border-b border-gray-50"><span className="text-gray-500">Datum</span><span className="font-medium">{formatDate(bankViewTx.transactionDate)}</span></div>
                    <div className="flex justify-between py-2 border-b border-gray-50"><span className="text-gray-500">Omschrijving</span><span className="font-medium text-right max-w-[60%]">{bankViewTx.description}</span></div>
                    {bankViewTx.counterparty && <div className="flex justify-between py-2 border-b border-gray-50"><span className="text-gray-500">Tegenpartij</span><span className="font-medium">{bankViewTx.counterparty}</span></div>}
                    {bankViewTx.counterpartyAccount && <div className="flex justify-between py-2 border-b border-gray-50"><span className="text-gray-500">Tegenrekening</span><span className="font-medium font-mono text-xs">{bankViewTx.counterpartyAccount}</span></div>}
                    {bankViewTx.bankAccount && <div className="flex justify-between py-2 border-b border-gray-50"><span className="text-gray-500">Bankrekening</span><span className="font-medium font-mono text-xs">{bankViewTx.bankAccount}</span></div>}
                    <div className="flex justify-between py-2 border-b border-gray-50"><span className="text-gray-500">Status</span><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${bankStatusColors[bankViewTx.status]}`}>{bankStatusLabels[bankViewTx.status]}</span></div>
                    <div className="flex justify-between py-2"><span className="text-gray-500">Import batch</span><span className="text-xs text-gray-400 font-mono">{bankViewTx.importBatchId.split("-").pop()}</span></div>
                  </div>
                </div>
                <div className="p-4 sm:p-6 border-t border-gray-100 flex flex-wrap gap-2">
                  {bankViewTx.status === "new" && (
                    <button onClick={() => updateBankTxStatus(bankViewTx.id, "processing")} disabled={bankActionLoading === bankViewTx.id}
                      className="px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 disabled:opacity-50">
                      In behandeling zetten
                    </button>
                  )}
                  {bankViewTx.status === "processing" && (
                    <button onClick={() => updateBankTxStatus(bankViewTx.id, "new")} disabled={bankActionLoading === bankViewTx.id}
                      className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
                      Terug naar nieuw
                    </button>
                  )}
                  <button onClick={() => setBankViewTx(null)} className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 ml-auto">
                    Sluiten
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ KAS ═══ */}
      {section === "kas" && (
        <ModuleShell title="Kas" description="Beheer kastransacties en contante boekingen."
          sections={[
            { title: "Kastransacties", description: "Registreer en bekijk alle contante transacties." },
            { title: "Kasreconciliatie", description: "Vergelijk het kasboek met het werkelijke kassaldo." },
            { title: "Kasoverzicht", description: "Totaaloverzicht van alle kasboekingen per periode." },
          ]}
        />
      )}

      {/* ═══ AFLETTEREN ═══ */}
      {section === "afletteren" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#3C2C1E]">Afletteren</h1>
              <p className="text-sm text-[#6F5C4B]/70 mt-0.5">Koppel openstaande posten aan banktransacties.</p>
            </div>
            <select value={reconRelationFilter} onChange={(e) => setReconRelationFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none sm:w-56">
              <option value="all">Alle relaties</option>
              {allRelations.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Live totals bar */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Documenten</p>
                <p className="text-lg font-bold text-[#004854]">{selectedDocTotal > 0 ? formatCurrency(selectedDocTotal) : "—"}</p>
                <p className="text-[10px] text-gray-400">{selectedInvoiceIds.size + selectedPurchaseIds.size} geselecteerd</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Bank</p>
                <p className="text-lg font-bold text-[#004854]">{selectedBankTxIds.size > 0 ? formatCurrency(Math.abs(selectedBankTotal)) : "—"}</p>
                <p className="text-[10px] text-gray-400">{selectedBankTxIds.size} geselecteerd</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Verschil</p>
                <p className={`text-lg font-bold ${hasSelection ? (reconMatch ? "text-emerald-600" : "text-red-600") : "text-gray-300"}`}>
                  {hasSelection ? formatCurrency(reconDifference) : "—"}
                </p>
              </div>
              <div className="flex items-center justify-center">
                <button onClick={handleReconcile} disabled={!reconMatch || reconLoading}
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${reconMatch ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-gray-200 text-gray-400 cursor-not-allowed"} disabled:opacity-50`}>
                  {reconLoading ? "Verwerken..." : "Afletteren"}
                </button>
              </div>
            </div>
            {reconMessage && (
              <div className={`mt-3 rounded-lg px-4 py-2 text-sm ${reconMessage.includes("succesvol") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {reconMessage}
              </div>
            )}
          </div>

          {/* Split layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* LEFT: Documents */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-[#3C2C1E]">Openstaande documenten</h2>
                  <span className="text-xs text-gray-400">{reconDocTab === "verkoop" ? reconFilteredInvoices.length : reconFilteredPurchases.length} items</span>
                </div>
                <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
                  <button onClick={() => setReconDocTab("verkoop")}
                    className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${reconDocTab === "verkoop" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
                    Verkoop ({reconFilteredInvoices.length})
                  </button>
                  <button onClick={() => setReconDocTab("inkoop")}
                    className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${reconDocTab === "inkoop" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
                    Inkoop ({reconFilteredPurchases.length})
                  </button>
                </div>
              </div>

              <div className="max-h-[50vh] lg:max-h-[60vh] overflow-y-auto divide-y divide-gray-50">
                {reconDocTab === "verkoop" && (
                  reconFilteredInvoices.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-400">Geen openstaande verkoopfacturen.</div>
                  ) : reconFilteredInvoices.map((inv) => (
                    <button key={inv.id} onClick={() => toggleInvoiceSelect(inv.id)}
                      className={`w-full text-left px-4 py-3 transition-colors ${selectedInvoiceIds.has(inv.id) ? "bg-emerald-50 border-l-4 border-emerald-500" : "hover:bg-gray-50 border-l-4 border-transparent"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">V</span>
                            <p className="text-sm font-medium truncate">{inv.invoiceNumber}</p>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{inv.customerName} &middot; {formatDate(inv.date)}</p>
                        </div>
                        <p className="text-sm font-semibold flex-shrink-0">{formatCurrency(inv.total)}</p>
                      </div>
                    </button>
                  ))
                )}
                {reconDocTab === "inkoop" && (
                  reconFilteredPurchases.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-400">Geen openstaande inkoopdocumenten.</div>
                  ) : reconFilteredPurchases.map((doc) => (
                    <button key={doc.id} onClick={() => togglePurchaseSelect(doc.id)}
                      className={`w-full text-left px-4 py-3 transition-colors ${selectedPurchaseIds.has(doc.id) ? "bg-emerald-50 border-l-4 border-emerald-500" : "hover:bg-gray-50 border-l-4 border-transparent"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">I</span>
                            <p className="text-sm font-medium truncate">{doc.label || doc.fileName}</p>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{doc.supplierName || doc.user.company || doc.user.name} &middot; {formatDate(doc.createdAt.split("T")[0])}</p>
                        </div>
                        <p className="text-sm font-semibold flex-shrink-0">{doc.totalAmount || doc.amount ? formatCurrency(doc.totalAmount || doc.amount || 0) : "—"}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* RIGHT: Bank transactions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#3C2C1E]">Banktransacties</h2>
                <span className="text-xs text-gray-400">{reconFilteredBankTxs.length} items</span>
              </div>

              <div className="max-h-[50vh] lg:max-h-[60vh] overflow-y-auto divide-y divide-gray-50">
                {reconFilteredBankTxs.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-400">Geen onafgeletterde banktransacties.</div>
                ) : reconFilteredBankTxs.map((tx) => (
                  <button key={tx.id} onClick={() => toggleBankTxSelect(tx.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${selectedBankTxIds.has(tx.id) ? "bg-emerald-50 border-l-4 border-emerald-500" : "hover:bg-gray-50 border-l-4 border-transparent"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900 truncate">{tx.description}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {tx.user.company || tx.user.name} &middot; {formatDate(tx.transactionDate)}
                          {tx.counterparty && <> &middot; {tx.counterparty}</>}
                        </p>
                      </div>
                      <p className={`text-sm font-semibold flex-shrink-0 ${tx.direction === "credit" ? "text-emerald-600" : "text-red-600"}`}>
                        {tx.direction === "credit" ? "+" : "-"}{formatCurrency(tx.amount)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAKEN ═══ */}
      {section === "taken" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#3C2C1E]">Taken</h1>
              <p className="text-sm text-[#6F5C4B]/70 mt-0.5">Openstaande vragen en opvolgingen voor klanten.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCreateTask(true)}
                className="px-3 sm:px-4 py-2 bg-[#00AFCB] text-white rounded-xl text-sm font-medium hover:bg-[#009AB5] transition-colors">
                + Taak voor klant
              </button>
              <button onClick={() => setShowCreateException(true)}
                className="px-3 sm:px-4 py-2 bg-[#004854] text-white rounded-xl text-sm font-medium hover:bg-[#003640] transition-colors">
                + Opvolgvraag
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-center">
              <p className="text-xs text-amber-700 font-medium mb-1">Wacht op klant</p>
              <p className="text-2xl font-bold text-amber-700">{exceptions.filter((e) => e.status === "waiting").length}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 text-center">
              <p className="text-xs text-blue-700 font-medium mb-1">Reactie ontvangen</p>
              <p className="text-2xl font-bold text-blue-700">{exceptions.filter((e) => e.status === "responded").length}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 text-center">
              <p className="text-xs text-emerald-700 font-medium mb-1">Opgelost</p>
              <p className="text-2xl font-bold text-emerald-700">{exceptions.filter((e) => e.status === "resolved").length}</p>
            </div>
          </div>

          {/* Exception list */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            {exceptions.length === 0 ? (
              <div className="p-8 sm:p-12 text-center">
                <p className="text-sm text-gray-500">Geen openstaande taken.</p>
                <p className="text-xs text-gray-400 mt-1">Maak een opvolgvraag aan wanneer er iets mist of onduidelijk is.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {exceptions.map((ex) => (
                  <div key={ex.id} className="px-4 sm:px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ex.type === "missing_document" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                            {ex.type === "missing_document" ? "Bon mist" : "Status onbekend"}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${exceptionStatusColors[ex.status] || "bg-gray-100"}`}>
                            {exceptionStatusLabels[ex.status] || ex.status}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{ex.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{ex.user.company || ex.user.name} &middot; {formatDate(ex.createdAt.split("T")[0])}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {ex.status === "responded" && (
                          <button onClick={() => resolveException(ex.id)}
                            className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700">
                            Oplossen
                          </button>
                        )}
                      </div>
                    </div>
                    {ex.status === "responded" && (
                      <div className="mt-3 bg-blue-50 rounded-lg p-3 border border-blue-100">
                        <p className="text-xs text-blue-600 font-medium mb-1">Reactie van klant:</p>
                        {ex.customerResponse && <p className="text-sm text-blue-800 font-medium">{ex.customerResponse}</p>}
                        {ex.customerNotes && <p className="text-sm text-blue-700 mt-1">{ex.customerNotes}</p>}
                        {ex.customerFileUrl && (
                          <a href={ex.customerFileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline mt-1 inline-block">
                            Bijlage: {ex.customerFileName || "Bestand bekijken"}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create customer task modal */}
          {showCreateTask && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreateTask(false)}>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center">
                  <h2 className="text-lg font-semibold">Taak voor klant aanmaken</h2>
                  <button onClick={() => setShowCreateTask(false)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="p-4 sm:p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Klant *</label>
                    <select value={taskForm.userId} onChange={(e) => setTaskForm({ ...taskForm, userId: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#00AFCB]/30">
                      <option value="">Selecteer klant...</option>
                      {clients.filter((c) => c.role === "client").map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Taak *</label>
                    <input type="text" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                      placeholder="Bijv. Upload de bon van deze betaling" autoFocus
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#00AFCB]/30" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Toelichting (optioneel)</label>
                    <textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                      placeholder="Extra uitleg voor de klant..." rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#00AFCB]/30" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                      <input type="date" value={taskForm.date} onChange={(e) => setTaskForm({ ...taskForm, date: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#00AFCB]/30" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tijd (optioneel)</label>
                      <input type="time" value={taskForm.time} onChange={(e) => setTaskForm({ ...taskForm, time: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#00AFCB]/30" />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowCreateTask(false)} className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Annuleren</button>
                    <button onClick={createCustomerTask} disabled={taskSaving || !taskForm.userId || !taskForm.title.trim()}
                      className="px-5 py-2.5 bg-[#00AFCB] text-white rounded-xl text-sm font-medium hover:bg-[#009AB5] disabled:opacity-50">
                      {taskSaving ? "Aanmaken..." : "Taak aanmaken"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Create exception modal */}
          {showCreateException && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreateException(false)}>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center">
                  <h2 className="text-lg font-semibold">Nieuwe opvolgvraag</h2>
                  <button onClick={() => setShowCreateException(false)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="p-4 sm:p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Klant *</label>
                    <select value={exceptionForm.userId} onChange={(e) => setExceptionForm({ ...exceptionForm, userId: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#00AFCB]/30">
                      <option value="">Selecteer klant...</option>
                      {clients.filter((c) => c.role === "client").map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select value={exceptionForm.type} onChange={(e) => {
                      const type = e.target.value;
                      const title = type === "missing_document" ? "Wij missen nog een bon of factuur" : "Wat is de status van deze factuur?";
                      const desc = type === "missing_document" ? "Er is een betaling gevonden waarvoor wij geen bijbehorende bon of factuur hebben. Kunt u deze uploaden?" : "Deze factuur staat nog als openstaand in onze administratie. Kunt u aangeven wat de huidige status is?";
                      setExceptionForm({ ...exceptionForm, type, title, description: desc });
                    }} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#00AFCB]/30">
                      <option value="missing_document">Ontbrekende bon / factuur</option>
                      <option value="missing_payment">Status factuur onduidelijk</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
                    <input type="text" value={exceptionForm.title} onChange={(e) => setExceptionForm({ ...exceptionForm, title: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#00AFCB]/30" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Uitleg voor de klant *</label>
                    <textarea value={exceptionForm.description} onChange={(e) => setExceptionForm({ ...exceptionForm, description: e.target.value })} rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#00AFCB]/30" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowCreateException(false)} className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Annuleren</button>
                    <button onClick={createException} disabled={exceptionSaving || !exceptionForm.userId || !exceptionForm.title}
                      className="px-5 py-2.5 bg-[#004854] text-white rounded-xl text-sm font-medium hover:bg-[#003640] disabled:opacity-50">
                      {exceptionSaving ? "Aanmaken..." : "Vraag aanmaken"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ BERICHTEN ═══ */}
      {section === "berichten" && (
        <div className="space-y-4">
          <h1 className="text-xl sm:text-2xl font-bold text-[#3C2C1E]">Berichten</h1>
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 min-h-[60vh]">
            {/* Conversation list */}
            <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${accActiveConvo ? "hidden lg:block" : ""}`}>
              <div className="p-4 border-b border-gray-100"><p className="text-sm font-semibold text-[#3C2C1E]">Klantgesprekken</p></div>
              {accConvos.length === 0 ? (
                <div className="p-8 text-center"><p className="text-sm text-gray-400">Nog geen gesprekken.</p></div>
              ) : (
                <div className="divide-y divide-gray-50 max-h-[55vh] overflow-y-auto">
                  {accConvos.map((convo) => (
                    <button key={convo.id} onClick={() => openAccConvo(convo.id)}
                      className={`w-full text-left px-4 py-3 transition-colors ${accActiveConvo?.id === convo.id ? "bg-[#E6F9FC]" : "hover:bg-gray-50"}`}>
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {convo.unreadByAccountant && <span className="w-2 h-2 rounded-full bg-[#00AFCB] flex-shrink-0" />}
                            <p className={`text-sm truncate ${convo.unreadByAccountant ? "font-semibold" : "font-medium text-gray-700"}`}>{convo.subject}</p>
                          </div>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{convo.user.company || convo.user.name}</p>
                          {convo.lastMessage && <p className="text-xs text-gray-500 truncate mt-0.5">{convo.lastMessage}</p>}
                        </div>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{accFormatTimeAgo(convo.lastAt)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Conversation detail */}
            <div className={`bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col ${!accActiveConvo ? "hidden lg:flex" : ""}`}>
              {!accActiveConvo ? (
                <div className="flex-1 flex items-center justify-center p-8"><p className="text-sm text-gray-400">Selecteer een gesprek.</p></div>
              ) : (
                <>
                  <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                    <button onClick={() => setAccActiveConvo(null)} className="lg:hidden p-1 hover:bg-gray-100 rounded">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{accActiveConvo.subject}</p>
                      <p className="text-[10px] text-gray-400">{accActiveConvo.user.company || accActiveConvo.user.name}</p>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh]">
                    {accActiveConvo.messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.senderRole !== "client" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 ${msg.senderRole !== "client" ? "bg-[#004854] text-white rounded-br-md" : "bg-gray-100 text-gray-900 rounded-bl-md"}`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                          <p className={`text-[10px] mt-1 ${msg.senderRole !== "client" ? "text-white/50" : "text-gray-400"}`}>
                            {msg.sender.name} &middot; {new Date(msg.createdAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* AI Draft area */}
                  {(aiDraft || aiDraftLoading || aiDraftError) && (
                    <div className="px-3 pt-3 border-t border-gray-100">
                      {aiDraftLoading && (
                        <div className="flex items-center gap-2 text-sm text-[#00AFCB] py-2">
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                          Conceptantwoord wordt gegenereerd...
                        </div>
                      )}
                      {aiDraftError && (
                        <div className="bg-red-50 text-red-700 rounded-lg px-3 py-2 text-sm mb-2">{aiDraftError}</div>
                      )}
                      {aiDraft && (
                        <div className="bg-[#E6F9FC] border border-[#00AFCB]/20 rounded-xl p-3 mb-2">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] px-1.5 py-0.5 bg-[#00AFCB]/20 text-[#004854] rounded font-semibold">AI CONCEPT</span>
                            <span className="text-[10px] text-gray-400">Controleer en pas aan voor verzending</span>
                          </div>
                          <textarea value={aiDraft} onChange={(e) => setAiDraft(e.target.value)} rows={3}
                            className="w-full bg-white border border-[#00AFCB]/20 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00AFCB]/30 resize-y" />
                          <div className="flex flex-wrap gap-2 mt-2">
                            <button onClick={sendAiDraft} className="px-3 py-1.5 bg-[#004854] text-white rounded-lg text-xs font-medium hover:bg-[#003640]">Verzenden</button>
                            <button onClick={useAiDraftAsInput} className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50">Naar invoerveld</button>
                            <button onClick={generateAiDraft} className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50">Opnieuw genereren</button>
                            <button onClick={() => { setAiDraft(""); setAiDraftError(""); }} className="px-3 py-1.5 text-xs text-red-500 hover:text-red-700 font-medium ml-auto">Verwijderen</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message input */}
                  <div className="p-3 border-t border-gray-100">
                    <div className="flex gap-2">
                      <input type="text" value={accMsgInput} onChange={(e) => setAccMsgInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendAccMessage())}
                        placeholder="Typ een antwoord..."
                        className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#00AFCB]/30" />
                      <button onClick={generateAiDraft} disabled={aiDraftLoading}
                        title="AI-conceptantwoord genereren"
                        className="px-3 py-2.5 border border-[#00AFCB]/30 text-[#004854] rounded-xl text-sm hover:bg-[#E6F9FC] disabled:opacity-50 transition-colors flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                      </button>
                      <button onClick={sendAccMessage} disabled={!accMsgInput.trim() || accMsgSending}
                        className="px-4 py-2.5 bg-[#004854] text-white rounded-xl text-sm font-medium hover:bg-[#003640] disabled:opacity-50 flex-shrink-0">
                        {accMsgSending ? "..." : "Stuur"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ AGENDA ═══ */}
      {section === "agenda" && (
        <div className="space-y-4">
          <h1 className="text-xl sm:text-2xl font-bold text-[#3C2C1E]">Agenda</h1>
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
            {/* Calendar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => setAgendaMonth(new Date(agendaMonth.getFullYear(), agendaMonth.getMonth() - 1, 1))} className="p-1 hover:bg-gray-100 rounded">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <p className="text-sm font-semibold text-[#3C2C1E] capitalize">{accMonthNames[agendaMonth.getMonth()]} {agendaMonth.getFullYear()}</p>
                <button onClick={() => setAgendaMonth(new Date(agendaMonth.getFullYear(), agendaMonth.getMonth() + 1, 1))} className="p-1 hover:bg-gray-100 rounded">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
              <div className="grid grid-cols-7 gap-0 text-center">
                {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map((d) => <div key={d} className="text-[10px] text-gray-400 font-medium py-1">{d}</div>)}
                {getAccCalendarDays().map((day, i) => {
                  if (day === null) return <div key={`e-${i}`} />;
                  const dateStr = `${agendaMonth.getFullYear()}-${String(agendaMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const isToday = dateStr === new Date().toISOString().split("T")[0];
                  const isSelected = dateStr === agendaDate;
                  return (
                    <button key={dateStr} onClick={() => setAgendaDate(dateStr)}
                      className={`w-8 h-8 mx-auto rounded-full text-xs font-medium transition-all ${isSelected ? "bg-[#004854] text-white" : isToday ? "bg-[#E6F9FC] text-[#004854] font-bold" : "text-gray-700 hover:bg-gray-100"}`}>
                      {day}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setAgendaDate(new Date().toISOString().split("T")[0])} className="mt-3 w-full text-xs text-[#00AFCB] font-medium hover:text-[#004854]">Vandaag</button>
            </div>

            {/* Day content */}
            <div className="space-y-4">
              <h2 className="text-base sm:text-lg font-semibold text-[#3C2C1E] capitalize">
                {new Date(agendaDate + "T12:00:00").toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
                {agendaDate === new Date().toISOString().split("T")[0] && <span className="ml-2 text-[10px] px-2 py-0.5 bg-[#E6F9FC] text-[#004854] rounded-full font-medium align-middle">Vandaag</span>}
              </h2>

              {/* Tasks/exceptions due on this date */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <p className="text-xs text-gray-500 font-semibold mb-3 uppercase tracking-wide">Taken & deadlines</p>
                {openAccountantTasks.filter((t) => t.date <= agendaDate).length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">Geen taken voor deze dag.</p>
                ) : (
                  <div className="space-y-2">
                    {openAccountantTasks.filter((t) => t.date <= agendaDate).map((task) => (
                      <div key={task.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${task.isException ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                          {task.isException ? "Opvolg" : "Taak"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                          <p className="text-xs text-gray-500">{task.customer}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${exceptionStatusColors[task.status] || "bg-gray-100"}`}>
                          {exceptionStatusLabels[task.status] || task.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Future: fiscal deadlines placeholder */}
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-xs text-gray-400">Fiscale deadlines en herinneringen binnenkort beschikbaar</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BTW & FISCAAL ═══ */}
      {section === "fiscaal" && (
        <ModuleShell title="BTW & Fiscaal" description="Fiscale overzichten en belastingrapportages."
          sections={[
            { title: "BTW-overzicht", description: "Overzicht van BTW-ontvangsten en -afdrachten per kwartaal." },
            { title: "Inkomstenbelasting", description: "Geschatte inkomstenbelasting voor eenmanszaken en VOF's." },
            { title: "Vennootschapsbelasting", description: "Geschatte vennootschapsbelasting voor BV's." },
            { title: "Rapporten & Prognoses", description: "Fiscale rapporten en belastingprognoses per klant." },
          ]}
        />
      )}

      {/* ═══ INSTELLINGEN ═══ */}
      {section === "instellingen" && (
        <ModuleShell title="Instellingen" description="Configureer het boekhoudportaal."
          sections={[
            { title: "Klantinstellingen", description: "Standaardinstellingen per klant configureren." },
            { title: "Boekingsregels", description: "Automatische boekingsregels en sjablonen beheren." },
            { title: "BTW-codes", description: "BTW-codes en tarieven configureren." },
            { title: "Grootboekrekeningen", description: "Rekeningschema en grootboekrekeningen beheren." },
            { title: "Bankkoppelingen", description: "Bankverbindingen en importinstellingen." },
            { title: "AI-instellingen", description: "Configureer AI-suggesties en automatische herkenning." },
          ]}
        />
      )}
    </div>
  );
}

export default function BookkeeperPortal() {
  return (
    <Suspense>
      <BookkeeperContent />
    </Suspense>
  );
}
