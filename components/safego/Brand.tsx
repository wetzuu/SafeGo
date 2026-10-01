/** The SafeGo mark: a route between two points, drawn as an S. Same shape as app/icon.svg. */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <span className={`glyph${compact ? " sm" : ""}`}>
        <svg viewBox="5 3 22 26" fill="none" aria-hidden="true">
          <path d="M21 9h-6.500a3.500 3.500 0 0 0 0 7h3a3.500 3.500 0 0 1 0 7H11" stroke="#fff" strokeWidth="3.200" strokeLinecap="round" />
          <circle cx="21.500" cy="9" r="3" fill="#fff" />
          <circle cx="10.500" cy="23" r="3" fill="#fff" />
        </svg>
      </span>
      <span className="word">Safe<span>Go</span></span>
    </>
  );
}
