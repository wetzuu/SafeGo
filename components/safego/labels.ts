export function displayFactorName(name: string) {
  if (name === "School status") return "Nearby university status";
  if (name === "Official advisories") return "Official announcements";
  return name;
}

export function shortPlaceName(label: string) {
  return label.split(",")[0];
}

export function riskLevelLabel(riskName: string) {
  return riskName.replace(" RISK", "");
}
