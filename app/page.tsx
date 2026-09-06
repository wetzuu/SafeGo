import { SafeGoApp } from "@/components/safego/SafeGoApp";
import { LOCATIONS } from "@/lib/safego/locations";

export default function Home() {
  return <SafeGoApp initialLocations={LOCATIONS} initialBackend="mock" initialSources={[{ key: "prototype-mock", name: "SafeGo prototype dataset", kind: "mock", status: "mock", lastSuccessAt: null, lastFailureAt: null, errorMessage: null }]} />;
}
