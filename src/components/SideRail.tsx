"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface SideRailItem {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
  /** Optional badge rendered at the top-right of the icon. */
  badge?: ReactNode;
  /** Extra click handler (runs alongside navigation). */
  onSelect?: () => void;
}

const COLLAPSED = 44;
const EXPANDED = 200;
// 100 / 75 / 50 / 25 % wave scaled by distance from the hovered tile.
// Items at distance >= 4 stay collapsed (icon-only).
const WAVE_SCALES = [1, 0.75, 0.5, 0.25];
function widthForDistance(distance: number): number {
  if (distance >= WAVE_SCALES.length) return COLLAPSED;
  return COLLAPSED + (EXPANDED - COLLAPSED) * WAVE_SCALES[distance];
}

/**
 * Left-side icon rail with a "wave" expand-on-hover behaviour.
 *
 * Layout strategy:
 *   - Each rail tile is a 44 × 44 placeholder in the rail's flow. It
 *     reserves vertical space and exposes `data-rail-item` so the
 *     bookkeeper layout's module-popups can anchor to a tile's
 *     coordinates.
 *   - For every item a sibling "pill" is rendered via createPortal at
 *     the tile's `getBoundingClientRect()` coords. The pill carries the
 *     visible chrome (background, label, icon, badge) and grows wider
 *     based on its distance to the hovered tile. Because pills live in
 *     `document.body` they cannot be clipped by the rail's
 *     `overflow-y-auto` scroller — same trick we used before, just
 *     applied to every item instead of only the hovered one.
 *
 * Wave behaviour:
 *   - Hovered tile = 100 % expansion (200 px wide).
 *   - First neighbours = 75 %  ≈ 161 px.
 *   - Second neighbours = 50 % ≈ 122 px.
 *   - Third neighbours = 25 %  ≈  83 px.
 *   - Everything else stays at 44 px (icon-only).
 *   - A CSS `transition: width` on every pill turns cursor movement
 *     along the rail into a continuous ripple — no separate enter/leave
 *     keyframes.
 *
 * Icon-and-label motion (the requested premium reveal):
 *   - The pill is a flex row laid out as `[ label (flex-1) ][ icon (w-11 fixed) ]`.
 *   - As the pill widens, the icon stays anchored to the right and
 *     visually slides RIGHT while the flex-1 label area opens up on
 *     the left. The label fades in only for the hovered tile, with an
 *     80 ms delay so it feels REVEALED by the expansion rather than
 *     popped in. Neighbour pills stay un-labelled — they're supporting
 *     motion, not duplicate hover states.
 */
export function SideRail({ items, activeKey }: { items: SideRailItem[]; activeKey?: string }) {
  const tileRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [tileRects, setTileRects] = useState<Record<string, { top: number; left: number }>>({});

  const hoveredIndex = hoveredKey ? items.findIndex((i) => i.key === hoveredKey) : -1;

  // Measure tile coordinates so the portal pills can match them. We
  // re-measure on resize and on any ancestor scroll (capture phase) so
  // the pills stay glued to their tiles even when the rail's scroll
  // container moves them around. Initial render has empty tileRects so
  // each portal pill bails out (`if (!rect) return null`) until this
  // effect runs and populates them.
  useLayoutEffect(() => {
    function measure() {
      const next: Record<string, { top: number; left: number }> = {};
      for (const item of items) {
        const el = tileRefs.current[item.key];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        next[item.key] = { top: rect.top, left: rect.left };
      }
      setTileRects(next);
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [items]);

  return (
    <>
      {/* Rail tiles — layout placeholders. Each tile reserves vertical
          space and hosts a basic icon link so the rail is navigable
          before the portal hydrates (or for users with no JS). The
          portal pills below render on top once mounted and become the
          real interactive surface. */}
      <nav className="flex flex-col gap-1 px-1.5 py-2">
        {items.map((item) => (
          <div
            key={item.key}
            ref={(el) => {
              tileRefs.current[item.key] = el;
            }}
            data-rail-item={item.key}
            className="relative w-11 h-11"
          >
            <Link
              href={item.href}
              onClick={item.onSelect}
              aria-label={item.label}
              className="absolute inset-0 flex items-center justify-center text-white/65 [&>svg]:w-[18px] [&>svg]:h-[18px]"
            >
              {item.icon}
            </Link>
          </div>
        ))}
      </nav>

      {/* Portal pills — one per item, always mounted after hydration.
          Width morphs from 44 px → 200 px / 161 / 122 / 83 / 44 based on
          the distance to the currently hovered tile. The CSS transition
          makes cursor movement along the rail produce a smooth wave. */}
      {typeof document !== "undefined" && createPortal(
        <>
          {items.map((item, idx) => {
            const rect = tileRects[item.key];
            if (!rect) return null;
            const distance = hoveredIndex >= 0 ? Math.abs(idx - hoveredIndex) : 999;
            const width = hoveredIndex < 0 ? COLLAPSED : widthForDistance(distance);
            const isHovered = item.key === hoveredKey;
            const isActive = activeKey === item.key;
            const inWave = distance < WAVE_SCALES.length;

            // Visual treatment per state. Hovered pill is the focal
            // point (solid bg + shadow + ring); active gets the brand
            // cyan tint; wave-neighbours get a very soft fill so the
            // expansion is visible without competing with the hovered
            // item; everything else is invisible (transparent over the
            // rail tile underneath).
            const pillBg = isHovered
              ? "bg-[#003845] shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)] ring-1 ring-white/5"
              : isActive
              ? "bg-[#00AFCB]/25"
              : inWave
              ? "bg-white/[0.04]"
              : "bg-transparent";
            const textColor = isHovered || isActive ? "text-white" : "text-white/70";

            return (
              <div
                key={item.key}
                className="fixed z-[60]"
                style={{
                  top: rect.top,
                  left: rect.left,
                  width,
                  height: COLLAPSED,
                  transition: "width 240ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
                onMouseEnter={() => setHoveredKey(item.key)}
                onMouseLeave={() => setHoveredKey(null)}
              >
                <Link
                  href={item.href}
                  onClick={item.onSelect}
                  aria-label={item.label}
                  className={`relative flex items-center w-full h-full rounded-xl overflow-hidden whitespace-nowrap transition-[background-color,box-shadow] duration-200 ${pillBg} ${textColor}`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#00AFCB] rounded-r-full z-10" />
                  )}
                  {/* Label — left side, revealed by the expansion. Only
                      the hovered tile reveals it; neighbours stay
                      un-labelled (spec §9). The 80 ms delay makes the
                      reveal feel coupled to the width morph rather than
                      a separate fade. */}
                  <span
                    className="flex-1 min-w-0 text-[13px] font-medium pl-3 pr-1 truncate transition-opacity"
                    style={{
                      opacity: isHovered ? 1 : 0,
                      transitionDuration: "200ms",
                      transitionDelay: isHovered ? "80ms" : "0ms",
                    }}
                  >
                    {item.label}
                  </span>
                  {/* Icon — anchored to the right. As the pill widens
                      this span visually slides RIGHT because the flex-1
                      label area grows in front of it. The icon never
                      changes size or position relative to the pill's
                      right edge — it just rides along with it. */}
                  <span className="w-11 h-11 shrink-0 flex items-center justify-center [&>svg]:w-[18px] [&>svg]:h-[18px]">
                    {item.icon}
                  </span>
                </Link>
                {item.badge && (
                  <span className="absolute top-0.5 right-[-2px] z-20 pointer-events-auto">
                    {item.badge}
                  </span>
                )}
              </div>
            );
          })}
        </>,
        document.body
      )}
    </>
  );
}
