"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CircleMarker, GeoJSON as GeoJSONLayer, GeoJSONOptions, LayerGroup, Map as LeafletMap, Path, Renderer } from "leaflet";
import { riskGradient } from "@/lib/safego/risk-model";
import { areaCenter, distanceToArea, nearestPoint, scoreArea, scoreClass, SCORE_CLASS_COUNT, type AreaCollection } from "@/lib/safego/area-scoring";
import { NCR_CITIES } from "@/lib/safego/ncr-cities";
import {
  fetchAreaWeather,
  fetchAreaWeatherHistory,
  weatherGroupKey,
  weatherSamplePoints,
  type AreaWeather,
  type DayWeather,
} from "@/lib/safego/area-weather";
import {
  alertsAt,
  currentHour,
  fetchAlertsTimeline,
  fetchWeatherTimeline,
  HOUR_MS,
  locationAt,
  timelineLabel,
  TIMELINE_HOURS,
  weatherAt,
  type AlertsTimeline,
  type HourWeather,
} from "@/lib/safego/timeline";
import { assessTrip } from "@/lib/trips/trip-assessment";
import { makeRouteEstimate } from "@/lib/trips/route-estimate";
import { describeLocation, describeRisk, scoreWord } from "@/lib/safego/plain-language";
import type { UniversityAlert } from "@/lib/safego/university-alerts";
import { TimeSlider } from "./TimeSlider";
import { UniversityAlertCards } from "./UniversityAlertCards";
import { BottomSheet, Fab, OnboardingHint, RiskBadge, useIsDesktop, type SheetState } from "./ui";
import { analyzeArea } from "@/lib/safego/area-analysis";
import { alertsCovering, fetchActiveAlerts, type ActiveAlert } from "@/lib/safego/area-alerts";
import type { MapLayer, MapLayerKey, SafeGoLocation } from "@/lib/safego/types";
import type { TripAnalysis } from "@/lib/trips/types";
import { PILOT, UNKNOWN_ROUTE_COLOR } from "@/lib/trips/pilot";
import { TripDataNotice } from "./TripCoverage";
import { AreaDetails, type AreaInfo } from "./AreaDetails";
import { displayFactorName, shortPlaceName } from "./labels";

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
const MANILA_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" });

// Flat colours per 10-point class, taken from the middle of each class on the shared risk gradient.
function classColor(riskClass: number) {
  return riskGradient(riskClass * 10 + 5);
}

/** The plain-language summary for a map area, from its own analysis, weather and alerts. */
function describeArea(info: AreaInfo) {
  const { analysis, weather, advisory } = info;
  return describeRisk({
    level: analysis.riskKey ?? "unknown",
    basis: analysis.kind === "unrated" ? "none" : analysis.kind === "partial-estimate" ? "partial" : analysis.source?.risk.basis ?? "full",
    weather: weather ? { score: weather.score, condition: weather.condition } : null,
    advisory: advisory ? { score: advisory.score, count: advisory.alerts.length } : null,
  });
}

type FitOptions = { paddingTopLeft: [number, number]; paddingBottomRight: [number, number]; maxZoom: number };

// Keep fitted routes and markers inside the part of the map the floating panels leave uncovered.
function fitOptions(map: LeafletMap, card: HTMLElement | null): FitOptions {
  const { x: width, y: height } = map.getSize();
  // Phones: keep things clear of the search bar and chips above and the bottom sheet below.
  const fallback: FitOptions = height >= 480 && window.matchMedia("(max-width: 1023px)").matches
    ? { paddingTopLeft: [24, 132], paddingBottomRight: [24, 210], maxZoom: 15 }
    : { paddingTopLeft: [40, 40], paddingBottomRight: [40, 40], maxZoom: 15 };
  if (!card) return fallback;

  if (getComputedStyle(card).position === "absolute") {
    // Large screens: the card floats over the right edge.
    const reserved = card.offsetWidth + 56;
    return width - reserved >= 240
      ? { paddingTopLeft: [60, 80], paddingBottomRight: [reserved, 130], maxZoom: 15 }
      : fallback;
  }

  return fallback;
}

function makeTooltip(title: string, detail: string) {
  const wrapper = document.createElement("span");
  const heading = document.createElement("strong");
  const lineBreak = document.createElement("br");
  heading.textContent = title;
  wrapper.append(heading, lineBreak, document.createTextNode(detail));
  return wrapper;
}

/** A location's score for a map layer, or null when it is not rated or the factor is demo data. */
function layerScore(location: SafeGoLocation, layer: MapLayerKey): number | null {
  if (layer === "overall") return location.risk.basis === "none" ? null : location.risk.percentage;
  if (location.risk.countedFactors && !location.risk.countedFactors.includes(layer)) return null;
  return location.factors.find((factor) => factor.name === layer)?.score ?? null;
}

function isCounted(location: SafeGoLocation, factor: string) {
  return !location.risk.countedFactors || location.risk.countedFactors.some((name) => name === factor);
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
  /** Fetch active PAGASA public alerts for every area; off when the PAGASA source is not active. */
  liveAlerts?: boolean;
  /** Active nearby-university announcements for the selection, most relevant first. */
  universityAlerts?: UniversityAlert[];
  onDismissUniversity?: (id: string) => void;
  /** Shown at the end of the phone sheet, e.g. the data status. */
  footer?: React.ReactNode;
  /** A problem to surface on the map, e.g. the server being unreachable. */
  notice?: string | null;
  /** Space taken by a bottom tab bar on phones, so the sheet sits above it. */
  bottomInset?: number;
  /** When set, the legend is rendered into this element (the desktop sidebar) instead of over the map. */
  legendSlot?: HTMLElement | null;
}

