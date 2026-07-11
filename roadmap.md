# Oriskin Task Management Roadmap

This roadmap turns the approved design into an incremental delivery sequence. The target is an internal Oriskin work-management system that produces owner-ready weekly and monthly Excel reports. The existing SleekFlow gateway is not the product boundary for task management.

## Architecture Decision

```text
Next.js internal UI
  -> tRPC (/nextapi/trpc/*)
  -> Usecase layer
  -> Database

External backend
  -> Elysia (/api/*)
  -> Usecase layer when an external endpoint is needed
```

Elysia remains in the repository and exposes `/health`. Its `/api/*` namespace is reserved for external integrations. tRPC is the only transport for internal Next.js task-management operations. Eden remains available for future consumers of Elysia; the same resource must not be implemented twice through tRPC and Eden.

## Phase 0 — Cleanup and Boundary Reset

### Objective

Make the repository safe to evolve from a SleekFlow console into Oriskin Task Management without accidentally deleting external contracts or exposing production secrets.

### Work

- Inventory every current SleekFlow route, webhook, outbound operation, database table, UI page, environment variable, deployment rule, and external consumer.
- Freeze the current external contract and record which routes must remain available during cutover.
- Keep `apps/api` and Elysia, but reduce the active API surface to `/health` after the contract migration is approved.
- Move Next.js internal handlers from `/api/*` to `/nextapi/*`, including tRPC, auth callbacks, and backend proxy handlers.
- Reserve `/api/*` for Elysia; remove the Next.js rewrite that sends internal `/api/*` calls to the gateway.
- Remove the SleekFlow gateway console pages, navigation, resource routers, and gateway-specific client code once replacements are available.
- Keep `docs/*.xlsx` as source reference artifacts. Do not treat them as runtime data.
- Move local configuration to root `.env.api` and `.env.web`, add tracked examples, and remove the duplicate `apps/api/.env` source.
- Remove SleekFlow-specific environment validation and documentation only after the external-contract inventory confirms they are no longer needed.
- Preserve existing production database data during the transition. Do not drop or mutate legacy SleekFlow tables as part of cleanup.
- Update README, Dockerfiles, Compose files, deployment routing, and health checks to describe the new boundaries.

### Exit criteria

- No internal Next.js request uses `/api/*`.
- Elysia responds successfully on `/health` and has no unreviewed route removal.
- No secrets are committed or bundled into the web application.
- `bun run build`, `bun run lint`, and `bun run check-types` pass.
- A written cutover note identifies retained, retired, and deferred SleekFlow contracts.

## Phase 1 — Platform Foundation

### Objective

Establish the application shape that all task features use.

### Work

- Implement explicit root environment loading for local Bun, Next.js, Docker Compose, and production deployment.
- Keep the existing SSO/authentication integration, but map authenticated identities to application users and roles.
- Create a command-usecase boundary between tRPC procedures and infrastructure clients. Query procedures may call Prisma or another infrastructure client directly when their read shape is transport-specific.
- Add shared error types, authorization helpers, audit-event primitives, pagination, filtering, and date/period conventions.
- Add a database migration strategy that introduces task-management tables without destructive changes to legacy tables.
- Create the tRPC route at `/nextapi/trpc/*` and update the client provider and tests.

### Exit criteria

- A protected internal tRPC procedure can authenticate, authorize, call a usecase, and read/write through a repository.
- Elysia remains independently health-checkable.
- Authorization failures and validation errors have stable UI-safe responses.

## Phase 2 — Organisation and Context Master Data

### Objective

Model the people, teams, systems, and projects shown in the Oriskin structure diagram.

### Work

- Add users, teams, team memberships, role assignments, systems/product areas, and optional projects.
- Add admin screens and procedures for maintaining master data.
- Seed an initial system catalogue and teams from the approved workbook/diagram after confirming names with the business owner.
- Add scoped visibility rules for team and cross-team work.

### Exit criteria

- A user can be assigned to a team and role.
- A task can consistently reference a system, project, team, and people without free-text-only identity fields.

## Phase 3 — Core FS/TO Task Workflow

### Objective

Replace spreadsheet entry with approved, traceable task management.

### Work

- Implement one `Task` entity with `FS` and `TO` types.
- Add drafts, multiple assignees, primary PIC, priority, dates, constraints, progress, blocker notes, status, and subtasks.
- Require a Feature Specification document for FS approval; support optional Feature Result documents after delivery.
- Implement member submission and lead/manager/head-IT approval or rejection.
- Allow lead edits to active work and record immutable audit events.
- Restrict task closure and cancellation to the lead.
- Add task detail, create/edit, approval queue, and My Work screens.

### Exit criteria

- A member can submit a complete FS/TO proposal.
- An approver can approve/reject it with validation and an audit trail.
- A lead can change an approved task and close it while the original commitment remains recoverable.

## Phase 4 — Planning, Baselines, Gantt, and Dependencies

### Objective

Turn approved work into a reliable weekly timeline and preserve the difference between a commitment and a later plan change.

### Work

- Add weekly and monthly planning periods and task commitment baselines.
- Build the Weekly Plan Gantt view grouped by team, PIC, system, or project.
- Render progress, FS/TO type, status, current-day marker, subtasks, and finish-to-start dependency arrows.
- Add dependency creation, cycle detection, predecessor impact, blocked/at-risk derivation, and audit history.
- Derive `Selesai`, `Berkelanjutan`, `Extend`, and `Tidak Sesuai Jadwal` from baseline dates and lead decisions.
- Defer drag-and-drop rescheduling, automatic date propagation, other dependency types, and critical-path calculation.

