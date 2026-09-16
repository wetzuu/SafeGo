import type { UniversityStatus } from "@/lib/safego/types";
import { Icon } from "./Icon";

function uniqueUniversities(items: UniversityStatus[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export function NearbyUniversities({
  universities,
  routeMode = false,
}: {
  universities: UniversityStatus[];
  routeMode?: boolean;
}) {
  const items = uniqueUniversities(universities);
  if (!items.length) return null;

  const statusTone: Record<UniversityStatus["status"], string> = {
    open: "open",
    suspended: "suspended",
    online: "online",
    "no-update": "unknown",
  };

  return <section className="nearby-universities" aria-labelledby="nearby-universities-title">
    <div className="section-title"><div className="section-title-copy"><span className="section-title-icon"><Icon name="school" /></span><div><span>{routeMode ? "Near covered parts of this route" : "Within this SafeGo area"}</span><h2 id="nearby-universities-title">Nearby universities</h2></div></div><span className="university-count">{items.length} listed</span></div>
    <div className="university-list">{items.map((university) => <article className={`card university-row ${statusTone[university.status]}`} key={university.id}>
      <div className="university-heading"><div className="university-identity"><span className="university-icon"><Icon name="school" /></span><div><h3>{university.name}</h3>{university.campus && <p>{university.campus}</p>}</div></div><span className={`university-status ${statusTone[university.status]}`}><Icon name={university.status === "suspended" ? "alert" : university.status === "no-update" ? "clock" : "verified"} />{university.statusLabel}</span></div>
      <div className="university-alert"><span className="university-alert-icon"><Icon name={university.status === "suspended" ? "alert" : "reports"} /></span><p className="university-announcement">{university.announcement}</p></div>
      <div className="university-meta"><span className="university-source"><Icon name={university.isMock ? "reports" : "verified"} />{university.isMock ? "Demo status" : university.sourceName ?? "Official source"}</span><time><Icon name="clock" />{university.date} · {university.time}</time></div>
      {university.sourceUrl && <a className="university-source-link" href={university.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open ${university.sourceName ?? university.name} announcement source in a new tab`}><span><Icon name="verified" />{university.isMock ? "Open official channel" : "View official announcement"}</span><Icon name="external" /></a>}
    </article>)}</div>
    <p className="university-disclaimer"><Icon name="alert" />Only institutions linked to the selected area or covered route points are shown. Demo statuses open an official channel, not a fabricated post. Confirm the current status before traveling.</p>
  </section>;
}
