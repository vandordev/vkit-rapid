# Oriskin Task Management Design

## Goal

Replace the IT department spreadsheet workflow with an internal Oriskin work-management system. It is the source of truth for planned delivery and operational follow-up, while owners receive weekly and monthly Excel reports rather than application access.

The existing `FS TO Timeline` sheet is a reporting reference only. The application owns the underlying data and produces the timeline automatically.

## Scope

The MVP covers:

- FS and TO task planning, approval, execution, and closure.
- Projects, Oriskin systems/product areas, teams, and multiple task assignees.
- Development-issue intake and triage for bugs or change requests discovered by the Solution team.
- Weekly planning, Gantt timeline, task dependencies, and task-status history.
- Lightweight Solution activity recording without timesheets.
- Daily huddles, notes, resource references, and action-item conversion into work items.
- Weekly and monthly Excel exports for owners.
- Root-level, per-application environment configuration.

GitHub sync is explicitly a phase-two module. The MVP does not connect to GitHub or the production ticketing database.

The first delivery phase is repository cleanup: retain Elysia and `/health`, move internal Next.js handlers to `/nextapi/*`, reserve `/api/*` for external Elysia routes, and remove obsolete SleekFlow console coupling after external contracts are inventoried.

## API Boundaries

Internal Next.js operations use tRPC under `/nextapi/trpc/*`. Elysia remains an independently deployable external boundary under `/api/*` and currently exposes only `/health`. Eden is reserved for consumers of Elysia; the same resource is not implemented twice through tRPC and Eden. Mutations call shared command usecases. Queries may call Prisma or another infrastructure client directly from their owning tRPC procedure or Elysia route so each transport can optimize its own read shape. UI components never access infrastructure directly.

## Domain Model

### Organisation and context

`User`, `Team`, `TeamMembership`, `System`, and optional `Project` are shared context records. Systems represent the products and applications in the Oriskin landscape. Projects group larger initiatives; a task may be associated with a system without belonging to a project.

### Tasks

`Task` is the common delivery entity and has a required `type`:

- `FS` (Feature Specification): feature delivery. A Feature Specification document is required before approval; a Feature Result document is optional after delivery.
- `TO` (Task Order): bug fixing, data requests, operational instructions, and other non-feature delivery.

Each task has a code, title, description, system, optional project, primary PIC, multiple assignees, planned start and target dates, priority, progress, current status, blocker information, and completion information. Tasks can have optional subtasks using the same task model with a parent reference.

`TaskDocument` holds document metadata and file references, using explicit document kinds `feature_specification`, `feature_result`, and `attachment`. File storage implementation is separate from the task data model.

### Planning and baselines

`PlanningPeriod` represents a weekly or monthly planning window. `TaskCommitment` links a task to a planning period and records its agreed start date, target date, assignees, and scope snapshot. This preserves the commitment baseline when a lead later changes delivery details or grants an extension.

Reports calculate the current status from the task, its commitment baseline, dates, and lead decisions:

- `Selesai`
- `Berkelanjutan`
- `Extend`
- `Tidak Sesuai Jadwal`

### Dependencies and blockers

`TaskDependency` represents a directed, internal finish-to-start dependency: the successor is blocked by the predecessor until the predecessor is done. The write path rejects self-references and cycles. The Gantt view renders these relationships and identifies tasks at risk when their predecessor is blocked, extended, or overdue.

External conditions remain normal `TaskBlocker` records. They are not represented as artificial tasks or dependencies.

### Development issues

`DevelopmentIssue` is a standalone engineering backlog item. It is created manually when the Solution team discovers a bug or change need. It records the affected system, summary, evidence, requested priority, impact, and reporter.

A lead triages it as rejected, workaround, backlog, or scheduled. A scheduled issue can create an FS or TO task while retaining provenance. There is no database, API, or synchronization relationship with the existing production ticketing system. A ticket URL or ID is optional free-form traceability only.

### Solution activity

`SolutionActivity` records support work without duration tracking: system, category, PIC, status, note, and result. It is intended for volume, queue, and activity reporting, not time-based performance measurement. Categories initially include incident, request, maintenance, and routine.

### Daily huddles and notes

`DailyHuddle` stores its date, team, facilitator, participants, notes, decisions, blockers, and action items. `WorkNote` stores structured or free-form notes and can originate from a huddle or stand alone.

`ResourceLink` is a controlled polymorphic reference between a huddle/note and a task, development issue, project, or solution activity. `HuddleActionItem` may be completed in place or converted into a draft FS, TO, or Development Issue. The created resource stores its origin link so both directions remain discoverable.

## Workflow and Access

1. A member creates a draft FS/TO proposal with scope, assignees, planned dates, constraints, and the required FS document for an FS.
2. A lead, manager, or Head IT approves or rejects the proposal. Approved work is assigned to its planning period and becomes visible on the timeline.
3. A lead may directly adjust active work, including schedule, assignees, scope, and dependencies. The system records an audit event and retains the commitment baseline.
4. Assignees update progress, blockers, and work notes. Only a lead can mark a task done or cancelled.
5. Solution personnel record activity and create development issues when support reveals work that needs engineering delivery.
6. Huddle action items can become draft work items and follow the same approval path.

