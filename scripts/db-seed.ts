import { loadEnvConfig } from "@next/env";
import postgres from "postgres";
import { LOCATIONS } from "../lib/safego/locations.ts";

loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  throw new Error("DATABASE_URL is required. Copy .env.example to .env.local first.");
}

const sql = postgres(connectionString, {
  max: 1,
  ...(process.env.DATABASE_SSL === "true" ? { ssl: "require" } : {}),
});

try {
  await sql.begin(async (transaction) => {
    const [source] = await transaction<{ id: string }[]>`
      INSERT INTO data_sources (key, name, kind, status, last_success_at, updated_at)
      VALUES ('prototype-mock', 'SafeGo prototype dataset', 'mock', 'mock', now(), now())
      ON CONFLICT (key) DO UPDATE SET
        name = EXCLUDED.name,
        kind = EXCLUDED.kind,
        status = EXCLUDED.status,
        last_success_at = EXCLUDED.last_success_at,
        error_message = NULL,
        updated_at = now()
      RETURNING id
    `;

    for (const location of LOCATIONS) {
      const [latitude, longitude] = location.coordinates;
      await transaction`
        INSERT INTO locations (
          id, name, city, aliases, position, is_approximate, updated_label,
          display_payload, updated_at
        ) VALUES (
          ${location.id},
          ${location.name},
          ${location.city},
          ${location.aliases},
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
          true,
          ${location.updated},
          ${transaction.json(JSON.parse(JSON.stringify(location)))},
          now()
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          city = EXCLUDED.city,
          aliases = EXCLUDED.aliases,
          position = EXCLUDED.position,
          is_approximate = EXCLUDED.is_approximate,
          updated_label = EXCLUDED.updated_label,
          display_payload = EXCLUDED.display_payload,
          updated_at = now()
      `;

      await transaction`DELETE FROM observations WHERE location_id = ${location.id}`;
      await transaction`DELETE FROM advisories WHERE location_id = ${location.id}`;
      await transaction`
        DELETE FROM community_reports
        WHERE location_id = ${location.id} AND submission_source = 'seed'
      `;
      await transaction`DELETE FROM risk_assessments WHERE location_id = ${location.id}`;

      for (const factor of location.factors) {
        await transaction`
          INSERT INTO observations (
            location_id, source_id, factor_name, normalized_score, confidence,
            verification_status, payload, observed_at
          ) VALUES (
            ${location.id},
            ${source.id},
            ${factor.name},
            ${factor.score},
            0.5,
            'unverified',
            ${transaction.json(JSON.parse(JSON.stringify(factor)))},
            now()
          )
        `;
      }

      for (const advisory of location.advisories) {
        await transaction`
          INSERT INTO advisories (
            location_id, source_id, source_kind, title, payload, issued_at
          ) VALUES (
            ${location.id},
            ${source.id},
            ${advisory.source},
            ${advisory.title},
            ${transaction.json(JSON.parse(JSON.stringify(advisory)))},
            now()
          )
        `;
      }

      for (const report of location.reports) {
        await transaction`
          INSERT INTO community_reports (
            location_id, report_type, title, verification_status, payload,
            position, reported_at, submission_source
          ) VALUES (
            ${location.id},
            ${report.type},
            ${report.title},
            ${report.status},
            ${transaction.json(JSON.parse(JSON.stringify(report)))},
            ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
            now(),
            'seed'
          )
        `;
      }

      await transaction`
        INSERT INTO risk_assessments (
          location_id, overall_score, raw_score, risk_key, model_version,
          factors, assessment, calculated_at
        ) VALUES (
          ${location.id},
          ${location.risk.percentage},
          ${location.risk.rawScore},
          ${location.risk.key},
          ${location.risk.modelVersion},
          ${transaction.json(JSON.parse(JSON.stringify(location.factors)))},
          ${transaction.json(JSON.parse(JSON.stringify(location.risk)))},
          now()
        )
      `;
    }
  });

  console.log(`Seeded ${LOCATIONS.length} SafeGo locations.`);
} finally {
  await sql.end();
}
