"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Profile {
  id: string;
  name: string;
  email: string;
  company: string | null;
  vatNumber: string | null;
  kvkNumber: string | null;
  phone: string | null;
  iban: string | null;
  bankName: string | null;
  accountHolder: string | null;
  logoUrl: string | null;
  legalForm: string | null;
  reminderEnabled: boolean;
  reminder1Days: number;
  reminder2Days: number;
  reminder3Days: number;
  quotationValidityDays: number;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [logoMessage, setLogoMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "",
    company: "",
    phone: "",
    vatNumber: "",
    kvkNumber: "",
    legalForm: "",
    iban: "",
    bankName: "",
    accountHolder: "",
    reminderEnabled: false,
    reminder1Days: "7",
    reminder2Days: "14",
    reminder3Days: "21",
    quotationValidityDays: "30",
  });

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setProfile(data);
          setForm({
            name: data.name || "",
            company: data.company || "",
            phone: data.phone || "",
            vatNumber: data.vatNumber || "",
            kvkNumber: data.kvkNumber || "",
            legalForm: data.legalForm || "",
            iban: data.iban || "",
            bankName: data.bankName || "",
            accountHolder: data.accountHolder || "",
            reminderEnabled: data.reminderEnabled || false,
            reminder1Days: (data.reminder1Days || 7).toString(),
            reminder2Days: (data.reminder2Days || 14).toString(),
            reminder3Days: (data.reminder3Days || 21).toString(),
            quotationValidityDays: (data.quotationValidityDays || 30).toString(),
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setLogoMessage("");
    const formData = new FormData();
    formData.append("logo", file);
    try {
      const res = await fetch("/api/profile/logo", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setProfile((prev) => prev ? { ...prev, logoUrl: data.logoUrl } : null);
        setLogoMessage("Logo succesvol geupload");
      } else {
        setLogoMessage(data.error || "Er ging iets mis");
      }
    } catch {
      setLogoMessage("Er ging iets mis bij het uploaden");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveMessage("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setSaveMessage("Instellingen opgeslagen");
        setTimeout(() => setSaveMessage(""), 3000);
      } else {
        setSaveMessage("Opslaan mislukt");
      }
    } catch {
      setSaveMessage("Er ging iets mis");
    } finally {
      setSaving(false);
    }
  }

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
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Link href="/client" className="text-blue-600 hover:text-blue-700">&larr; Terug</Link>
              <span className="text-gray-300">|</span>
              <h1 className="text-lg font-semibold">Instellingen</h1>
            </div>
            <div className="flex items-center gap-3">
              {saveMessage && (
                <span className={`text-sm ${saveMessage.includes("opgeslagen") ? "text-green-600" : "text-red-600"}`}>{saveMessage}</span>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Opslaan..." : "Opslaan"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Logo Upload */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-1">Bedrijfslogo</h2>
          <p className="text-sm text-gray-500 mb-4">Wordt getoond op facturen, creditfacturen en herinneringen.</p>
          <div className="flex items-start gap-6">
            <div className="w-28 h-28 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
              {profile?.logoUrl ? (
                <img src={profile.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
              ) : (
                <div className="text-center text-gray-400">
                  <svg className="w-7 h-7 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs">Geen logo</p>
                </div>
              )}
            </div>
            <div>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleLogoUpload} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? "Uploaden..." : profile?.logoUrl ? "Logo vervangen" : "Logo uploaden"}
              </button>
              <p className="text-xs text-gray-400 mt-2">JPG of PNG, maximaal 2MB</p>
              {logoMessage && (
                <p className={`text-sm mt-2 ${logoMessage.includes("succes") ? "text-green-600" : "text-red-600"}`}>{logoMessage}</p>
              )}
            </div>
          </div>
        </div>

        {/* Bedrijfsgegevens */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-1">Bedrijfsgegevens</h2>
          <p className="text-sm text-gray-500 mb-4">Deze gegevens worden getoond op je facturen.</p>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bedrijfsnaam</label>
                <input type="text" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="Jouw bedrijfsnaam" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Naam eigenaar / contactpersoon</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Je volledige naam" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mailadres</label>
                <input type="email" value={profile?.email || ""} readOnly
                  className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-500 cursor-not-allowed outline-none" />
                <p className="text-xs text-gray-400 mt-1">E-mail kan niet worden gewijzigd</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefoonnummer</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0612345678" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Fiscale gegevens */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-1">Fiscale gegevens</h2>
          <p className="text-sm text-gray-500 mb-4">Belasting- en handelsregistergegevens.</p>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">KvK-nummer</label>
                <input type="text" value={form.kvkNumber} onChange={(e) => setForm({ ...form, kvkNumber: e.target.value })}
                  placeholder="12345678" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">BTW-nummer</label>
                <input type="text" value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
                  placeholder="NL123456789B01" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rechtsvorm</label>
              <select value={form.legalForm} onChange={(e) => setForm({ ...form, legalForm: e.target.value })}
                className="w-full md:w-1/2 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                <option value="">Selecteer...</option>
                <option value="eenmanszaak">Eenmanszaak</option>
                <option value="vof">VOF</option>
                <option value="bv">BV</option>
                <option value="other">Anders</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bankgegevens */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-1">Bankgegevens</h2>
          <p className="text-sm text-gray-500 mb-4">Worden getoond op facturen zodat klanten weten waar ze moeten betalen.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
              <input type="text" value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })}
                placeholder="NL00BANK0123456789" className="w-full md:w-2/3 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank</label>
                <input type="text" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  placeholder="Bijv. ING, ABN AMRO, Rabobank" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rekeninghouder</label>
                <input type="text" value={form.accountHolder} onChange={(e) => setForm({ ...form, accountHolder: e.target.value })}
                  placeholder="Naam op de rekening" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Offerte instellingen */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-1">Offerte-instellingen</h2>
          <p className="text-sm text-gray-500 mb-4">Standaardwaarden voor nieuwe offertes.</p>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Standaard geldigheid:</span>
            <input type="number" min="1" value={form.quotationValidityDays}
              onChange={(e) => setForm({ ...form, quotationValidityDays: e.target.value })}
              className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="text-sm text-gray-500">dagen</span>
          </div>
        </div>

        {/* Herinneringen */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-1">Automatische herinneringen</h2>
          <p className="text-sm text-gray-500 mb-4">Stuur automatisch herinneringen voor verlopen facturen.</p>
          <label className="flex items-center gap-3 mb-4">
            <input type="checkbox" checked={form.reminderEnabled}
              onChange={(e) => setForm({ ...form, reminderEnabled: e.target.checked })}
              className="rounded w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Automatische herinneringen inschakelen</span>
          </label>
          {form.reminderEnabled && (
            <div className="space-y-3 pl-8">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-32">1e herinnering na</span>
                <input type="number" min="1" value={form.reminder1Days}
                  onChange={(e) => setForm({ ...form, reminder1Days: e.target.value })}
                  className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="text-sm text-gray-500">dagen</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-32">2e herinnering na</span>
                <input type="number" min="1" value={form.reminder2Days}
                  onChange={(e) => setForm({ ...form, reminder2Days: e.target.value })}
                  className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="text-sm text-gray-500">dagen</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-32">3e herinnering na</span>
                <input type="number" min="1" value={form.reminder3Days}
                  onChange={(e) => setForm({ ...form, reminder3Days: e.target.value })}
                  className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="text-sm text-gray-500">dagen</span>
              </div>
            </div>
          )}
        </div>

        {/* Save button (bottom) */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Opslaan..." : "Instellingen opslaan"}
          </button>
        </div>
      </main>
    </div>
  );
}