### Exit criteria

- A baseline is not overwritten by a lead extension.
- Cyclic dependencies cannot be saved.
- A late or blocked predecessor makes affected work visible as at risk.
- The Gantt view matches the approved planning data at weekly and monthly scales.

## Phase 5 — Development Issues and Solution Activity

### Objective

Capture Solution work and allow engineering changes to emerge from it without integrating the production ticketing database.

### Work

- Add standalone Development Issues with system, summary, evidence, impact, requested priority, reporter, and triage status.
- Let leads triage to rejected, workaround, backlog, or scheduled.
- Convert a scheduled issue into an FS/TO task while retaining provenance.
- Add manual Solution Activity records with system, category, PIC, status, note, and result; do not add duration/timesheet fields.
- Add volume, queue, system, category, and PIC views for Solution work.
- Keep optional ticket ID/URL as a free-form traceability field only; do not connect to or query the production ticketing database.

### Exit criteria

- A Solution member can record activity and create a development issue.
- A lead can triage and convert an issue without copying it into a second unrelated record.
- Reports can distinguish Solution activity from delivery tasks.

## Phase 6 — Daily Huddles, Notes, and Action Items

### Objective

Turn daily coordination into traceable context without forcing every discussion into a task.

### Work

- Add daily huddles, participants, facilitator, notes, decisions, blockers, and action items.
- Add structured/free-form work notes and controlled resource links to tasks, issues, projects, and Solution activities.
- Convert an action item into a draft FS, TO, or Development Issue.
- Show huddle and note provenance from the created resource and reverse references from the resource back to the huddle.
- Add a compact daily huddle workflow optimized for fast entry.

### Exit criteria

- A huddle can reference existing resources and create new work without data duplication.
- A task/issue detail page shows relevant huddles and notes.

## Phase 7 — Owner Reports and Excel Export

### Objective

Make reporting a first-class product capability that replaces manual spreadsheet assembly.

### Work

- Add weekly and monthly report period selection, filters, permissions, and export history.
- Generate a reproducible report snapshot.
- Produce owner-friendly sheets: Executive Summary, FS/TO Timeline, Timeline Gantt, Delivery Detail, Blocked and At Risk, Development Issues, and Solution Activity.
- Preserve the semantics of the existing `FS TO Timeline` sheet while replacing manual cells with derived data.
- Add Excel formatting, frozen headers, filters, conditional status colors, readable widths, and dependency/at-risk indicators.
- Verify exported values and visual layout against representative weekly and monthly fixtures.

### Exit criteria

- A lead can generate both weekly and monthly reports without spreadsheet manipulation.
- The report can be reproduced from its saved snapshot metadata.
- The primary timeline is legible at normal Excel zoom and includes dependencies.

## Phase 8 — Hardening, Migration, and Acceptance

### Objective

Make the system deployable and safe for the first real team rollout.

### Work

- Import agreed historical FS/TO records from the workbook using a reviewed mapping, without importing presentation-only cells.
- Add seed/reference data for systems, teams, statuses, and categories.
- Run authorization, dependency, export, migration, and route-boundary tests.
- Add backup/restore and migration runbooks; validate them against a non-production database.
- Perform a production-readiness review for secrets, logs, health checks, Docker images, database indexes, and report generation limits.
- Pilot with the IT lead and one Solution workflow, reconcile reports against the spreadsheet, then expand team by team.
- Decommission legacy SleekFlow console routes only after the external contract and pilot acceptance checks pass.

### Exit criteria

- Pilot reports reconcile with the agreed spreadsheet baseline.
- Rollback and restore procedures are tested.
- No production ticketing database access is required by the MVP.
- The team accepts the task, approval, huddle, and export workflows.

## Phase 9 — GitHub Evidence Module (Phase Two)

### Objective

Attach technical evidence to engineering tasks after task management is stable.

### Work

- Add repositories, GitHub users, commits, pull requests, issues, reviews, and task links in the same database.
- Support a dedicated read-only fine-grained PAT or GitHub App credentials stored server-side.
- Sync selected repositories and auto-link Oriskin task codes from branch names, pull-request titles, and commit messages.
- Add evidence to internal task detail and a separate engineering-health view.
- Keep lead closure authoritative; GitHub activity never auto-marks a task done.

### Exit criteria

- GitHub evidence is linked to existing tasks without creating a second planning system.
- Sync failures are isolated and observable.
- Owner reports expose only the agreed business-level evidence.

## Cross-Phase Rules

- Usecases own business decisions; tRPC and Elysia only adapt transport concerns.
- Mutation usecases own state-changing business rules. Query procedures/routes may own their Prisma or infrastructure read queries; UI components never access infrastructure directly.
- Every state-changing workflow has authorization, validation, and audit coverage.
- No phase may query or mutate the production ticketing database.
- No destructive legacy-table migration occurs without a backup, verification, and explicit cutover decision.
- Each phase must leave the repository buildable and deployable.

## Delivery Order Summary

```text
Cleanup
  -> Foundation
  -> Master data
  -> FS/TO workflow
  -> Planning + Gantt + dependencies
  -> Development issues + Solution activity
  -> Daily huddles + notes
  -> Excel reports
  -> Hardening + pilot
  -> GitHub evidence (phase two)
```
