# Terence's Journal

A personal operations dashboard for managing smart lighting purchases, Blum
hardware orders, outstanding tasks, outstanding issues, and a shared
schedule — built for a Singapore-based operations professional and their
personal assistant to collaborate on daily work.

This is a **pure static frontend** (React + Vite) — there is no backend
server at all. The browser talks to Firebase directly: Authentication for
login, Cloud Firestore for every record and file attachment. That makes it
deployable to plain static hosting like **GitHub Pages**, with GitHub
Actions handling the build/deploy and a small daily maintenance job.

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
  after 120 days (via a scheduled GitHub Actions job — see below). All
  delete actions require confirmation first.
- **User Management** (admin only) — anyone can request access (self
  sign-up); an admin approves each request and assigns admin/member, or
  denies it. Approved users can be removed (revokes access) at any time.
- **Autocomplete / dropdown memory** — brand, client name, address,
  commission recipient, Blum order name, and task assignee fields remember
  previously entered values.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, TypeScript, Tailwind CSS |
| Data & auth | Firebase Authentication + Cloud Firestore, called directly from the browser (`firebase` client SDK) |
| File uploads | Base64 text stored on the Firestore document — no Cloud Storage, no billing plan needed |
| Data fetching | TanStack React Query |
| Hosting | GitHub Pages, built and deployed by GitHub Actions |
| Trash auto-purge | A small script (`scripts/purgeExpiredTrash.ts`, Firebase Admin SDK) run on a daily GitHub Actions schedule |

## Where your data lives

Everything lives in your Firebase project — there is no server and no local
database file.

- **Login credentials** (email + password) live entirely in Firebase
  Authentication — this app never stores or sees a password.
- **Roles** (`admin`/`member`) are stored as a plain Firestore document at
  `users/{uid}` — not a Firebase Auth custom claim, since setting a claim
  requires a privileged server the app no longer has. The existence of a
  `users/{uid}` doc *is* "approved"; see "Sign-up & approval" below.
- **Records** (lighting/Blum purchases, tasks, issues, schedule entries)
  live in Cloud Firestore, one collection per record type, written directly
  from the browser using the Firebase client SDK. Each document's
  `createdBy` field stores the Firebase UID of whoever created it. Deleting
  a record sets `isDeleted: true` (the Trash Bin) rather than removing the
  document; a scheduled GitHub Actions job permanently purges anything
  soft-deleted for more than 120 days.
- **File attachments** (task files, issue PDFs/images) are stored as base64
  text in a sibling Firestore document (`taskFiles/{id}` / `issueFiles/{id}`)
  so list views never have to load attachment bytes. Firestore caps a
  document at 1MiB, so attachments are limited to about 700KB before base64
  encoding — fine for most PDFs/scans, but a full-resolution phone photo
  could be too large. (Cloud Storage would remove that cap, but requires
  upgrading the Firebase project to a paid Blaze plan, which this setup
  deliberately avoids.)
- **Firestore security rules are the only access control** — with no
  backend to gate requests, `firestore.rules` in this repo enforces
  everything: only approved users (a `users/{uid}` doc must exist) can read
  or write records, and only admins can soft-delete/restore/permanently
  delete or manage other users.

## Sign-up & approval

There's no way to create Firebase Auth accounts from a privileged server
anymore, so account creation is self-service and gated by admin approval
instead:

1. The very first person to open the app creates the **first admin account**
   directly (a one-time "bootstrap" screen, since no admin exists yet to
   approve them).
2. Everyone after that clicks **"Request access"** on the login page,
   creating their own login and a pending request. They can sign in, but see
   an "awaiting approval" screen until an admin acts.
3. An admin opens **User Management**, and for each pending request clicks
   **Approve as Member**, **Approve as Admin**, or **Deny**.

Removing a user from User Management revokes their access (deletes their
role) but can't delete the underlying Firebase Auth login itself — that
needs the Firebase Console (**Authentication → Users**), since deleting a
login is an Admin-SDK-only operation this static app can't perform.

## Getting started

### 1. Set up Firebase (one-time, ~10 minutes)

