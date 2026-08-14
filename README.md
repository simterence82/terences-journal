# Terence's Journal

A personal operations dashboard for managing smart lighting purchases, Blum
hardware orders, outstanding tasks, outstanding issues, and a shared
schedule — built for a Singapore-based operations professional and their
personal assistant to collaborate on daily work.

This is a **standalone** build: plain Node.js/Express + React/Vite, with all
data — login/credentials, business records, and file attachments — stored
in Firebase (Authentication, Cloud Firestore, and Cloud Storage). No local
database file to manage or back up — clone it, `npm install`, point it at
your Firebase project, and run it anywhere Node.js runs.

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
| Business data | Cloud Firestore |
| Login / credentials | Firebase Authentication (Email/Password) |
| File uploads | Multer (in-memory) uploaded to Cloud Storage for Firebase |
| Data fetching | TanStack React Query |
| Validation | Zod |

## Where your data lives

Everything lives in your Firebase project — there is no local database file.

- **Login credentials** (email + password) live entirely in Firebase
  Authentication — this app never stores or sees a password. Firebase issues
  short-lived ID tokens; the backend verifies them on every request via the
  Firebase Admin SDK. Roles (`admin`/`member`) are stored as a Firebase
  custom claim, set by the backend (only the Admin SDK can set claims).
- **Records** (lighting/Blum purchases, tasks, issues, schedule entries)
  live in Cloud Firestore, one collection per record type. Each document's
  `createdBy` field stores the Firebase UID of whoever created it — there's
  no local users table. Deleting a record sets `isDeleted: true` (the Trash
  Bin) rather than removing the document; a background job permanently
  purges anything soft-deleted for more than 120 days.
- **File attachments** (task files, issue PDFs/images) live in Cloud
  Storage for Firebase, under `attachments/{collection}/{docId}/{fileName}`.
  The Firestore document only stores a `storagePath` reference — the file
  bytes never round-trip through Firestore.
- The frontend never talks to Firestore or Storage directly — every request
  goes through the Express API, which uses the Firebase Admin SDK (bypasses
  security rules). `firestore.rules` and `storage.rules` in this repo deny
  all direct client access as a safety net.

## Getting started

### 1. Set up Firebase (one-time, ~10 minutes)

1. Go to the [Firebase Console](https://console.firebase.google.com) → **Add
   project** → name it → Create.
2. **Build → Authentication → Get started → Sign-in method** tab → enable
   **Email/Password**.
3. **Build → Firestore Database → Create database** → start in **Native
   mode**, pick a location close to you → Create. (This app talks to
   Firestore only through the Admin SDK, so the default security rules
   Firebase suggests don't matter — the rules this repo ships in
   `firestore.rules` lock it down properly once you deploy them in step 4.)
4. **Build → Storage → Get started** → keep the default bucket → Create.
5. **Project settings** (gear icon) → **General** tab → "Your apps" → click
   the `</>` (web) icon → register an app → copy the `firebaseConfig` object
   shown (you'll need the `storageBucket` value from it too).
6. **Project settings → Service accounts** tab → **Generate new private
   key** → save the downloaded file as `server/firebase-service-account.json`
   (already gitignored — never commit this file, it grants full admin access
   to your Firebase project).

### 2. Publish Firestore/Storage rules (one-time)

This repo includes `firestore.rules` and `storage.rules`. Every query the
app runs is a single-field filter (no composite indexes needed), so there's
no index setup step — just publish the two rule files from the console:

1. **Build → Firestore Database → Rules** tab → replace the contents with
   `firestore.rules` from this repo → **Publish**.
2. **Build → Storage → Rules** tab → replace the contents with
   `storage.rules` from this repo → **Publish**.

(If you'd rather use the [Firebase CLI](https://firebase.google.com/docs/cli)
instead: `firebase login && firebase use --add && firebase deploy --only
firestore:rules,storage`. Note the CLI's deploy command needs to be run
under your own Google login — a service account key alone isn't enough
permission for it.)

### 3. Run the app

```bash
npm install
cp .env.example .env
# paste the firebaseConfig values from step 1.5 into the VITE_FIREBASE_* vars
npm run dev
```

This starts the Express API on `http://localhost:3001` and the Vite dev
server on `http://localhost:5173` (which proxies `/api` to the Express
server). Open `http://localhost:5173` and you'll land on a first-run setup
screen to create the initial admin account — no Firebase users exist yet.

Firestore collections are created automatically on first write — no
migration step is required.

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
- Autocomplete/lookup values (`GET /api/lookups`) are computed by reading
  each relevant Firestore collection in full and deduping in memory — fine
  at personal-operations scale, but worth revisiting (e.g. a maintained
  lookups collection) if any collection grows very large.
- Firebase's own backup tooling (scheduled Firestore exports, Storage
  versioning) covers this app's data — there's no local database file to
  back up separately.
