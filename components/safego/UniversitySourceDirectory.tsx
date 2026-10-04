import type { UniversityStatus } from "@/lib/safego/types";
import { sourcesForUniversities, type UniversitySourceKind } from "@/lib/safego/university-sources";
import { Icon } from "./Icon";

const KIND_LABEL: Record<UniversitySourceKind, string> = {
  university: "University",
  "student-government": "Student government",
  "student-services": "Student services",
};

export function UniversitySourceDirectory({ universities }: { universities: UniversityStatus[] }) {
  const sources = sourcesForUniversities(universities);
  if (!sources.length) return null;

  return (
    <details className="card card-pad mt-4">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-bold text-ink marker:content-none">
        <span className="flex items-center gap-2"><span className="shrink-0 [&_svg]:size-5"><Icon name="verified" /></span>Official university channels</span>
        <span className="text-xs font-semibold text-ink-soft">{sources.length} verified</span>
      </summary>
      <p className="mt-2 text-xs leading-relaxed text-ink-soft">
        SafeGo checks university administration first, then an institution-recognized central or supreme student government. If posts conflict, follow the university administration.
      </p>
      <div className="mt-3 divide-y divide-hairline border-y border-hairline">
        {sources.map((source) => (
          <a key={source.id} className="flex min-h-14 items-center justify-between gap-3 py-2.5 text-sm hover:text-brand-ink" href={source.url} target="_blank" rel="noreferrer">
            <span className="min-w-0">
              <strong className="block truncate">{source.name}</strong>
              <span className="block text-xs text-ink-soft">{KIND_LABEL[source.kind]} · {source.scope}</span>
            </span>
            <span className="shrink-0 text-ink-soft"><Icon name="external" /></span>
          </a>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">
        Facebook may require sign-in and does not provide SafeGo a dependable public live feed. Open the source and confirm the post date, affected campus, level, and validity period before traveling.
      </p>
    </details>
  );
}