export function RiskMap({
  locations: liveLocations,
  selectedLocation: liveSelected,
  trip: liveTrip,
  previewRoute,
  leftFloatingPanel,
  onSelectLocation,
  onViewDashboard,
  onViewRiskDetails,
  onViewAnnouncements,
  liveWeather = false,
  liveAlerts = false,
  universityAlerts = [],
  onDismissUniversity,
  footer,
  notice = null,
  bottomInset = 0,
  legendSlot = null,
}: RiskMapProps) {
  const isDesktop = useIsDesktop();
  const [sheet, setSheet] = useState<SheetState>("peek");
  // The legend starts open on desktop, where there is room, and closed on phones.
  const [legendChoice, setLegendOpen] = useState<boolean | null>(null);
  const legendOpen = legendChoice ?? isDesktop;
  const [fitNonce, setFitNonce] = useState(0);
  const [locateMessage, setLocateMessage] = useState<string | null>(null);
  const locateMarkerRef = useRef<CircleMarker | null>(null);
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const areaRendererRef = useRef<Renderer | null>(null);
  const areas = NCR_CITIES;
  const weatherPoints = useMemo(() => weatherSamplePoints(NCR_CITIES), []);
  const cardRef = useRef<HTMLElement>(null);
  const [activeLayer, setActiveLayer] = useState<MapLayerKey>("overall");
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [tileStatus, setTileStatus] = useState<"loading" | "ready" | "degraded">("loading");

  // Time slider: null = live. Past views use recorded weather and PAGASA alerts for that hour.
  const [timeCursor, setTimeCursor] = useState<number | null>(null);
  const [weatherTimeline, setWeatherTimeline] = useState<Map<string, HourWeather[]> | null>(null);
  const [alertsTimeline, setAlertsTimeline] = useState<AlertsTimeline | null>(null);
  const [timelineFailed, setTimelineFailed] = useState(false);
  const [timelineEnd, setTimelineEnd] = useState(() => currentHour());
  const timelineStart = timelineEnd - TIMELINE_HOURS * HOUR_MS;
  const at = timeCursor !== null && weatherTimeline && liveWeather ? timeCursor : null;
  const atLabel = at === null ? null : timelineLabel(at);
  const pastAlerts = at === null || !liveAlerts ? null : alertsAt(alertsTimeline, at);
  const locations = useMemo(() => at === null || !weatherTimeline
    ? liveLocations
    : liveLocations.map((location) => locationAt(
      location,
      weatherAt(weatherTimeline.get(`location:${location.id}`), at),
      pastAlerts ? alertsCovering(location.coordinates, pastAlerts) : null,
      timelineLabel(at),
    )), [at, liveLocations, pastAlerts, weatherTimeline]);
  const selectedLocation = liveSelected ? locations.find((location) => location.id === liveSelected.id) ?? liveSelected : liveSelected;
  const trip = useMemo(() => {
    if (!liveTrip || at === null) return liveTrip;
    // Rewound: sections away from SafeGo locations use that hour's recorded area weather and alerts.
    const samples = weatherPoints.flatMap((point) => {
      const reading = weatherAt(weatherTimeline?.get(point.key), at);
      return reading ? [{ coordinates: point.coordinates, score: reading.score }] : [];
    });
    return assessTrip(liveTrip, { locations, sources: liveTrip.sources, weatherUpdatedAt: null }, makeRouteEstimate(samples, pastAlerts));
  }, [at, liveTrip, locations, pastAlerts, weatherPoints, weatherTimeline]);

  const activeLayerLabel =
    MAP_LAYERS.find((layer) => layer.key === activeLayer)?.label ?? "Overall risk";
  const effectiveSelected = selectedLocation ?? locations[0];
  const selectedScore = effectiveSelected ? layerScore(effectiveSelected, activeLayer) : null;
  const verifiedCount = effectiveSelected?.reports.filter(
    (report) => report.status === "verified",
  ).length ?? 0;
  const unverifiedCount = (effectiveSelected?.reports.length ?? 0) - verifiedCount;
  const advisories = trip ? trip.advisories : (effectiveSelected?.advisories ?? []);
  const [areaWeather, setAreaWeather] = useState<Map<string, AreaWeather> | null>(null);
  const [areaHistory, setAreaHistory] = useState<Map<string, DayWeather[]> | null>(null);
  const [weatherFailed, setWeatherFailed] = useState(false);
  // An area selection belongs to the trip and location it was made in; picking something else clears it.
  const [areaSelection, setAreaSelection] = useState<{ index: number; context: string } | null>(null);
  const selectionContext = `${liveTrip?.generatedAt ?? "area"}:${effectiveSelected?.id ?? ""}`;
  const selectedAreaIndex = areaSelection?.context === selectionContext ? areaSelection.index : null;
  const liveAreaWeather = liveWeather ? areaWeather : null;
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[] | null>(null);
  const liveActiveAlerts = liveAlerts ? activeAlerts : null;
  // What the area shading uses: live readings now, recorded ones when rewound.
  const areaAlerts = at === null ? liveActiveAlerts : pastAlerts;
  const cursorDate = at === null ? null : MANILA_DATE_FORMAT.format(new Date(at));
  const weatherStatus = !liveWeather ? "off" : liveAreaWeather ? "live" : weatherFailed ? "unavailable" : "loading";
  const timelinePoints = useMemo(() => [
    ...weatherPoints,
    ...liveLocations.map((location) => ({ key: `location:${location.id}`, label: location.name, coordinates: location.coordinates })),
  ], [liveLocations, weatherPoints]);
  const areaWeatherAt = useMemo(() => {
    if (at === null) return liveAreaWeather;
    const readings = new Map<string, AreaWeather>();
    for (const point of weatherPoints) {
      const reading = weatherAt(weatherTimeline?.get(point.key), at);
      if (reading) readings.set(point.key, reading);
    }
    return readings;
  }, [at, liveAreaWeather, weatherPoints, weatherTimeline]);

  const areaCenters = useMemo(() => areas.features.map(({ geometry }) => areaCenter(geometry)), [areas]);

  const areaInfos: AreaInfo[] = useMemo(() => {
    if (!areas) return [];
    const points = locations.flatMap((location) => {
      const score = layerScore(location, activeLayer);
      return score === null ? [] : [{ id: location.id, coordinates: location.coordinates, score }];
    });
    const overallPoints = locations.flatMap((location) => {
      const score = layerScore(location, "overall");
      return score === null ? [] : [{ id: location.id, coordinates: location.coordinates, score }];
    });
    const byId = new Map(locations.map((location) => [location.id, location]));
    const weatherLabels = new Map(weatherPoints.map((point) => [point.key, point.label]));
    return areas.features.map(({ geometry, properties }, index) => {
      const measured = scoreArea(geometry, points, APPROXIMATE_COVERAGE_RADIUS_METERS);
      const measuredSource = measured ? byId.get(measured.sourceId) ?? null : null;
      const key = weatherGroupKey(properties);
      const weather = areaWeatherAt?.get(key) ?? null;
      const history = liveWeather ? areaHistory?.get(key) ?? null : null;
      const pastDay = cursorDate ? history?.find((day) => day.date === cursorDate) ?? null : null;
      const nearest = nearestPoint(geometry, locations);
      const overallMeasured = activeLayer === "overall" ? measured : scoreArea(geometry, overallPoints, APPROXIMATE_COVERAGE_RADIUS_METERS);
      const advisory = areaAlerts ? alertsCovering(areaCenters[index], areaAlerts) : null;
      const analysis = analyzeArea(overallMeasured ? byId.get(overallMeasured.sourceId) ?? null : null, weather, advisory);
      // Weather and PAGASA alerts are the factors SafeGo can read everywhere. The overall layer shows
      // partial estimates for uncovered areas; the flood, university and community layers only rate covered areas.
      const displayScore = activeLayer === "Weather" && weather
        ? Math.max(measured?.score ?? 0, weather.score)
        : activeLayer === "Official advisories" && advisory
          ? Math.max(measured?.score ?? 0, advisory.score)
          : activeLayer === "overall"
            ? analysis.score
            : measured?.score ?? null;
      return {
        properties,
        measured,
        measuredSource,
        measuredDistanceMeters: analysis.source ? distanceToArea(geometry, analysis.source.coordinates) : null,
        weather,
        history,
        pastDay,
        weatherLabel: weatherLabels.get(key) ?? properties.city,
        displayScore,
        estimated: activeLayer === "overall" && analysis.kind === "partial-estimate",
        analysis,
        advisory,
        nearest: nearest ? { location: nearest.point, distanceMeters: nearest.distanceMeters } : null,
      };
    });
  }, [activeLayer, areaAlerts, areaHistory, areaWeatherAt, areas, cursorDate, liveWeather, locations, weatherPoints]);
  const selectedAreaInfo = selectedAreaIndex === null ? null : areaInfos[selectedAreaIndex] ?? null;
  const ratedAreaCount = areaInfos.filter((info) => info.displayScore !== null && !info.estimated).length;
  const estimatedAreaCount = areaInfos.filter((info) => info.estimated).length;
  const areaLayerRef = useRef<GeoJSONLayer | null>(null);
  const routeLayerRef = useRef<LayerGroup | null>(null);
  const atLabelRef = useRef(atLabel);
  atLabelRef.current = atLabel;
  const activeLayerLabelRef = useRef(activeLayerLabel);
  activeLayerLabelRef.current = activeLayerLabel;
  const activeLayerRef = useRef(activeLayer);
  activeLayerRef.current = activeLayer;
  const areaInfosRef = useRef(areaInfos);
  areaInfosRef.current = areaInfos;
  const selectedAreaIndexRef = useRef(selectedAreaIndex);
  selectedAreaIndexRef.current = selectedAreaIndex;
  const effectiveSelectedIdRef = useRef(effectiveSelected?.id);
  effectiveSelectedIdRef.current = effectiveSelected?.id;
  const selectionContextRef = useRef(selectionContext);
  selectionContextRef.current = selectionContext;

  const bounds: Array<[number, number]> = useMemo(
    () => liveTrip?.routeCoordinates.length
      ? liveTrip.routeCoordinates
      : previewRoute?.routeCoordinates.length
        ? previewRoute.routeCoordinates
        : liveSelected
          ? [liveSelected.coordinates]
          : liveLocations.length > 0
            ? liveLocations.map((location) => location.coordinates)
            : [[14.5995, 120.9842], [14.6120, 121.0614]],
    [liveLocations, liveTrip, previewRoute, liveSelected],
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
        routeLayerRef.current = L.layerGroup().addTo(map);
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
      routeLayerRef.current = null;
      areaRendererRef.current = null;
      areaLayerRef.current = null;
    };
    // Create the Leaflet map once; later bound changes are handled by the fit effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [bounds, mapReady, fitNonce]);

  const locateMe = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocateMessage("This browser cannot share your location.");
      return;
    }
    setLocateMessage("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const L = await import("leaflet");
        const map = mapRef.current;
        if (!map) return;
        const point: [number, number] = [position.coords.latitude, position.coords.longitude];
        locateMarkerRef.current?.remove();
        locateMarkerRef.current = L.circleMarker(point, { radius: 8, color: "#ffffff", weight: 3, fillColor: "#1d4ed8", fillOpacity: 1 })
          .bindTooltip("You are here")
          .addTo(map);
        map.setView(point, 15, { animate: true });
        setLocateMessage(null);
      },
      () => setLocateMessage("Could not get your location. Allow location access in your browser, then try again."),
      { timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(() => {
    if (!locateMessage || locateMessage.endsWith("…")) return;
    const timer = window.setTimeout(() => setLocateMessage(null), 6_000);
    return () => window.clearTimeout(timer);
  }, [locateMessage]);

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
        const color = score === null ? UNKNOWN_ROUTE_COLOR : riskGradient(score);
        const partial = score !== null && activeLayer === "overall" && location.risk.basis === "partial";
        const reading = score === null
          ? "not rated (no live data for this layer)"
          : `${score} out of 100${partial ? ", partial rating" : ""}`;
        const icon = L.divIcon({
          className: "safego-leaflet-icon",
          html: `<span class="map-marker leaflet-marker ${evidenceClass(location)}${selected ? " selected" : ""}${partial ? " partial-basis" : ""}${score === null ? " unrated" : ""}" style="--marker-color:${color}"><span class="map-marker-score">${score ?? "–"}</span></span>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          tooltipAnchor: [0, -20],
        });
        const marker = L.marker(location.coordinates, {
          icon,
          keyboard: true,
          title: `${location.name}, ${reading}`,
          alt: `${location.name}, ${reading}`,
          riseOnHover: true,
        });

        marker.bindTooltip(
          () => makeTooltip(atLabelRef.current ? `${location.name} · ${atLabelRef.current}` : location.name, score === null ? `${activeLayerLabelRef.current}: not rated (no live data).` : `${activeLayerLabelRef.current}: ${score}/100${partial ? " (partial: live factors only)" : ""}.`),
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
  }, [activeLayer, locations, mapReady, onSelectLocation, effectiveSelected?.id]);

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
    const initialLoad = window.setTimeout(() => void load(), 800);
    const timer = window.setInterval(() => void load(), 10 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [liveWeather, weatherPoints]);

  useEffect(() => {
    if (!liveWeather || !weatherPoints.length) return;
    let cancelled = false;
    const initialLoad = window.setTimeout(() => {
      fetchAreaWeatherHistory(weatherPoints)
        .then((history) => {
          if (!cancelled) setAreaHistory(history);
        })
        .catch(() => {
          // Past days are optional; the day picker stays hidden until history loads.
        });
    }, 2_000);
    return () => {
      cancelled = true;
      window.clearTimeout(initialLoad);
    };
  }, [liveWeather, weatherPoints]);

  useEffect(() => {
    if (!liveWeather || !areas || !timelinePoints.length) return;
    let cancelled = false;
    const load = () => {
      fetchWeatherTimeline(timelinePoints)
        .then((value) => {
          if (cancelled) return;
          setWeatherTimeline(value);
          setTimelineEnd(currentHour());
          setTimelineFailed(false);
        })
        .catch(() => {
          if (!cancelled) setTimelineFailed(true);
        });
      if (liveAlerts) {
        fetchAlertsTimeline()
          .then((value) => {
            if (!cancelled) setAlertsTimeline(value);
          })
          .catch(() => {
            // Without alert history, rewound views count weather only and say so.
          });
      }
    };
    const initialLoad = window.setTimeout(load, 3_500);
    const timer = window.setInterval(load, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [areas, liveAlerts, liveWeather, timelinePoints]);

  useEffect(() => {
    if (!liveAlerts) return;
    let cancelled = false;
    const load = () => fetchActiveAlerts()
      .then((alerts) => {
        if (!cancelled) setActiveAlerts(alerts);
      })
      .catch(() => {
        // Keep the last good list; the area panel shows alerts as unavailable until one loads.
      });
    void load();
    const timer = window.setInterval(() => void load(), 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [liveAlerts]);

  const indexByFeature = useMemo(
    () => new Map<object, number>(areas.features.map((feature, index) => [feature, index])),
    [areas],
  );

  const getFeatureStyle = useCallback((feature: unknown) => {
    const index = feature ? indexByFeature.get(feature as object) : undefined;
    const info = index === undefined ? undefined : areaInfosRef.current[index];
    if (!info) return {};
    const fill = info.displayScore === null ? UNRATED_AREA_COLOR : classColor(scoreClass(info.displayScore));
    if (index === selectedAreaIndexRef.current) {
      return { fillColor: fill, fillOpacity: info.displayScore === null ? 0.45 : info.estimated ? 0.4 : 0.78, color: "#1a1a1a", weight: 2.6, opacity: 1 };
    }
    if (info.estimated) {
      return { fillColor: fill, fillOpacity: ESTIMATE_FILL_OPACITY, color: AREA_BORDER_COLOR, weight: 0.7, opacity: 0.45, dashArray: "3 3" };
    }
    if (info.displayScore === null) {
      return { fillColor: fill, fillOpacity: 0.3, color: AREA_BORDER_COLOR, weight: 0.8, opacity: 0.45 };
    }
    const fromSelected = selectedAreaIndexRef.current === null && info.measured?.sourceId === effectiveSelectedIdRef.current;
    return { fillColor: fill, fillOpacity: 0.68, color: fromSelected ? "#1a1a1a" : AREA_BORDER_COLOR, weight: fromSelected ? 1.8 : 0.7, opacity: fromSelected ? 0.9 : 0.55 };
  }, [indexByFeature]);

  const getFeatureTooltip = useCallback((feature: unknown) => {
    const index = feature ? indexByFeature.get(feature as object) : undefined;
    const info = index === undefined ? undefined : areaInfosRef.current[index];
    if (!info || index === undefined) return "";
    const { name, city, level } = info.properties;
    const title = level === "city" ? name : level === "district" ? `${name} district, Manila` : `${name}, ${city}`;
    const at = atLabelRef.current;
    const activeLabel = activeLayerLabelRef.current;
    const layer = activeLayerRef.current;
    const detail = info.displayScore === null
      ? `Not rated: no SafeGo data within ${APPROXIMATE_COVERAGE_RADIUS_METERS} m. Not rated does not mean safe.`
      : info.estimated
        ? `Partial estimate: ${info.displayScore}/100 from ${at ? "recorded" : "live"} weather${info.advisory ? " and PAGASA alerts" : ""}. Street flooding and roads not checked.`
        : info.measured && info.measuredSource && info.measured.score >= info.displayScore
        ? `${activeLabel}: ${info.displayScore}/100, from ${shortPlaceName(info.measuredSource.name)}.`
        : layer === "Official advisories"
          ? info.advisory?.alerts.length
            ? `PAGASA: ${info.advisory.alerts.map((alert) => alert.headline).join("; ")} (${info.displayScore}/100).`
            : at ? "No PAGASA alert covered this area then." : "No active PAGASA alert covers this area."
          : `Weather: ${info.displayScore}/100, ${info.weather?.condition.toLocaleLowerCase()} (${at ? "recorded" : "live"} model for ${info.weatherLabel}).`;
    return makeTooltip(at ? `${title} · ${at}` : title, `${detail} Click for details.`);
  }, [indexByFeature]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !areas || !areaRendererRef.current) return;
    let cancelled = false;

    async function mountAreas() {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current || !areaRendererRef.current) return;

      const options: GeoJSONOptions & { renderer: Renderer } = {
        renderer: areaRendererRef.current,
        attribution: "Areas: PSA/NAMRIA 2023; Manila districts © OpenStreetMap; alerts: PAGASA (CC BY 4.0)",
        style: (feature) => getFeatureStyle(feature),
        onEachFeature: (feature, layer) => {
          const index = feature ? indexByFeature.get(feature) : undefined;
          layer.bindTooltip(() => getFeatureTooltip(feature), { sticky: true, direction: "top", opacity: 0.96 });
          layer.on("mouseover", () => (layer as Path).setStyle({ color: "#1a1a1a", weight: 2 }));
          layer.on("mouseout", () => {
            if (feature) (layer as Path).setStyle(getFeatureStyle(feature));
          });
          layer.on("click", () => {
            if (index !== undefined) {
              setAreaSelection({ index, context: selectionContextRef.current });
              setSheet((current) => (current === "peek" ? "half" : current));
            }
          });
        },
      };

      const layer = L.geoJSON(areas, options).addTo(mapRef.current);
      areaLayerRef.current = layer;
      layer.setStyle((feature) => getFeatureStyle(feature));
    }

    void mountAreas();
    return () => {
      cancelled = true;
      if (areaLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(areaLayerRef.current);
        areaLayerRef.current = null;
      }
    };
  }, [areas, getFeatureStyle, getFeatureTooltip, indexByFeature, mapReady]);

  useEffect(() => {
    if (!areaLayerRef.current) return;
    areaLayerRef.current.setStyle((feature) => getFeatureStyle(feature));
  }, [areaInfos, getFeatureStyle, selectedAreaIndex, effectiveSelected?.id]);

  useEffect(() => {
    if (!mapReady || !routeLayerRef.current) return;
    let cancelled = false;

    async function renderRoute() {
      const L = await import("leaflet");
      if (cancelled || !routeLayerRef.current) return;
      const routeLayer = routeLayerRef.current;
      routeLayer.clearLayers();

      if (trip) {
        // A white casing keeps the risk-coloured route readable on top of the heat shading.
        L.polyline(trip.routeCoordinates, { color: "#ffffff", weight: 13, opacity: 0.9, lineCap: "round", lineJoin: "round", interactive: false }).addTo(routeLayer);
        trip.segments.forEach((segment) => {
          // Estimated sections (no SafeGo location nearby) are drawn lighter so they never read as a full rating.
          const estimated = segment.coverage === "estimated";
          L.polyline(segment.coordinates, {
            color: segment.riskScore === null ? UNKNOWN_ROUTE_COLOR : riskGradient(segment.riskScore),
            dashArray: segment.riskScore === null ? "8 6" : estimated ? "14 5" : undefined,
            weight: estimated ? 6 : 8,
            opacity: estimated ? 0.75 : 0.9,
            lineCap: segment.riskScore === null || estimated ? "butt" : "round",
          })
            .bindTooltip(() => makeTooltip(
              segment.basisLocationName ?? "Insufficient information",
              segment.riskScore === null
                ? "Not enough information to score this section."
                : estimated
                  ? `${segment.riskScore}/100. Partial estimate from ${atLabelRef.current ? "recorded" : "live"} weather and PAGASA alerts here; street flooding and roads not checked.`
                  : `${segment.riskScore}/100. Approximate route section.`,
            ))
            .addTo(routeLayer);
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
          }).bindTooltip(makeTooltip(`${label}: ${place.label}`, "Route endpoint"), { direction: "top" }).addTo(routeLayer);
        });
      } else if (previewRoute) {
        L.polyline(previewRoute.routeCoordinates, { color: "#ffffff", weight: 10, opacity: 0.9, lineCap: "round", interactive: false }).addTo(routeLayer);
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
          .addTo(routeLayer);

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
          }).bindTooltip(makeTooltip(`${label}: ${place.label}`, "Route stop"), { direction: "top" }).addTo(routeLayer);
        });
      }
    }

    void renderRoute();
    return () => {
      cancelled = true;
    };
  }, [mapReady, trip, previewRoute]);

  const showTimeline = liveWeather;
  const overallScore = trip ? trip.overallRiskScore : effectiveSelected ? layerScore(effectiveSelected, "overall") : null;
  // With no trip, the card describes one location; its basis says how much of the score is live.
  const overallBasis = trip
    ? (trip.corridorLocations.some((location) => location.risk.basis === "partial") ? "partial" : trip.corridorLocations[0]?.risk.basis)
    : effectiveSelected?.risk.basis;
  const latestAdvisory = advisories[0];
  const hasUnratedSections = Boolean(trip?.segments.some((segment) => segment.riskScore === null));

  // Plain-language summary: what the rating is, why, and what to do.
  const message = useMemo(() => {
    if (!trip) return effectiveSelected ? describeLocation(effectiveSelected) : describeRisk({ level: "unknown", basis: "none" });
    if (trip.overallRiskScore === null || trip.riskKey === "unknown") {
      return { ...describeRisk({ level: "unknown", basis: "none" }), why: "Too little of this route has data to rate it. Gray sections are not rated, which does not mean safe." };
    }
    const worst = trip.segments.reduce((top, segment) => ((segment.riskScore ?? -1) > (top.riskScore ?? -1) ? segment : top));
    const where = worst.coverage === "estimated" ? "an estimated section" : `near ${shortPlaceName(worst.basisLocationName ?? "the route")}`;
    return {
      ...describeRisk({ level: trip.riskKey, basis: overallBasis === "partial" ? "partial" : "full" }),
      why: `The riskiest stretch is ${where} (${scoreWord(worst.riskScore ?? 0).toLocaleLowerCase()} risk).`,
    };
  }, [effectiveSelected, overallBasis, trip]);

  const title = selectedAreaInfo
    ? selectedAreaInfo.properties.name
    : trip
      ? `${shortPlaceName(trip.origin.label)} → ${shortPlaceName(trip.destination.label)}`
      : effectiveSelected?.name ?? "Metro Manila";
  const kicker = selectedAreaInfo
    ? (selectedAreaInfo.properties.level === "city"
        ? "City / Municipality"
        : selectedAreaInfo.properties.level === "district"
        ? "District · City of Manila"
        : `Barangay · ${selectedAreaInfo.properties.city}`)
    : trip
      ? `Route · ${(trip.coverage.totalMeters / 1000).toFixed(1)} km`
      : effectiveSelected ? `Area · ${effectiveSelected.city}` : "";
  const areaMessage = selectedAreaInfo ? describeArea(selectedAreaInfo) : null;
  const headMessage = areaMessage ?? message;
  const headScore = selectedAreaInfo ? selectedAreaInfo.analysis.score : overallScore;
  const headPartial = selectedAreaInfo ? selectedAreaInfo.analysis.kind === "partial-estimate" : overallBasis === "partial";

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-ink-soft truncate">{kicker}</div>
        <h3 className="text-base font-bold text-ink truncate">{title}</h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <RiskBadge level={headMessage.level} partial={headPartial} />
          {headScore !== null && headMessage.level !== "unknown" && (
            <span className="text-xs text-ink-soft" title="Risk score from 0 (lowest) to 100 (highest)">{headScore} out of 100</span>
          )}
        </div>
      </div>
      {selectedAreaInfo && (
        <button
          type="button"
          className="size-11 lg:size-9 shrink-0 rounded-full text-ink-soft hover:bg-surface text-xl leading-none"
          onClick={() => setAreaSelection(null)}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label="Close area details"
        >
          ×
        </button>
      )}
    </div>
  );

  const rewoundStrip = atLabel && (
    <div className="mb-3 rounded-box bg-inverse text-white px-3 py-2 text-xs flex items-center justify-between gap-2">
      <span><strong>Viewing {atLabel}</strong><span className="block text-white/75">Recorded weather and PAGASA alerts for that hour.</span></span>
      <button type="button" className="min-h-9 shrink-0 rounded-full bg-white/15 hover:bg-white/25 px-3 font-semibold" onClick={() => setTimeCursor(null)}>
        Back to live
      </button>
    </div>
  );

  const summary = (
    <>
      <p className="text-sm text-ink leading-snug">{message.why}</p>
      <p className="mt-1.5 text-sm text-ink leading-snug"><strong>What to do:</strong> {message.action}</p>
      {message.caveat && <p className="mt-1.5 text-xs text-ink-soft leading-snug">{message.caveat}</p>}

      <div className="mt-3">
        {at === null && <UniversityAlertCards alerts={universityAlerts} onDismiss={onDismissUniversity} onViewAll={onViewAnnouncements} />}

        {latestAdvisory && (
          <div className="mb-3 rounded-box border border-brand/30 bg-brand-soft p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-brand-ink">
                {atLabel ? "Official alert then" : "Official alert"}{latestAdvisory.isMock ? " · Demo" : ""}
              </span>
              {onViewAnnouncements && at === null && (
                <button type="button" className="min-h-9 text-xs font-bold text-brand-ink hover:underline" onClick={onViewAnnouncements}>
                  View all ({advisories.length})
                </button>
              )}
            </div>
            <p className="text-sm font-semibold text-ink leading-snug">{latestAdvisory.title}</p>
          </div>
        )}

        {trip && <TripDataNotice trip={trip} />}
        {trip?.safetyRule && (
          <div className="mb-3 rounded-box border border-mod/40 bg-mod-soft p-2.5 text-xs font-medium text-mod">{trip.safetyRule}</div>
        )}
      </div>

      {effectiveSelected && (
        <details className="group mb-3 rounded-box border border-hairline">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
            How this was worked out
            <span className="text-ink-soft transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
          </summary>
          <div className="border-t border-hairline px-3 py-2.5">
            <div className="text-xs font-semibold text-ink-soft mb-1">
              {trip ? `Readings near ${shortPlaceName(effectiveSelected.name)}` : "What SafeGo looked at"}
            </div>
            {effectiveSelected.factors.map((factor) => {
              const counted = isCounted(effectiveSelected, factor.name);
              return (
                <div key={factor.name} className="flex items-center justify-between gap-2 border-b border-hairline/60 py-1.5 text-xs last:border-b-0">
                  <span className="text-ink">{displayFactorName(factor.name)}</span>
                  <span className={`text-right ${counted ? "text-ink" : "text-ink-soft"}`}>
                    <strong className="font-semibold">{scoreWord(factor.score)}</strong> ({factor.score})
                    {effectiveSelected.risk.countedFactors && (
                      <span className={`ml-1.5 font-semibold ${counted ? "text-low" : "text-mod"}`}>
                        {counted ? (atLabel ? "recorded" : "live") : "sample data, not counted"}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
            {selectedScore !== null && activeLayer !== "overall" && (
              <p className="mt-2 text-xs text-ink-soft">The map is showing the {activeLayerLabel.toLocaleLowerCase()} layer: {scoreWord(selectedScore).toLocaleLowerCase()} ({selectedScore}).</p>
            )}
            <p className="mt-2 text-xs text-ink-soft">
              {verifiedCount} verified and {unverifiedCount} unconfirmed community reports · Updated {effectiveSelected.updated}
            </p>
            <p className="mt-1 text-xs text-ink-soft">Scores run from 0 (lowest risk) to 100 (highest). “Sample data” values are placeholders and never change a rating.</p>
          </div>
        </details>
      )}

      <div className="grid grid-cols-2 gap-2">
        {onViewRiskDetails && (
          <button className="min-h-11 rounded-box border border-hairline bg-surface text-sm font-semibold text-ink hover:bg-neutral-soft" type="button" onClick={onViewRiskDetails}>
            Why this rating
          </button>
        )}
        {onViewDashboard && (
          <button className={`min-h-11 rounded-box bg-brand text-sm font-semibold text-white hover:bg-brand-hover${onViewRiskDetails ? "" : " col-span-2"}`} type="button" onClick={onViewDashboard}>
            See conditions
          </button>
        )}
      </div>
    </>
  );

  const areaBody = selectedAreaInfo && areaMessage && (
    <AreaDetails
      info={selectedAreaInfo}
      message={areaMessage}
      timeLabel={atLabel}
      weatherStatus={weatherStatus}
      coverageRadiusMeters={APPROXIMATE_COVERAGE_RADIUS_METERS}
      liveAlerts={liveAlerts}
      onOpenLocation={onSelectLocation && ((location) => {
        setAreaSelection(null);
        onSelectLocation(location);
      })}
    />
  );

  const legend = (
    <div className={legendSlot ? "rounded-box border border-hairline bg-panel p-3 text-xs" : "pointer-events-auto w-64 max-w-[calc(100vw-5.5rem)] rounded-box border border-hairline bg-panel p-3 text-xs shadow-[var(--shadow-card)]"} role="region" aria-label="Map legend">
      <div className="font-bold text-ink mb-1.5">{activeLayerLabel} by area{atLabel ? ` · ${atLabel}` : ""}</div>
      <div className="grid grid-cols-10 gap-px">
        {Array.from({ length: SCORE_CLASS_COUNT }, (_, riskClass) => (
          <span key={riskClass} className="h-3" style={{ background: classColor(riskClass) }} title={`${riskClass * 10}–${riskClass === SCORE_CLASS_COUNT - 1 ? 100 : riskClass * 10 + 9}`} />
        ))}
        <span className="col-span-3 text-ink-soft">Low</span>
        <span className="col-span-3 text-ink-soft">Moderate</span>
        <span className="col-span-2 text-ink-soft">High</span>
        <span className="col-span-2 text-ink-soft">Critical</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-ink-soft">
        <span className="h-3 w-6 shrink-0 border border-hairline" style={{ background: UNRATED_AREA_COLOR, opacity: 0.45 }} />
        Gray: not rated (not the same as safe)
      </div>
      {activeLayer === "overall" && estimatedAreaCount > 0 && (
        <div className="mt-1 flex items-center gap-2 text-ink-soft">
          <span className="h-3 w-6 shrink-0 border border-dashed border-ink-soft/60" style={{ background: classColor(0), opacity: ESTIMATE_FILL_OPACITY + 0.2 }} />
          Pale and dashed: partial estimate
        </div>
      )}
      {hasUnratedSections && (
        <div className="mt-1 flex items-center gap-2 text-ink-soft">
          <span className="w-6 shrink-0 border-t-[3px] border-dashed" style={{ borderColor: UNKNOWN_ROUTE_COLOR }} />
          Gray dashed route: no data
        </div>
      )}
      <p className="mt-2 leading-snug text-ink-soft">
        {atLabel
          ? `Showing recorded weather${pastAlerts ? " and PAGASA alerts" : ""} for ${atLabel}.`
          : activeLayer === "Weather"
            ? weatherStatus === "live" ? "Live weather for every area." : "Live weather is not available right now."
            : activeLayer === "Official advisories"
              ? liveActiveAlerts
                ? (liveActiveAlerts.length ? `${liveActiveAlerts.length} PAGASA alert${liveActiveAlerts.length === 1 ? "" : "s"} over Metro Manila.` : "No PAGASA alert over Metro Manila right now.")
                : "PAGASA alerts are not available right now."
              : activeLayer === "overall"
                ? (ratedAreaCount === 0 && estimatedAreaCount > 0
                  ? "Ratings are partial: live weather and official alerts only."
                  : `${ratedAreaCount} of ${areaInfos.length} areas have a full rating.`)
                : "Only areas near a SafeGo location have this information."}
        {" "}Tap an area for details.
      </p>
    </div>
  );

  const fabs = (
    <>
      {legendSlot ? createPortal(legend, legendSlot) : legendOpen && legend}
      {locateMessage && (
        <div className="pointer-events-auto max-w-56 rounded-box bg-inverse px-3 py-2 text-xs text-white shadow-[var(--shadow-card)]" role="status">{locateMessage}</div>
      )}
      {!legendSlot && <Fab label={legendOpen ? "Hide map legend" : "Show map legend"} active={legendOpen} onClick={() => setLegendOpen(!legendOpen)}>
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></svg>
      </Fab>}
      <Fab label="Recenter the map" onClick={() => setFitNonce((nonce) => nonce + 1)}>
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
      </Fab>
      <Fab label="Go to my location" onClick={locateMe}>
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.5" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /></svg>
      </Fab>
    </>
  );

  const slider = showTimeline && (
    <TimeSlider
      start={timelineStart}
      end={timelineEnd}
      value={at}
      onChange={setTimeCursor}
      status={weatherTimeline ? "ready" : timelineFailed ? "unavailable" : "loading"}
    />
  );

  const statusChip = notice
    ? { tone: "bg-crit-soft text-crit", text: notice }
    : mapError
      ? null
      : tileStatus === "degraded"
        ? { tone: "bg-mod-soft text-mod", text: "The base map could not load. Risk shading still works." }
        : !areas
          ? { tone: "bg-panel text-ink-soft", text: "Loading Metro Manila areas…" }
          : tileStatus === "loading"
            ? { tone: "bg-panel text-ink-soft", text: "Loading the map…" }
            : null;

  const chips = (
    <div
      role="toolbar"
      aria-label="What the map shows"
      className="pointer-events-auto flex max-w-full shrink-0 items-center gap-1 overflow-x-auto rounded-full border border-hairline bg-panel px-1.5 py-1 shadow-[var(--shadow-card)] [scrollbar-width:none]"
    >
      {MAP_LAYERS.map((layer) => (
        <button
          key={layer.key}
          type="button"
          aria-pressed={layer.key === activeLayer}
          className={`min-h-11 lg:min-h-8 whitespace-nowrap rounded-full px-3.5 text-sm lg:text-xs font-semibold transition-colors ${
            layer.key === activeLayer ? "bg-brand text-white" : "text-ink hover:bg-surface"
          }`}
          onClick={() => setActiveLayer(layer.key)}
        >
          {layer.label}
        </button>
      ))}
    </div>
  );

  const hint = (
    <OnboardingHint>
      <strong>Tip:</strong> tap any area or pin to see its conditions. Use the chips to switch what the map shows, and drag the timeline to look back up to 4 days.
    </OnboardingHint>
  );

  return (
    <div className="relative size-full overflow-hidden bg-surface">
      <div className="live-map absolute inset-0 size-full z-0" ref={mapElementRef} />
      {mapError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-panel/90 p-6 text-center">
          <strong className="text-base text-ink">The map could not load</strong>
          <span className="text-sm text-ink-soft">Check your internet connection, then reload the page.</span>
          <button type="button" className="mt-1 min-h-11 rounded-box bg-brand px-4 text-sm font-semibold text-white" onClick={() => window.location.reload()}>Reload</button>
        </div>
      )}

      {isDesktop ? (
        <div className="pointer-events-none absolute inset-0 z-[1000]">
          <div className="absolute left-1/2 top-4 flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col items-center gap-2">
            {chips}
            {statusChip && <div role="status" className={`pointer-events-auto rounded-full px-3 py-1.5 text-xs font-semibold shadow-[var(--shadow-card)] ${statusChip.tone}`}>{statusChip.text}</div>}
          </div>

          {(effectiveSelected || selectedAreaInfo) && (
            <aside
              className={`pointer-events-auto absolute right-4 top-16 w-[360px] overflow-y-auto rounded-2xl border border-hairline bg-panel p-4 shadow-[var(--shadow-card)] ${showTimeline ? "max-h-[calc(100%-12rem)]" : "max-h-[calc(100%-6rem)]"}`}
              ref={cardRef}
              aria-live="polite"
              aria-label={selectedAreaInfo ? "Area details" : trip ? "Route risk" : "Location risk"}
            >
              {rewoundStrip}
              <div className="mb-3 border-b border-hairline pb-3">{header}</div>
              {areaBody || summary}
            </aside>
          )}

          {/* Bottom-left, so the map controls and legend never sit under the details card. */}
          <div className={`absolute left-4 flex w-[340px] max-w-[calc(100%-25rem)] [&>*]:max-w-full flex-col items-start gap-2 ${showTimeline ? "bottom-28" : "bottom-6"}`}>
            {hint}
            {fabs}
          </div>
          {slider && <div className="absolute inset-x-4 bottom-4">{slider}</div>}
        </div>
      ) : (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex flex-col gap-2 p-3">
            {leftFloatingPanel}
            {chips}
            {statusChip && <div role="status" className={`pointer-events-auto self-center rounded-full px-3 py-1.5 text-xs font-semibold shadow-[var(--shadow-card)] ${statusChip.tone}`}>{statusChip.text}</div>}
            {hint}
          </div>
          <BottomSheet
            state={sheet}
            onStateChange={setSheet}
            bottomOffset={bottomInset}
            label={selectedAreaInfo ? "Area details" : trip ? "Route risk" : "Location risk"}
            header={header}
            floating={fabs}
          >
            <div aria-live="polite">
              {rewoundStrip}
              {areaBody || summary}
              {slider && <div className="mt-4">{slider}</div>}
              {footer && <div className="mt-4">{footer}</div>}
            </div>
          </BottomSheet>
        </>
      )}
    </div>
  );
}
