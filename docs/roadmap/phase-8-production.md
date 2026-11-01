# Phase 8: Accounts and production hardening

**Goal:** what is public is safe to run for real users, and what is not ready is clearly labelled.
**Depends on:** Phase 1. **Size:** large.

## The problem

- Without `DATABASE_URL`, users and sessions are in memory (`AccountService`) and vanish on restart.
- No email verification, password recovery or account deletion.
- `util/RateLimiter` is in-memory and per-process.
- Public provider usage policies (Nominatim, OSRM, tiles) are not production-suitable (see Phase 6).

## Decision (open, ask before starting)

- **A. Accounts as a labelled preview (recommended until there are real users):** accounts only in
  database mode, a visible "preview" label, no public sign-up on deployments.
- **B. Finish accounts:** verification, recovery, deletion, retention policy, durable sessions.

## Tasks (both options)

1. Refuse account features when not in database mode instead of silently using memory.
2. Shared durable rate limiter (PostgreSQL table or Redis) for login, registration and future reports.
3. Security headers and CORS review in Next.js and Spring; session cookie flags (HttpOnly, Secure, SameSite).
4. Data Privacy Act (RA 10173) note: what is stored, for how long, how to delete; link it in the UI.
5. Dependency audit (`npm audit`, Gradle dependency check) and Dependabot review.

## Tasks (option B only)

Email verification, password reset with expiring tokens, account deletion, session listing/revoke.

## Definition of done

- No account data is ever held only in memory on a deployment.
- Rate limits survive restarts and multiple instances.
- Privacy note published; `npm run check:all` passes.

## Follow-ups

## Log
