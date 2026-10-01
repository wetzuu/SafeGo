import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SafeGo",
    short_name: "SafeGo",
    description: "Check weather, flooding, road conditions, and official updates before you travel.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f5f5",
    theme_color: "#1d4ed8",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
