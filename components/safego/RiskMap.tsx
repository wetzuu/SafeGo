"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSON as GeoJSONLayer, GeoJSONOptions, LayerGroup, Map as LeafletMap, Path, Renderer } from "leaflet";
import { riskGradient } from "@/lib/safego/risk-model";
import { distanceToArea, nearestPoint, scoreArea, scoreClass, SCORE_CLASS_COUNT, type AreaCollection } from "@/lib/safego/area-scoring";
import { fetchAreaWeather, weatherGroupKey, weatherSamplePoints, type AreaWeather } from "@/lib/safego/area-weather";
import { analyzeArea } from "@/lib/safego/area-analysis";
import type { MapLayer, MapLayerKey, SafeGoLocation } from "@/lib/safego/types";
import type { TripAnalysis } from "@/lib/trips/types";
import { PILOT, UNKNOWN_ROUTE_COLOR } from "@/lib/trips/pilot";
import { TripDataNotice } from "./TripCoverage";
import { AreaDetails, type AreaInfo } from "./AreaDetails";
import { Icon } from "./Icon";
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
const UNRATED_AREA_COLOR = "#94a3b8";
const AREA_BORDER_COLOR = "#334155";
const ESTIMATE_FILL_OPACITY = 0.3;

// Flat colours per 10-point class, taken from the middle of each class on the shared risk gradient.
function classColor(riskClass: number) {
  return riskGradient(riskClass * 10 + 5);
}

let areasRequest: Promise<AreaCollection | null> | null = null;

