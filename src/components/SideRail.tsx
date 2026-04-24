"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

export interface SideRailItem {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
  /** Optional badge rendered on the collapsed icon (top-right corner). */
  badge?: ReactNode;
  /** Click handler that fires in addition to route navigation. */
  onSelect?: () => void;
}

/**
 * Left-side navigation rail.
 *
 * At rest: compact vertical column of icons. The full width of the rail is
 * 56 px (44 px icon tile + 12 px rail padding). Labels are hidden.
 *
 * On hover: the hovered item expands rightward into the content area as a
 * single connected button — icon stays anchored on the left of the button,
 * label reveals inside the same button as its width grows. Z-index places
 * the expanded button above the main content underneath.
 *
 * The items directly above and below the hovered one nudge a couple of
 * pixels to the right so the whole rail feels alive without being noisy.
 * Moving the cursor down the rail creates a gentle ripple where each item
 * glides out and back in as it passes under the pointer.
 */
export function SideRail({ items, activeKey }: { items: SideRailItem[]; activeKey?: string }) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const hoveredIndex = hoveredKey ? items.findIndex((i) => i.key === hoveredKey) : -1;

  // Width constants
  const COLLAPSED = 44;  // resting button width
  const EXPANDED = 188;  // hover-expanded button width
  // Subtle translate on neighbouring items for the "flow" effect
  const NEIGHBOUR_SHIFT = [0, 3, 1];

  return (
    <nav className="flex flex-col gap-1 px-1.5 py-2">
      {items.map((item, idx) => {
        const isHovered = hoveredKey === item.key;
        const isActive = activeKey === item.key;
        const distance = hoveredIndex >= 0 ? Math.abs(idx - hoveredIndex) : 999;
        const shift = !isHovered ? (NEIGHBOUR_SHIFT[distance] ?? 0) : 0;

        return (
          <div
            key={item.key}
            data-rail-item={item.key}
            className="relative"
            style={{
              transform: `translateX(${shift}px)`,
              transition: "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
              // Hovered item floats above its neighbours so its expanded
              // silhouette always renders above surrounding items.
              zIndex: isHovered ? 30 : isActive ? 20 : 10,
            }}
          >
            <Link
              href={item.href}
              onClick={item.onSelect}
              onMouseEnter={() => setHoveredKey(item.key)}
              onMouseLeave={() => setHoveredKey(null)}
              aria-label={item.label}
              className={`group relative flex items-center h-11 rounded-xl overflow-hidden whitespace-nowrap transition-[width,background-color,box-shadow] duration-300 ease-out ${
                isActive
                  ? isHovered
                    ? "bg-[#00AFCB] text-white shadow-[0_6px_20px_-6px_rgba(0,175,203,0.6)]"
                    : "bg-[#00AFCB]/25 text-white"
                  : isHovered
                    ? "bg-[#003845] text-white shadow-[0_6px_20px_-8px_rgba(0,0,0,0.6)]"
                    : "bg-transparent text-white/65 hover:text-white"
              }`}
              style={{ width: isHovered ? EXPANDED : COLLAPSED }}
            >
              {/* Active-state indicator — small vertical bar on the left
                  edge, mirrors the original sidebar style. Stays visible
                  even in icon-only mode so the selected module is always
                  identifiable. */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#00AFCB] rounded-r-full" />
              )}

              {/* Icon — stays anchored on the left of the button at all
                  widths. 44×44 matches the collapsed button so the icon
                  fills the whole tile at rest. */}
              <span className="w-11 h-11 shrink-0 flex items-center justify-center [&>svg]:w-[18px] [&>svg]:h-[18px]">
                {item.icon}
              </span>

              {/* Label — revealed as the button expands. Fades in slightly
                  faster than the width so it doesn't feel "dragged". */}
              <span
                className="text-[13px] font-medium pr-4 transition-opacity duration-200"
                style={{ opacity: isHovered ? 1 : 0 }}
              >
                {item.label}
              </span>

              {/* Badge slot — positioned on the icon tile (not the full
                  button) so it stays in the same place collapsed or
                  expanded. */}
              {item.badge && (
                <span className="absolute top-0.5 left-[31px] z-10">
                  {item.badge}
                </span>
              )}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
