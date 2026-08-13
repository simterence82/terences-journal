# Terence's Journal

A personal operations dashboard for managing smart lighting purchases, Blum
hardware orders, outstanding tasks, outstanding issues, and a shared
schedule — built for a Singapore-based operations professional and their
personal assistant to collaborate on daily work.

This is a **standalone** build: plain Node.js/Express + React/Vite, with a
single-file SQLite database for business data and Firebase Authentication
for login/credentials. No dependency on any third-party hosting platform —
clone it, `npm install`, and run it anywhere Node.js runs.

## Features

- **Dashboard** — Gregorian + Chinese lunar date, today's schedule, open
  tasks / unresolved issues / lighting profit / Blum total summary cards,
  daily task summary, sample Singapore weather and world news widgets.
- **Terence Schedule** — the PA logs meetings (title, date, start/end time,
  location, notes); today's entries surface on the Dashboard.
- **Smart Lighting Purchases** — brand, client, address, date, commission,
  cost/selling price, paid/reimbursed tracking, full table view, autocomplete
  on repeated fields.
- **Blum Purchases** — order name, amount, date, notes, paid/reimbursed
  tracking.
- **Outstanding Tasks** — title, description, due date, priority, assignee,
  file attachment, Open/Done tabs, admin edit.
- **Outstanding Issues** — title, description, PDF/JPEG/PNG attachment,
  Unresolved/Resolved tabs, admin edit.
- **Files Archive** — every file uploaded via Tasks/Issues, browsable in one
  place.
- **Trash Bin** — every delete moves the record to the Trash Bin instead of
  erasing it; restore any time, or it's permanently purged automatically
  after 120 days. All delete actions require confirmation first.
- **User Management** (admin only) — add/remove users, admin/member roles.
- **Autocomplete / dropdown memory** — brand, client name, address,
  commission recipient, Blum order name, and task assignee fields remember
  previously entered values.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, TypeScript, Tailwind CSS |
| Backend | Express 5 (Node.js) |
| Business data | SQLite via Node's built-in `node:sqlite` (no native build tools needed) |
| Login / credentials | Firebase Authentication (Email/Password) |
| File uploads | Multer, stored as base64 in SQLite |
| Data fetching | TanStack React Query |
| Validation | Zod |

## Where your data lives

- **Login credentials** (email + password) live entirely in Firebase
  Authentication — this app never stores or sees a password. Firebase issues
  short-lived ID tokens; the backend verifies them on every request via the
  Firebase Admin SDK. Roles (`admin`/`member`) are stored as a Firebase
  custom claim, set by the backend (only the Admin SDK can set claims).
- **Everything else** (lighting/Blum purchases, tasks, issues, schedule
  entries, file attachments) lives in the local SQLite file at the path set
  by `DATABASE_PATH` in `.env` (defaults to `./data/journal.db`). Each
  record's `created_by` column stores the Firebase UID of whoever created it
  — there's no local users table.

## Getting started

### 1. Set up Firebase (one-time, ~5 minutes)

1. Go to the [Firebase Console](https://console.firebase.google.com) → **Add
   project** → name it → Create.
2. **Build → Authentication → Get started → Sign-in method** tab → enable
   **Email/Password**.
3. **Project settings** (gear icon) → **General** tab → "Your apps" → click
   the `</>` (web) icon → register an app → copy the `firebaseConfig` object
   shown.
4. **Project settings → Service accounts** tab → **Generate new private
   key** → save the downloaded file as `server/firebase-service-account.json`
   (already gitignored — never commit this file, it grants full admin access
   to your Firebase project).

### 2. Run the app

```bash
npm install
cp .env.example .env
# paste the firebaseConfig values from step 1.3 into the VITE_FIREBASE_* vars
npm run dev
```

This starts the Express API on `http://localhost:3001` and the Vite dev
server on `http://localhost:5173` (which proxies `/api` to the Express
server). Open `http://localhost:5173` and you'll land on a first-run setup
screen to create the initial admin account — no Firebase users exist yet.

The SQLite database file is created automatically on first run. No migration
step is required — the schema is bootstrapped on server startup.

## Production build

```bash
npm run build   # builds the frontend into dist/
npm start       # runs the Express server, which also serves dist/ in production
```

Set `NODE_ENV=production` (the `npm start` script already does this) so the
server serves the built frontend alongside the API on a single port. The
`server/firebase-service-account.json` file needs to be present wherever you
deploy — it's not committed to git, so copy it there separately (and keep it
out of any public storage).

## Roles

- **Admin** — full access: create/update/delete records, manage users,
  restore/permanently-delete from the Trash Bin.
- **Member** — can view everything, create/update lighting/Blum/tasks/issues/
  schedule entries, and tick checkboxes (paid/reimbursed/resolved/done).
  Cannot delete records or manage users.

## Notes for production use

- **Weather and news** on the Dashboard are sample data — swap
  `src/lib/sampleWeatherNews.ts` for a real API call (e.g. NEA Singapore for
  weather, an RSS/news API for headlines).
- **File storage** is base64-in-SQLite for zero-dependency simplicity. For
  larger scale, migrate to disk storage or an object store (S3/R2) and store
  a reference instead.
- Back up the SQLite file (`data/journal.db`) regularly — it's the entire
  business-data state (login credentials are safe in Firebase regardless).
