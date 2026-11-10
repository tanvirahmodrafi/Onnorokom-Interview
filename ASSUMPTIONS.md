# Assumptions

Where the brief is silent, this is what I chose and why.

## Concurrency and multiple backend processes

- **Seat check runs in the database, not in C#.** Creating a hold runs in one transaction that
  first takes `SELECT … FROM classes WHERE id = … FOR UPDATE`. Every attempt for that class, from
  any process, queues on that row lock. Only then are active holds counted and the new one
  inserted. No C# `lock`, semaphore or in-memory counter is involved, so two (or more) backend
  processes on different ports sharing one database cannot overbook. This is shown by
  `docker compose --profile multi up` and the `Two_backend_instances_on_one_database_never_overbook` test.
- **One student, one class.** A student may have at most one live application or admission
  (`HELD` or `CONFIRMED`) across **all** classes, because a student studies in one class. This is
  stricter than rule 3, which only forbids two in the same class. Backed by a partial unique index
  `UNIQUE (student_id) WHERE status IN ('HELD','CONFIRMED')`, so two parallel applications to
  different classes (which lock different class rows) still end with one seat.
- When this rule was added, a migration cancelled any extra live holds already in the database:
  each student keeps their confirmed admission, or otherwise their earliest hold.
- **Confirm and cancel are conditional updates** (`… WHERE id = ? AND status = 'HELD' AND expires_at > now`).
  Of several parallel confirms only one changes the row. The rest see `CONFIRMED` and return `200`.
- Seat counts are computed from hold rows, not stored counters, so there is no counter to drift.
- Migrations run on startup under a PostgreSQL advisory lock, so several backends can start together.

## Load protection

- **Why:** a load test with 1000 concurrent clients (5000 mixed requests) exhausted the 40-connection
  pool. Requests waited 15 s for a connection and 432 of them failed with `500`; one script could do this.
- **Per client IP, per minute:** 600 requests, plus a separate 30 for applications. Over it → `429
  TOO_MANY_REQUESTS` with `Retry-After`. Generous on purpose: mobile carriers share one IP among
  many users (CGNAT), and one parent tab polls about 60 times a minute. The limits are per backend
  process (in memory), so with N backends a client gets up to N× the budget. That is accepted for load
  shedding. It is not a security boundary.
- **Behind a reverse proxy** every request has the proxy's IP, so the per-IP limit becomes one shared
  limit. Configure `ForwardedHeaders` for the trusted proxy before deploying that way. Locally,
  Docker Desktop also shows every browser as one gateway IP.
- **Concurrency cap:** at most `MAX_CONCURRENT_REQUESTS` (32) requests work at once per backend, below
  the pool size of 40 so the expiry sweeper and health check still get a connection. Up to 500 wait
  in order. Beyond that → `503 SERVER_BUSY` straight away instead of a slow `500`.
- If a database connection still cannot be had in time, the pool timeout is reported as `503
  SERVER_BUSY` (retryable), not `500`.
