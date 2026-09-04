import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SafeGo | Area travel risk information",
  description:
    "Public travel risk information for areas affected by severe weather.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
