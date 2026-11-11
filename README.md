# Filmmaker Dashboard

A Movie Magic–style budgeting app plus the full filmmaker dashboard — budget,
union rates, actuals, script breakdown, shooting schedule, call sheets, props,
visual prep, scene pages, crew, financing and bonds — as a static site on
GitHub Pages. Personal use for **Gabe and Amelia only, not to sell.**

Live (after deploy): https://ughdamnitgabe.github.io/filmmaker-dashboard/

## What it does

- **Dashboard** — money in/out, script progress, schedule, props due soon,
  producer progress, sharing status.
- **Budget** — Feature / Short / Commercial / Blank templates, 27 standard
  accounts, topsheet with % column, detail lines (Qty × X × Rate), fringes,
  taxes, globals that reprice lines, contingency, completion bond, locations.
- **Union Rates 2026-27** — SAG-AFTRA ($257 UPA day to $1,283 Basic day /
  $4,456 week, P&H 22% principals / 21.5% background), DGA, WGA ($92,268 low /
  $173,215 high original incl. treatment), IATSE planning scale. Labeled as a
  **dated snapshot** — editable, verify the current rate sheet before signing.
- **Actuals & Left** — expense ledger, Budgeted / Spent / Left per account and
  overall.
- **Script & Coverage** — upload .txt / .fountain / .fdx or paste, auto scene
  breakdown (characters, locations, props), manual coverage, send cast / props
  / locations to the budget at the right SAG tier.
- **Schedule** — stripboard from the breakdown, industry-standard call sheets,
  Day Out of Days for cast. Schedule ↔ budget two-way sync: shoot days, cast
  days and location days reprice budget lines.
- **Props & Set Pieces** — first-needed date, prep-by date, department, status,
  per-day call-sheet lists.
- **Visual Prep** — mood boards, storyboard / shot lists tied to schedule and
  budget, per-scene look inspiration for the DP (reference stills, mood,
  lighting, color, lens).
- **Scene Pages** — shared scene info plus per-department sections (Wardrobe,
  Art/Props, Camera, Sound, Makeup/Hair) with cross-department notes tagged to
  multiple departments.
- **Crew** — directory, intake form (name, role, phone, email, emergency
  contact, allergies/medical, address), call sheets fed by it.
- **Financing & Bonds** — SAG security deposit auto-calculated from cast
  payroll + P&H (40% planning default, editable, flat guild-letter figure
  option), shown as **locked cash OUTSIDE the grand total**;
  Total Cash Required = budget + deposit. Completion bond as a budget cost.
  Financing sources (equity, pre-sale, tax incentive, gap, crowdfunding, own
  money), deal terms, committed vs received, gap to close, recoupment
  waterfall.
- **Preview / PDF** — industry-standard header, topsheet, full detail, schedule
  & assumptions; browser Print → Save as PDF.
- **Exports** — MMB-style XML (Advanced structure), CSV, tab-delimited. The
  XML is **modeled on Movie Magic Budgeting's published export — it is NOT a
  native .mmb / .mmbx file** (closed proprietary format, no public spec).

## Sharing model — shared with Amelia, same projects

Both Gabe and Amelia see and edit the **same** projects. One shared cloud
library (`filmmaker_libraries`, row `id='shared'`), last-write-wins, no live
both-typing-at-once in v1 — same as Script Builder. This is different from
Script Builder / Story Studio, which keep separate libraries per account.

**Shared-device fix:** signing out pushes a final copy to the cloud, then
**clears the shared library from the device** (a recovery copy is stashed under
the signer's own user id, never shown to the next signer). The next signer
pulls the shared library from the cloud after signing in — Amelia never
inherits Gabe's on-screen copy and vice versa. Work done while signed out is
never auto-pushed; the app asks first.

## Setup (Gabe's steps)

### 1. Supabase — one shared table

Same Supabase project Script Builder uses (`script-builder`,
`https://elnbqrnljdqvjcbpyxne.supabase.co`). In the Supabase Dashboard →
SQL Editor, run `supabase/filmmaker_libraries.sql` — **but first replace
`AMELIA_EMAIL_HERE` in the file with Amelia's real email address.** Until the
SQL is run, the table doesn't exist and sync stays off; the app still works
fully offline/local and nothing is lost (a 403/404 shows a plain setup
message). Do not seed the `shared` row in SQL — the app creates it on first
sign-in push.

### 2. GitHub repo + Pages

1. On github.com/ughdamnitgabe, create a **public** repo named
   **`filmmaker-dashboard`**.
2. Upload the files from this folder to the repo root (`index.html`, `app.js`,
   `style.css`, `icon.svg`, `icon-192.png`, `icon-512.png`,
   `apple-touch-icon.png`, `favicon.ico`) — drag-and-drop web upload, or
   `git push` to `main`.
3. Settings → Pages → Build and deployment → Deploy from a branch → branch
   `main`, folder `/ (root)`. Save.
4. Wait ~1 minute. Live at
   https://ughdamnitgabe.github.io/filmmaker-dashboard/
5. **Verify before calling it live:** open the site, check the page loads and
   the budget total appears. Compare the live `app.js` SHA-256 with the local
   file — they must match. (Do not trust the Pages build badge alone.)
6. iPhone: Share → Add to Home Screen. Mac: drag the tab to the Dock, or
   bookmark it.

### 3. First sign-in (Gabe, then Amelia)

- Each of you signs up with your **own email + password** in the Cloud Sync
  box (same Supabase auth as Script Builder — if you already have an account
  there, the same email/password works).
- Confirm the email via the link Supabase sends, then sign in.
- First sign-in pushes the local library to the shared cloud row; after that,
  sign-in pulls it down. **First real cloud upsert is still unverified in
  production** — the first time you sign in, check that the project list
  appears, sign out, and sign back in to confirm it comes back.

## Updating

Edit the files here, then upload / push the changed files to the repo's
`main` branch. Pages rebuilds in ~1 minute. If the site looks unchanged after
an update, hard-refresh (the Pages CDN caches for a few minutes).

## Tests

`node tests/run.js` — 53 checks: verified calc figures (cast $16,680 +
background $4,620, SAG P&H $4,662.90, deposit base $25,962.90, 40% deposit
$10,385.16, total cash required), template + globals repricing, schedule →
DOOD, financing waterfall, actuals, script parser, sync decisions, exports,
union-rate snapshot values, plus a jsdom DOM smoke test (all 12 tabs render,
new Feature project creates, budget total > 0).

## Honest limits

- **Union rates are a 2026-27 snapshot**, not a live feed. Verify before
  signing anything.
- **MMB XML is modeled, not native.** No tool without a Movie Magic license can
  produce a real .mmbx.
- **Role sharing is a client-side view filter in v1** (Producer sees all;
  Dept Head sees only their department, totals hidden). Do NOT share the shared
  sign-in with dept heads — send them their filtered export/printout instead.
  True separate dept-head accounts need a backend (v2).
- **No public crew-intake link in v1.** Crew use the in-app form, the printable
  blank intake form, or CSV entry. A public form that writes to the shared
  library needs a backend.
- **No live co-typing.** If both of you edit at the same time, the last save
  wins; the conflict panel appears only when timestamps can't decide.
- Sign-out clears the shared library from that device by design (see above).
- The tab bar can overflow horizontally on very small phones; it scrolls.
