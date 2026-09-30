"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { riskGradient } from "@/lib/safego/risk-model";
import type { MapLayer, MapLayerKey, SafeGoLocation } from "@/lib/safego/types";
import type { TripAnalysis } from "@/lib/trips/types";
import { PILOT, UNKNOWN_ROUTE_COLOR } from "@/lib/trips/pilot";
import { TripDataNotice } from "./TripCoverage";
import { Icon } from "./Icon";
import { createRiskHeatLayer, type RiskHeatLayer } from "./risk-heat-layer";
import { displayFactorName, riskLevelLabel, shortPlaceName } from "./labels";

const MAP_LAYERS: MapLayer[] = [
  { key: "overall", label: "Overall risk" },
  { key: "Weather", label: "Weather" },
  { key: "Flood / roads", label: "Flood & roads" },
  { key: "Official advisories", label: "Announcements" },
  { key: "School status", label: "Nearby university" },
  { key: "Community reports", label: "Community" },
];

const APPROXIMATE_COVERAGE_RADIUS_METERS = PILOT.radiusMeters;

type FitOptions = { paddingTopLeft: [number, number]; paddingBottomRight: [number, number]; maxZoom: number };

// Keep fitted routes and markers inside the part of the map the floating panels leave uncovered.
function fitOptions(map: LeafletMap, card: HTMLElement | null): FitOptions {
  const { x: width, y: height } = map.getSize();
  const fallback: FitOptions = { paddingTopLeft: [40, 40], paddingBottomRight: [40, 40], maxZoom: 15 };
  if (!card) return fallback;

  if (getComputedStyle(card).position === "absolute") {
    // Large screens: the card floats over the right edge.
    const reserved = card.offsetWidth + 56;
    return width - reserved >= 240
      ? { paddingTopLeft: [60, 80], paddingBottomRight: [reserved, 60], maxZoom: 15 }
      : fallback;
  }

  // Small screens: panels stack above the card, leaving a band of map between them.
  const above = card.previousElementSibling as HTMLElement | null;
  const top = above ? above.offsetTop + above.offsetHeight + 16 : 40;
  const bottom = height - card.offsetTop + 16;
  return height - top - bottom >= 120
    ? { paddingTopLeft: [30, top], paddingBottomRight: [30, bottom], maxZoom: 15 }
    : fallback;
}

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
}: RiskMapProps) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const heatLayerRef = useRef<RiskHeatLayer | null>(null);
  const cardRef = useRef<HTMLElement>(null);
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

        map.fitBounds(L.latLngBounds(bounds), fitOptions(map, cardRef.current));
        mapRef.current = map;
        // Below the route lines and markers (overlayPane is 400, markerPane 600).
        const heatPane = map.createPane("riskHeat");
        heatPane.style.zIndex = "350";
        heatPane.style.pointerEvents = "none";
        heatLayerRef.current = createRiskHeatLayer(L, { radiusMeters: APPROXIMATE_COVERAGE_RADIUS_METERS, pane: "riskHeat" }).addTo(map);
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
      heatLayerRef.current = null;
    };
  }, []);

  // Smoothly zoom/pan to route bounds whenever trip or previewRoute or selectedLocation changes
  useEffect(() => {
    if (!mapReady || !mapRef.current || bounds.length === 0) return;
    let cancelled = false;

    async function updateZoom() {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;
      mapRef.current.fitBounds(L.latLngBounds(bounds), { ...fitOptions(mapRef.current, cardRef.current), animate: true });
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
      heatLayerRef.current?.setPoints(locations.map((location) => ({
        coordinates: location.coordinates,
        score: layerScore(location, activeLayer),
      })));

      locations.forEach((location) => {
        const score = layerScore(location, activeLayer);
        const selected = location.id === effectiveSelected?.id;
        const color = riskGradient(score);
        const icon = L.divIcon({
          className: "safego-leaflet-icon",
          html: `<span class="map-marker leaflet-marker ${evidenceClass(location)}${selected ? " selected" : ""}" style="--marker-color:${color}"><span class="map-marker-score">${score}</span></span>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          tooltipAnchor: [0, -20],
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
        // A white casing keeps the risk-coloured route readable on top of the heat shading.
        L.polyline(trip.routeCoordinates, { color: "#ffffff", weight: 13, opacity: 0.9, lineCap: "round", lineJoin: "round", interactive: false }).addTo(routeLayer!);
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
        L.polyline(previewRoute.routeCoordinates, { color: "#ffffff", weight: 10, opacity: 0.9, lineCap: "round", interactive: false }).addTo(routeLayer!);
        L.polyline(previewRoute.routeCoordinates, {
          color: "#2563eb",
          weight: 6,
          opacity: 0.9,
          lineCap: "round",
        })
          .bindTooltip(makeTooltip(
            "Route preview",
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

  const overallScore = trip ? trip.overallRiskScore : effectiveSelected?.risk.percentage ?? null;
  const overallKey = trip ? trip.riskKey : effectiveSelected?.risk.key;
  const overallName = trip ? trip.riskName : effectiveSelected?.risk.name ?? "";
  const headlineScore = activeLayer === "overall" ? overallScore : selectedScore;
  const latestAdvisory = advisories[0];
  const hasUnratedSections = Boolean(trip?.segments.some((segment) => segment.riskScore === null));

  return (
    <div className="relative size-full overflow-hidden bg-[#e8e5dc]">
      <div className="live-map absolute inset-0 size-full z-0" ref={mapElementRef} />
      {mapError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 p-6 text-center text-sm text-ink-soft">
          The live map could not load. Check your internet connection and reload the page.
        </div>
      )}

      {/* Floating controls. Below lg they stack in one column so they never overlap. */}
      <div className="pointer-events-none absolute inset-0 z-[1000] flex flex-col gap-2 p-3 sm:p-4 lg:block lg:p-0">
        {leftFloatingPanel && (
          <div className="pointer-events-auto shrink-0 w-full sm:w-[380px] max-h-[48vh] overflow-y-auto rounded-2xl">
            {leftFloatingPanel}
          </div>
        )}

        <div
          role="toolbar"
          aria-label="Map layer"
          className="pointer-events-auto self-start max-w-full shrink-0 overflow-x-auto bg-white/90 backdrop-blur-md border border-hairline rounded-full shadow-lg px-1.5 py-1.5 flex items-center gap-1 lg:absolute lg:top-4 lg:left-1/2 lg:-translate-x-1/2 lg:max-w-[calc(100%-2rem)]"
        >
          {MAP_LAYERS.map((layer) => (
            <button
              key={layer.key}
              type="button"
              aria-pressed={layer.key === activeLayer}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors whitespace-nowrap ${
                layer.key === activeLayer ? "bg-brand text-white shadow-sm" : "text-ink hover:bg-neutral-100"
              }`}
              onClick={() => setActiveLayer(layer.key)}
            >
              {layer.label}
            </button>
          ))}
        </div>

        {!mapError && tileStatus !== "ready" && (
          <div
            role="status"
            className={`pointer-events-auto self-center shrink-0 px-3 py-1.5 rounded-full shadow text-xs font-semibold lg:absolute lg:top-16 lg:left-1/2 lg:-translate-x-1/2 ${
              tileStatus === "degraded" ? "bg-mod-soft text-mod" : "bg-white/90 text-ink-soft"
            }`}
          >
            {tileStatus === "degraded" ? "Base map unavailable. Risk overlays remain visible." : "Loading map tiles…"}
          </div>
        )}

        {/* Location / route risk card */}
        {effectiveSelected && (
          <aside
            className="pointer-events-auto mt-auto w-full sm:w-[350px] sm:self-end max-h-[40vh] overflow-y-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-hairline p-4 lg:absolute lg:top-16 lg:right-4 lg:mt-0 lg:max-h-[calc(100%-6rem)]"
            ref={cardRef}
            aria-live="polite"
            aria-label={trip ? "Route risk" : "Location risk"}
          >
            <div className="flex items-start justify-between gap-3 border-b border-hairline pb-3 mb-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft truncate">
                  {trip ? `Route · ${(trip.coverage.totalMeters / 1000).toFixed(1)} km` : `Approximate area · ${effectiveSelected.city}`}
                </div>
                <h3 className="text-base font-bold text-ink truncate mt-0.5">
                  {trip ? `${shortPlaceName(trip.origin.label)} → ${shortPlaceName(trip.destination.label)}` : effectiveSelected.name}
                </h3>
                {activeLayer !== "overall" && (
                  <div className="text-xs text-ink-soft mt-0.5">
                    {activeLayerLabel} score{trip ? ` at ${shortPlaceName(effectiveSelected.name)}` : ""}
                  </div>
                )}
              </div>
              <div
                className="size-11 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-sm"
                style={{ backgroundColor: headlineScore === null ? UNKNOWN_ROUTE_COLOR : riskGradient(headlineScore) }}
                title={`${activeLayerLabel}: ${headlineScore ?? "not rated"}`}
              >
                {headlineScore ?? "–"}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 bg-surface rounded-xl p-2.5 mb-3 border border-hairline">
              <span className="text-xs text-ink-soft font-semibold">{trip ? "Overall route risk" : "Overall travel risk"}</span>
              <span className={`pill ${overallKey} text-xs font-bold`}>
                <span className="dot" />
                {overallScore !== null ? `${overallScore}/100 · ` : ""}{riskLevelLabel(overallName)}
              </span>
            </div>

            {trip && <TripDataNotice trip={trip} />}
            {trip?.safetyRule && (
              <div className="bg-mod-soft text-mod border border-mod/40 rounded-xl p-2 text-xs font-medium mb-3">
                {trip.safetyRule}
              </div>
            )}

            <div className="hidden sm:block mb-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-ink-soft mb-1">
                {trip ? `Conditions near ${shortPlaceName(effectiveSelected.name)}` : "What SafeGo considered"}
              </div>
              {effectiveSelected.factors.map((factor) => (
                <div key={factor.name} className="flex items-center justify-between text-xs py-1 border-b border-hairline/60 last:border-b-0">
                  <span className="text-ink-soft">{displayFactorName(factor.name)}</span>
                  <strong className="font-mono text-ink">{factor.score}</strong>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 text-[11px] text-ink-soft pt-2 border-t border-hairline mb-3">
              <span>
                <span className="text-low font-semibold">{verifiedCount} verified</span> · {unverifiedCount} unconfirmed reports
              </span>
              <span className="font-mono shrink-0">Updated {effectiveSelected.updated}</span>
            </div>

            {/* On large screens the latest announcement has its own banner. */}
            {latestAdvisory && (
              <div className="lg:hidden bg-brand-soft/60 rounded-xl p-3 mb-3 border border-brand/25">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-brand">
                    Latest announcement{latestAdvisory.isMock ? " · Demo" : ""}
                  </span>
                  {onViewAnnouncements && (
                    <button type="button" className="text-[11px] font-bold text-brand hover:underline" onClick={onViewAnnouncements}>
                      View all ({advisories.length})
                    </button>
                  )}
                </div>
                <p className="text-xs text-ink font-semibold leading-snug">{latestAdvisory.title}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {onViewRiskDetails && (
                <button
                  className="py-2 bg-surface text-ink text-xs font-semibold rounded-xl hover:bg-neutral-200 border border-hairline transition-colors"
                  type="button"
                  onClick={onViewRiskDetails}
                >
                  Why this result
                </button>
              )}
              {onViewDashboard && (
                <button
                  className={`py-2 bg-brand text-white text-xs font-semibold rounded-xl hover:bg-brand-hover transition-colors shadow-sm${onViewRiskDetails ? "" : " col-span-2"}`}
                  type="button"
                  onClick={onViewDashboard}
                >
                  View conditions
                </button>
              )}
            </div>
          </aside>
        )}
      </div>

      {latestAdvisory && (
        <aside
          className="hidden lg:block absolute bottom-6 left-6 z-[1000] w-[420px] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-brand/30 p-3.5"
          aria-label="Latest announcement"
        >
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-xl bg-brand text-white flex items-center justify-center shrink-0 mt-0.5 [&_svg]:size-5">
              <Icon name="alert" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand truncate">
                  {latestAdvisory.label}{latestAdvisory.isMock ? " · Demo" : ""}
                </span>
                <span className="text-[10px] text-ink-soft shrink-0 font-mono">
                  {latestAdvisory.date ? `${latestAdvisory.date} · ` : ""}{latestAdvisory.time}
                </span>
              </div>
              <h4 className="text-xs font-bold text-ink leading-snug line-clamp-2">{latestAdvisory.title}</h4>
              {latestAdvisory.description && (
                <p className="text-[11px] text-ink-soft line-clamp-2 mt-1 leading-normal">{latestAdvisory.description}</p>
              )}
              {onViewAnnouncements && (
                <button type="button" className="mt-2 text-[11px] font-bold text-brand hover:underline" onClick={onViewAnnouncements}>
                  All announcements ({advisories.length}) →
                </button>
              )}
            </div>
          </div>
        </aside>
      )}

      <div className="hidden lg:block absolute bottom-6 right-4 z-[1000] bg-white/90 backdrop-blur-md border border-hairline rounded-xl shadow-md p-2.5 text-[11px]">
        <div className="font-bold text-ink mb-1">Score and risk level</div>
        <div className="map-gradient h-2 w-56 rounded mb-1" />
        <div className="flex justify-between text-[10px] text-ink-soft">
          <span>0 Low</span>
          <span>30 Moderate</span>
          <span>60 High</span>
          <span>80+ Critical</span>
        </div>
        <p className="mt-1.5 w-56 text-[10px] leading-snug text-ink-soft">
          Shading blends nearby scores and fades where SafeGo has no data. Unshaded areas are not rated safe.
        </p>
        {hasUnratedSections && (
          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-ink-soft">
            <span className="w-6 border-t-[3px] border-dashed" style={{ borderColor: UNKNOWN_ROUTE_COLOR }} />
            Not enough data (not rated safe)
          </div>
        )}
      </div>
    </div>
  );
}
