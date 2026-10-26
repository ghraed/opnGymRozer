<div align="center">

<img src="assets/banner.png" alt="openGym" width="720">

<br>

**A self-hosted gym & body-weight tracker you actually own.**

Plan your week, run guided workouts, track every set and your body weight over time —
on your phone, synced across devices, behind your own passkey login.
No account on someone else's server, no subscription, no ads. Just `docker compose up`.

<br>

[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-a3e635?style=flat-square)](LICENSE)
![Self-hosted](https://img.shields.io/badge/self--hosted-%F0%9F%8F%A0-60a5fa?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-installable-a78bfa?style=flat-square)
![React](https://img.shields.io/badge/React-19-38bdf8?style=flat-square&logo=react&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![No tracking](https://img.shields.io/badge/telemetry-none-f472b6?style=flat-square)
<br>
![GitHub last commit](https://img.shields.io/github/last-commit/DuarteSantos8/openGym?style=flat-square)
[![GitHub stars](https://img.shields.io/github/stars/DuarteSantos8/openGym?style=flat-square)](https://github.com/DuarteSantos8/openGym/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/DuarteSantos8/openGym?style=flat-square)](https://github.com/DuarteSantos8/openGym/issues)

</div>

<br>

<div align="center">
<table>
<tr>
<td align="center"><img src="assets/screenshots/home.png" alt="Home" width="230"><br><sub><b>Home</b> — today's workout & weight</sub></td>
<td align="center"><img src="assets/screenshots/workout.png" alt="Workout" width="230"><br><sub><b>Guided workout</b> — animated demos & sets</sub></td>
<td align="center"><img src="assets/screenshots/stats.png" alt="Stats" width="230"><br><sub><b>Stats</b> — heatmap, charts & PRs</sub></td>
</tr>
</table>
</div>

<div align="center">

### [🌐 opengym.duarte-santos.ch](https://opengym.duarte-santos.ch) · [▶ Try the live demo](https://duartesantos8.github.io/openGym/)

No signup, nothing to install — it runs entirely in your browser on example data.<br>
<sub>There's no server behind the demo, so passkey sign-in, sync across devices and the
admin dashboard only exist in a self-hosted instance.</sub>

</div>

## Why

Most workout apps lock your data behind a login on their servers, nag you to upgrade, or
disappear when the startup does. openGym is the opposite: **it runs on your box, your data
stays in a folder you control, and it's yours to fork.** It still feels modern — installable
as a home-screen app, passkey sign-in, offline support, sync across your phone and laptop.

## Features

- ⚖️ **Body-weight tracking** — interactive chart with a goal line you set, gains/losses colored by whether they move toward it
- 🏋️ **Weekly plan** — a routine per weekday, over a library of **1,324 exercises** (searchable, with animated demos)
- 🗓️ **Reschedule any day** — sick, missed a session, or fewer gym days this week? Move a workout to another day without touching your weekly plan
- ▶️ **Guided workouts** — it knows what day it is and starts today's session; asks your body weight first, pre-fills your weights from last time, rest timer, PR detection, per-exercise weight tracking
- ☀️ **The screen stays awake while you train** — no unlocking the phone and finding your place again between every set. On for as long as a workout is running, released the moment you finish it, and switchable off in Settings
- 🔗 **Supersets** — build them, and log them back-to-back with a rest only after the pair
- ⏱️ **Timed exercises** — planks, hangs, wall sits and loaded carries are logged by time, not reps, with a work timer that counts the set itself (separate from the rest timer) and logs the time you actually held. They can carry weight too
- 📈 **Progression that follows a rule** — pick one per routine, override it per exercise: linear, **Greyskull LP** (AMRAP top set, double jumps, 10 % resets), double progression through a rep range, or adding time. Your weights are already right when the session opens, and every target says *why* it's that number. Missed reps never advance the load, stalls trigger a deload, and bodyweight exercises progress in reps instead
- 💪 **Estimated 1RM** — per exercise, from your best eligible set (it names which one), with its own progress curve and a calculator for sets you haven't done. Won't guess above 12 reps
- 🎯 **Effort per set, in your scale** — an optional third column rating how hard a set was, as **RIR** (reps left in the tank) or **RPE** (the same judgement on a 10-point scale). Off by default; each set keeps the scale it was logged with, and nothing else reads the value — your progression and 1RM are unaffected
- 💪 **Bodyweight exercises, logged as bodyweight** — push-ups, pull-ups, dips and 300-odd others arrive knowing they carry no load, so there's no weight column and no working-weight prompt: one stepper, log the reps. Add a dip belt and it reads as an addition, and progression goes back to following the weight. Without one, reps climb — and past a ceiling you set, a set is added instead of a rep, up to the point where the honest advice is load or a harder variation
- ↔️ **Reps per side** — for lunges, single-arm rows and the rest. You log the total, the app shows the split ("8 per side"), and the target steps in twos so it never lands on a number one side can't have
- 🏃 **Cardio** — log time + speed, not just weight × reps
- 📤 **Share a plan** — send someone your routines and week schedule as a small file (no workouts, no weigh-ins), or print it as a clean PDF. Importing merges, so their plan is never overwritten
- 🔧 **Filter by equipment** — narrow the library to what you actually own; the options adapt to what you've picked, so every combination on screen has results behind it
- ✨ **Your own exercises** — a name and a body part is enough; they behave like built-in ones everywhere, with an optional description instead of an animation
- 🟩 **Activity heatmap** — a GitHub-style year view, shaded by time spent training
- 💪 **Muscle map** — a front-and-back body diagram shaded by how much work each muscle got, over a week, a month or all time. It names the muscles you *haven't* trained in that period, previews what a routine hits while you build it, and shows what you just trained when you finish. Male or female figure, your pick
- 🔔 **Push notifications** — rest-timer alerts even with the app closed, plus an optional reminder on days you have a workout planned but haven't logged one. Opt in per profile; keys are generated on first run, nothing to configure
- 🔑 **Passkeys, not passwords** — Face ID / Touch ID / fingerprint login; each profile keeps its own data, synced across devices
- 🛠️ **Admin dashboard** (optional) — for whoever runs the instance: who's training right now, per-user history, disable accounts, and invite-only signup. Off by default, so a fresh instance stays open with no admin
- 🎨 **Designed, not assembled** — light/dark themes and 8 accent colors saved to your profile, over a hand-drawn icon set instead of emoji, so it looks the same on every phone
- 🌍 **12 languages** — full UI translation (EN, DE, ES, FR, IT, PT, PL, TR, RU, ZH, KO, HI); exercise instructions localized in 10 of them, loaded on demand so the app stays fast
- 📥 **Bring your history with you** — import from **FitNotes** (Android and iOS), **Strong** and **Hevy**, or body weight straight out of an **Apple Health** export. Exercise names are matched against the library and anything unrecognised becomes one of your own exercises, so nothing in the file is dropped
- 📦 **Yours to keep** — one-tap JSON export/import, guest mode, **no telemetry**
- 📱 **Standalone Android app** — the whole tracker as a sideloadable APK: no account, no server, data on the phone, native workout reminders ([download](https://opengym.duarte-santos.ch))

## Quick start (self-host)

You need [Docker](https://docs.docker.com/get-docker/) with Compose.

```bash
git clone https://github.com/DuarteSantos8/openGym
cd openGym
cp .env.example .env
docker compose up -d --build
```

Open **http://localhost:8080** and create an account. New clients can sign in but wait for
an admin or trainer to approve them from **client dashboard → Assign plan & approve**.
Approval requires selecting a membership plan and confirming its price and duration;
the subscription and account activation are saved in one transaction.
The waiting page checks for approval automatically. Existing accounts keep their access
when upgrading; disabled accounts remain disabled. After activation, clients must complete
the three profile setup pages (body details and goals, training preferences, and review)
before accessing the app. Existing clients with incomplete profiles also complete setup;
assigned plans and workout history are preserved.

For a fresh installation, create the trainer account (replace the email and password):

```bash
docker compose --profile tools run --rm \
  -e TRAINER_EMAIL=trainer@example.com \
  -e TRAINER_PASSWORD='choose-a-strong-password' seed-trainer
```

First launch downloads
the exercise media (~140 MB) once. MySQL migrations run automatically before the API starts.

> Want it reachable from your phone over the internet with passkeys? You'll need an HTTPS
> domain — a two-line change in `.env`. See **[docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)**.

## Mobile app (no server at all)

The same codebase also builds a **standalone mobile app** (Capacitor): no account, no sync,
no backend — everything stays on the phone, with native workout-day reminders and share-sheet
backups. Self-hosting gets you multi-device sync and profiles for friends & family; the
mobile app is the install-and-done flavor.

- **Android:** [**download the APK**](https://opengym.duarte-santos.ch) and sideload it —
  openGym is deliberately not on the Play Store. Or build it yourself: **[docs/MOBILE.md](docs/MOBILE.md)**.
- **iPhone:** Apple doesn't allow installing apps outside the App Store, so there is no iOS
  download. Self-host and add it to your home screen from Safari (it's a full PWA), or build
  the native app onto your own device from Xcode — see **[docs/MOBILE.md](docs/MOBILE.md)**.

## How it works

```
┌─────────────┐        ┌──────────────────────────────┐
│  Your phone │──HTTPS─▶│  web  (nginx)                │
│  / laptop   │        │   ├─ serves the built app    │
└─────────────┘        │   └─ proxies /api ──────────┐│
                       └──────────────────────────────┘│
                                                        ▼
                                        ┌──────────────────────────┐
                                        │  api  (Node + WebAuthn)  │
                                        │   └─ MySQL 8.4            │
                                        └──────────────────────────┘
```

- **frontend/** — React + Vite (React Router + Zustand), built to static files **inside Docker**
- **api/** — Node with no framework, email/password authentication, and MySQL persistence
- **web/** — a multi-stage image that builds the frontend and serves it with nginx, proxying `/api` to the backend so it is all on one origin

## Your data

Lives in MySQL. Accounts, invitations and subscriptions are relational; client settings,
plans and progress are isolated, versioned JSON documents. Back up the `mysql_data` volume (or use
`mysqldump`) to back up the application. Passkey private keys never touch the server.

Existing JSON installations can be imported once, without changing their source files:

```bash
docker compose --profile tools run --rm import-json
```

## Configuration

All via `.env` (see `.env.example`):

| Variable      | What it is                                           | Default                 |
|---------------|------------------------------------------------------|-------------------------|
| `ORIGIN`      | Full URL the app is served from                      | `http://localhost:8080` |
| `WEB_PORT`    | Host port for the web UI                             | `8080`                  |
| `INVITE_ONLY` | Require an invite code to create a profile           | *(off)*                 |
| `DB_HOST` / `DB_PORT` | External MySQL connection (local development) | `127.0.0.1:3306`     |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | MySQL database credentials | `opengym`            |

Push notification keys and the session signing secret are generated on first run and stored in MySQL.
To make a registered profile a trainer, run `UPDATE users SET role='trainer' WHERE id='USER_ID';`.

## Roadmap

Rough, community-driven — ideas and PRs welcome:

- [x] Standalone mobile app — Android APK to sideload ([download](https://opengym.duarte-santos.ch)); on iOS as a self-hosted PWA (no store listings planned)
- [x] Automatic progression programs (linear, Greyskull LP, double progression) with stalls and deloads
- [x] Estimated 1RM per exercise
- [ ] Percentage / training-max programming (5/3/1-style) on top of the progression engine
- [ ] More starter plans (upper/lower, full-body, 5×5)
- [x] Importers from FitNotes / Strong / Hevy (including the RPE they record), and body weight from Apple Health
- [x] Effort per set — RIR or RPE, whichever scale you think in
- [ ] Body measurements (waist, arms…) alongside weight
- [ ] Per-exercise notes & plate calculator
- [ ] Exercise instructions in German & Portuguese (UI is translated; upstream dataset doesn't ship these yet)

## Tech

React 19 + Vite (React Router, Zustand) · Node (no framework) · nginx · Docker Compose ·
WebAuthn · exercise data from [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset).
MySQL 8.4 runs in Docker by default; an external MySQL server can be selected through `.env`.

The training logic — progression rules, 1RM estimation, how a logged session is read back —
lives in pure functions under `frontend/src/lib/` with tests next to them: `npm test` in
`frontend/`. Vitest is a dev dependency; the app itself ships no runtime dependencies beyond
React, the router and Zustand.

## Community

- **[Q&A](https://github.com/DuarteSantos8/openGym/discussions/categories/q-a)** — self-hosting
  help, passkey/login trouble, "how do I…". Most login problems turn out to be an `RP_ID`/`ORIGIN`
  mismatch.
- **[Ideas](https://github.com/DuarteSantos8/openGym/discussions/categories/ideas)** — features
  worth talking through before anyone writes code.
- **[Show and tell](https://github.com/DuarteSantos8/openGym/discussions/categories/show-and-tell)**
  — your setup, your plan templates, whatever you built on top.
- **[Issues](https://github.com/DuarteSantos8/openGym/issues)** — bugs, and work that's already
  been agreed on.

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Good first issues: more starter
plans, exercise-data languages, import from other trackers. **A ⭐ helps more people find it.**

openGym is free and stays free: AGPL, no subscription, no paid tier, nothing held back for
sponsors. If it replaced a paid tracker for you and you want to chip in, the Sponsor button at the
top of the page is there — a star, a bug report or a PR is worth just as much.

## License

[GNU AGPL v3.0](LICENSE) — free and open source. You can self-host, use, modify and share it;
if you run a modified version as a network service, you must offer that version's source under
the same license. Nobody can turn openGym into a closed, proprietary product.

Exercise images/GIFs are fetched from the upstream dataset and keep their own terms — see [NOTICE.md](NOTICE.md).

## Admin and trainer accounts

There are three separate roles: `client`, `trainer`, and `admin`. Existing
trainers remain trainers after migration; nobody is automatically promoted.
The API applies `004_admin_role.sql` at startup, preserving accounts and data.

Admins use the **Admin** tab (`/admin`) to search all users, including trainers
and other admins, create accounts, and open profiles. **Edit user profile**
updates name, email, password, role, photo, activation and fitness information.
The profile also exposes training-plan editing, account suspension/restoration
and confirmed permanent deletion. New accounts created by an admin default to
activated; the admin can leave a client pending. Clients without a completed
fitness profile must finish setup before logging workouts.

Trainers keep the client dashboard, plan editing, activation, suspension and
client deletion, but cannot access trainer/admin profiles, create accounts or
change roles. Public registration always creates pending clients regardless of
role fields supplied by a caller. Role, identity, password and access changes
revoke the affected user's sessions; editing your own admin profile refreshes
your current session. Admins cannot delete, suspend or demote themselves; account
mutations are serialized to prevent concurrent changes removing all enabled admins.

### Bootstrap the first admin

Run this on the server with the normal database environment, after deploying the
`finance` branch. Supply the email of an existing account to promote it without
changing its profile or password:

```bash
ADMIN_EMAIL='owner@example.com' npm --prefix api run db:seed-admin
```

To create a new account, also supply `ADMIN_PASSWORD` (8–200 characters) and,
optionally, `ADMIN_NAME`. Keep the password out of source control and shell
history; for example, enter it through a hidden prompt:

```bash
read -rs -p 'Admin password: ' ADMIN_PASSWORD
export ADMIN_PASSWORD
ADMIN_EMAIL='owner@example.com' ADMIN_NAME='Owner' npm --prefix api run db:seed-admin
unset ADMIN_PASSWORD
```

Docker deployments can use the dedicated tools service; rebuild it from this
branch and pass the target email (and password only for a new account/reset):

```bash
docker compose --profile tools build seed-admin
docker compose --profile tools run --rm -e ADMIN_EMAIL='owner@example.com' seed-admin
```

No default admin password is shipped. The trainer seed command refuses to
overwrite an admin account. Sign in again after promoting an existing account.

### Access-control integration tests

Unit tests run with `npm --prefix api test`; frontend tests with
`npm --prefix frontend test`. To also exercise real HTTP sessions, migrations,
CRUD, access boundaries and concurrent role changes, create **two empty,
disposable MySQL databases**, then run:

```bash
TEST_DB_NAME=opengym_test_activation TEST_ADMIN_DB_NAME=opengym_test_admin npm --prefix api test
```

Database names must start with `opengym_test_`. Each suite refuses a nonempty
database; the tests never connect to the application database through these
variables. Standard `DB_HOST`, `DB_PORT`, `DB_USER` and `DB_PASSWORD` configure
the test server connection. Use fresh databases for subsequent runs.

## Membership plans and pricing

Open **Admin → Membership plans** (`/admin/memberships`). Only admins can
access this page and its API. Create and edit plans with a name, description /
benefits, duration (days, weeks, months or years), total price and currency
(USD or LBP). A price of zero is allowed. Prices are entered explicitly; no
sample or default prices are installed. Each plan is priced in one currency,
without automatic exchange-rate conversion. Create separate plans when offering
prices in both currencies.

Archive unused plans and restore them later. Archived plans and their prices
remain saved; there is no destructive plan deletion. Search by name, description
or currency, and switch between active, archived and all plans. Edits and status
changes include a version so concurrent admin actions cannot silently overwrite
each other. A conflict requires canceling and reopening the plan to use its latest
version.

Migration `005_membership_plans.sql` adds a separate catalog table at API startup
without modifying existing users or workout plans. Monetary values use
`DECIMAL(12,2)` and are returned as two-decimal strings. The total price is for the
entire stated duration; duration units are retained (a calendar month is not
converted to 30 days).

| Method | Endpoint | Action |
| --- | --- | --- |
| GET | `/api/admin/membership-plans` | List all plans, including archived plans |
| POST | `/api/admin/membership-plans` | Create a plan |
| PUT | `/api/admin/membership-plan` | Edit a plan with its `id` and `version` |
| POST | `/api/admin/membership-plan/status` | Set `active` with its `id` and `version` |

Create/update bodies use `name`, `description`, `durationCount` (integer 1–3650),
`durationUnit` (`day`, `week`, `month`, `year`), `price` (decimal string, maximum
9999999999.99) and `currency` (`USD`, `LBP`). New plans start active. This step is
the pricing catalog only: assigning memberships to members, renewals, billing,
payment collection and workout access restrictions are separate features.

To include the membership HTTP/integration suite, supply a third **empty,
disposable** database using `TEST_MEMBERSHIP_DB_NAME=opengym_test_memberships`
when running the API tests. The suite verifies upgrading an existing database,
access controls, exact prices, validation, archive/restore and concurrent edits.

## Finance hub and member subscriptions

Admins open **Admin → Finance** (`/admin/finance`) for an overview of available
finance tools, descriptions, direct links, access instructions and a three-step
getting-started guide. The hub shows active pricing plans and active, scheduled
and expired subscription counts. Only implemented tools are marked available;
payments, invoices and receipts are explicitly described as not yet available.
Trainers and clients cannot open Finance, subscription pages or their APIs.

**Admin → Finance → Renewals** (`/admin/renewals`) shows every client as a
searchable mobile-friendly card, including clients without a membership. Tap
**Renew 1 month** and confirm the member, plan, full price and coverage dates.
The shortcut uses the member's most recently used active one-month plan, or the
first active one-month plan in catalog order. Its name and price appear on the
card. Open **View all plans** to choose a different plan, including day passes,
weeks or multi-month terms. Disabled accounts remain visible but cannot renew.
New coverage starts after the latest non-cancelled booked term, or today when
coverage has expired. Payment review and reminder tools are under
**Payments & reminders** on the same page.

Configure durations and full-term prices in **Membership plans & pricing**.
Use Days for day passes, or Weeks, Months and Years for longer plans. An active
plan of exactly 1 month enables the quick renewal button; a 30-day plan is a
different duration. Prices are taken from the selected plan, never inferred by
multiplying another plan's price.

**Member subscriptions** (`/admin/subscriptions`) also allows an enabled client,
an active plan and an explicit start date to be selected.
Optional notes are saved with the term. Subscriptions retain the agreed plan
name, duration, exact price and currency independently of future catalog edits or archive
operations. The API rejects a changed plan version so admins must review the
new price before proceeding. Ordinary subscription renewals do not activate, suspend
or restrict workout/login access. Approving a pending client requires assigning
an active membership plan, with coverage starting on the business date. Both admins
and trainers can use `GET /api/admin/activation-plans` and then
`POST /api/admin/user/activate` with `id`, `planId`, `planVersion`, `cycle`,
`startsOn` and an idempotent `requestKey`. A failed assignment leaves the account pending.
Trainers retain no access to general finance or renewal APIs.

Dates are calendar dates: coverage includes the start date and stops at the
**start of the displayed end date**. For example, 15 October → 15 November is
monthly coverage; 31 January → the last day of February uses month-end clamping.
Leap years and calendar quarters are calculated explicitly, without assuming
30/90/365-day intervals. Status is calculated as active, scheduled, expired or
cancelled using the server's finance date. `FINANCE_TIMEZONE` defaults to
`Asia/Beirut`; set it to an IANA timezone for another business location. Docker
uses the API's existing `.env` configuration for this setting.

Search by member, plan, currency or period and filter by status. **Add next term**
opens a new subscription for the same member with a suggested start date at the
previous end date (or today if the term expired). This is a manual action: no
automatic renewal or payment collection occurs. Overlapping, non-cancelled
coverage for the same client is blocked, including simultaneous submissions;
adjacent terms are allowed. Request keys prevent a retry from creating a second
term after a lost response.

Admins may cancel active or scheduled terms with a required reason and explicit
confirmation. Cancellation is immediate, preserves history and does not issue a
refund. Expired terms cannot be cancelled. Subscriptions are not deleted when a
member account or catalog plan is deleted; nullable references and saved names /
prices retain the historical record. A deleted member's email is not retained in
subscription snapshots. Migration `006_member_subscriptions.sql` creates this
separate table without editing existing users, plans or workout history. Migration
`010_subscription_durations.sql` adds duration snapshots and plan-based periods,
preserving existing terms. It runs on API startup; deploy the API and frontend together.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/admin/finance` | Admin-only finance overview |
| GET | `/api/admin/subscriptions` | Subscription records, business date and supported periods |
| POST | `/api/admin/subscriptions` | Create coverage using `memberId`, `planId`, `planVersion`, `cycle` (the plan’s `subscriptionCycle`, including `plan` for custom durations), `startsOn`, `requestKey`, optional `notes` |
| POST | `/api/admin/subscription/cancel` | Cancel using `id`, `version` and required `reason` |

For the new integration suite, provide a fourth **empty, disposable** database
with `TEST_SUBSCRIPTION_DB_NAME=opengym_test_subscriptions`. Run alongside
`TEST_DB_NAME`, `TEST_ADMIN_DB_NAME` and `TEST_MEMBERSHIP_DB_NAME` for all API
checks. Each suite requires its own fresh test database. Calendar/date and input
validation tests also run without a database.

## Renewal tracking and payment reminders

Open **Admin → Finance → Renewals & payment reminders** (`/admin/renewals`).
The tracker lists expiring memberships, overdue renewals, terms with a next term
recorded and manually reviewed unpaid subscriptions. Use search and status
filters, review payment, follow **Add next term**, or send a renewal/payment
reminder. A next term is any later non-cancelled term for the same member; “Next
term recorded” does not imply gap-free coverage or that its payment is settled.

Migration `007_renewal_reminders.sql` defaults **all existing subscriptions to
“Not reviewed”**, without inventing historical debt. Admins review each term as
Not reviewed, Awaiting payment, Paid or Waived / no payment due. Awaiting payment
requires a due date and a nonzero quoted price. Every review requires a note,
checks the subscription version and appends an audit record. Only the full-term
payment status is tracked; this does not charge money or provide a transaction
ledger, partial payments, refunds, invoices or receipts.

**Manual reminders** require an explicit admin action and confirmation. A member
gets a private in-app reminder; if they have an existing push subscription, the
API also attempts a push notification. The push preview is generic; the app
shows the member's own plan name, agreed amount/currency and due/end date.
Members can dismiss their own reminders. Clients and trainers cannot view the
admin tracker, payment review history, settings or other members' notices. A
client's own reminders do not grant access to any Finance management page.

Under **Automatic reminder settings**, admins can enable recurring follow-ups.
Automatic reminders are off by default. Defaults are 7 days before membership
expiry, 3 days before payment is due and a 7-day repeat interval for unresolved
items. Lead times are configurable from 0–60 days; repeats from 1–30 days. The
API scans every minute, using `FINANCE_TIMEZONE` / the same calendar date as the
subscription system. Automatic reminders can start within the lead window or
when already overdue; they do not auto-renew coverage or collect payments.

Paid, waived or unreviewed terms cannot receive payment reminders. Free terms,
cancelled terms, disabled/deleted members and accounts no longer assigned the
client role cannot receive payment reminders. Renewal reminders stop when a
non-cancelled next term is recorded; cancellation or an unavailable member also
suppresses reminders. Jobs re-check eligibility before sending and private
notices are hidden once resolved. Reviewing a payment does not change login or
workout access.

Reminder jobs and delivery history are persisted in MySQL. A unique key limits
each subscription/reminder type to one record per business date. Automatic
follow-ups also respect the configured repeat interval, including manually sent
reminders. Conditional claims with a 5-minute lease prevent concurrent workers
from sending a job at the same time. Failed pushes retry at most 3 attempts,
15 minutes apart; expired leases can recover after a restart. In-app-only jobs
are complete without a push subscription. “Push accepted” means acceptance by
the push service, not delivery to or reading by the person. A crash after push
acceptance but before the database update can cause an at-least-once retry; the
stable notification tag helps replace duplicate device notifications.

The tracker displays the latest 100 reminder entries and latest 100 payment
review events; the full history remains stored. Members see up to 10 applicable,
unread reminders, checked on page load and every minute. Dismissal is scoped to
the signed-in member and does not mark another member's notice read.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/admin/renewals` | Admin-only tracker, settings, delivery and payment review history |
| POST | `/api/admin/subscription/payment` | Review using `id`, `version`, `paymentStatus`, `dueOn` for unpaid, and `note` |
| PUT | `/api/admin/reminder-settings` | Save `enabled`, `renewalLeadDays`, `paymentLeadDays`, `repeatDays` |
| POST | `/api/admin/subscription/remind` | Confirm a manual reminder using subscription `id` and `kind` (`renewal` or `payment`) |
| GET | `/api/member/reminders` | Signed-in member's own applicable unread notices |
| POST | `/api/member/reminder/read` | Dismiss the signed-in member's reminder by `id` |

Use a fifth fresh disposable database with
`TEST_RENEWAL_DB_NAME=opengym_test_renewals` for the new integration suite.
Tests simulate push acceptance/failure locally; they do not contact push
providers or send real member messages. Existing-data migration, admin-only
management, member isolation, review history, scheduling/cooldown, paid/renewed
suppression, retry caps, expired leases and concurrent claims are covered.

## Revenue, expenses and profit & loss

Admins can open **Admin → Finance** or use the dashboard shortcuts:

| Tool | Route | Purpose |
| --- | --- | --- |
| Revenue | `/admin/revenue` | Record money received, category, method and reference |
| Expenses | `/admin/expenses` | Record money paid for gym operations |
| Profit & loss | `/admin/profit-loss` | View revenue minus expenses by month and category |

These are **cash-basis records**, not payment processing or accrual accounts.
Record receipts and payments on their transaction dates. Marking a subscription **Paid** automatically records its full quoted amount as
linked revenue on the received date. Other receipts are entered manually once.
Changing a paid review to another status voids its linked receipt as a correction,
not a refund. Cancelling coverage does not undo a collected payment. USD and LBP totals remain separate; no exchange rate is assumed.
Reports include posted entries in the inclusive date range and exclude voided entries.
For existing Paid reviews, `node api/scripts/backfill-subscription-revenue.js`
backfills receipts using review dates and method Other; it refuses to run when
manual revenue needs reconciliation. Repeated runs do not duplicate receipts.

Entries retain exact decimal amounts, transaction date, category, description,
payment method, optional reference, creator and creation time. Saved entries are
immutable: to correct a mistake, void it with a reason and enter its replacement.
Voiding retains the original amount, actor, time and reason. Revenue and expense
history supports date, currency and posted/voided filters, with 50 entries per page.
A stable entry ID makes retries of the same save idempotent; a different payload
cannot overwrite an existing receipt. All reads and writes are admin-only.

Migration `008_finance_ledger.sql` runs on API startup and creates a separate table,
preserving existing users, subscriptions and payment reviews. Deploy both API and
frontend with `docker compose up -d --build`.

API endpoints:

- `GET /api/admin/ledger?kind=revenue&from=2026-10-01&to=2026-10-31`
  (also accepts `kind=expense`, `currency=USD|LBP|all`,
  `status=posted|voided|all`, `page=1`).
- `POST /api/admin/ledger`: `id` (unique 16–64 character identifier), `kind`,
  `date`, `amount` (positive decimal string, up to `9999999999.99`), `currency`,
  `category`, `description`, `method` (`cash`, `card`, `transfer`, `other`),
  optional `reference`.
- `POST /api/admin/ledger/void`: `id`, `reason`.
- `GET /api/admin/profit-loss?from=2026-10-01&to=2026-10-31`.

Integration checks require an **empty disposable** database matching
`opengym_test_*`: `TEST_LEDGER_DB_NAME=opengym_test_ledger npm --prefix api test`.

The self-hosted web app uses normal paths such as `/admin/renewals/<member-id>`.
Old `/#/...` bookmarks are converted automatically. Nginx serves `index.html` for
app routes, so refreshing a member link works. Mobile and static demo builds retain
their existing hash routing.

Admin sections use `/admin/members`, `/admin/invites` and `/admin/activity`.
Member renewals use `/admin/renewals/<member-id>`. Older `?section=...` and
`?member=...` links redirect to these paths, preserving search filters.
