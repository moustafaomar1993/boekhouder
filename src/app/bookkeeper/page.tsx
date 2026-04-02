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
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700", sent: "bg-blue-100 text-blue-700", paid: "bg-green-100 text-green-700",
    overdue: "bg-red-100 text-red-700", pending: "bg-yellow-100 text-yellow-700",
    processing: "bg-blue-100 text-blue-700", processed: "bg-green-100 text-green-700",
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
  const [filter, setFilter] = useState<"all" | "pending" | "processing" | "processed">("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/invoices").then((r) => r.json()).then(setInvoices);
    fetch("/api/clients").then((r) => r.json()).then(setClients);
  }, []);

  const filtered = invoices.filter((inv) => {
    if (filter !== "all" && inv.bookkeepingStatus !== filter) return false;
    if (clientFilter !== "all" && inv.clientId !== clientFilter) return false;
    return true;
  });

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
            <div className="bg-yellow-50 rounded-xl p-5 shadow-sm border border-yellow-100">
              <p className="text-xs text-yellow-700 font-medium mb-1">In afwachting</p>
              <p className="text-2xl font-bold text-yellow-700">{pendingCount}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-5 shadow-sm border border-blue-100">
              <p className="text-xs text-blue-700 font-medium mb-1">In verwerking</p>
              <p className="text-2xl font-bold text-blue-700">{processingCount}</p>
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
              {(["all", "pending", "processing", "processed"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {{ all: "Alles", pending: "In afwachting", processing: "In verwerking", processed: "Verwerkt" }[f]}
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
                      <Link href={`/bookkeeper/invoices/${inv.id}`} className="text-sm text-[#00AFCB] hover:text-[#004854] font-medium">Bekijken</Link>
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
              <Link key={inv.id} href={`/bookkeeper/invoices/${inv.id}`} className="block bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:bg-gray-50 transition-colors">
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
            ))}
            {filtered.length === 0 && <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-12 text-center text-gray-400">Geen facturen gevonden.</div>}
          </div>
        </div>
      )}

      {/* ═══ INKOOP ═══ */}
      {section === "inkoop" && (
        <ModuleShell title="Inkoop" description="Beheer inkoopfacturen en bonnen van klanten."
          sections={[
            { title: "Inkoop inbox", description: "Bekijk geüploade documenten van klanten en verwerk deze." },
            { title: "Documentstatussen", description: "Overzicht van alle inkoopfacturen en hun verwerkingsstatus." },
            { title: "Boekingsgebied", description: "Boek inkoopfacturen in op de juiste grootboekrekeningen." },
            { title: "AI-herkenning", description: "Automatische herkenning van leveranciers, bedragen en categorieën." },
          ]}
        />
      )}

      {/* ═══ BANK ═══ */}
      {section === "bank" && (
        <ModuleShell title="Bank" description="Importeer en verwerk banktransacties."
          sections={[
            { title: "MT940 Import", description: "Importeer bankafschriften in MT940-formaat." },
            { title: "Transactieoverzicht", description: "Bekijk alle geïmporteerde banktransacties." },
            { title: "Transactiestatussen", description: "Volg de verwerkingsstatus van elke transactie." },
            { title: "Bankkoppeling", description: "Verbind direct met de bankrekening van de klant." },
          ]}
        />
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
        <div className="space-y-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#3C2C1E]">Afletteren</h1>
            <p className="text-sm text-[#6F5C4B]/70 mt-1">Koppel openstaande posten aan banktransacties.</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-amber-50 rounded-lg p-4 text-center border border-amber-100">
                <p className="text-xs text-amber-600 font-medium mb-1">Open posten</p>
                <p className="text-xl font-bold text-amber-700">-</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-100">
                <p className="text-xs text-blue-600 font-medium mb-1">Onafgeletterd</p>
                <p className="text-xl font-bold text-blue-700">-</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center border border-green-100">
                <p className="text-xs text-green-600 font-medium mb-1">Afgeletterd</p>
                <p className="text-xl font-bold text-green-700">-</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Openstaande documenten</h3>
                <div className="bg-gray-50 rounded-lg p-6 text-center"><p className="text-xs text-gray-400">Binnenkort beschikbaar</p></div>
              </div>
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Banktransacties</h3>
                <div className="bg-gray-50 rounded-lg p-6 text-center"><p className="text-xs text-gray-400">Binnenkort beschikbaar</p></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAKEN ═══ */}
      {section === "taken" && (
        <ModuleShell title="Taken" description="Beheer taken en opdrachten voor klantadministraties."
          sections={[
            { title: "Openstaande taken", description: "Taken die nog afgerond moeten worden." },
            { title: "Verlopen taken", description: "Taken die de deadline hebben overschreden." },
            { title: "Toegewezen taken", description: "Taken die aan specifieke medewerkers zijn toegewezen." },
            { title: "Klantgekoppelde taken", description: "Taken per klant voor overzichtelijk beheer." },
          ]}
        />
      )}

      {/* ═══ BERICHTEN ═══ */}
      {section === "berichten" && (
        <ModuleShell title="Berichten" description="Communiceer met klanten en collega's."
          sections={[
            { title: "Klantcommunicatie", description: "Berichten van en naar klanten." },
            { title: "Intern overleg", description: "Interne berichten en notities binnen het team." },
            { title: "AI-assistent", description: "AI-ondersteunde antwoordsuggesties voor veelgestelde vragen." },
          ]}
        />
      )}

      {/* ═══ AGENDA ═══ */}
      {section === "agenda" && (
        <ModuleShell title="Agenda" description="Plan afspraken, deadlines en herinneringen."
          sections={[
            { title: "Kalender", description: "Overzicht van alle geplande afspraken en deadlines." },
            { title: "Geplande taken", description: "Taken die op een specifieke datum gepland staan." },
            { title: "Herinneringen", description: "Automatische herinneringen voor belangrijke deadlines." },
            { title: "Klantdeadlines", description: "BTW-aangifte, jaarrekening en andere fiscale deadlines." },
          ]}
        />
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
