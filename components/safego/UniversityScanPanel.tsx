"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon";

interface FeedReport {
  id: string;
  name: string;
  url: string;
  kind: "university" | "government" | "news";
  ok: boolean;
  items: number;
}

interface ScanResult {
  state: "scanned" | "scanning" | "standby" | "disabled";
  reason: string | null;
  scannedAt: string | null;
  feeds: FeedReport[];
  matches: Array<{ campusId: string }>;
}

const KIND_LABEL: Record<FeedReport["kind"], string> = {
  university: "University website",
  government: "Government",
  news: "News",
};

async function loadScan(force: boolean): Promise<ScanResult> {
  const response = await fetch(`/api/alerts/universities${force ? "?force=true" : ""}`, { cache: "no-store", signal: AbortSignal.timeout(40_000) });
  if (!response.ok) throw new Error(`Scan returned ${response.status}`);
  return ((await response.json()) as { data: ScanResult }).data;
}

/**
 * The class-suspension scan: when it last ran, what it checked, and a way to run it now. Also holds
 * the switch for the sample announcement, so people can see what a real one will look like.
 */
export function UniversityScanPanel({
  sampleShown,
  onToggleSample,
  onScanned,
}: {
  sampleShown: boolean;
  onToggleSample: () => void;
  /** Called after a scan so the page can reload its announcements. */
  onScanned: () => void;
}) {
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "scanning" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    loadScan(false).then(
      (result) => { if (!cancelled) { setScan(result); setStatus("ready"); } },
      () => { if (!cancelled) setStatus("error"); },
    );
    return () => { cancelled = true; };
  }, []);

  const scanNow = useCallback(async () => {
    setStatus("scanning");
    try {
      setScan(await loadScan(true));
      setStatus("ready");
      onScanned();
    } catch {
      setStatus("error");
    }
  }, [onScanned]);

  const reachable = scan?.feeds.filter((feed) => feed.ok).length ?? 0;
  const scannedAt = scan?.scannedAt
    ? new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(scan.scannedAt))
    : null;
  const summary = status === "loading" ? "Checking the scan status…"
    : status === "scanning" ? "Scanning the sources now…"
    : status === "error" || !scan ? "The suspension scan can’t be reached right now. Try again in a moment."
    : scan.state === "disabled" ? "The suspension scan is turned off on this server."
    : scan.state === "scanning" ? "Rain or a high risk set off a scan. It is running now; check back in a minute."
    : scan.state === "standby" ? "On standby. SafeGo scans these sources by itself when there is rain, a PAGASA alert, or a high risk rating."
    : `Last scan at ${scannedAt}: ${reachable} of ${scan.feeds.length} sources reached, ${
        scan.matches.length ? `${scan.matches.length} campus notice${scan.matches.length === 1 ? "" : "s"} found` : "no suspension notice found"}.`;

  return (
    <section className="card card-pad mt-4" aria-label="Class suspension scan">
      <h3 className="flex items-center gap-2 font-bold text-ink"><span className="shrink-0 [&_svg]:size-5"><Icon name="school" /></span>Class suspension scan</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink" role="status">{summary}</p>
      {scan?.state === "scanned" && scan.reason && <p className="mt-0.5 text-xs text-ink-soft">Why it ran: {scan.reason}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 rounded-box bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
          onClick={() => void scanNow()}
          disabled={status === "loading" || status === "scanning" || scan?.state === "disabled"}
        >
          {status === "scanning" ? "Scanning…" : "Scan now"}
        </button>
        <button
          type="button"
          className="min-h-11 rounded-box border border-hairline px-4 text-sm font-semibold text-ink hover:bg-surface"
          aria-pressed={sampleShown}
          onClick={onToggleSample}
        >
          {sampleShown ? "Hide the sample announcement" : "Show a sample announcement"}
        </button>
      </div>

      {scan && scan.feeds.length > 0 && (
        <details className="mt-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-brand-ink marker:content-none">
            What gets scanned ({scan.feeds.length} sources)
          </summary>
          <div className="divide-y divide-hairline border-y border-hairline">
            {scan.feeds.map((feed) => (
              <a key={feed.id} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm hover:text-brand-ink" href={feed.url} target="_blank" rel="noreferrer">
                <span className="min-w-0">
                  <strong className="block truncate">{feed.name}</strong>
                  <span className="block text-xs text-ink-soft">{KIND_LABEL[feed.kind]}</span>
                </span>
                {scan.state === "scanned" && (
                  <span className={`shrink-0 text-xs font-semibold ${feed.ok ? "text-low" : "text-crit"}`}>{feed.ok ? "Reached" : "Not reached"}</span>
                )}
              </a>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-soft">
            Universities usually post suspensions on Facebook first, and Facebook can’t be read automatically. SafeGo scans their websites, the Official Gazette, and news feeds instead. A notice found only in the news is shown as “reported” until the school confirms it.
          </p>
        </details>
      )}
    </section>
  );
}
