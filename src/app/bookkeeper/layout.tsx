"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const sidebarItems = [
  { key: "dashboard", label: "Dashboard", href: "/bookkeeper", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" /></svg> },
  { key: "verkoop", label: "Verkoop", href: "/bookkeeper?section=verkoop", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
  { key: "inkoop", label: "Inkoop", href: "/bookkeeper?section=inkoop", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg> },
  { key: "bank", label: "Bank", href: "/bookkeeper?section=bank", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg> },
  { key: "kas", label: "Kas", href: "/bookkeeper?section=kas", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
  { key: "afletteren", label: "Afletteren", href: "/bookkeeper?section=afletteren", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> },
  { key: "taken", label: "Taken", href: "/bookkeeper?section=taken", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
  { key: "berichten", label: "Berichten", href: "/bookkeeper?section=berichten", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg> },
  { key: "agenda", label: "Agenda", href: "/bookkeeper?section=agenda", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
  { key: "fiscaal", label: "BTW & Fiscaal", href: "/bookkeeper?section=fiscaal", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg> },
  { key: "instellingen", label: "Instellingen", href: "/bookkeeper?section=instellingen", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
];

function BookkeeperLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const lastRefresh = useRef(0);

  const isMainPage = pathname === "/bookkeeper";
  const activeSection = isMainPage ? (searchParams.get("section") || "dashboard") : "";

  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

  const refreshSession = useCallback(() => {
    const now = Date.now();
    if (now - lastRefresh.current < 5 * 60 * 1000) return;
    lastRefresh.current = now;
    fetch("/api/auth/refresh", { method: "POST" }).then((res) => {
      if (res.status === 401) router.push("/login");
    }).catch(() => {});
  }, [router]);

  useEffect(() => {
    const events = ["click", "keydown", "scroll", "mousemove", "touchstart"];
    events.forEach((e) => window.addEventListener(e, refreshSession, { passive: true }));
    refreshSession();
    return () => { events.forEach((e) => window.removeEventListener(e, refreshSession)); };
  }, [refreshSession]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
      const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileMenuOpen(false); };
      window.addEventListener("keydown", handleEsc);
      return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", handleEsc); };
    } else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const isMainPage = pathname === "/bookkeeper";

  const navContent = (
    <>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">Boekhouder</p>
        {sidebarItems.map((item) => {
          const isActive = isMainPage && activeSection === item.key;
          return (
            <Link key={item.key} href={item.href} onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                isActive ? "bg-[#00AFCB]/15 text-[#00AFCB]" : "text-white/60 hover:bg-white/5 hover:text-white/90"
              }`}>
              <span className={isActive ? "text-[#00AFCB]" : "text-white/40"}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 pb-4 border-t border-white/10 pt-3">
        <button onClick={() => { setMobileMenuOpen(false); fetch("/api/auth/logout", { method: "POST" }).then(() => router.push("/login")); }}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-white/40 hover:bg-red-500/10 hover:text-red-400 w-full text-left">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          Uitloggen
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[250px] bg-[#004854] flex-col fixed top-0 left-0 h-full z-40">
        <div className="px-5 py-5 border-b border-white/10">
          <Link href="/bookkeeper" className="block">
            <Image src="/logo.svg" alt="HAMZA Deboekhouder" width={150} height={39} className="brightness-0 invert" priority />
          </Link>
        </div>
        {navContent}
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#004854] border-b border-white/10 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/bookkeeper" className="block">
            <Image src="/logo.svg" alt="HAMZA Deboekhouder" width={120} height={31} className="brightness-0 invert" priority />
          </Link>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-white/70 hover:bg-white/10 transition-colors"
            aria-label={mobileMenuOpen ? "Menu sluiten" : "Menu openen"}>
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileMenuOpen && <div className="lg:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setMobileMenuOpen(false)} />}

      {/* Mobile slide-out menu */}
      <aside className={`lg:hidden fixed top-0 left-0 h-full w-[280px] bg-[#004854] z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <Link href="/bookkeeper" onClick={() => setMobileMenuOpen(false)} className="block">
            <Image src="/logo.svg" alt="HAMZA Deboekhouder" width={140} height={36} className="brightness-0 invert" priority />
          </Link>
          <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-lg text-white/50 hover:bg-white/10">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {navContent}
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:ml-[250px] min-h-screen bg-[#F5F7FA] pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}

export default function BookkeeperLayout({ children }: { children: React.ReactNode }) {
  return <Suspense><BookkeeperLayoutInner>{children}</BookkeeperLayoutInner></Suspense>;
}
