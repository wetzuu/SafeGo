"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { replayScenario, VALIDATION_SCENARIOS } from "@/lib/trips/validation-scenarios";
import { LOCATIONS } from "@/lib/safego/locations";
import type { SafeGoLocation, ScreenKey } from "@/lib/safego/types";
import { TripOverview } from "./TripOverview";
import { RiskMap } from "./RiskMap";
import { TripCoverage } from "./TripCoverage";

export function ValidationWorkbench() {
  const [scenarioId, setScenarioId] = useState("calm");
  const [screen, setScreen] = useState<ScreenKey>("overview");
  const [selected, setSelected] = useState<SafeGoLocation | null>(null);
  const scenario = VALIDATION_SCENARIOS.find((item) => item.id === scenarioId)!;
  const trip = useMemo(() => replayScenario(scenario), [scenario]);
  return <main className="validation-workbench">
    <div className="pilot-notice"><strong>SIMULATION · Product review only</strong><p>These are curated synthetic inputs, not historical evidence or current road conditions. No provider feeds are called. Map tiles need a connection.</p><Link href="/">Return to trip planner</Link></div>
    <div className="card card-pad validation-controls"><label htmlFor="scenario">Review scenario</label><select id="scenario" value={scenarioId} onChange={(event) => { setScenarioId(event.target.value); setScreen("overview"); setSelected(null); }}>{VALIDATION_SCENARIOS.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><p>{scenario.purpose}</p>
      <button className="view-all" type="button" onClick={() => setScreen("overview")}>Overview</button>{" · "}<button className="view-all" type="button" onClick={() => setScreen("map")}>Map</button>
    </div>
    {screen === "overview" ? <TripOverview trip={trip} navigate={setScreen} /> : screen === "map" ? <RiskMap key={scenarioId} locations={trip.corridorLocations} selectedLocation={selected ?? trip.corridorLocations[0] ?? LOCATIONS[0]} trip={trip} onSelectLocation={setSelected} onViewDashboard={() => setScreen("overview")} /> : <TripCoverage trip={trip} />}
  </main>;
}