1. Go to the [Firebase Console](https://console.firebase.google.com) → **Add
   project** → name it → Create.
2. **Build → Authentication → Get started → Sign-in method** tab → enable
   **Email/Password**.
3. **Build → Firestore Database → Create database** → start in **Native
   mode**, pick a location close to you → Create.
4. **Project settings** (gear icon) → **General** tab → "Your apps" → click
   the `</>` (web) icon → register an app → click **Config** to reveal the
   `firebaseConfig` object → copy those six values.
5. **Project settings → Service accounts** tab → **Generate new private
   key** → save the downloaded file as `firebase-service-account.json` at
   the repo root (already gitignored — never commit this file). This is
   **only** used by the local/CI trash-purge script, not by the app itself.

This deliberately skips Cloud Storage — it now requires upgrading the
project to a paid "Blaze" plan (a card on file, even though usage would
very likely stay within the free tier). File attachments are stored
directly in Firestore instead (see "Where your data lives" above), which
needs no billing plan at all.

### 2. Publish Firestore rules (one-time)

**Build → Firestore Database → Rules** tab → replace the contents with
`firestore.rules` from this repo → **Publish**.

(Or via the [Firebase CLI](https://firebase.google.com/docs/cli), run under
your own Google login — a service account key alone isn't enough permission
for the CLI's deploy command: `firebase login && firebase use --add &&
firebase deploy --only firestore:rules`.)

### 3. Run the app locally

```bash
npm install
cp .env.example .env
# paste the firebaseConfig values from step 1.4 into the VITE_FIREBASE_* vars
npm run dev
```

Open `http://localhost:5173` and you'll land on the first-run setup screen
to create the initial admin account — no Firebase users exist yet. Firestore
collections are created automatically on first write — no migration step
required.

## Deploying to GitHub Pages

1. **Repo Settings → Pages → Source: GitHub Actions.**
2. **Repo Settings → Secrets and variables → Actions:**
   - Under **Variables**, add the six `VITE_FIREBASE_*` values from step 1.4
     above (they're not secret, but Actions still needs them to bake into
     the build).
   - Under **Secrets**, add `FIREBASE_SERVICE_ACCOUNT` — the full contents
     of `firebase-service-account.json` from step 1.5 (this one **is**
     sensitive — it's only used by the scheduled purge workflow, never
     shipped to the browser).
3. Push to the branch `.github/workflows/deploy.yml` watches (currently
   `claude/radio-check-b670z5`) — this builds the app and publishes `dist/`
   to Pages automatically. You'll get a URL like
   `https://<your-github-username>.github.io/terences-journal/`.
4. **Firebase Console → Authentication → Settings → Authorized domains →
   Add domain** → paste your `github.io` URL, or Firebase Auth will refuse
   to sign anyone in from it.

If your repo name or default branch ever changes, update `base` in
`vite.config.ts` and the `branches:` list in `.github/workflows/deploy.yml`
to match.

## Trash auto-purge

`.github/workflows/purge-trash.yml` runs `scripts/purgeExpiredTrash.ts`
once a day, permanently deleting anything soft-deleted more than 120 days
ago (and its attachment doc, if any). It needs the `FIREBASE_SERVICE_ACCOUNT`
secret set up in the deploy section above. You can also trigger it manually
from the repo's **Actions** tab (`workflow_dispatch`), or run it locally
with `npm run purge` (needs `firebase-service-account.json` present, as
described in step 1.5).

## Roles

- **Admin** — full access: create/update/delete records, approve/deny/
  remove users, restore/permanently-delete from the Trash Bin.
- **Member** — can view everything, create/update lighting/Blum/tasks/issues/
  schedule entries, and tick checkboxes (paid/reimbursed/resolved/done).
  Cannot delete records or manage users.

## Notes for production use

- **Weather and news** on the Dashboard are sample data — swap
  `src/lib/sampleWeatherNews.ts` for a real API call (e.g. NEA Singapore for
  weather, an RSS/news API for headlines).
- Autocomplete/lookup values are computed by reading each relevant Firestore
  collection in full and deduping in memory, client-side — fine at
  personal-operations scale, but worth revisiting if any collection grows
  very large.
- Firebase's own backup tooling (scheduled Firestore exports) covers this
  app's data — there's no local database file to back up separately.
- File attachments are capped around 700KB (see "Where your data lives"
  above). If that becomes limiting, Cloud Storage removes the cap but
  requires upgrading to Firebase's paid Blaze plan.
- GitHub Pages serves everything over HTTPS with client-side routing only
  (`HashRouter` — URLs look like `/#/tasks`), since there's no server to
  rewrite deep-link requests back to `index.html`.
