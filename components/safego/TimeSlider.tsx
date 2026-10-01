"use client";

import { useEffect, useState } from "react";
import { HOUR_MS, timelineLabel } from "@/lib/safego/timeline";

const PLAY_STEP_MS = 700;

function dayTicks(start: number, end: number) {
  const ticks: Array<{ at: number; label: string }> = [];
  const format = new Intl.DateTimeFormat("en-PH", { weekday: "short", day: "numeric", timeZone: "Asia/Manila" });
  for (let at = start; at <= end; at += HOUR_MS) {
    const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Manila" }).format(new Date(at)));
    if (hour === 0) ticks.push({ at, label: format.format(new Date(at)) });
  }
  return ticks;
}

/**
 * Rewind the map hour by hour, like a weather-map timeline. `value` null means live (now).
 */
export function TimeSlider({
  start,
  end,
  value,
  onChange,
  status,
}: {
  start: number;
  end: number;
  value: number | null;
  onChange: (value: number | null) => void;
  /** "ready" once past data has loaded; otherwise the slider explains why it is disabled. */
  status: "ready" | "loading" | "unavailable";
}) {
  const [playing, setPlaying] = useState(false);

  // Playback advances one hour per step and returns to live at the end.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      const next = (value ?? end) + HOUR_MS;
      if (next >= end) {
        onChange(null);
        setPlaying(false);
      } else {
        onChange(next);
      }
    }, PLAY_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [playing, value, end, onChange]);

  const position = value ?? end;
  const ready = status === "ready";
  const span = Math.max(HOUR_MS, end - start);

  return (
    <div className="pointer-events-auto rounded-2xl border border-hairline bg-panel/95 backdrop-blur-md shadow-xl px-3 py-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!ready}
          className="size-9 shrink-0 rounded-full bg-brand text-white flex items-center justify-center disabled:bg-neutral-300"
          aria-label={playing ? "Pause" : "Play through the last four days"}
          onClick={() => {
            if (!playing && value === null) onChange(start);
            setPlaying((current) => !current);
          }}
        >
          {playing
            ? <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            : <svg viewBox="0 0 24 24" className="size-4 ml-0.5" fill="currentColor" aria-hidden="true"><path d="M7 5v14l12-7z" /></svg>}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-bold text-ink truncate">
              {value === null ? "Now (live)" : timelineLabel(value)}
            </span>
            <span className="text-[10px] text-ink-soft shrink-0">
              {status === "loading" ? "Loading the last 4 days…" : status === "unavailable" ? "Past data unavailable" : value === null ? "Drag to rewind up to 4 days" : "Rewound view"}
            </span>
          </div>
          <div className="relative mt-1">
            <input
              type="range"
              min={start}
              max={end}
              step={HOUR_MS}
              value={position}
              disabled={!ready}
              aria-label="Map time"
              aria-valuetext={value === null ? "Now, live" : timelineLabel(value)}
              className="w-full accent-brand disabled:opacity-40"
              onChange={(event) => {
                setPlaying(false);
                const next = Number(event.target.value);
                onChange(next >= end ? null : next);
              }}
            />
            <div className="relative h-3 text-[9px] text-ink-soft" aria-hidden="true">
              {dayTicks(start, end).map((tick) => (
                <span key={tick.at} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${((tick.at - start) / span) * 100}%` }}>
                  {tick.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${value === null ? "bg-low-soft text-low" : "bg-inverse text-white hover:opacity-90"}`}
          onClick={() => {
            setPlaying(false);
            onChange(null);
          }}
          aria-pressed={value === null}
        >
          {value === null ? "● Live" : "Back to live"}
        </button>
      </div>
    </div>
  );
}
