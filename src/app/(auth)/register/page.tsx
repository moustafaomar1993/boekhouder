"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect, useRef } from "react";

type LegalForm = "eenmanszaak" | "vof" | "bv" | "cv" | "maatschap" | "nv" | "stichting" | "vereniging" | "cooperatie" | "other" | "";
type VatObligation = "yes" | "no" | "unknown" | "";

interface RegistrationData {
  companyName: string;
  kvkNumber: string;
  legalForm: LegalForm;
  contactName: string;
  phone: string;
  email: string;
  emailConfirm: string;
  vatNumber: string;
  vatNumberSkipped: boolean;
  vatId: string;
  vatIdSkipped: boolean;
  vatObligation: VatObligation;
  iban: string;
  bankName: string;
  accountHolder: string;
  username: string;
  password: string;
  passwordConfirm: string;
}

const SECTIONS = [
  {
    key: "company",
    label: "Bedrijf",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    key: "contact",
    label: "Contact",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    key: "tax",
    label: "Belasting",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: "bank",
    label: "Bank",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    key: "account",
    label: "Account",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
] as const;

interface StepDef {
  section: number;
  field: keyof RegistrationData;
  label: string;
  type: string;
  placeholder?: string;
  required?: boolean;
  skippable?: boolean;
  skipLabel?: string;
  skipField?: keyof RegistrationData;
  options?: { value: string; label: string }[];
  helperText?: string;
  helperCondition?: (data: RegistrationData) => boolean;
  hint?: string;
}

const STEPS: StepDef[] = [
  // Company
  { section: 0, field: "companyName", label: "Wat is de naam van uw bedrijf?", type: "kvk-search", placeholder: "Begin met typen om te zoeken...", required: true },
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
  {
    section: 2, field: "vatNumber", label: "Wat is uw omzetbelastingnummer?", type: "text", placeholder: "NL000000000B00",
    hint: "Formaat: NL + 9 cijfers + B + 2 cijfers",
    skippable: true, skipLabel: "Ik weet het momenteel niet", skipField: "vatNumberSkipped",
  },
  {
    section: 2, field: "vatId", label: "Wat is uw BTW-identificatienummer?", type: "text", placeholder: "NL000000000B00",
    hint: "Formaat: NL + 9 cijfers + B + 2 cijfers",
    skippable: true, skipLabel: "Ik weet het momenteel niet", skipField: "vatIdSkipped",
  },
  {
    section: 2, field: "vatObligation", label: "Bent u BTW-plichtig?", type: "select",
    options: [
      { value: "yes", label: "Ja" },
      { value: "no", label: "Nee" },
      { value: "unknown", label: "Ik weet het niet" },
    ],
    helperText: "Dit kunnen we later samen bekijken.",
    helperCondition: (data) => data.vatObligation === "unknown",
  },
  // Bank
  { section: 3, field: "iban", label: "Wat is uw IBAN?", type: "text", placeholder: "NL00 BANK 0123 4567 89", required: true },
  { section: 3, field: "bankName", label: "Bij welke bank zit u?", type: "text", placeholder: "Bijv. ING, ABN AMRO, Rabobank", required: true },
  { section: 3, field: "accountHolder", label: "Wat is de tenaamstelling van de rekening?", type: "text", placeholder: "Naam zoals bij de bank bekend", required: true },
  // Account
  { section: 4, field: "username", label: "Kies een gebruikersnaam", type: "text", placeholder: "Wordt voorgevuld met uw e-mail", required: true },
  { section: 4, field: "password", label: "Kies een wachtwoord", type: "password", placeholder: "Minimaal 8 tekens", required: true },
  { section: 4, field: "passwordConfirm", label: "Herhaal uw wachtwoord", type: "password", placeholder: "Herhaal uw wachtwoord", required: true },
];

const INITIAL_DATA: RegistrationData = {
  companyName: "", kvkNumber: "", legalForm: "",
  contactName: "", phone: "", email: "", emailConfirm: "",
  vatNumber: "", vatNumberSkipped: false, vatId: "", vatIdSkipped: false, vatObligation: "",
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

function validateDutchVatNumber(value: string): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[\s.]/g, "").toUpperCase();
  if (!/^NL\d{9}B\d{2}$/.test(cleaned)) {
    return "Ongeldig formaat. Verwacht: NL + 9 cijfers + B + 2 cijfers (bijv. NL123456789B01)";
  }
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

// --- Typewriter hook ---

function useTypewriter(text: string, speed = 25) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    setDisplayedText("");
    setIsComplete(false);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayedText(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        setIsComplete(true);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return { displayedText, isComplete };
}

// --- KVK Search Result type ---

interface KvkSearchResult {
  kvkNummer: string;
  naam: string;
  plaats: string;
  type: string;
}

// --- Components ---

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
          <span className={item.ok ? "text-emerald-600" : "text-[#6F5C4B]/50"}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function KvkPrefillBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[#00AFCB] bg-[#E6F9FC] px-2 py-0.5 rounded-full border border-[#00AFCB]/20">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      Opgehaald uit KVK
    </span>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<RegistrationData>(INITIAL_DATA);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // KVK search state
  const [kvkSearchResults, setKvkSearchResults] = useState<KvkSearchResult[]>([]);
  const [kvkSearching, setKvkSearching] = useState(false);
  const [kvkSelected, setKvkSelected] = useState(false);
  const [kvkFilledFields, setKvkFilledFields] = useState<Set<string>>(new Set());
  const [kvkProfileLoading, setKvkProfileLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const currentStep = STEPS[step];
  const currentSection = currentStep.section;
  const totalSteps = STEPS.length;
  const isLastStep = step === totalSteps - 1;

  const { displayedText, isComplete } = useTypewriter(currentStep.label, 25);

  useEffect(() => {
    if (isComplete && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isComplete]);

  const setField = useCallback((field: keyof RegistrationData, value: string) => {
    setData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "email" && !usernameManuallyEdited) {
        next.username = value;
      }
      if (field === "username") {
        setUsernameManuallyEdited(true);
      }
      return next;
    });
  }, [usernameManuallyEdited]);

  // KVK name search with debounce
  function handleCompanyNameChange(value: string) {
    setField("companyName", value);
    setKvkSelected(false);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (value.length < 2) {
      setKvkSearchResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setKvkSearching(true);
      try {
        const res = await fetch(`/api/kvk/search-public?naam=${encodeURIComponent(value)}`);
        if (res.ok) {
          const json = await res.json();
          setKvkSearchResults(json.resultaten || []);
        } else {
          setKvkSearchResults([]);
        }
      } catch {
        setKvkSearchResults([]);
      } finally {
        setKvkSearching(false);
      }
    }, 350);
  }

  // Select a KVK result and fetch full profile
  async function selectKvkCompany(result: KvkSearchResult) {
    setKvkSelected(true);
    setKvkSearchResults([]);
    setKvkProfileLoading(true);
    setField("companyName", result.naam);

    try {
      const res = await fetch(`/api/kvk/lookup?kvkNummer=${result.kvkNummer}`);
      if (res.ok) {
        const profile = await res.json();
        const filled = new Set<string>();
        setData((prev) => {
          const next = { ...prev, companyName: result.naam };
          if (profile.kvkNumber) { next.kvkNumber = profile.kvkNumber; filled.add("kvkNumber"); }
          if (profile.legalForm) { next.legalForm = profile.legalForm; filled.add("legalForm"); }
          if (profile.company && profile.company !== result.naam) { next.companyName = profile.company; }
          filled.add("companyName");
          return next;
        });
        setKvkFilledFields(filled);
      }
    } catch {
      // Profile fetch failed, continue with just the name
    } finally {
      setKvkProfileLoading(false);
    }
  }

  function validate(): string | null {
    const value = data[currentStep.field];

    // Handle skippable fields
    if (currentStep.skippable && currentStep.skipField) {
      const skipped = data[currentStep.skipField];
      if (skipped) return null; // Field was skipped
    }

    if (currentStep.required && !value) return "Dit veld is verplicht";

    switch (currentStep.field) {
      case "kvkNumber":
        if (value && typeof value === "string") return validateKvk(value);
        break;
      case "email":
        if (value && typeof value === "string") return validateEmail(value);
        break;
      case "emailConfirm":
        if (value !== data.email) return "E-mailadressen komen niet overeen";
        break;
      case "phone":
        if (value && typeof value === "string") return validatePhone(value);
        break;
      case "vatNumber":
        if (value && typeof value === "string") return validateDutchVatNumber(value);
        break;
      case "vatId":
        if (value && typeof value === "string") return validateDutchVatNumber(value);
        break;
      case "iban":
        if (value && typeof value === "string") return validateIban(value);
        break;
      case "password": {
        if (typeof value === "string") {
          const strength = checkPasswordStrength(value);
          if (!strength.isValid) return "Wachtwoord voldoet niet aan alle eisen";
        }
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

  function handleSkip() {
    if (currentStep.skipField) {
      setData((prev) => ({ ...prev, [currentStep.skipField!]: true, [currentStep.field]: "" }));
      setError("");
      if (!isLastStep) setStep((s) => s + 1);
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
            vatNumber: data.vatNumber || null,
            vatNumberSkipped: data.vatNumberSkipped,
            vatId: data.vatId || null,
            vatIdSkipped: data.vatIdSkipped,
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
  const isFieldFromKvk = kvkFilledFields.has(currentStep.field);

  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding & progress */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] bg-[#004854] flex-col justify-between p-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />

        <div className="relative z-10">
          <Link href="/">
            <Image src="/logo.svg" alt="HAMZA Deboekhouder" width={200} height={52} className="brightness-0 invert" priority />
          </Link>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight">
              Welkom bij<br />
              <span className="text-[#00AFCB]">uw registratie.</span>
            </h1>
            <p className="text-white/60 mt-4 text-base leading-relaxed max-w-sm">
              In een paar stappen maakt u uw account aan. We begeleiden u er doorheen.
            </p>
          </div>

          {/* Section progress */}
          <nav className="space-y-1">
            {SECTIONS.map((section, i) => {
              const sectionSteps = STEPS.filter((s) => s.section === i);
              const sectionComplete = sectionSteps.every((s) => {
                if (s.skippable && s.skipField && data[s.skipField]) return true;
                return !!data[s.field];
              });
              const isCurrent = currentSection === i;
              const isPast = currentSection > i;
              return (
                <div
                  key={section.key}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all ${
                    isCurrent
                      ? "bg-[#00AFCB]/15 text-[#00AFCB] font-medium"
                      : sectionComplete || isPast
                      ? "text-white/70"
                      : "text-white/30"
                  }`}
                >
                  <span className={`flex-shrink-0 ${isCurrent ? "text-[#00AFCB]" : sectionComplete ? "text-emerald-400" : "text-white/30"}`}>
                    {sectionComplete && !isCurrent ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      section.icon
                    )}
                  </span>
                  {section.label}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Progress bar & advisory */}
        <div className="relative z-10 space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs text-white/40 mb-2">
              <span>Voortgang</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5">
              <div
                className="bg-[#00AFCB] h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <Link
            href="/advisory"
            className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white/80 hover:text-white font-medium py-2.5 px-4 rounded-xl transition-all text-sm w-full border border-white/10"
          >
            <svg className="w-4 h-4 text-[#00AFCB]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Ik wil een kennismakingsgesprek
          </Link>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {/* Mobile header */}
        <div className="lg:hidden bg-[#004854] px-5 py-4 flex items-center justify-between">
          <Link href="/">
            <Image src="/logo.svg" alt="HAMZA Deboekhouder" width={140} height={36} className="brightness-0 invert" priority />
          </Link>
          <span className="text-[#00AFCB] text-sm font-medium">{Math.round(progress)}%</span>
        </div>

        {/* Mobile progress bar */}
        <div className="lg:hidden w-full bg-gray-200 h-1">
          <div className="bg-[#00AFCB] h-1 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        {/* Question area */}
        <div className="flex-1 flex items-center justify-center px-6 sm:px-12 py-12">
          <div className="w-full max-w-[480px]">
            {/* Step counter */}
            <div className="flex items-center gap-3 mb-8">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#00AFCB]/10 text-[#00AFCB] text-sm font-semibold">
                {step + 1}
              </span>
              <span className="text-[#6F5C4B]/50 text-sm">van {totalSteps}</span>
              <span className="text-[#6F5C4B]/30 text-sm ml-auto">{SECTIONS[currentSection].label}</span>
            </div>

            {/* Welcome subtitle on first step */}
            {step === 0 && (
              <p className="text-[#6F5C4B]/70 mb-2 text-sm">Welkom! Laten we uw gegevens instellen.</p>
            )}

            {/* Typewriter question */}
            <h2 className="text-2xl sm:text-3xl font-bold text-[#3C2C1E] mb-2 min-h-[2.5em]">
              {displayedText}
              {!isComplete && (
                <span className="inline-block w-[2px] h-[1em] bg-[#00AFCB] ml-0.5 animate-pulse align-middle" />
              )}
            </h2>

            {/* KVK prefill badge */}
            {isFieldFromKvk && (
              <div className="mb-4">
                <KvkPrefillBadge />
                <span className="text-xs text-[#6F5C4B]/50 ml-2">U kunt dit aanpassen indien nodig</span>
              </div>
            )}

            {/* Hint text */}
            {currentStep.hint && !isFieldFromKvk && (
              <p className="text-[#6F5C4B]/50 text-sm mb-4">{currentStep.hint}</p>
            )}

            {/* KVK profile loading indicator */}
            {kvkProfileLoading && (
              <div className="bg-[#E6F9FC] border border-[#00AFCB]/20 rounded-xl px-4 py-3 mb-5 text-sm text-[#004854] flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin text-[#00AFCB]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Bedrijfsgegevens ophalen uit KVK...
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-700 rounded-xl px-4 py-3 mb-5 text-sm border border-red-200">
                {error}
              </div>
            )}

            <div onKeyDown={handleKeyDown}>
              {/* KVK Search input (company name with autocomplete) */}
              {currentStep.type === "kvk-search" ? (
                <div className="relative">
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={data.companyName}
                      onChange={(e) => handleCompanyNameChange(e.target.value)}
                      placeholder={currentStep.placeholder}
                      autoFocus
                      className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00AFCB]/30 focus:border-[#00AFCB] outline-none transition-all text-[#3C2C1E] placeholder:text-gray-400 text-base pr-10"
                    />
                    {kvkSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <svg className="w-5 h-5 animate-spin text-[#00AFCB]" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      </div>
                    )}
                    {kvkSelected && !kvkSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Search results dropdown */}
                  {kvkSearchResults.length > 0 && !kvkSelected && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                        <p className="text-xs text-[#6F5C4B]/50 font-medium">Resultaten uit KVK</p>
                      </div>
                      {kvkSearchResults.map((result) => (
                        <button
                          key={result.kvkNummer}
                          type="button"
                          onClick={() => selectKvkCompany(result)}
                          className="w-full text-left px-4 py-3 hover:bg-[#E6F9FC]/50 transition-colors border-b border-gray-50 last:border-0"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-[#3C2C1E]">{result.naam}</p>
                              <p className="text-xs text-[#6F5C4B]/50 mt-0.5">
                                KVK: {result.kvkNummer}
                                {result.plaats && <> &middot; {result.plaats}</>}
                              </p>
                            </div>
                            <svg className="w-4 h-4 text-[#00AFCB] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Hint when no results and user typed enough */}
                  {data.companyName.length >= 2 && kvkSearchResults.length === 0 && !kvkSearching && !kvkSelected && (
                    <p className="text-xs text-[#6F5C4B]/40 mt-2">
                      Geen resultaten? U kunt uw bedrijfsnaam ook handmatig invullen.
                    </p>
                  )}
                </div>
              ) : currentStep.type === "select" ? (
                <div className="space-y-3">
                  {currentStep.options?.map((opt) => {
                    const isSelected = data[currentStep.field] === opt.value;
                    const isFromKvk = isFieldFromKvk && isSelected;
                    return (
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
                        className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all text-sm font-medium ${
                          isSelected
                            ? "border-[#00AFCB] bg-[#E6F9FC] text-[#004854]"
                            : "border-gray-200 hover:border-[#00AFCB]/30 bg-white text-[#3C2C1E] hover:bg-[#E6F9FC]/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          {opt.label}
                          {isFromKvk && <KvkPrefillBadge />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  ref={inputRef}
                  type={currentStep.type}
                  value={String(data[currentStep.field] || "")}
                  onChange={(e) => setField(currentStep.field, e.target.value)}
                  placeholder={currentStep.placeholder}
                  autoFocus
                  className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00AFCB]/30 focus:border-[#00AFCB] outline-none transition-all text-[#3C2C1E] placeholder:text-gray-400 text-base"
                />
              )}

              {showPasswordStrength && (
                <PasswordStrengthIndicator password={data.password} />
              )}

              {currentStep.helperCondition?.(data) && currentStep.helperText && (
                <div className="mt-4 bg-[#E6F9FC] border border-[#00AFCB]/20 rounded-xl px-4 py-3 text-sm text-[#004854]">
                  {currentStep.helperText}
                </div>
              )}
            </div>

            {/* Skip option for optional tax fields */}
            {currentStep.skippable && (
              <button
                type="button"
                onClick={handleSkip}
                className="mt-4 text-sm text-[#00AFCB] hover:text-[#004854] font-medium transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                {currentStep.skipLabel}
              </button>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-8">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 0}
                className="text-[#6F5C4B]/60 hover:text-[#3C2C1E] disabled:opacity-30 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Vorige
              </button>

              <button
                type="button"
                onClick={goNext}
                disabled={loading}
                className="bg-[#004854] hover:bg-[#003640] disabled:opacity-60 text-white font-semibold py-3 px-8 rounded-xl transition-all shadow-sm hover:shadow-md flex items-center gap-2"
              >
                {loading
                  ? "Bezig..."
                  : isLastStep
                  ? "Account aanmaken"
                  : (
                    <>
                      Volgende
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
              </button>
            </div>

            <p className="text-center text-xs text-[#6F5C4B]/40 mt-6">
              Druk op <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[#6F5C4B]/60 text-[10px] font-medium">Enter</kbd> om verder te gaan
            </p>

            {/* Login link */}
            <div className="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-[#6F5C4B]/70">
              Al een account?{" "}
              <Link href="/login" className="text-[#00AFCB] hover:text-[#004854] font-medium transition-colors">
                Inloggen
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile advisory CTA */}
        <div className="lg:hidden border-t border-gray-200 p-4 bg-white">
          <Link
            href="/advisory"
            className="flex items-center justify-center gap-2 bg-[#00AFCB]/10 hover:bg-[#00AFCB]/15 text-[#004854] font-medium py-2.5 px-4 rounded-xl transition-colors text-sm w-full border border-[#00AFCB]/20"
          >
            <svg className="w-4 h-4 text-[#00AFCB]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Ik wil een kennismakingsgesprek
          </Link>
        </div>
      </div>
    </div>
  );
}
