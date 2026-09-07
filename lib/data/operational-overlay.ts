import type { FloodRoadFeedItem, OfficialAdvisoryFeedItem } from "../providers/operational-feeds.ts";
import { analyzeRisk } from "../safego/risk-model.ts";
import type { RiskFactor, RiskKey, SafeGoLocation } from "../safego/types.ts";

function scoreBand(score: number): { key: RiskKey; label: string } {
  if (score <= 29) return { key: "low", label: "Low" };
  if (score <= 59) return { key: "mod", label: "Moderate" };
  if (score <= 79) return { key: "high", label: "High" };
  return { key: "crit", label: "Critical" };
}

function displayTime(isoTime: string) {
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(isoTime));
}

function replaceFactor(location: SafeGoLocation, factor: RiskFactor) {
  const factors = location.factors.map((current) => current.name === factor.name ? factor : current);
  return {
    ...location,
    factors,
    risk: analyzeRisk(factors, location.riskSummary, location.riskStatus),
  };
}

export function applyOfficialAdvisories(location: SafeGoLocation, allItems: OfficialAdvisoryFeedItem[]) {
  const items = allItems.filter((item) => item.locationIds.includes(location.id));
  const highest = Math.max(0, ...items.map((item) => item.severityScore));
  const band = scoreBand(highest);
  const updated = replaceFactor(location, {
    name: "Official advisories",
    score: highest,
    pill: band.key,
    pillText: band.label,
    description: items.length
      ? `${items.length} active configured official ${items.length === 1 ? "advisory" : "advisories"}; highest normalized severity ${highest}/100.`
      : "No active advisory for this canonical location in the configured official feed.",
    icon: "alert",
    tone: highest >= 60 ? "icon-alert" : highest >= 30 ? "icon-mod" : "icon-ok",
  });
  return {
    ...updated,
    advisories: items.map((item) => ({
      source: item.sourceKind,
      label: item.sourceName,
      title: item.title,
      description: item.description,
      time: displayTime(item.issuedAt),
      sourceUrl: item.sourceUrl,
    })),
  };
}

export function applyFloodRoadObservations(location: SafeGoLocation, allItems: FloodRoadFeedItem[]) {
  const items = allItems.filter((item) => item.locationIds.includes(location.id));
  const highest = Math.max(0, ...items.map((item) => item.severityScore));
  const band = scoreBand(highest);
  const updated = replaceFactor(location, {
    name: "Flood / roads",
    score: highest,
    pill: band.key,
    pillText: band.label,
    description: items.length
      ? `${items.length} active verified-source ${items.length === 1 ? "observation" : "observations"}; highest normalized severity ${highest}/100.`
      : "No active observation for this canonical location in the configured flood/road feed.",
    icon: "flood",
    tone: highest >= 60 ? "icon-alert" : highest >= 30 ? "icon-mod" : "icon-ok",
  });
  const hazards = items.map((item) => ({
    title: item.title,
    meta: `${item.sourceName} · ${displayTime(item.observedAt)} · ${item.description}`,
    tone: item.severityScore >= 60 ? "icon-alert" as const : item.severityScore >= 30 ? "icon-mod" as const : "icon-ok" as const,
    sourceUrl: item.sourceUrl,
  }));
  return {
    ...updated,
    hazards,
    floods: items.filter((item) => item.kind === "flood").map((item) => ({
      title: item.title,
      meta: `${item.sourceName} · ${displayTime(item.observedAt)} · ${item.description}`,
      tone: item.severityScore >= 60 ? "icon-alert" as const : item.severityScore >= 30 ? "icon-mod" as const : "icon-ok" as const,
      sourceUrl: item.sourceUrl,
    })),
  };
}
