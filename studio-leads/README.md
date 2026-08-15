# Studio Leads

A lead-tracking and staff-accountability app for an interior design firm:
who has which lead, did they follow up on time, did it close — plus daily
attendance and a KPI/grading dashboard that turns both into one "Commitment
Score" per designer.

This is a standalone app — its own codebase, its own Firebase project, its
own login — built to be hosted with **GitHub** for source control and
**Firebase Hosting** for the live site (a natural pairing since the app is
already 100% Firebase on the backend: Authentication + Firestore, no
server of its own).

## Features

- **Leads** — client + contact details, source, project type, budget,
  assigned designer, and a status pipeline (New → Contacted → Quotation
  Sent → Following Up → Signed / Rejected / On Hold). Every lead has a
  full follow-up timeline: each contact attempt is logged with a method,
  what happened, and when the next follow-up is due.
- **Follow-up tracking** — the point of the app. Logging the first
  follow-up stamps the lead's response time (measured against the SLA in
  `src/lib/kpi.ts`); the next-follow-up date on every open lead drives an
  overdue flag that surfaces on the Dashboard and Leads page.
- **Attendance** — an admin marks each designer Present / Late / Half Day /
  On Leave / MC / Absent per day, with a reason whenever they're not fully
  in (Annual Leave, Childcare Leave, Compassionate Leave, Unpaid Leave, Off
  In Lieu, Unauthorized, Other) plus a free-text note. A "Mark All Present"
  button handles the common case in one click instead of setting each
  designer individually. Designers apply for their own leave, or submit an
  MC directly (no approval needed for MC -- it's on record right away,
  backed by an uploaded document). A **Summary** tab rolls this up per
  designer over a period — present/late/half-day/leave/MC/absent counts, an
  attendance rate, and a breakdown of leave reasons (e.g. "MC ×2, Annual
  Leave ×3").
- **Files Archive** — MC scans/photos (PDF, JPEG, PNG, or straight from a
  phone's camera) uploaded through Attendance land here, organized by
  category, backed by Cloud Storage.
- **KPI & Grading** — see "Grading model" below.
- **Role-scoped visibility** — designers only ever see their own leads and
  attendance (enforced in `firestore.rules`, not just hidden in the UI);
  admins and super admins see everything and are the ones who can
  create/assign/delete leads or mark attendance.
- **User Management** — three tiers (see "Roles" below). The first person
  to open the app bootstraps as super admin; everyone else requests access
  and an admin (or super admin) approves them.

## Grading model

The Commitment Score (0–100, shown per designer on the KPI page) is a
weighted average of four things, computed in `src/lib/kpi.ts`:

| Signal | Weight | What it measures |
|---|---|---|
| Response Time | 30% | Was first contact made within `SLA_RESPONSE_HOURS` (default 24h) of the lead landing with them? Only counts leads whose SLA window has actually elapsed, so a lead assigned 2 hours ago isn't judged yet. |
| Follow-up Compliance | 25% | Of their currently open leads with a next-follow-up date set, what share are **not** overdue right now? |
| Conversion | 25% | Of the leads they closed in the selected period, what share were signed rather than rejected? |
| Attendance | 20% | Present/late/half-day days vs. total days tracked in the period (approved leave is excluded so it doesn't count against them). |

If a signal has no data yet for a designer in the selected period (e.g. no
leads closed this month), it's dropped from the average and the remaining
weights are rescaled — a brand-new designer isn't marked down for having no
track record yet. The result maps to a letter grade:

| Score | Grade |
|---|---|
| 90–100 | A+ Outstanding |
| 80–89 | A Excellent |
| 65–79 | B Solid |
| 50–64 | C Needs Improvement |
| < 50 | D At Risk |

**This is a starting point, not gospel.** The weights, the SLA window, and
the grade bands are all constants at the top of `src/lib/kpi.ts` — read
them, adjust them to match how your studio actually wants to grade
follow-up discipline and commitment, and treat a low score as a prompt for
a conversation, not an automatic verdict.

## Tech stack

React 18 + Vite + TypeScript + Tailwind CSS. Firebase Authentication +
Cloud Firestore + Cloud Storage (for the Files Archive) called directly
from the browser (no backend server of its own). TanStack React Query for
data fetching. `react-router-dom`'s `BrowserRouter` for clean URLs
(Firebase Hosting rewrites every path to `index.html`, so client-side
routing works without a hash prefix).

**A privacy note on the Files Archive:** Cloud Storage's `getDownloadURL()`
returns a link with an access token baked in, which works regardless of
who's holding it -- Storage's own security rules (`storage.rules`) govern
who can generate that link in the first place and who can browse the file
list, but the link itself, once obtained, isn't further access-controlled.
Treat it the way you'd treat any studio-internal document link: fine to
open from inside the app, not something to paste into a public channel.

## Getting started

### 1. Set up a Firebase project

1. [Firebase Console](https://console.firebase.google.com) → **Add
   project**.
2. **Build → Authentication → Sign-in method** → enable **Email/Password**.
3. **Build → Firestore Database → Create database** → **Native mode**.
4. **Build → Hosting → Get started** → follow the prompts (you don't need
   to run its CLI commands locally; the GitHub Actions workflow below
   deploys for you). Note the **Project ID** — you'll need it.
5. **Project settings → General → Your apps** → register a web app → copy
   the six `firebaseConfig` values.

### 2. Publish Firestore rules

**Build → Firestore Database → Rules** → paste in `firestore.rules` from
this folder → **Publish**.

### 3. Enable Cloud Storage + publish its rules

The Files Archive (MC uploads from Attendance) stores the actual files in
Cloud Storage, not Firestore. **Build → Storage → Get started** → follow
the prompts to provision the default bucket (this may require the project
be on the pay-as-you-go **Blaze** plan — Storage's free tier is generous
for a small studio's use, but the plan itself needs enabling). Then
**Storage → Rules** → paste in `storage.rules` from this folder →
**Publish**.

### 4. Run locally

```bash
cd studio-leads
npm install
cp .env.example .env
# paste the firebaseConfig values into the VITE_FIREBASE_* vars
npm run dev
```

Open `http://localhost:5174` and create the first **super admin** account —
no Firebase users exist yet. Firestore collections are created
automatically on first write.

### 5. About the typeface

The brand asks for **Gotham**, but Gotham is a paid, licensed font (Hoefler
& Co.) — it isn't available on Google Fonts and can't legally be linked
from a CDN without owning it. `src/index.css` is wired up so that once the
studio has Gotham's web font files, dropping them in `public/fonts/` and
adding one `@font-face` block makes the whole app pick them up automatically
(both `--font-display` and `--font-base` already look for a font literally
named `"Gotham"` first). Until then, it falls back to **Montserrat** — a
free, geometric sans that's the standard visual stand-in for Gotham.

## Deploying (GitHub → Firebase Hosting)

`.github/workflows/deploy-studio-leads.yml` (at the repo root) builds this
app and deploys it to Firebase Hosting on every push to `master` that
touches `studio-leads/**`, and creates a preview channel for pull requests.
To turn it on:

1. **Generate a service account key** the workflow can deploy with:
   **Firebase Console → Project settings → Service accounts → Generate new
   private key**. This downloads a JSON file — keep it secret, never commit
   it.
2. **Repo Settings → Secrets and variables → Actions → Secrets → New
   repository secret**: name it `STUDIO_LEADS_FIREBASE_SERVICE_ACCOUNT`,
   paste the entire JSON file contents as the value.
3. **Repo Settings → Secrets and variables → Actions → Variables**, add the
   six `firebaseConfig` values from step 1.5 above plus the project ID,
   all prefixed `STUDIO_LEADS_`:
   - `STUDIO_LEADS_FIREBASE_API_KEY`
   - `STUDIO_LEADS_FIREBASE_AUTH_DOMAIN`
   - `STUDIO_LEADS_FIREBASE_PROJECT_ID`
   - `STUDIO_LEADS_FIREBASE_STORAGE_BUCKET`
   - `STUDIO_LEADS_FIREBASE_MESSAGING_SENDER_ID`
   - `STUDIO_LEADS_FIREBASE_APP_ID`

Until those are set, the workflow skips the deploy steps (it says so in
the run log), so it's safe to have merged before Firebase is set up. Once
they're set, the next push to `master` publishes Studio Leads at
`https://<STUDIO_LEADS_FIREBASE_PROJECT_ID>.web.app`.

You can also deploy by hand from your machine instead of via Actions:

```bash
npm install -g firebase-tools
firebase login
cd studio-leads
npm run build
firebase deploy --only hosting,firestore:rules,storage --project <your-project-id>
```

## Roles

Three tiers, enforced in `firestore.rules` (not just hidden in the UI):

- **Super Admin** — everything an Admin can do, plus the only tier that can
  approve/create/edit/delete other **Admin** or **Super Admin** accounts.
  The first account ever created (the one-time bootstrap) is always a
  super admin, since no one else exists yet to grant access.
- **Admin** — creates and assigns leads, reassigns/deletes leads, marks
  attendance, sees every designer's KPIs, and can approve/remove
  **Designer** accounts — but cannot grant Admin or Super Admin access, or
  edit/remove another Admin or Super Admin.
- **Designer** — sees only their own assigned leads, logs follow-ups,
  updates status/quotation/next-follow-up-date/notes on their own leads,
  views their own attendance history and KPI. Cannot reassign or delete
  leads, or mark their own attendance (product decision: attendance is
  admin-marked, not self-check-in).

## Possible future additions

This is deliberately scoped to the "which leads, did they follow up,
attendance, grading" core. Natural next steps if the ecosystem grows: a
Trash Bin / soft-delete for leads, file attachments on leads (e.g.
quotation PDFs), a configurable SLA per lead source, and a settings screen
for admins to tune the KPI weights without editing code.
