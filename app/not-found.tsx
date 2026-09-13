import Link from "next/link";
import { Brand } from "@/components/safego/Brand";

export default function NotFound() {
  return (
    <main className="system-state">
      <div className="system-state-card">
        <Brand />
        <p className="system-state-kicker">Page unavailable</p>
        <h1>This SafeGo page is not available.</h1>
        <p>The validation workbench is development-only, and the requested page may not exist in this build.</p>
        <div className="system-state-actions">
          <Link href="/">Return to trip planner</Link>
        </div>
      </div>
    </main>
  );
}
