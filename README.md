# School Admission System

Online, first-come-first-served school admission. A parent applies for a seat in a class (each
shift is its own class), the seat is **held** for a limited time, and paying the admission fee
**confirms** it. Unpaid holds expire on their own and the seat goes back to the pool.

- **Backend:** C# / .NET 8 minimal API, EF Core + PostgreSQL 16 (`backend/`)
- **Frontend:** React 19 + Vite + TypeScript + Tailwind / shadcn (`frontend/`)
- **Everything runs in Docker**: no local .NET SDK or Node needed.

## Two sides, no login

The brief has no authentication, so the header has a **Parents / Admin** switch at the top right,
next to a **language** button (Bangla by default, or English) and a **light / dark** button (it follows
the system theme until pressed):

- **Parents** (`http://localhost:5173/#/`, the default): a left sidebar with three screens.
  - **Class List** (`#/`): apply for a seat. "আবেদন করুন" opens a short form (student's name and
    contact number); submitting it holds the seat and takes you to Admission Request. A student can
    have one class only, so once they hold or have a seat, the other classes can't be applied for.
  - **Admission Request** (`#/request`): the held seat with its countdown; pay the fee or cancel.
    A confirmed admission can be cancelled here too (after a warning), which frees the seat.
  - **My Admission** (`#/my-admission`): every application and its status; tap one to open it.

  The student's birth registration number is entered at the top of each screen.
- **Admin** (`http://localhost:5173/#/admin`): create a class by picking *Class 1–10* and
  *Morning / Evening Shift* from two dropdowns, then see every class as a box (capacity, confirmed,
  held), sorted Class 1 → 10. Tap a box to see the held / confirmed / available totals and the
  students in it, remove a student, or delete the class (both ask for confirmation in a pop-up).

The switch only changes what the UI shows. The API itself is open to both.

## Run it

```bash
docker compose up --build
```

| What | URL |
|---|---|
| Frontend (UI) | http://localhost:5173 |
| Backend (API) | http://localhost:8080 |

The first start builds the images. It takes a few minutes. The backend waits for PostgreSQL and applies its
migrations by itself. Data is kept in the named volume `pgdata`, so it survives
`docker compose down` / `up`. Use `docker compose down -v` to wipe it.

Ports 5173, 8080 must be free on the host.

### Configuration (environment variables)

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `ConnectionStrings__Default` | backend | set in compose | PostgreSQL connection string |
| `HOLD_DURATION_SECONDS` | backend | `600` | How long a seat stays held before it expires |
| `FRONTEND_URL` | backend | `http://localhost:5173,http://127.0.0.1:5173` | Allowed CORS origin(s), comma-separated |
| `SWEEP_INTERVAL_SECONDS` | backend | `5` | How often expired holds are rewritten to `EXPIRED` |
| `RATE_LIMIT_PER_MINUTE` | backend | `600` | Requests per minute per client IP (applications not included); over it → `429`. `0` turns it off |
| `APPLY_RATE_LIMIT_PER_MINUTE` | backend | `30` | Applications (`POST /classes/{id}/holds`) per minute per client IP; `0` turns it off |
| `MAX_CONCURRENT_REQUESTS` | backend | `32` | Requests worked on at once per backend; keep it below the connection string's `Maximum Pool Size` |
| `MAX_QUEUED_REQUESTS` | backend | `500` | Requests that may wait for a free slot; beyond that → `503 SERVER_BUSY` |
| `VITE_API_URL` | frontend (build arg) | `http://localhost:8080` | Backend base URL used by the browser |

Compose reads overrides from your shell or a root `.env`, e.g. to watch expiry quickly:

```bash
HOLD_DURATION_SECONDS=30 docker compose up --build
```

`VITE_API_URL` is baked into the bundle at build time, so change it with `--build`.

## Tests

Both suites run in Docker as well:

```bash
docker compose --profile test run --rm --build backend-tests    # 60 backend tests, real PostgreSQL
docker compose --profile test run --rm --build frontend-tests   # 46 frontend tests (Vitest)
```

Backend tests (`backend/tests/SchoolAdmission.Tests`) include:

