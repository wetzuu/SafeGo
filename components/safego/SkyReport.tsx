"use client";

import { SKY_STEPS, type SkyReport as SkyReportData } from "@/lib/safego/humanize-risk";
import { TactileCard, TONE_CLASS } from "./tactile";

/**
 * The top-of-app status: how the weather is, whether SafeGo is checking schools, and whether any
 * school has called off classes. The current step of the track is lit; it pulses only while
 * schools are being checked.
 */
export function SkyReport({ report, compact = false, strip = false }: { report: SkyReportData; compact?: boolean; strip?: boolean }) {
  if (strip) {
    // Phones: one line under the search bar, so the status is visible without opening anything.
    const step = report.step === null ? null : SKY_STEPS[report.step];
    return (
      <TactileCard as="section" aria-label="Sky report" className="pointer-events-auto flex items-center gap-2.5 px-3 py-2">
        <span
          aria-hidden="true"
          className={`grid size-8 shrink-0 place-items-center rounded-full border-2 border-outline text-base ${TONE_CLASS[report.tone]} ${report.busy ? "sky-pulse" : ""}`}
        >
          {step?.icon ?? "❔"}
        </span>
        <span className="min-w-0">
          <span className="block font-display text-sm font-semibold leading-tight text-ink" aria-live="polite">{report.headline}</span>
          <span className="block truncate text-[11px] text-ink-soft">{report.line}</span>
        </span>
      </TactileCard>
    );
  }
  return (
    <TactileCard as="section" aria-label="Sky report" className={compact ? "p-3" : "p-4"}>
      <p className={`font-display font-semibold leading-tight text-ink ${compact ? "text-base" : "text-xl"}`} aria-live="polite">
        {report.headline}
      </p>
      {!compact && <p className="mt-1.5 text-[13px] leading-snug text-ink-soft">{report.line}</p>}

      <ol className={`relative flex justify-between ${compact ? "mt-2.5" : "mt-4"}`} aria-label="Weather and school status">
        {/* The rail behind the steps. */}
        <span aria-hidden="true" className={`absolute inset-x-4 border-t-2 border-dashed border-hairline ${compact ? "top-3.5" : "top-[18px]"}`} />
        {SKY_STEPS.map((step, index) => {
          const reached = report.step !== null && index <= report.step;
          const current = report.step === index;
          return (
            <li key={step.label} className="relative flex w-1/4 flex-col items-center gap-1" aria-current={current ? "step" : undefined}>
              <span
                className={`grid place-items-center rounded-full border-2 ${compact ? "size-7 text-sm" : "size-9 text-base"} ${
                  current
                    ? `border-outline ${TONE_CLASS[report.tone]} shadow-[var(--shadow-tactile-sm)] ${report.busy ? "sky-pulse" : ""}`
                    : reached
                      ? "border-outline bg-panel"
                      : "border-hairline bg-surface opacity-50 grayscale"
                }`}
              >
                <span aria-hidden="true">{step.icon}</span>
              </span>
              <span className={`text-center text-[10.5px] leading-tight ${current ? "font-semibold text-ink" : "text-ink-soft"} ${compact && !current ? "sr-only" : ""}`}>
                {step.label}
                {!current && <span className="sr-only">{reached ? " (passed)" : " (not yet)"}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </TactileCard>
  );
}
