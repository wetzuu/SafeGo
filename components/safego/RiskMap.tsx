"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { riskGradient } from "@/lib/safego/risk-model";
import type { MapLayer, MapLayerKey, SafeGoLocation } from "@/lib/safego/types";

const MAP_LAYERS: MapLayer[] = [
  { key: "overall", label: "Overall risk" },
  { key: "Weather", label: "Weather" },
  { key: "Flood / roads", label: "Flood & roads" },
  { key: "Official advisories", label: "Advisories" },
  { key: "School status", label: "School status" },
  { key: "Community reports", label: "Community" },
];

function layerScore(location: SafeGoLocation, layer: MapLayerKey) {
  if (layer === "overall") return location.risk.percentage;
  return location.factors.find((factor) => factor.name === layer)?.score ?? 0;
}

function evidenceClass(location: SafeGoLocation) {
  const verified = location.reports.some((report) => report.status === "verified");
  const unverified = location.reports.some((report) => report.status !== "verified");
  if (verified && unverified) return "mixed-evidence";
  if (verified) return "verified-evidence";
  if (unverified) return "unverified-evidence";
  return "no-evidence";
}

interface RiskMapProps {
  locations: SafeGoLocation[];
  selectedLocation: SafeGoLocation;
  onSelectLocation: (location: SafeGoLocation) => void;
  onViewDashboard: () => void;
}