- **Concurrency:** 100 parallel holds on a 10-seat class → exactly 10 × `201`, 90 × `409`, `heldSeats = 10`.
- **Two backend instances** on one database racing for 7 seats → never more than 7.
- Same student applying 20× in parallel → one hold. The same student applying to 5 classes in parallel → one hold in total.
- 10 parallel confirms → all `200`, `confirmedSeats` + 1.
- Expiry with `HOLD_DURATION_SECONDS=2`: status becomes `EXPIRED` and the seat is free again, with no API call.
- Ownership (`403`), cancel rules, duplicate class names, and junk input (bad JSON, bad IDs,
  bad `X-Student-Id`), all `4xx`, never `500`.
- Load protection: per-IP limits → `429` with `Retry-After`, a full request queue or an exhausted
  connection pool → `503 SERVER_BUSY`, never `500`.

With a local SDK you can also run them directly. They use `TEST_DATABASE_URL` if set, otherwise
they start a throwaway PostgreSQL with Testcontainers (Docker required):

```bash
cd backend && dotnet test
cd frontend && pnpm install && pnpm test
```

## Bonus: two backend processes

```bash
docker compose --profile multi up --build     # adds a second backend on http://localhost:8081
```

Both share the database. Seat safety does not depend on anything in process memory; see
[ASSUMPTIONS.md](ASSUMPTIONS.md#concurrency-and-multiple-backend-processes).

## API

| # | Method and path | Success | Errors |
|---|---|---|---|
| 1 | `POST /classes` | `201` | `400` bad name/seats, `409` name taken |
| 2 | `GET /classes` | `200` | |
| 3 | `GET /classes/{classId}` | `200` | `404` |
| 4 | `POST /classes/{classId}/holds` | `201` | `400` bad `X-Student-Id` or applicant details, `404`, `409` full / already applied / already admitted / already in another class |
| 5 | `GET /holds/{holdId}` | `200` | `404` |
| 6 | `POST /holds/{holdId}/confirm` | `200` (idempotent) | `400`, `403` not yours, `404`, `409` expired / cancelled |
| 7 | `DELETE /holds/{holdId}` (held or confirmed) | `204` | `400`, `403`, `404`, `409` expired / removed |
| 8 | `GET /me/holds` | `200` | `400` |
| 9 | `DELETE /classes/{classId}` (admin) | `204` | `404` |
| 10 | `GET /classes/{classId}/students` (admin) | `200` | `404` |
| 11 | `DELETE /classes/{classId}/students/{studentId}` (admin) | `204` | `400` bad student ID, `404` class or seat not found |

Student endpoints take the 17-digit birth registration number in the `X-Student-Id` header.
`POST /classes/{classId}/holds` also takes an optional body with the applicant's details, which the UI always sends:
`{ "studentName": "Rahim Uddin", "contactNumber": "01712345678" }`.
Hold responses never contain `null`: `confirmedAt` is left out until the fee is paid.
Errors always have a JSON body: `{ "error": "CLASS_FULL", "message": "No seats are left in this class." }`.
Any endpoint can also answer `429 TOO_MANY_REQUESTS` (per-IP limit) or `503 SERVER_BUSY`
(overloaded), both with a `Retry-After` header. `GET /health` checks the database: `200`, or
`503 DATABASE_UNAVAILABLE`. It is never rate limited.

## Local development (without Docker)

```bash
# backend: needs .NET 8 SDK and a PostgreSQL; settings come from backend/.env
cp backend/.env.example backend/.env      # edit the connection string
cd backend/src/SchoolAdmission.Api && dotnet run          # http://localhost:8080

# frontend: VITE_API_URL comes from frontend/.env
cp frontend/.env.example frontend/.env
cd frontend && pnpm install && pnpm dev                   # http://localhost:5173
```

The two `.env` files point at each other: `frontend/.env` holds the backend URL (`VITE_API_URL`),
and `backend/.env` holds the frontend origin (`FRONTEND_URL`) for CORS. Real environment
variables, as Docker sets them, always take precedence over `backend/.env`.

## Layout

```
backend/
  src/SchoolAdmission.Api/    Program, Endpoints, Services (seat logic, expiry sweeper), Data (EF + migrations)
  tests/SchoolAdmission.Tests/
frontend/
  src/lib/                    API client + error messages, student ID, hold helpers
  src/pages/                  Parent page and admin page (picked by the header switch)
  src/components/admin/       Class boxes, class detail (students, remove, delete)
  src/components/parent/      Parent sidebar
  src/components/admission/   Student ID bar, class list, create class, application, my applications
docker-compose.yml
ASSUMPTIONS.md  AI_USAGE.md  AGENTS.md
```
