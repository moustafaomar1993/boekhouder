"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface SideRailItem {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
  /** Optional badge rendered at the top-right of the icon tile. */
  badge?: ReactNode;
  /** Extra click handler (runs alongside navigation). */
  onSelect?: () => void;
}

/**
 * Left-side icon rail with expand-on-hover behaviour.
 *
 * At rest each item is a 44 px icon tile. When the cursor enters a tile
 * we mount a "pill" via createPortal, positioned with fixed coordinates
 * based on the tile's bounding rect. The pill's width (44 → 200 px) and
 * the label's opacity are driven by CSS keyframes with `forwards` fill —
 * no React state transitions needed, and the portal guarantees the pill
 * is never clipped by ancestor overflow containers.
 *
 * A `key={hoveredKey}` on the portal node forces a fresh mount when the
 * cursor moves from one tile to another, so the animation replays from
 * its starting state instead of staying at the end state.
 *
 * Neighbour reaction: items at distance 1/2 from the hovered tile nudge
 * 3 / 1 px to the right so moving the cursor down the rail produces a
 * gentle ripple.
 */
export function SideRail({ items, activeKey }: { items: SideRailItem[]; activeKey?: string }) {
  const tileRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [hoverRect, setHoverRect] = useState<{ top: number; left: number } | null>(null);
  const hoveredIndex = hoveredKey ? items.findIndex((i) => i.key === hoveredKey) : -1;
  const NEIGHBOUR_SHIFT = [0, 3, 1];

  function enterTile(key: string, el: HTMLElement | null) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setHoverRect({ top: rect.top, left: rect.left });
    setHoveredKey(key);
  }
  function leavePill() {
    setHoveredKey(null);
    setHoverRect(null);
  }

  const hoveredItem = hoveredKey ? items.find((i) => i.key === hoveredKey) || null : null;
  const hoveredIsActive = hoveredItem ? activeKey === hoveredItem.key : false;

  return (
    <>
      <nav className="flex flex-col gap-1 px-1.5 py-2">
        {items.map((item, idx) => {
          const isActive = activeKey === item.key;
          const isHovered = hoveredKey === item.key;
          const distance = hoveredIndex >= 0 ? Math.abs(idx - hoveredIndex) : 999;
          const shift = !isHovered ? (NEIGHBOUR_SHIFT[distance] ?? 0) : 0;

          return (
            <div
              key={item.key}
              ref={(el) => { tileRefs.current[item.key] = el; }}
              data-rail-item={item.key}
              className="relative"
              style={{
                transform: `translateX(${shift}px)`,
                transition: "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
              onMouseEnter={(e) => enterTile(item.key, e.currentTarget)}
            >
              <Link
                href={item.href}
                onClick={item.onSelect}
                aria-label={item.label}
                className={`relative flex items-center w-11 h-11 rounded-xl transition-colors duration-200 ${
                  isActive
                    ? "bg-[#00AFCB]/25 text-white"
                    : "text-white/65 hover:text-white"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#00AFCB] rounded-r-full" />
                )}
                <span className="w-11 h-11 flex items-center justify-center [&>svg]:w-[18px] [&>svg]:h-[18px]">
                  {item.icon}
                </span>
              </Link>
              {item.badge && (
                <span className="absolute top-0.5 -right-0.5 z-10">
                  {item.badge}
                </span>
              )}
            </div>
          );
        })}
      </nav>

      {/* Portal-rendered expanded pill — sits at fixed coordinates above
          any page content, never clipped by overflow containers. The
          `key={hoveredKey}` forces a fresh mount each time the hovered
          tile changes, so the width + label animations replay from their
          starting state instead of jumping straight to 200 px. */}
      {hoveredItem && hoverRect && typeof document !== "undefined" && createPortal(
        <div
          key={hoveredKey ?? undefined}
          className={`fixed z-[80] h-11 rounded-xl flex items-center whitespace-nowrap overflow-hidden shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)] ring-1 ring-white/5 animate-side-rail-slide ${
            hoveredIsActive
              ? "bg-[#00AFCB] text-white"
              : "bg-[#003845] text-white"
          }`}
          style={{
            top: hoverRect.top,
            left: hoverRect.left,
          }}
          onMouseLeave={leavePill}
        >
          {hoveredIsActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-white/90 rounded-r-full" />
          )}
          <Link
            href={hoveredItem.href}
            onClick={hoveredItem.onSelect}
            className="flex items-center h-full w-full"
            aria-label={hoveredItem.label}
          >
            <span className="w-11 h-11 shrink-0 flex items-center justify-center [&>svg]:w-[18px] [&>svg]:h-[18px]">
              {hoveredItem.icon}
            </span>
            <span className="text-[13px] font-medium pr-4 animate-side-rail-label">
              {hoveredItem.label}
            </span>
          </Link>
          {hoveredItem.badge && (
            <span className="absolute top-0.5 -right-0.5 z-10">
              {hoveredItem.badge}
            </span>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