- This is in-process load shedding, not seat logic. AGENTS.md rule 1 (no C# locks or semaphores)
  is about seat safety, which still lives entirely in PostgreSQL.
- `/health` runs a database check (3 s timeout) and is exempt from all limits, so a load balancer
  sees the real state under load.
- Not done yet: `GET /classes` is not paginated, so every call returns every class. Pagination
  would change the API in the brief.

## Expiry

- A `HELD` hold with `expires_at <= now` counts as **expired everywhere at once** (counts, confirm,
  re-apply, API responses), even before the background sweeper rewrites the row. The sweeper
  (every `SWEEP_INTERVAL_SECONDS`, default 5) just keeps the stored status tidy.
- The UI countdown uses the browser clock. At zero it shows `EXPIRED`, disables Pay and refetches.
  The server stays the authority: a late payment is rejected with `409 HOLD_EXPIRED`.

## API decisions not given in the brief

| Situation | Response | Why |
|---|---|---|
| Missing / malformed `X-Student-Id` (not exactly 17 digits) | `400` | Invalid input |
| Empty name, seats ≤ 0, > 100 000, non-integer, bad JSON | `400` | Invalid input; never `500` |
| Class name already used (case-insensitive) | `409 CLASS_EXISTS` | Two "Class 6 - Morning Shift" would confuse parents |
| Unknown class/hold ID, or an ID that is not a GUID | `404` | An ID that can't exist is "not found" |
| Student already has a live hold in that class | `409 ALREADY_APPLIED` | Rule 3 |
| Student already admitted to that class | `409 ALREADY_ADMITTED` | Rule 3 |
| Student holds or has a seat in a different class | `409 ALREADY_IN_ANOTHER_CLASS` | One class per student |
| Applicant details missing a field or invalid | `400 INVALID_STUDENT_NAME` / `INVALID_CONTACT_NUMBER` | Invalid input |
| Confirm/cancel someone else's hold | `403 NOT_YOUR_HOLD` | Clear message; IDs are random GUIDs, so this doesn't leak much |
| Confirm an expired / cancelled hold | `409 HOLD_EXPIRED` / `HOLD_CANCELLED` | Conflicts with current state, same family as "class full" |
| Confirm an already-confirmed hold (same student) | `200 CONFIRMED` | Rule 5: idempotent, counts once |
| `DELETE` a confirmed hold (by its owner) | `204`, status `CANCELLED` | Parents may withdraw a paid admission; the seat is freed. Refunds are out of scope |
| `DELETE` an expired hold | `409 HOLD_EXPIRED` | Nothing left to cancel; the seat is already free |
| `DELETE` an already-cancelled hold | `204` | Repeating a cancel is harmless |
| `GET /holds/{holdId}` | no header needed | The brief's example sends none |
| A student whose hold expired applies again | allowed | The seat is open to anyone, including them |

- IDs are GUIDs. Responses contain every field from the brief plus a few extras (`className`,
  `studentId`, `createdAt`, `confirmedAt`; class `createdAt`); `POST /classes` also returns the counts.
- Every error body is `{ "error": CODE, "message": text }`. Timestamps are UTC ISO 8601 with `Z`
  (millisecond precision). Statuses are uppercase strings.
- The birth registration number is checked only for "exactly 17 digits". There's no checksum or year check.
- There is no authentication. The brief makes the birth registration number the identity, so anyone who knows it
  can act as that student.

## Applicant details

- Applying asks for the **student's name** (1–100 chars) and a **contact number**
  (10–15 digits, optional leading `+`; spaces and dashes are stripped, e.g. `017-1234 5678` →
  `01712345678`). They are stored on the application, because a parent may correct them when
  re-applying; the form is pre-filled from the student's last application.
- In the API the body is **optional**, so the brief's header-only `POST /classes/{id}/holds` still
  returns `201`. Without a body the hold stores the placeholders `Not provided` / `00000000000`, so
  hold responses never carry `null` details. If either field is sent, both are required
  (`400 INVALID_STUDENT_NAME` / `INVALID_CONTACT_NUMBER`). The UI always sends them. Holds created
  before the columns became NOT NULL were backfilled with the same placeholders.
- Age is not collected. An earlier version asked for it; a later migration dropped the column.
- `confirmedAt` is left out of hold responses until the fee is paid, so no hold field is ever `null`.
- The admin sees name, contact (a `tel:` link) and birth registration number in each class's
  student list.

## Frontend

- **Language:** the UI opens in **Bangla**; a header button switches to English. The choice is kept
  in `localStorage`. Text lives in one typed dictionary (`src/lib/i18n.tsx`), with no i18n library.
  The brief's action labels (`আবেদন করুন`, `ভর্তি ফি দিন`, `বাতিল`, `আবেদন জমা দিন`) and the status
  codes (`HELD`, `EXPIRED`, …) stay as they are in both languages. Class names are stored in English
  ("Class 6 - Morning Shift") and only shown in Bangla. Numbers keep Western digits.
- **Theme:** follows the system light/dark setting until the header button is pressed; then the
  choice is kept in `localStorage`.

- **Two views, picked with a switch at the top right** because there is no login:
  - *Parents*: a sidebar with three screens: *Class List* (`#/`, default), *Admission Request*
    (`#/request`) and *My Admission* (`#/my-admission`). The student ID bar sits at the top of each.
    Applying takes the parent straight to Admission Request, because the timer is already running.
    Admission Request shows the application picked in My Admission, else the one still waiting for
    payment, else the latest one. The sidebar shows how many requests wait for payment and how many
    admissions are confirmed.
  - *Admin* (`#/admin`): create class, then one box per class; tapping a box opens its detail.
- The view is kept in the URL hash, so it survives a reload, can be bookmarked and works with the back
  button. No router library and no nginx rewrite are needed.
- The switch is a UI convenience, **not access control**. Anyone can open `#/admin` or call `POST /classes`.
  Real admin auth is out of scope for the brief.

## Admin actions (not in the brief)

- **Class names come from two dropdowns**: Class 1–10 × Morning / Evening Shift, saved as
  `"Class 6 - Morning Shift"`. The API still takes a free-text `name`, so classes made earlier keep
  working. The existing case-insensitive unique name rule stops the same class + shift twice (`409`).
- **Boxes are sorted** Class 1 → 10, Morning before Evening. Names in another format go last, oldest first.
- **The class detail lists students who take up a seat right now**: `HELD` (not expired) and
  `CONFIRMED`. Expired and cancelled applications are not shown.
- **Removing a student** works on a held *or* paid seat. The hold becomes `REMOVED` (a new status) so
  the parent sees "Removed from the class by the school" instead of a misleading "Cancelled", and the
  seat goes back to the pool. Paying or cancelling a removed hold returns `409 HOLD_REMOVED`. The student
  may apply again, as after an expiry. Refunds are out of scope.
- **Deleting a class deletes its applications too** (`ON DELETE CASCADE`), including paid ones; the
  pop-up says how many held / confirmed students will lose their seat. A hold attempt racing the delete
  either commits first and is deleted with the class, or gets `404`.
- The student ID field has no submit button: the number is used (and saved in `localStorage`) as
  soon as it has 17 digits. While it is incomplete there is no student, so applying, paying and
  cancelling are blocked. Applications are always loaded
  from `GET /me/holds`, so they survive refreshes and browser restarts.
- Polling: classes every 3 s, my applications every 5 s, the open application every 3 s.
- Cancel asks for a second click ("Yes, cancel") instead of a browser dialog.
- The Apply button stays active on a full class, so parents get the server's clear "No seats are left" message.
  It is replaced by "Applied" / "Admitted" where the student already has a live hold.

## Docker and configuration

- `VITE_API_URL` is passed as a **build arg**: Vite bakes it into the bundle. That's the simplest
  approach, and the browser reaches the API on `localhost:8080` anyway. Changing it needs `--build`.
- The frontend is served by nginx on host port **5173**. The backend on **8080**.
- The DB connection is `ConnectionStrings__Default`. Allowed CORS origins come from `FRONTEND_URL`.
- For local runs outside Docker, `backend/.env` and `frontend/.env` are loaded (examples are committed).
  Real environment variables win over `backend/.env`.