Roles:

- `member`: create and edit own drafts, update assigned work, create issues, activities, huddles, and notes.
- `lead`: all member actions plus triage, approval, scheduling, dependency management, direct task edits, and task closure for their scope.
- `manager` and `head_it`: cross-team visibility and approval. Active execution changes remain lead-owned in the MVP.
- `admin`: manages users, teams, systems, projects, and report configuration.

## Interface

The first screen is the operational workspace:

- **My Work**: assigned work, current-week targets, blockers, and pending actions.
- **Weekly Plan**: the primary Gantt view, grouped by team, PIC, system, or project. Bars show FS/TO type, progress, status, current-day marker, and dependency lines. Subtasks render as child bars.
- **Issues**: development-issue intake and lead triage queue.
- **Projects & Systems**: context and navigation for the Oriskin application landscape.
- **Solution Activity**: manual support activity and queue view without a duration field.
- **Daily Huddles**: meeting notes, decisions, linked resources, and action items.
- **Approvals**: pending FS/TO proposals for the applicable approvers.

The MVP includes dependency visualization but not drag-and-drop scheduling, automatic rescheduling, dependency types beyond finish-to-start, or critical-path calculation.

## Reporting and Excel Export

Exports are created for a selected weekly or monthly period. A `ReportExport` persists the selected period, filters, generation timestamp, actor, and snapshot metadata so sent reports can be reproduced.

Every report contains:

1. **Executive Summary**: high-level delivery, delay, blocker, and Solution activity measures.
2. **FS/TO Timeline**: an owner-friendly, per-PIC schedule derived from commitments.
3. **Timeline**: a compact Excel Gantt view, including dependency and at-risk information.
4. **Delivery Detail**: task/project/system, PIC, status, progress, baseline dates, actual dates, and concise notes.
5. **Blocked and At Risk**: blockers, delayed predecessors, and their impact.
6. **Development Issues**: triage state and resulting delivery task, where applicable.
7. **Solution Activity**: activity volume grouped by system, category, and PIC.

The summary deliberately excludes unnecessary technical detail. FS/FR documents, audit history, and later GitHub evidence remain available internally.

## Configuration

Environment files live only at repository root:

```text
.env.api
.env.web
.env.api.example
.env.web.example
```

The real files are ignored by Git. Elysia/external-boundary values stay in `.env.api`. The Next.js server runtime, including tRPC's server-side `DATABASE_URL`, uses `.env.web`; only variables prefixed `NEXT_PUBLIC_` are exposed to the browser bundle. `.env.web` is therefore not a browser-only file.

Application scripts explicitly load their respective root environment file. Docker Compose uses a separate `env_file` for each service. Web values needed by Next.js client bundles must be available at build time as well as container runtime. The old `apps/api/.env` is removed after its contents are migrated to root `.env.api` so there is a single source for each application's configuration.

## GitHub Phase Two

GitHub data is evidence attached to engineering tasks, not a second task system. A later module will store repository, commit, pull request, issue, review, and task-link data in the same PostgreSQL database under a distinct table prefix. It can auto-link an Oriskin task code appearing in branch names, pull-request titles, or commit messages.

The phase-two integration uses a dedicated, read-only fine-grained PAT or GitHub App credentials, stored only in server-side configuration. It does not determine task completion; lead closure remains authoritative.

## Error Handling and Audit

- Approval rejects FS proposals without the required FS document.
- Dependency writes reject cycles and missing tasks.
- Permissions are enforced server-side for every state transition.
- File upload, Excel generation, and data validation failures return actionable UI errors and do not partially transition work state.
- Task edits, approvals, status changes, dependency edits, document changes, and exports create immutable audit events.

## Verification

Tests cover:

1. FS/TO proposal validation and role-based approval.
2. Mandatory FS versus optional FR document handling.
3. Multiple assignees, lead-only closure, and audit history.
4. Planning baseline preservation after an extension or schedule edit.
5. Dependency cycle rejection and Gantt at-risk derivation.
6. Development-issue triage and conversion with provenance.
7. Huddle/note references and action-item conversion in both directions.
8. Solution activity reporting without duration fields.
9. Weekly/monthly Excel export values, required sheets, status grouping, and timeline output.
10. Explicit root environment-file loading in local and Docker paths, with no API secret exposed to the web bundle.

## Non-Goals

- Integration with, querying, or writing to the production ticketing database.
- Timesheets, time logging, or automated productivity scoring.
- Full Jira/Linear-equivalent planning, including drag-and-drop scheduling or critical-path calculation.
- Real-time chat or collaboration messaging.
- GitHub synchronization and engineering-health analytics in the MVP.
