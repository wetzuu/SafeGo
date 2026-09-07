import { SafeGoApp } from "@/components/safego/SafeGoApp";
import { LOCATIONS } from "@/lib/safego/locations";

export default function Home() {
  const communityReportingEnabled =
    process.env.SAFEGO_COMMUNITY_REPORTS_ENABLED === "true"
    && process.env.SAFEGO_MODERATION_ENABLED === "true";
  return <SafeGoApp initialLocations={LOCATIONS} initialBackend="mock" initialSources={[{ key: "prototype-mock", name: "SafeGo prototype dataset", kind: "mock", status: "mock", lastSuccessAt: null, lastFailureAt: null, errorMessage: null }]} communityReportingEnabled={communityReportingEnabled} />;
}
