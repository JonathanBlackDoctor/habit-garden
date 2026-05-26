# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

습관 정원 (Habit Garden) — a small-group (family/friends) shared habit-tracking PWA. Users check off daily habits and write reflections to earn points that grow plants in a virtual garden. New users sign in with Google and enter a **pending-approval** state until the owner approves them in `/admin`. Faith features (devotion/prayer) are OFF by default for everyone except the owner.

Code, comments, and UI strings are predominantly **Korean**. Match that convention when editing existing files.

## Monorepo layout

pnpm workspace with three packages (`pnpm-workspace.yaml`):

- **`apps/web`** — Vite 5 + React 18 + TypeScript frontend (PWA). Aliases: `@/*` → `src/*`, `shared/*` → repo `shared/`.
- **`functions`** — Firebase Cloud Functions (Node 20, CommonJS, region `asia-northeast3`). Aliases: `shared/*` → repo `shared/`.
- **`shared`** — Source-only TS (no build) imported by both. `shared/types/firestore.ts` is the **single source of truth** for all Firestore document shapes AND the game's economy constants (point prices, plant species, badge defs, seed data). Game-rule logic shared client/server lives in `shared/lib/*` (e.g. `habitPoints.ts`) and `shared/prayerRotation.ts`.

Critical: `shared` is consumed as raw `.ts` by both sides. Both `apps/web` and `functions` define a structurally-compatible `Timestamp` interface and use it from `shared/types`; the runtime value is each environment's SDK Timestamp.

## Commands

