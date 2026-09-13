"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Brand } from "@/components/safego/Brand";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("SafeGo page error", error);
  }, [error]);

  return (
    <main className="system-state">
      <div className="system-state-card">
        <Brand />
        <p className="system-state-kicker">Temporary problem</p>
        <h1>SafeGo could not finish loading this screen.</h1>
        <p>Try the screen again, or return to the planner and start a fresh check. Continue to rely on official announcements while SafeGo is unavailable.</p>
        <div className="system-state-actions">
          <button type="button" onClick={() => retry()}>Try again</button>
          <Link href="/">Return to planner</Link>
        </div>
      </div>
    </main>
  );
}
