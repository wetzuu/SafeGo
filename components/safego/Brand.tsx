export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <span className={`glyph${compact ? " sm" : ""}`}>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2 3 6v6c0 5 3.8 8.7 9 10 5.2-1.3 9-5 9-10V6l-9-4Z" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round"/>
          <path d="m8.5 12.2 2.4 2.4 4.6-5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
      <span className="word">Safe<span>Go</span></span>
    </>
  );
}