Root scripts use pnpm filters. `apps/web` and `functions` also have npm `package-lock.json` files (CI for Pages and the `deploy.bat` script use plain `npm`/`npx` inside the package dirs — don't assume pnpm everywhere).

```bash
# Web dev server (Vite, connects to emulators in DEV mode)
pnpm --filter web dev            # or: cd apps/web && npm run dev

# Build
pnpm --filter web build          # tsc -b && vite build
pnpm --filter functions build    # tsc → functions/lib

# Typecheck web only
pnpm --filter web typecheck      # tsc --noEmit

# Tests (Vitest). The web vitest config ALSO globs ../../shared/**/*.test.ts,
# so this runs both web and shared tests.
pnpm --filter web test                              # vitest run (once)
pnpm --filter web test:watch                        # watch mode
cd apps/web && npx vitest run src/features/prayers/parseQuickAdd.test.ts   # single file
cd apps/web && npx vitest run -t "name of test"     # by test name

# Local full-stack dev (Firebase Emulator) — three terminals
cd functions && npm run build:watch
firebase emulators:start
cd apps/web && npm run dev
```

There is no linter configured. `firebase.json` defines emulator ports (auth 9099, functions 5001, firestore 8080, hosting 5000, storage 9199, UI 4000); `apps/web/src/lib/firebase.ts` auto-connects to these when `import.meta.env.DEV`.

## Deployment

Two independent deploy paths — **frontend and backend deploy separately**:

- **Frontend → GitHub Pages**: `.github/workflows/pages.yml` builds `apps/web` and deploys on push to `main`. Public URL: `https://jonathanblackdoctor.github.io/habit-garden/`. Because of this, Vite `base` is `/habit-garden/` and the app uses `HashRouter`.
- **Backend → Firebase**: `.github/workflows/firebase-deploy.yml` (manual `workflow_dispatch` only) deploys `functions,firestore,storage` to project `planner-web-quick`. Hosting is intentionally NOT deployed here.
- `deploy.bat` (Windows) does a full manual `firebase deploy` of everything.

Functions need the `GEMINI_API_KEY` secret (`firebase functions:secrets:set GEMINI_API_KEY`). Web env vars live in `apps/web/.env` (`VITE_FIREBASE_*` — public Firebase config).

## Architecture

### Auth & approval gate
`apps/web/src/lib/auth.ts` owns auth. `useAuth()` runs once (mounted via `AuthInit` in `App.tsx`) and subscribes to `userProfiles/{uid}` and `users/{uid}/settings/main`, pushing into the Zustand store. Flow:
- Google sign-in self-creates a `userProfiles/{uid}` doc with `status:'pending'`; the owner (hardcoded `OWNER_UID` in `auth.ts`, also in `firestore.rules`) self-approves immediately.
- Anonymous "guest" sign-in (`signInAsGuest`) seeds a few demo habits and does NOT create a profile doc (keeps the approval queue clean). `upgradeGuestWithGoogle` links the anonymous account to Google to preserve the uid (and migrates data via `lib/migrate.ts` if the Google account already exists).
- `ProtectedRoute` gates routes; `/pending` shows for unapproved users.

### Store & the uid indirection (important)
`apps/web/src/lib/store.ts` (Zustand) holds session state. There are **two uids**:
- `realUid` — the actual auth uid; use for owner checks and auth logic.
- `uid` — the **effective data-path uid**. When sandbox mode is on, this becomes `${realUid}__sandbox`, namespacing every Firestore path so developer testing never touches real data.

Always read data paths with `uid`, not `realUid`. Hooks subscribe via `useAppStore((s) => s.uid)`.

The store also drives UI-only reward feedback: combo counter, `rewardedHabitIds` (one celebration per habit per day), `celebrationKind`, and `levelUp` modal triggers.

### Data layer (no repository abstraction)
Feature hooks live in `apps/web/src/features/<domain>/use*.ts` and talk to Firestore directly via the modular SDK (`onSnapshot` for realtime reads, `setDoc`/`deleteDoc` for writes). `lib/firebase.ts` exports `auth`, `db`, `functions`, `storage` and enables IndexedDB persistence. State management is React Query (`staleTime: 30s`) + Zustand + raw `onSnapshot` subscriptions — pick the pattern that matches the surrounding feature.

### Points economy is server-authoritative
**Clients never write point totals.** Cloud Function triggers compute and credit all points/XP/streaks/badges. The client mirrors the same formulas (via `shared/lib/habitPoints.ts`) only for optimistic toast/animation feedback.

Key trigger: `functions/src/awardEngine.ts` (`onWrite` of `habitChecks`). It uses a **delta-based ledger**: `DayDoc.habitBasePointsCurrent[habitId]` stores each habit's current base points, and only `(current − previous)` is credited/debited. This makes score changes and un-checks idempotent — toggling 1↔5 repeatedly converges instead of inflating. Daily caps (`HABIT_DAILY_CHECK_CAP`, etc.) apply only to positive deltas. `successAwarded`/`prayerCountedIds`-style flags on `DayDoc` are one-shot idempotency gates so streaks/bonuses pay out once per day.

`creditPoints` writes a `pointLedger` entry, increments `progress`, then calls `applyLevelUps` (`levelEngine.ts`). Awarding a habit also triggers `growRandomPlant` (`gardenAutogrow.ts`).

Other function entry points (`functions/src/index.ts`): `reflectionAward`, `generateFeedback` (Gemini AI day feedback, callable), `monthlyBackup`, prayer functions (`parsePrayerBulk`, `findDuplicatePrayers`, `generatePrayerWeekly`, `prayerAward`), `todoAward`, `aiCoach`, FCM reminders (`sendScheduledReminder`, `flushReminderQueue`), `morningBrief`, and profile management (`ensureUserProfile`, `approveUser`, `listPendingUsers`). Gemini calls go through `geminiUtil.ts`.

### Scheduled reset
`functions/src/dailyReset.ts` runs at **04:00 KST** (`pubsub.schedule`, `Asia/Seoul`). The 04:00 boundary defines the "planner day": all date keys are `YYYY-MM-DD` computed by `apps/web/src/lib/dayBoundary.ts` `plannerDate()` (subtracts 4h before formatting in KST). Use `plannerDate()`/`formatKoreanDate()` rather than raw `new Date()` for any day-bucketing logic. The reset finalizes yesterday, settles the global streak, advances the garden (`processDailyGarden`), recomputes prayer rotation/dormancy, and generates AI day feedback.

### Firestore data model
All user data is under `users/{uid}/...` (subcollections: `habits`, `days/{date}` with nested `habitChecks`/`prayerChecks`, `prayers`, `reflections`, `badges`, `pointLedger`, single docs `progress/main` + `settings/main`). `userProfiles/{uid}` is the only top-level collection. Security rules (`firestore.rules`) allow a user RW only on their own `users/{uid}` tree (or the owner on anyone's); premium/AI gating (`status == 'approved'`) is enforced inside callable functions, not rules. See `useIsPremium`/`useIsGuest`/`useFaithEnabled` in `lib/features.ts`.

### Garden game system
Plant species, rarities, traits, costs, and daily yields are all data-defined in `PLANT_SPECIES` (`shared/types/firestore.ts`). Traits (`PlantTrait` union) encode passive behaviors interpreted by the garden functions — e.g. `bloomer` auto-grows daily, `brittle`/`fragile`/`waning`/`regress`/`radiant` are "fragile legendary" plants that die or regress when you slack, and `transcendent` plants charge daily upkeep and die after a single missed day. When tuning the economy, edit these constants/defs rather than scattering magic numbers.

## Routing
`App.tsx` defines all routes under `HashRouter`. Public: `/login`, `/pending`. Inside `ProtectedRoute` + `AppLayout`: `/` (Main), `/habits`, `/reflection`, `/garden`, `/prayers`, `/progress`, `/condition`, `/planner`, `/devotion`, `/more`, `/tutorial`, `/day/:date` (PastDay). `/admin` is protected but outside `AppLayout`.

## Reference docs
`docs/` contains the original Korean planning docs and mockups (e.g. `05_기도제목_시스템_설계.md` is the prayer-system spec the rotation/points constants implement). `README.md` has the points-economy summary table and first-run instructions.
