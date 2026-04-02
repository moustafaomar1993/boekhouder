"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string | null;
  kvkNumber: string | null;
  legalForm: string | null;
  phone: string | null;
  emailVerified: boolean;
  isNew: boolean;
  createdAt: string;
  username: string | null;
  vatNumber: string | null;
  vatObligation: string | null;
  iban: string | null;
  bankName: string | null;
  accountHolder: string | null;
}

interface Stats {
  totalUsers: number;
  totalClients: number;
  totalBookkeepers: number;
  totalInvoices: number;
  newClients: number;
  verifiedUsers: number;
  unverifiedUsers: number;
  totalRevenue: number;
  recentUsers: AdminUser[];
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    client: "bg-blue-100 text-blue-700",
    bookkeeper: "bg-emerald-100 text-emerald-700",
    admin: "bg-purple-100 text-purple-700",
  };
  const labels: Record<string, string> = {
    client: "Klant",
    bookkeeper: "Boekhouder",
    admin: "Admin",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors[role] || "bg-gray-100"}`}>
      {labels[role] || role}
    </span>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${active ? "bg-green-500" : "bg-red-400"}`} />
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "settings">("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    role: "client",
    password: "",
    company: "",
    kvkNumber: "",
    legalForm: "",
    phone: "",
  });
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Settings state
  const [kvkApiKey, setKvkApiKey] = useState("");
  const [kvkContractNr, setKvkContractNr] = useState("");
  const [kvkBaseUrl, setKvkBaseUrl] = useState("https://api.kvk.nl/api");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [kvkConnTesting, setKvkConnTesting] = useState(false);
  const [kvkConnStatus, setKvkConnStatus] = useState<{ connected: boolean; message?: string; error?: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats").then((r) => {
        if (r.status === 401 || r.status === 403) {
          router.push("/login");
          throw new Error("unauthorized");
        }
        return r.json();
      }),
      fetch("/api/admin/users").then((r) => r.json()),
    ])
      .then(([statsData, usersData]) => {
        setStats(statsData);
        setUsers(usersData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Load settings
    fetch("/api/admin/settings").then((r) => r.ok ? r.json() : {}).then((data) => {
      if (data.kvk_api_key) setKvkApiKey(data.kvk_api_key.value || "");
      if (data.kvk_contract_nr) setKvkContractNr(data.kvk_contract_nr.value || "");
      if (data.kvk_api_base_url) setKvkBaseUrl(data.kvk_api_base_url.value || "https://api.kvk.nl/api");
    }).catch(() => {});
  }, [router]);

  async function saveKvkSettings() {
    setSettingsSaving(true);
    setSettingsMessage("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            kvk_api_key: kvkApiKey,
            kvk_contract_nr: kvkContractNr,
            kvk_api_base_url: kvkBaseUrl,
          },
        }),
      });
      if (res.ok) {
        setSettingsMessage("KVK-instellingen opgeslagen");
        setKvkConnStatus(null);
        setTimeout(() => setSettingsMessage(""), 4000);
      } else {
        setSettingsMessage("Opslaan mislukt");
      }
    } catch { setSettingsMessage("Er ging iets mis"); }
    finally { setSettingsSaving(false); }
  }

  async function testKvkConnection() {
    setKvkConnTesting(true);
    setKvkConnStatus(null);
    try {
      const res = await fetch("/api/kvk/test-connection");
      const data = await res.json();
      setKvkConnStatus(data);
    } catch {
      setKvkConnStatus({ connected: false, error: "Kan geen verbinding maken" });
    } finally { setKvkConnTesting(false); }
  }

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.company && u.company.toLowerCase().includes(q))
      );
    }
    return true;
  });

  async function toggleVerification(user: AdminUser) {
    setActionLoading(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailVerified: !user.emailVerified }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, emailVerified: !u.emailVerified } : u))
        );
        if (selectedUser?.id === user.id) {
          setSelectedUser({ ...selectedUser, emailVerified: !selectedUser.emailVerified });
        }
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function toggleNewStatus(user: AdminUser) {
    setActionLoading(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isNew: !user.isNew }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, isNew: !u.isNew } : u))
        );
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteUser(userId: string) {
    if (!confirm("Weet u zeker dat u deze gebruiker wilt verwijderen? Dit kan niet ongedaan worden.")) return;
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        setSelectedUser(null);
        // Refresh stats
        const statsRes = await fetch("/api/admin/stats");
        if (statsRes.ok) setStats(await statsRes.json());
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreateLoading(true);
    try {
      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Er ging iets mis");
        return;
      }
      // Refresh users and stats
      const [usersRes, statsRes] = await Promise.all([
        fetch("/api/admin/users").then((r) => r.json()),
        fetch("/api/admin/stats").then((r) => r.json()),
      ]);
      setUsers(usersRes);
      setStats(statsRes);
      setShowCreateModal(false);
      setCreateForm({ name: "", email: "", role: "client", password: "", company: "", kvkNumber: "", legalForm: "", phone: "" });
    } catch {
      setCreateError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Dashboard laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-xl font-bold text-purple-600">Boekhouder</Link>
              <span className="text-gray-300">|</span>
              <span className="text-sm text-gray-500">Admin Dashboard</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium">Administrator</p>
                <p className="text-xs text-gray-500">Beheerder</p>
              </div>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-red-600 transition-colors"
              >
                Uitloggen
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {(["overview", "users", "settings"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "overview" ? "Overzicht" : tab === "users" ? "Gebruikers" : "Instellingen"}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "overview" && stats && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500">Totaal gebruikers</p>
                </div>
                <p className="text-3xl font-bold">{stats.totalUsers}</p>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500">Klanten</p>
                </div>
                <p className="text-3xl font-bold text-blue-600">{stats.totalClients}</p>
                {stats.newClients > 0 && (
                  <p className="text-xs text-orange-600 mt-1">{stats.newClients} nieuw</p>
                )}
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500">Facturen</p>
                </div>
                <p className="text-3xl font-bold text-green-600">{stats.totalInvoices}</p>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500">Totale omzet</p>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalRevenue)}</p>
              </div>
            </div>

            {/* Verification Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold mb-4">Verificatie status</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusDot active={true} />
                      <span className="text-sm text-gray-600">Geverifieerd</span>
                    </div>
                    <span className="font-semibold text-green-600">{stats.verifiedUsers}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusDot active={false} />
                      <span className="text-sm text-gray-600">Niet geverifieerd</span>
                    </div>
                    <span className="font-semibold text-red-600">{stats.unverifiedUsers}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 mt-2">
                    <div
                      className="bg-green-500 h-3 rounded-full transition-all"
                      style={{ width: `${stats.totalUsers > 0 ? (stats.verifiedUsers / stats.totalUsers) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold mb-4">Gebruikers per rol</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RoleBadge role="client" />
                    </div>
                    <span className="font-semibold">{stats.totalClients}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RoleBadge role="bookkeeper" />
                    </div>
                    <span className="font-semibold">{stats.totalBookkeepers}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RoleBadge role="admin" />
                    </div>
                    <span className="font-semibold">
                      {stats.totalUsers - stats.totalClients - stats.totalBookkeepers}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Users */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-lg font-semibold">Laatste registraties</h2>
                <button
                  onClick={() => setActiveTab("users")}
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  Alle gebruikers bekijken
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {stats.recentUsers.map((u) => (
                  <div key={u.id} className="p-5 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-sm text-gray-500">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <RoleBadge role={u.role} />
                      <StatusDot active={u.emailVerified} />
                      <span className="text-sm text-gray-400">{formatDate(u.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === "users" && (
          <div className="flex gap-6">
            {/* Users List */}
            <div className={`${selectedUser ? "w-1/2" : "w-full"} transition-all`}>
              {/* Search & Filter */}
              <div className="flex flex-wrap gap-3 mb-4">
                <input
                  type="text"
                  placeholder="Zoek op naam, e-mail of bedrijf..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 min-w-[200px] px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm"
                />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                >
                  <option value="all">Alle rollen</option>
                  <option value="client">Klanten</option>
                  <option value="bookkeeper">Boekhouders</option>
                  <option value="admin">Admins</option>
                </select>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  + Nieuwe gebruiker
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500 border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 font-medium">Gebruiker</th>
                      <th className="px-4 py-3 font-medium">Rol</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Datum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredUsers.map((u) => (
                      <tr
                        key={u.id}
                        onClick={() => setSelectedUser(u)}
                        className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                          selectedUser?.id === u.id ? "bg-purple-50" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{u.name}</p>
                              <p className="text-xs text-gray-500">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <StatusDot active={u.emailVerified} />
                            <span className="text-xs text-gray-500">
                              {u.emailVerified ? "Geverifieerd" : "Niet geverifieerd"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{formatDate(u.createdAt)}</td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center text-gray-400">
                          Geen gebruikers gevonden.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="text-sm text-gray-400 mt-3">{filteredUsers.length} gebruiker(s)</p>
            </div>

            {/* User Detail Panel */}
            {selectedUser && (
              <div className="w-1/2">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-6">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-lg font-bold text-purple-600">
                        {selectedUser.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{selectedUser.name}</h3>
                        <p className="text-sm text-gray-500">{selectedUser.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">Rol</p>
                        <RoleBadge role={selectedUser.role} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">E-mail verificatie</p>
                        <div className="flex items-center gap-2">
                          <StatusDot active={selectedUser.emailVerified} />
                          <span className="text-sm">
                            {selectedUser.emailVerified ? "Geverifieerd" : "Niet geverifieerd"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {selectedUser.company && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">Bedrijf</p>
                        <p className="text-sm font-medium">{selectedUser.company}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      {selectedUser.kvkNumber && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase mb-1">KvK nummer</p>
                          <p className="text-sm font-mono">{selectedUser.kvkNumber}</p>
                        </div>
                      )}
                      {selectedUser.legalForm && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase mb-1">Rechtsvorm</p>
                          <p className="text-sm capitalize">{selectedUser.legalForm}</p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {selectedUser.vatNumber && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase mb-1">BTW nummer</p>
                          <p className="text-sm font-mono">{selectedUser.vatNumber}</p>
                        </div>
                      )}
                      {selectedUser.phone && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase mb-1">Telefoon</p>
                          <p className="text-sm">{selectedUser.phone}</p>
                        </div>
                      )}
                    </div>

                    {selectedUser.iban && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">IBAN</p>
                        <p className="text-sm font-mono">{selectedUser.iban}</p>
                        {selectedUser.bankName && (
                          <p className="text-xs text-gray-500">{selectedUser.bankName} - {selectedUser.accountHolder}</p>
                        )}
                      </div>
                    )}

                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">Geregistreerd op</p>
                      <p className="text-sm">{formatDate(selectedUser.createdAt)}</p>
                    </div>

                    {selectedUser.isNew && (
                      <div className="bg-orange-50 text-orange-700 rounded-lg px-3 py-2 text-sm">
                        Nieuwe klant - nog niet beoordeeld
                      </div>
                    )}

                    {/* Actions */}
                    <div className="border-t border-gray-100 pt-4 space-y-2">
                      <button
                        onClick={() => toggleVerification(selectedUser)}
                        disabled={actionLoading === selectedUser.id}
                        className={`w-full text-sm font-medium py-2.5 rounded-lg transition-colors ${
                          selectedUser.emailVerified
                            ? "bg-red-50 text-red-700 hover:bg-red-100"
                            : "bg-green-50 text-green-700 hover:bg-green-100"
                        } disabled:opacity-50`}
                      >
                        {selectedUser.emailVerified ? "E-mail verificatie intrekken" : "E-mail handmatig verifi\u00ebren"}
                      </button>

                      {selectedUser.isNew && (
                        <button
                          onClick={() => toggleNewStatus(selectedUser)}
                          disabled={actionLoading === selectedUser.id}
                          className="w-full text-sm font-medium py-2.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                          Markeren als beoordeeld
                        </button>
                      )}

                      <button
                        onClick={() => deleteUser(selectedUser.id)}
                        disabled={actionLoading === selectedUser.id}
                        className="w-full text-sm font-medium py-2.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        Gebruiker verwijderen
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {/* SETTINGS TAB */}
        {activeTab === "settings" && (
          <div className="max-w-2xl space-y-6">
            {/* KVK API Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-1">
                <svg className="w-6 h-6 text-[#00AFCB]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <h2 className="text-lg font-semibold">KVK API-verbinding</h2>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                Configureer de verbinding met het KVK Handelsregister. Deze wordt gebruikt voor het opzoeken en importeren van bedrijfsgegevens bij klantbeheer.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contractnummer</label>
                  <input type="text" value={kvkContractNr} onChange={(e) => setKvkContractNr(e.target.value)}
                    placeholder="Uw KVK contractnummer"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 focus:border-[#00AFCB] outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API-sleutel</label>
                  <div className="relative">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={kvkApiKey}
                      onChange={(e) => setKvkApiKey(e.target.value)}
                      placeholder="Voer uw KVK API-sleutel in"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 focus:border-[#00AFCB] outline-none pr-20 font-mono"
                    />
                    <button type="button" onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
                      {showApiKey ? "Verbergen" : "Tonen"}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">De API-sleutel wordt veilig opgeslagen in de database en is niet zichtbaar in de frontend.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Base URL</label>
                  <select value={kvkBaseUrl} onChange={(e) => setKvkBaseUrl(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00AFCB]/30 focus:border-[#00AFCB] outline-none">
                    <option value="https://api.kvk.nl/api">Productie (api.kvk.nl/api)</option>
                    <option value="https://api.kvk.nl/test/api">Test (api.kvk.nl/test/api)</option>
                  </select>
                </div>

                {settingsMessage && (
                  <div className={`rounded-lg px-4 py-3 text-sm ${settingsMessage.includes("opgeslagen") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {settingsMessage}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button onClick={saveKvkSettings} disabled={settingsSaving || !kvkApiKey}
                    className="px-5 py-2.5 bg-[#004854] text-white rounded-lg text-sm font-medium hover:bg-[#003640] disabled:opacity-50 transition-colors">
                    {settingsSaving ? "Opslaan..." : "Instellingen opslaan"}
                  </button>
                  <button onClick={testKvkConnection} disabled={kvkConnTesting || !kvkApiKey}
                    className="px-5 py-2.5 border border-[#00AFCB]/30 text-[#004854] rounded-lg text-sm font-medium hover:bg-[#E6F9FC] disabled:opacity-50 transition-colors">
                    {kvkConnTesting ? (
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        Testen...
                      </span>
                    ) : "Verbinding testen"}
                  </button>
                </div>

                {kvkConnStatus && (
                  <div className={`flex items-center gap-2 p-4 rounded-lg text-sm ${kvkConnStatus.connected ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {kvkConnStatus.connected ? (
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    ) : (
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )}
                    <span>{kvkConnStatus.message || kvkConnStatus.error}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Info card */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Over de KVK API</h3>
              <ul className="text-sm text-gray-500 space-y-1.5">
                <li>• De API-sleutel en contractnummer kunt u aanvragen via <span className="font-medium text-gray-700">developers.kvk.nl</span></li>
                <li>• Na het opslaan is de KVK-integratie direct beschikbaar bij het aanmaken en bewerken van klanten</li>
                <li>• Gebruik de <span className="font-medium text-gray-700">Test</span>-omgeving om de verbinding te testen voordat u overschakelt naar productie</li>
                <li>• De API-sleutel wordt veilig opgeslagen en nooit in de browser getoond</li>
              </ul>
            </div>
          </div>
        )}
      </main>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Nieuwe gebruiker aanmaken</h2>
              <button
                onClick={() => { setShowCreateModal(false); setCreateError(""); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              {createError && (
                <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">{createError}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm"
                >
                  <option value="client">Klant</option>
                  <option value="bookkeeper">Boekhouder</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Naam *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  required
                  placeholder="Volledige naam"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mailadres *</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  required
                  placeholder="naam@voorbeeld.nl"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Dit wordt ook de gebruikersnaam</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Wachtwoord *</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  required
                  placeholder="Min. 8 tekens, 1 hoofdletter, 1 cijfer"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm"
                />
              </div>

              {createForm.role === "client" && (
                <>
                  <hr className="border-gray-100" />
                  <p className="text-xs text-gray-500 uppercase font-medium">Bedrijfsgegevens (optioneel)</p>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bedrijfsnaam</label>
                    <input
                      type="text"
                      value={createForm.company}
                      onChange={(e) => setCreateForm({ ...createForm, company: e.target.value })}
                      placeholder="Bedrijfsnaam"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">KvK nummer</label>
                      <input
                        type="text"
                        value={createForm.kvkNumber}
                        onChange={(e) => setCreateForm({ ...createForm, kvkNumber: e.target.value })}
                        placeholder="12345678"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rechtsvorm</label>
                      <select
                        value={createForm.legalForm}
                        onChange={(e) => setCreateForm({ ...createForm, legalForm: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm"
                      >
                        <option value="">Selecteer...</option>
                        <option value="eenmanszaak">Eenmanszaak</option>
                        <option value="vof">VOF</option>
                        <option value="bv">BV</option>
                        <option value="other">Anders</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefoonnummer</label>
                    <input
                      type="tel"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                      placeholder="0612345678"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setCreateError(""); }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {createLoading ? "Aanmaken..." : "Gebruiker aanmaken"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
