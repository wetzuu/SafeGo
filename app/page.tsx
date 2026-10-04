import { SafeGoApp } from "@/components/safego/SafeGoApp";
import { LOCATION_CATALOG } from "@/lib/safego/location-catalog";

export default function Home() {
  const communityReportingEnabled =
    process.env.SAFEGO_COMMUNITY_REPORTS_ENABLED === "true"
    && process.env.SAFEGO_MODERATION_ENABLED === "true";
  return <SafeGoApp initialLocations={LOCATION_CATALOG} initialBackend="local" initialSources={[]} communityReportingEnabled={communityReportingEnabled} />;
}
