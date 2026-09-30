"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { riskGradient } from "@/lib/safego/risk-model";
import type { MapLayer, MapLayerKey, SafeGoLocation } from "@/lib/safego/types";
import type { TripAnalysis } from "@/lib/trips/types";
import { isPilotLocation, PILOT, UNKNOWN_ROUTE_COLOR } from "@/lib/trips/pilot";
import { TripDataNotice } from "./TripCoverage";

const MAP_LAYERS: MapLayer[] = [
  { key: "overall", label: "Overall risk" },
  { key: "Weather", label: "Weather" },
  { key: "Flood / roads", label: "Flood & roads" },
  { key: "Official advisories", label: "Announcements" },
  { key: "School status", label: "Nearby university" },
  { key: "Community reports", label: "Community" },
];

const APPROXIMATE_COVERAGE_RADIUS_METERS = PILOT.radiusMeters;

function makeTooltip(title: string, detail: string) {
  const wrapper = document.createElement("span");
  const heading = document.createElement("strong");
  const lineBreak = document.createElement("br");
  heading.textContent = title;
  wrapper.append(heading, lineBreak, document.createTextNode(detail));
  return wrapper;
}

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

export interface PreviewTripRoute {
  routeCoordinates: Array<[number, number]>;
  origin: { coordinates: [number, number]; label: string };
  destination: { coordinates: [number, number]; label: string };
  distanceKm?: number;
  durationMin?: number;
  roadNames?: string[];
}

export interface RiskMapProps {
  locations: SafeGoLocation[];
  selectedLocation?: SafeGoLocation | null;
  trip?: TripAnalysis | null;
  previewRoute?: PreviewTripRoute | null;
  leftFloatingPanel?: React.ReactNode;
  onSelectLocation?: (location: SafeGoLocation) => void;
  onViewDashboard?: () => void;
  onViewRiskDetails?: () => void;
  onViewAnnouncements?: () => void;
  compact?: boolean;
}

