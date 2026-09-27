# SafeGo private staging runbook

This stack packages the Next.js frontend, Java 21 API and PostgreSQL/PostGIS
database. It is intended for a private staging host, not a public production
launch. The existing `compose.yaml` remains the simpler local database-only
setup.

## What is included

- `Dockerfile.web`: standalone Next.js server running as a non-root user.
- `Dockerfile.api`: Java 21 Spring Boot API running as a non-root user.
- `Dockerfile.tools`: controlled database migration, seed and verification jobs.
- `compose.staging.yaml`: private web, API and PostGIS network with health checks.
- `GET /api/health`: lightweight API readiness endpoint.

Only the web service is published to the host. It binds to `127.0.0.1:3000` by
default so a TLS reverse proxy or private tunnel can be placed in front of it.
PostgreSQL and the Java API are not published externally.

## Host requirements

- Docker Engine with the Compose plugin
- A private DNS name or access tunnel
- HTTPS termination through the hosting platform, Caddy, Nginx or equivalent
- Sufficient storage for the PostGIS volume and backups

## First deployment

1. Copy `.env.staging.example` to `.env.staging`.
2. Replace the database password with a long URL-safe random value.
3. Set `SAFEGO_ALLOWED_ORIGINS` to the exact HTTPS staging origin.
4. Set a real `SAFEGO_CONTACT_EMAIL` before using public Nominatim.
5. Validate and build:

   ```bash
   npm run staging:config
   npm run staging:build
   ```

6. Start only the database, then apply migrations:

   ```bash
   docker compose --env-file .env.staging -f compose.staging.yaml up -d database
   npm run staging:migrate
   ```

7. For an explicitly approved demonstration staging environment, load the
   labeled fixture dataset and verify it:

   ```bash
   npm run staging:seed
   npm run staging:verify
   ```

   Do not seed an operational production database.

8. Start the API and web application:

   ```bash
   npm run staging:up
   ```

9. Through the private HTTPS URL, verify `/`, `/api/health`,
   `/api/sources/status`, the saved example trip and the map.

## Updating

1. Back up the database with `npm run db:backup` or the hosting provider's
   managed backup system.
2. Pull the reviewed revision.
3. Run `npm run staging:build`.
4. Run `npm run staging:migrate` and `npm run staging:verify`.
5. Run `npm run staging:up` to recreate changed services.
6. Confirm the health endpoint and core demo flow before sharing the URL.

## Monitoring and logs

Use `docker compose --env-file .env.staging -f compose.staging.yaml ps` to inspect
health and `docker compose --env-file .env.staging -f compose.staging.yaml logs
--since=15m web api database` to review recent errors. Configure the hosting
platform to request `/api/health` and alert after repeated failures. Container
health is readiness only; it does not prove external data providers are fresh.
Use `/api/sources/status` for provider state.

## Security boundaries

- Never commit `.env.staging` or provider tokens.
- Keep port 5432 and the Java API private.
- Keep community submissions disabled until moderation exists.
- Restrict `SAFEGO_ALLOWED_ORIGINS` to the actual staging URL.
- Put authentication or a private access gateway in front of the staging URL.
- Rotate the database password if the environment file is exposed.
- Use `DATABASE_SSL=true` when the database is hosted outside the private
  Compose network.

## Still provider-specific

This repository does not create DNS, TLS certificates, a private access gateway,
alert destinations or cloud secrets. Those require choosing the actual staging
provider and authorizing access to its account.
