# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, Cursor, etc.) working in this repository.
Humans should start with [README.md](README.md). Design decisions are in
[ASSUMPTIONS.md](ASSUMPTIONS.md), and how AI was used so far is in [AI_USAGE.md](AI_USAGE.md).

## What this is

An online, first-come-first-served school admission system. A parent applies for a seat in a
class, the seat is **held** for `HOLD_DURATION_SECONDS`, and paying the fee **confirms** it.
Unpaid holds expire and the seat returns to the pool.

There is no login. The UI has two sides, switched with the button at the top right:

| Side | URL | Can do |
|---|---|---|
| Parents | `/#/` Class List (default), `/#/request` Admission Request, `/#/my-admission` My Admission (left sidebar) | Enter the 17-digit birth registration number, apply, pay, cancel, see own applications |
| Admin | `/#/admin` | Create classes (class + shift dropdowns), see one box per class, open a class to see its students, remove a student, delete the class |

The switch only changes the UI. The API is not protected, so don't describe the admin view as secure.

## Layout

```
backend/                          .NET 8 minimal API + EF Core + PostgreSQL 16
  src/SchoolAdmission.Api/
    Endpoints/AdmissionEndpoints.cs   all HTTP routes
    Services/AdmissionService.cs      all seat logic (holds, confirm, cancel, counts)
    Services/HoldExpirySweeper.cs     background job that rewrites expired holds
    Data/                             DbContext, startup migration, EF migrations
    Errors/                           ApiException + global handler -> { error, message }
  tests/SchoolAdmission.Tests/      xUnit against real PostgreSQL
frontend/                         React 19 + Vite + TypeScript + Tailwind v4 / shadcn (react-aria)
  src/App.tsx                       header + view switch, renders a page
  src/pages/                        parent-page.tsx, admin-page.tsx
  src/components/parent/            parent sidebar
  src/components/admin/             class boxes (class-grid), class detail (students, remove, delete)
  src/components/admission/         class list, create class, application panel, my applications, student ID bar
  src/components/ui/confirm-dialog.tsx  the pop-up used for every destructive action
  src/components/ui/                shadcn primitives (react-aria based: Button uses onPress / isDisabled)
  src/hooks/                        use-polling (live data), use-view (hash routes: useRoute, navigate)
  src/lib/                          api client + error messages, hold helpers, student ID
docker-compose.yml                db, backend, frontend; profiles `multi` and `test`
```

## Commands

Everything runs in Docker; no local SDK is needed.

```bash
docker compose up --build                                        # UI :5173, API :8080
docker compose --profile test run --rm --build backend-tests     # backend tests
docker compose --profile test run --rm --build frontend-tests    # frontend tests
```

With local toolchains:

```bash
cd backend && dotnet test               # TEST_DATABASE_URL, or Testcontainers (needs Docker)
cd frontend && pnpm install
pnpm test        # Vitest
pnpm typecheck   # tsc -b (plain `tsc --noEmit` checks nothing here; see AI_USAGE.md)
pnpm lint        # ESLint incl. react-hooks rules
pnpm build
```

Before saying a change is done, run the tests, typecheck and lint for every side you touched.

## Rules that must not break

1. **Seat safety lives in PostgreSQL, not in C#.** Creating a hold locks the class row
   (`SELECT … FOR UPDATE`), then counts and inserts in one transaction. Don't add C# locks,
   semaphores, caches or in-memory counters. Two backend processes share one database
   (`--profile multi`) and must never overbook. (`Services/LoadProtection.cs` is load shedding,
   429/503 under a flood. It is not seat logic, so this rule doesn't apply to it. Keep it.)
2. **Seat counts are computed from hold rows.** Don't add a stored counter column.
3. **A `HELD` hold past `expires_at` is expired everywhere**, even before the sweeper rewrites it.
   Every query that counts or acts on holds must apply that rule.
4. **Confirm is idempotent** (repeat → `200`, counted once). Confirm, cancel and admin remove are
   conditional `UPDATE`s on a live row (`HELD` and not expired; cancel and remove also accept
   `CONFIRMED`), so racing requests can't both win.
5. **Expected errors are 4xx, never 500.** Throw `ApiException` with an UPPER_SNAKE code. The body
   is always `{ "error": CODE, "message": text }`. When you add a code, add plain-language text for
   it in `MESSAGES` in `frontend/src/lib/api.ts`.
6. **Destructive admin actions ask first** through `ConfirmDialog`, never `window.confirm`.
   Removing a student sets status `REMOVED` (not `CANCELLED`); deleting a class cascades to its holds.
7. **One student, one class.** At most one `HELD`/`CONFIRMED` hold per student across all classes,
   backed by the `ux_holds_one_active_per_student` partial unique index. Keep the plain
   `ix_holds_student_id` index too; both are named explicitly because EF merges same-column indexes.
8. **Student identity** is the `X-Student-Id` header: exactly 17 digits.
9. Schema changes need an EF migration in `Data/Migrations` (run at startup under an advisory lock).

## Conventions

- **Backend:** primary constructors, records for DTOs (`Contracts/Dtos.cs`), async with
  `CancellationToken`, UTC timestamps. Tests use real PostgreSQL. Don't switch to the in-memory
  provider, because it cannot test locking.
- **Frontend:** match the existing style (no semicolons, double quotes, about 100-column lines). Don't
  reformat files you didn't change; Prettier's 80-column config is not applied to the codebase.
  Use the `@/` import alias, `cn` from the `cn` package, and lucide icons. Live data goes through
  `usePolling`, not ad-hoc `setInterval`. User-facing errors go through `toApiError(e).message`
  and `useNotify()`.
- The parent-side action labels are Bangla (`আবেদন করুন`, `ভর্তি ফি দিন`, `বাতিল`) in both
  languages. Keep them; tests query by those names.
- All other UI text comes from `src/lib/i18n.tsx` (`useT()` in components, `messages()` elsewhere).
  Add every new string in both `en` and `bn`. The app defaults to Bangla; tests run in English
  (`src/test/setup.ts`).
- Tests: Vitest + Testing Library. Mock the network with `mockFetch` / `json` from
  `src/test/fetch-mock.ts`. Query by role or label, not by class name.
- Commits: Conventional Commits (`feat(frontend): …`, `test(backend): …`, `docs: …`).

## Docs to keep in sync

If you change behaviour, update the matching doc in the same change: the API table and test counts
in `README.md`, decisions in `ASSUMPTIONS.md`, and anything an AI got wrong (and how it was caught)
in `AI_USAGE.md`.
