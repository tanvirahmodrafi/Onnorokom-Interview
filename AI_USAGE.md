# AI usage

**Tool:** Claude Code (Anthropic, Claude Opus 5.5), used as a pair programmer in the terminal. I made
the design calls (status codes, cancel rules, parent / admin views, ports, build-arg vs runtime env)
when it asked, and reviewed and ran everything it produced.

## What it was used for

- Writing most of the backend (seat logic, sweeper, error handling) and frontend (API client,
  components, polling hooks), the Dockerfiles / compose file, and both test suites.
- Drafting these docs.

## Where the AI got it wrong, and how it was caught

1. **Seat-count query returned `500`.** The first version projected classes into a C# record and
   then filtered and sorted on it. EF Core can't translate that to SQL. A `curl` smoke test of every
   endpoint showed the `500`. The fix filters and sorts before projecting.
2. **Migration lock on a database that didn't exist yet.** Startup took a PostgreSQL advisory lock
   by connecting to the target database *before* EF created it. With a fresh test database it
   retried forever. It worked locally because the DB had been created by hand. Running the test suite
   inside Docker hung, and the container logs showed `3D000: database does not exist`. Now the
   database is created first.
3. **Typecheck that checked nothing.** The `typecheck` script ran `tsc --noEmit` on the root
   `tsconfig.json`, which only holds project references, so it passed on any code. The Docker build
   (`tsc -b`) failed on an unused import. The script now uses `tsc -b`.
4. **React effect anti-pattern.** The first polling hook reset state synchronously inside
   `useEffect`. ESLint's `react-hooks` rules flagged it. It was rewritten so results are tagged with the
   request that produced them, and stale data drops out without resets.
5. **Noisy logs for normal 4xx responses.** .NET 8's exception middleware logged every handled
   error (e.g. "class full") at error level. Seen in test output; those categories are now silenced, and
   real `500`s are still logged by the custom handler.
6. **Index silently dropped by a migration.** Adding the "one class per student" unique index on
   `student_id` made EF treat it as the same index as the existing plain `student_id` index, and
   the generated migration dropped the plain one (`/me/holds` relies on it). Reading the generated
   migration caught it; both indexes now have explicit names.
7. **Rate limiter that charged busy requests twice.** The first load-protection version chained
   the per-IP limiter and the concurrency limiter into one global limiter. ASP.NET first tries a
   non-waiting acquire and then a waiting one, so whenever the server was busy each request spent two
   per-IP permits: a 600/min budget let only 290 requests through. Re-running the load test on the
   fixed build caught it, because only 290 of an expected 550 requests succeeded. The per-IP limits are now plain
   buckets and the concurrency cap is a separate middleware. A regression test covers it.

## How the output was verified

- 60 backend tests against real PostgreSQL, including the 100-request concurrency test and a
  two-instance test. 46 frontend tests.
- A load test with bursts of 1000 to 5000 concurrent requests against an isolated stack: no `500`s, `/health`
  always answering, no class overbooked.
- `curl` with junk input (bad JSON, wrong types, huge numbers, bad IDs and headers) to confirm
  there are no `500`s.
- 100 parallel requests split across two backend containers (`--profile multi`): 10 × `201`, 90 × `409`.
- `docker compose down` → `up` to check persistence. A manual pass through the UI in Chrome:
  validation, apply, live countdown to `EXPIRED` with Pay disabled, pay, refresh, server down.
