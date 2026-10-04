import type { UniversityAlert } from "@/lib/safego/university-alerts";
import { primarySourceFor } from "@/lib/safego/university-sources";

/**
 * Prominent cards for active nearby-university announcements. Renders nothing at all when there are
 * none: no placeholder and no reserved space.
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
    <section className="mb-3 space-y-2" aria-label="University announcements near you">
      {shown.map(({ university, area }) => {
        const suspended = university.status === "suspended";
        const officialSource = primarySourceFor(university);
        return (
          <article
            key={university.id}
            // Fixed strong colours with white text: the same high contrast in light and dark themes.
            className={`relative rounded-box p-3 pr-10 text-white shadow-[var(--shadow-card)] ${suspended ? "bg-[#b42318]" : "bg-[#1d4ed8]"}`}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-bold">
              <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 10.5 12 5l8 5.5M6 10v8h12v-8" />
              </svg>
              <span>{suspended ? "Classes suspended" : "Classes moved online"}</span>
            </div>
            <h4 className="mt-1 text-sm font-bold leading-snug">{university.name}</h4>
            <p className="mt-0.5 text-xs leading-snug text-white/90">{university.statusLabel}. {university.announcement}</p>
            <p className="mt-1.5 text-[11px] text-white/85">
              <span className="font-semibold">Affects:</span> {university.campus && !area.includes(university.campus) ? `${university.campus}, near ${area}` : `the campus near ${area}`}
              <span className="mx-1">·</span>
              <span className="font-semibold">Posted:</span> {university.date}, {university.time}
            </p>
            {university.announcementVerified && university.announcementUrl && (
              <a className="mt-1.5 inline-block text-xs font-bold underline underline-offset-2" href={university.announcementUrl} target="_blank" rel="noreferrer">
                Read the official post
              </a>
            )}
            {!university.announcementUrl && officialSource && (
              <a className="mt-1.5 inline-block text-xs font-bold underline underline-offset-2" href={officialSource.url} target="_blank" rel="noreferrer">
                Check {officialSource.name}
              </a>
            )}
            {onDismiss && (
              <button
                type="button"
                className="absolute right-1 top-1 size-9 rounded-full text-lg leading-none hover:bg-white/15"
                aria-label={`Dismiss the ${university.name} announcement`}
                onClick={() => onDismiss(university.id)}
              >
                ×
              </button>
            )}
          </article>
        );
      })}
      {hidden > 0 && onViewAll && (
        <button type="button" className="min-h-11 w-full rounded-box border border-hairline text-xs font-bold text-brand-ink hover:bg-surface" onClick={onViewAll}>
          View all {alerts.length} university announcements
        </button>
      )}
    </section>
  );
}
