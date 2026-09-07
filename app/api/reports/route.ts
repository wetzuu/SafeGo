import { getRepository } from "@/lib/data/repository";
import { parseCommunityReportInput } from "@/lib/reports/report-input";
import { NextResponse } from "next/server";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REPORTS_PER_WINDOW = 5;
const submissions = new Map<string, number[]>();

function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "local";
}

function acceptsSubmission(key: string, now = Date.now()) {
  const recent = (submissions.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_REPORTS_PER_WINDOW) {
    submissions.set(key, recent);
    return false;
  }
  submissions.set(key, [...recent, now]);
  return true;
}

export async function POST(request: Request) {
  const reportingEnabled =
    process.env.SAFEGO_COMMUNITY_REPORTS_ENABLED === "true"
    && process.env.SAFEGO_MODERATION_ENABLED === "true";
  if (!reportingEnabled) {
    return NextResponse.json(
      { error: { code: "REPORTING_DISABLED", message: "Community submissions are disabled until moderation is available." } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Send the report as valid JSON." } },
      { status: 400 },
    );
  }

  const parsed = parseCommunityReportInput(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: { code: "INVALID_REPORT", message: parsed.message } },
      { status: 400 },
    );
  }

  if (!acceptsSubmission(clientKey(request))) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many reports were submitted. Try again in a few minutes." } },
      { status: 429, headers: { "Retry-After": "600", "Cache-Control": "no-store" } },
    );
  }

  try {
    const { backend, repository } = getRepository();
    const report = await repository.submitCommunityReport(parsed.data);
    if (!report) {
      return NextResponse.json(
        { error: { code: "LOCATION_NOT_FOUND", message: "That SafeGo coverage location no longer exists." } },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        data: report,
        meta: { backend, generatedAt: new Date().toISOString() },
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("SafeGo report submission failed", error);
    return NextResponse.json(
      { error: { code: "REPORT_SERVICE_UNAVAILABLE", message: "The report could not be saved right now. Please try again." } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
