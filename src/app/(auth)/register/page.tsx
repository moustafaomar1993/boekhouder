"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";

type LegalForm = "eenmanszaak" | "vof" | "bv" | "other";
type VatObligation = "yes" | "no" | "unknown";

interface RegistrationData {
  companyName: string;
  kvkNumber: string;
  legalForm: LegalForm | "";
  contactName: string;
  phone: string;
  email: string;
  emailConfirm: string;
  vatNumber: string;
  vatId: string;
  vatObligation: VatObligation | "";
  iban: string;
  bankName: string;
  accountHolder: string;
  username: string;
  password: string;
  passwordConfirm: string;
}

const SECTIONS = [
  { key: "company", label: "Bedrijf", icon: "🏢" },
  { key: "contact", label: "Contact", icon: "👤" },
  { key: "tax", label: "Belasting", icon: "📋" },
  { key: "bank", label: "Bank", icon: "🏦" },
  { key: "account", label: "Account", icon: "🔐" },
] as const;

interface StepDef {
  section: number;
  field: keyof RegistrationData;
  label: string;
  type: string;
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  helperText?: string;
  helperCondition?: (data: RegistrationData) => boolean;
}

const STEPS: StepDef[] = [
  // Company
  { section: 0, field: "companyName", label: "Wat is de naam van uw bedrijf?", type: "text", placeholder: "Bijv. Jansen Consulting", required: true },
  { section: 0, field: "kvkNumber", label: "Wat is uw KvK-nummer?", type: "text", placeholder: "12345678", required: true },
  {
    section: 0, field: "legalForm", label: "Wat is de rechtsvorm van uw bedrijf?", type: "select", required: true,
    options: [
      { value: "eenmanszaak", label: "Eenmanszaak" },
      { value: "vof", label: "VOF" },
      { value: "bv", label: "BV" },
      { value: "other", label: "Anders" },
    ],
  },
  // Contact
  { section: 1, field: "contactName", label: "Wat is uw naam?", type: "text", placeholder: "Bijv. Jan Jansen", required: true },
  { section: 1, field: "phone", label: "Wat is uw telefoonnummer?", type: "tel", placeholder: "06-12345678", required: true },
  { section: 1, field: "email", label: "Wat is uw e-mailadres?", type: "email", placeholder: "jan@jansen.nl", required: true },
  { section: 1, field: "emailConfirm", label: "Herhaal uw e-mailadres", type: "email", placeholder: "Herhaal uw e-mailadres", required: true },
  // Tax
  { section: 2, field: "vatNumber", label: "Wat is uw BTW-nummer?", type: "text", placeholder: "NL123456789B01" },
  { section: 2, field: "vatId", label: "Wat is uw BTW-identificatienummer?", type: "text", placeholder: "NL123456789B01" },
  {
    section: 2, field: "vatObligation", label: "Bent u BTW-plichtig?", type: "select",
    options: [
      { value: "yes", label: "Ja" },
      { value: "no", label: "Nee" },
      { value: "unknown", label: "Ik weet het niet" },
    ],
    helperText: "Geen zorgen! Dit wordt later besproken met uw accountant tijdens het kennismakingsgesprek.",
    helperCondition: (data) => data.vatObligation === "unknown",
  },
  // Bank
  { section: 3, field: "iban", label: "Wat is uw IBAN?", type: "text", placeholder: "NL00 BANK 0123 4567 89", required: true },
  { section: 3, field: "bankName", label: "Bij welke bank zit u?", type: "text", placeholder: "Bijv. ING, ABN AMRO, Rabobank", required: true },
  { section: 3, field: "accountHolder", label: "Wat is de naam van de rekeninghouder?", type: "text", placeholder: "Naam zoals bij de bank bekend", required: true },
  // Account
  { section: 4, field: "username", label: "Kies een gebruikersnaam", type: "text", placeholder: "Wordt voorgevuld met uw e-mail", required: true },
  { section: 4, field: "password", label: "Kies een wachtwoord", type: "password", placeholder: "Minimaal 8 tekens", required: true },
  { section: 4, field: "passwordConfirm", label: "Herhaal uw wachtwoord", type: "password", placeholder: "Herhaal uw wachtwoord", required: true },
];

