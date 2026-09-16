import assert from "node:assert/strict";
import test from "node:test";
import { MockSafeGoRepository } from "../lib/data/mock-repository.ts";
import { isAreaDashboardLocation } from "../lib/trips/pilot.ts";

test("mock repository exposes every preset location", async () => {
  const repository = new MockSafeGoRepository();
  const locations = await repository.listLocations();

  assert.equal(locations.length, 7);
  assert.ok(locations.every((location) => location.coordinates.length === 2));
  assert.ok(locations.every((location) => location.risk.percentage >= 0));
});

test("mock repository returns calculated risk details", async () => {
  const repository = new MockSafeGoRepository();
  const result = await repository.getLocationRisk("espana");

  assert.ok(result);
  assert.equal(result.location.id, "espana");
  assert.equal(result.factors.length, 5);
  assert.equal(result.assessment.modelVersion, "1.0.0");
  assert.equal(result.assessment.percentage, 54);
  assert.ok(result.advisories.every((advisory) =>
    advisory.isMock && advisory.date === "Sep 14, 2026",
  ));
  assert.ok(result.advisories.some((advisory) =>
    advisory.label === "PAGASA" && advisory.isMock,
  ));
});

test("Pasig exposes area-specific nearby university statuses", async () => {
  const repository = new MockSafeGoRepository();
  const locations = await repository.listDashboardLocations();
  const pasig = locations.find((location) => location.id === "ortigas-pasig");

  assert.ok(pasig);
  assert.equal(pasig.city, "Pasig");
  assert.equal(pasig.universities.length, 2);
  assert.ok(pasig.universities.every((university) => university.isMock));
  assert.ok(pasig.universities.some((university) => university.status === "suspended"));
  assert.ok(pasig.universities.every((university) =>
    university.campus?.toLocaleLowerCase().includes("pasig")
      || university.campus?.toLocaleLowerCase().includes("ortigas"),
  ));
});

test("every supported dashboard area has university statuses and only verified posts are linked", async () => {
  const repository = new MockSafeGoRepository();
  const areas = (await repository.listDashboardLocations()).filter(isAreaDashboardLocation);

  assert.equal(areas.length, 5);
  assert.ok(areas.every((area) => area.universities.length > 0));
  const universities = areas.flatMap((area) => area.universities);
  const linked = universities.filter((university) => university.announcementUrl);
  assert.equal(linked.length, 1);
  assert.ok(linked.every((university) =>
    university.announcementVerified
      && !university.isMock
      && university.announcementUrl?.startsWith("https://www.facebook.com/"),
  ));
});

test("mock repository returns null for an unknown location", async () => {
  const repository = new MockSafeGoRepository();
  assert.equal(await repository.getLocationRisk("not-a-location"), null);
});

test("mock repository stores new reports as unverified", async () => {
  const repository = new MockSafeGoRepository();
  const report = await repository.submitCommunityReport({
    locationId: "mapua-makati",
    reportType: "Road Hazard",
    locationText: "Mapúa Makati gate",
    description: "A fallen branch is blocking one lane.",
  });

  assert.ok(report);
  assert.equal(report.status, "unverified");
  const location = (await repository.listDashboardLocations())
    .find((candidate) => candidate.id === "mapua-makati");
  assert.equal(location?.reports[0].title, "A fallen branch is blocking one lane.");
});
