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
      className="flex items-end gap-[9px] px-3 py-2 rounded-[18px] bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),inset_0_-1px_0_0_rgba(0,0,0,0.2),0_12px_40px_-14px_rgba(0,0,0,0.6)]"
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
            {/* Tooltip above the hovered icon. pointer-events-none prevents
                flicker when the cursor drifts upward. */}
            <span
              className={`absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+10px)] px-2.5 py-1 text-white text-[11px] font-medium rounded-lg whitespace-nowrap pointer-events-none shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)] transition-all duration-150 ${
                isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
              }`}
              style={{ background: "rgba(10, 14, 18, 0.94)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {item.label}
              <span
                className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0"
                style={{
                  borderLeft: "5px solid transparent",
                  borderRight: "5px solid transparent",
                  borderTop: "5px solid rgba(10, 14, 18, 0.94)",
                }}
              />
            </span>

            <Link
              href={item.href}
              onClick={item.onSelect}
              onMouseEnter={() => setHoveredKey(item.key)}
              onMouseLeave={() => setHoveredKey(null)}
              aria-label={item.label}
              className={`group relative flex items-center justify-center rounded-[13px] bg-gradient-to-br ${item.gradient} text-white transition-[box-shadow,filter] duration-200 ${
                isActive
                  ? "shadow-[0_6px_20px_-4px_rgba(0,175,203,0.55),0_2px_6px_rgba(0,0,0,0.3)] ring-1 ring-white/30"
                  : "shadow-[0_3px_10px_rgba(0,0,0,0.3)] ring-1 ring-black/10 hover:brightness-110"
              }`}
              style={{ width: sizePx, height: sizePx }}
            >
              <span
                className="flex items-center justify-center [&>svg]:w-[19px] [&>svg]:h-[19px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]"
                style={{ transform: isHovered ? "translateY(-1px)" : "translateY(0)", transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)" }}
              >
                {item.icon}
              </span>
              {/* Soft top gloss — gives each tile an "app icon" feel */}
              <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[13px] bg-gradient-to-b from-white/25 to-transparent" />
              {/* Subtle bottom shadow band — adds dimension */}
              <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 rounded-b-[13px] bg-gradient-to-t from-black/15 to-transparent" />
            </Link>

            {/* Active-module indicator — brand-cyan glowing pill below the
                icon. Clearly marks "this is the module you're in" without
                competing with the icon colour. */}
            <span
              className={`absolute left-1/2 -translate-x-1/2 -bottom-[9px] h-[3px] rounded-full transition-[width,opacity,background-color,box-shadow] duration-250 ${
                isActive
                  ? "w-5 opacity-100 bg-[#00AFCB] shadow-[0_0_10px_rgba(0,175,203,0.8)]"
                  : "w-0 opacity-0"
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
