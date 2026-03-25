"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 sm:p-10 max-w-md w-full">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
            Boekhouder
          </Link>
          <p className="text-gray-500 mt-2">Log in op uw account</p>
        </div>

        {registered === "verify" && (
          <div className="bg-blue-50 text-blue-700 rounded-lg px-4 py-3 mb-6 text-sm">
            Uw account is aangemaakt. Controleer uw e-mail om uw account te verifi&euml;ren voordat u kunt inloggen.
          </div>
        )}

        {registered === "1" && (
          <div className="bg-emerald-50 text-emerald-700 rounded-lg px-4 py-3 mb-6 text-sm">
            Account succesvol aangemaakt. Welkom! U kunt nu inloggen.
          </div>
        )}

        {verified && (
          <div className="bg-emerald-50 text-emerald-700 rounded-lg px-4 py-3 mb-6 text-sm">
            Uw e-mailadres is succesvol geverifieerd. U kunt nu inloggen.
          </div>
        )}

        {resetDone && (
          <div className="bg-emerald-50 text-emerald-700 rounded-lg px-4 py-3 mb-6 text-sm">
            Uw wachtwoord is succesvol gewijzigd. U kunt nu inloggen met uw nieuwe wachtwoord.
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">
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
                    className="text-blue-600 hover:text-blue-800 font-medium underline"
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
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">
              Gebruikersnaam
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
              placeholder="uw@email.nl"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              Wachtwoord
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">Onthoud mij</span>
            </label>
            <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              Wachtwoord vergeten?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3.5 rounded-xl transition-colors text-lg"
          >
            {loading ? "Bezig met inloggen..." : "Inloggen"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          Nog geen account?{" "}
          <Link href="/register" className="text-blue-600 hover:text-blue-800 font-medium">
            Registreren
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <Link
          href="/advisory"
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-5 rounded-xl transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Ik wil een kennismakingsgesprek
        </Link>
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
