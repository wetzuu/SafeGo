"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AccountProfile } from "@/lib/account/types";
import { loadAccountSession } from "./AccountPanel";
import { Brand } from "./Brand";
import { ThemeToggle, useSavedTheme } from "./ui";

type ReviewStatus = "unverified" | "verified" | "rejected";

interface ReportEntry {
  id: string;
  locationId: string;
  locationName: string;
  type: string;
  description: string;
  locationText: string;
  status: ReviewStatus | "pending";
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

const FILTERS: Array<{ key: ReviewStatus | "all"; label: string }> = [
  { key: "unverified", label: "Needs review" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const STATUS_STYLE: Record<ReviewStatus, { label: string; className: string }> = {
  unverified: { label: "Needs review", className: "bg-mod-soft text-mod" },
  verified: { label: "Verified", className: "bg-low-soft text-low" },
  rejected: { label: "Rejected", className: "bg-crit-soft text-crit" },
};

const statusOf = (report: ReportEntry): ReviewStatus => (report.status === "pending" ? "unverified" : report.status);

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(iso));

function ago(iso: string, now: number) {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} hr ago` : `${Math.round(hours / 24)} d ago`;
}

/** The moderation queue: every community report, with Verify and Reject. Admin accounts only. */
export function AdminReports() {
  useSavedTheme();
  const [account, setAccount] = useState<AccountProfile | null | undefined>(undefined);
  const [reports, setReports] = useState<ReportEntry[] | null>(null);
  const [filter, setFilter] = useState<ReviewStatus | "all">("unverified");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/reports", { credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(15_000) });
      const payload = await response.json().catch(() => ({})) as { data?: { reports: ReportEntry[] }; error?: { message?: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "The reports could not be loaded.");
      setReports(payload.data.reports);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The reports could not be loaded.");
    }
    setNow(Date.now());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadAccountSession().then((profile) => { if (!cancelled) setAccount(profile); });
    return () => { cancelled = true; };
  }, []);

  // New reports appear without a reload.
  useEffect(() => {
    if (!account?.admin) return;
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 30_000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [account, load]);

  async function review(report: ReportEntry, status: ReviewStatus) {
    setBusy(report.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/reports/${report.id}`, {
        method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      });
      const payload = await response.json().catch(() => ({})) as { data?: ReportEntry; error?: { message?: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "That change could not be saved.");
      const updated = payload.data;
      setReports((current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That change could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  const counts = useMemo(() => {
    const result: Record<ReviewStatus | "all", number> = { unverified: 0, verified: 0, rejected: 0, all: reports?.length ?? 0 };
    for (const report of reports ?? []) result[statusOf(report)] += 1;
    return result;
  }, [reports]);

  const shown = useMemo(() => {
    const text = query.trim().toLocaleLowerCase();
    return (reports ?? []).filter((report) =>
      (filter === "all" || statusOf(report) === filter)
      && (!text || [report.description, report.locationText, report.locationName, report.type].some((field) => field.toLocaleLowerCase().includes(text))));
  }, [filter, query, reports]);

  const header = (
    <header className="sticky top-0 z-10 border-b border-hairline bg-panel">
      <div className="mx-auto flex max-w-[960px] items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="brandmark !mb-0" aria-label="Back to SafeGo"><Brand compact /></Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/" className="inline-flex min-h-11 items-center rounded-box border border-hairline px-3 text-sm font-semibold text-ink hover:bg-surface">Back to the map</Link>
        </div>
      </div>
    </header>
  );

  if (account === undefined) {
    return <div className="min-h-dvh bg-surface">{header}<p className="mx-auto max-w-[960px] px-4 py-10 text-sm text-ink-soft" role="status">Checking your account…</p></div>;
  }
  if (!account?.admin) {
    return (
      <div className="min-h-dvh bg-surface">
        {header}
        <main className="mx-auto max-w-[960px] px-4 py-10">
          <h1 className="text-2xl font-bold text-ink">Admins only</h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft">
            {account
              ? `You are signed in as ${account.email}, which is not an admin account.`
              : "Sign in on the map page with an admin account, then come back here."}
            {" "}Admin accounts are the emails listed in the server’s SAFEGO_ADMIN_EMAILS setting.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-surface">
      {header}
      <main className="mx-auto max-w-[960px] px-4 py-6">
        <h1 className="text-2xl font-bold text-ink">Community reports</h1>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-soft">
          Verify what you can confirm and reject what is wrong, spam, or unsafe to show. Verified reports get a “Verified” mark for everyone; rejected ones are hidden from the public.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter reports">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={filter === item.key}
              className={`min-h-11 rounded-full px-4 text-sm font-semibold ${filter === item.key ? "bg-brand text-white" : "border border-hairline bg-panel text-ink hover:bg-surface"}`}
              onClick={() => setFilter(item.key)}
            >
              {item.label} ({counts[item.key]})
            </button>
          ))}
          <button type="button" className="ml-auto min-h-11 rounded-box border border-hairline bg-panel px-3 text-sm font-semibold text-ink hover:bg-surface" onClick={() => void load()}>Refresh</button>
        </div>
        <label className="mt-3 block text-xs font-bold text-ink" htmlFor="admin-report-search">Search reports</label>
        <input
          id="admin-report-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Words in the report, a street, or a SafeGo location"
          className="mt-1 min-h-11 w-full rounded-lg border border-hairline bg-panel px-3 text-sm text-ink outline-none focus:border-brand"
        />

        {error && <div className="account-message error mt-3" role="alert">{error}</div>}

        {reports === null && !error ? (
          <p className="mt-6 text-sm text-ink-soft" role="status">Loading reports…</p>
        ) : shown.length === 0 ? (
          <p className="mt-6 rounded-box border border-hairline bg-panel px-4 py-6 text-sm text-ink-soft">
            {reports?.length === 0 ? "No one has submitted a report yet." : filter === "unverified" && !query ? "Nothing is waiting for review." : "No reports match."}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {shown.map((report) => {
              const status = statusOf(report);
              const working = busy === report.id;
              return (
                <li key={report.id} className="rounded-box border border-hairline bg-panel p-4 shadow-[var(--shadow-card)]">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-surface px-2.5 py-1 font-bold text-ink">{report.type}</span>
                    <span className={`rounded-full px-2.5 py-1 font-bold ${STATUS_STYLE[status].className}`}>{STATUS_STYLE[status].label}</span>
                    <time className="ml-auto text-ink-soft" dateTime={report.submittedAt}>{when(report.submittedAt)} · {ago(report.submittedAt, now)}</time>
                  </div>
                  <p className="mt-2.5 text-base leading-snug text-ink">{report.description}</p>
                  <p className="mt-1.5 text-sm text-ink-soft">
                    <strong className="font-semibold text-ink">Where:</strong> {report.locationText} · near {report.locationName}
                  </p>
                  {report.reviewedAt && (
                    <p className="mt-1 text-xs text-ink-soft">{status === "verified" ? "Verified" : "Rejected"} by {report.reviewedBy ?? "an admin"} on {when(report.reviewedAt)}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {status !== "verified" && (
                      <button type="button" className="min-h-11 rounded-box bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60" disabled={working} onClick={() => void review(report, "verified")}>
                        Verify
                      </button>
                    )}
                    {status !== "rejected" && (
                      <button type="button" className="min-h-11 rounded-box border border-hairline px-4 text-sm font-semibold text-crit hover:bg-surface disabled:opacity-60" disabled={working} onClick={() => void review(report, "rejected")}>
                        Reject and hide
                      </button>
                    )}
                    {status !== "unverified" && (
                      <button type="button" className="min-h-11 rounded-box border border-hairline px-4 text-sm font-semibold text-ink hover:bg-surface disabled:opacity-60" disabled={working} onClick={() => void review(report, "unverified")}>
                        Undo
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
