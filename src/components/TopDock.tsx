"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export interface TopDockItem {
  key: string;
  label: string;
  href: string;
  /** Pre-rendered icon (already sized — the dock normalizes inside an 18px box). */
  icon: ReactNode;
  /** Per-module gradient class, e.g. "from-emerald-500 to-emerald-600". */
  gradient: string;
  /** Optional badge node rendered at the top-right corner of the icon. */
  badge?: ReactNode;
  /** Called on click (e.g. to dispatch a custom reset event). Nav still happens via Link. */
  onSelect?: () => void;
}

export interface TopDockProps {
  items: TopDockItem[];
  activeKey?: string;
  /** Slightly smaller/larger dock — 40 is the default. */
  iconSize?: number;
}

/**
 * Apple-dock-inspired top navigation row.
 *
 * Magnification: each icon computes its own scale from the cursor's horizontal
 * distance with a cosine/smoothstep falloff. `transform-origin: center bottom`
 * keeps neighbours fixed so the scaled icon grows upward into the bar. When
 * the cursor leaves the dock every icon eases back in ~280ms.
 *
 * Intentionally restrained: max scale 1.35, gentle lift (~2px) on the
 * hovered icon, no bounce. Serious software first, premium motion second.
 */
export function TopDock({ items, activeKey, iconSize = 40 }: TopDockProps) {
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [centers, setCenters] = useState<Record<string, number>>({});
  const [mouseX, setMouseX] = useState<number | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const RANGE = 110;
  const MAX_SCALE = 1.35;

  // Measure horizontal icon centers once per layout pass (on mount + on
  // window resize + whenever the item list changes). Reading
  // getBoundingClientRect during render is discouraged in React, so we
  // cache the centers here and look them up lock-free during render.
  useLayoutEffect(() => {
    function measure() {
      const next: Record<string, number> = {};
      for (const [key, el] of Object.entries(itemRefs.current)) {
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0) next[key] = r.left + r.width / 2;
      }
      setCenters(next);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  function computeScale(key: string): number {
    if (mouseX === null) return 1;
    const center = centers[key];
    if (typeof center !== "number") return 1;
    const distance = Math.abs(center - mouseX);
    if (distance > RANGE) return 1;
    const t = 1 - distance / RANGE;
    const smooth = 0.5 - 0.5 * Math.cos(t * Math.PI);
    return 1 + (MAX_SCALE - 1) * smooth;
  }

  return (
    <div
      onMouseMove={(e) => setMouseX(e.clientX)}
      onMouseLeave={() => { setMouseX(null); setHoveredKey(null); }}
      className="flex items-end gap-1.5 px-2.5 py-1.5 rounded-2xl bg-black/25 backdrop-blur-md border border-white/[0.07] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_10px_30px_-10px_rgba(0,0,0,0.5)]"
    >
      {items.map((item) => {
        const scale = computeScale(item.key);
        const isActive = activeKey === item.key;
        const isHovered = hoveredKey === item.key;
        const sizePx = iconSize;
        return (
          <div
            key={item.key}
            ref={(el) => { itemRefs.current[item.key] = el; }}
            data-dock-item={item.key}
            className="relative shrink-0"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "center bottom",
              transition:
                mouseX === null
                  ? "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)"
                  : "transform 70ms linear",
              willChange: "transform",
            }}
          >
            {/* Tooltip above the hovered icon. Rendered inside the wrapper so
                it scales with its parent — the label follows the magnified
                icon smoothly. pointer-events-none prevents flicker when the
                cursor drifts upward. */}
            <span
              className={`absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+6px)] px-2 py-[3px] text-white text-[11px] font-medium rounded-md whitespace-nowrap pointer-events-none shadow-lg transition-opacity duration-150 ${
                isHovered ? "opacity-100" : "opacity-0"
              }`}
              style={{ background: "rgba(12, 16, 20, 0.92)", backdropFilter: "blur(6px)" }}
            >
              {item.label}
              <span
                className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0"
                style={{
                  borderLeft: "4px solid transparent",
                  borderRight: "4px solid transparent",
                  borderTop: "4px solid rgba(12, 16, 20, 0.92)",
                }}
              />
            </span>

            <Link
              href={item.href}
              onClick={item.onSelect}
              onMouseEnter={() => setHoveredKey(item.key)}
              onMouseLeave={() => setHoveredKey(null)}
              aria-label={item.label}
              className={`group relative flex items-center justify-center rounded-xl bg-gradient-to-br ${item.gradient} shadow-[0_3px_10px_rgba(0,0,0,0.28)] text-white transition-[box-shadow,filter] duration-200 ${
                isActive ? "ring-2 ring-white/45" : "ring-0"
              } hover:brightness-110`}
              style={{ width: sizePx, height: sizePx }}
            >
              <span
                className="flex items-center justify-center [&>svg]:w-[18px] [&>svg]:h-[18px]"
                style={{ transform: isHovered ? "translateY(-1px)" : "translateY(0)", transition: "transform 200ms ease-out" }}
              >
                {item.icon}
              </span>
              {/* Subtle top-gloss to give the tile an "app icon" feel */}
              <span className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-white/18 to-transparent opacity-70" />
            </Link>

            {/* Active-module indicator — small rounded pill under the icon,
                like macOS's "running app" dot but a bit more refined. */}
            <span
              className={`absolute left-1/2 -translate-x-1/2 -bottom-[7px] h-[3px] rounded-full bg-white transition-[width,opacity] duration-200 ${
                isActive ? "w-3 opacity-90 shadow-[0_0_6px_rgba(255,255,255,0.65)]" : "w-0 opacity-0"
              }`}
            />

            {/* Badge slot — positioned top-right of the icon with a dark
                ring that matches the nav background so it reads cleanly on
                top of bright gradients. */}
            {item.badge && (
              <span className="absolute -top-1.5 -right-1.5 z-10">
                {item.badge}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