export function RiskMap({
  locations,
  selectedLocation,
  onSelectLocation,
  onViewDashboard,
}: RiskMapProps) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const [activeLayer, setActiveLayer] = useState<MapLayerKey>("overall");
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const activeLayerLabel =
    MAP_LAYERS.find((layer) => layer.key === activeLayer)?.label ?? "Overall risk";
  const selectedScore = layerScore(selectedLocation, activeLayer);
  const verifiedCount = selectedLocation.reports.filter(
    (report) => report.status === "verified",
  ).length;
  const unverifiedCount = selectedLocation.reports.length - verifiedCount;
  const bounds = useMemo(
    () => locations.map((location) => location.coordinates),
    [locations],
  );

  useEffect(() => {
    let cancelled = false;

    async function initializeMap() {
      if (!mapElementRef.current || mapRef.current) return;
      try {
        const L = await import("leaflet");
        if (cancelled || !mapElementRef.current) return;

        const map = L.map(mapElementRef.current, {
          zoomControl: true,
          minZoom: 10,
          maxZoom: 19,
        });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
        map.fitBounds(L.latLngBounds(bounds), { padding: [28, 28], maxZoom: 12 });
        mapRef.current = map;
        markerLayerRef.current = L.layerGroup().addTo(map);
        setMapReady(true);
        requestAnimationFrame(() => map.invalidateSize());
      } catch {
        if (!cancelled) setMapError(true);
      }
    }

    void initializeMap();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, [bounds]);

  useEffect(() => {
    if (!mapReady || !markerLayerRef.current) return;
    let cancelled = false;

    async function renderMarkers() {
      const L = await import("leaflet");
      if (cancelled || !markerLayerRef.current) return;
      markerLayerRef.current.clearLayers();

      locations.forEach((location) => {
        const score = layerScore(location, activeLayer);
        const selected = location.id === selectedLocation.id;
        const icon = L.divIcon({
          className: "safego-leaflet-icon",
          html: `<span class="map-marker leaflet-marker ${evidenceClass(location)}${selected ? " selected" : ""}" style="--marker-color:${riskGradient(score)}"><span class="map-marker-score">${score}</span></span>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
          tooltipAnchor: [0, -24],
        });
        const marker = L.marker(location.coordinates, {
          icon,
          keyboard: true,
          title: `${location.name}, ${score} out of 100`,
          alt: `${location.name}, ${score} out of 100`,
          riseOnHover: true,
        });

        marker.bindTooltip(
          `<strong>${location.name}</strong><br>${score}/100 · ${activeLayerLabel}`,
          { direction: "top", opacity: 0.96 },
        );
        marker.on("click", () => onSelectLocation(location));
        marker.addTo(markerLayerRef.current!);
      });
    }

    void renderMarkers();
    return () => {
      cancelled = true;
    };
  }, [activeLayer, activeLayerLabel, locations, mapReady, onSelectLocation, selectedLocation.id]);

  return (
    <section className="page" aria-labelledby="map-page-title">
      <div className="page-head">
        <div className="page-eyebrow">Risk map</div>
        <h1 className="page-title" id="map-page-title">Metro Manila travel-risk map</h1>
        <p className="page-sub">Compare the current mock risk signals across approximate locations.</p>
      </div>

      <div className="map-layer-wrap" aria-label="Map data layer">
        <div className="map-control-label">Display layer</div>
        <div className="map-layers">
          {MAP_LAYERS.map((layer) => (
            <button key={layer.key} type="button" className={`map-layer-btn${layer.key === activeLayer ? " active" : ""}`} aria-pressed={layer.key === activeLayer} onClick={() => setActiveLayer(layer.key)}>
              {layer.label}
            </button>
          ))}
        </div>
      </div>

      <div className="map-layout">
        <div className="map-card card">
          <div className="map-canvas" role="group" aria-label="Interactive map of SafeGo locations">
            <div className="live-map" ref={mapElementRef} />
            {mapError && <div className="map-load-error">The live map could not load. Check your internet connection and reload the page.</div>}
            <div className="map-approx-badge">Live OpenStreetMap · approximate SafeGo markers</div>
          </div>
          <div className="map-legend" aria-label="Risk color legend">
            <div className="map-legend-title">Score and risk level</div>
            <div className="map-gradient" />
            <div className="map-legend-labels"><span><strong>0</strong> Low</span><span><strong>30</strong> Moderate</span><span><strong>60</strong> High</span><span><strong>80–100</strong> Critical</span></div>
            <div className="map-evidence-legend"><span className="evidence-key verified"><span />Verified hazard</span><span className="evidence-key unverified"><span />Pending/unverified report</span></div>
          </div>
        </div>

        <aside className="map-detail card card-pad" aria-live="polite">
          <div className="map-detail-head">
            <div><div className="map-detail-kicker">Approximate location · {selectedLocation.city}</div><h3>{selectedLocation.name}</h3></div>
            <span className="map-score" style={{ "--score-color": riskGradient(selectedScore) } as React.CSSProperties}>{selectedScore}</span>
          </div>
          <div className="map-layer-reading">{activeLayerLabel}: <strong>{selectedScore}/100</strong></div>
          <div className="map-overall-row"><span>Overall travel risk</span><span className={`pill ${selectedLocation.risk.key}`}><span className="dot" />{selectedLocation.risk.percentage}/100 · {selectedLocation.risk.name}</span></div>
          <div className="map-factor-list">{selectedLocation.factors.map((factor) => <div key={factor.name}><span>{factor.name}</span><strong className="mono">{factor.score}</strong></div>)}</div>
          <div className="map-evidence"><span className="evidence-key verified"><span />{verifiedCount} verified</span><span className="evidence-key unverified"><span />{unverifiedCount} pending/unverified</span><span className="mono">Updated {selectedLocation.updated}</span></div>
          <div className="map-detail-section"><strong>Latest advisory</strong><p>{selectedLocation.advisories[0]?.title ?? "No advisory in the mock dataset."}</p></div>
          <div className="map-detail-section"><strong>Relevant hazard</strong><p>{selectedLocation.hazards[0]?.title ?? "No reported hazard in the mock dataset."}</p></div>
          <button className="submit-btn map-dashboard-btn" type="button" onClick={onViewDashboard}>View full dashboard</button>
        </aside>
      </div>
      <p className="map-disclaimer">Locations are approximate and the data is a static informational mock. SafeGo does not replace official government, school, weather, or emergency announcements.</p>
    </section>
  );
}
