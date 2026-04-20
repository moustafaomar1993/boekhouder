"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Invoice, User } from "@/lib/data";
import { useToast } from "@/components/ToastProvider";

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
  const { addToast } = useToast();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<User[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [bookingLoading, setBookingLoading] = useState<string | null>(null);

  // Verkoop sub-tab state
  const [verkoopTab, setVerkoopTab] = useState<"debiteurenbeheer" | "boeken">("boeken");
  const [selectedSalesIds, setSelectedSalesIds] = useState<Set<string>>(new Set());
  const [bulkLedgerAccount, setBulkLedgerAccount] = useState("");
  const [bulkBookingLoading, setBulkBookingLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [facturatieClient, setFacturatieClient] = useState("");
  const [debiteurenSort, setDebiteurenSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "dueDate", dir: "asc" });
  const [boekenClient, setBoekenClient] = useState("");
  const [bookModalInvoiceId, setBookModalInvoiceId] = useState<string | null>(null);
  const [bookModalLedger, setBookModalLedger] = useState("");
  const [bookModalSearch, setBookModalSearch] = useState("");
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkLedgerSearch, setBulkLedgerSearch] = useState("");
  const [showBulkLedgerDrop, setShowBulkLedgerDrop] = useState(false);
  const [bookModalVatCode, setBookModalVatCode] = useState("");
  const [bookModalVatSearch, setBookModalVatSearch] = useState("");
  const [bulkVatCode, setBulkVatCode] = useState("");
  const [bulkVatSearch, setBulkVatSearch] = useState("");
  const [showBulkVatDrop, setShowBulkVatDrop] = useState(false);

  // Row-based booking modal state
  interface BookingRow {
    id: string;
    ledgerAccount: string;
    ledgerSearch: string;
    vatCode: string;
    vatSearch: string;
    exclVat: number;
    vatAmount: number;
    description: string;
  }
  const [bookModalRows, setBookModalRows] = useState<BookingRow[]>([]);
  const [bookModalDescription, setBookModalDescription] = useState("");
  const [bookModalDate, setBookModalDate] = useState("");
  const [bookModalDueDate, setBookModalDueDate] = useState("");
  const [bookModalSubtotal, setBookModalSubtotal] = useState<number | null>(null);
  const [bookModalVatAmount, setBookModalVatAmount] = useState<number | null>(null);
  const [activeRowDrop, setActiveRowDrop] = useState<{ rowId: string; field: "ledger" | "vat" } | null>(null);

  // Reminder modal state
  const [reminderInvoice, setReminderInvoice] = useState<Invoice | null>(null);
  const [reminderTo, setReminderTo] = useState("");
  const [reminderSubject, setReminderSubject] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderSending, setReminderSending] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);

  // Boekingen ledger drill-down
  const [boekingenView, setBoekingenView] = useState<"overview" | "ledger">("overview");
  const [boekingenLedgerFilter, setBoekingenLedgerFilter] = useState("");
  const [expandedLedgers, setExpandedLedgers] = useState<Set<string>>(new Set());

  // Inkoop state
  interface PurchaseDoc {
    id: string; userId: string; fileName: string; fileUrl: string; fileType: string; fileSize: number;
    status: string; label: string | null; supplierName: string | null; invoiceNumber: string | null;
    amount: number | null; vatAmount: number | null; totalAmount: number | null; documentDate: string | null;
    category: string | null; description: string | null; vatType: string | null; notes: string | null;
    dueDate: string | null; bookedAt: string | null; createdAt: string; updatedAt: string;
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

  // Debiteurenbeheer status filter
  const [debiteurenStatusFilter, setDebiteurenStatusFilter] = useState<string>("all");

  // Inkoop sub-tab state
  const [inkoopTab, setInkoopTab] = useState<"crediteurenbeheer" | "boeken">("boeken");
  const [inkoopBoekenClient, setInkoopBoekenClient] = useState("");

  // Memoriaal state
  interface JournalEntryData {
    id: string; date: string; reference: string; description: string; type: string;
    totalDebit: number; totalCredit: number; status: string; bookedAt: string | null;
    createdAt: string; lines: JournalLineData[];
  }
  interface JournalLineData {
    id: string; ledgerAccount: string; debit: number; credit: number; description: string | null; vatCode: string | null;
  }
  const [journalEntries, setJournalEntries] = useState<JournalEntryData[]>([]);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [editingJournal, setEditingJournal] = useState<JournalEntryData | null>(null);
  const [journalForm, setJournalForm] = useState({ date: new Date().toISOString().split("T")[0], description: "", type: "memoriaal" as "memoriaal" | "beginbalans" });
  const [journalLines, setJournalLines] = useState<{ id: string; ledgerAccount: string; ledgerSearch: string; debit: number; credit: number; description: string; vatCode: string; vatSearch: string }[]>([]);
  const [journalSaving, setJournalSaving] = useState(false);
  const [journalLedgerDrop, setJournalLedgerDrop] = useState<string | null>(null);
  const [journalVatDrop, setJournalVatDrop] = useState<string | null>(null);

  // Boeken summary filter
  const [boekenSummaryFilter, setBoekenSummaryFilter] = useState<string>("all");

  // Voortgang popup
  const [showVoortgang, setShowVoortgang] = useState(false);

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
    fetch("/api/journal-entries").then((r) => r.ok ? r.json() : []).then((d) => { if (Array.isArray(d)) setJournalEntries(d); }).catch(() => {});
  }, []);

  async function handleBook(invoiceId: string, category?: string, vatType?: string) {
    setBookingLoading(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookkeepingStatus: "booked", ...(category && { category }), ...(vatType && { vatType }) }),
      });
      if (res.ok) {
        const inv = invoices.find(i => i.id === invoiceId);
        setInvoices((prev) => prev.map((inv) => inv.id === invoiceId ? { ...inv, bookkeepingStatus: "booked", ...(category && { category }), ...(vatType && { vatType }) } : inv));
        if (inv) addToast({ type: "bookkeeping", title: "Factuur geboekt", message: `${inv.invoiceNumber} - ${inv.customerName}` });
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

  function openBookModal(inv: Invoice) {
    setBookModalInvoiceId(inv.id);
    setBookModalDescription(inv.customerName + " - " + inv.invoiceNumber);
    setBookModalDate(inv.date);
    setBookModalDueDate(inv.dueDate);
    setBookModalSubtotal(null);
    setBookModalVatAmount(null);
    setBookModalRows([{
      id: "row-0",
      ledgerAccount: "",
      ledgerSearch: "",
      vatCode: "",
      vatSearch: "",
      exclVat: inv.subtotal,
      vatAmount: inv.vatAmount,
      description: inv.customerName,
    }]);
    setBookModalSearch("");
    setBookModalLedger("");
    setBookModalVatCode("");
    setBookModalVatSearch("");
    setActiveRowDrop(null);
  }

  function addBookingRow() {
    setBookModalRows(prev => [...prev, {
      id: `row-${Date.now()}`,
      ledgerAccount: "",
      ledgerSearch: "",
      vatCode: "",
      vatSearch: "",
      exclVat: 0,
      vatAmount: 0,
      description: "",
    }]);
  }

  function removeBookingRow(rowId: string) {
    setBookModalRows(prev => prev.filter(r => r.id !== rowId));
  }

  function updateBookingRow(rowId: string, field: string, value: string | number) {
    setBookModalRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
  }

  async function submitBooking() {
    if (!bookModalInvoiceId || bookModalRows.length === 0) return;
    setBookingLoading(bookModalInvoiceId);
    try {
      const primaryRow = bookModalRows[0];
      const ledger = primaryRow.ledgerAccount;
      const vat = primaryRow.vatCode;
      const modalInv = invoices.find(i => i.id === bookModalInvoiceId);

      const body: Record<string, unknown> = {
        bookkeepingStatus: "booked",
        ...(ledger && { category: ledger }),
        ...(vat && { vatType: vat }),
      };

      if (bookModalDescription && modalInv && bookModalDescription !== (modalInv.customerName + " - " + modalInv.invoiceNumber)) {
        body.notes = bookModalDescription;
      }

      // Send overridden amounts if edited
      if (bookModalSubtotal !== null && modalInv) body.subtotal = bookModalSubtotal;
      if (bookModalVatAmount !== null && modalInv) body.vatAmount = bookModalVatAmount;
      if (bookModalDate && modalInv && bookModalDate !== modalInv.date) body.date = bookModalDate;
      if (bookModalDueDate && modalInv && bookModalDueDate !== modalInv.dueDate) body.dueDate = bookModalDueDate;

      const res = await fetch(`/api/invoices/${bookModalInvoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const bookedInv = invoices.find(i => i.id === bookModalInvoiceId);
        setInvoices(prev => prev.map(inv =>
          inv.id === bookModalInvoiceId
            ? { ...inv, bookkeepingStatus: "booked", ...(ledger && { category: ledger }), ...(vat && { vatType: vat }) }
            : inv
        ));
        setBookModalInvoiceId(null);
        addToast({ type: "bookkeeping", title: "Factuur geboekt", message: bookedInv ? `${bookedInv.invoiceNumber} - ${bookedInv.customerName}` : "Factuur succesvol geboekt", actionUrl: bookedInv ? `/bookkeeper/invoices/${bookedInv.id}` : undefined, actionLabel: bookedInv ? "Bekijk factuur" : undefined });
      }
    } catch { /* */ }
    finally { setBookingLoading(null); }
  }

  function openReminder(inv: Invoice) {
    setReminderInvoice(inv);
    const email = inv.customer?.email || "";
    setReminderTo(email);
    setReminderSubject(`Betalingsherinnering factuur ${inv.invoiceNumber}`);
    setReminderMessage(
      `Geachte heer/mevrouw,\n\nWij verwijzen naar onze factuur ${inv.invoiceNumber} d.d. ${formatDate(inv.date)} ten bedrage van ${formatCurrency(inv.total)}.\n\nDe vervaldatum van deze factuur was ${formatDate(inv.dueDate)}. Wij hebben tot op heden geen betaling ontvangen.\n\nWij verzoeken u vriendelijk het openstaande bedrag binnen 7 dagen te voldoen.\n\nMet vriendelijke groet`
    );
    setReminderSending(false);
    setReminderSent(false);
  }

  async function sendReminder() {
    if (!reminderInvoice || !reminderTo) return;
    setReminderSending(true);
    try {
      const res = await fetch(`/api/invoices/${reminderInvoice.id}/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: reminderTo, subject: reminderSubject, message: reminderMessage }),
      });
      if (res.ok) {
        setReminderSent(true);
        setInvoices(prev => prev.map(inv => inv.id === reminderInvoice.id ? { ...inv, remindersSent: (inv.remindersSent || 0) + 1 } : inv));
        addToast({ type: "success", title: "Herinnering verstuurd", message: `Betalingsherinnering verstuurd naar ${reminderTo}` });
      } else {
        addToast({ type: "error", title: "Verzenden mislukt", message: "De herinnering kon niet worden verstuurd" });
      }
    } catch { /* */ }
    finally { setReminderSending(false); }
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
        addToast({ type: "success", title: "Bank import geslaagd", message: data.message || "Transacties succesvol geimporteerd", actionUrl: "/bookkeeper?section=bank", actionLabel: "Bekijk transacties" });
        const txRes = await fetch("/api/bank/transactions");
        if (txRes.ok) { const txs = await txRes.json(); if (Array.isArray(txs)) setBankTxs(txs); }
      } else {
        addToast({ type: "error", title: "Bank import mislukt", message: data.error || "Import mislukt" });
      }
    } catch { setBankImportResult({ success: false, message: "Import mislukt" }); addToast({ type: "error", title: "Bank import mislukt", message: "Er ging iets mis bij het importeren" }); }
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
        addToast({ type: "success", title: "Aflettering voltooid", message: data.message, actionUrl: "/bookkeeper?section=afletteren", actionLabel: "Bekijk aflettering" });
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
        addToast({ type: "error", title: "Aflettering mislukt", message: data.error || "Er ging iets mis" });
      }
    } catch { setReconMessage("Er ging iets mis"); addToast({ type: "error", title: "Aflettering mislukt", message: "Er ging iets mis" }); }
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
    kas: "Kas", memoriaal: "Memoriaal", boekingen: "Boekingen", afletteren: "Afletteren",
    grootboek: "Grootboek", taken: "Taken", berichten: "Berichten",
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
                <div className="flex justify-between py-2"><span className="text-sm text-gray-600">Te boeken facturen</span><span className="text-sm font-semibold text-amber-600">{pendingCount + processingCount}</span></div>
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
        const facturatieClients = clients.filter((c) => c.role === "client");

        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#3C2C1E]">Verkoop</h1>
                <p className="text-sm text-[#6F5C4B]/70 mt-1">Boeken en debiteurenbeheer</p>
              </div>
            </div>

            {/* Sub-tab switcher */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
              <button onClick={() => setVerkoopTab("boeken")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${verkoopTab === "boeken" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Boeken</button>
              <button onClick={() => setVerkoopTab("debiteurenbeheer")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${verkoopTab === "debiteurenbeheer" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Debiteurenbeheer</button>
            </div>

            {/* ─── DEBITEURENBEHEER TAB ─── */}
            {verkoopTab === "debiteurenbeheer" && (() => {
              const dbClient = facturatieClient;
              const dbClients = facturatieClients;
              const dbInvoices = dbClient ? invoices.filter((inv) => inv.clientId === dbClient) : [];
              // Sort logic
              const sortKey = debiteurenSort.key;
              const sortDir = debiteurenSort.dir;
              function toggleSort(key: string) {
                setDebiteurenSort((prev) => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
              }
              function SortHeader({ k, label, className: cls }: { k: string; label: string; className?: string }) {
                const active = sortKey === k;
                return <th className={`px-3 py-2.5 font-medium cursor-pointer select-none hover:text-gray-700 ${cls || ""}`} onClick={() => toggleSort(k)}>
                  {label} {active && <span className="text-[#00AFCB]">{sortDir === "asc" ? "↑" : "↓"}</span>}
                </th>;
              }
              const dbFiltered = dbInvoices.filter((inv) => {
                if (debiteurenStatusFilter === "open") return inv.status === "sent" || inv.status === "overdue";
                if (debiteurenStatusFilter === "overdue") return (inv.status === "sent" || inv.status === "overdue") && new Date(inv.dueDate) < new Date();
                if (debiteurenStatusFilter === "new") return inv.bookkeepingStatus === "pending" || inv.bookkeepingStatus === "to_book";
                if (debiteurenStatusFilter === "paid") return inv.status === "paid";
                return true;
              });
              const sorted = [...dbFiltered].sort((a, b) => {
                const dir = sortDir === "asc" ? 1 : -1;
                switch (sortKey) {
                  case "invoiceNumber": return a.invoiceNumber.localeCompare(b.invoiceNumber) * dir;
                  case "customerName": return a.customerName.localeCompare(b.customerName) * dir;
                  case "date": return a.date.localeCompare(b.date) * dir;
                  case "dueDate": return a.dueDate.localeCompare(b.dueDate) * dir;
                  case "status": return a.status.localeCompare(b.status) * dir;
                  case "total": return (a.total - b.total) * dir;
                  case "reminders": return ((a.remindersSent || 0) - (b.remindersSent || 0)) * dir;
                  default: return 0;
                }
              });
              const openInvs = dbInvoices.filter((i) => i.status === "sent" || i.status === "overdue");
              const overdueInvs = dbInvoices.filter((i) => {
                if (i.status !== "sent" && i.status !== "overdue") return false;
                return new Date(i.dueDate) < new Date();
              });
              const newToProcess = dbInvoices.filter((i) => i.bookkeepingStatus === "pending" || i.bookkeepingStatus === "to_book");

              return (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <select value={facturatieClient} onChange={(e) => setFacturatieClient(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none min-w-[200px]">
                      <option value="">Selecteer een klant...</option>
                      {dbClients.map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
                    </select>
                  </div>

                  {!dbClient && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
                      <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      <p className="text-sm text-gray-500">Selecteer een klant om het debiteurenbeheer te openen.</p>
                      <p className="text-xs text-gray-400 mt-1">Beheer openstaande facturen, stuur herinneringen en volg debiteuren op.</p>
                    </div>
                  )}

                  {dbClient && (
                    <div className="space-y-4">
                      {/* Summary cards — clickable as filters */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <button onClick={() => setDebiteurenStatusFilter("all")}
                          className={`rounded-xl p-4 shadow-sm border text-left transition-all ${debiteurenStatusFilter === "all" ? "ring-2 ring-[#00AFCB] border-[#00AFCB]/30 bg-white" : "bg-white border-gray-100 hover:border-gray-200"}`}>
                          <p className="text-xs text-gray-500">Totaal</p>
                          <p className="text-lg font-bold text-[#004854]">{dbInvoices.length}</p>
                        </button>
                        <button onClick={() => setDebiteurenStatusFilter("open")}
                          className={`rounded-xl p-4 shadow-sm border text-left transition-all ${debiteurenStatusFilter === "open" ? "ring-2 ring-amber-400 border-amber-300 bg-amber-50" : "bg-white border-gray-100 hover:border-amber-200"}`}>
                          <p className="text-xs text-amber-700 font-medium">Openstaand</p>
                          <p className="text-lg font-bold text-amber-600">{openInvs.length}</p>
                          <p className="text-xs text-gray-400">{formatCurrency(openInvs.reduce((s, i) => s + i.total, 0))}</p>
                        </button>
                        <button onClick={() => setDebiteurenStatusFilter("overdue")}
                          className={`rounded-xl p-4 shadow-sm border text-left transition-all ${debiteurenStatusFilter === "overdue" ? "ring-2 ring-red-400 border-red-300 bg-red-50" : overdueInvs.length > 0 ? "bg-red-50 border-red-200 hover:border-red-300" : "bg-white border-gray-100 hover:border-gray-200"}`}>
                          <p className={`text-xs ${overdueInvs.length > 0 ? "text-red-700 font-semibold" : "text-gray-500"}`}>Verlopen</p>
                          <p className={`text-lg font-bold ${overdueInvs.length > 0 ? "text-red-600" : "text-gray-400"}`}>{overdueInvs.length}</p>
                          {overdueInvs.length > 0 && <p className="text-xs text-red-500 font-medium">{formatCurrency(overdueInvs.reduce((s, i) => s + i.total, 0))}</p>}
                        </button>
                        <button onClick={() => setDebiteurenStatusFilter("new")}
                          className={`rounded-xl p-4 shadow-sm border text-left transition-all ${debiteurenStatusFilter === "new" ? "ring-2 ring-blue-400 border-blue-300 bg-blue-50" : newToProcess.length > 0 ? "bg-blue-50 border-blue-200 hover:border-blue-300" : "bg-white border-gray-100 hover:border-gray-200"}`}>
                          <p className={`text-xs ${newToProcess.length > 0 ? "text-blue-700" : "text-gray-500"}`}>Nieuw / te boeken</p>
                          <p className={`text-lg font-bold ${newToProcess.length > 0 ? "text-blue-600" : "text-gray-400"}`}>{newToProcess.length}</p>
                        </button>
                        <button onClick={() => setDebiteurenStatusFilter("paid")}
                          className={`rounded-xl p-4 shadow-sm border text-left transition-all ${debiteurenStatusFilter === "paid" ? "ring-2 ring-emerald-400 border-emerald-300 bg-emerald-50" : "bg-white border-gray-100 hover:border-gray-200"}`}>
                          <p className="text-xs text-emerald-700">Betaald</p>
                          <p className="text-lg font-bold text-emerald-600">{dbInvoices.filter((i) => i.status === "paid").length}</p>
                        </button>
                      </div>

                      {/* Desktop table with sortable headers */}
                      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                        <table className="w-full">
                          <thead><tr className="text-left text-[11px] text-gray-500 border-b border-gray-100 bg-gray-50">
                            <SortHeader k="invoiceNumber" label="Factuurnr." className="px-4" />
                            <SortHeader k="customerName" label="Debiteur" />
                            <th className="px-3 py-2.5 font-medium">Telefoon</th>
                            <SortHeader k="date" label="Datum" />
                            <SortHeader k="dueDate" label="Vervaldatum" />
                            <SortHeader k="status" label="Status" />
                            <SortHeader k="total" label="Bedrag" className="text-right" />
                            <SortHeader k="reminders" label="Herinn." className="text-center" />
                            <th className="px-3 py-2.5 font-medium text-right">Actie</th>
                          </tr></thead>
                          <tbody className="divide-y divide-gray-50">
                            {sorted.map((inv) => {
                              const dueDate = new Date(inv.dueDate);
                              const daysOver = Math.floor((Date.now() - dueDate.getTime()) / 86400000);
                              const isOverdue = daysOver > 0 && (inv.status === "sent" || inv.status === "overdue");
                              const isNew = inv.bookkeepingStatus === "pending" || inv.bookkeepingStatus === "to_book";
                              const custPhone = inv.customer?.phone || null;
                              return (
                                <tr key={inv.id} className={`hover:bg-gray-50/80 ${isOverdue ? "bg-red-50/50 border-l-2 border-l-red-400" : isNew ? "bg-blue-50/30 border-l-2 border-l-blue-400" : ""}`}>
                                  <td className="px-4 py-3 font-medium text-sm">
                                    {inv.invoiceNumber}
                                    {inv.isCredit && <span className="ml-1 text-[10px] text-red-500">(credit)</span>}
                                  </td>
                                  <td className="px-3 py-3 text-sm text-gray-700">{inv.customerName}</td>
                                  <td className="px-3 py-3 text-sm">
                                    {custPhone ? (
                                      <div className="flex items-center gap-1.5">
                                        <a href={`tel:${custPhone}`} className="text-[#00AFCB] hover:text-[#004854] font-medium text-xs" title="Bellen">
                                          {custPhone}
                                        </a>
                                        <a href={`tel:${custPhone}`} className="p-1 rounded hover:bg-[#00AFCB]/10 text-[#00AFCB]" title="Direct bellen">
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                        </a>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-300">&mdash;</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-sm text-gray-600">{formatDate(inv.date)}</td>
                                  <td className="px-3 py-3 text-sm">
                                    <span className={isOverdue ? "text-red-600 font-semibold" : "text-gray-600"}>{formatDate(inv.dueDate)}</span>
                                    {isOverdue && <span className="block text-[10px] text-red-500 font-medium">{daysOver}d over</span>}
                                  </td>
                                  <td className="px-3 py-3">
                                    <StatusBadge status={inv.status} />
                                    {isOverdue && <span className="block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700 w-fit">URGENT</span>}
                                    {isNew && !isOverdue && <span className="block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-100 text-blue-700 w-fit">NIEUW</span>}
                                  </td>
                                  <td className="px-3 py-3 text-right font-semibold text-sm">{formatCurrency(inv.total)}</td>
                                  <td className="px-3 py-3 text-center">
                                    {inv.remindersSent > 0 ? <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">{inv.remindersSent}x</span> : <span className="text-xs text-gray-300">—</span>}
                                  </td>
                                  <td className="px-3 py-3 text-right">
                                    <div className="flex items-center gap-2 justify-end">
                                      {isOverdue && (
                                        <button onClick={(e) => { e.preventDefault(); openReminder(inv); }}
                                          className="text-xs px-2 py-1 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600"
                                          title="Herinnering verzenden">
                                          Herinneren
                                        </button>
                                      )}
                                      {isOverdue && custPhone && (
                                        <a href={`tel:${custPhone}`} className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-lg font-medium hover:bg-amber-200 flex items-center gap-1" title="Bellen">
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                          Bel
                                        </a>
                                      )}
                                      <Link href={`/bookkeeper/invoices/${inv.id}`} className="text-sm text-[#00AFCB] hover:text-[#004854] font-medium">Bekijken</Link>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                            {sorted.length === 0 && <tr><td colSpan={9} className="px-5 py-12 text-center text-gray-400">Geen facturen voor deze klant.</td></tr>}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile cards */}
                      <div className="md:hidden space-y-3">
                        {sorted.map((inv) => {
                          const dueDate = new Date(inv.dueDate);
                          const daysOver = Math.floor((Date.now() - dueDate.getTime()) / 86400000);
                          const isOverdue = daysOver > 0 && (inv.status === "sent" || inv.status === "overdue");
                          const isNew = inv.bookkeepingStatus === "pending" || inv.bookkeepingStatus === "to_book";
                          const mCustPhone = inv.customer?.phone || null;
                          return (
                            <Link key={inv.id} href={`/bookkeeper/invoices/${inv.id}`}
                              className={`block rounded-xl shadow-sm p-4 transition-colors ${isOverdue ? "bg-red-50 border-2 border-red-200" : isNew ? "bg-blue-50/50 border border-blue-200" : "bg-white border border-gray-100 hover:border-[#00AFCB]/30"}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-[#004854]">{inv.invoiceNumber}</p>
                                    {isOverdue && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700">URGENT</span>}
                                    {isNew && !isOverdue && <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-100 text-blue-700">NIEUW</span>}
                                  </div>
                                  <p className="text-sm text-gray-900 mt-0.5">{inv.customerName}</p>
                                  {mCustPhone && (
                                    <p className="text-xs text-[#00AFCB] mt-0.5 flex items-center gap-1">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                      {mCustPhone}
                                    </p>
                                  )}
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {formatDate(inv.date)} &middot; vervalt {formatDate(inv.dueDate)}
                                    {isOverdue && <span className="text-red-500 font-medium"> ({daysOver}d over)</span>}
                                  </p>
                                  {inv.remindersSent > 0 && <p className="text-[10px] text-amber-600 mt-1">{inv.remindersSent} herinnering(en) verstuurd</p>}
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-semibold text-sm">{formatCurrency(inv.total)}</p>
                                  <div className="mt-1"><StatusBadge status={inv.status} /></div>
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                        {sorted.length === 0 && <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-12 text-center text-gray-400">Geen facturen voor deze klant.</div>}
                      </div>

                      {/* Reminder modal */}
                      {reminderInvoice && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setReminderInvoice(null)}>
                          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                              <h3 className="text-base font-semibold text-[#3C2C1E]">Herinnering verzenden</h3>
                              <button onClick={() => setReminderInvoice(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                              {reminderSent ? (
                                <div className="text-center py-8">
                                  <svg className="w-12 h-12 text-emerald-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <p className="text-sm font-medium text-emerald-700">Herinnering verzonden!</p>
                                  <button onClick={() => setReminderInvoice(null)} className="mt-4 px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Sluiten</button>
                                </div>
                              ) : (
                                <>
                                  <div className="bg-amber-50 rounded-lg p-3 text-sm">
                                    <p className="font-medium text-amber-800">Factuur {reminderInvoice.invoiceNumber}</p>
                                    <p className="text-amber-700 text-xs mt-0.5">{reminderInvoice.customerName} &middot; {formatCurrency(reminderInvoice.total)} &middot; vervaldatum {formatDate(reminderInvoice.dueDate)}</p>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Aan</label>
                                    <input type="email" value={reminderTo} onChange={(e) => setReminderTo(e.target.value)}
                                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none"
                                      placeholder="email@voorbeeld.nl" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Onderwerp</label>
                                    <input type="text" value={reminderSubject} onChange={(e) => setReminderSubject(e.target.value)}
                                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Bericht</label>
                                    <textarea value={reminderMessage} onChange={(e) => setReminderMessage(e.target.value)} rows={8}
                                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none resize-y" />
                                  </div>
                                  <div className="flex justify-end gap-2 pt-2">
                                    <button onClick={() => setReminderInvoice(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Annuleren</button>
                                    <button onClick={sendReminder} disabled={reminderSending || !reminderTo}
                                      className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50">
                                      {reminderSending ? "Verzenden..." : "Herinnering verzenden"}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ─── BOEKEN TAB ─── */}
            {verkoopTab === "boeken" && (() => {
              // Build client-level data for customer tiles
              const clientInvoiceMap = new Map<string, Invoice[]>();
              invoices.forEach((inv) => { const arr = clientInvoiceMap.get(inv.clientId) || []; arr.push(inv); clientInvoiceMap.set(inv.clientId, arr); });

              const clientTiles = clients
                .filter((c) => c.role === "client" && clientInvoiceMap.has(c.id))
                .map((c) => {
                  const invs = clientInvoiceMap.get(c.id) || [];
                  const openCount = invs.filter((i) => i.bookkeepingStatus === "pending" || i.bookkeepingStatus === "to_book").length;
                  const bookedCt = invs.filter((i) => i.bookkeepingStatus === "booked" || i.bookkeepingStatus === "processed").length;
                  const progress = invs.length > 0 ? Math.round((bookedCt / invs.length) * 100) : 100;
                  const amount = invs.reduce((s, i) => s + i.total, 0);
                  return { id: c.id, name: c.company || c.name, total: invs.length, open: openCount, booked: bookedCt, progress, amount };
                })
                .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));

              const vTotalOpen = clientTiles.reduce((s, c) => s + c.open, 0);
              const vTotalBooked = clientTiles.reduce((s, c) => s + c.booked, 0);
              const vTotalAll = clientTiles.reduce((s, c) => s + c.total, 0);
              const vOverallProgress = vTotalAll > 0 ? Math.round((vTotalBooked / vTotalAll) * 100) : 100;

              // Searchable ledger accounts with prefix-priority
              const allActiveAccounts = ledgerAccounts.filter((a) => a.isActive);
              function filterLedger(search: string) {
                if (!search) return allActiveAccounts.filter((a) => a.accountType === "revenue");
                const s = search.toLowerCase();
                const matched = allActiveAccounts.filter((a) => a.accountNumber.startsWith(search) || a.name.toLowerCase().includes(s) || a.accountNumber.includes(search));
                return matched.sort((a, b) => {
                  const aPrefix = a.accountNumber.startsWith(search) ? 0 : 1;
                  const bPrefix = b.accountNumber.startsWith(search) ? 0 : 1;
                  if (aPrefix !== bPrefix) return aPrefix - bPrefix;
                  return a.accountNumber.localeCompare(b.accountNumber);
                });
              }

              // VAT code helpers
              const salesVatCodes = vatCodes.filter((v) => v.type === "sales" && v.isActive);
              function filterVatCodes(search: string) {
                if (!search) return salesVatCodes;
                const s = search.toLowerCase();
                return salesVatCodes.filter((v) => v.code.toLowerCase().includes(s) || v.name.toLowerCase().includes(s) || v.percentage.toString().includes(s));
              }

              // ── CUSTOMER OVERVIEW (no client selected) ──
              if (!boekenClient) {
                return (
                  <div className="space-y-5">
                    {/* Summary — clickable to filter client tiles */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <button onClick={() => setBoekenSummaryFilter("all")}
                        className={`rounded-xl p-4 shadow-sm border text-left transition-all ${boekenSummaryFilter === "all" ? "ring-2 ring-[#00AFCB] border-[#00AFCB]/30 bg-white" : "bg-white border-gray-100 hover:border-gray-200"}`}>
                        <p className="text-xs text-gray-500">Totaal facturen</p>
                        <p className="text-xl font-bold text-[#004854]">{vTotalAll}</p>
                      </button>
                      <button onClick={() => setBoekenSummaryFilter("open")}
                        className={`rounded-xl p-4 shadow-sm border text-left transition-all ${boekenSummaryFilter === "open" ? "ring-2 ring-blue-400 border-blue-300 bg-blue-50" : vTotalOpen > 0 ? "bg-blue-50 border-blue-200 hover:border-blue-300" : "bg-white border-gray-100 hover:border-gray-200"}`}>
                        <p className={`text-xs ${vTotalOpen > 0 ? "text-blue-700 font-medium" : "text-gray-500"}`}>Open / te boeken</p>
                        <p className={`text-xl font-bold ${vTotalOpen > 0 ? "text-blue-600" : "text-gray-400"}`}>{vTotalOpen}</p>
                      </button>
                      <button onClick={() => setBoekenSummaryFilter("booked")}
                        className={`rounded-xl p-4 shadow-sm border text-left transition-all ${boekenSummaryFilter === "booked" ? "ring-2 ring-emerald-400 border-emerald-300 bg-emerald-50" : "bg-emerald-50 border-emerald-200 hover:border-emerald-300"}`}>
                        <p className="text-xs text-emerald-700 font-medium">Geboekt</p>
                        <p className="text-xl font-bold text-emerald-600">{vTotalBooked}</p>
                      </button>
                      <button onClick={() => setShowVoortgang(true)}
                        className="rounded-xl p-4 shadow-sm border bg-white border-gray-100 hover:border-[#00AFCB]/30 hover:shadow-md text-left transition-all group">
                        <p className="text-xs text-gray-500 group-hover:text-[#00AFCB]">Voortgang</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                            <div className="bg-emerald-500 h-2.5 rounded-full transition-all" style={{ width: `${vOverallProgress}%` }} />
                          </div>
                          <span className="text-sm font-bold text-[#004854]">{vOverallProgress}%</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 group-hover:text-[#00AFCB]">Klik voor details</p>
                      </button>
                    </div>

                    {/* Voortgang popup */}
                    {showVoortgang && (() => {
                      const fullyProcessed = clientTiles.filter((c) => c.progress === 100).length;
                      const partiallyProcessed = clientTiles.filter((c) => c.progress > 0 && c.progress < 100).length;
                      const notStarted = clientTiles.filter((c) => c.progress === 0).length;
                      return (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowVoortgang(false)}>
                          <div className="bg-white rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                              <h3 className="text-base font-semibold text-[#3C2C1E]">Verwerkingsvoortgang</h3>
                              <button onClick={() => setShowVoortgang(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                            <div className="p-6 space-y-5">
                              <div className="text-center">
                                <div className="relative w-24 h-24 mx-auto mb-3">
                                  <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                                    <circle cx="50" cy="50" r="42" fill="none" stroke="#10b981" strokeWidth="8" strokeDasharray={`${vOverallProgress * 2.64} 264`} strokeLinecap="round" />
                                  </svg>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-2xl font-bold text-[#004854]">{vOverallProgress}%</span>
                                  </div>
                                </div>
                                <p className="text-sm text-gray-600">{vTotalBooked} van {vTotalAll} facturen verwerkt</p>
                              </div>
                              <div className="grid grid-cols-3 gap-3 text-center">
                                <div className="bg-emerald-50 rounded-lg p-3">
                                  <p className="text-lg font-bold text-emerald-600">{fullyProcessed}</p>
                                  <p className="text-[10px] text-emerald-700 font-medium">Volledig</p>
                                </div>
                                <div className="bg-blue-50 rounded-lg p-3">
                                  <p className="text-lg font-bold text-blue-600">{partiallyProcessed}</p>
                                  <p className="text-[10px] text-blue-700 font-medium">Bezig</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3">
                                  <p className="text-lg font-bold text-gray-500">{notStarted}</p>
                                  <p className="text-[10px] text-gray-600 font-medium">Niet gestart</p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Per klant</p>
                                {clientTiles.map((c) => (
                                  <div key={c.id} className="flex items-center gap-3">
                                    <span className="text-xs text-gray-700 flex-1 truncate">{c.name}</span>
                                    <div className="w-20 bg-gray-100 rounded-full h-1.5">
                                      <div className={`h-1.5 rounded-full ${c.progress === 100 ? "bg-emerald-500" : c.progress > 50 ? "bg-emerald-400" : "bg-[#00AFCB]"}`} style={{ width: `${c.progress}%` }} />
                                    </div>
                                    <span className="text-[10px] text-gray-500 w-8 text-right">{c.progress}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Client tiles */}
                    <div>
                      <h2 className="text-sm font-semibold text-gray-700 mb-3">Klanten / Relaties {boekenSummaryFilter !== "all" && <span className="text-xs font-normal text-gray-400 ml-2">— gefilterd</span>}</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {clientTiles.filter((c) => {
                          if (boekenSummaryFilter === "open") return c.open > 0;
                          if (boekenSummaryFilter === "booked") return c.booked > 0;
                          return true;
                        }).map((c) => (
                          <button key={c.id} onClick={() => { setBoekenClient(c.id); setFilter("all"); setSelectedSalesIds(new Set()); setBulkLedgerSearch(""); setBulkLedgerAccount(""); }}
                            className={`rounded-xl shadow-sm border p-5 text-left hover:shadow-md transition-all group ${
                              c.progress === 100 ? "bg-emerald-50/50 border-emerald-200 hover:border-emerald-300" : "bg-white border-gray-100 hover:border-[#00AFCB]/40"
                            }`}>
                            <div className="flex items-start justify-between">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-[#3C2C1E] group-hover:text-[#00AFCB] transition-colors truncate">{c.name}</h3>
                                <p className="text-xs text-gray-400 mt-0.5">{c.total} facturen · {formatCurrency(c.amount)}</p>
                              </div>
                              {c.open > 0 && (
                                <span className="ml-2 min-w-[24px] h-6 flex items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold px-1.5">{c.open}</span>
                              )}
                            </div>
                            <div className="mt-3">
                              <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                                <span>{c.booked} van {c.total} verwerkt</span>
                                <span className="font-medium">{c.progress}%</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2">
                                <div className={`h-2 rounded-full transition-all ${c.progress === 100 ? "bg-emerald-500" : c.progress > 50 ? "bg-emerald-400" : "bg-[#00AFCB]"}`} style={{ width: `${c.progress}%` }} />
                              </div>
                            </div>
                            <div className="flex items-center gap-3 mt-3 text-[11px]">
                              {c.open > 0 && <span className="text-blue-600 font-medium">{c.open} open</span>}
                              {c.booked > 0 && <span className="text-emerald-600">{c.booked} geboekt</span>}
                              {c.progress === 100 && (
                                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                  Volledig verwerkt
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                      {clientTiles.length === 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-12 text-center">
                          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          <p className="text-sm text-gray-500">Geen klanten met facturen gevonden.</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // ── FILTERED PER-CUSTOMER VIEW ──
              const tile = clientTiles.find((c) => c.id === boekenClient);
              if (!tile) { setBoekenClient(""); return null; }

              const clientInvs = (clientInvoiceMap.get(boekenClient) || []).filter((inv) => {
                if (filter !== "all" && inv.bookkeepingStatus !== filter) return false;
                return true;
              });
              const bookableIds = clientInvs.filter((inv) => inv.bookkeepingStatus === "pending" || inv.bookkeepingStatus === "to_book" || inv.bookkeepingStatus === "processing").map((inv) => inv.id);
              const allSel = bookableIds.length > 0 && bookableIds.every((id) => selectedSalesIds.has(id));
              function toggleOne(id: string) { setSelectedSalesIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
              function toggleAll() { if (allSel) setSelectedSalesIds(new Set()); else setSelectedSalesIds(new Set(bookableIds)); }

              async function doBulkBook() {
                if (selectedSalesIds.size === 0 || !bulkLedgerAccount) return;
                setBulkBookingLoading(true); setBulkMessage("");
                try {
                  const res = await fetch("/api/invoices/batch-book", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ invoiceIds: [...selectedSalesIds], bookkeepingStatus: "booked", category: bulkLedgerAccount, ...(bulkVatCode && { vatType: bulkVatCode }) }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setBulkMessage(data.message);
                    addToast({ type: "bookkeeping", title: "Bulk boeking voltooid", message: `${selectedSalesIds.size} facturen geboekt` });
                    setInvoices((prev) => prev.map((inv) => selectedSalesIds.has(inv.id) ? { ...inv, bookkeepingStatus: "booked", category: bulkLedgerAccount, ...(bulkVatCode && { vatType: bulkVatCode }) } : inv));
                    setSelectedSalesIds(new Set()); setBulkLedgerSearch(""); setBulkLedgerAccount(""); setBulkVatCode(""); setBulkVatSearch("");
                    setTimeout(() => setBulkMessage(""), 4000);
                  }
                } catch { setBulkMessage("Er ging iets mis"); addToast({ type: "error", title: "Bulk boeking mislukt", message: "Er ging iets mis bij het boeken" }); }
                finally { setBulkBookingLoading(false); }
              }

              const bulkFilteredAccounts = filterLedger(bulkLedgerSearch);

              return (
                <div className="space-y-4">
                  {/* Back + header */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={() => { setBoekenClient(""); setSelectedSalesIds(new Set()); setFilter("all"); setBulkLedgerSearch(""); setBulkLedgerAccount(""); setBulkVatCode(""); setBulkVatSearch(""); }}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-semibold text-[#3C2C1E] truncate">{tile.name}</h2>
                      <p className="text-xs text-gray-500">{tile.open} open · {tile.booked} geboekt · {tile.total} totaal</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      <div className="w-28 bg-gray-100 rounded-full h-2">
                        <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${tile.progress}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-[#004854]">{tile.progress}%</span>
                    </div>
                  </div>

                  {/* Status filters */}
                  <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
                    {(["all", "to_book", "pending", "booked", "processed"] as const).map((f) => (
                      <button key={f} onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                        {{ all: "Alles", to_book: "Te boeken", pending: "In afwachting", booked: "Geboekt", processed: "Verwerkt" }[f]}
                      </button>
                    ))}
                  </div>

                  {/* Bulk action bar */}
                  {selectedSalesIds.size > 0 && (() => {
                    const bulkVatFiltered = filterVatCodes(bulkVatSearch);
                    return (
                    <div className="bg-[#004854] rounded-xl p-4 space-y-3">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white font-medium">{selectedSalesIds.size} facturen geselecteerd</span>
                          <button onClick={() => { setSelectedSalesIds(new Set()); setBulkLedgerAccount(""); setBulkLedgerSearch(""); setBulkVatCode(""); setBulkVatSearch(""); }} className="px-3 py-1.5 text-white/70 hover:text-white text-sm whitespace-nowrap">Annuleren</button>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          {/* Ledger account */}
                          <div className="relative flex-1 min-w-[180px]">
                            <label className="block text-[10px] text-white/50 mb-1 uppercase tracking-wider">Grootboekrekening</label>
                            <input type="text" value={bulkLedgerSearch}
                              onChange={(e) => { setBulkLedgerSearch(e.target.value); setBulkLedgerAccount(""); setShowBulkLedgerDrop(true); }}
                              onFocus={() => setShowBulkLedgerDrop(true)}
                              onBlur={() => setTimeout(() => setShowBulkLedgerDrop(false), 200)}
                              placeholder="Zoek rekening (nr/naam)..."
                              className="w-full border border-white/20 bg-white/10 text-white placeholder-white/40 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00AFCB]/50 outline-none" />
                            {showBulkLedgerDrop && bulkFilteredAccounts.length > 0 && (
                              <div className="absolute z-50 w-72 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                                {bulkFilteredAccounts.slice(0, 15).map((a) => (
                                  <button key={a.id} type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      setBulkLedgerAccount(`${a.accountNumber} ${a.name}`);
                                      setBulkLedgerSearch(`${a.accountNumber} - ${a.name}`);
                                      setShowBulkLedgerDrop(false);
                                      if (a.defaultVatCode && !bulkVatCode) {
                                        setBulkVatCode(`${a.defaultVatCode.code} ${a.defaultVatCode.name} ${a.defaultVatCode.percentage}%`);
                                        setBulkVatSearch(`${a.defaultVatCode.code} - ${a.defaultVatCode.name} (${a.defaultVatCode.percentage}%)`);
                                      }
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex items-center gap-2">
                                    <span className="font-mono text-xs text-gray-400 w-10 shrink-0">{a.accountNumber}</span>
                                    <span className="text-gray-700 truncate">{a.name}</span>
                                    {a.defaultVatCode && <span className="ml-auto text-[10px] text-gray-400 shrink-0">{a.defaultVatCode.code}</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* VAT code */}
                          <div className="relative min-w-[160px]">
                            <label className="block text-[10px] text-white/50 mb-1 uppercase tracking-wider">BTW-code</label>
                            <input type="text" value={bulkVatSearch}
                              onChange={(e) => { setBulkVatSearch(e.target.value); setBulkVatCode(""); setShowBulkVatDrop(true); }}
                              onFocus={() => setShowBulkVatDrop(true)}
                              onBlur={() => setTimeout(() => setShowBulkVatDrop(false), 200)}
                              placeholder="Zoek BTW-code..."
                              className="w-full border border-white/20 bg-white/10 text-white placeholder-white/40 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00AFCB]/50 outline-none" />
                            {showBulkVatDrop && bulkVatFiltered.length > 0 && (
                              <div className="absolute z-50 w-64 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                                {bulkVatFiltered.map((v) => (
                                  <button key={v.id} type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => { setBulkVatCode(`${v.code} ${v.name} ${v.percentage}%`); setBulkVatSearch(`${v.code} - ${v.name} (${v.percentage}%)`); setShowBulkVatDrop(false); }}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex items-center gap-2">
                                    <span className="font-mono text-xs text-blue-600 w-12 shrink-0">{v.code}</span>
                                    <span className="text-gray-700 truncate">{v.name}</span>
                                    <span className="ml-auto text-xs text-gray-400 shrink-0">{v.percentage}%</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* Action buttons */}
                          <div className="flex items-end gap-2">
                            {bulkLedgerAccount ? (
                              <button onClick={() => setShowBulkConfirm(true)}
                                className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors whitespace-nowrap">
                                Boek {selectedSalesIds.size} facturen
                              </button>
                            ) : (
                              <span className="text-xs text-white/50 whitespace-nowrap py-2">Selecteer een rekening</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {bulkLedgerAccount && (
                        <div className="bg-white/10 rounded-lg px-3 py-2 text-xs text-white/80 flex flex-wrap gap-x-4 gap-y-1">
                          <span><span className="font-medium">{selectedSalesIds.size} facturen</span> &rarr; <span className="font-medium">{bulkLedgerAccount}</span></span>
                          {bulkVatCode && <span>BTW: <span className="font-medium">{bulkVatCode}</span></span>}
                          <span>Totaal: <span className="font-medium">{formatCurrency([...selectedSalesIds].reduce((s, id) => { const inv = invoices.find((i) => i.id === id); return s + (inv?.total || 0); }, 0))}</span></span>
                        </div>
                      )}
                    </div>
                    );
                  })()}
                  {bulkMessage && <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm text-emerald-700">{bulkMessage}</div>}

                  {/* Desktop table */}
                  <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-[11px] text-gray-500 border-b border-gray-100 bg-gray-50">
                          <th className="px-3 py-3 w-10"><input type="checkbox" checked={allSel} onChange={toggleAll} className="rounded border-gray-300" /></th>
                          <th className="px-3 py-3 font-medium">Factuurnr.</th>
                          <th className="px-3 py-3 font-medium">Debiteur</th>
                          <th className="px-3 py-3 font-medium">Datum</th>
                          <th className="px-3 py-3 font-medium text-right">Excl. BTW</th>
                          <th className="px-3 py-3 font-medium text-right">BTW</th>
                          <th className="px-3 py-3 font-medium text-right">Incl. BTW</th>
                          <th className="px-3 py-3 font-medium">Status</th>
                          <th className="px-3 py-3 font-medium">Rekening</th>
                          <th className="px-3 py-3 font-medium">BTW-code</th>
                          <th className="px-3 py-3 font-medium text-right">Actie</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {clientInvs.map((inv) => {
                          const isSel = selectedSalesIds.has(inv.id);
                          const canSelect = inv.bookkeepingStatus === "pending" || inv.bookkeepingStatus === "to_book" || inv.bookkeepingStatus === "processing";
                          return (
                            <tr key={inv.id} className={`hover:bg-gray-50 ${isSel ? "bg-[#00AFCB]/5" : ""}`}>
                              <td className="px-3 py-3"><input type="checkbox" checked={isSel} disabled={!canSelect} onChange={() => toggleOne(inv.id)} className="rounded border-gray-300 disabled:opacity-30" /></td>
                              <td className="px-3 py-3 font-medium text-sm">{inv.invoiceNumber}{inv.isCredit && <span className="ml-1 text-[10px] text-red-500">(credit)</span>}</td>
                              <td className="px-3 py-3 text-sm text-gray-600">{inv.customerName}</td>
                              <td className="px-3 py-3 text-sm text-gray-600">{formatDate(inv.date)}</td>
                              <td className="px-3 py-3 text-sm text-right">{formatCurrency(inv.subtotal)}</td>
                              <td className="px-3 py-3 text-sm text-right text-gray-500">{formatCurrency(inv.vatAmount)}</td>
                              <td className="px-3 py-3 text-sm text-right font-semibold">{formatCurrency(inv.total)}</td>
                              <td className="px-3 py-3"><StatusBadge status={inv.bookkeepingStatus} /></td>
                              <td className="px-3 py-3 text-xs text-gray-500 max-w-[120px] truncate">{inv.category || <span className="text-gray-300">&mdash;</span>}</td>
                              <td className="px-3 py-3 text-xs text-gray-500 max-w-[100px] truncate">{inv.vatType || <span className="text-gray-300">&mdash;</span>}</td>
                              <td className="px-3 py-3 text-right">
                                <div className="flex gap-2 justify-end">
                                  {canSelect && (
                                    <button onClick={() => { openBookModal(inv); }}
                                      className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700">Boeken</button>
                                  )}
                                  {(inv.bookkeepingStatus === "booked" || inv.bookkeepingStatus === "processed") && (
                                    <button onClick={() => handleUnbook(inv.id)} disabled={bookingLoading === inv.id}
                                      className="text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50">
                                      {bookingLoading === inv.id ? "..." : "Heropenen"}
                                    </button>
                                  )}
                                  <Link href={`/bookkeeper/invoices/${inv.id}?from=boeken`} className="text-sm text-[#00AFCB] hover:text-[#004854] font-medium py-1">Bekijken</Link>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {clientInvs.length === 0 && <tr><td colSpan={11} className="px-5 py-12 text-center text-gray-400">Geen facturen gevonden.</td></tr>}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden space-y-3">
                    {clientInvs.map((inv) => {
                      const isSel = selectedSalesIds.has(inv.id);
                      const canSelect = inv.bookkeepingStatus === "pending" || inv.bookkeepingStatus === "to_book" || inv.bookkeepingStatus === "processing";
                      return (
                        <div key={inv.id} className={`bg-white rounded-xl shadow-sm border p-4 ${isSel ? "border-[#00AFCB] bg-[#00AFCB]/5" : "border-gray-100"}`}>
                          <div className="flex items-start gap-3">
                            <input type="checkbox" checked={isSel} disabled={!canSelect} onChange={() => toggleOne(inv.id)} className="mt-1 rounded border-gray-300 disabled:opacity-30" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-[#004854]">{inv.invoiceNumber}</p>
                                  <p className="text-sm text-gray-900 mt-0.5">{inv.customerName}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">{formatDate(inv.date)}</p>
                                  {inv.category && <p className="text-[10px] text-gray-400 mt-0.5">{inv.category}</p>}
                                  {inv.vatType && <p className="text-[10px] text-blue-500 mt-0.5">{inv.vatType}</p>}
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-semibold text-sm">{formatCurrency(inv.total)}</p>
                                  <p className="text-xs text-gray-500">{formatCurrency(inv.subtotal)} + {formatCurrency(inv.vatAmount)}</p>
                                  <div className="mt-1"><StatusBadge status={inv.bookkeepingStatus} /></div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100 ml-7">
                            {canSelect && (
                              <button onClick={() => { openBookModal(inv); }}
                                className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700">Boeken</button>
                            )}
                            {(inv.bookkeepingStatus === "booked" || inv.bookkeepingStatus === "processed") && (
                              <button onClick={() => handleUnbook(inv.id)} disabled={bookingLoading === inv.id}
                                className="text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50">
                                {bookingLoading === inv.id ? "..." : "Heropenen"}
                              </button>
                            )}
                            <Link href={`/bookkeeper/invoices/${inv.id}?from=boeken`} className="text-xs px-3 py-1.5 text-[#00AFCB] hover:text-[#004854] font-medium">Bekijken</Link>
                          </div>
                        </div>
                      );
                    })}
                    {clientInvs.length === 0 && <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-12 text-center text-gray-400">Geen facturen gevonden.</div>}
                  </div>

                  {/* Row-based booking modal */}
                  {bookModalInvoiceId && (() => {
                    const modalInv = invoices.find((i) => i.id === bookModalInvoiceId);
                    if (!modalInv) return null;

                    // Use edited amounts if overridden
                    const effectiveSubtotal = bookModalSubtotal !== null ? bookModalSubtotal : modalInv.subtotal;
                    const effectiveVat = bookModalVatAmount !== null ? bookModalVatAmount : modalInv.vatAmount;

                    // Compute row 0 remainder
                    const otherRowsExclTotal = bookModalRows.slice(1).reduce((s, r) => s + (r.exclVat || 0), 0);
                    const otherRowsVatTotal = bookModalRows.slice(1).reduce((s, r) => s + (r.vatAmount || 0), 0);
                    const row0ExclVat = effectiveSubtotal - otherRowsExclTotal;
                    const row0VatAmount = effectiveVat - otherRowsVatTotal;
                    const totalRowsExcl = row0ExclVat + otherRowsExclTotal;
                    const totalRowsVat = row0VatAmount + otherRowsVatTotal;

                    const primaryRow = bookModalRows[0];
                    const canSubmit = primaryRow && primaryRow.ledgerAccount;

                    return (
                      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setBookModalInvoiceId(null)}>
                        <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                          {/* Header */}
                          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                            <h3 className="text-base font-semibold text-[#3C2C1E]">Factuur boeken</h3>
                            <button onClick={() => setBookModalInvoiceId(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>

                          <div className="flex-1 overflow-y-auto p-6 space-y-5">
                            {/* Invoice info */}
                            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Factuurgegevens</h4>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                <div><span className="text-gray-500 text-xs block">Factuurnr.</span><span className="font-medium">{modalInv.invoiceNumber}</span></div>
                                <div><span className="text-gray-500 text-xs block">Debiteur</span><span>{modalInv.customerName}</span></div>
                                <div>
                                  <label className="text-gray-500 text-xs block">Factuurdatum</label>
                                  <input type="date" value={bookModalDate} onChange={(e) => setBookModalDate(e.target.value)}
                                    className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none mt-0.5" />
                                </div>
                                <div>
                                  <label className="text-gray-500 text-xs block">Vervaldatum</label>
                                  <input type="date" value={bookModalDueDate} onChange={(e) => setBookModalDueDate(e.target.value)}
                                    className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none mt-0.5" />
                                </div>
                              </div>
                              <div>
                                <label className="text-gray-500 text-xs block">Omschrijving</label>
                                <input type="text" value={bookModalDescription} onChange={(e) => setBookModalDescription(e.target.value)}
                                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none mt-0.5" />
                              </div>
                              <div className="flex flex-wrap gap-4 text-xs pt-2 border-t border-gray-200 items-end">
                                <div>
                                  <label className="text-gray-500 text-xs block mb-0.5">Subtotaal</label>
                                  <input type="number" step="0.01"
                                    value={bookModalSubtotal !== null ? bookModalSubtotal : modalInv.subtotal}
                                    onChange={(e) => setBookModalSubtotal(parseFloat(e.target.value) || 0)}
                                    className="w-28 border border-gray-200 rounded px-2 py-1 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-[#00AFCB]/30 outline-none" />
                                </div>
                                <div>
                                  <label className="text-gray-500 text-xs block mb-0.5">BTW</label>
                                  <input type="number" step="0.01"
                                    value={bookModalVatAmount !== null ? bookModalVatAmount : modalInv.vatAmount}
                                    onChange={(e) => setBookModalVatAmount(parseFloat(e.target.value) || 0)}
                                    className="w-28 border border-gray-200 rounded px-2 py-1 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-[#00AFCB]/30 outline-none" />
                                </div>
                                <div>
                                  <span className="text-gray-500 text-xs block mb-0.5">Totaal</span>
                                  <span className="font-bold text-gray-900 text-sm block py-1">
                                    {formatCurrency((bookModalSubtotal !== null ? bookModalSubtotal : modalInv.subtotal) + (bookModalVatAmount !== null ? bookModalVatAmount : modalInv.vatAmount))}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Booking rows */}
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Boekingsregels</h4>
                                <button onClick={addBookingRow} className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-medium transition-colors flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                  Regel toevoegen
                                </button>
                              </div>

                              {/* Desktop rows */}
                              <div className="hidden md:block border border-gray-100 rounded-lg overflow-visible">
                                <table className="w-full text-xs">
                                  <thead><tr className="bg-gray-50 text-gray-500 text-[11px]">
                                    <th className="px-2 py-2 text-left font-medium w-[200px]">Grootboek</th>
                                    <th className="px-2 py-2 text-left font-medium w-[160px]">BTW-code</th>
                                    <th className="px-2 py-2 text-right font-medium w-[100px]">Excl. BTW</th>
                                    <th className="px-2 py-2 text-right font-medium w-[90px]">BTW</th>
                                    <th className="px-2 py-2 text-left font-medium">Omschrijving</th>
                                    <th className="px-2 py-2 w-8"></th>
                                  </tr></thead>
                                  <tbody className="divide-y divide-gray-50">
                                    {bookModalRows.map((row, rowIdx) => {
                                      const isRow0 = rowIdx === 0;
                                      const rowExcl = isRow0 ? row0ExclVat : row.exclVat;
                                      const rowVat = isRow0 ? row0VatAmount : row.vatAmount;
                                      const rowLedgerAccounts = filterLedger(row.ledgerSearch);
                                      const rowVatCodes = filterVatCodes(row.vatSearch);
                                      const showLedgerDrop = activeRowDrop?.rowId === row.id && activeRowDrop?.field === "ledger" && !row.ledgerAccount;
                                      const showVatDrop = activeRowDrop?.rowId === row.id && activeRowDrop?.field === "vat" && !row.vatCode;
                                      return (
                                        <tr key={row.id} className={isRow0 ? "bg-blue-50/30" : ""}>
                                          <td className="px-2 py-2">
                                            <div className="relative">
                                              <input type="text" value={row.ledgerSearch}
                                                onChange={(e) => { updateBookingRow(row.id, "ledgerSearch", e.target.value); updateBookingRow(row.id, "ledgerAccount", ""); setActiveRowDrop({ rowId: row.id, field: "ledger" }); }}
                                                onFocus={() => setActiveRowDrop({ rowId: row.id, field: "ledger" })}
                                                onBlur={() => setTimeout(() => { setActiveRowDrop(prev => prev?.rowId === row.id && prev?.field === "ledger" ? null : prev); }, 200)}
                                                placeholder="Zoek rekening..."
                                                className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-[#00AFCB]/30 outline-none" />
                                              {showLedgerDrop && rowLedgerAccounts.length > 0 && (
                                                <div className="absolute z-50 w-72 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto left-0">
                                                  {rowLedgerAccounts.slice(0, 15).map((a) => (
                                                    <button key={a.id} type="button"
                                                      onMouseDown={(e) => e.preventDefault()}
                                                      onClick={() => {
                                                        updateBookingRow(row.id, "ledgerAccount", `${a.accountNumber} ${a.name}`);
                                                        updateBookingRow(row.id, "ledgerSearch", `${a.accountNumber} - ${a.name}`);
                                                        setActiveRowDrop(null);
                                                        if (a.defaultVatCode && !row.vatCode) {
                                                          updateBookingRow(row.id, "vatCode", `${a.defaultVatCode.code} ${a.defaultVatCode.name} ${a.defaultVatCode.percentage}%`);
                                                          updateBookingRow(row.id, "vatSearch", `${a.defaultVatCode.code} - ${a.defaultVatCode.name} (${a.defaultVatCode.percentage}%)`);
                                                        }
                                                      }}
                                                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-xs flex items-center gap-2">
                                                      <span className="font-mono text-gray-400 w-10 shrink-0">{a.accountNumber}</span>
                                                      <span className="text-gray-700 truncate">{a.name}</span>
                                                      {a.defaultVatCode && <span className="ml-auto text-[10px] text-gray-400 shrink-0">{a.defaultVatCode.code}</span>}
                                                    </button>
                                                  ))}
                                                </div>
                                              )}
                                              {row.ledgerAccount && (
                                                <button onClick={() => { updateBookingRow(row.id, "ledgerAccount", ""); updateBookingRow(row.id, "ledgerSearch", ""); }}
                                                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-2 py-2">
                                            <div className="relative">
                                              <input type="text" value={row.vatSearch}
                                                onChange={(e) => { updateBookingRow(row.id, "vatSearch", e.target.value); updateBookingRow(row.id, "vatCode", ""); setActiveRowDrop({ rowId: row.id, field: "vat" }); }}
                                                onFocus={() => setActiveRowDrop({ rowId: row.id, field: "vat" })}
                                                onBlur={() => setTimeout(() => { setActiveRowDrop(prev => prev?.rowId === row.id && prev?.field === "vat" ? null : prev); }, 200)}
                                                placeholder="BTW-code..."
                                                className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-[#00AFCB]/30 outline-none" />
                                              {showVatDrop && rowVatCodes.length > 0 && (
                                                <div className="absolute z-50 w-64 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto left-0">
                                                  {rowVatCodes.map((v) => (
                                                    <button key={v.id} type="button"
                                                      onMouseDown={(e) => e.preventDefault()}
                                                      onClick={() => { updateBookingRow(row.id, "vatCode", `${v.code} ${v.name} ${v.percentage}%`); updateBookingRow(row.id, "vatSearch", `${v.code} - ${v.name} (${v.percentage}%)`); setActiveRowDrop(null); }}
                                                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-xs flex items-center gap-2">
                                                      <span className="font-mono text-blue-600 w-10 shrink-0">{v.code}</span>
                                                      <span className="text-gray-700 truncate">{v.name}</span>
                                                      <span className="ml-auto text-gray-400 shrink-0">{v.percentage}%</span>
                                                    </button>
                                                  ))}
                                                </div>
                                              )}
                                              {row.vatCode && (
                                                <button onClick={() => { updateBookingRow(row.id, "vatCode", ""); updateBookingRow(row.id, "vatSearch", ""); }}
                                                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-2 py-2 text-right">
                                            {isRow0 && bookModalRows.length > 1 ? (
                                              <span className="text-sm font-medium text-gray-700" title="Automatisch berekend resterend bedrag">{formatCurrency(rowExcl)}</span>
                                            ) : (
                                              <input type="number" step="0.01" value={isRow0 ? (row.exclVat || "") : (row.exclVat || "")} onChange={(e) => updateBookingRow(row.id, "exclVat", parseFloat(e.target.value) || 0)}
                                                className={`w-full border rounded px-2 py-1.5 text-xs text-right focus:ring-2 focus:ring-[#00AFCB]/30 outline-none ${isRow0 ? "border-blue-200 bg-blue-50/50" : "border-gray-200"}`} placeholder="0,00" />
                                            )}
                                          </td>
                                          <td className="px-2 py-2 text-right">
                                            {isRow0 && bookModalRows.length > 1 ? (
                                              <span className="text-sm font-medium text-gray-500" title="Automatisch berekend resterend BTW">{formatCurrency(rowVat)}</span>
                                            ) : (
                                              <input type="number" step="0.01" value={isRow0 ? (row.vatAmount || "") : (row.vatAmount || "")} onChange={(e) => updateBookingRow(row.id, "vatAmount", parseFloat(e.target.value) || 0)}
                                                className={`w-full border rounded px-2 py-1.5 text-xs text-right focus:ring-2 focus:ring-[#00AFCB]/30 outline-none ${isRow0 ? "border-blue-200 bg-blue-50/50" : "border-gray-200"}`} placeholder="0,00" />
                                            )}
                                          </td>
                                          <td className="px-2 py-2">
                                            <input type="text" value={row.description} onChange={(e) => updateBookingRow(row.id, "description", e.target.value)}
                                              className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-[#00AFCB]/30 outline-none" placeholder="Omschrijving..." />
                                          </td>
                                          <td className="px-2 py-2">
                                            {!isRow0 && (
                                              <button onClick={() => removeBookingRow(row.id)} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>

                              {/* Mobile rows */}
                              <div className="md:hidden space-y-3">
                                {bookModalRows.map((row, rowIdx) => {
                                  const isRow0 = rowIdx === 0;
                                  const rowExcl = isRow0 ? row0ExclVat : row.exclVat;
                                  const rowVat = isRow0 ? row0VatAmount : row.vatAmount;
                                  const rowLedgerAccounts = filterLedger(row.ledgerSearch);
                                  const rowVatCodes = filterVatCodes(row.vatSearch);
                                  const showLedgerDrop = activeRowDrop?.rowId === row.id && activeRowDrop?.field === "ledger" && !row.ledgerAccount;
                                  const showVatDrop = activeRowDrop?.rowId === row.id && activeRowDrop?.field === "vat" && !row.vatCode;
                                  return (
                                    <div key={row.id} className={`border rounded-lg p-3 space-y-2 ${isRow0 ? "border-blue-200 bg-blue-50/30" : "border-gray-200"}`}>
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-medium text-gray-500 uppercase">Regel {rowIdx + 1} {isRow0 && "(resterend)"}</span>
                                        {!isRow0 && (
                                          <button onClick={() => removeBookingRow(row.id)} className="text-xs text-red-400 hover:text-red-600">Verwijderen</button>
                                        )}
                                      </div>
                                      <div className="relative">
                                        <label className="text-[10px] text-gray-500">Grootboek</label>
                                        <input type="text" value={row.ledgerSearch}
                                          onChange={(e) => { updateBookingRow(row.id, "ledgerSearch", e.target.value); updateBookingRow(row.id, "ledgerAccount", ""); setActiveRowDrop({ rowId: row.id, field: "ledger" }); }}
                                          onFocus={() => setActiveRowDrop({ rowId: row.id, field: "ledger" })}
                                          onBlur={() => setTimeout(() => { setActiveRowDrop(prev => prev?.rowId === row.id && prev?.field === "ledger" ? null : prev); }, 200)}
                                          placeholder="Zoek rekening..."
                                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none" />
                                        {showLedgerDrop && rowLedgerAccounts.length > 0 && (
                                          <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                                            {rowLedgerAccounts.slice(0, 15).map((a) => (
                                              <button key={a.id} type="button" onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => {
                                                  updateBookingRow(row.id, "ledgerAccount", `${a.accountNumber} ${a.name}`);
                                                  updateBookingRow(row.id, "ledgerSearch", `${a.accountNumber} - ${a.name}`);
                                                  setActiveRowDrop(null);
                                                  if (a.defaultVatCode && !row.vatCode) {
                                                    updateBookingRow(row.id, "vatCode", `${a.defaultVatCode.code} ${a.defaultVatCode.name} ${a.defaultVatCode.percentage}%`);
                                                    updateBookingRow(row.id, "vatSearch", `${a.defaultVatCode.code} - ${a.defaultVatCode.name} (${a.defaultVatCode.percentage}%)`);
                                                  }
                                                }}
                                                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex items-center gap-2">
                                                <span className="font-mono text-xs text-gray-400 w-10 shrink-0">{a.accountNumber}</span>
                                                <span className="text-gray-700 truncate">{a.name}</span>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                      <div className="relative">
                                        <label className="text-[10px] text-gray-500">BTW-code</label>
                                        <input type="text" value={row.vatSearch}
                                          onChange={(e) => { updateBookingRow(row.id, "vatSearch", e.target.value); updateBookingRow(row.id, "vatCode", ""); setActiveRowDrop({ rowId: row.id, field: "vat" }); }}
                                          onFocus={() => setActiveRowDrop({ rowId: row.id, field: "vat" })}
                                          onBlur={() => setTimeout(() => { setActiveRowDrop(prev => prev?.rowId === row.id && prev?.field === "vat" ? null : prev); }, 200)}
                                          placeholder="BTW-code..."
                                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none" />
                                        {showVatDrop && rowVatCodes.length > 0 && (
                                          <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                                            {rowVatCodes.map((v) => (
                                              <button key={v.id} type="button" onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => { updateBookingRow(row.id, "vatCode", `${v.code} ${v.name} ${v.percentage}%`); updateBookingRow(row.id, "vatSearch", `${v.code} - ${v.name} (${v.percentage}%)`); setActiveRowDrop(null); }}
                                                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex items-center gap-2">
                                                <span className="font-mono text-xs text-blue-600 w-10 shrink-0">{v.code}</span>
                                                <span className="text-gray-700 truncate">{v.name}</span>
                                                <span className="ml-auto text-xs text-gray-400 shrink-0">{v.percentage}%</span>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="text-[10px] text-gray-500">Excl. BTW</label>
                                          {isRow0 && bookModalRows.length > 1 ? (
                                            <p className="text-sm font-medium text-gray-700 px-2 py-1.5">{formatCurrency(rowExcl)}</p>
                                          ) : (
                                            <input type="number" step="0.01" value={isRow0 ? (row.exclVat || "") : (row.exclVat || "")} onChange={(e) => updateBookingRow(row.id, "exclVat", parseFloat(e.target.value) || 0)}
                                              className={`w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none ${isRow0 ? "border-blue-200 bg-blue-50/50" : "border-gray-200"}`} placeholder="0,00" />
                                          )}
                                        </div>
                                        <div>
                                          <label className="text-[10px] text-gray-500">BTW</label>
                                          {isRow0 && bookModalRows.length > 1 ? (
                                            <p className="text-sm font-medium text-gray-500 px-2 py-1.5">{formatCurrency(rowVat)}</p>
                                          ) : (
                                            <input type="number" step="0.01" value={isRow0 ? (row.vatAmount || "") : (row.vatAmount || "")} onChange={(e) => updateBookingRow(row.id, "vatAmount", parseFloat(e.target.value) || 0)}
                                              className={`w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none ${isRow0 ? "border-blue-200 bg-blue-50/50" : "border-gray-200"}`} placeholder="0,00" />
                                          )}
                                        </div>
                                      </div>
                                      <div>
                                        <label className="text-[10px] text-gray-500">Omschrijving</label>
                                        <input type="text" value={row.description} onChange={(e) => updateBookingRow(row.id, "description", e.target.value)}
                                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none" placeholder="Omschrijving..." />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Totals row */}
                              {(() => {
                                const rowTotal = bookModalRows.reduce((s, r, i) => s + (i === 0 && bookModalRows.length > 1 ? row0ExclVat : r.exclVat) + (i === 0 && bookModalRows.length > 1 ? row0VatAmount : r.vatAmount), 0);
                                const invoiceTotal = modalInv.total;
                                const diff = Math.abs(rowTotal - invoiceTotal);
                                const hasDiff = diff > 0.01;
                                return (
                                  <div className={`rounded-lg p-3 mt-3 ${hasDiff ? "bg-amber-50 border border-amber-200" : "bg-gray-50"}`}>
                                    <div className="flex flex-wrap gap-4 text-xs items-center">
                                      <span className="text-gray-500">Totaal boekingsregels:</span>
                                      <span className="font-medium">{formatCurrency(totalRowsExcl)}</span>
                                      <span className="text-gray-400">+</span>
                                      <span className="font-medium text-gray-600">{formatCurrency(totalRowsVat)} BTW</span>
                                      <span className="text-gray-400">=</span>
                                      <span className={`font-bold ${hasDiff ? "text-amber-700" : "text-gray-900"}`}>{formatCurrency(totalRowsExcl + totalRowsVat)}</span>
                                    </div>
                                    {hasDiff && (
                                      <div className="flex items-center gap-2 mt-2 text-xs text-amber-700">
                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        <span className="font-medium">Verschil van {formatCurrency(diff)} met factuurtotaal ({formatCurrency(invoiceTotal)})</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Footer */}
                          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 shrink-0">
                            <button onClick={() => setBookModalInvoiceId(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Annuleren</button>
                            <button onClick={submitBooking}
                              disabled={bookingLoading === bookModalInvoiceId || !canSubmit}
                              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                              {bookingLoading === bookModalInvoiceId ? "Boeken..." : "Factuur boeken"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Bulk booking confirmation modal */}
                  {showBulkConfirm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowBulkConfirm(false)}>
                      <div className="bg-white rounded-xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-gray-100">
                          <h3 className="text-base font-semibold text-[#3C2C1E]">Boeking bevestigen</h3>
                        </div>
                        <div className="p-6 space-y-4">
                          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                            <div className="flex justify-between text-sm"><span className="text-gray-500">Aantal facturen</span><span className="font-bold">{selectedSalesIds.size}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-gray-500">Grootboekrekening</span><span className="font-medium">{bulkLedgerAccount}</span></div>
                            {bulkVatCode && <div className="flex justify-between text-sm"><span className="text-gray-500">BTW-code</span><span className="font-medium text-blue-600">{bulkVatCode}</span></div>}
                            <div className="flex justify-between text-sm border-t border-gray-200 pt-2 mt-2">
                              <span className="text-gray-500">Totaalbedrag</span>
                              <span className="font-bold text-lg">{formatCurrency([...selectedSalesIds].reduce((s, id) => { const inv = invoices.find((i) => i.id === id); return s + (inv?.total || 0); }, 0))}</span>
                            </div>
                          </div>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {[...selectedSalesIds].map((sid) => {
                              const inv = invoices.find((i) => i.id === sid);
                              return inv ? (
                                <div key={sid} className="flex justify-between text-xs px-2 py-1.5 bg-gray-50 rounded">
                                  <span className="font-medium">{inv.invoiceNumber}</span>
                                  <span className="text-gray-500 truncate mx-2">{inv.customerName}</span>
                                  <span className="font-medium shrink-0">{formatCurrency(inv.total)}</span>
                                </div>
                              ) : null;
                            })}
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => setShowBulkConfirm(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Annuleren</button>
                            <button onClick={async () => { setShowBulkConfirm(false); await doBulkBook(); }}
                              disabled={bulkBookingLoading}
                              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                              {bulkBookingLoading ? "Boeken..." : `Boek ${selectedSalesIds.size} facturen`}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* ═══ BOEKINGEN ═══ */}
      {section === "boekingen" && (() => {
        const bookedInvoices = invoices.filter((i) => i.bookkeepingStatus === "booked" || i.bookkeepingStatus === "processed");
        const [boekingenFilterVal, setBoekingenFilterVal] = [filter, setFilter];
        const [boekingenClientVal, setBoekingenClientVal] = [clientFilter, setClientFilter];
        const filteredBooked = bookedInvoices.filter((inv) => {
          if (boekingenFilterVal !== "all" && inv.bookkeepingStatus !== boekingenFilterVal) return false;
          if (boekingenClientVal !== "all" && inv.clientId !== boekingenClientVal) return false;
          return true;
        });
        const boekingenClients = clients.filter((c) => c.role === "client" && bookedInvoices.some((i) => i.clientId === c.id));
        const totalBooked = bookedInvoices.filter((i) => i.bookkeepingStatus === "booked").length;
        const totalProcessed = bookedInvoices.filter((i) => i.bookkeepingStatus === "processed").length;
        const totalAmount = bookedInvoices.reduce((s, i) => s + i.total, 0);
        const totalVat = bookedInvoices.reduce((s, i) => s + i.vatAmount, 0);

        // Ledger drill-down grouping
        const ledgerGroups = new Map<string, { account: string; invoices: Invoice[]; total: number; vatTotal: number }>();
        bookedInvoices.forEach((inv) => {
          const key = inv.category || "Geen rekening";
          const group = ledgerGroups.get(key) || { account: key, invoices: [], total: 0, vatTotal: 0 };
          group.invoices.push(inv);
          group.total += inv.total;
          group.vatTotal += inv.vatAmount;
          ledgerGroups.set(key, group);
        });
        const ledgerGroupsArr = [...ledgerGroups.values()].sort((a, b) => b.total - a.total);
        const filteredLedgerGroups = boekingenLedgerFilter
          ? ledgerGroupsArr.filter((g) => g.account.toLowerCase().includes(boekingenLedgerFilter.toLowerCase()))
          : ledgerGroupsArr;

        async function markProcessed(invoiceId: string) {
          setBookingLoading(invoiceId);
          try {
            const res = await fetch(`/api/invoices/${invoiceId}`, {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ bookkeepingStatus: "processed" }),
            });
            if (res.ok) {
              setInvoices((prev) => prev.map((inv) => inv.id === invoiceId ? { ...inv, bookkeepingStatus: "processed" } : inv));
            }
          } catch { /* */ }
          finally { setBookingLoading(null); }
        }

        async function batchProcess() {
          const ids = filteredBooked.filter((i) => i.bookkeepingStatus === "booked").map((i) => i.id);
          if (ids.length === 0) return;
          setBulkBookingLoading(true);
          try {
            const res = await fetch("/api/invoices/batch-book", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ invoiceIds: ids, bookkeepingStatus: "processed" }),
            });
            if (res.ok) {
              setInvoices((prev) => prev.map((inv) => ids.includes(inv.id) ? { ...inv, bookkeepingStatus: "processed" } : inv));
            }
          } catch { /* */ }
          finally { setBulkBookingLoading(false); }
        }

        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#3C2C1E]">Boekingen</h1>
                <p className="text-sm text-[#6F5C4B]/70 mt-1">Alle geboekte facturen — verwerk voor BTW-aangifte</p>
              </div>
            </div>

            {/* Stats with quarter detection */}
            {(() => {
              const now = new Date();
              const currentQ = Math.floor(now.getMonth() / 3);
              const currentY = now.getFullYear();
              const oldQBookings = bookedInvoices.filter((i) => {
                if (i.bookkeepingStatus !== "booked") return false;
                const d = new Date(i.date);
                const q = Math.floor(d.getMonth() / 3);
                return d.getFullYear() < currentY || (d.getFullYear() === currentY && q < currentQ);
              });
              const newBookings = bookedInvoices.filter((i) => {
                if (i.bookkeepingStatus !== "booked") return false;
                const d = new Date(i.date);
                const q = Math.floor(d.getMonth() / 3);
                return d.getFullYear() === currentY && q === currentQ;
              });
              return (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="text-xs text-gray-500">Totaal geboekt</p>
                    <p className="text-xl font-bold text-[#004854]">{bookedInvoices.length}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 shadow-sm border border-blue-200">
                    <p className="text-xs text-blue-700 font-medium">Nieuw dit kwartaal</p>
                    <p className="text-xl font-bold text-blue-600">{newBookings.length}</p>
                  </div>
                  {oldQBookings.length > 0 ? (
                    <div className="bg-red-50 rounded-xl p-4 shadow-sm border-2 border-red-300 animate-pulse-subtle">
                      <p className="text-xs text-red-700 font-bold">Ouder kwartaal!</p>
                      <p className="text-xl font-bold text-red-600">{oldQBookings.length}</p>
                      <p className="text-[10px] text-red-500 font-medium">Verwerk voor BTW-aangifte</p>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 rounded-xl p-4 shadow-sm border border-emerald-200">
                      <p className="text-xs text-emerald-700 font-medium">Ouder kwartaal</p>
                      <p className="text-xl font-bold text-emerald-600">0</p>
                      <p className="text-[10px] text-emerald-500">Alles verwerkt!</p>
                    </div>
                  )}
                  <div className="bg-emerald-50 rounded-xl p-4 shadow-sm border border-emerald-200">
                    <p className="text-xs text-emerald-700 font-medium">Verwerkt (BTW)</p>
                    <p className="text-xl font-bold text-emerald-600">{totalProcessed}</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="text-xs text-gray-500">Totaal BTW</p>
                    <p className="text-lg font-bold text-[#004854]">{formatCurrency(totalVat)}</p>
                    <p className="text-[10px] text-gray-400">excl. {formatCurrency(totalAmount - totalVat)}</p>
                  </div>
                </div>
              );
            })()}

            {/* View switcher */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
              <button onClick={() => setBoekingenView("overview")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${boekingenView === "overview" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                Overzicht
              </button>
              <button onClick={() => setBoekingenView("ledger")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${boekingenView === "ledger" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                Per grootboekrekening
              </button>
            </div>

            {/* ── Overview view ── */}
            {boekingenView === "overview" && (
              <>
                {/* Filters */}
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-center">
                  <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
                    {(["all", "booked", "processed"] as const).map((f) => (
                      <button key={f} onClick={() => setBoekingenFilterVal(f)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${boekingenFilterVal === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                        {{ all: "Alles", booked: "Geboekt", processed: "Verwerkt" }[f]}
                      </button>
                    ))}
                  </div>
                  <select value={boekingenClientVal} onChange={(e) => setBoekingenClientVal(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none">
                    <option value="all">Alle klanten</option>
                    {boekingenClients.map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
                  </select>
                  {filteredBooked.filter((i) => i.bookkeepingStatus === "booked").length > 0 && (
                    <button onClick={batchProcess} disabled={bulkBookingLoading}
                      className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      {bulkBookingLoading ? "Verwerken..." : `${filteredBooked.filter((i) => i.bookkeepingStatus === "booked").length} facturen verwerken voor BTW`}
                    </button>
                  )}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-[11px] text-gray-500 border-b border-gray-100 bg-gray-50">
                        <th className="px-4 py-3 font-medium">Factuurnr.</th>
                        <th className="px-3 py-3 font-medium">Klant</th>
                        <th className="px-3 py-3 font-medium">Debiteur</th>
                        <th className="px-3 py-3 font-medium">Datum</th>
                        <th className="px-3 py-3 font-medium text-right">Excl. BTW</th>
                        <th className="px-3 py-3 font-medium text-right">BTW</th>
                        <th className="px-3 py-3 font-medium text-right">Incl. BTW</th>
                        <th className="px-3 py-3 font-medium">Rekening</th>
                        <th className="px-3 py-3 font-medium">BTW-code</th>
                        <th className="px-3 py-3 font-medium">Bron</th>
                        <th className="px-3 py-3 font-medium">Status</th>
                        <th className="px-3 py-3 font-medium text-right">Actie</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredBooked.map((inv) => {
                        const client = clients.find((c) => c.id === inv.clientId);
                        return (
                          <tr key={inv.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-sm">{inv.invoiceNumber}</td>
                            <td className="px-3 py-3 text-sm text-gray-600">{client?.company || client?.name || "\u2014"}</td>
                            <td className="px-3 py-3 text-sm text-gray-700">{inv.customerName}</td>
                            <td className="px-3 py-3 text-sm text-gray-600">{formatDate(inv.date)}</td>
                            <td className="px-3 py-3 text-sm text-right">{formatCurrency(inv.subtotal)}</td>
                            <td className="px-3 py-3 text-sm text-right text-gray-500">{formatCurrency(inv.vatAmount)}</td>
                            <td className="px-3 py-3 text-sm text-right font-semibold">{formatCurrency(inv.total)}</td>
                            <td className="px-3 py-3 text-xs text-gray-500 max-w-[120px] truncate">{inv.category || <span className="text-gray-300">&mdash;</span>}</td>
                            <td className="px-3 py-3 text-xs text-gray-500 max-w-[100px] truncate">{inv.vatType || <span className="text-gray-300">&mdash;</span>}</td>
                            <td className="px-3 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600">Verkoop</span></td>
                            <td className="px-3 py-3"><StatusBadge status={inv.bookkeepingStatus} /></td>
                            <td className="px-3 py-3 text-right">
                              <div className="flex gap-2 justify-end">
                                {inv.bookkeepingStatus === "booked" && (
                                  <button onClick={() => markProcessed(inv.id)} disabled={bookingLoading === inv.id}
                                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                                    {bookingLoading === inv.id ? "..." : "Verwerken"}
                                  </button>
                                )}
                                <Link href={`/bookkeeper/invoices/${inv.id}`} className="text-sm text-[#00AFCB] hover:text-[#004854] font-medium py-1">Bekijken</Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredBooked.length === 0 && <tr><td colSpan={12} className="px-5 py-12 text-center text-gray-400">Geen geboekte facturen gevonden.</td></tr>}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {filteredBooked.map((inv) => {
                    const client = clients.find((c) => c.id === inv.clientId);
                    return (
                      <div key={inv.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#004854]">{inv.invoiceNumber}</p>
                            <p className="text-sm text-gray-900 mt-0.5">{inv.customerName}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{client?.company || client?.name} &middot; {formatDate(inv.date)}</p>
                            {inv.category && <p className="text-[10px] text-gray-400 mt-0.5">{inv.category}</p>}
                            {inv.vatType && <p className="text-[10px] text-blue-500 mt-0.5">{inv.vatType}</p>}
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600">Verkoop</span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-semibold text-sm">{formatCurrency(inv.total)}</p>
                            <p className="text-xs text-gray-500">{formatCurrency(inv.subtotal)} + {formatCurrency(inv.vatAmount)}</p>
                            <div className="mt-1"><StatusBadge status={inv.bookkeepingStatus} /></div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                          {inv.bookkeepingStatus === "booked" && (
                            <button onClick={() => markProcessed(inv.id)} disabled={bookingLoading === inv.id}
                              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                              {bookingLoading === inv.id ? "..." : "Verwerken voor BTW"}
                            </button>
                          )}
                          <Link href={`/bookkeeper/invoices/${inv.id}`} className="text-xs px-3 py-1.5 text-[#00AFCB] hover:text-[#004854] font-medium">Bekijken</Link>
                        </div>
                      </div>
                    );
                  })}
                  {filteredBooked.length === 0 && <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-12 text-center text-gray-400">Geen geboekte facturen gevonden.</div>}
                </div>
              </>
            )}

            {/* ── Ledger drill-down view ── */}
            {boekingenView === "ledger" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <input type="text" value={boekingenLedgerFilter} onChange={(e) => setBoekingenLedgerFilter(e.target.value)}
                    placeholder="Zoek grootboekrekening..."
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none min-w-[250px]" />
                  <span className="text-xs text-gray-500">{filteredLedgerGroups.length} rekeningen</span>
                </div>

                {filteredLedgerGroups.length === 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-12 text-center text-gray-400">Geen boekingen op grootboekrekeningen gevonden.</div>
                )}

                <div className="space-y-2">
                  {filteredLedgerGroups.map((group) => {
                    const isExpanded = expandedLedgers.has(group.account);
                    return (
                      <div key={group.account} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <button onClick={() => setExpandedLedgers((prev) => { const n = new Set(prev); if (n.has(group.account)) n.delete(group.account); else n.add(group.account); return n; })}
                          className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
                          <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                            <span className="text-sm font-medium text-[#3C2C1E] truncate">{group.account}</span>
                            <span className="text-xs text-gray-400">{group.invoices.length} boeking{group.invoices.length !== 1 ? "en" : ""}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-[#004854]">{formatCurrency(group.total)}</p>
                            <p className="text-[10px] text-gray-400">BTW: {formatCurrency(group.vatTotal)}</p>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="border-t border-gray-100">
                            {/* Desktop sub-table */}
                            <div className="hidden md:block overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead><tr className="bg-gray-50/50 text-[10px] text-gray-500">
                                  <th className="px-4 py-2 text-left font-medium">Factuurnr.</th>
                                  <th className="px-3 py-2 text-left font-medium">Debiteur</th>
                                  <th className="px-3 py-2 text-left font-medium">Datum</th>
                                  <th className="px-3 py-2 text-right font-medium">Excl. BTW</th>
                                  <th className="px-3 py-2 text-right font-medium">BTW</th>
                                  <th className="px-3 py-2 text-right font-medium">Totaal</th>
                                  <th className="px-3 py-2 text-left font-medium">Bron</th>
                                  <th className="px-3 py-2 text-left font-medium">Status</th>
                                  <th className="px-3 py-2 text-right font-medium">Actie</th>
                                </tr></thead>
                                <tbody className="divide-y divide-gray-50">
                                  {group.invoices.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-gray-50/50">
                                      <td className="px-4 py-2 font-medium">{inv.invoiceNumber}</td>
                                      <td className="px-3 py-2 text-gray-600">{inv.customerName}</td>
                                      <td className="px-3 py-2 text-gray-500">{formatDate(inv.date)}</td>
                                      <td className="px-3 py-2 text-right">{formatCurrency(inv.subtotal)}</td>
                                      <td className="px-3 py-2 text-right text-gray-400">{formatCurrency(inv.vatAmount)}</td>
                                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(inv.total)}</td>
                                      <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-blue-50 text-blue-600">Verkoop</span></td>
                                      <td className="px-3 py-2"><StatusBadge status={inv.bookkeepingStatus} /></td>
                                      <td className="px-3 py-2 text-right">
                                        <Link href={`/bookkeeper/invoices/${inv.id}`} className="text-[#00AFCB] hover:text-[#004854] font-medium">Bekijken</Link>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {/* Mobile sub-cards */}
                            <div className="md:hidden divide-y divide-gray-50">
                              {group.invoices.map((inv) => (
                                <div key={inv.id} className="px-4 py-3 flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-[#004854]">{inv.invoiceNumber}</p>
                                    <p className="text-xs text-gray-600">{inv.customerName}</p>
                                    <p className="text-[10px] text-gray-400">{formatDate(inv.date)}</p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-xs font-semibold">{formatCurrency(inv.total)}</p>
                                    <StatusBadge status={inv.bookkeepingStatus} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══ INKOOP ═══ */}
      {section === "inkoop" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#3C2C1E]">Inkoop</h1>
              <p className="text-sm text-[#6F5C4B]/70 mt-1">Boeken en crediteurenbeheer</p>
            </div>
          </div>

          {/* Sub-tab switcher */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            <button onClick={() => setInkoopTab("boeken")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${inkoopTab === "boeken" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Boeken</button>
            <button onClick={() => setInkoopTab("crediteurenbeheer")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${inkoopTab === "crediteurenbeheer" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Crediteurenbeheer</button>
          </div>

          {/* ─── INKOOP BOEKEN TAB ─── */}
          {inkoopTab === "boeken" && (<>
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
          </>)}

          {/* ─── INKOOP CREDITEURENBEHEER TAB ─── */}
          {inkoopTab === "crediteurenbeheer" && (() => {
            const inkoopClients = clients.filter((c) => c.role === "client");
            const inkoopClientDocs = inkoopBoekenClient ? purchaseDocs.filter((d) => d.userId === inkoopBoekenClient) : [];
            const openDocs = inkoopClientDocs.filter((d) => d.status === "uploaded" || d.status === "processing");
            const paidDocs = inkoopClientDocs.filter((d) => d.status === "booked");
            const totalOpen = openDocs.reduce((s, d) => s + (d.totalAmount || 0), 0);
            const overdueDocs = inkoopClientDocs.filter((d) => d.dueDate && new Date(d.dueDate) < new Date() && d.status !== "booked");

            return (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <select value={inkoopBoekenClient} onChange={(e) => setInkoopBoekenClient(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none min-w-[200px]">
                    <option value="">Selecteer een klant...</option>
                    {inkoopClients.map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
                  </select>
                </div>

                {!inkoopBoekenClient && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
                    <p className="text-sm text-gray-500">Selecteer een klant om het crediteurenbeheer te openen.</p>
                    <p className="text-xs text-gray-400 mt-1">Beheer openstaande inkoopfacturen en volg crediteuren op.</p>
                  </div>
                )}

                {inkoopBoekenClient && (
                  <div className="space-y-4">
                    {/* Summary tiles */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                        <p className="text-xs text-gray-500">Totaal</p>
                        <p className="text-lg font-bold text-[#004854]">{inkoopClientDocs.length}</p>
                      </div>
                      <div className={`rounded-xl p-4 shadow-sm border ${openDocs.length > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-gray-100"}`}>
                        <p className="text-xs text-amber-700 font-medium">Openstaand</p>
                        <p className="text-lg font-bold text-amber-600">{openDocs.length}</p>
                        <p className="text-xs text-gray-400">{formatCurrency(totalOpen)}</p>
                      </div>
                      <div className={`rounded-xl p-4 shadow-sm border ${overdueDocs.length > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-100"}`}>
                        <p className={`text-xs ${overdueDocs.length > 0 ? "text-red-700 font-semibold" : "text-gray-500"}`}>Verlopen</p>
                        <p className={`text-lg font-bold ${overdueDocs.length > 0 ? "text-red-600" : "text-gray-400"}`}>{overdueDocs.length}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-4 shadow-sm border border-emerald-200">
                        <p className="text-xs text-emerald-700 font-medium">Geboekt</p>
                        <p className="text-lg font-bold text-emerald-600">{paidDocs.length}</p>
                      </div>
                    </div>

                    {/* Document list for selected client */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                      {inkoopClientDocs.length === 0 ? (
                        <div className="p-8 text-center">
                          <p className="text-sm text-gray-500">Geen inkoopdocumenten voor deze klant.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {inkoopClientDocs.map((doc) => {
                            const isOverdue = doc.dueDate && new Date(doc.dueDate) < new Date() && doc.status !== "booked";
                            return (
                              <button key={doc.id} onClick={() => setPurchaseViewDoc(doc)}
                                className={`w-full text-left px-4 sm:px-5 py-4 hover:bg-gray-50 transition-colors ${isOverdue ? "bg-red-50/50" : ""}`}>
                                <div className="flex items-center gap-3 sm:gap-4">
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${doc.fileType === "pdf" ? "bg-red-50" : "bg-blue-50"}`}>
                                    {doc.fileType === "pdf" ? (
                                      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                    ) : (
                                      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{doc.supplierName || doc.label || doc.fileName}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {doc.documentDate ? formatDate(doc.documentDate) : formatDate(doc.createdAt.split("T")[0])}
                                      {doc.invoiceNumber && <> &middot; #{doc.invoiceNumber}</>}
                                      {doc.dueDate && <> &middot; vervalt {formatDate(doc.dueDate)}</>}
                                    </p>
                                    {isOverdue && <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700">VERLOPEN</span>}
                                  </div>
                                  <div className="text-right shrink-0">
                                    {doc.totalAmount != null && <p className="text-sm font-semibold">{formatCurrency(doc.totalAmount)}</p>}
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${purchaseStatusColors[doc.status] || "bg-gray-100"}`}>
                                      {purchaseStatusLabels[doc.status] || doc.status}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ═══ MEMORIAAL ═══ */}
      {section === "memoriaal" && (() => {
        const allActiveAccounts = ledgerAccounts.filter((a) => a.isActive);
        const allActiveVatCodes = vatCodes.filter((v) => v.isActive);

        function filterMemLedger(search: string) {
          if (!search) return allActiveAccounts.slice(0, 15);
          const s = search.toLowerCase();
          return allActiveAccounts.filter((a) => a.accountNumber.startsWith(search) || a.name.toLowerCase().includes(s) || a.accountNumber.includes(search)).slice(0, 15);
        }

        function filterMemVat(search: string) {
          if (!search) return allActiveVatCodes;
          const s = search.toLowerCase();
          return allActiveVatCodes.filter((v) => v.code.toLowerCase().includes(s) || v.name.toLowerCase().includes(s)).slice(0, 10);
        }

        function openNewJournal(type: "memoriaal" | "beginbalans") {
          setEditingJournal(null);
          setJournalForm({ date: new Date().toISOString().split("T")[0], description: "", type });
          setJournalLines([
            { id: "jl-1", ledgerAccount: "", ledgerSearch: "", debit: 0, credit: 0, description: "", vatCode: "", vatSearch: "" },
            { id: "jl-2", ledgerAccount: "", ledgerSearch: "", debit: 0, credit: 0, description: "", vatCode: "", vatSearch: "" },
          ]);
          setShowJournalModal(true);
        }

        function addJournalLine() {
          setJournalLines(prev => [...prev, { id: `jl-${Date.now()}`, ledgerAccount: "", ledgerSearch: "", debit: 0, credit: 0, description: "", vatCode: "", vatSearch: "" }]);
        }

        function updateJournalLine(id: string, field: string, value: string | number) {
          setJournalLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
        }

        function removeJournalLine(id: string) {
          setJournalLines(prev => prev.filter(l => l.id !== id));
        }

        async function saveJournal() {
          const totalD = journalLines.reduce((s, l) => s + (l.debit || 0), 0);
          const totalC = journalLines.reduce((s, l) => s + (l.credit || 0), 0);
          if (Math.abs(totalD - totalC) > 0.01) {
            addToast({ type: "error", title: "Niet in balans", message: `Debet (${formatCurrency(totalD)}) en credit (${formatCurrency(totalC)}) moeten gelijk zijn.` });
            return;
          }
          if (!journalForm.description.trim()) {
            addToast({ type: "error", title: "Omschrijving ontbreekt", message: "Voer een omschrijving in." });
            return;
          }
          if (journalLines.some(l => !l.ledgerAccount)) {
            addToast({ type: "error", title: "Grootboek ontbreekt", message: "Selecteer een grootboekrekening per regel." });
            return;
          }
          setJournalSaving(true);
          try {
            const body = {
              date: journalForm.date,
              description: journalForm.description,
              type: journalForm.type,
              lines: journalLines.map(l => ({
                ledgerAccount: l.ledgerAccount,
                debit: l.debit || 0,
                credit: l.credit || 0,
                description: l.description || undefined,
                vatCode: l.vatCode || undefined,
              })),
            };
            const url = editingJournal ? `/api/journal-entries/${editingJournal.id}` : "/api/journal-entries";
            const method = editingJournal ? "PATCH" : "POST";
            const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            if (res.ok) {
              const entry = await res.json();
              if (editingJournal) {
                setJournalEntries(prev => prev.map(e => e.id === entry.id ? entry : e));
              } else {
                setJournalEntries(prev => [entry, ...prev]);
              }
              setShowJournalModal(false);
              addToast({ type: "bookkeeping", title: editingJournal ? "Boeking bijgewerkt" : "Boeking aangemaakt", message: `${entry.reference} - ${entry.description}` });
            } else {
              const data = await res.json();
              addToast({ type: "error", title: "Fout", message: data.error || "Er ging iets mis" });
            }
          } catch { addToast({ type: "error", title: "Fout", message: "Er ging iets mis" }); }
          finally { setJournalSaving(false); }
        }

        async function bookJournal(id: string) {
          setJournalSaving(true);
          try {
            const res = await fetch(`/api/journal-entries/${id}`, {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "booked" }),
            });
            if (res.ok) {
              const entry = await res.json();
              setJournalEntries(prev => prev.map(e => e.id === id ? entry : e));
              addToast({ type: "bookkeeping", title: "Memoriaalboeking verwerkt", message: `${entry.reference} is geboekt` });
            }
          } catch { /* */ }
          finally { setJournalSaving(false); }
        }

        async function deleteJournal(id: string) {
          try {
            const res = await fetch(`/api/journal-entries/${id}`, { method: "DELETE" });
            if (res.ok) {
              setJournalEntries(prev => prev.filter(e => e.id !== id));
              addToast({ type: "success", title: "Verwijderd", message: "Memoriaalboeking verwijderd" });
            }
          } catch { /* */ }
        }

        const drafts = journalEntries.filter(e => e.status === "draft");
        const booked = journalEntries.filter(e => e.status === "booked");

        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#3C2C1E]">Memoriaal</h1>
                <p className="text-sm text-[#6F5C4B]/70 mt-1">Handmatige journaalboekingen en beginbalans</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openNewJournal("beginbalans")}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                  Beginbalans
                </button>
                <button onClick={() => openNewJournal("memoriaal")}
                  className="px-4 py-2 bg-[#004854] text-white rounded-lg text-sm font-medium hover:bg-[#003640] transition-colors">
                  + Nieuwe boeking
                </button>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500">Totaal</p>
                <p className="text-xl font-bold text-[#004854]">{journalEntries.length}</p>
              </div>
              <div className={`rounded-xl p-4 shadow-sm border ${drafts.length > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-gray-100"}`}>
                <p className="text-xs text-amber-700 font-medium">Concept</p>
                <p className="text-xl font-bold text-amber-600">{drafts.length}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4 shadow-sm border border-emerald-200">
                <p className="text-xs text-emerald-700 font-medium">Geboekt</p>
                <p className="text-xl font-bold text-emerald-600">{booked.length}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500">Totaal bedrag</p>
                <p className="text-lg font-bold text-[#004854]">{formatCurrency(journalEntries.reduce((s, e) => s + e.totalDebit, 0))}</p>
              </div>
            </div>

            {/* Journal entries list */}
            {journalEntries.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 sm:p-12 text-center">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                <p className="text-sm text-gray-500">Nog geen memoriaalboekingen.</p>
                <p className="text-xs text-gray-400 mt-1">Maak een memoriaalboeking of beginbalans aan.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {journalEntries.map((entry) => (
                  <div key={entry.id} className={`bg-white rounded-xl shadow-sm border p-4 sm:p-5 ${entry.status === "draft" ? "border-amber-200" : "border-gray-100"}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#004854]">{entry.reference}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${entry.type === "beginbalans" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                            {entry.type === "beginbalans" ? "Beginbalans" : "Memoriaal"}
                          </span>
                          <StatusBadge status={entry.status} />
                        </div>
                        <p className="text-sm text-gray-700 mt-0.5">{entry.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(entry.date)} &middot; {entry.lines.length} regels</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatCurrency(entry.totalDebit)}</p>
                          <p className="text-[10px] text-gray-400">debet = credit</p>
                        </div>
                        <div className="flex gap-1">
                          {entry.status === "draft" && (
                            <>
                              <button onClick={() => {
                                setEditingJournal(entry);
                                setJournalForm({ date: entry.date, description: entry.description, type: entry.type as "memoriaal" | "beginbalans" });
                                setJournalLines(entry.lines.map(l => ({
                                  id: l.id, ledgerAccount: l.ledgerAccount, ledgerSearch: l.ledgerAccount,
                                  debit: l.debit, credit: l.credit, description: l.description || "",
                                  vatCode: l.vatCode || "", vatSearch: l.vatCode || "",
                                })));
                                setShowJournalModal(true);
                              }} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600" title="Bewerken">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button onClick={() => bookJournal(entry.id)} disabled={journalSaving}
                                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50">
                                Boeken
                              </button>
                              <button onClick={() => { if (confirm("Weet je het zeker?")) deleteJournal(entry.id); }}
                                className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500" title="Verwijderen">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Expandable lines preview */}
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead><tr className="text-gray-400 text-[10px]">
                            <th className="text-left py-1 font-medium">Rekening</th>
                            <th className="text-right py-1 font-medium">Debet</th>
                            <th className="text-right py-1 font-medium">Credit</th>
                            <th className="text-left py-1 font-medium">Omschrijving</th>
                          </tr></thead>
                          <tbody>
                            {entry.lines.map((line) => (
                              <tr key={line.id} className="border-t border-gray-50">
                                <td className="py-1 text-gray-700">{line.ledgerAccount}</td>
                                <td className="py-1 text-right">{line.debit > 0 ? formatCurrency(line.debit) : ""}</td>
                                <td className="py-1 text-right">{line.credit > 0 ? formatCurrency(line.credit) : ""}</td>
                                <td className="py-1 text-gray-500">{line.description || ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Journal entry modal */}
            {showJournalModal && (() => {
              const totalD = journalLines.reduce((s, l) => s + (l.debit || 0), 0);
              const totalC = journalLines.reduce((s, l) => s + (l.credit || 0), 0);
              const balanced = Math.abs(totalD - totalC) < 0.01;

              return (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowJournalModal(false)}>
                  <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                      <h3 className="text-base font-semibold text-[#3C2C1E]">{editingJournal ? "Boeking bewerken" : journalForm.type === "beginbalans" ? "Beginbalans invoeren" : "Nieuwe memoriaalboeking"}</h3>
                      <button onClick={() => setShowJournalModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-5">
                      {/* Form fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                          <select value={journalForm.type} onChange={(e) => setJournalForm(prev => ({ ...prev, type: e.target.value as "memoriaal" | "beginbalans" }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none">
                            <option value="memoriaal">Memoriaal</option>
                            <option value="beginbalans">Beginbalans</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Datum</label>
                          <input type="date" value={journalForm.date} onChange={(e) => setJournalForm(prev => ({ ...prev, date: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Omschrijving</label>
                          <input type="text" value={journalForm.description} onChange={(e) => setJournalForm(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none"
                            placeholder="Omschrijving van de boeking..." />
                        </div>
                      </div>

                      {/* Lines */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Boekingsregels</h4>
                          <button onClick={addJournalLine} className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-medium transition-colors flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Regel toevoegen
                          </button>
                        </div>

                        {/* Desktop table */}
                        <div className="hidden md:block border border-gray-100 rounded-lg overflow-visible">
                          <table className="w-full text-xs">
                            <thead><tr className="bg-gray-50 text-gray-500 text-[11px]">
                              <th className="px-2 py-2 text-left font-medium w-[220px]">Grootboek</th>
                              <th className="px-2 py-2 text-left font-medium w-[140px]">BTW-code</th>
                              <th className="px-2 py-2 text-right font-medium w-[100px]">Debet</th>
                              <th className="px-2 py-2 text-right font-medium w-[100px]">Credit</th>
                              <th className="px-2 py-2 text-left font-medium">Omschrijving</th>
                              <th className="px-2 py-2 w-8"></th>
                            </tr></thead>
                            <tbody className="divide-y divide-gray-50">
                              {journalLines.map((line) => {
                                const matchedLedger = filterMemLedger(line.ledgerSearch);
                                const matchedVat = filterMemVat(line.vatSearch);
                                const showLDrop = journalLedgerDrop === line.id && !line.ledgerAccount;
                                const showVDrop = journalVatDrop === line.id && !line.vatCode;
                                return (
                                  <tr key={line.id}>
                                    <td className="px-2 py-2">
                                      <div className="relative">
                                        <input type="text" value={line.ledgerSearch}
                                          onChange={(e) => { updateJournalLine(line.id, "ledgerSearch", e.target.value); updateJournalLine(line.id, "ledgerAccount", ""); setJournalLedgerDrop(line.id); }}
                                          onFocus={() => setJournalLedgerDrop(line.id)}
                                          onBlur={() => setTimeout(() => setJournalLedgerDrop(prev => prev === line.id ? null : prev), 200)}
                                          placeholder="Zoek rekening..."
                                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-[#00AFCB]/30 outline-none" />
                                        {showLDrop && matchedLedger.length > 0 && (
                                          <div className="absolute z-50 w-72 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto left-0">
                                            {matchedLedger.map((a) => (
                                              <button key={a.id} type="button" onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => {
                                                  updateJournalLine(line.id, "ledgerAccount", `${a.accountNumber} ${a.name}`);
                                                  updateJournalLine(line.id, "ledgerSearch", `${a.accountNumber} - ${a.name}`);
                                                  setJournalLedgerDrop(null);
                                                }}
                                                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-xs flex items-center gap-2">
                                                <span className="font-mono text-gray-400 w-10 shrink-0">{a.accountNumber}</span>
                                                <span className="text-gray-700 truncate">{a.name}</span>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                        {line.ledgerAccount && (
                                          <button onClick={() => { updateJournalLine(line.id, "ledgerAccount", ""); updateJournalLine(line.id, "ledgerSearch", ""); }}
                                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-2 py-2">
                                      <div className="relative">
                                        <input type="text" value={line.vatSearch}
                                          onChange={(e) => { updateJournalLine(line.id, "vatSearch", e.target.value); updateJournalLine(line.id, "vatCode", ""); setJournalVatDrop(line.id); }}
                                          onFocus={() => setJournalVatDrop(line.id)}
                                          onBlur={() => setTimeout(() => setJournalVatDrop(prev => prev === line.id ? null : prev), 200)}
                                          placeholder="BTW-code..."
                                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-[#00AFCB]/30 outline-none" />
                                        {showVDrop && matchedVat.length > 0 && (
                                          <div className="absolute z-50 w-64 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto left-0">
                                            {matchedVat.map((v) => (
                                              <button key={v.id} type="button" onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => { updateJournalLine(line.id, "vatCode", `${v.code} ${v.name}`); updateJournalLine(line.id, "vatSearch", `${v.code} - ${v.name} (${v.percentage}%)`); setJournalVatDrop(null); }}
                                                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-xs flex items-center gap-2">
                                                <span className="font-mono text-blue-600 w-10 shrink-0">{v.code}</span>
                                                <span className="text-gray-700 truncate">{v.name}</span>
                                                <span className="ml-auto text-gray-400 shrink-0">{v.percentage}%</span>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-2 py-2">
                                      <input type="number" step="0.01" value={line.debit || ""} onChange={(e) => updateJournalLine(line.id, "debit", parseFloat(e.target.value) || 0)}
                                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs text-right focus:ring-2 focus:ring-[#00AFCB]/30 outline-none" placeholder="0,00" />
                                    </td>
                                    <td className="px-2 py-2">
                                      <input type="number" step="0.01" value={line.credit || ""} onChange={(e) => updateJournalLine(line.id, "credit", parseFloat(e.target.value) || 0)}
                                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs text-right focus:ring-2 focus:ring-[#00AFCB]/30 outline-none" placeholder="0,00" />
                                    </td>
                                    <td className="px-2 py-2">
                                      <input type="text" value={line.description} onChange={(e) => updateJournalLine(line.id, "description", e.target.value)}
                                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-[#00AFCB]/30 outline-none" placeholder="Omschrijving..." />
                                    </td>
                                    <td className="px-2 py-2">
                                      {journalLines.length > 2 && (
                                        <button onClick={() => removeJournalLine(line.id)} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500">
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile lines */}
                        <div className="md:hidden space-y-3">
                          {journalLines.map((line, idx) => (
                            <div key={line.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-medium text-gray-500 uppercase">Regel {idx + 1}</span>
                                {journalLines.length > 2 && (
                                  <button onClick={() => removeJournalLine(line.id)} className="text-xs text-red-400 hover:text-red-600">Verwijderen</button>
                                )}
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-500">Grootboek</label>
                                <input type="text" value={line.ledgerSearch}
                                  onChange={(e) => { updateJournalLine(line.id, "ledgerSearch", e.target.value); updateJournalLine(line.id, "ledgerAccount", ""); }}
                                  placeholder="Zoek rekening..."
                                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none" />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] text-gray-500">Debet</label>
                                  <input type="number" step="0.01" value={line.debit || ""} onChange={(e) => updateJournalLine(line.id, "debit", parseFloat(e.target.value) || 0)}
                                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none" placeholder="0,00" />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500">Credit</label>
                                  <input type="number" step="0.01" value={line.credit || ""} onChange={(e) => updateJournalLine(line.id, "credit", parseFloat(e.target.value) || 0)}
                                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 outline-none" placeholder="0,00" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Balance indicator */}
                        <div className={`rounded-lg p-3 mt-3 flex flex-wrap items-center gap-4 text-xs ${balanced ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
                          <span className="text-gray-600">Totaal:</span>
                          <span className="font-medium">Debet: {formatCurrency(totalD)}</span>
                          <span className="font-medium">Credit: {formatCurrency(totalC)}</span>
                          {balanced ? (
                            <span className="flex items-center gap-1 text-emerald-700 font-medium ml-auto">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                              In balans
                            </span>
                          ) : (
                            <span className="text-red-700 font-medium ml-auto">Verschil: {formatCurrency(Math.abs(totalD - totalC))}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 shrink-0">
                      <button onClick={() => setShowJournalModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Annuleren</button>
                      <button onClick={saveJournal} disabled={journalSaving || !balanced || !journalForm.description.trim()}
                        className="px-4 py-2 bg-[#004854] text-white rounded-lg text-sm font-medium hover:bg-[#003640] disabled:opacity-50">
                        {journalSaving ? "Opslaan..." : editingJournal ? "Opslaan" : "Boeking aanmaken"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

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
            {/* Notification settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6">
              <h3 className="text-base font-semibold text-[#3C2C1E] mb-1">Notificatie-instellingen</h3>
              <p className="text-sm text-gray-500 mb-4">Kies welke notificaties je wilt ontvangen.</p>
              <div className="space-y-3">
                {[
                  { key: "newSales", label: "Nieuwe verkoopfacturen", desc: "Wanneer een klant een nieuwe factuur aanmaakt" },
                  { key: "newPurchase", label: "Nieuwe inkoopdocumenten", desc: "Wanneer een klant een document uploadt" },
                  { key: "overdue", label: "Verlopen facturen", desc: "Wanneer een factuur de vervaldatum passeert" },
                  { key: "payment", label: "Betalingen", desc: "Wanneer een betaling wordt ontvangen" },
                  { key: "booking", label: "Boekingen", desc: "Wanneer facturen worden geboekt" },
                  { key: "exception", label: "Uitzonderingen", desc: "Wanneer er een uitzondering wordt aangemaakt" },
                  { key: "task", label: "Taken", desc: "Wanneer een taak wordt toegewezen" },
                  { key: "bank", label: "Bank-import", desc: "Wanneer banktransacties worden geïmporteerd" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{item.label}</p>
                      <p className="text-xs text-gray-400">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#00AFCB]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00AFCB]"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
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