export function RiskMap({
  locations,
  selectedLocation,
  trip,
  previewRoute,
  leftFloatingPanel,
  onSelectLocation,
  onViewDashboard,
  onViewRiskDetails,
  onViewAnnouncements,
  compact = false,
}: RiskMapProps) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const [activeLayer, setActiveLayer] = useState<MapLayerKey>("overall");
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [tileStatus, setTileStatus] = useState<"loading" | "ready" | "degraded">("loading");
  const activeLayerLabel =
    MAP_LAYERS.find((layer) => layer.key === activeLayer)?.label ?? "Overall risk";
  const effectiveSelected = selectedLocation ?? locations[0];
  const selectedScore = effectiveSelected ? layerScore(effectiveSelected, activeLayer) : 0;
  const verifiedCount = effectiveSelected?.reports.filter(
    (report) => report.status === "verified",
  ).length ?? 0;
  const unverifiedCount = (effectiveSelected?.reports.length ?? 0) - verifiedCount;
  const advisories = trip ? trip.advisories : (effectiveSelected?.advisories ?? []);
  const bounds: Array<[number, number]> = useMemo(
    () => trip?.routeCoordinates.length
      ? trip.routeCoordinates
      : previewRoute?.routeCoordinates.length
        ? previewRoute.routeCoordinates
        : selectedLocation
          ? [selectedLocation.coordinates]
          : locations.length > 0
            ? locations.map((location) => location.coordinates)
            : [[14.5995, 120.9842], [14.6120, 121.0614]],
    [locations, trip, previewRoute, selectedLocation],
  );

  useEffect(() => {
    let cancelled = false;

    async function initializeMap() {
      if (!mapElementRef.current || mapRef.current) return;
      try {
        setMapReady(false);
        setMapError(false);
        setTileStatus("loading");
        const L = await import("leaflet");
        if (cancelled || !mapElementRef.current) return;

        const map = L.map(mapElementRef.current, {
          zoomControl: true,
          minZoom: 5,
          maxZoom: 19,
          scrollWheelZoom: true,
        });
        let tileFailed = false;
        const tileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        });
        tileLayer.on("tileerror", () => {
          tileFailed = true;
          if (!cancelled) setTileStatus("degraded");
        });
        tileLayer.on("load", () => {
          if (!cancelled && !tileFailed) setTileStatus("ready");
        });
        tileLayer.addTo(map);

        if (bounds.length === 1) {
          map.setView(bounds[0], 15);
        } else {
          map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 15 });
        }
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
  }, []);

  // Smoothly zoom/pan to route bounds whenever trip or previewRoute or selectedLocation changes
  useEffect(() => {
    if (!mapReady || !mapRef.current || bounds.length === 0) return;
    let cancelled = false;

    async function updateZoom() {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;
      if (bounds.length === 1) {
        mapRef.current.setView(bounds[0], 15, { animate: true });
      } else {
        mapRef.current.fitBounds(L.latLngBounds(bounds), {
          padding: [50, 50],
          maxZoom: 15,
          animate: true,
        });
      }
    }

    void updateZoom();
    return () => {
      cancelled = true;
    };
  }, [bounds, mapReady]);

  useEffect(() => {
    if (!mapReady || !markerLayerRef.current) return;
    let cancelled = false;

    async function renderMarkers() {
      const L = await import("leaflet");
      if (cancelled || !markerLayerRef.current) return;
      markerLayerRef.current.clearLayers();

      locations.forEach((location) => {
        const score = layerScore(location, activeLayer);
        const selected = location.id === effectiveSelected?.id;
        const color = riskGradient(score);
        const coverageArea = L.circle(location.coordinates, {
          radius: APPROXIMATE_COVERAGE_RADIUS_METERS,
          color,
          weight: selected ? 3 : 2,
          opacity: selected ? 0.95 : 0.72,
          dashArray: "7 5",
          fillColor: color,
          fillOpacity: selected ? 0.24 : 0.14,
        });
        coverageArea.bindTooltip(
          makeTooltip(
            location.name,
            `${score}/100. ${activeLayerLabel}. SafeGo has information near this point.`,
          ),
          { direction: "top", opacity: 0.96 },
        );
        if (onSelectLocation) coverageArea.on("click", () => onSelectLocation(location));
        coverageArea.addTo(markerLayerRef.current!);

        const icon = L.divIcon({
          className: "safego-leaflet-icon",
          html: `<span class="map-marker leaflet-marker ${evidenceClass(location)}${selected ? " selected" : ""}" style="--marker-color:${color}"><span class="map-marker-score">${score}</span></span>`,
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
          makeTooltip(location.name, `${score}/100. ${activeLayerLabel}.`),
          { direction: "top", opacity: 0.96 },
        );
        if (onSelectLocation) marker.on("click", () => onSelectLocation(location));
        marker.addTo(markerLayerRef.current!);
      });
    }

    void renderMarkers();
    return () => {
      cancelled = true;
    };
  }, [activeLayer, activeLayerLabel, locations, mapReady, onSelectLocation, effectiveSelected?.id]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    let cancelled = false;
    let routeLayer: LayerGroup | null = null;

    async function renderRoute() {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;
      routeLayer = L.layerGroup().addTo(mapRef.current);

      if (trip) {
        trip.segments.forEach((segment) => {
          L.polyline(segment.coordinates, {
            color: segment.riskScore === null ? UNKNOWN_ROUTE_COLOR : riskGradient(segment.riskScore),
            dashArray: segment.riskScore === null ? "8 6" : undefined,
            weight: 8,
            opacity: 0.9,
            lineCap: segment.riskScore === null ? "butt" : "round",
          })
            .bindTooltip(makeTooltip(segment.basisLocationName ?? "Insufficient information", segment.riskScore === null ? "Not enough information to score this section." : `${segment.riskScore}/100. Approximate route section.`))
            .addTo(routeLayer!);
        });
        ([
          { place: trip.origin, label: "A" },
          { place: trip.destination, label: "B" },
        ] as const).forEach(({ place, label }) => {
          L.circleMarker(place.coordinates, {
            radius: 10,
            color: "#ffffff",
            weight: 3,
            fillColor: "#1a1a1a",
            fillOpacity: 1,
          }).bindTooltip(makeTooltip(`${label}: ${place.label}`, "Route endpoint"), { direction: "top" }).addTo(routeLayer!);
        });
      } else if (previewRoute) {
        L.polyline(previewRoute.routeCoordinates, {
          color: "#2563eb",
          weight: 6,
          opacity: 0.9,
          lineCap: "round",
        })
          .bindTooltip(makeTooltip(
            "Planned Trip Route",
            `${previewRoute.origin.label} → ${previewRoute.destination.label}${previewRoute.distanceKm ? ` (${previewRoute.distanceKm} km)` : ""}`,
          ))
          .addTo(routeLayer!);

        ([
          { place: previewRoute.origin, label: "A", bg: "#166534" },
          { place: previewRoute.destination, label: "B", bg: "#b91c1c" },
        ] as const).forEach(({ place, label, bg }) => {
          L.circleMarker(place.coordinates, {
            radius: 10,
            color: "#ffffff",
            weight: 3,
            fillColor: bg,
            fillOpacity: 1,
          }).bindTooltip(makeTooltip(`${label}: ${place.label}`, "Route stop"), { direction: "top" }).addTo(routeLayer!);
        });
      }
    }

    void renderRoute();
    return () => {
      cancelled = true;
      if (routeLayer && mapRef.current) mapRef.current.removeLayer(routeLayer);
    };
  }, [mapReady, trip, previewRoute]);

  return (
    <div className="relative size-full overflow-hidden bg-[#e8e5dc]">
      {/* Fullscreen Interactive Leaflet Map */}
      <div className="live-map absolute inset-0 size-full z-0" ref={mapElementRef} />
      {mapError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 p-6 text-center text-sm text-ink-soft">
          The live map could not load. Check your internet connection and reload the page.
        </div>
      )}
      {!mapError && tileStatus === "loading" && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1001] bg-white/90 px-3 py-1.5 rounded-full shadow text-xs font-semibold text-ink-soft">
          Loading map tiles…
        </div>
      )}

      {/* Floating Display Layer Chips */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-md border border-hairline rounded-full shadow-lg px-2 py-1.5 flex items-center gap-1 max-w-[92vw] overflow-x-auto">
        {MAP_LAYERS.map((layer) => (
          <button
            key={layer.key}
            type="button"
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${
              layer.key === activeLayer
                ? "bg-brand text-white shadow-sm"
                : "text-ink hover:bg-neutral-100"
            }`}
            onClick={() => setActiveLayer(layer.key)}
          >
            {layer.label}
          </button>
        ))}
      </div>

      {/* Floating Left Panel (Directions / Planner) */}
      {leftFloatingPanel && (
        <div className="absolute top-4 left-4 z-[1000] w-[calc(100%-2rem)] sm:w-[380px] md:w-[410px] max-h-[calc(100vh-5rem)] overflow-y-auto">
          {leftFloatingPanel}
        </div>
      )}

      {/* Floating Right Box: Location / Route Risk Info */}
      {(trip || effectiveSelected) && (
        <aside
          className="absolute top-16 right-4 z-[1000] w-[calc(100%-2rem)] sm:w-[320px] md:w-[350px] max-h-[calc(100vh-6rem)] overflow-y-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-hairline p-4 transition-all"
          aria-live="polite"
        >
          {/* Header with Circular Score */}
          <div className="flex items-start justify-between gap-3 border-b border-hairline pb-3 mb-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft truncate">
                {trip ? `Route Risk • ${(trip.coverage.totalMeters / 1000).toFixed(1)} km` : `Approximate Location • ${effectiveSelected.city}`}
              </div>
              <h3 className="text-base font-bold text-ink truncate mt-0.5">
                {trip ? `${trip.origin.label.split(",")[0]} → ${trip.destination.label.split(",")[0]}` : effectiveSelected.name}
              </h3>
            </div>
            {(trip?.overallRiskScore !== null || effectiveSelected) && (
              <div
                className="size-11 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-sm"
                style={{ backgroundColor: riskGradient(activeLayer === "overall" ? (trip?.overallRiskScore ?? selectedScore) : selectedScore) }}
              >
                {activeLayer === "overall" ? (trip?.overallRiskScore ?? selectedScore) : selectedScore}
              </div>
            )}
          </div>

          {/* Reading and Pill */}
          <div className="text-xs text-ink-soft mb-2">
            {activeLayerLabel}: <strong className="text-ink">{activeLayer === "overall" ? (trip?.overallRiskScore ?? selectedScore) : selectedScore}/100</strong>
          </div>
          <div className="flex items-center justify-between bg-surface rounded-xl p-2.5 mb-3 border border-hairline">
            <span className="text-xs text-ink-soft font-semibold">{trip ? "Overall route risk" : "Overall travel risk"}</span>
            <span className={`pill ${trip ? trip.riskKey : effectiveSelected.risk.key} text-xs font-bold`}>
              <span className="dot" />
              {(activeLayer === "overall" ? (trip?.overallRiskScore ?? selectedScore) : selectedScore)}/100 • {(trip ? trip.riskName : effectiveSelected.risk.name).replace(" RISK", "")}
            </span>
          </div>

          {trip?.safetyRule && (
            <div className="bg-amber-50 text-amber-900 border border-amber-200 rounded-xl p-2 text-xs font-medium mb-3">
              {trip.safetyRule}
            </div>
          )}

          {/* Factors List */}
          <div className="space-y-1.5 mb-3">
            {effectiveSelected?.factors.map((factor) => (
              <div key={factor.name} className="flex items-center justify-between text-xs py-1 border-b border-hairline/60 last:border-b-0">
                <span className="text-ink-soft">{factor.name === "School status" ? "Nearby university status" : factor.name}</span>
                <strong className="font-mono text-ink">{factor.score}</strong>
              </div>
            ))}
          </div>

          {/* Evidence Count */}
          <div className="flex items-center justify-between text-[11px] text-ink-soft pt-1 border-t border-hairline mb-3">
            <span className="text-emerald-700 font-semibold">● {verifiedCount} verified</span>
            <span>{unverifiedCount} pending/unverified</span>
            <span className="font-mono">Updated {effectiveSelected?.updated ?? "Live"}</span>
          </div>

          {/* Emphasized Latest Announcement in Right Card */}
          {advisories[0] && (
            <div className="bg-gradient-to-r from-blue-50/90 to-indigo-50/70 rounded-xl p-3 mb-3 border border-brand/25 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-brand flex items-center gap-1">
                  <span>📢</span> Latest announcement
                </span>
                {onViewAnnouncements && (
                  <button
                    type="button"
                    className="text-[10px] font-bold text-brand hover:underline"
                    onClick={onViewAnnouncements}
                  >
                    View all ({advisories.length})
                  </button>
                )}
              </div>
              <p className="text-xs text-ink font-semibold leading-snug">
                {advisories[0].title}
              </p>
            </div>
          )}

          {onViewDashboard && (
            <button
              className="w-full py-2 bg-brand text-white text-xs font-semibold rounded-xl hover:bg-brand-hover transition-colors shadow-sm mb-2"
              type="button"
              onClick={onViewDashboard}
            >
              View condition details
            </button>
          )}

          {onViewRiskDetails && (
            <button
              className="w-full py-2 bg-surface text-ink text-xs font-semibold rounded-xl hover:bg-neutral-200 border border-hairline transition-colors shadow-sm"
              type="button"
              onClick={onViewRiskDetails}
            >
              Why this result
            </button>
          )}
        </aside>
      )}

      {/* Floating High-Visibility Announcement Alert Banner on Map */}
      {advisories[0] && (
        <aside
          className="absolute bottom-6 left-6 z-[1000] w-[calc(100%-3rem)] sm:w-[380px] md:w-[420px] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-brand/30 p-3.5 transition-all hover:border-brand"
          aria-label="Live advisory bulletin"
        >
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-xl bg-brand text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5 font-bold">
              📢
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand">
                  Official Advisory · {advisories[0].source ?? "Gov/School"}
                </span>
                <span className="text-[10px] text-ink-soft shrink-0 font-mono">
                  {advisories[0].time ?? "Latest"}
                </span>
              </div>
              <h4 className="text-xs font-bold text-ink leading-snug line-clamp-2">
                {advisories[0].title}
              </h4>
              {advisories[0].description && (
                <p className="text-[11px] text-ink-soft line-clamp-2 mt-1 leading-normal">
                  {advisories[0].description}
                </p>
              )}
              {onViewAnnouncements && (
                <button
                  type="button"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:underline"
                  onClick={onViewAnnouncements}
                >
                  <span>View full bulletin & all announcements ({advisories.length})</span>
                  <span>→</span>
                </button>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* Floating Bottom Right Legend */}
      <div className="absolute bottom-6 right-4 z-[1000] bg-white/90 backdrop-blur-md border border-hairline rounded-xl shadow-md p-2.5 text-[11px] hidden sm:block">
        <div className="font-bold text-ink mb-1">Score and risk level</div>
        <div className="map-gradient h-2 w-48 rounded mb-1" />
        <div className="flex justify-between text-[10px] text-ink-soft">
          <span>0 Low</span>
          <span>30 Mod</span>
          <span>60 High</span>
          <span>80+ Crit</span>
        </div>
      </div>
    </div>
  );
}