const INITIAL_DATA: RegistrationData = {
  companyName: "", kvkNumber: "", legalForm: "",
  contactName: "", phone: "", email: "", emailConfirm: "",
  vatNumber: "", vatId: "", vatObligation: "",
  iban: "", bankName: "", accountHolder: "",
  username: "", password: "", passwordConfirm: "",
};

// --- Validation helpers ---

function validateKvk(kvk: string): string | null {
  const digits = kvk.replace(/\s/g, "");
  if (!/^\d+$/.test(digits)) return "KvK-nummer mag alleen cijfers bevatten";
  if (digits.length !== 8) return "KvK-nummer moet precies 8 cijfers zijn";
  return null;
}

function validateEmail(email: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Ongeldig e-mailadres";
  return null;
}

function validateIban(iban: string): string | null {
  const cleaned = iban.replace(/\s/g, "").toUpperCase();
  if (cleaned.length < 15 || cleaned.length > 34) return "IBAN moet tussen 15 en 34 tekens zijn";
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleaned)) return "Ongeldig IBAN-formaat (bijv. NL00BANK0123456789)";
  return null;
}

function validatePhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-().]/g, "");
  if (!/^(\+?\d{10,13})$/.test(cleaned)) return "Ongeldig telefoonnummer";
  return null;
}

interface PasswordCheck {
  minLength: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  isValid: boolean;
}

function checkPasswordStrength(password: string): PasswordCheck {
  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return { minLength, hasUppercase, hasNumber, isValid: minLength && hasUppercase && hasNumber };
}

// --- Component ---

