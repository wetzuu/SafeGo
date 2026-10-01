"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { levelName, type RiskLevel } from "@/lib/safego/plain-language";

// --- responsive ---

const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribeToDesktopQuery(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True at the lg breakpoint and up, where the sidebar layout is used instead of the phone layout. */
export function useIsDesktop() {
  return useSyncExternalStore(subscribeToDesktopQuery, () => window.matchMedia(DESKTOP_QUERY).matches, () => true);
}

// --- risk badge: colour, icon and words together, so meaning never rests on colour alone ---

const LEVEL_STYLES: Record<RiskLevel, string> = {
  low: "bg-low-soft text-low",
  mod: "bg-mod-soft text-mod",
  high: "bg-high-soft text-high",
  crit: "bg-crit-soft text-crit",
  unknown: "bg-neutral-soft text-ink-soft",
};

export function RiskIcon({ level, className = "size-4" }: { level: RiskLevel; className?: string }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className, "aria-hidden": true };
  if (level === "low") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.7 2.7L16 9.5" /></svg>;
  if (level === "mod") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h.01" /></svg>;
  if (level === "high") return <svg {...common}><path d="M12 3.5 2.5 20h19L12 3.5Z" /><path d="M12 10v4.5M12 17.5h.01" /></svg>;
  if (level === "crit") return <svg {...common}><path d="M8 3h8l5 5v8l-5 5H8l-5-5V8l5-5Z" /><path d="M12 8v5M12 16.5h.01" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.7M12 17h.01" /></svg>;
}

export function RiskBadge({ level, label, partial = false, size = "md" }: { level: RiskLevel; label?: string; partial?: boolean; size?: "sm" | "md" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-bold ${LEVEL_STYLES[level]} ${size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"}`}>
      <RiskIcon level={level} className={size === "sm" ? "size-3.5" : "size-4"} />
      {label ?? levelName(level)}
      {partial && level !== "unknown" && <span className="font-semibold opacity-80">· partial</span>}
    </span>
  );
}

// --- theme toggle ---

const THEME_KEY = "safego-theme";
const themeListeners = new Set<() => void>();

function currentTheme(): "light" | "dark" {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribeToTheme(onChange: () => void) {
  themeListeners.add(onChange);
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", onChange);
  return () => {
    themeListeners.delete(onChange);
    query.removeEventListener("change", onChange);
  };
}

/** Applies a saved theme choice on load; without one the app follows the device setting. */
export function useSavedTheme() {
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") {
        document.documentElement.dataset.theme = saved;
        themeListeners.forEach((listener) => listener());
      }
    } catch {
      // Storage can be unavailable (private windows); the device setting still applies.
    }
  }, []);
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, currentTheme, () => "light" as const);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="size-11 lg:size-9 shrink-0 rounded-full border border-hairline bg-panel text-ink-soft hover:bg-surface flex items-center justify-center"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          window.localStorage.setItem(THEME_KEY, next);
        } catch {
          // The choice still applies for this visit.
        }
        themeListeners.forEach((listener) => listener());
      }}
    >
      {theme === "dark"
        ? <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></svg>
        : <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></svg>}
    </button>
  );
}

// --- one-time hint ---

const HINT_KEY = "safego-hint-seen";
const noSubscription = () => () => {};

/** A short first-visit tip. Dismissed for good once closed. */
export function OnboardingHint({ children }: { children: React.ReactNode }) {
  const [closed, setClosed] = useState(false);
  const seen = useSyncExternalStore(noSubscription, () => {
    try {
      return window.localStorage.getItem(HINT_KEY) === "1";
    } catch {
      return false;
    }
  }, () => true);
  if (seen || closed) return null;
  return (
    <div className="pointer-events-auto flex items-start gap-2 rounded-box bg-inverse text-white px-3 py-2.5 text-xs leading-snug shadow-[var(--shadow-card)]" role="note">
      <span className="flex-1">{children}</span>
      <button
        type="button"
        className="-m-2 size-11 shrink-0 rounded-full hover:bg-white/15 text-base leading-none"
        aria-label="Dismiss tip"
        onClick={() => {
          setClosed(true);
          try {
            window.localStorage.setItem(HINT_KEY, "1");
          } catch {
            // Closing still hides it for this visit.
          }
        }}
      >
        ×
      </button>
    </div>
  );
}

