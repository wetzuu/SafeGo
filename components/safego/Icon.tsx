import type { IconName } from "@/lib/safego/types";

export function Icon({ name }: { name: IconName | "overview" | "risk" | "map" }) {
  const common = { viewBox: "0 0 24 24", fill: "none", "aria-hidden": true };

  if (name === "overview") return <svg {...common}><rect x="3.5" y="3.5" width="7" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="13.5" y="3.5" width="7" height="4.5" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="13.5" y="10.5" width="7" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/></svg>;
  if (name === "risk") return <svg {...common}><path d="M4 20V10M12 20V4M20 20v-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
  if (name === "map") return <svg {...common}><path d="m3.5 6.5 5-2.5 7 2.5 5-2.5v13.5l-5 2.5-7-2.5-5 2.5V6.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M8.5 4v13.5M15.5 6.5V20" stroke="currentColor" strokeWidth="1.6"/></svg>;
  if (name === "weather") return <svg {...common}><path d="M7 16a4.5 4.5 0 0 1 0-9 5.5 5.5 0 0 1 10.6 1.7A3.8 3.8 0 0 1 17 16H7Z" stroke="currentColor" strokeWidth="1.6"/><path d="M8 19v1M12 19v1.6M16 19v1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;
  if (name === "school") return <svg {...common}><path d="M4 10.5 12 5l8 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 10v8h12v-8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>;
  if (name === "flood") return <svg {...common}><path d="M3 18c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0M3 13c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;
  if (name === "reports") return <svg {...common}><path d="M12 21s-7-5.1-7-10.7A7 7 0 0 1 12 3a7 7 0 0 1 7 7.3C19 15.9 12 21 12 21Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>;
  return <svg {...common}><path d="M12 3 2 20h20L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
}
