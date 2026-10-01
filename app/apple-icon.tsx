import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// The SafeGo mark (see app/icon.svg) on a full-bleed square; iOS rounds the corners itself.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1d4ed8" }}>
        <svg width="150" height="150" viewBox="0 0 32 32">
          <path d="M21 9h-6.500a3.500 3.500 0 0 0 0 7h3a3.500 3.500 0 0 1 0 7H11" fill="none" stroke="#fff" strokeWidth="3.200" strokeLinecap="round" />
          <circle cx="21.500" cy="9" r="3" fill="#fff" />
          <circle cx="10.500" cy="23" r="3" fill="#fff" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
