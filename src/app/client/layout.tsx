"use client";

import { useState, useEffect, useCallback, useRef, Suspense, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";
import { SideRail, type SideRailItem } from "@/components/SideRail";

const moduleItems: { key: string; label: string; href: string; icon: ReactNode }[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/client",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
      </svg>
    ),
  },
  {
    key: "verkoop",
    label: "Verkoop",
    href: "/client?section=verkoop",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    key: "inkoop",
    label: "Inkoop",
    href: "/client?section=inkoop",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
      </svg>
    ),
  },
  {
    key: "bank",
    label: "Bank",
    href: "/client?section=bank",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    key: "fiscaal",
    label: "BTW & Fiscaal",
    href: "/client?section=fiscaal",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: "berichten",
    label: "Berichten",
    href: "/client?section=berichten",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    key: "planning",
    label: "Planning",
    href: "/client?section=planning",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: "klanten",
    label: "Klanten",
    href: "/client/customers",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    key: "instellingen",
    label: "Instellingen",
    href: "/client/settings",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function ClientLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutHover, setLogoutHover] = useState(false);
  const isMainPage = pathname === "/client";
  const lastRefresh = useRef(0);
  // Sidebar collapsed/expanded preference — see the accountant layout
  // for the full rationale. Shared localStorage key so toggling in one
  // portal carries over if the same browser visits the other portal.
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("hamza.sidebar.expanded") === "true") setSidebarExpanded(true);
    } catch {}
  }, []);
  const toggleSidebar = useCallback(() => {
    setSidebarExpanded((prev) => {
      const next = !prev;
      try { localStorage.setItem("hamza.sidebar.expanded", String(next)); } catch {}
      return next;
    });
  }, []);

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

  const activeSection: string = isMainPage
    ? (searchParams.get("section") || "dashboard")
    : pathname === "/client/customers"
      ? "klanten"
      : pathname === "/client/settings"
        ? "instellingen"
        : pathname.startsWith("/client/invoices") || pathname.startsWith("/client/quotations") || pathname === "/client/recurring"
          ? "verkoop"
          : "";

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
      const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileMenuOpen(false); };
      window.addEventListener("keydown", handleEsc);
      return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", handleEsc); };
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  async function handleLogout() {
    setMobileMenuOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  // Mobile menu — simple vertical list, matches the accountant portal.
  const mobileNav = (
    <>
      <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">Menu</p>
        {moduleItems.map((item) => {
          const isActive = activeSection === item.key;
          return (
            <Link key={item.key} href={item.href} onClick={() => setMobileMenuOpen(false)}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive ? "bg-[#00AFCB]/20 text-white" : "text-white/60 hover:bg-white/5 hover:text-white/90"
              }`}>
              {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#00AFCB] rounded-r-full" />}
              <span className={`w-[18px] h-[18px] flex ${isActive ? "text-[#00AFCB]" : "text-white/40"}`}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 pb-4 border-t border-white/10 pt-3">
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-white/40 hover:bg-red-500/10 hover:text-red-400 w-full text-left">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Uitloggen
        </button>
      </div>
    </>
  );

  const railItems: SideRailItem[] = moduleItems.map((item) => ({
    key: item.key,
    label: item.label,
    href: item.href,
    icon: item.icon,
  }));

  return (
    <div className="flex min-h-screen">
      {/* Floating top-right notification bell (desktop only). No header
          bar behind it — it floats over the page content as a single
          chip-style control. */}
      <div className="hidden lg:flex fixed top-3 right-4 z-40 items-center gap-2 pt-[env(safe-area-inset-top)]">
        <div className="bg-white rounded-full border border-gray-200 shadow-sm">
          <NotificationBell variant="light" />
        </div>
      </div>

      {/* Desktop left sidebar — primary navigation shell. Full viewport
          height (top-0 → bottom-0); brand at the top, rail in the
          middle, logout + collapse-toggle at the bottom. Width morphs
          between 56 px (icon rail with wave hover) and 256 px
          (labelled rail). */}
      <aside className={`hidden lg:flex bg-[#004854] flex-col fixed top-0 left-0 bottom-0 z-30 shadow-[4px_0_20px_-10px_rgba(0,0,0,0.3)] transition-[width] duration-300 ease-out ${sidebarExpanded ? "w-64" : "w-14"}`}>
        {/* Brand — pictogram only when collapsed, full HAMZA logo when
            expanded. Mirrors the accountant layout so both portals
            share a consistent shell. */}
        <div className={`h-14 border-b border-white/10 flex items-center overflow-hidden ${sidebarExpanded ? "px-3" : "justify-center"}`}>
          <Link href="/client" aria-label="Home" className="flex items-center">
            {sidebarExpanded ? (
              <Image src="/logo.svg" alt="HAMZA Deboekhouder" width={170} height={44} className="brightness-0 invert" priority />
            ) : (
              <svg viewBox="0 0 152 190" aria-hidden className="w-7 h-9">
                <path fill="#00AFCB" d="M91,8v30h-16V0H30v30H0v152h45v-30h15v38h45v-30h31V8h-45ZM30,167h-15V46h15v121ZM60,137h-15V16h15v121ZM90,175h-15V54h15v121ZM121,144h-15V23h15v121Z" />
              </svg>
            )}
          </Link>
        </div>

        {/* Main nav */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pt-1">
          <SideRail items={railItems} activeKey={activeSection} expanded={sidebarExpanded} />
        </div>

        {/* Bottom — logout + sidebar collapse/expand toggle. Two render
            paths so the bottom controls match whichever rail mode is
            active (see the accountant layout for the pattern). */}
        <div className="border-t border-white/10 py-2">
          {sidebarExpanded ? (
            <div className="flex flex-col gap-0.5 px-2">
              <button onClick={handleLogout} aria-label="Uitloggen"
                className="flex items-center gap-3 h-10 pl-3 pr-2 rounded-lg text-[13px] font-medium text-white/65 hover:bg-red-500/15 hover:text-red-300 transition-colors">
                <span className="w-[18px] h-[18px] shrink-0 flex items-center justify-center">
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </span>
                <span className="flex-1 text-left">Uitloggen</span>
              </button>
              <button onClick={toggleSidebar} aria-label="Menu inklappen"
                className="flex items-center gap-3 h-10 pl-3 pr-2 rounded-lg text-[13px] font-medium text-white/55 hover:bg-white/5 hover:text-white/90 transition-colors">
                <span className="w-[18px] h-[18px] shrink-0 flex items-center justify-center">
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19l-7-7 7-7" /></svg>
                </span>
                <span className="flex-1 text-left">Menu inklappen</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1 px-1.5">
              <button onClick={handleLogout} aria-label="Uitloggen"
                onMouseEnter={() => setLogoutHover(true)}
                onMouseLeave={() => setLogoutHover(false)}
                className={`group relative flex items-center h-11 rounded-xl overflow-hidden whitespace-nowrap transition-[width,background-color,color] duration-300 ease-out ${
                  logoutHover ? "bg-red-500/15 text-red-300 w-[200px] shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)] ring-1 ring-white/5 z-30" : "bg-transparent text-white/55 w-11"
                }`}>
                <span className="w-11 h-11 shrink-0 flex items-center justify-center">
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </span>
                <span className="text-[13px] font-medium pr-4 transition-opacity duration-200" style={{ opacity: logoutHover ? 1 : 0 }}>Uitloggen</span>
              </button>
              <button onClick={toggleSidebar} aria-label="Menu uitklappen"
                className="w-11 h-11 flex items-center justify-center rounded-xl text-white/55 hover:bg-white/5 hover:text-white/90 transition-colors">
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#004854] border-b border-white/10 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/client" className="block">
            <Image src="/logo.svg" alt="HAMZA Deboekhouder" width={120} height={31} className="brightness-0 invert" priority />
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
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
      </div>

      {/* Mobile overlay */}
      {mobileMenuOpen && <div className="lg:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setMobileMenuOpen(false)} />}

      {/* Mobile slide-out menu */}
      <aside className={`lg:hidden fixed top-0 left-0 h-full w-[280px] bg-[#004854] z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <Link href="/client" onClick={() => setMobileMenuOpen(false)} className="block">
            <Image src="/logo.svg" alt="HAMZA Deboekhouder" width={140} height={36} className="brightness-0 invert" priority />
          </Link>
          <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-lg text-white/50 hover:bg-white/10">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {mobileNav}
      </aside>

      {/* Main content — left margin tracks the sidebar width so the
          page reflows when the user toggles collapse/expand. */}
      <main className={`flex-1 min-h-screen bg-[#F5F7FA] pt-14 lg:pt-0 transition-[margin-left] duration-300 ease-out ${sidebarExpanded ? "lg:ml-64" : "lg:ml-14"}`}>
        {children}
      </main>
    </div>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <Suspense><ClientLayoutInner>{children}</ClientLayoutInner></Suspense>;
}
