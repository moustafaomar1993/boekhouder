"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");
  const verified = searchParams.get("verified") === "1";
  const resetDone = searchParams.get("reset") === "1";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("boekhouder_username");
    if (saved) {
      setUsername(saved);
      setRemember(true);
    }
  }, []);
  const [loading, setLoading] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setEmailNotVerified(false);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.emailNotVerified) {
          setEmailNotVerified(true);
          setUnverifiedEmail(data.email || "");
        }
        setError(data.error || "Inloggen mislukt");
        return;
      }

      if (remember) {
        localStorage.setItem("boekhouder_username", username);
      } else {
        localStorage.removeItem("boekhouder_username");
      }

      // Route based on role
      if (data.user?.role === "admin") {
        router.push("/admin");
      } else if (data.user?.role === "bookkeeper") {
        router.push("/bookkeeper");
      } else {
        router.push("/client");
      }
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    setResendLoading(true);
    setResendSuccess(false);
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unverifiedEmail }),
      });
      setResendSuccess(true);
    } catch {
      // silently fail
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] bg-[#004854] flex-col justify-between p-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative z-10">
          <Image src="/logo.svg" alt="HAMZA Deboekhouder" width={200} height={52} className="brightness-0 invert" priority />
        </div>
        <div className="relative z-10 space-y-6">
          <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight">
            Uw boekhouding,<br />
            <span className="text-[#00AFCB]">helder en overzichtelijk.</span>
          </h1>
          <p className="text-white/70 text-base leading-relaxed max-w-sm">
            Beheer uw facturen, bekijk uw fiscale overzichten en houd grip op uw administratie &mdash; alles op &eacute;&eacute;n plek.
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex -space-x-2">
            <div className="w-8 h-8 rounded-full bg-[#00AFCB]/30 border-2 border-[#004854] flex items-center justify-center text-xs text-white font-medium">JV</div>
            <div className="w-8 h-8 rounded-full bg-[#6F5C4B]/40 border-2 border-[#004854] flex items-center justify-center text-xs text-white font-medium">MO</div>
            <div className="w-8 h-8 rounded-full bg-[#00AFCB]/20 border-2 border-[#004854] flex items-center justify-center text-xs text-white font-medium">PB</div>
          </div>
          <p className="text-white/50 text-sm">Vertrouwd door ondernemers</p>
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-12 bg-gray-50">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10 flex justify-center">
            <Image src="/logo.svg" alt="HAMZA Deboekhouder" width={180} height={47} priority />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-[#3C2C1E]">Welkom terug</h2>
            <p className="text-[#6F5C4B]/70 mt-1.5">Log in op uw account</p>
          </div>

          {registered === "verify" && (
            <div className="bg-[#E6F9FC] text-[#004854] rounded-xl px-4 py-3 mb-6 text-sm border border-[#00AFCB]/20">
              Uw account is aangemaakt. Controleer uw e-mail om uw account te verifi&euml;ren voordat u kunt inloggen.
            </div>
          )}

          {registered === "1" && (
            <div className="bg-emerald-50 text-emerald-700 rounded-xl px-4 py-3 mb-6 text-sm border border-emerald-200">
              Account succesvol aangemaakt. Welkom! U kunt nu inloggen.
            </div>
          )}

          {verified && (
            <div className="bg-emerald-50 text-emerald-700 rounded-xl px-4 py-3 mb-6 text-sm border border-emerald-200">
              Uw e-mailadres is succesvol geverifieerd. U kunt nu inloggen.
            </div>
          )}

          {resetDone && (
            <div className="bg-emerald-50 text-emerald-700 rounded-xl px-4 py-3 mb-6 text-sm border border-emerald-200">
              Uw wachtwoord is succesvol gewijzigd. U kunt nu inloggen met uw nieuwe wachtwoord.
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-700 rounded-xl px-4 py-3 mb-6 text-sm border border-red-200">
              {error}
              {emailNotVerified && (
                <div className="mt-3">
                  {resendSuccess ? (
                    <p className="text-emerald-700">Een nieuwe verificatie-e-mail is verstuurd.</p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resendLoading}
                      className="text-[#00AFCB] hover:text-[#004854] font-medium underline"
                    >
                      {resendLoading ? "Versturen..." : "Nieuwe verificatie-e-mail versturen"}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-[#3C2C1E] mb-1.5">
                Gebruikersnaam
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00AFCB]/30 focus:border-[#00AFCB] outline-none transition-all text-[#3C2C1E] placeholder:text-gray-400"
                placeholder="uw@email.nl"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#3C2C1E] mb-1.5">
                Wachtwoord
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00AFCB]/30 focus:border-[#00AFCB] outline-none transition-all text-[#3C2C1E] placeholder:text-gray-400"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[#00AFCB] focus:ring-[#00AFCB]"
                />
                <span className="text-sm text-[#6F5C4B]">Onthoud mij</span>
              </label>
              <Link href="/forgot-password" className="text-sm text-[#00AFCB] hover:text-[#004854] font-medium transition-colors">
                Wachtwoord vergeten?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#004854] hover:bg-[#003640] disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition-all text-base shadow-sm hover:shadow-md"
            >
              {loading ? "Bezig met inloggen..." : "Inloggen"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-[#6F5C4B]/70">
            Nog geen account?{" "}
            <Link href="/register" className="text-[#00AFCB] hover:text-[#004854] font-medium transition-colors">
              Registreren
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <Link
              href="/advisory"
              className="flex items-center justify-center gap-2 bg-[#00AFCB]/10 hover:bg-[#00AFCB]/15 text-[#004854] font-medium py-2.5 px-5 rounded-xl transition-colors text-sm w-full border border-[#00AFCB]/20"
            >
              <svg className="w-4 h-4 text-[#00AFCB]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Ik wil een kennismakingsgesprek
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
