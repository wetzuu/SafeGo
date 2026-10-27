import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AdminReports } from "@/components/safego/AdminReports";

export const metadata: Metadata = { title: "SafeGo admin | Community reports" };

export default async function AdminPage() {
  // Read the switches per request, not at build time. Moderation is hidden until both are on.
  await connection();
  const moderationEnabled =
    process.env.SAFEGO_COMMUNITY_REPORTS_ENABLED === "true"
    && process.env.SAFEGO_MODERATION_ENABLED === "true";
  if (!moderationEnabled) notFound();
  return <AdminReports />;
}
