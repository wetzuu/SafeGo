# SafeGo database operations

SafeGo uses PostgreSQL with PostGIS. The database is optional for the built-in
demo, but required for staging and production.

## Local setup with Docker

1. Install Docker Desktop and make sure it is running.
2. Copy `.env.example` to `.env.local`.
3. Set these local-only values in `.env.local`:

   ```text
   SAFEGO_DATA_MODE=database
   DATABASE_URL=postgresql://safego:safego_local@localhost:5432/safego
   DATABASE_SSL=false
   ```

4. Start and prepare the database:

   ```bash
   docker compose up -d database
   npm run db:setup
   npm run db:verify
   npm run dev
   ```

The database is bound to `127.0.0.1` and stored in the named Docker volume
`safego_postgres_data`. The local password is for development only.

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
