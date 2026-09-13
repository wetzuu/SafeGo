"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { riskGradient } from "@/lib/safego/risk-model";
import type { SafeGoLocation } from "@/lib/safego/types";
import type { TripAnalysis } from "@/lib/trips/types";
import { PILOT, UNKNOWN_ROUTE_COLOR } from "@/lib/trips/pilot";
import { Icon } from "./Icon";

const RISK_LEGEND = [
  { label: "Low", range: "0–29", color: "#15803d" },
  { label: "Moderate", range: "30–59", color: "#ca8a04" },
  { label: "High", range: "60–79", color: "#ea580c" },
  { label: "Critical", range: "80–100", color: "#dc2626" },
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

function CompactRiskMap({
  location,
  trip,
}: {
  location?: SafeGoLocation;
  trip?: TripAnalysis | null;
}) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [mapError, setMapError] = useState(false);
  const [tileStatus, setTileStatus] = useState<"loading" | "ready" | "degraded">("loading");

  useEffect(() => {
    let cancelled = false;

    async function initializeMap() {
      if (!mapElementRef.current) return;

      try {
        setMapError(false);
        setTileStatus("loading");
        const L = await import("leaflet");
        if (cancelled || !mapElementRef.current) return;

        const map = L.map(mapElementRef.current, {
          zoomControl: true,
          minZoom: 10,
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

        const coverageLocations = trip?.corridorLocations.length
          ? trip.corridorLocations
          : location ? [location] : [];

        coverageLocations.forEach((coverageLocation) => {
          const color = riskGradient(coverageLocation.risk.percentage);
          L.circle(coverageLocation.coordinates, {
            radius: APPROXIMATE_COVERAGE_RADIUS_METERS,
            color,
            weight: 2,
            opacity: 0.8,
            dashArray: "6 5",
            fillColor: color,
            fillOpacity: 0.17,
          })
            .bindTooltip(
              makeTooltip(
                coverageLocation.name,
                `${coverageLocation.risk.percentage}/100. Approximate data area.`,
              ),
              { direction: "top" },
            )
            .addTo(map);
        });

        if (trip) {
          trip.segments.forEach((segment) => {
            L.polyline(segment.coordinates, {
              color: segment.riskScore === null ? UNKNOWN_ROUTE_COLOR : riskGradient(segment.riskScore),
              dashArray: segment.riskScore === null ? "8 6" : undefined,
              weight: 7,
              opacity: 0.92,
              lineCap: segment.riskScore === null ? "butt" : "round",
            })
              .bindTooltip(
                makeTooltip(
                  segment.basisLocationName ?? "Insufficient information",
                  segment.riskScore === null ? "Not enough information to score this section." : `${segment.riskScore}/100. Approximate risk section.`,
                ),
              )
              .addTo(map);
          });

          ([
            { place: trip.origin, label: "A" },
            { place: trip.destination, label: "B" },
          ] as const).forEach(({ place, label }) => {
            L.circleMarker(place.coordinates, {
              radius: 9,
              color: "#ffffff",
              weight: 3,
              fillColor: "#1a1a1a",
              fillOpacity: 1,
            })
              .bindTooltip(makeTooltip(`${label}: ${place.label}`, "Route endpoint"), {
                direction: "top",
              })
              .addTo(map);
          });

          map.fitBounds(L.latLngBounds(trip.routeCoordinates), {
            padding: [22, 22],
            maxZoom: 13,
          });
        } else if (location) {
          L.circleMarker(location.coordinates, {
            radius: 11,
            color: "#ffffff",
            weight: 4,
            fillColor: riskGradient(location.risk.percentage),
            fillOpacity: 1,
          })
            .bindTooltip(
              makeTooltip(
                location.name,
                `${location.risk.percentage}/100. ${location.risk.name}.`,
              ),
              { direction: "top" },
            )
            .addTo(map);
          map.setView(location.coordinates, 14);
        }

        mapRef.current = map;
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
    };
  }, [location, trip]);

  return (
    <div className="overview-map-frame" role="group" aria-label={trip ? "Compact interactive route risk map" : `Compact interactive map of ${location?.name ?? "the selected area"}`}>
      <div className="overview-live-map" ref={mapElementRef} />
      {mapError && <div className="overview-map-error">The live map could not load. Check your connection or open the full Map page later.</div>}
      {!mapError && tileStatus === "loading" && <div className="map-tile-status compact" role="status">Loading map tiles…</div>}
      {!mapError && tileStatus === "degraded" && <div className="map-tile-status compact warning" role="status">Base map unavailable. Risk overlays remain visible.</div>}
      <span className="overview-map-badge">Live map. Approximate data.</span>
    </div>
  );
}

export function OverviewContextPanel({
  location,
  trip,
  onOpenMap,
  onViewConditions,
}: {
  location?: SafeGoLocation;
  trip?: TripAnalysis | null;
  onOpenMap: () => void;
  onViewConditions: () => void;
}) {
  const contextLabel = trip ? "Highest-risk location" : "Selected location";
  const weather = location?.stats.find((stat) => stat.label === "Weather");
  const usefulConditions = (["Road condition", "School status"] as const).flatMap((label) => {
    const condition = location?.stats.find((stat) => stat.label === label);
    return condition ? [condition] : [];
  });
  const announcement = location?.advisories[0];

  return (
    <div className="overview-context-grid">
      <article className="card overview-map-card">
        <div className="overview-panel-head">
          <div>
            <span>{trip ? "Route at a glance" : "Location at a glance"}</span>
            <h2>Risk map preview</h2>
          </div>
          <button type="button" onClick={onOpenMap}>Open full map</button>
        </div>
        <CompactRiskMap location={location} trip={trip} />
        <div className="overview-risk-legend" aria-label="Risk score color legend">
          {RISK_LEGEND.map((item) => (
            <span className="overview-legend-item" key={item.label}>
              <i style={{ background: item.color }} />
              <span><strong>{item.label}</strong> {item.range}</span>
            </span>
          ))}
          {trip && <span className="overview-legend-item"><i style={{ background: UNKNOWN_ROUTE_COLOR }} /><span>Gray dashed: insufficient information</span></span>}
          <span className="overview-area-legend"><i />Shaded circles show approximate data areas</span>
        </div>
      </article>

      {location ? <article className="card overview-conditions-card">
        <div className="overview-panel-head conditions-head">
          <div>
            <span>{contextLabel}</span>
            <h2>Current conditions</h2>
          </div>
        </div>
        {weather && <div className="overview-weather-now">
          <div className="overview-weather-icon"><Icon name="weather" /></div>
          <div>
            <span>Weather now</span>
            <strong>{weather.value}</strong>
            <p>{weather.detail}</p>
          </div>
        </div>}
        <div className="overview-useful-conditions">
          {usefulConditions.map((condition) => <div className="overview-useful-condition" data-tone={condition.tone} key={condition.label}>
            <div className={`icon-badge ${condition.tone}`}><Icon name={condition.icon} /></div>
            <div><span>{condition.label === "School status" ? "Nearby university status" : condition.label}</span><strong>{condition.value}</strong><p>{condition.detail}</p></div>
          </div>)}
        </div>
        {announcement && <div className="overview-announcement-preview">
          <span>Latest announcement</span>
          <strong>{announcement.title}</strong>
          <p>{announcement.isMock ? "Demo notice" : announcement.label}. {announcement.date ? `${announcement.date} at ` : ""}{announcement.time}</p>
        </div>}
        <p className="overview-context-note">Updated {location.updated}. Open Conditions for hazards and road details.</p>
        <button className="overview-conditions-link" type="button" onClick={onViewConditions}>View condition details</button>
      </article> : <article className="card overview-conditions-card overview-conditions-empty">
        <div>
          <span>Route conditions</span>
          <h2>Limited information</h2>
          <p>No nearby SafeGo data is available for this route. Gray map sections are not rated as safe.</p>
        </div>
        <button className="overview-conditions-link" type="button" onClick={onOpenMap}>Review the map</button>
      </article>}
    </div>
  );
}
