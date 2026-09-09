---
name: send2u-dev
description: "Send2U project development workflow. Load for EVERY Send2U implementation task (features, fixes, refactors, Supabase/database/auth/navigation/API/dependency/config work). Enforces: read changelog.md before coding, inspect existing implementation, run the mandatory validation-and-correction loop, and record the change in changelog.md before reporting completion."
metadata:
  author: send2u
  version: "1.0.0"
  scope: project
---

# Send2U Development Continuity

Persistent change-tracking and validation workflow for the Send2U Expo React Native project. Applies for the whole project lifecycle (requester ordering, helper delivery, vendors, admins, order lifecycle, verification, ratings, payments, realtime, future university services).

## Core rule

Every meaningful change to the Send2U project must be recorded in `changelog.md` at the repo root.

- Read the relevant `changelog.md` entries **before** starting implementation work.
- Update `changelog.md` **after** changes are implemented and validated.
- Never blindly overwrite it. Preserve previous entries; append new ones.
- `changelog.md` is persistent project context, not a scratch pad.

## Mandatory task workflow

For every implementation task, follow these steps in order:

1. Read `changelog.md` (relevant entries) before changing code.
2. Inspect the current implementation relevant to the task (source, schema, migrations, config).
3. Determine what already exists; do not duplicate or contradict prior work.
4. Implement the requested task. Do not redesign unrelated functionality or add unrelated dependencies.
5. Run the validation and correction loop (below). Fix every actionable issue found.
6. Update `changelog.md` with the completed change.
7. Run a final validation pass after the changelog update.
8. Only then report the task as complete.

## What to record

Record meaningful changes: features, modifications, bug fixes, refactors, database/schema changes, Supabase changes (auth, policies, functions, triggers, storage, config), navigation, API/service, dependency, configuration, and security-related changes; important architectural/implementation decisions; known limitations; removed or deprecated functionality.

Do not record trivial formatting or insignificant edits. Communicate what changed and why it matters.

### Entry format

Use a consistent chronological format. Prefer:

- Date (`YYYY-MM-DD`)
- Area affected (e.g. `auth`, `db`, `navigation/requester`, `config`)
- Change (what was done)
- Reason / purpose (why it matters)
- Important implementation details (concise; no large code pastes)
- Validation status (which checks ran and whether they passed)
- Known limitations, if any

Example:

```md
## 2026-09-09 — Auth: anonymous dev entry via Supabase

- Change: `(auth)/sign-in` now creates a real anonymous Supabase session and
  stores the role in `send2u_profiles`; removed email/password placeholder UI.
- Reason: credential-free development entry with a valid `auth.uid()`.
- Details: `services/auth.ts` (`signInAnonymously`, profile upsert on
  `auth.uid()`); dev UI gated by `EXPO_PUBLIC_SEND2U_DEV_AUTH=1`.
- Validation: `tsc`, `eslint`, `expo-doctor` 18/18, `expo export -p web` — pass.
- Known limitation: Supabase "Allow anonymous sign-ins" toggle still pending.
```

### Supabase and migrations

When Supabase MCP modifies the database, auth config, policies, functions, triggers, or other backend resources, record what changed and why. When migrations are created, record the migration name/version and its purpose at a high level — the changelog explains the evolution of the database; migration files remain the source of truth. Never record secrets, keys, tokens, or credentials.

### Bug fixes

Record what was broken, the cause if known, and what was changed to fix it. Keep it concise.

### Decisions

Record implementation decisions that constrain future work (auth approach, role model, status model, dependency choice, navigation behavior, Supabase communication patterns). Skip insignificant details.

## Mandatory validation and correction loop

"Code written" is not "task completed". For every implementation task:

1. Inspect the changes made.
2. Run TypeScript checks (`npx tsc --noEmit`).
3. Run linting (`npx eslint .` / `expo lint`).
4. Run relevant tests if the project has them.
5. Run relevant Expo validation (`npx expo-doctor`; `npx expo export -p web` when navigation/bundling is affected).
6. Inspect for runtime, navigation, dependency, configuration, and integration problems (imports, routes, env, Supabase project/RLS alignment).
7. Fix actionable problems found; repeat validation until clean.
8. Update `changelog.md`; run a final validation pass.
9. Only then report completion.

Distinguish environmental failures from implementation errors and document them instead of chasing them. Never claim a check passed without running it. Do not endlessly chase harmless warnings.

## Continuity

Use `changelog.md` to understand what exists, past decisions, known limitations, recent fixes, Supabase changes, and current direction. But it is not the sole source of truth: source code, schema, migrations, config, tests, and actual project state are authoritative. If the changelog conflicts with reality, inspect the implementation and correct the changelog.
