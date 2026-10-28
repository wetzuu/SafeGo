import { readFile } from "node:fs/promises";
import { connection } from "next/server";
import { SafeGoApp } from "@/components/safego/SafeGoApp";
import { LOCATION_CATALOG } from "@/lib/safego/location-catalog";
import type { ReplayInfo } from "@/lib/safego/replay";

/** The replay named by SAFEGO_REPLAY (the same pack the Java API serves), or null for live data. */
async function readReplay(): Promise<ReplayInfo | null> {
  const file = process.env.SAFEGO_REPLAY?.trim();
  if (!file) return null;
  const pack = JSON.parse(await readFile(file, "utf8")) as ReplayInfo;
  return { label: pack.label, at: pack.at, source: pack.source };
}

export default async function Home() {
  // Read the switches per request so a build made with reports on cannot keep showing them.
  await connection();
  const replay = await readReplay();
  const communityReportingEnabled = !replay
    && process.env.SAFEGO_COMMUNITY_REPORTS_ENABLED === "true"
    && process.env.SAFEGO_MODERATION_ENABLED === "true";
  return <SafeGoApp initialLocations={LOCATION_CATALOG} initialBackend="local" initialSources={[]} communityReportingEnabled={communityReportingEnabled} replay={replay} />;
}
