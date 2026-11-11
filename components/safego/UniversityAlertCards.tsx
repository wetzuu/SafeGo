import { relativeTime, schoolTicket } from "@/lib/safego/humanize-risk";
import type { UniversityAlert } from "@/lib/safego/university-alerts";
import { primarySourceFor } from "@/lib/safego/university-sources";
import { StoryBadge, TactileCard } from "./tactile";

/** "Nov 11, 2026" + "6:00 AM" (Manila time) as a timestamp, or null. */
function postedAt(date: string, time: string) {
  const parsed = Date.parse(`${date} ${time} GMT+0800`);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * "School watch": a ticket for each active class suspension or online shift near the selection.
 * Says who posted it and whether it is the school's own notice or a news report. Renders nothing at
 * all when there are none: no placeholder and no reserved space.
 */
export function UniversityAlertCards({
  alerts,
  limit = 2,
  onDismiss,
  onViewAll,
}: {
  alerts: UniversityAlert[];
  /** How many to show before offering "View all". */
  limit?: number;
  onDismiss?: (id: string) => void;
  onViewAll?: () => void;
}) {
  if (!alerts.length) return null;
  const shown = alerts.slice(0, limit);
  const hidden = alerts.length - shown.length;

  return (
    <section className="mb-4 space-y-3" aria-label="School watch">
      {shown.map(({ university, area }) => {
        const suspended = university.status === "suspended";
        const verified = Boolean(university.announcementVerified);
        const ticket = schoolTicket({ name: university.name, status: suspended ? "suspended" : "online", verified, sourceName: university.sourceName ?? null });
        const officialSource = primarySourceFor(university);
        const posted = postedAt(university.date, university.time);
        const where = university.campus && !area.includes(university.campus) ? `${university.campus}, near ${area}` : `the campus near ${area}`;
        return (
          <TactileCard as="article" tone="school" key={university.id} className="relative p-0">
            <div className="p-3.5 pr-11">
              <div className="flex flex-wrap items-center gap-1.5">
                <StoryBadge tone="school" icon={suspended ? "🎒" : "💻"} size="sm">{suspended ? "No classes on campus" : "Online classes"}</StoryBadge>
                <StoryBadge tone={verified ? "calm" : "rain"} icon={verified ? "✓" : "📰"} size="sm">{verified ? "Official post" : "News report"}</StoryBadge>
              </div>
              <h4 className="mt-2 font-display text-lg font-semibold leading-tight">{ticket.title}</h4>
              <p className="mt-1 text-[13px] leading-snug">{ticket.meaning}</p>
              {!verified && <p className="mt-1 text-[12px] font-semibold leading-snug">Not yet on the school&apos;s own page. Check it before you skip the trip.</p>}
            </div>

            <div className="ticket-notch border-t-2 border-dashed border-outline px-3.5 pb-3 pt-2.5 text-[12px] leading-snug">
              <p><span className="font-semibold">From:</span> {ticket.source}{posted ? <> <span className="font-semibold">· Posted</span> {relativeTime(posted)}</> : null}</p>
              <p className="mt-0.5"><span className="font-semibold">Affects:</span> {where}</p>
              <p className="mt-1 line-clamp-2 opacity-80">{university.announcement}</p>
              <div className="mt-1.5 flex flex-wrap gap-x-3">
                {verified && university.announcementUrl && (
                  <a className="font-bold underline underline-offset-2" href={university.announcementUrl} target="_blank" rel="noreferrer">Read the official post</a>
                )}
                {!university.isMock && !verified && university.announcementUrl && (
                  <a className="font-bold underline underline-offset-2" href={university.announcementUrl} target="_blank" rel="noreferrer">Read the report</a>
                )}
                {!university.isMock && !(verified && university.announcementUrl) && officialSource && (
                  <a className="font-bold underline underline-offset-2" href={officialSource.url} target="_blank" rel="noreferrer">Check {officialSource.name}</a>
                )}
              </div>
            </div>

            {onDismiss && (
              <button
                type="button"
                className="absolute right-1.5 top-1.5 size-9 rounded-full text-lg leading-none hover:bg-black/10"
                aria-label={`Dismiss the ${university.name} announcement`}
                onClick={() => onDismiss(university.id)}
              >
                ×
              </button>
            )}
          </TactileCard>
        );
      })}
      {hidden > 0 && onViewAll && (
        <button type="button" className="min-h-11 w-full rounded-box border border-hairline text-xs font-bold text-brand-ink hover:bg-surface" onClick={onViewAll}>
          View all {alerts.length} school notices
        </button>
      )}
    </section>
  );
}