function PasswordStrengthIndicator({ password }: { password: string }) {
  const checks = checkPasswordStrength(password);
  if (!password) return null;

  const items = [
    { ok: checks.minLength, label: "Minimaal 8 tekens" },
    { ok: checks.hasUppercase, label: "Minimaal 1 hoofdletter" },
    { ok: checks.hasNumber, label: "Minimaal 1 cijfer" },
  ];

  return (
    <div className="mt-3 space-y-1.5">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-sm">
          {item.ok ? (
            <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
            </svg>
          )}
          <span className={item.ok ? "text-emerald-700" : "text-gray-500"}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<RegistrationData>(INITIAL_DATA);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(false);

  const currentStep = STEPS[step];
  const currentSection = currentStep.section;
  const totalSteps = STEPS.length;
  const isLastStep = step === totalSteps - 1;

  const setField = useCallback((field: keyof RegistrationData, value: string) => {
    setData((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-sync username with email when not manually edited
      if (field === "email" && !usernameManuallyEdited) {
        next.username = value;
      }
      if (field === "username") {
        setUsernameManuallyEdited(true);
      }
      return next;
    });
  }, [usernameManuallyEdited]);

  function validate(): string | null {
    const value = data[currentStep.field];
    if (currentStep.required && !value) return "Dit veld is verplicht";

    switch (currentStep.field) {
      case "kvkNumber":
        if (value) return validateKvk(value);
        break;
      case "email":
        if (value) return validateEmail(value);
        break;
      case "emailConfirm":
        if (value !== data.email) return "E-mailadressen komen niet overeen";
        break;
      case "phone":
        if (value) return validatePhone(value);
        break;
      case "iban":
        if (value) return validateIban(value);
        break;
      case "password": {
        const strength = checkPasswordStrength(value);
        if (!strength.isValid) return "Wachtwoord voldoet niet aan alle eisen";
        break;
      }
      case "passwordConfirm":
        if (value !== data.password) return "Wachtwoorden komen niet overeen";
        break;
    }
    return null;
  }

  function goNext() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    if (isLastStep) {
      handleSubmit();
    } else {
      setStep((s) => s + 1);
    }
  }

  function goBack() {
    if (step > 0) {
      setError("");
      setStep((s) => s - 1);
    }
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration: {
            companyName: data.companyName,
            kvkNumber: data.kvkNumber,
            legalForm: data.legalForm,
            contactName: data.contactName,
            phone: data.phone,
            email: data.email,
            vatNumber: data.vatNumber,
            vatId: data.vatId,
            vatObligation: data.vatObligation || "unknown",
            iban: data.iban,
            bankName: data.bankName,
            accountHolder: data.accountHolder,
          },
          username: data.username,
          password: data.password,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Registratie mislukt");
        return;
      }

      router.push("/login?registered=verify");
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      goNext();
    }
  }

  const progress = ((step + 1) / totalSteps) * 100;
  const showPasswordStrength = currentStep.field === "password";

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gray-50">
      {/* Sidebar */}
      <div className="lg:w-72 bg-white border-b lg:border-b-0 lg:border-r border-gray-200 p-4 lg:p-6">
        <Link href="/" className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
          Boekhouder
        </Link>
        <p className="text-sm text-gray-500 mt-1 mb-6">Registratie</p>

        <nav className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
          {SECTIONS.map((section, i) => {
            const sectionSteps = STEPS.filter((s) => s.section === i);
            const sectionComplete = sectionSteps.every((s) => !!data[s.field]);
            const isCurrent = currentSection === i;
            return (
              <div
                key={section.key}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  isCurrent
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : sectionComplete
                    ? "text-emerald-700"
                    : "text-gray-500"
                }`}
              >
                <span className="text-base">{section.icon}</span>
                <span>{section.label}</span>
                {sectionComplete && !isCurrent && (
                  <svg className="w-4 h-4 text-emerald-500 ml-auto hidden lg:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            );
          })}
        </nav>

        <div className="hidden lg:block mt-8">
          <Link
            href="/advisory"
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors text-sm w-full justify-center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Kennismakingsgesprek
          </Link>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Progress bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>Stap {step + 1} van {totalSteps}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question area */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-lg">
            {step === 0 && (
              <p className="text-gray-500 mb-2 text-sm">Welkom! Laten we uw gegevens instellen.</p>
            )}

            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
              {currentStep.label}
            </h2>

            {error && (
              <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
                {error}
              </div>
            )}

            <div onKeyDown={handleKeyDown}>
              {currentStep.type === "select" ? (
                <div className="space-y-3">
                  {currentStep.options?.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setField(currentStep.field, opt.value);
                        setTimeout(() => {
                          setError("");
                          if (!isLastStep) setStep((s) => s + 1);
                        }, 200);
                      }}
                      className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all ${
                        data[currentStep.field] === opt.value
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type={currentStep.type}
                  value={data[currentStep.field]}
                  onChange={(e) => setField(currentStep.field, e.target.value)}
                  placeholder={currentStep.placeholder}
                  autoFocus
                  className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                />
              )}

              {showPasswordStrength && (
                <PasswordStrengthIndicator password={data.password} />
              )}

              {currentStep.helperCondition?.(data) && currentStep.helperText && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                  {currentStep.helperText}
                </div>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-8">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 0}
                className="text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed font-medium transition-colors"
              >
                &larr; Vorige
              </button>

              <button
                type="button"
                onClick={goNext}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-8 rounded-xl transition-colors"
              >
                {loading
                  ? "Bezig..."
                  : isLastStep
                  ? "Account aanmaken"
                  : "Volgende →"}
              </button>
            </div>

            <p className="text-center text-xs text-gray-400 mt-6">
              Druk op Enter om verder te gaan
            </p>
          </div>
        </div>

        {/* Mobile advisory CTA */}
        <div className="lg:hidden border-t border-gray-200 p-4 bg-white">
          <Link
            href="/advisory"
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors text-sm w-full"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Ik wil een kennismakingsgesprek
          </Link>
        </div>
      </div>
    </div>
  );
}