// --- bottom sheet (phone) ---

export type SheetState = "peek" | "half" | "full";
const SHEET_ORDER: SheetState[] = ["peek", "half", "full"];

function sheetHeights(viewport: number, peek: number) {
  return { peek, half: Math.round(viewport * 0.46), full: Math.round(viewport * 0.86) };
}

/**
 * A draggable sheet with three stops, like a maps app: peek shows the summary, half the essentials,
 * full everything. Drag the handle, or tap it to step up. `floating` is pinned just above the sheet.
 */
export function BottomSheet({
  state,
  onStateChange,
  header,
  children,
  floating,
  peekHeight = 132,
  bottomOffset = 0,
  label,
}: {
  state: SheetState;
  onStateChange: (state: SheetState) => void;
  header: React.ReactNode;
  children: React.ReactNode;
  floating?: React.ReactNode;
  peekHeight?: number;
  bottomOffset?: number;
  label: string;
}) {
  const [viewport, setViewport] = useState(720);
  const [drag, setDrag] = useState<number | null>(null);
  const dragStart = useRef<{ y: number; height: number; moved: boolean } | null>(null);

  useEffect(() => {
    const update = () => setViewport(window.innerHeight - bottomOffset);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [bottomOffset]);

  const heights = sheetHeights(viewport, peekHeight);
  const height = drag ?? heights[state];

  function settle(current: number, moved: boolean) {
    if (!moved) {
      // A tap steps up one stop, and from full back down to peek.
      onStateChange(state === "full" ? "peek" : SHEET_ORDER[SHEET_ORDER.indexOf(state) + 1]);
      return;
    }
    const nearest = SHEET_ORDER.reduce((best, candidate) =>
      Math.abs(heights[candidate] - current) < Math.abs(heights[best] - current) ? candidate : best);
    onStateChange(nearest);
  }

  return (
    <section
      className="pointer-events-auto absolute inset-x-0 z-[1100] flex flex-col rounded-t-2xl border border-b-0 border-hairline bg-panel shadow-[0_-6px_24px_rgb(0_0_0/18%)]"
      style={{ bottom: bottomOffset, height, transition: drag === null ? "height 220ms ease" : "none" }}
      aria-label={label}
    >
      {floating && <div className="pointer-events-none absolute right-3 bottom-full mb-3 flex flex-col items-end gap-2">{floating}</div>}
      <div
        className="shrink-0 cursor-grab touch-none select-none px-4 pt-2 pb-3 active:cursor-grabbing"
        role="button"
        tabIndex={0}
        aria-label={`${label}. ${state === "full" ? "Collapse" : "Expand"} details`}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            settle(heights[state], false);
          }
        }}
        onPointerDown={(event) => {
          dragStart.current = { y: event.clientY, height: heights[state], moved: false };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = dragStart.current;
          if (!start) return;
          const delta = start.y - event.clientY;
          if (Math.abs(delta) > 6) start.moved = true;
          if (start.moved) setDrag(Math.max(peekHeight - 24, Math.min(heights.full + 24, start.height + delta)));
        }}
        onPointerUp={(event) => {
          const start = dragStart.current;
          dragStart.current = null;
          if (!start) return;
          const current = start.height + (start.y - event.clientY);
          setDrag(null);
          settle(current, start.moved);
        }}
        onPointerCancel={() => {
          dragStart.current = null;
          setDrag(null);
        }}
      >
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-hairline" aria-hidden="true" />
        {header}
      </div>
      <div className={`min-h-0 flex-1 px-4 pb-4 ${state === "peek" && drag === null ? "overflow-hidden" : "overflow-y-auto overscroll-contain"}`}>
        {children}
      </div>
    </section>
  );
}

// --- floating action button ---

export function Fab({ label, active = false, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={`pointer-events-auto size-12 rounded-full border shadow-[var(--shadow-card)] flex items-center justify-center transition-colors ${
        active ? "bg-brand text-white border-brand" : "bg-panel text-ink border-hairline hover:bg-surface"
      }`}
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
