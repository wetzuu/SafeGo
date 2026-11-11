"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import type { Tone, WeatherLevel } from "@/lib/safego/humanize-risk";

/** Background / text pairs for each tone (tokens in globals.css, readable in both themes). */
export const TONE_CLASS: Record<Tone, string> = {
  calm: "bg-tone-calm text-tone-calm-ink",
  best: "bg-tone-best text-tone-best-ink",
  rain: "bg-tone-rain text-tone-rain-ink",
  wet: "bg-tone-wet text-tone-wet-ink",
  danger: "bg-tone-danger text-tone-danger-ink",
  school: "bg-tone-school text-tone-school-ink",
  unknown: "bg-tone-unknown text-tone-unknown-ink",
};

const CARD = "rounded-[var(--radius-tactile)] border-2 border-outline";

/**
 * A chunky outlined card with a hard offset shadow. As a button it presses down when clicked.
 * Use it for things people press and the few things that must stand out, not for every box.
 */
export function TactileCard({
  as = "div",
  tone,
  selected = false,
  className = "",
  children,
  ...rest
}: {
  as?: "div" | "button" | "article" | "section";
  tone?: Tone;
  selected?: boolean;
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLElement> & Pick<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "disabled">) {
  const Tag = as;
  const surface = tone ? TONE_CLASS[tone] : "bg-panel text-ink";
  const shadow = selected ? "shadow-[var(--shadow-tactile)]" : "shadow-[var(--shadow-tactile-sm)]";
  const press = as === "button" ? "tactile-press cursor-pointer text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand" : "";
  return (
    <Tag className={`${CARD} ${surface} ${shadow} ${press} ${className}`} {...(as === "button" ? { type: "button" } : {})} {...rest}>
      {children}
    </Tag>
  );
}

/** A rounded badge with an icon: route trade-offs, weather levels, school status. */
export function StoryBadge({ tone, icon, children, size = "md" }: { tone: Tone; icon?: string; children: ReactNode; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border-2 border-outline font-display font-semibold leading-none ${TONE_CLASS[tone]} ${
        size === "sm" ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-sm"
      }`}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}

/** A small icon + text pill for quick facts (time, weather, road). */
export function FactPill({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-surface px-2 py-1 text-xs font-semibold text-ink">
      <span aria-hidden="true">{icon}</span>
      <span className="truncate">{children}</span>
    </span>
  );
}

const METER_STEPS = [
  { icon: "☀️", name: "Calm" },
  { icon: "🌦️", name: "Light" },
  { icon: "🌧️", name: "Heavy" },
  { icon: "⛈️", name: "Severe" },
] as const;

/**
 * Weather intensity as four steps (calm, light, heavy, severe). It shows how rough the weather is,
 * not how deep any street is flooded: SafeGo does not measure flooding.
 */
export function VisualMeter({ level, compact = false }: { level: WeatherLevel; compact?: boolean }) {
  return (
    <div role="img" aria-label={`Weather: ${level.label}`} className="flex items-center gap-2">
      <div className="flex gap-1" aria-hidden="true">
        {METER_STEPS.map((step, index) => {
          const on = level.step !== null && index <= level.step;
          const current = level.step === index;
          return (
            <span
              key={step.name}
              title={step.name}
              className={`grid place-items-center rounded-lg border-2 ${compact ? "size-6 text-xs" : "size-8 text-sm"} ${
                on ? `border-outline ${TONE_CLASS[level.tone]}` : "border-hairline bg-surface opacity-60 grayscale"
              } ${current ? "scale-110" : ""}`}
            >
              {step.icon}
            </span>
          );
        })}
      </div>
      {!compact && <span className="font-display text-sm font-semibold text-ink">{level.label}</span>}
    </div>
  );
}
