# Studio Leads

A lead-tracking and staff-accountability app for an interior design firm:
who has which lead, did they follow up on time, did it close — plus daily
attendance and a KPI/grading dashboard that turns both into one "Commitment
Score" per designer.

This is a **separate app** from Terence's Journal (the sibling app one
level up) — its own codebase, its own Firebase project, its own login.
It's published on the same GitHub Pages site as the journal, just at a
different path (`/design-leads/`), so one repo/Actions setup serves both.

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
  On Leave / Absent per day; designers see their own history (read-only).
- **KPI & Grading** — see "Grading model" below.
- **Role-scoped visibility** — designers only ever see their own leads and
  attendance (enforced in `firestore.rules`, not just hidden in the UI);
  admins see everything and are the only ones who can create/assign/delete
  leads or mark attendance.
- **User Management** (admin only) — same self-signup + admin-approval flow
  as the journal app: the first person to open the app bootstraps as admin;
  everyone else requests access and an admin approves them as
  Admin or Designer.

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

Same shape as Terence's Journal: React 18 + Vite + TypeScript + Tailwind,
Firebase Authentication + Cloud Firestore called directly from the browser
(no backend server), TanStack React Query for data fetching. See the root
README for the general pattern this was built from.

## Getting started

### 1. Set up a Firebase project (separate from the journal's)

Same steps as the root README's "Set up Firebase" section, but create a
**new, separate Firebase project** — Studio Leads should not share a login
or database with Terence's Journal:

1. [Firebase Console](https://console.firebase.google.com) → **Add
   project**.
2. **Build → Authentication → Sign-in method** → enable **Email/Password**.
3. **Build → Firestore Database → Create database** → **Native mode**.
4. **Project settings → General → Your apps** → register a web app → copy
   the six `firebaseConfig` values.

### 2. Publish Firestore rules

**Build → Firestore Database → Rules** → paste in `firestore.rules` from
this folder → **Publish**.

### 3. Run locally

```bash
cd design-leads
npm install
cp .env.example .env
# paste the firebaseConfig values into the VITE_FIREBASE_* vars
npm run dev
```

Open `http://localhost:5174` (a different port from the journal app so you
can run both at once) and create the first admin account.

## Deploying

This app is folded into the same GitHub Pages deploy as Terence's Journal
(`../.github/workflows/deploy.yml`). To turn it on:

**Repo Settings → Secrets and variables → Actions → Variables**, add the
six values from step 1 above, prefixed `DESIGN_LEADS_`:

- `DESIGN_LEADS_VITE_FIREBASE_API_KEY`
- `DESIGN_LEADS_VITE_FIREBASE_AUTH_DOMAIN`
- `DESIGN_LEADS_VITE_FIREBASE_PROJECT_ID`
- `DESIGN_LEADS_VITE_FIREBASE_STORAGE_BUCKET`
- `DESIGN_LEADS_VITE_FIREBASE_MESSAGING_SENDER_ID`
- `DESIGN_LEADS_VITE_FIREBASE_APP_ID`

Until those are set, the workflow skips building this app and only deploys
the journal, so it's safe to merge before you've set up Firebase for this
one. Once they're set, the next push to `master` publishes Studio Leads at
`https://<your-github-username>.github.io/terences-journal/design-leads/`.

Don't forget **Firebase Console → Authentication → Settings → Authorized
domains** → add your `github.io` URL, same as the journal app.

## Roles

- **Admin** — creates and assigns leads, reassigns/deletes leads, marks
  attendance, approves/removes users, sees every designer's KPIs.
- **Designer** — sees only their own assigned leads, logs follow-ups,
  updates status/quotation/next-follow-up-date/notes on their own leads,
  views their own attendance history and KPI. Cannot reassign or delete
  leads, or mark their own attendance (see "Attendance" above).

## Possible future additions

This is deliberately scoped to the "which leads, did they follow up,
attendance, grading" core. Natural next steps if the ecosystem grows:
a Trash Bin / soft-delete for leads (mirroring the journal app's), file
attachments on leads (e.g. quotation PDFs), a configurable SLA per lead
source, and a settings screen for admins to tune the KPI weights without
editing code.
