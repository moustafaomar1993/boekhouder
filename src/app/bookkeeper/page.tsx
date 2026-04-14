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

  // Verkoop sub-tab state
  const [verkoopTab, setVerkoopTab] = useState<"facturatie" | "verwerken">("verwerken");
  const [selectedSalesIds, setSelectedSalesIds] = useState<Set<string>>(new Set());
  const [bulkLedgerAccount, setBulkLedgerAccount] = useState("");
  const [bulkBookingLoading, setBulkBookingLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [facturatieClient, setFacturatieClient] = useState("");

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

  // Message-to-task state
  const [msgToTaskMessage, setMsgToTaskMessage] = useState<{ id: string; text: string } | null>(null);
  const [msgToTaskForm, setMsgToTaskForm] = useState({ title: "", description: "", date: new Date().toISOString().split("T")[0], time: "", assignedTo: "customer" as "customer" | "accountant" });
  const [msgToTaskLoading, setMsgToTaskLoading] = useState(false);
  const [msgToTaskAiLoading, setMsgToTaskAiLoading] = useState(false);
  const [exceptionForm, setExceptionForm] = useState({ userId: "", type: "missing_document", title: "", description: "", invoiceId: "", purchaseDocId: "", bankTransactionId: "" });
  const [exceptionSaving, setExceptionSaving] = useState(false);

  // Grootboek state
  interface LedgerAccountData {
    id: string; accountNumber: string; name: string; description: string | null;
    accountType: string; category: string; statementSection: string | null;
    normalBalance: string; isBalanceSheet: boolean; isActive: boolean;
    isSystem: boolean; sortOrder: number; vatCodeId: string | null;
    defaultVatCode: VatCodeData | null;
  }
  interface VatCodeData {
    id: string; code: string; name: string; description: string | null;
    percentage: number; type: string; rubricCode: string | null;
    ledgerAccountId: string | null; isActive: boolean; isSystem: boolean;
    ledgerAccount: { id: string; accountNumber: string; name: string } | null;
  }
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccountData[]>([]);
  const [vatCodes, setVatCodes] = useState<VatCodeData[]>([]);
  const [grootboekTab, setGrootboekTab] = useState<"accounts" | "btw" | "statements">("accounts");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["all"]));
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<LedgerAccountData | null>(null);
  const [accountForm, setAccountForm] = useState({ accountNumber: "", name: "", description: "", accountType: "expense", category: "", statementSection: "", normalBalance: "debit", isBalanceSheet: false, vatCodeId: "" });
  const [accountSaving, setAccountSaving] = useState(false);
  const [showVatModal, setShowVatModal] = useState(false);
  const [editingVat, setEditingVat] = useState<VatCodeData | null>(null);
  const [vatForm, setVatForm] = useState({ code: "", name: "", description: "", percentage: "21", type: "sales", rubricCode: "", ledgerAccountId: "" });
  const [vatSaving, setVatSaving] = useState(false);
  const [statementView, setStatementView] = useState<"balans" | "wv">("wv");

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
    fetch("/api/ledger-accounts").then((r) => r.ok ? r.json() : []).then((d) => { if (Array.isArray(d)) setLedgerAccounts(d); }).catch(() => {});
    fetch("/api/vat-codes").then((r) => r.ok ? r.json() : []).then((d) => { if (Array.isArray(d)) setVatCodes(d); }).catch(() => {});
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
  async function startMsgToTask(msg: { id: string; text: string }) {
    setMsgToTaskMessage(msg);
    setMsgToTaskForm({ title: "", description: "", date: new Date().toISOString().split("T")[0], time: "", assignedTo: "customer" });
    setMsgToTaskAiLoading(true);
    try {
      const res = await fetch("/api/ai/summarize-task", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageText: msg.text, customerName: accActiveConvo?.user.company || accActiveConvo?.user.name }),
      });
      if (res.ok) {
        const data = await res.json();
        setMsgToTaskForm((prev) => ({ ...prev, title: data.title || "", description: data.description || "" }));
      }
    } catch { /* AI not available, user fills manually */ }
    finally { setMsgToTaskAiLoading(false); }
  }

  async function saveMsgToTask() {
    if (!msgToTaskMessage || !accActiveConvo || !msgToTaskForm.title.trim()) return;
    setMsgToTaskLoading(true);
    try {
      const targetUserId = msgToTaskForm.assignedTo === "customer" ? accActiveConvo.user.id : undefined;
      const res = await fetch("/api/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUserId,
          title: msgToTaskForm.title,
          description: msgToTaskForm.description,
          date: msgToTaskForm.date,
          time: msgToTaskForm.time || null,
          assignedTo: msgToTaskForm.assignedTo,
          sourceType: "message",
          sourceId: msgToTaskMessage.id,
          conversationId: accActiveConvo.id,
        }),
      });
      if (res.ok) {
        setMsgToTaskMessage(null);
      }
    } catch { /* */ }
    finally { setMsgToTaskLoading(false); }
  }

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
    kas: "Kas", afletteren: "Afletteren", grootboek: "Grootboek", taken: "Taken", berichten: "Berichten",
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

      {/* ═══ VERKOOP ═══ */}
      {section === "verkoop" && (() => {
        const verwerkenFiltered = invoices.filter((inv) => {
          if (filter !== "all" && inv.bookkeepingStatus !== filter) return false;
          if (clientFilter !== "all" && inv.clientId !== clientFilter) return false;
          return true;
        });
        const allFilteredIds = verwerkenFiltered.filter((inv) => inv.bookkeepingStatus === "pending" || inv.bookkeepingStatus === "to_book" || inv.bookkeepingStatus === "processing").map((inv) => inv.id);
        const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedSalesIds.has(id));
        function toggleSalesSelect(id: string) { setSelectedSalesIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
        function toggleAllSales() {
          if (allSelected) setSelectedSalesIds(new Set());
          else setSelectedSalesIds(new Set(allFilteredIds));
        }
        async function handleBulkBook() {
          if (selectedSalesIds.size === 0 || !bulkLedgerAccount) return;
          setBulkBookingLoading(true); setBulkMessage("");
          try {
            const res = await fetch("/api/invoices/batch-book", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ invoiceIds: [...selectedSalesIds], bookkeepingStatus: "booked", category: bulkLedgerAccount }),
            });
            const data = await res.json();
            if (res.ok) {
              setBulkMessage(data.message);
              setInvoices((prev) => prev.map((inv) => selectedSalesIds.has(inv.id) ? { ...inv, bookkeepingStatus: "booked", category: bulkLedgerAccount } : inv));
              setSelectedSalesIds(new Set());
              setTimeout(() => setBulkMessage(""), 4000);
            }
          } catch { setBulkMessage("Er ging iets mis"); }
          finally { setBulkBookingLoading(false); }
        }

        // Facturatie: get clients with their customers and permission status
        const facturatieClients = clients.filter((c) => c.role === "client");
        const facturatieInvoices = facturatieClient ? invoices.filter((inv) => inv.clientId === facturatieClient) : [];

        // Revenue accounts for bulk booking
        const revenueAccounts = ledgerAccounts.filter((a) => a.accountType === "revenue" && a.isActive);

        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#3C2C1E]">Verkoop</h1>
                <p className="text-sm text-[#6F5C4B]/70 mt-1">Facturatie-ondersteuning en boekingsverwerking</p>
              </div>
            </div>

            {/* Sub-tab switcher */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
              <button onClick={() => setVerkoopTab("facturatie")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${verkoopTab === "facturatie" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Facturatie</button>
              <button onClick={() => setVerkoopTab("verwerken")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${verkoopTab === "verwerken" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Verwerken</button>
            </div>

            {/* ─── FACTURATIE TAB ─── */}
            {verkoopTab === "facturatie" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <select value={facturatieClient} onChange={(e) => setFacturatieClient(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none min-w-[200px]">
                    <option value="">Selecteer een klant...</option>
                    {facturatieClients.map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
                  </select>
                </div>

                {!facturatieClient && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p className="text-sm text-gray-500">Selecteer een klant om de facturatie-omgeving te openen.</p>
                    <p className="text-xs text-gray-400 mt-1">Je kunt facturen inzien en ondersteunen wanneer de klant toegang heeft verleend.</p>
                  </div>
                )}

                {facturatieClient && (
                  <div className="space-y-4">
                    {/* Permission notice */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-3">
                      <svg className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <div>
                        <p className="text-sm font-medium text-blue-800">Facturatie-inzage voor {facturatieClients.find((c) => c.id === facturatieClient)?.company || "klant"}</p>
                        <p className="text-xs text-blue-600 mt-0.5">Je bekijkt de facturen van deze klant. Wijzigingen worden direct op de originele factuurgegevens toegepast.</p>
                      </div>
                    </div>

                    {/* Summary cards */}
                    {(() => {
                      const openInvs = facturatieInvoices.filter((i) => i.status === "sent" || i.status === "overdue");
                      const overdueInvs = facturatieInvoices.filter((i) => i.status === "overdue");
                      const openAmount = openInvs.reduce((s, i) => s + i.total, 0);
                      const overdueAmount = overdueInvs.reduce((s, i) => s + i.total, 0);
                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <p className="text-xs text-gray-500">Totaal facturen</p>
                            <p className="text-lg font-bold text-[#004854]">{facturatieInvoices.length}</p>
                          </div>
                          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <p className="text-xs text-gray-500">Openstaand</p>
                            <p className="text-lg font-bold text-amber-600">{openInvs.length}</p>
                            <p className="text-xs text-gray-400">{formatCurrency(openAmount)}</p>
                          </div>
                          <div className="bg-amber-50 rounded-xl p-4 shadow-sm border border-amber-100">
                            <p className="text-xs text-amber-700">Verlopen</p>
                            <p className="text-lg font-bold text-red-600">{overdueInvs.length}</p>
                            <p className="text-xs text-red-500">{formatCurrency(overdueAmount)}</p>
                          </div>
                          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <p className="text-xs text-gray-500">Betaald</p>
                            <p className="text-lg font-bold text-emerald-600">{facturatieInvoices.filter((i) => i.status === "paid").length}</p>
                          </div>
                          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <p className="text-xs text-gray-500">Totale omzet</p>
                            <p className="text-lg font-bold text-[#004854]">{formatCurrency(facturatieInvoices.reduce((s, i) => s + i.subtotal, 0))}</p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Invoice list */}
                    <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                      <table className="w-full">
                        <thead><tr className="text-left text-[11px] text-gray-500 border-b border-gray-100 bg-gray-50">
                          <th className="px-4 py-2.5 font-medium">Factuurnr.</th><th className="px-3 py-2.5 font-medium">Debiteur</th>
                          <th className="px-3 py-2.5 font-medium">Datum</th><th className="px-3 py-2.5 font-medium">Vervaldatum</th>
                          <th className="px-3 py-2.5 font-medium">Status</th><th className="px-3 py-2.5 font-medium text-right">Bedrag</th>
                          <th className="px-3 py-2.5 font-medium text-center">Herinneringen</th>
                          <th className="px-3 py-2.5 font-medium text-right">Actie</th>
                        </tr></thead>
                        <tbody className="divide-y divide-gray-50">
                          {facturatieInvoices.map((inv) => {
                            const dueDate = new Date(inv.dueDate);
                            const daysOver = Math.floor((Date.now() - dueDate.getTime()) / 86400000);
                            const isOverdue = daysOver > 0 && (inv.status === "sent" || inv.status === "overdue");
                            return (
                              <tr key={inv.id} className={`hover:bg-gray-50 ${isOverdue ? "bg-red-50/30" : ""}`}>
                                <td className="px-4 py-3 font-medium text-sm">
                                  {inv.invoiceNumber}
                                  {inv.isCredit && <span className="ml-1 text-[10px] text-red-500">(credit)</span>}
                                </td>
                                <td className="px-3 py-3 text-sm text-gray-600">{inv.customerName}</td>
                                <td className="px-3 py-3 text-sm text-gray-600">{formatDate(inv.date)}</td>
                                <td className="px-3 py-3 text-sm">
                                  <span className={isOverdue ? "text-red-600 font-medium" : "text-gray-600"}>{formatDate(inv.dueDate)}</span>
                                  {isOverdue && <span className="block text-[10px] text-red-500">{daysOver}d over</span>}
                                </td>
                                <td className="px-3 py-3"><StatusBadge status={inv.status} /></td>
                                <td className="px-3 py-3 text-right font-semibold text-sm">{formatCurrency(inv.total)}</td>
                                <td className="px-3 py-3 text-center">
                                  {inv.remindersSent > 0 ? <span className="text-xs text-amber-600 font-medium">{inv.remindersSent}x</span> : <span className="text-xs text-gray-300">—</span>}
                                </td>
                                <td className="px-3 py-3 text-right">
                                  <Link href={`/bookkeeper/invoices/${inv.id}`} className="text-sm text-[#00AFCB] hover:text-[#004854] font-medium">Bekijken</Link>
                                </td>
                              </tr>
                            );
                          })}
                          {facturatieInvoices.length === 0 && <tr><td colSpan={8} className="px-5 py-12 text-center text-gray-400">Geen facturen voor deze klant.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    {/* Mobile cards */}
                    <div className="md:hidden space-y-3">
                      {facturatieInvoices.map((inv) => (
                        <Link key={inv.id} href={`/bookkeeper/invoices/${inv.id}`} className="block bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:border-[#00AFCB]/30">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[#004854]">{inv.invoiceNumber}</p>
                              <p className="text-sm text-gray-900 mt-0.5">{inv.customerName}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{formatDate(inv.date)} &middot; vervalt {formatDate(inv.dueDate)}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-semibold text-sm">{formatCurrency(inv.total)}</p>
                              <div className="mt-1"><StatusBadge status={inv.status} /></div>
                            </div>
                          </div>
                        </Link>
                      ))}
                      {facturatieInvoices.length === 0 && <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-12 text-center text-gray-400">Geen facturen voor deze klant.</div>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── VERWERKEN TAB ─── */}
            {verkoopTab === "verwerken" && (
              <div className="space-y-4">
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

                {/* Bulk action bar */}
                {selectedSalesIds.size > 0 && (
                  <div className="bg-[#004854] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <span className="text-sm text-white font-medium">{selectedSalesIds.size} facturen geselecteerd</span>
                    <div className="flex flex-wrap gap-2 items-center sm:ml-auto">
                      <select value={bulkLedgerAccount} onChange={(e) => setBulkLedgerAccount(e.target.value)}
                        className="border border-white/20 bg-white/10 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none min-w-[180px]">
                        <option value="">Selecteer rekening...</option>
                        {revenueAccounts.map((a) => <option key={a.id} value={`${a.accountNumber} ${a.name}`}>{a.accountNumber} - {a.name}</option>)}
                      </select>
                      <button onClick={handleBulkBook} disabled={bulkBookingLoading || !bulkLedgerAccount}
                        className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors">
                        {bulkBookingLoading ? "Verwerken..." : "Bulk boeken"}
                      </button>
                      <button onClick={() => setSelectedSalesIds(new Set())} className="px-3 py-2 text-white/70 hover:text-white text-sm">Deselecteren</button>
                    </div>
                  </div>
                )}
                {bulkMessage && <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm text-emerald-700">{bulkMessage}</div>}

                {/* Desktop table with checkboxes */}
                <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-500 border-b border-gray-100 bg-gray-50">
                        <th className="px-3 py-3 w-10"><input type="checkbox" checked={allSelected} onChange={toggleAllSales} className="rounded border-gray-300" /></th>
                        <th className="px-3 py-3 font-medium">Factuurnr.</th>
                        <th className="px-3 py-3 font-medium">Klant</th>
                        <th className="px-3 py-3 font-medium">Debiteur</th>
                        <th className="px-3 py-3 font-medium">Datum</th>
                        <th className="px-3 py-3 font-medium text-right">Excl. BTW</th>
                        <th className="px-3 py-3 font-medium text-right">BTW</th>
                        <th className="px-3 py-3 font-medium text-right">Incl. BTW</th>
                        <th className="px-3 py-3 font-medium">Status</th>
                        <th className="px-3 py-3 font-medium text-right">Actie</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {verwerkenFiltered.map((inv) => {
                        const isSelected = selectedSalesIds.has(inv.id);
                        const canSelect = inv.bookkeepingStatus === "pending" || inv.bookkeepingStatus === "to_book" || inv.bookkeepingStatus === "processing";
                        return (
                          <tr key={inv.id} className={`hover:bg-gray-50 ${isSelected ? "bg-[#00AFCB]/5" : ""}`}>
                            <td className="px-3 py-3"><input type="checkbox" checked={isSelected} disabled={!canSelect} onChange={() => toggleSalesSelect(inv.id)} className="rounded border-gray-300 disabled:opacity-30" /></td>
                            <td className="px-3 py-3 font-medium text-sm">{inv.invoiceNumber}</td>
                            <td className="px-3 py-3 text-sm text-gray-600">{getClientName(inv.clientId)}</td>
                            <td className="px-3 py-3 text-sm text-gray-600">{inv.customerName}</td>
                            <td className="px-3 py-3 text-sm text-gray-600">{formatDate(inv.date)}</td>
                            <td className="px-3 py-3 text-sm text-right">{formatCurrency(inv.subtotal)}</td>
                            <td className="px-3 py-3 text-sm text-right text-gray-500">{formatCurrency(inv.vatAmount)}</td>
                            <td className="px-3 py-3 text-sm text-right font-semibold">{formatCurrency(inv.total)}</td>
                            <td className="px-3 py-3"><StatusBadge status={inv.bookkeepingStatus} /></td>
                            <td className="px-3 py-3 text-right">
                              <div className="flex gap-2 justify-end">
                                {canSelect && (
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
                        );
                      })}
                      {verwerkenFiltered.length === 0 && <tr><td colSpan={10} className="px-5 py-12 text-center text-gray-400">Geen facturen gevonden.</td></tr>}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards with checkboxes */}
                <div className="md:hidden space-y-3">
                  {verwerkenFiltered.map((inv) => {
                    const isSelected = selectedSalesIds.has(inv.id);
                    const canSelect = inv.bookkeepingStatus === "pending" || inv.bookkeepingStatus === "to_book" || inv.bookkeepingStatus === "processing";
                    return (
                      <div key={inv.id} className={`bg-white rounded-xl shadow-sm border p-4 ${isSelected ? "border-[#00AFCB] bg-[#00AFCB]/5" : "border-gray-100"}`}>
                        <div className="flex items-start gap-3">
                          <input type="checkbox" checked={isSelected} disabled={!canSelect} onChange={() => toggleSalesSelect(inv.id)} className="mt-1 rounded border-gray-300 disabled:opacity-30" />
                          <Link href={`/bookkeeper/invoices/${inv.id}`} className="block flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-[#004854]">{inv.invoiceNumber}</p>
                                <p className="text-sm text-gray-900 mt-0.5">{inv.customerName}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{getClientName(inv.clientId)} &middot; {formatDate(inv.date)}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-semibold text-sm">{formatCurrency(inv.total)}</p>
                                <p className="text-xs text-gray-500">{formatCurrency(inv.subtotal)} + {formatCurrency(inv.vatAmount)}</p>
                                <div className="mt-1"><StatusBadge status={inv.bookkeepingStatus} /></div>
                              </div>
                            </div>
                          </Link>
                        </div>
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 ml-7">
                          {canSelect && (
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
                        </div>
                      </div>
                    );
                  })}
                  {verwerkenFiltered.length === 0 && <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-12 text-center text-gray-400">Geen facturen gevonden.</div>}
                </div>
              </div>
            )}
          </div>
        );
      })()}

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
                      <div key={msg.id} className={`flex ${msg.senderRole !== "client" ? "justify-end" : "justify-start"} group`}>
                        <div className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 ${msg.senderRole !== "client" ? "bg-[#004854] text-white rounded-br-md" : "bg-gray-100 text-gray-900 rounded-bl-md"}`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                          <div className={`flex items-center gap-2 mt-1 ${msg.senderRole !== "client" ? "text-white/50" : "text-gray-400"}`}>
                            <p className="text-[10px]">
                              {msg.sender.name} &middot; {new Date(msg.createdAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                            {msg.senderRole === "client" && (
                              <button onClick={() => startMsgToTask({ id: msg.id, text: msg.text })}
                                className="text-[10px] text-[#00AFCB] hover:text-[#004854] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                Maak taak
                              </button>
                            )}
                          </div>
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

          {/* Message-to-task modal */}
          {msgToTaskMessage && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setMsgToTaskMessage(null)}>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 sm:p-6 border-b border-gray-100">
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="text-lg font-semibold">Taak maken van bericht</h2>
                    <button onClick={() => setMsgToTaskMessage(null)} className="text-gray-400 hover:text-gray-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 border border-gray-100">
                    <p className="text-[10px] text-gray-400 font-medium mb-1">Bronbericht</p>
                    <p className="line-clamp-3">{msgToTaskMessage.text}</p>
                  </div>
                </div>
                <div className="p-4 sm:p-6 space-y-4">
                  {msgToTaskAiLoading && (
                    <div className="flex items-center gap-2 text-sm text-[#00AFCB]">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      AI genereert taaksamenvatting...
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Taaktitel *</label>
                    <input type="text" value={msgToTaskForm.title} onChange={(e) => setMsgToTaskForm({ ...msgToTaskForm, title: e.target.value })}
                      placeholder="Bijv. Controleer BTW-verschil"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#00AFCB]/30" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Omschrijving</label>
                    <textarea value={msgToTaskForm.description} onChange={(e) => setMsgToTaskForm({ ...msgToTaskForm, description: e.target.value })} rows={2}
                      placeholder="Korte toelichting..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#00AFCB]/30" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
                      <input type="date" value={msgToTaskForm.date} onChange={(e) => setMsgToTaskForm({ ...msgToTaskForm, date: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#00AFCB]/30" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tijd (optioneel)</label>
                      <input type="time" value={msgToTaskForm.time} onChange={(e) => setMsgToTaskForm({ ...msgToTaskForm, time: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#00AFCB]/30" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Toewijzen aan</label>
                    <div className="flex gap-2">
                      <button onClick={() => setMsgToTaskForm({ ...msgToTaskForm, assignedTo: "customer" })}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${msgToTaskForm.assignedTo === "customer" ? "bg-[#004854] text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                        Klant
                      </button>
                      <button onClick={() => setMsgToTaskForm({ ...msgToTaskForm, assignedTo: "accountant" })}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${msgToTaskForm.assignedTo === "accountant" ? "bg-[#004854] text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                        Boekhouder
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {msgToTaskForm.assignedTo === "customer" ? "Taak verschijnt in de planning van de klant" : "Taak blijft in uw eigen takenoverzicht"}
                    </p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setMsgToTaskMessage(null)} className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Annuleren</button>
                    <button onClick={saveMsgToTask} disabled={msgToTaskLoading || !msgToTaskForm.title.trim()}
                      className="px-5 py-2.5 bg-[#004854] text-white rounded-xl text-sm font-medium hover:bg-[#003640] disabled:opacity-50">
                      {msgToTaskLoading ? "Aanmaken..." : "Taak aanmaken"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
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

      {/* ═══ GROOTBOEK ═══ */}
      {section === "grootboek" && (() => {
        const accountTypeLabels: Record<string, string> = { asset: "Actief", liability: "Passief", equity: "Eigen vermogen", revenue: "Opbrengst", expense: "Kosten", contra: "Contra" };
        const accountTypeColors: Record<string, string> = { asset: "bg-blue-100 text-blue-700", liability: "bg-purple-100 text-purple-700", equity: "bg-indigo-100 text-indigo-700", revenue: "bg-green-100 text-green-700", expense: "bg-red-100 text-red-700", contra: "bg-gray-100 text-gray-600" };
        const rubricLabels: Record<string, string> = { "1a": "1a - Leveringen/diensten hoog tarief", "1b": "1b - Leveringen/diensten laag tarief", "1c": "1c - Leveringen/diensten overige tarieven", "1d": "1d - Privégebruik", "2a": "2a - Verlegd / nultarief", "3a": "3a - Leveringen buiten EU", "3b": "3b - Leveringen binnen EU (ICP)", "4a": "4a - Verwerving buiten EU", "4b": "4b - Verwerving binnen EU", "5a": "5a - Verschuldigde omzetbelasting", "5b": "5b - Voorbelasting" };

        const filteredAccounts = ledgerAccounts.filter((a) => {
          if (!showInactive && !a.isActive) return false;
          if (ledgerSearch) {
            const s = ledgerSearch.toLowerCase();
            return a.accountNumber.includes(s) || a.name.toLowerCase().includes(s);
          }
          return true;
        });

        const grouped = filteredAccounts.reduce<Record<string, LedgerAccountData[]>>((acc, a) => {
          const key = a.category;
          if (!acc[key]) acc[key] = [];
          acc[key].push(a);
          return acc;
        }, {});

        const categoryOrder = Object.keys(grouped).sort((a, b) => {
          const aMin = Math.min(...grouped[a].map((x) => x.sortOrder));
          const bMin = Math.min(...grouped[b].map((x) => x.sortOrder));
          return aMin - bMin;
        });

        const isAllExpanded = expandedCategories.has("all");
        function toggleCategory(cat: string) {
          setExpandedCategories((prev) => {
            const n = new Set(prev);
            if (n.has("all")) { n.delete("all"); categoryOrder.forEach((c) => { if (c !== cat) n.add(c); }); }
            else if (n.has(cat)) n.delete(cat);
            else n.add(cat);
            return n;
          });
        }
        function isCatExpanded(cat: string) { return isAllExpanded || expandedCategories.has(cat); }

        function openAccountAdd() {
          setEditingAccount(null);
          setAccountForm({ accountNumber: "", name: "", description: "", accountType: "expense", category: "", statementSection: "", normalBalance: "debit", isBalanceSheet: false, vatCodeId: "" });
          setShowAccountModal(true);
        }
        function openAccountEdit(a: LedgerAccountData) {
          setEditingAccount(a);
          setAccountForm({ accountNumber: a.accountNumber, name: a.name, description: a.description || "", accountType: a.accountType, category: a.category, statementSection: a.statementSection || "", normalBalance: a.normalBalance, isBalanceSheet: a.isBalanceSheet, vatCodeId: a.vatCodeId || "" });
          setShowAccountModal(true);
        }
        async function saveAccount() {
          setAccountSaving(true);
          try {
            const payload = { ...accountForm, vatCodeId: accountForm.vatCodeId || null, sortOrder: parseInt(accountForm.accountNumber, 10) || 0 };
            const res = editingAccount
              ? await fetch(`/api/ledger-accounts/${editingAccount.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
              : await fetch("/api/ledger-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            if (res.ok) {
              const refreshed = await fetch("/api/ledger-accounts").then((r) => r.json());
              setLedgerAccounts(refreshed);
              setShowAccountModal(false);
            }
          } catch { /* */ }
          finally { setAccountSaving(false); }
        }
        async function toggleAccountActive(a: LedgerAccountData) {
          const res = await fetch(`/api/ledger-accounts/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !a.isActive }) });
          if (res.ok) setLedgerAccounts((prev) => prev.map((x) => x.id === a.id ? { ...x, isActive: !x.isActive } : x));
        }
        async function deleteAccount(a: LedgerAccountData) {
          if (a.isSystem) return;
          const res = await fetch(`/api/ledger-accounts/${a.id}`, { method: "DELETE" });
          if (res.ok) setLedgerAccounts((prev) => prev.filter((x) => x.id !== a.id));
        }

        function openVatAdd() {
          setEditingVat(null);
          setVatForm({ code: "", name: "", description: "", percentage: "21", type: "sales", rubricCode: "", ledgerAccountId: "" });
          setShowVatModal(true);
        }
        function openVatEdit(v: VatCodeData) {
          setEditingVat(v);
          setVatForm({ code: v.code, name: v.name, description: v.description || "", percentage: String(v.percentage), type: v.type, rubricCode: v.rubricCode || "", ledgerAccountId: v.ledgerAccountId || "" });
          setShowVatModal(true);
        }
        async function saveVat() {
          setVatSaving(true);
          try {
            const payload = { ...vatForm, ledgerAccountId: vatForm.ledgerAccountId || null, rubricCode: vatForm.rubricCode || null };
            const res = editingVat
              ? await fetch(`/api/vat-codes/${editingVat.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
              : await fetch("/api/vat-codes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            if (res.ok) {
              const refreshed = await fetch("/api/vat-codes").then((r) => r.json());
              setVatCodes(refreshed);
              setShowVatModal(false);
            }
          } catch { /* */ }
          finally { setVatSaving(false); }
        }
        async function toggleVatActive(v: VatCodeData) {
          const res = await fetch(`/api/vat-codes/${v.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !v.isActive }) });
          if (res.ok) setVatCodes((prev) => prev.map((x) => x.id === v.id ? { ...x, isActive: !x.isActive } : x));
        }

        // Statement helpers
        const bsAccounts = ledgerAccounts.filter((a) => a.isBalanceSheet && a.isActive);
        const plAccounts = ledgerAccounts.filter((a) => !a.isBalanceSheet && a.isActive);
        function groupBySection(accs: LedgerAccountData[]) {
          return accs.reduce<Record<string, LedgerAccountData[]>>((acc, a) => {
            const key = a.statementSection || a.category;
            if (!acc[key]) acc[key] = [];
            acc[key].push(a);
            return acc;
          }, {});
        }

        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#3C2C1E]">Grootboek</h1>
                <p className="text-sm text-[#6F5C4B]/70 mt-1">Rekeningschema, BTW-codes en jaarrekening-structuur</p>
              </div>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
              {[
                { key: "accounts" as const, label: "Rekeningschema" },
                { key: "btw" as const, label: "BTW-codes" },
                { key: "statements" as const, label: "Jaarrekening" },
              ].map((t) => (
                <button key={t.key} onClick={() => setGrootboekTab(t.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${grootboekTab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ─── Tab 1: Rekeningschema ─── */}
            {grootboekTab === "accounts" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      <input type="text" placeholder="Zoek op nummer of naam..." value={ledgerSearch} onChange={(e) => setLedgerSearch(e.target.value)}
                        className="pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#00AFCB]/30 focus:border-[#00AFCB]" />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
                      <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded border-gray-300" />
                      Toon inactief
                    </label>
                  </div>
                  <button onClick={openAccountAdd} className="px-4 py-2 bg-[#00AFCB] text-white rounded-lg text-sm font-medium hover:bg-[#008FA8] transition-colors flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Nieuwe rekening
                  </button>
                </div>

                <div className="text-xs text-gray-400">{filteredAccounts.length} rekeningen{!showInactive && ` (actief)`}</div>

                <div className="space-y-2">
                  {categoryOrder.map((cat) => {
                    const accounts = grouped[cat];
                    const expanded = isCatExpanded(cat);
                    const range = accounts[0]?.accountNumber.slice(0, 1) + "xxx";
                    return (
                      <div key={cat} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <button onClick={() => toggleCategory(cat)}
                          className="w-full flex items-center justify-between px-5 py-3 bg-gray-50/80 hover:bg-gray-50 transition-colors text-left">
                          <div className="flex items-center gap-3">
                            <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            <span className="text-xs font-mono text-gray-400">{range}</span>
                            <span className="text-sm font-semibold text-[#3C2C1E]">{cat}</span>
                          </div>
                          <span className="text-xs text-gray-400">{accounts.length} rekeningen</span>
                        </button>
                        {expanded && (
                          <div className="divide-y divide-gray-50">
                            {accounts.map((a) => (
                              <div key={a.id} onClick={() => openAccountEdit(a)}
                                className={`flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-gray-50/50 transition-colors ${!a.isActive ? "opacity-50" : ""}`}>
                                <span className="text-sm font-mono font-medium text-[#004854] w-14 shrink-0">{a.accountNumber}</span>
                                <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{a.name}</span>
                                <span className={`hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${accountTypeColors[a.accountType] || "bg-gray-100"}`}>{accountTypeLabels[a.accountType] || a.accountType}</span>
                                <span className="hidden md:inline-block text-[10px] text-gray-400 w-12 text-center">{a.normalBalance === "debit" ? "D" : "C"}</span>
                                {!a.isActive && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">Inactief</span>}
                                {a.isSystem && <span className="hidden lg:inline-block text-[10px] text-gray-300">systeem</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {categoryOrder.length === 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400 text-sm">
                      Geen rekeningen gevonden
                    </div>
                  )}
                </div>

                {/* Account modal */}
                {showAccountModal && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAccountModal(false)}>
                    <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="text-base font-semibold text-[#3C2C1E]">{editingAccount ? "Rekening bewerken" : "Nieuwe rekening"}</h3>
                        <button onClick={() => setShowAccountModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                      </div>
                      <div className="p-6 space-y-4">
                        {editingAccount?.isSystem && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs text-amber-700">Dit is een systeemrekening. Rekeningnummer en type kunnen niet worden gewijzigd.</div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Rekeningnummer</label>
                            <input type="text" maxLength={4} value={accountForm.accountNumber} onChange={(e) => setAccountForm((p) => ({ ...p, accountNumber: e.target.value.replace(/\D/g, "").slice(0, 4) }))} disabled={editingAccount?.isSystem}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#00AFCB]/30 disabled:bg-gray-50 disabled:text-gray-400" placeholder="0000" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                            <select value={accountForm.accountType} onChange={(e) => setAccountForm((p) => ({ ...p, accountType: e.target.value }))} disabled={editingAccount?.isSystem}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00AFCB]/30 disabled:bg-gray-50">
                              <option value="asset">Actief</option><option value="liability">Passief</option><option value="equity">Eigen vermogen</option>
                              <option value="revenue">Opbrengst</option><option value="expense">Kosten</option><option value="contra">Contra</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Naam</label>
                          <input type="text" value={accountForm.name} onChange={(e) => setAccountForm((p) => ({ ...p, name: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00AFCB]/30" placeholder="Naam rekening" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Omschrijving</label>
                          <input type="text" value={accountForm.description} onChange={(e) => setAccountForm((p) => ({ ...p, description: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00AFCB]/30" placeholder="Optionele omschrijving" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Categorie</label>
                            <input type="text" value={accountForm.category} onChange={(e) => setAccountForm((p) => ({ ...p, category: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00AFCB]/30" placeholder="Bijv. Huisvestingskosten" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Jaarrekeningsectie</label>
                            <input type="text" value={accountForm.statementSection} onChange={(e) => setAccountForm((p) => ({ ...p, statementSection: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00AFCB]/30" placeholder="Bijv. Bedrijfskosten" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Normaalstand</label>
                            <select value={accountForm.normalBalance} onChange={(e) => setAccountForm((p) => ({ ...p, normalBalance: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00AFCB]/30">
                              <option value="debit">Debet</option><option value="credit">Credit</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Standaard BTW-code</label>
                            <select value={accountForm.vatCodeId} onChange={(e) => setAccountForm((p) => ({ ...p, vatCodeId: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00AFCB]/30">
                              <option value="">Geen</option>
                              {vatCodes.filter((v) => v.isActive).map((v) => <option key={v.id} value={v.id}>{v.code} - {v.name} ({v.percentage}%)</option>)}
                            </select>
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                          <input type="checkbox" checked={accountForm.isBalanceSheet} onChange={(e) => setAccountForm((p) => ({ ...p, isBalanceSheet: e.target.checked }))} className="rounded border-gray-300" />
                          Balansrekening
                        </label>
                      </div>
                      <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                        <div>
                          {editingAccount && !editingAccount.isSystem && (
                            <button onClick={() => { deleteAccount(editingAccount); setShowAccountModal(false); }} className="text-xs text-red-500 hover:text-red-700">Verwijderen</button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {editingAccount && (
                            <button onClick={() => { toggleAccountActive(editingAccount); setShowAccountModal(false); }}
                              className="px-3 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50 transition-colors">
                              {editingAccount.isActive ? "Deactiveren" : "Activeren"}
                            </button>
                          )}
                          <button onClick={() => setShowAccountModal(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50 transition-colors">Annuleren</button>
                          <button onClick={saveAccount} disabled={accountSaving || !accountForm.accountNumber || !accountForm.name || !accountForm.category}
                            className="px-4 py-2 bg-[#00AFCB] text-white rounded-lg text-sm font-medium hover:bg-[#008FA8] transition-colors disabled:opacity-50">
                            {accountSaving ? "Opslaan..." : "Opslaan"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── Tab 2: BTW-codes ─── */}
            {grootboekTab === "btw" && (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <button onClick={openVatAdd} className="px-4 py-2 bg-[#00AFCB] text-white rounded-lg text-sm font-medium hover:bg-[#008FA8] transition-colors flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Nieuwe BTW-code
                  </button>
                </div>

                {/* Sales VAT codes */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 bg-gray-50/80 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-[#3C2C1E]">Verkoop BTW-codes</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead><tr className="text-left text-[11px] text-gray-500 border-b border-gray-100">
                        <th className="px-5 py-2.5 font-medium">Code</th><th className="px-3 py-2.5 font-medium">Naam</th>
                        <th className="px-3 py-2.5 font-medium text-right">Tarief</th><th className="px-3 py-2.5 font-medium hidden sm:table-cell">Rubriek</th>
                        <th className="px-3 py-2.5 font-medium hidden md:table-cell">Grootboekrekening</th><th className="px-3 py-2.5 font-medium">Status</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {vatCodes.filter((v) => v.type === "sales").map((v) => (
                          <tr key={v.id} onClick={() => openVatEdit(v)} className={`cursor-pointer hover:bg-gray-50/50 transition-colors ${!v.isActive ? "opacity-50" : ""}`}>
                            <td className="px-5 py-3 text-sm font-mono font-medium text-[#004854]">{v.code}</td>
                            <td className="px-3 py-3 text-sm text-gray-700">{v.name}</td>
                            <td className="px-3 py-3 text-sm text-right font-medium">{v.percentage}%</td>
                            <td className="px-3 py-3 text-xs text-gray-500 hidden sm:table-cell">{v.rubricCode ? rubricLabels[v.rubricCode] || v.rubricCode : "—"}</td>
                            <td className="px-3 py-3 text-xs text-gray-500 hidden md:table-cell">{v.ledgerAccount ? `${v.ledgerAccount.accountNumber} ${v.ledgerAccount.name}` : "—"}</td>
                            <td className="px-3 py-3">{v.isActive ? <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">Actief</span> : <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">Inactief</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Purchase VAT codes */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 bg-gray-50/80 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-[#3C2C1E]">Inkoop BTW-codes</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead><tr className="text-left text-[11px] text-gray-500 border-b border-gray-100">
                        <th className="px-5 py-2.5 font-medium">Code</th><th className="px-3 py-2.5 font-medium">Naam</th>
                        <th className="px-3 py-2.5 font-medium text-right">Tarief</th><th className="px-3 py-2.5 font-medium hidden sm:table-cell">Rubriek</th>
                        <th className="px-3 py-2.5 font-medium hidden md:table-cell">Grootboekrekening</th><th className="px-3 py-2.5 font-medium">Status</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {vatCodes.filter((v) => v.type === "purchase").map((v) => (
                          <tr key={v.id} onClick={() => openVatEdit(v)} className={`cursor-pointer hover:bg-gray-50/50 transition-colors ${!v.isActive ? "opacity-50" : ""}`}>
                            <td className="px-5 py-3 text-sm font-mono font-medium text-[#004854]">{v.code}</td>
                            <td className="px-3 py-3 text-sm text-gray-700">{v.name}</td>
                            <td className="px-3 py-3 text-sm text-right font-medium">{v.percentage}%</td>
                            <td className="px-3 py-3 text-xs text-gray-500 hidden sm:table-cell">{v.rubricCode ? rubricLabels[v.rubricCode] || v.rubricCode : "—"}</td>
                            <td className="px-3 py-3 text-xs text-gray-500 hidden md:table-cell">{v.ledgerAccount ? `${v.ledgerAccount.accountNumber} ${v.ledgerAccount.name}` : "—"}</td>
                            <td className="px-3 py-3">{v.isActive ? <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">Actief</span> : <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">Inactief</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* BTW Rubrieken overzicht */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 bg-gray-50/80 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-[#3C2C1E]">BTW-aangifte rubrieken</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Mapping van BTW-codes naar rubrieken in de BTW-aangifte</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {Object.entries(rubricLabels).map(([code, label]) => {
                      const linked = vatCodes.filter((v) => v.rubricCode === code && v.isActive);
                      return (
                        <div key={code} className="flex items-center gap-4 px-5 py-3">
                          <span className="text-sm font-mono font-medium text-[#004854] w-8">{code}</span>
                          <span className="text-sm text-gray-600 flex-1">{label.split(" - ")[1]}</span>
                          <div className="flex flex-wrap gap-1">
                            {linked.length > 0 ? linked.map((v) => (
                              <span key={v.id} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#00AFCB]/10 text-[#004854]">{v.code}</span>
                            )) : <span className="text-xs text-gray-300">—</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* VAT code modal */}
                {showVatModal && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowVatModal(false)}>
                    <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="text-base font-semibold text-[#3C2C1E]">{editingVat ? "BTW-code bewerken" : "Nieuwe BTW-code"}</h3>
                        <button onClick={() => setShowVatModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                      </div>
                      <div className="p-6 space-y-4">
                        {editingVat?.isSystem && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs text-amber-700">Dit is een systeem BTW-code. Code en type kunnen niet worden gewijzigd.</div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Code</label>
                            <input type="text" value={vatForm.code} onChange={(e) => setVatForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} disabled={editingVat?.isSystem}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#00AFCB]/30 disabled:bg-gray-50" placeholder="VH21" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                            <select value={vatForm.type} onChange={(e) => setVatForm((p) => ({ ...p, type: e.target.value }))} disabled={editingVat?.isSystem}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00AFCB]/30 disabled:bg-gray-50">
                              <option value="sales">Verkoop</option><option value="purchase">Inkoop</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Naam</label>
                          <input type="text" value={vatForm.name} onChange={(e) => setVatForm((p) => ({ ...p, name: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00AFCB]/30" placeholder="BTW verkoop hoog tarief" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Omschrijving</label>
                          <input type="text" value={vatForm.description} onChange={(e) => setVatForm((p) => ({ ...p, description: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00AFCB]/30" placeholder="Optioneel" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Tarief (%)</label>
                            <input type="number" step="0.1" min="0" max="100" value={vatForm.percentage} onChange={(e) => setVatForm((p) => ({ ...p, percentage: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00AFCB]/30" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">BTW-aangifte rubriek</label>
                            <select value={vatForm.rubricCode} onChange={(e) => setVatForm((p) => ({ ...p, rubricCode: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00AFCB]/30">
                              <option value="">Geen</option>
                              {Object.entries(rubricLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Grootboekrekening (BTW-boeking)</label>
                          <select value={vatForm.ledgerAccountId} onChange={(e) => setVatForm((p) => ({ ...p, ledgerAccountId: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00AFCB]/30">
                            <option value="">Geen</option>
                            {ledgerAccounts.filter((a) => a.isActive).map((a) => <option key={a.id} value={a.id}>{a.accountNumber} - {a.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                        <div>
                          {editingVat && !editingVat.isSystem && (
                            <button onClick={async () => {
                              const res = await fetch(`/api/vat-codes/${editingVat.id}`, { method: "DELETE" });
                              if (res.ok) { setVatCodes((prev) => prev.filter((x) => x.id !== editingVat.id)); setShowVatModal(false); }
                            }} className="text-xs text-red-500 hover:text-red-700">Verwijderen</button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {editingVat && (
                            <button onClick={() => { toggleVatActive(editingVat); setShowVatModal(false); }}
                              className="px-3 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50 transition-colors">
                              {editingVat.isActive ? "Deactiveren" : "Activeren"}
                            </button>
                          )}
                          <button onClick={() => setShowVatModal(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50 transition-colors">Annuleren</button>
                          <button onClick={saveVat} disabled={vatSaving || !vatForm.code || !vatForm.name}
                            className="px-4 py-2 bg-[#00AFCB] text-white rounded-lg text-sm font-medium hover:bg-[#008FA8] transition-colors disabled:opacity-50">
                            {vatSaving ? "Opslaan..." : "Opslaan"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── Tab 3: Jaarrekening ─── */}
            {grootboekTab === "statements" && (
              <div className="space-y-4">
                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                  <button onClick={() => setStatementView("balans")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${statementView === "balans" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Balans</button>
                  <button onClick={() => setStatementView("wv")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${statementView === "wv" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Winst & Verlies</button>
                </div>

                {statementView === "balans" && (() => {
                  const activa = bsAccounts.filter((a) => a.accountType === "asset" || a.accountType === "contra" && a.isBalanceSheet && parseInt(a.accountNumber) < 3000);
                  const passiva = bsAccounts.filter((a) => a.accountType === "liability" || a.accountType === "equity" || (parseInt(a.accountNumber) >= 3000 && a.accountType !== "asset"));
                  const activaGrouped = groupBySection(activa);
                  const passivaGrouped = groupBySection(passiva);
                  const sectionOrder = (g: Record<string, LedgerAccountData[]>) => Object.keys(g).sort((a, b) => {
                    const aMin = Math.min(...g[a].map((x) => x.sortOrder));
                    const bMin = Math.min(...g[b].map((x) => x.sortOrder));
                    return aMin - bMin;
                  });

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-5 py-3 bg-blue-50/50 border-b border-blue-100">
                          <h3 className="text-sm font-semibold text-blue-800">Activa</h3>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {sectionOrder(activaGrouped).map((sec) => (
                            <div key={sec}>
                              <div className="px-5 py-2 bg-gray-50/50"><span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{sec}</span></div>
                              {activaGrouped[sec].sort((a, b) => a.sortOrder - b.sortOrder).map((a) => (
                                <div key={a.id} className="flex items-center gap-3 px-5 py-2">
                                  <span className="text-xs font-mono text-gray-400 w-10">{a.accountNumber}</span>
                                  <span className="text-sm text-gray-700 flex-1">{a.name}</span>
                                  <span className="text-[10px] text-gray-400">{a.normalBalance === "debit" ? "D" : "C"}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-5 py-3 bg-purple-50/50 border-b border-purple-100">
                          <h3 className="text-sm font-semibold text-purple-800">Passiva</h3>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {sectionOrder(passivaGrouped).map((sec) => (
                            <div key={sec}>
                              <div className="px-5 py-2 bg-gray-50/50"><span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{sec}</span></div>
                              {passivaGrouped[sec].sort((a, b) => a.sortOrder - b.sortOrder).map((a) => (
                                <div key={a.id} className="flex items-center gap-3 px-5 py-2">
                                  <span className="text-xs font-mono text-gray-400 w-10">{a.accountNumber}</span>
                                  <span className="text-sm text-gray-700 flex-1">{a.name}</span>
                                  <span className="text-[10px] text-gray-400">{a.normalBalance === "debit" ? "D" : "C"}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {statementView === "wv" && (() => {
                  const revenueAccs = plAccounts.filter((a) => a.statementSection === "Netto-omzet");
                  const cogsAccs = plAccounts.filter((a) => a.statementSection === "Kostprijs omzet");
                  const opexAccs = plAccounts.filter((a) => a.statementSection === "Bedrijfskosten");
                  const deprAccs = plAccounts.filter((a) => a.statementSection === "Afschrijvingen");
                  const personnelAccs = plAccounts.filter((a) => a.statementSection === "Personeelskosten");
                  const finAccs = plAccounts.filter((a) => a.statementSection === "Financiele baten en lasten" || a.statementSection === "Buitengewone baten en lasten");

                  function StatementBlock({ title, accounts: accs, color }: { title: string; accounts: LedgerAccountData[]; color: string }) {
                    if (accs.length === 0) return null;
                    return (
                      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className={`px-5 py-3 border-b ${color}`}>
                          <h3 className="text-sm font-semibold">{title}</h3>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {accs.sort((a, b) => a.sortOrder - b.sortOrder).map((a) => (
                            <div key={a.id} className="flex items-center gap-3 px-5 py-2">
                              <span className="text-xs font-mono text-gray-400 w-10">{a.accountNumber}</span>
                              <span className="text-sm text-gray-700 flex-1">{a.name}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${accountTypeColors[a.accountType] || "bg-gray-100"}`}>{accountTypeLabels[a.accountType]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      <StatementBlock title="Netto-omzet" accounts={revenueAccs} color="bg-green-50/50 border-green-100 text-green-800" />
                      <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Af: Kostprijs omzet</div>
                      <StatementBlock title="Kostprijs omzet" accounts={cogsAccs} color="bg-orange-50/50 border-orange-100 text-orange-800" />
                      <div className="bg-gray-50 rounded-lg px-5 py-3 flex justify-between items-center">
                        <span className="text-sm font-semibold text-[#3C2C1E]">= Bruto marge</span>
                        <span className="text-xs text-gray-400">Omzet - Kostprijs</span>
                      </div>
                      <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Af: Bedrijfskosten</div>
                      <StatementBlock title="Bedrijfskosten" accounts={opexAccs} color="bg-red-50/50 border-red-100 text-red-800" />
                      <StatementBlock title="Afschrijvingen" accounts={deprAccs} color="bg-amber-50/50 border-amber-100 text-amber-800" />
                      <StatementBlock title="Personeelskosten" accounts={personnelAccs} color="bg-blue-50/50 border-blue-100 text-blue-800" />
                      <div className="bg-gray-50 rounded-lg px-5 py-3 flex justify-between items-center">
                        <span className="text-sm font-semibold text-[#3C2C1E]">= Bedrijfsresultaat</span>
                        <span className="text-xs text-gray-400">Bruto marge - Kosten</span>
                      </div>
                      <StatementBlock title="Financiele baten en lasten" accounts={finAccs} color="bg-indigo-50/50 border-indigo-100 text-indigo-800" />
                      <div className="bg-[#004854] rounded-lg px-5 py-4 flex justify-between items-center">
                        <span className="text-sm font-bold text-white">= Resultaat voor belasting</span>
                        <span className="text-xs text-white/60">Bedrijfsresultaat +/- Financieel</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })()}

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
        <div className="space-y-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#3C2C1E]">Instellingen</h1>
            <p className="text-sm text-[#6F5C4B]/70 mt-1">Configureer het boekhoudportaal.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/bookkeeper?section=grootboek" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6 hover:border-[#00AFCB]/30 hover:shadow-md transition-all group">
              <h3 className="text-base font-semibold text-[#3C2C1E] mb-1 group-hover:text-[#004854]">Grootboekrekeningen</h3>
              <p className="text-sm text-gray-500 mb-3">Rekeningschema en grootboekrekeningen beheren.</p>
              <span className="text-xs font-medium text-[#00AFCB]">Ga naar Grootboek &rarr;</span>
            </Link>
            <Link href="/bookkeeper?section=grootboek" onClick={() => setGrootboekTab("btw")} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6 hover:border-[#00AFCB]/30 hover:shadow-md transition-all group">
              <h3 className="text-base font-semibold text-[#3C2C1E] mb-1 group-hover:text-[#004854]">BTW-codes</h3>
              <p className="text-sm text-gray-500 mb-3">BTW-codes en tarieven configureren.</p>
              <span className="text-xs font-medium text-[#00AFCB]">Ga naar BTW-codes &rarr;</span>
            </Link>
            {[
              { title: "Klantinstellingen", description: "Standaardinstellingen per klant configureren." },
              { title: "Boekingsregels", description: "Automatische boekingsregels en sjablonen beheren." },
              { title: "Bankkoppelingen", description: "Bankverbindingen en importinstellingen." },
              { title: "AI-instellingen", description: "Configureer AI-suggesties en automatische herkenning." },
            ].map((s, i) => (
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
