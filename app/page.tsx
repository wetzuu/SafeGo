import { connection } from "next/server";
import { SafeGoApp } from "@/components/safego/SafeGoApp";
import { LOCATION_CATALOG } from "@/lib/safego/location-catalog";

export default async function Home() {
  // Read the switches per request so a build made with reports on cannot keep showing them.
  await connection();
  const communityReportingEnabled =
    process.env.SAFEGO_COMMUNITY_REPORTS_ENABLED === "true"
    && process.env.SAFEGO_MODERATION_ENABLED === "true";
  return <SafeGoApp initialLocations={LOCATION_CATALOG} initialBackend="local" initialSources={[]} communityReportingEnabled={communityReportingEnabled} />;
}
