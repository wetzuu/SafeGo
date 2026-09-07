"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { riskGradient } from "@/lib/safego/risk-model";
import type { FactorName, SafeGoLocation } from "@/lib/safego/types";
import type { TripAnalysis } from "@/lib/trips/types";

const FEATURED_FACTORS: FactorName[] = [
  "Weather",
  "Flood / roads",
  "Official advisories",
];

const RISK_LEGEND = [
  { label: "Low", range: "0–29", color: "#15803d" },
  { label: "Moderate", range: "30–59", color: "#ca8a04" },
  { label: "High", range: "60–79", color: "#ea580c" },
  { label: "Critical", range: "80–100", color: "#dc2626" },
];

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
  location: SafeGoLocation;
  trip?: TripAnalysis | null;
}) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initializeMap() {
      if (!mapElementRef.current) return;

      try {
        const L = await import("leaflet");
        if (cancelled || !mapElementRef.current) return;

        const map = L.map(mapElementRef.current, {
          zoomControl: true,
          minZoom: 10,
          maxZoom: 19,
          scrollWheelZoom: false,
        });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        if (trip) {
          trip.segments.forEach((segment) => {
            L.polyline(segment.coordinates, {
              color: riskGradient(segment.riskScore),
              weight: 7,
              opacity: 0.92,
              lineCap: "round",
            })
              .bindTooltip(
                makeTooltip(
                  segment.basisLocationName,
                  `${segment.riskScore}/100 · approximate risk section`,
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
        } else {
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
                `${location.risk.percentage}/100 · ${location.risk.name}`,
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
    <div className="overview-map-frame" role="group" aria-label={trip ? "Compact interactive route risk map" : `Compact interactive map of ${location.name}`}>
      <div className="overview-live-map" ref={mapElementRef} />
      {mapError && <div className="overview-map-error">The live map could not load. Check your connection or open the full Map page later.</div>}
      <span className="overview-map-badge">Live map · approximate coverage</span>
    </div>
  );
}

export function OverviewContextPanel({
  location,
  trip,
  onOpenMap,
  onViewConditions,
}: {
  location: SafeGoLocation;
  trip?: TripAnalysis | null;
  onOpenMap: () => void;
  onViewConditions: () => void;
}) {
  const contextLabel = trip ? "Highest-risk coverage point" : "Selected location";

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
        </div>
      </article>

      <article className="card overview-conditions-card">
        <div className="overview-panel-head conditions-head">
          <div>
            <span>{contextLabel}</span>
            <h2>Conditions snapshot</h2>
          </div>
          <strong className="overview-total-score" style={{ background: riskGradient(location.risk.percentage) }}>{location.risk.percentage}</strong>
        </div>
        <div className="overview-condition-location">
          <strong>{location.name}</strong>
          <span>{location.city} · updated {location.updated}</span>
        </div>
        <div className="overview-factor-list">
          {FEATURED_FACTORS.map((name) => {
            const factor = location.factors.find((candidate) => candidate.name === name);
            if (!factor) return null;
            return (
              <div className="overview-factor" key={name}>
                <div><span>{name}</span><strong style={{ color: riskGradient(factor.score) }}>{factor.score}/100</strong></div>
                <div className="overview-factor-track"><span style={{ width: `${factor.score}%`, background: riskGradient(factor.score) }} /></div>
              </div>
            );
          })}
        </div>
        <div className="overview-signal-counts">
          <span><strong>{location.hazards.length}</strong> hazards</span>
          <span><strong>{location.advisories.length}</strong> advisories</span>
        </div>
        <p className="overview-context-note">Map colors show calculated overall travel risk. Open the full map to compare weather, road, advisory, school, and community layers.</p>
        <button className="overview-conditions-link" type="button" onClick={onViewConditions}>View condition details</button>
      </article>
    </div>
  );
}
