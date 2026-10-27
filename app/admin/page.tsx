import type { Metadata } from "next";
import { AdminReports } from "@/components/safego/AdminReports";

export const metadata: Metadata = { title: "SafeGo admin | Community reports" };

export default function AdminPage() {
  return <AdminReports />;
}
