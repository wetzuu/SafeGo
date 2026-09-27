# SafeGo database operations

SafeGo uses PostgreSQL with PostGIS. The database is optional for the built-in
demo, but required for staging and production.

## Local setup with Docker

1. Install Docker Desktop and make sure it is running.
2. Copy `.env.example` to `.env.local`.
3. Set these local-only values in `.env.local`:

   ```text
   SAFEGO_DATA_MODE=database
   SAFEGO_DB_PORT=5432
   DATABASE_URL=postgresql://safego:safego_local@localhost:5432/safego
   DATABASE_SSL=false
   ```

4. Start and prepare the database:

   ```bash
   docker compose --env-file .env.local up -d database
   npm run db:setup
   npm run db:verify
   npm run dev
   ```

The database is bound to `127.0.0.1` and stored in the named Docker volume
`safego_postgres_data`. The local password is for development only.
If port 5432 is already occupied, set `SAFEGO_DB_PORT=5433`, update the port in
`DATABASE_URL`, and keep using the `--env-file .env.local` command above.

## Backups

`npm run db:backup` creates a custom-format backup in `backups/`. It uses local
PostgreSQL client tools when available and otherwise uses the local Docker
database service. Set `SAFEGO_BACKUP_DIR` to store it elsewhere. The `backups/`
directory is ignored by Git.

With Docker and the local service, a backup can also be created without local
client tools:

```bash
docker compose exec -T database pg_dump -U safego -d safego --format=custom --no-owner --no-privileges > safego.dump
```

Test restores against a disposable database before relying on a backup. Never
restore a development backup over staging or production.

## Staging and production

- Use separate databases and credentials for development, staging, and production.
- Require encrypted connections by setting `DATABASE_SSL=true` outside local development.
- Store `DATABASE_URL` in the deployment secret manager, never in Git.
- Give the running app only the permissions it needs. Use a separate migration role where available.
- Enable automated provider backups and point-in-time recovery.
- Run `npm run db:migrate` during a controlled deployment step, then run `npm run db:verify`.
- Seed only development or an explicitly approved staging environment. Do not run `db:seed` automatically in production.
- Alert on failed connections, storage growth, and backup failures.

## Release check

For a database-backed release:

```bash
npm run db:migrate
npm run db:verify
npm run check
```

Then start SafeGo with `SAFEGO_DATA_MODE=database`. In this mode a missing or
unavailable database stops the Java API instead of silently showing demo data.

## Account and saved-place persistence

Migration `0004_accounts.sql` stores users, BCrypt password hashes, saved-place
labels, and hashed sessions. Migration `0005_saved_place_coordinates.sql` adds
the canonical label, PostGIS point, source, preset match, and approximation flag
for Home and School. Run `npm run db:migrate` after pulling these migrations.

Saved places are resolved only when the user presses Save. Preset locations are
matched locally; other Philippine locations use the configured server-side
geocoder. Later route checks send the stored coordinates to the Java API, so a
saved place does not need to be geocoded again after an API restart.
