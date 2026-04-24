"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";
import { ToastProvider } from "@/components/ToastProvider";
import { AdministrationProvider, useAdministration } from "@/components/AdministrationProvider";

const sidebarItems = [
  { key: "administraties", label: "Administraties", href: "/bookkeeper?section=administraties", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
  { key: "dashboard", label: "Dashboard", href: "/bookkeeper", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" /></svg> },
  { key: "verkoop", label: "Verkoop", href: "/bookkeeper?section=verkoop", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
  { key: "inkoop", label: "Inkoop", href: "/bookkeeper?section=inkoop", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg> },
  { key: "bank", label: "Bank", href: "/bookkeeper?section=bank", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg> },
  { key: "kas", label: "Kas", href: "/bookkeeper?section=kas", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
  { key: "memoriaal", label: "Memoriaal", href: "/bookkeeper?section=memoriaal", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
  { key: "boekingen", label: "Boekingen", href: "/bookkeeper?section=boekingen", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> },
  { key: "afletteren", label: "Afletteren", href: "/bookkeeper?section=afletteren", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> },
  { key: "grootboek", label: "Grootboek", href: "/bookkeeper?section=grootboek", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
  { key: "taken", label: "Taken", href: "/bookkeeper?section=taken", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
  { key: "berichten", label: "Berichten", href: "/bookkeeper?section=berichten", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg> },
  { key: "agenda", label: "Agenda", href: "/bookkeeper?section=agenda", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
  { key: "fiscaal", label: "BTW & Fiscaal", href: "/bookkeeper?section=fiscaal", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg> },
  { key: "instellingen", label: "Instellingen", href: "/bookkeeper?section=instellingen", icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
];

const sectionTitles: Record<string, string> = {
  administraties: "Administraties",
  dashboard: "Dashboard", verkoop: "Verkoop", inkoop: "Inkoop", bank: "Bank",
  kas: "Kas", memoriaal: "Memoriaal", boekingen: "Boekingen", afletteren: "Afletteren",
  grootboek: "Grootboek", taken: "Taken", berichten: "Berichten",
  agenda: "Agenda", fiscaal: "BTW & Fiscaal", instellingen: "Instellingen",
};

function BookkeeperLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeAdministration, administrations, selectAdministration } = useAdministration();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const adminMenuRef = useRef<HTMLDivElement>(null);
  const lastRefresh = useRef(0);
  const [sidebarCounts, setSidebarCounts] = useState<{ toProcess: number; overdue: number; inkoopNew: number; boekingenNew: number; boekingenOldQ: number }>({ toProcess: 0, overdue: 0, inkoopNew: 0, boekingenNew: 0, boekingenOldQ: 0 });
  // Generic per-module hover popup state. `hoveredModule` identifies which sidebar
  // module the popup belongs to; `modulePopupPos` is derived from that module's
  // link rect so the popup's top aligns with the button top.
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [modulePopupPos, setModulePopupPos] = useState<{ top: number; left: number } | null>(null);
  const moduleHoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // IMPORTANT: these refs must only be attached from the DESKTOP sidebar. The
  // mobile sidebar renders the same nav markup but is `display:none` at lg+
  // widths; its elements return a zero bounding rect which, if written here,
  // would push the popup to (0, 0) in the top-left corner of the viewport.
  const moduleLinkRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const desktopAsideRef = useRef<HTMLElement | null>(null);
  // 8 px gap between the sidebar's right edge and the popup's left edge.
  // Measured from the sidebar edge — not from the popup's previous position
  // and not from the icon — so the popup sits just outside the sidebar.
  const MODULE_POPUP_RIGHT_OFFSET = 8;
  const [openInvoices, setOpenInvoices] = useState<{ id: string; invoiceNumber: string; customerName: string; total: number; dueDate: string; status: string }[]>([]);
  const [openPurchases, setOpenPurchases] = useState<{ id: string; fileName: string; supplierName: string | null; amount: number | null; totalAmount: number | null; status: string }[]>([]);
  const [oldQuarterBookings, setOldQuarterBookings] = useState<{ id: string; invoiceNumber: string; customerName: string; total: number; date: string }[]>([]);

  const isMainPage = pathname === "/bookkeeper";
  const activeSection = isMainPage
    ? (searchParams.get("section") || "dashboard")
    : pathname.startsWith("/bookkeeper/invoices") ? "verkoop"
    : "";

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

  // Close the administration switcher dropdown on outside click / Escape
  useEffect(() => {
    if (!adminMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(e.target as Node)) setAdminMenuOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAdminMenuOpen(false); };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => { window.removeEventListener("mousedown", handleClick); window.removeEventListener("keydown", handleKey); };
  }, [adminMenuOpen]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
      const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileMenuOpen(false); };
      window.addEventListener("keydown", handleEsc);
      return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", handleEsc); };
    } else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  // Fetch sidebar badge counts + lists used by the per-module hover popups
  useEffect(() => {
    // Verkoop + Boekingen
    fetch("/api/invoices").then((r) => r.ok ? r.json() : []).then((invs: { id: string; invoiceNumber: string; customerName: string; total: number; bookkeepingStatus: string; status: string; dueDate: string; date: string }[]) => {
      if (!Array.isArray(invs)) return;
      const toProcess = invs.filter((i) => i.bookkeepingStatus === "pending" || i.bookkeepingStatus === "to_book").length;
      const now = new Date();
      const overdue = invs.filter((i) => (i.status === "sent" || i.status === "overdue") && new Date(i.dueDate) < now).length;
      // Boekingen badges: new booked + older quarter
      const booked = invs.filter((i) => i.bookkeepingStatus === "booked");
      const currentQ = Math.floor(now.getMonth() / 3);
      const currentY = now.getFullYear();
      const oldQuarter = booked.filter((i) => {
        const d = new Date(i.date);
        const q = Math.floor(d.getMonth() / 3);
        return d.getFullYear() < currentY || (d.getFullYear() === currentY && q < currentQ);
      });
      setSidebarCounts(prev => ({ ...prev, toProcess, overdue, boekingenNew: booked.length, boekingenOldQ: oldQuarter.length }));
      const open = invs
        .filter((i) => i.status === "sent" || i.status === "overdue" || i.bookkeepingStatus === "pending" || i.bookkeepingStatus === "to_book")
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 8)
        .map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, customerName: i.customerName, total: i.total, dueDate: i.dueDate, status: i.status }));
      setOpenInvoices(open);
      const oldList = oldQuarter
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 8)
        .map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, customerName: i.customerName, total: i.total, date: i.date }));
      setOldQuarterBookings(oldList);
    }).catch(() => {});
    // Inkoop
    fetch("/api/purchases/all").then((r) => r.ok ? r.json() : []).then((docs: { id: string; fileName: string; supplierName: string | null; amount: number | null; totalAmount: number | null; status: string; createdAt?: string }[]) => {
      if (!Array.isArray(docs)) return;
      const pending = docs.filter((d) => d.status === "uploaded");
      setSidebarCounts(prev => ({ ...prev, inkoopNew: pending.length }));
      const list = pending
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
        .slice(0, 8)
        .map((d) => ({ id: d.id, fileName: d.fileName, supplierName: d.supplierName, amount: d.amount, totalAmount: d.totalAmount, status: d.status }));
      setOpenPurchases(list);
    }).catch(() => {});
  }, []);

  // Open the hover popup for a given sidebar module.
  //   - vertical: top edge of the popup == top edge of the active module button
  //   - horizontal: 48 px to the right of the desktop sidebar's right edge
  // If either reference element is missing or has a zero rect (e.g. the mobile
  // sidebar is currently `display:none`), we bail out instead of guessing.
  function openModulePopup(moduleKey: string) {
    if (moduleHoverTimeout.current) { clearTimeout(moduleHoverTimeout.current); moduleHoverTimeout.current = null; }
    const el = moduleLinkRefs.current[moduleKey];
    const aside = desktopAsideRef.current;
    if (!el || !aside) return;
    const btnRect = el.getBoundingClientRect();
    const asideRect = aside.getBoundingClientRect();
    if (btnRect.height === 0 || asideRect.width === 0) return;
    setModulePopupPos({
      top: btnRect.top,
      left: asideRect.right + MODULE_POPUP_RIGHT_OFFSET,
    });
    setHoveredModule(moduleKey);
  }
  function scheduleCloseModulePopup() {
    if (moduleHoverTimeout.current) clearTimeout(moduleHoverTimeout.current);
    moduleHoverTimeout.current = setTimeout(() => setHoveredModule(null), 200);
  }
  function cancelCloseModulePopup() {
    if (moduleHoverTimeout.current) { clearTimeout(moduleHoverTimeout.current); moduleHoverTimeout.current = null; }
  }

  // Rendered in both the desktop and the mobile sidebar. Only the desktop
  // variant attaches refs and renders hover popups — the mobile sidebar is
  // `display:none` at lg+ widths and sliding-in at sub-lg widths, so its DOM
  // elements have unreliable bounding rects and hover-popups don't apply.
  function buildNavContent(variant: "desktop" | "mobile") {
    return (
    <>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">Boekhouder</p>
        {sidebarItems.map((item) => {
          const isActive = activeSection === item.key;
          // Shortcut navigation for the sidebar count badges — bypasses the
          // parent Link and jumps straight to a pre-filtered view.
          const shortcutNav = (href: string) => (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setMobileMenuOpen(false);
            router.push(href);
          };
          const linkEl = (
            <Link href={item.href} onClick={() => {
              setMobileMenuOpen(false);
              // Sidebar "Verkoop" always resets to the main sales overview —
              // even when the user is already on /bookkeeper?section=verkoop
              // (URL doesn't change, so useSearchParams() effects won't fire
              // on their own). The event below tells page.tsx to reset.
              if (item.key === "verkoop" && typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("bookkeeper:verkoop:reset"));
              }
            }}
              className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                isActive ? "bg-[#00AFCB]/20 text-white" : "text-white/60 hover:bg-white/5 hover:text-white/90"
              }`}>
              {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#00AFCB] rounded-r-full" />}
              <span className={isActive ? "text-[#00AFCB]" : "text-white/40"}>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {/* Verkoop badges — each is its own shortcut: the blue count
                  jumps to the Boeken overview (where the workflow board
                  already shows the te-boeken column), the red count jumps
                  straight to Debiteurenbeheer with the Verlopen filter. */}
              {item.key === "verkoop" && (sidebarCounts.toProcess > 0 || sidebarCounts.overdue > 0) && (
                <span className="flex items-center gap-1">
                  {sidebarCounts.toProcess > 0 && (
                    <span role="button" tabIndex={0}
                      onClick={shortcutNav("/bookkeeper?section=verkoop&tab=boeken&filter=to_book")}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") shortcutNav("/bookkeeper?section=verkoop&tab=boeken&filter=to_book")(e as unknown as React.MouseEvent); }}
                      title="Open alle te boeken verkoopfacturen"
                      className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white leading-none px-1 hover:bg-blue-400 cursor-pointer">
                      {sidebarCounts.toProcess}
                    </span>
                  )}
                  {sidebarCounts.overdue > 0 && (
                    <span role="button" tabIndex={0}
                      onClick={shortcutNav("/bookkeeper?section=verkoop&tab=debiteurenbeheer&filter=overdue")}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") shortcutNav("/bookkeeper?section=verkoop&tab=debiteurenbeheer&filter=overdue")(e as unknown as React.MouseEvent); }}
                      title="Open verlopen debiteurenoverzicht"
                      className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none px-1 hover:bg-red-400 cursor-pointer">
                      {sidebarCounts.overdue}
                    </span>
                  )}
                </span>
              )}
              {/* Inkoop badge */}
              {item.key === "inkoop" && sidebarCounts.inkoopNew > 0 && (
                <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white leading-none px-1">{sidebarCounts.inkoopNew}</span>
              )}
              {/* Boekingen badges */}
              {item.key === "boekingen" && (sidebarCounts.boekingenNew > 0 || sidebarCounts.boekingenOldQ > 0) && (
                <span className="flex items-center gap-1">
                  {sidebarCounts.boekingenNew > 0 && <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white leading-none px-1">{sidebarCounts.boekingenNew}</span>}
                  {sidebarCounts.boekingenOldQ > 0 && <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none px-1">{sidebarCounts.boekingenOldQ}</span>}
                </span>
              )}
            </Link>
          );
          // Modules with a hover popup. Each entry supplies its popup content +
          // the "has anything to show" check. Positioning is driven by the
          // shared openModulePopup helper so every popup feels anchored to its
          // own sidebar button and gets the same 48px right offset.
          const hasVerkoopItems = openInvoices.length > 0;
          const hasInkoopItems = openPurchases.length > 0;
          const hasBoekingenItems = oldQuarterBookings.length > 0;
          const popupConfig: Record<string, { hasItems: boolean }> = {
            verkoop: { hasItems: hasVerkoopItems },
            inkoop: { hasItems: hasInkoopItems },
            boekingen: { hasItems: hasBoekingenItems },
          };
          if (item.key in popupConfig && variant === "desktop") {
            const { hasItems } = popupConfig[item.key];
            return (
              <div key={item.key} className="relative"
                ref={(el) => { moduleLinkRefs.current[item.key] = el; }}
                onMouseEnter={() => openModulePopup(item.key)}
                onMouseLeave={scheduleCloseModulePopup}>
                {linkEl}
                {hoveredModule === item.key && hasItems && modulePopupPos && typeof window !== "undefined" && window.innerWidth >= 1024 && createPortal(
                  <div
                    className="fixed w-72 bg-white rounded-xl shadow-[4px_4px_20px_-2px_rgba(0,0,0,0.12)] border border-gray-200 z-[9999] py-2 max-h-[360px] overflow-y-auto"
                    style={{ top: modulePopupPos.top, left: modulePopupPos.left }}
                    onMouseEnter={cancelCloseModulePopup}
                    onMouseLeave={scheduleCloseModulePopup}>
                    {item.key === "verkoop" && (
                      <>
                        <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Openstaand ({openInvoices.length}{openInvoices.length >= 8 ? "+" : ""})</p>
                        {openInvoices.map((inv) => {
                          const isOverdue = inv.status === "overdue" || (inv.status === "sent" && new Date(inv.dueDate) < new Date());
                          return (
                            <Link key={inv.id} href={`/bookkeeper/invoices/${inv.id}`}
                              onClick={() => { setHoveredModule(null); setMobileMenuOpen(false); }}
                              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-medium text-gray-900">{inv.invoiceNumber}</span>
                                  {isOverdue && <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-red-100 text-red-600">VERLOPEN</span>}
                                </div>
                                <p className="text-[11px] text-gray-500 truncate">{inv.customerName}</p>
                              </div>
                              <span className="text-xs font-semibold text-gray-700 shrink-0">{new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(inv.total)}</span>
                            </Link>
                          );
                        })}
                        <div className="border-t border-gray-100 mt-1 pt-1 px-3">
                          <Link href="/bookkeeper?section=verkoop" onClick={() => { setHoveredModule(null); setMobileMenuOpen(false); }}
                            className="text-[11px] text-[#00AFCB] font-medium hover:text-[#004854]">Alle facturen bekijken &rarr;</Link>
                        </div>
                      </>
                    )}
                    {item.key === "inkoop" && (
                      <>
                        <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Nieuw geüpload ({openPurchases.length}{openPurchases.length >= 8 ? "+" : ""})</p>
                        {openPurchases.map((doc) => (
                          <Link key={doc.id} href={`/bookkeeper?section=inkoop`}
                            onClick={() => { setHoveredModule(null); setMobileMenuOpen(false); }}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-900 truncate">{doc.supplierName || doc.fileName}</p>
                              <p className="text-[11px] text-gray-500 truncate">{doc.fileName}</p>
                            </div>
                            {(doc.totalAmount ?? doc.amount) != null && (
                              <span className="text-xs font-semibold text-gray-700 shrink-0">{new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format((doc.totalAmount ?? doc.amount) as number)}</span>
                            )}
                          </Link>
                        ))}
                        <div className="border-t border-gray-100 mt-1 pt-1 px-3">
                          <Link href="/bookkeeper?section=inkoop" onClick={() => { setHoveredModule(null); setMobileMenuOpen(false); }}
                            className="text-[11px] text-[#00AFCB] font-medium hover:text-[#004854]">Alle inkoopdocumenten bekijken &rarr;</Link>
                        </div>
                      </>
                    )}
                    {item.key === "boekingen" && (
                      <>
                        <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Ouder kwartaal ({oldQuarterBookings.length}{oldQuarterBookings.length >= 8 ? "+" : ""})</p>
                        {oldQuarterBookings.map((inv) => (
                          <Link key={inv.id} href={`/bookkeeper/invoices/${inv.id}`}
                            onClick={() => { setHoveredModule(null); setMobileMenuOpen(false); }}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-gray-900">{inv.invoiceNumber}</span>
                                <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-red-100 text-red-600">OUDER KW</span>
                              </div>
                              <p className="text-[11px] text-gray-500 truncate">{inv.customerName}</p>
                            </div>
                            <span className="text-xs font-semibold text-gray-700 shrink-0">{new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(inv.total)}</span>
                          </Link>
                        ))}
                        <div className="border-t border-gray-100 mt-1 pt-1 px-3">
                          <Link href="/bookkeeper?section=boekingen" onClick={() => { setHoveredModule(null); setMobileMenuOpen(false); }}
                            className="text-[11px] text-[#00AFCB] font-medium hover:text-[#004854]">Alle boekingen bekijken &rarr;</Link>
                        </div>
                      </>
                    )}
                  </div>,
                  document.body
                )}
              </div>
            );
          }
          return <div key={item.key}>{linkEl}</div>;
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
  }

  const currentTitle = sectionTitles[activeSection] || "";

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside ref={desktopAsideRef} className="hidden lg:flex w-[250px] bg-[#004854] flex-col fixed top-0 left-0 h-full z-40">
        <div className="px-5 py-5 border-b border-white/10">
          <Link href="/bookkeeper" className="block">
            <Image src="/logo.svg" alt="HAMZA Deboekhouder" width={150} height={39} className="brightness-0 invert" priority />
          </Link>
        </div>
        {buildNavContent("desktop")}
      </aside>

      {/* Desktop top header bar */}
      <div className="hidden lg:flex fixed top-0 left-[250px] right-0 h-14 bg-white border-b border-gray-200 z-30 items-center justify-between px-6">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-base font-semibold text-[#3C2C1E] shrink-0">{currentTitle}</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Active administration switcher */}
          <div className="relative" ref={adminMenuRef}>
            {activeAdministration ? (
              <button onClick={() => setAdminMenuOpen((v) => !v)}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-[#00AFCB]/40 hover:bg-[#E6F9FC]/40 transition-colors max-w-[260px]">
                <span className="w-6 h-6 rounded bg-[#004854] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  {(activeAdministration.company || activeAdministration.name).charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 text-left">
                  <p className="text-[10px] text-gray-400 leading-none">Actieve administratie</p>
                  <p className="text-xs font-medium text-[#004854] truncate">{activeAdministration.company || activeAdministration.name}</p>
                </div>
                <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
            ) : (
              <Link href="/bookkeeper?section=administraties" onClick={() => setAdminMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span className="text-xs font-medium">Selecteer administratie</span>
              </Link>
            )}
            {adminMenuOpen && activeAdministration && (
              <div className="absolute right-0 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 z-[9999] max-h-[70vh] overflow-y-auto">
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Wisselen naar</p>
                {administrations.length === 0 && (
                  <p className="px-3 py-2 text-xs text-gray-400">Geen administraties beschikbaar.</p>
                )}
                {administrations.map((adm) => (
                  <button key={adm.id}
                    onClick={() => { selectAdministration(adm.id); setAdminMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2.5 ${adm.id === activeAdministration.id ? "bg-[#E6F9FC]/40" : ""}`}>
                    <span className="w-7 h-7 rounded bg-[#004854] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      {(adm.company || adm.name).charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-900 truncate">{adm.company || adm.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{adm.email}</p>
                    </div>
                    {adm.id === activeAdministration.id && (
                      <svg className="w-4 h-4 text-[#00AFCB]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    )}
                  </button>
                ))}
                <div className="border-t border-gray-100 mt-1 pt-1 px-1">
                  <Link href="/bookkeeper?section=administraties" onClick={() => setAdminMenuOpen(false)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-[#00AFCB] font-medium hover:bg-[#E6F9FC]/40">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    Alle administraties
                  </Link>
                </div>
              </div>
            )}
          </div>
          <NotificationBell variant="light" />
        </div>
      </div>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#004854] border-b border-white/10 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 h-14 gap-2">
          <Link href="/bookkeeper" className="block shrink-0">
            <Image src="/logo.svg" alt="HAMZA Deboekhouder" width={120} height={31} className="brightness-0 invert" priority />
          </Link>
          {activeAdministration && (
            <Link href="/bookkeeper?section=administraties"
              className="flex-1 min-w-0 mx-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/15 transition-colors">
              <p className="text-[9px] text-white/50 leading-none">Administratie</p>
              <p className="text-[11px] font-medium text-white truncate leading-tight">{activeAdministration.company || activeAdministration.name}</p>
            </Link>
          )}
          <div className="flex items-center gap-1 shrink-0">
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
          <Link href="/bookkeeper" onClick={() => setMobileMenuOpen(false)} className="block">
            <Image src="/logo.svg" alt="HAMZA Deboekhouder" width={140} height={36} className="brightness-0 invert" priority />
          </Link>
          <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-lg text-white/50 hover:bg-white/10">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {buildNavContent("mobile")}
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:ml-[250px] min-h-screen bg-[#F5F7FA] pt-14 lg:pt-14">
        {children}
      </main>
    </div>
  );
}

export default function BookkeeperLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <Suspense>
        <AdministrationProvider>
          <BookkeeperLayoutInner>{children}</BookkeeperLayoutInner>
        </AdministrationProvider>
      </Suspense>
    </ToastProvider>
  );
}