function loadAreas() {
  areasRequest ??= fetch("/data/ncr-areas.json")
    .then((response) => (response.ok ? (response.json() as Promise<AreaCollection>) : null))
    .catch(() => null)
    .then((collection) => {
      if (!collection) areasRequest = null;
      return collection;
    });
  return areasRequest;
}

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
  /** Fetch live weather for every area; off while SafeGo shows demo conditions. */
  liveWeather?: boolean;
  /** SafeGo's location factors come from built-in demo data rather than live feeds. */
  locationDataIsDemo?: boolean;
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
  liveWeather = false,
  locationDataIsDemo = false,
}: RiskMapProps) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const areaRendererRef = useRef<Renderer | null>(null);
  const [areas, setAreas] = useState<AreaCollection | null>(null);
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
  const [areaWeather, setAreaWeather] = useState<Map<string, AreaWeather> | null>(null);
  const [weatherFailed, setWeatherFailed] = useState(false);
  // An area selection belongs to the trip and location it was made in; picking something else clears it.
  const [areaSelection, setAreaSelection] = useState<{ index: number; context: string } | null>(null);
  const selectionContext = `${trip?.generatedAt ?? "area"}:${effectiveSelected?.id ?? ""}`;
  const selectedAreaIndex = areaSelection?.context === selectionContext ? areaSelection.index : null;
  const liveAreaWeather = liveWeather ? areaWeather : null;
  const weatherStatus = !liveWeather ? "off" : liveAreaWeather ? "live" : weatherFailed ? "unavailable" : "loading";
  const weatherPoints = useMemo(() => (areas ? weatherSamplePoints(areas) : []), [areas]);

  const areaInfos: AreaInfo[] = useMemo(() => {
    if (!areas) return [];
    const points = locations.map((location) => ({ id: location.id, coordinates: location.coordinates, score: layerScore(location, activeLayer) }));
    const overallPoints = locations.map((location) => ({ id: location.id, coordinates: location.coordinates, score: location.risk.percentage }));
    const byId = new Map(locations.map((location) => [location.id, location]));
    const weatherLabels = new Map(weatherPoints.map((point) => [point.key, point.label]));
    return areas.features.map(({ geometry, properties }) => {
      const measured = scoreArea(geometry, points, APPROXIMATE_COVERAGE_RADIUS_METERS);
      const measuredSource = measured ? byId.get(measured.sourceId) ?? null : null;
      const key = weatherGroupKey(properties);
      const weather = liveAreaWeather?.get(key) ?? null;
      const nearest = nearestPoint(geometry, locations);
      const overallMeasured = activeLayer === "overall" ? measured : scoreArea(geometry, overallPoints, APPROXIMATE_COVERAGE_RADIUS_METERS);
      const analysis = analyzeArea(overallMeasured ? byId.get(overallMeasured.sourceId) ?? null : null, weather);
      // Weather is the one factor SafeGo can read everywhere. The overall layer shows weather-only
      // estimates for uncovered areas; the other layers only rate covered areas.
      const displayScore = activeLayer === "Weather" && weather
        ? Math.max(measured?.score ?? 0, weather.score)
        : activeLayer === "overall"
          ? analysis.score
          : measured?.score ?? null;
      return {
        properties,
        measured,
        measuredSource,
        measuredDistanceMeters: analysis.source ? distanceToArea(geometry, analysis.source.coordinates) : null,
        weather,
        weatherLabel: weatherLabels.get(key) ?? properties.city,
        displayScore,
        estimated: activeLayer === "overall" && analysis.kind === "weather-estimate",
        analysis,
        nearest: nearest ? { location: nearest.point, distanceMeters: nearest.distanceMeters } : null,
      };
    });
  }, [activeLayer, areas, liveAreaWeather, locations, weatherPoints]);
  const selectedAreaInfo = selectedAreaIndex === null ? null : areaInfos[selectedAreaIndex] ?? null;
  const ratedAreaCount = areaInfos.filter((info) => info.displayScore !== null && !info.estimated).length;
  const estimatedAreaCount = areaInfos.filter((info) => info.estimated).length;

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
        // Area shading sits below the route lines and markers (overlayPane is 400, markerPane 600).
        map.createPane("riskAreas").style.zIndex = "350";
        areaRendererRef.current = L.canvas({ pane: "riskAreas", padding: 0.5 });
        void loadAreas().then((collection) => {
          if (!cancelled) setAreas(collection);
        });
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
      areaRendererRef.current = null;
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
    if (!liveWeather || !weatherPoints.length) return;
    let cancelled = false;
    const load = () => fetchAreaWeather(weatherPoints)
      .then((value) => {
        if (cancelled) return;
        setAreaWeather(value);
        setWeatherFailed(false);
      })
      .catch(() => {
        if (!cancelled) setWeatherFailed(true);
      });
    void load();
    const timer = window.setInterval(() => void load(), 10 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [liveWeather, weatherPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !areas || !areaRendererRef.current) return;
    let cancelled = false;
    let areaLayer: GeoJSONLayer | null = null;
    const renderer = areaRendererRef.current;
    const indexByFeature = new Map<object, number>(areas.features.map((feature, index) => [feature, index]));

    async function renderAreas() {
      const L = await import("leaflet");
      if (cancelled || !map) return;

      // Leaflet hands these options to each polygon, which accepts a renderer; the typings omit it.
      const options: GeoJSONOptions & { renderer: Renderer } = {
        renderer,
        attribution: "Areas: PSA/NAMRIA 2023; Manila districts © OpenStreetMap",
        style: (feature) => {
          const index = feature ? indexByFeature.get(feature) : undefined;
          const info = index === undefined ? undefined : areaInfos[index];
          if (!info) return {};
          const fill = info.displayScore === null ? UNRATED_AREA_COLOR : classColor(scoreClass(info.displayScore));
          if (index === selectedAreaIndex) {
            return { fillColor: fill, fillOpacity: info.displayScore === null ? 0.45 : info.estimated ? 0.4 : 0.78, color: "#1a1a1a", weight: 2.6, opacity: 1 };
          }
          if (info.estimated) {
            return { fillColor: fill, fillOpacity: ESTIMATE_FILL_OPACITY, color: AREA_BORDER_COLOR, weight: 0.7, opacity: 0.45, dashArray: "3 3" };
          }
          if (info.displayScore === null) {
            return { fillColor: fill, fillOpacity: 0.3, color: AREA_BORDER_COLOR, weight: 0.8, opacity: 0.45 };
          }
          const fromSelected = selectedAreaIndex === null && info.measured?.sourceId === effectiveSelected?.id;
          return { fillColor: fill, fillOpacity: 0.68, color: fromSelected ? "#1a1a1a" : AREA_BORDER_COLOR, weight: fromSelected ? 1.8 : 0.7, opacity: fromSelected ? 0.9 : 0.55 };
        },
        onEachFeature: (feature, layer) => {
          const index = indexByFeature.get(feature);
          const info = index === undefined ? undefined : areaInfos[index];
          if (!info || index === undefined) return;
          const { name, city, level } = info.properties;
          const title = level === "district" ? `${name} district, Manila` : `${name}, ${city}`;
          const detail = info.displayScore === null
            ? `Not rated: no SafeGo data within ${APPROXIMATE_COVERAGE_RADIUS_METERS} m. Not rated does not mean safe.`
            : info.estimated
              ? `Weather-only estimate: ${info.displayScore}/100. Flood, roads and announcements not checked.`
              : info.measured && info.measuredSource && info.measured.score >= info.displayScore
              ? `${activeLayerLabel}: ${info.displayScore}/100, from ${shortPlaceName(info.measuredSource.name)}.`
              : `Weather: ${info.displayScore}/100, ${info.weather?.condition.toLocaleLowerCase()} (live model for ${info.weatherLabel}).`;
          layer.bindTooltip(makeTooltip(title, `${detail} Click for details.`), { sticky: true, direction: "top", opacity: 0.96 });
          layer.on("mouseover", () => (layer as Path).setStyle({ color: "#1a1a1a", weight: 2 }));
          layer.on("mouseout", () => areaLayer?.resetStyle(layer));
          layer.on("click", () => setAreaSelection({ index, context: selectionContext }));
        },
      };
      areaLayer = L.geoJSON(areas, options).addTo(map);
    }

    void renderAreas();
    return () => {
      cancelled = true;
      if (areaLayer) map.removeLayer(areaLayer);
    };
  }, [activeLayerLabel, areaInfos, areas, mapReady, effectiveSelected?.id, selectedAreaIndex, selectionContext]);

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
            aria-label={selectedAreaInfo ? "Area details" : trip ? "Route risk" : "Location risk"}
          >
            {selectedAreaInfo ? (
              <AreaDetails
                info={selectedAreaInfo}
                layerLabel={activeLayerLabel}
                weatherStatus={weatherStatus}
                coverageRadiusMeters={APPROXIMATE_COVERAGE_RADIUS_METERS}
                locationDataIsDemo={locationDataIsDemo}
                onClose={() => setAreaSelection(null)}
                onOpenLocation={onSelectLocation && ((location) => {
                  setAreaSelection(null);
                  onSelectLocation(location);
                })}
              />
            ) : (
            <>
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
            </>
            )}
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

      <div className="hidden lg:block absolute bottom-6 right-4 z-[1000] w-64 bg-white/90 backdrop-blur-md border border-hairline rounded-xl shadow-md p-2.5 text-[11px]">
        <div className="font-bold text-ink mb-1.5">{activeLayerLabel} by area</div>
        <div className="grid grid-cols-10 gap-px">
          {Array.from({ length: SCORE_CLASS_COUNT }, (_, riskClass) => (
            <span key={riskClass} className="h-3" style={{ background: classColor(riskClass) }} title={`${riskClass * 10}–${riskClass === SCORE_CLASS_COUNT - 1 ? 100 : riskClass * 10 + 9}`} />
          ))}
          <span className="col-span-3 text-[10px] text-ink-soft">Low</span>
          <span className="col-span-3 text-[10px] text-ink-soft">Moderate</span>
          <span className="col-span-2 text-[10px] text-ink-soft">High</span>
          <span className="col-span-2 text-[10px] text-ink-soft">Critical</span>
        </div>
        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-ink-soft">
          <span className="h-3 w-6 border border-hairline" style={{ background: UNRATED_AREA_COLOR, opacity: 0.45 }} />
          Not rated: no SafeGo data nearby (not safe)
        </div>
        {activeLayer === "overall" && estimatedAreaCount > 0 && (
          <div className="flex items-center gap-2 mt-1 text-[10px] text-ink-soft">
            <span className="h-3 w-6 border border-dashed border-ink-soft/60" style={{ background: classColor(0), opacity: ESTIMATE_FILL_OPACITY + 0.2 }} />
            Pale, dashed: weather-only estimate (partial)
          </div>
        )}
        {hasUnratedSections && (
          <div className="flex items-center gap-2 mt-1 text-[10px] text-ink-soft">
            <span className="w-6 border-t-[3px] border-dashed" style={{ borderColor: UNKNOWN_ROUTE_COLOR }} />
            Route section without data (not rated safe)
          </div>
        )}
        {areaInfos.length > 0 && (
          <p className="mt-1.5 text-[10px] leading-snug text-ink">
            <strong>{ratedAreaCount} of {areaInfos.length}</strong> Metro Manila areas rated
            {activeLayer === "Weather" && liveAreaWeather
              ? " (live weather covers every area)."
              : estimatedAreaCount > 0
                ? <>; <strong>{estimatedAreaCount}</strong> more have a weather-only estimate.</>
                : "."}
          </p>
        )}
        <p className="mt-1 text-[10px] leading-snug text-ink-soft">
          {activeLayer === "Weather"
            ? weatherStatus === "live"
              ? "Open-Meteo model weather per city (per district in Manila), plus SafeGo readings where higher."
              : weatherStatus === "off"
                ? "Live weather is off while SafeGo shows demo conditions, so only SafeGo locations are rated."
                : "Live weather is loading or unavailable; only SafeGo locations are rated."
            : `Areas within ${APPROXIMATE_COVERAGE_RADIUS_METERS} m of a SafeGo location take its highest score. Barangays; districts in Manila. Click an area for details.`}
        </p>
      </div>
    </div>
  );
}
