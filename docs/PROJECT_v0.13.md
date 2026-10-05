# PROJECT.md

**Version:** 0.13 (Priority Reinstated as an Urgency Score Input; Course Name Field Unified Across Task Sources)
**Status (v0.13):** Two targeted changes, no new integrations or services. (1) The manual Priority field (Low / Medium / High), removed in v0.8, is reinstated following advisor feedback: because the Urgency Score was derived only from time, progress, and activity signals, long and large projects ranked below short tasks no matter how important they were, and the user had no way to say so. Priority now returns as an optional, user-set field, but only as one bounded component (weight 0.2) of the Urgency Score rather than as a standalone sort key, so the Urgency Score remains the sole signal driving Task Board's default ordering (Sections 9.3, 9.5). The Urgency Score weights are re-balanced accordingly. (2) A specification inconsistency is fixed: Section 14.3 referred to a `course_name` value on `tasks`, but the data model (Section 19) only had `classroom_course_name`. The field is renamed to `course_name` and now applies to tasks from every source, so manual and LINE-created tasks have somewhere to store their course (Section 19). Nothing else changes: no change to Deadline State, the Dashboard metrics, notifications, Classroom, LINE flow steps, Pomodoro, or sync mechanics.

**Version:** 0.12 (LINE Integration Added — Task Creation via Structured Chat Flow, Deadline Notifications via Cloud-Scheduled Push)
**Status (v0.12):** Adds a new external integration, independent of Google Classroom, addressing two gaps flagged during scope review: (1) the app only automatically captures assignments from Google Classroom, while Section 3 lists five other sources (verbal announcements, Microsoft Teams, Discord, Facebook, Line) that had no capture path at all; (2) desktop notifications only fire while the app is running (Section 11.2's known limitation), so a student who doesn't open their laptop for a day gets no reminder at all. Both gaps are addressed via a LINE Official Account: a structured, button-and-picker chat flow lets the user log a task from any source without opening the desktop app, and a cloud-scheduled check pushes deadline reminders to LINE independently of whether the app is running. Both directions are implemented as plain Supabase Edge Functions with deterministic logic — no AI/LLM component, no natural-language parsing, no workflow-automation tool. See Section 14 for the full specification. This version renumbers Sections 14–28 (of v0.11) to 15–29 to make room for the new Section 14; see Section 1 for a note on this and Section 28 (Changelog) for the full record.

**Version:** 0.11 (Classroom Fetch Moved from Fixed Windows to Launch-Triggered; Delete/Ignore Made Unconditionally Permanent; Review Popup Now Session-Safe)
**Status (v0.11):** Three related changes, all originating from a design discussion about how "permanent" Ignore/Delete should really be. (1) Classroom fetch no longer runs on four fixed daily windows (06:00/12:00/18:00/00:00) — it now fetches automatically once per app launch, plus the existing manual "Sync now" on Task Board, decoupled from the 15-minute notification/deadline-state interval it previously shared (Sections 11.2, 13.2, 13.5). (2) Deleting a task or ignoring a Classroom item during review is now unconditionally permanent — neither is ever reopened by a later sync, even if the source assignment's `updateTime` subsequently changes on Google's side. This corrects an internal inconsistency: Section 13.5's actual skip logic never checked `updateTime`, but Section 13.2/13.3 implied it did (Sections 13.2, 13.3, 13.5). (3) If new Classroom items are found while a Pomodoro focus session is running, the review popup no longer interrupts it — a quiet persistent indicator is shown instead, and the full popup opens next time Task Board is visited outside an active session (Section 13.5). No data model fields change; `classroom_sync_state.excluded` remains an unused, reserved value.

**Version:** 0.10 (Manual Classroom Sync Moved from Settings to Task Board)
**Status (v0.10):** The manual "Sync now" entry point moves from Settings to Task Board's top bar (Sections 13.1, 13.2, 13.5). Rationale: the prior design required Room → Settings → Sync Now → back to Room → Task Board (5 screens) to manually refresh and act on assignments, when the user was already looking at Task Board when they wanted to confirm it was current. A new rule is also added: a manually triggered sync that finds zero new items must show a brief non-blocking confirmation, since a silent no-op after a deliberate click reads as broken (the existing "no popup on zero new items" rule was written for the *automatic* background fetch, where silence is correct). No other Classroom mechanics, data model fields, or business logic change in this version.

**Version:** 0.9 (First-Run Google-Connect Prompt Added; Two Known Limitations Documented — No-Backup-Without-Connection, Single-Account-Per-Device)
**Status:** Active — This version adds a one-time, dismissible first-run prompt offering to connect Google Classroom (Section 13.1), so users who never open Settings are still made aware of the choice between connecting (Classroom sync + cloud backup) and staying local-only. Declining the prompt does not gate or delay entry into the app in any way — it is offered, never required, consistent with this project's existing low-friction and no-separate-account-system principles (Sections 6, 19). Two accepted limitations that were previously undocumented are now recorded explicitly: (1) a user who never connects Google Classroom has no cloud backup, since Supabase Auth relies exclusively on Google identity (Section 19); (2) switching Google accounts on the same device is not guarded against at the data layer and could mix local data across accounts (Section 19). Neither limitation changes existing behavior — both are pre-existing consequences of decisions already made in v0.5–v0.8 (single Classroom account, Google-only auth) that had not yet been written down. No business logic, data model field beyond one new `settings` key, or Classroom/Pomodoro/Dashboard behavior changes in this version.
**Supersedes:** PROJECT.md v0.12
**Purpose:** This document is the Single Source of Truth for this project. It is not a thesis report. It exists so that any developer or AI assistant can understand the project's purpose, scope, and current decisions within a few minutes.

---

## 1. Rules for Maintaining This Document

- Do not invent requirements.
- Do not add features that are not explicitly mentioned.
- If information is uncertain, mark it `TBD`.
- If something has not been decided, place it under **Open Questions**.
- Keep this document concise but detailed enough to preserve project context.
- Explain important design decisions, not just what was decided but why.
- Prioritize maintainability and readability over completeness.
- **(v0.9 note)** This version is a small, targeted addition on top of v0.8 — one new UX entry point (the first-run prompt, which reuses the existing OAuth/Settings connection flow rather than introducing a new one) and two documentation-only known-limitation entries. Nothing in Sections 9–17 (task logic, dashboard, notifications, Classroom mechanics, Pomodoro, sync mechanics) changes in this version.
- **(v0.12 note)** Inserting the new Section 14 (LINE Integration) shifted every subsequent top-level section by one number relative to v0.11 (old Section 14 Pomodoro → new Section 15, and so on through old Section 28 Thesis Readiness → new Section 29). All cross-references within the *active* body of this document (Sections 1–29) have been updated to the new numbers. Changelog entries recorded under earlier versions (Section 28) retain the section numbers as they were at the time each entry was written, since they are a historical record of past edits, not live cross-references — treat any section number inside a changelog row as relative to that row's own version, not the current document.
- **(v0.13 note)** No section is added, removed, or renumbered in this version; Section 9.3 is reused for the reinstated Priority field (kept at the same number it held before v0.8) and the section numbering from v0.12 is unchanged. Derived documents (UX-UI-Design-Review, Database-Design, DFD) must be brought in line with this version before they are relied on again: Priority selector on the task create/edit form and task card, an optional Course field on the manual task form, and the renamed `course_name` column.

---

## 2. Project Summary

This project is a **Windows desktop application** developed as a Computer Science undergraduate thesis.

The primary objective is **not** to build another generic to-do application. Instead, the project aims to reduce the friction students experience when managing academic tasks — specifically the pain points the developer has personally experienced during university study.

---

## 3. Core Problems

The system is intended to reduce the following problems:

- Students forget assignments.
- Assignments come from multiple, disconnected sources.
- Google Classroom is one of those sources.
- Some assignments are announced verbally, or through Microsoft Teams, Discord, Facebook groups, or Line.
- Existing task managers require users to manually create every task.
- Users often forget to record assignments in the first place.
- Users procrastinate.
- Users delay starting assignments until deadlines become urgent.
- Users frequently stop working on a task and do not return to it for several days.
- Users lack the motivation to consistently open task management applications.
- Users cannot easily see or understand their current academic workload.
- Students often misjudge how long a task will actually take — a task expected to take thirty minutes may take four to five hours, and this happens routinely rather than as an exception. This makes any planning approach that depends on the student's own effort estimate unreliable.

**Important scope boundary:** The project does not claim to solve procrastination completely. It aims to reduce the barriers that make procrastination worse.

**Traceability note:** Every confirmed feature in this document (Sections 8–15) should be traceable to at least one problem listed above. This mapping is made explicit in Section 22 (MVP Definition).

---

## 4. Target Users

**Primary**
- University students who use Google Classroom.

**Secondary**
- Students using Google Classroom (general population beyond the primary use case).

The application is not intended to compete with enterprise task management software.

---

## 5. Platform

**Confirmed**
- Windows desktop application.

**Out of Scope**
- Android
- iOS
- macOS
- Linux

**Note:** Electron (see Section 16) is technically cross-platform, but this is a scope decision, not a technical limitation — the project is only designed, tested, and packaged for Windows. This distinction matters for the thesis defense: the committee may ask why a cross-platform-capable framework was chosen for a single-platform target. The answer is a maintainability/ecosystem decision (HTML/CSS/JS familiarity, packaging tooling, SQLite bindings), not a claim that the app is cross-platform.

**(v0.12 note)** The LINE integration (Section 14) is reachable from any device with LINE installed — the user's phone, for instance — but this does not extend the *application's* platform scope. LINE is a messaging channel the backend talks to, not a second client of the desktop app; the desktop app itself remains Windows-only.

---

## 6. Design Philosophy

The project prioritizes, in no particular order:

- Simplicity over feature count.
- Real usefulness over visual complexity.
- Undergraduate thesis feasibility.
- Maintainability.
- Low-friction task management.
- Solving real, identified user pain points.
- Computed values assist but never silently override the user's own manual input. Deadline State does not overwrite Status (Section 9.2) — the system may suggest or rank, but the user's own judgment is never quietly replaced.

**Guiding principle:** Every feature should directly map to at least one identified problem (see Section 3). If a feature cannot be mapped to a real problem, it should be questioned or removed.

---

## 7. Design Vision: The Interactive Room

The application uses an **Interactive Room** as its home screen.

- The room is **not** the application's main functionality — it contains no business logic.
- It is a themed **navigation layer**, meant to feel like a personal study space rather than a traditional productivity app.
- Interactive objects inside the room act as navigation shortcuts to the app's real features.

**Examples of room objects and their destinations:**

| Object | Navigates To |
|---|---|
| Task Board | Task Management |
| Monitor | Dashboard / Insights |
| Calendar | Calendar View (overview of tasks by due date) |
| Other objects | Related pages |

**(Removed in v0.8)** The Clock object, previously a direct entry point into a general (task-less) Focus Session, is removed. Its only purpose was routing to that general-session entry point; now that Pomodoro can only be started from a task (Section 15), there is nothing left for the Clock to route to. See Section 15 for the full rationale and Section 28's changelog for the removal record.

If urgent assignments exist, the room may visually indicate this (e.g., an exclamation mark on the Task Board object).

**Terminology note (Revised in v0.6):** the object and page previously called "Quest Board" is renamed **"Task Board"** throughout this document and the application. The "Quest" framing was originally chosen to evoke a sense of completing quests for rewards, but the gamification system it implied (Study Companions and related rewards/decorations) was formally removed from scope in v0.3 (Section 25) and never replaced with any other reward mechanic. Keeping "Quest Board" as a label with no quest system behind it would require explaining the naming choice unnecessarily — "Task Board" says exactly what it is and fits the "personal study space" framing of the Room just as well. "Task Board" is the UI implementation of the "Task Management" feature listed in Section 8. "Pomodoro" and "Focus Session" are used interchangeably throughout this document and refer to the same feature.

**(v0.12 note)** The Room gains no new object for LINE — task creation and notifications via LINE happen entirely outside the desktop app, so there is nothing for the Room to route to (same reasoning already applied to the Clock object's removal, above).

---

## 8. Core Features (Confirmed)

- Google Classroom synchronization — automatic fetch each time the app is launched, plus an on-demand manual "Sync now" trigger, with newly-found assignments surfaced to the user for review before import (see Section 13, 13.5)
- Manual task creation (for assignments from sources other than Classroom), including task creation via a structured LINE chat flow — **(New in v0.12)** see Section 14.3
- Task management, including a computed Urgency Score (see Section 9.5) that takes an optional, user-set Priority as one of its inputs (see Section 9.3)
- Assignment progress tracking
- Progress percentage (manually entered)
- Notes per task
- Dashboard / Insights
- Notification system, including deadline reminders delivered via LINE independently of whether the desktop app is running — **(New in v0.12)** see Section 14.4
- Pomodoro / Focus timer, including multi-session batches (see Section 15.3)
- Background data synchronization to a cloud backup (see Section 18)

---

## 9. Task States, Deadline Logic, and Urgency Score

### 9.1 Status (Confirmed)
- Not Started
- In Progress
- Completed

**Note:** for tasks imported from Google Classroom (see Section 13.5), the initial status is **not always Not Started**. It is determined at the moment the user chooses to import the item (via the review flow described in Section 13.5) by checking the corresponding `StudentSubmission.state` from the Google Classroom API:
- If `state` is `TURNED_IN` or `RETURNED` → the task is created with `status = Completed`.
- Otherwise (`NEW` or `CREATED`) → the task is created with `status = Not Started`, as before.

This prevents assignments the student had already submitted outside the app (e.g., before installing StudyFlow) from appearing as outstanding work.

**Tasks created via LINE (New in v0.12):** always start at `status = Not Started` — LINE task creation has no equivalent to `StudentSubmission.state`, since the assignment did not come from Classroom (Section 14.3).

**Auto-transition on first Pomodoro start (New in v0.8):** when a task's status is `Not Started` and the user presses "Start Working" to begin that task's first Pomodoro batch (Section 15.3), status automatically transitions to `In Progress` at that moment. This is the only automatic status transition in the app, and it is narrowly scoped: it only fires from `Not Started`, only fires once (the first time), and never fires backward. The user can still manually override status at any time afterward, exactly as with any other task.

### 9.2 Deadline State

Deadline state is tracked separately from task status and is **computed at read-time** from the task's due date — it is never stored as a status value.

**Confirmed computation rules:**

| Condition | Deadline State |
|---|---|
| `due_date` is empty | No Deadline |
| `due_date` is in the future | Upcoming |
| `due_date` is today (local system date) | Due Today |
| `due_date` is in the past **and** status ≠ Completed | Overdue |
| `due_date` is in the past **and** status = Completed | Completed *(not Overdue)* |

**Rationale for edge cases resolved here:**
- A task with no due date cannot be "overdue" by definition; without this rule, manually created tasks without a deadline would either crash the calculation or be miscategorized. It is excluded from deadline-based dashboard metrics (see Section 10).
- A task finished late should read as **Completed**, not **Overdue** — showing a finished task as overdue would be misleading.
- "Today" is evaluated against the local system clock/timezone of the Windows machine running the app. Since the app is single-user, single-timezone-at-a-time, and desktop-only, no timezone-conversion logic is required.

**(v0.12 note)** These same rules are re-implemented, unchanged, inside the LINE deadline-notification Edge Function (Section 14.4), which evaluates deadline state on the server rather than in the Electron app. Both implementations must stay in sync with this table; there is no shared code module between the two runtimes, so a future change to this table must be applied in both places (flagged as a maintainability risk in Section 20).

### 9.3 Priority (Removed in v0.8; Reinstated in v0.13)

**Definition (v0.13):** Priority is an **optional, user-set** field with three values — Low, Medium, High — stored as `low` / `medium` / `high`. It has **no default**: a task whose priority has not been set holds `null` and is treated as Low by the Urgency Score. It is never computed or auto-suggested. The user sets it on the task create/edit form and can change it at any time.

- Priority is **not** collected by the LINE structured chat flow (Section 14.3), and Classroom import does not set it (Section 13.5). Tasks from those paths start with Priority unset; the user can set it later in the app.
- Priority does not affect Status (Section 9.1), Deadline State (Section 9.2), any Dashboard metric (Section 10), or notifications (Section 11). Its only effect is as one input to the Urgency Score (Section 9.5).
- Priority is a normal `tasks` field and is synced like the others (Sections 18, 19).

**Why it returns (v0.13):** the Urgency Score as defined in v0.6–v0.12 uses only objective signals (time elapsed, progress, activity). That cannot express how *important* or how *large* a task is, so a long, high-effort project can sit below a quick assignment on Task Board even when the user knows it matters most. Advisor feedback asked for a way for the user to state importance directly and for it to count toward the score. Priority fills that role.

**Why the v0.8 objection does not reinstate the old problem:** v0.8 removed Priority because, as a standalone field, users tended to mark most tasks High and flatten the signal, while the field itself added input burden. In v0.13 the field is still optional (no burden for users who ignore it), and it is no longer a standalone sort key: it is one component with a fixed maximum weight of 0.2 inside the Urgency Score (Section 9.5). An unset or Low priority contributes 0. If a user marks everything High, every non-completed task gains the same constant, so the ordering falls back to what the v0.12 signals would have produced; the feature then adds no information but does not degrade the ranking. This is documented as an accepted limitation (Section 20), not claimed to be solved.

**History:** Priority was originally defined in earlier versions as a manual, optional field (Low / Medium / High, no default, not computed or auto-suggested), and removed in v0.8: every task entering the app already represents actionable, submission-required coursework (Section 13.5 restricts Classroom fetching to `workType = ASSIGNMENT`), so a manual importance field added input burden without a corresponding benefit, and in practice users tended to mark most tasks High. Kept here as a record of why it was removed and why it was reinstated, rather than silently rewritten.

### 9.4 [Removed in v0.6]

This section previously defined a "Recently Imported Indicator" — a 24-hour, read-time-computed "New" badge shown on Classroom-imported task cards. It is removed in v0.6 because its purpose is now served differently: under the v0.6 Classroom review flow (Section 13.5), the user is shown exactly what is newly fetched *before* it becomes a task. Kept here as a numbered historical record rather than silently deleted.

### 9.5 Urgency Score (New in v0.6)

**Confirmed decision:** the system computes a signal — the **Urgency Score** — used to drive the default sort order of Task Board. It is computed entirely from data the app already has: due dates, manually-entered progress, task activity timestamps, and, from v0.13, the optional user-set Priority (Section 9.3). Priority is the only subjective input, and it is limited to one component with a fixed maximum weight. Urgency Score remains the sole signal driving Task Board's default ordering — Priority never sorts tasks on its own, it only enters through this score — and it stays a distinct, structurally separate concept from Status and Deadline State (Section 9.2).

**Why not rely on a user-estimated task duration:** an idea to rank tasks using a self-reported "estimated time to complete" field was considered and rejected before ever entering this specification. Students consistently misjudge how long a task will take, so any scoring signal built on a self-estimated duration would inherit that unreliability.

**Computation:**

```
elapsed_fraction = clamp((now − created_at) / (due_date − created_at), 0, 1)
```

Four signals are combined:

| Signal | Weight | Definition |
|---|---|---|
| Deadline Urgency | 0.4 | `1.0` if `deadline_state = Overdue`. Otherwise, `elapsed_fraction`. |
| Progress Gap | 0.24 | `max(0, expected_progress − progress_percentage) / 100`, where `expected_progress = elapsed_fraction × 100`. |
| Neglect Factor | 0.16 | `min((now − last_focus_started_at in days) / 14, 1)`. Applies only when `status = In Progress` **and** `last_focus_started_at` is not null. |
| Priority Factor | 0.2 | `1.0` if `priority = high`, `0.5` if `priority = medium`, `0` if `priority = low` or not set (Section 9.3). |

```
urgency_score = (0.4 × deadline_urgency + 0.24 × progress_gap + 0.16 × neglect_factor + 0.2 × priority_factor) × 100
```

**Exclusion and edge-case rules:**
- Tasks with `status = Completed` are excluded from Urgency Score entirely.
- Tasks with no `due_date` receive `deadline_urgency = 0` and `progress_gap = 0`; their score is driven only by Neglect Factor (if applicable) and Priority Factor.
- Neglect Factor only applies when `status = In Progress`; for `Not Started` tasks or tasks with no recorded activity, this component is `0`. It is also `0` for an `In Progress` task whose `last_focus_started_at` is null (manual status override without ever starting a session).
- Priority Factor is user-set, not derived, so it applies to every non-Completed task regardless of status or whether a `due_date` exists. Not set counts as `0`. **(New in v0.13)**
- Urgency Score is **computed at read-time and never stored**.

**Accepted limitation (weight tuning):** the weights above (0.4 / 0.24 / 0.16 / 0.2) are a reasoned starting point, not a tuned result, documented as an accepted limitation and a candidate for refinement following the planned user evaluation (Section 29). **(v0.13)** The first three weights keep the 5 : 3 : 2 proportions they had in v0.12 (0.5 / 0.3 / 0.2), scaled by 0.8, and the Priority Factor takes the remaining 0.2. As a result a High-priority task gains at most 20 points from priority alone, which is enough to lift a long project above a short task of otherwise similar standing but not enough to outrank a task that is already overdue and untouched.

**Display note (non-binding, deferred to UX-UI-Design-Review.md):** Urgency Score should drive Task Board's default sort order and may be reflected in a subtle numeric or color-banded indicator, but must use a visual language distinct from the Deadline State chip.

**Traceability:** this feature maps to the Section 3 problems *"Users cannot easily see or understand their current academic workload"* and *"Students often misjudge how long a task will actually take."*

---

## 10. Dashboard

The dashboard's purpose is to give students insight into their **study behavior**, not just a list of tasks.

### 10.1 Time Range Filtering (Confirmed)

The dashboard supports filtering its charts and statistics by:
- This Week
- This Month
- All Time

### 10.2 Metrics (Finalized)

| Metric | Definition | Filtered By | Respects Time Range? |
|---|---|---|---|
| Total Assignments | Count of tasks whose `due_date` falls in the selected range. Tasks with no due date are counted only under **All Time**. | `due_date` | Yes |
| Completed Assignments | Count of tasks with status = Completed whose `completed_at` falls in the selected range. | `completed_at` | Yes |
| Remaining Assignments | Count of tasks with `due_date` in range and status ≠ Completed. | `due_date` | Yes |
| Overdue Assignments | Count of tasks currently in the Overdue deadline state (Section 9.2). | n/a — real-time | **No** |
| % Completed Before Deadline | Among tasks with `due_date` in range and status = Completed: percentage where `completed_at` ≤ `due_date`. | `due_date` | Yes |
| Longest Inactive Assignment | The in-progress task with the oldest `last_focus_started_at` (excluding tasks where it is null). | n/a — real-time | **No** |
| Average Time-to-Start Lag | Among tasks with `due_date` in the selected range that have at least one linked Pomodoro session, and where `due_date` occurs after `created_at`: the mean `start_percentage`. | `due_date` | Yes |

**Rationale:** Overdue Assignments and Longest Inactive Assignment are both "what needs my attention right now" indicators, not historical statistics. Urgency Score (Section 9.5) is a related but separate concept and is not included in this table.

### 10.3 Average Time-to-Start Lag — Rationale and Edge Cases

**Why not "days before deadline completed":** an earlier candidate metric was rejected due to false positives/negatives on long- and short-window tasks.

**Why percentage instead of a raw day count:** normalizing delay as a percentage of each task's own available time window removes distortion from comparing tasks of very different lengths.

**What this metric measures:** the gap between when a task entered the system and when the student first touched it, using the first Pomodoro session linked to that task as the "first touch" signal, expressed as a proportion of the task's total available time.

**Not to be confused with `last_focus_started_at` (Section 19):** this metric uses the **earliest** linked session; `last_focus_started_at` tracks the **most recent** session start.

**Computation:**
- `window_total = due_date − created_at`
- `elapsed_to_start = first_session.started_at − created_at`
- `start_percentage = (elapsed_to_start / window_total) × 100`
- Negative `elapsed_to_start` is clamped to `0`.
- No upper clamp — values above 100% are retained.
- The dashboard reports the mean `start_percentage` across qualifying tasks.

**Exclusion rules:**
- A task with no linked Pomodoro session is excluded entirely (not counted as 0%).
- A task where `due_date` does not occur strictly after `created_at` is excluded.
- A task with no `due_date` is excluded.

**Accepted limitation:** averaging across very different window lengths is statistically imperfect; documented as an accepted limitation.

**Display recommendation (non-binding, deferred to UX-UI-Design-Review.md):** pair the raw percentage with a plain-language example.

**Interaction with `created_at` for Classroom-imported tasks:** lag is measured from when the task entered *this app* — the moment the user chose "Create Task" in the review flow (Section 13.5). For tasks created via LINE (Section 14.3), `created_at` is likewise the moment the LINE flow completes and the task row is inserted.

**Traceability:** maps to *"Users delay starting assignments until deadlines become urgent."*

---

## 11. Notifications

### 11.1 Default Behavior (Finalized, Revised in v0.6)

Default notification rules for the MVP:
- Notify once when a task's deadline state changes to **Due Today**.
- Notify once when a task's deadline state changes to **Overdue**.
- Notify once when a task enters the **Upcoming** state within a configurable reminder window before its due date (default: **1 day**).

**(Bug identified and fixed in v0.8 — see Section 11.3):** this rule is a *threshold* check, not a simple state transition.

**(Removed in v0.6)** The v0.5 fourth rule — a passive notification banner for newly-imported Classroom tasks — is removed.

Users can customize or disable these rules later; the above is the shipped default.

**(New in v0.12)** These three rules also drive LINE push notifications for users who have connected LINE (Section 14.4), using the identical thresholds — there is no separate LINE-specific notification configuration.

### 11.2 Scheduling Mechanism (Revised in v0.11, extended in v0.12)

- Deadline states are re-evaluated on app startup and on a periodic interval while the app is running (e.g., every 15 minutes).
- **(Changed in v0.11)** This interval drives deadline-state/notification checks only. Google Classroom fetching is no longer tied to it — see Section 13.5 for its own launch-triggered-plus-manual model. The two were merged through v0.10 because they shared one timer; they're decoupled now so that a long-running session doesn't silently re-fetch Classroom in the background.
- No OS-level background service or scheduled task runs *on the user's machine*.
- **Known, accepted limitation (Revised in v0.12):** if the app is not running at the moment a task becomes Due Today or Overdue, the **desktop** notification will not fire until the app is next opened (at which point a Classroom fetch also runs automatically — Section 13.5). **(New in v0.12)** For users who have connected LINE, this limitation is now mitigated — not eliminated — by the cloud-scheduled LINE notification check (Section 14.4), which runs on Supabase independently of whether the desktop app is open. A user who has not connected LINE still experiences this limitation exactly as in prior versions.

### 11.3 Duplicate Prevention (Revised in v0.6, bug fixed in v0.8)

Each task stores the deadline state it was last notified for (see `notification_log` in Section 19). A notification only fires when the computed state differs from the last-notified state.

**Bug (present through v0.7), diagnosed in v0.8:** the reminder-window rule doesn't correspond to any single one of the five `deadline_state` values — a task that stayed `Upcoming` the whole time could silently skip its reminder entirely.

**Fix:** widen the set of values `notification_log.last_notified_state` can hold to include a sixth value — `Upcoming (within window)`. A task's tracked notification state now progresses `Upcoming → Upcoming (within window) → Due Today → [Overdue]`.

**Confirmed as still correct under settings changes:** widening/narrowing the reminder-window stepper works correctly with the same difference-based dedup logic.

**(New in v0.12) Not shared with LINE dedup:** `line_notification_log` (Section 19) tracks the same six-value state independently, since the cloud-side check has no access to the local `notification_log` table (Section 18.2). **Accepted duplication:** a user with the desktop app open and LINE connected may receive both a desktop notification and a LINE push for the same deadline-state change — see Section 14.4 for the rationale for not attempting cross-system dedup.

---

## 12. Progress Tracking

- Progress is entered **manually** by the user.
- The application does **not** attempt to estimate completion percentage automatically.
- Each task supports free-form notes.

---

## 13. Google Classroom Integration

Authentication/connection and synchronization are separated by concern.

### 13.1 Settings (Confirmed, extended in v0.9)
- Connect or disconnect a Google Classroom account.
- Google OAuth is handled here (see Section 16 for the implementation approach).
- Only a single connected Classroom account is supported in the MVP.
- When connecting a Google Classroom account for the first time, the user must set a cutoff date ("import assignments created on or after...") before the first scheduled fetch (Section 13.5) is allowed to run.
- **(Changed in v0.10)** The manual "Sync now" action does **not** live here — see Section 13.2. Settings shows the last sync time as read-only status text only, so the connection card still answers "when did this last run" without duplicating the trigger control.

**(New in v0.9) First-Run Prompt:** in addition to connecting via Settings, the app presents a one-time prompt on first launch asking whether to connect Google Classroom now. Choosing to connect leads into the same OAuth flow described above, including the mandatory cutoff-date step. Choosing "Use without connecting" dismisses the prompt permanently (tracked via `settings.has_seen_first_run_prompt`, Section 19) and the user proceeds directly into the app — Google Classroom connection remains available in Settings at any later time, unchanged from the existing flow described above. The prompt does not block, delay, or gate entry into the app in any way; it is offered once, never enforced.

**Rationale:** the app supports fully offline, Classroom-free usage (Section 8 — manual task creation; Section 23 — "Manual task entry remains supported alongside Classroom sync") and must not gate entry behind a login step (Section 6 — low-friction; Section 20 — no separate account system). At the same time, a silent default with no prompt risks a user never realizing their data has no cloud backup unless they actively open Settings and connect (see Section 20's known-limitation note). A one-time, dismissible prompt surfaces this choice without forcing it — consistent with this project's existing pattern of computed/system suggestions that never override user choice (Section 6).

**(New in v0.12) Unrelated to LINE connection:** the Google Classroom first-run prompt and the LINE "Connect LINE" action (Section 14.2) are entirely independent — connecting or declining one has no effect on the other, and there is no combined or sequential onboarding step for both.

### 13.2 Task Board (Revised in v0.6, extended in v0.7)

- Google Classroom fetching runs **automatically once each time the app is launched** from a fully closed state (Section 13.5) — replacing the earlier four-fixed-window model, which added complexity (tracking which window had already run) without a real benefit once launch-time fetching was on the table. A manual **"Sync now"** button also lives directly on Task Board's top bar — not in Settings — for on-demand checks while the app is already open (e.g. left running all day). It was moved here (v0.10) because Task Board is where the user is already looking at their task list when they want to confirm it's current; routing that decision through Settings and back added two extra screens to a one-click action. This is the single entry point for manual sync; Settings no longer exposes its own trigger (Section 13.1). Both paths call the same fetch logic (Section 13.5).
- Fetched assignments that pass the filtering rules in Section 13.5 are **not** imported directly. They are queued for review and presented via a popup shown the next time the app is opened after a fetch finds new items.
- The user decides per item: **Create Task** or **Ignore** (permanently excluded).
- Once a task has been imported, removing it uses the same delete action available for any other task.
- **(Clarified in v0.11)** Deleting a task created from a Classroom assignment does **not** cause that assignment to be re-imported on a later sync — unconditionally, regardless of whether the assignment's `updateTime` later changes on Google's side (Section 13.3, Section 13.5).

### 13.3 Change Detection (Revised in v0.11)

A Classroom assignment is considered changed **only** when Google Classroom's own `updateTime` value differs from the value last seen by the app. No field-level diffing is performed.

**(Corrected in v0.11)** This concept is retained for what it defines ("changed" vs. "unchanged"), but it does **not** reopen an item once it has reached a terminal `classroom_sync_state` (`imported` or `ignored`) — see the "Decisions are permanent, unconditionally" rule in Section 13.5. An earlier version of this document implied that a changed `updateTime` could cause an already-decided item to resurface; that was inconsistent with Section 13.5's actual skip logic (which checks state membership only, not `updateTime`) and has been corrected here in favor of the simpler, unconditional rule.

### 13.4 Data Lifecycle Rules (Confirmed, Revised in v0.6)
- Disconnecting a Google Classroom account does **not** delete tasks that were already imported.
- If a Classroom assignment is edited *after* it has already been imported, the existing local task is **not** automatically updated, overwritten, or flagged. This remains explicitly out of scope for the MVP.
- An explicit "Ignore" action exists again — but only at the pre-import review stage.

### 13.5 Scheduled Automatic Fetch with Review (Revised in v0.6, extended in v0.7)

**Fetch trigger (Revised in v0.11):** a fetch runs automatically **once, every time the app is launched** from a fully closed state. This replaces the earlier four-fixed-window model (`06:00`/`12:00`/`18:00`/`00:00`, v0.7–v0.10): the old model required tracking which of the four windows had already run since the app might open at any point between them, adding bookkeeping for a benefit — data no older than a few hours — that launch-time fetching already delivers more simply (data is fetched fresh at the moment the user is actually looking at the app). A fetch can also be triggered manually at any time the app is already open — see "Manual (On-Demand) Sync" below.

**Decoupled from the notification/deadline-state check (Revised in v0.11):** the periodic 15-minute interval described in Section 11.2 re-evaluates deadline states and fires notifications only — it no longer also triggers a Classroom fetch. The two concerns were merged through v0.10 because they shared one interval timer; they're now separate; a long-running session (app left open all day) will keep getting deadline/notification updates every 15 minutes without also re-fetching Classroom in the background — refreshing Classroom data at that point is an explicit user action (Sync Now), not an ambient one.

**Rationale for reverting to a review step (v0.6):** avoids clutter from recurring, non-graded Classroom posts that would otherwise auto-import repeatedly.

**Fetch and review steps:**
1. Fetch all CourseWork items from every connected course, restricted to `workType = ASSIGNMENT`.
2. Filter out any item whose `creationTime` falls before the cutoff date.
3. Check each remaining item's `classroom_assignment_id` against `classroom_sync_state`; skip if already `imported`, `ignored`, `excluded`, or `pending`.
4. New items are recorded with `state = pending`.
5. If items are newly `pending`, a review popup is shown the next time the app is opened (or next periodic check).
6. The popup lists all currently pending items.
7. For each item: **Create Task** (sets `status` per Section 9.1, sets `classroom_sync_state.state = imported`) or **Ignore** (`state = ignored`).
8. Undecided items stay `pending` and reappear in the popup.
9. If a fetch run finds zero new items, no popup is shown.

**Manual (On-Demand) Sync:** the user can trigger a fetch manually at any time via "Sync now" on Task Board (Section 13.2). Calls the identical fetch-and-review pipeline; no separate business rule, data path, or field is needed.

**Manual-trigger feedback (New in v0.10):** unlike the automatic background fetch (item 9 above, where silence is expected and correct), a manual trigger is a deliberate button press and must acknowledge it either way. If the manual fetch finds one or more new items, the review popup opens as usual (items 5–8 above) — subject to the interruption-safe exception below. If it finds zero new items, show a brief, non-blocking confirmation (e.g., a toast reading "No new items from Classroom") instead of doing nothing — silence after a deliberate click reads as a broken button, not as "nothing to do."

**Interruption-safe review (New in v0.11):** if new items are found (by either trigger) while a Pomodoro focus session is currently running, the review popup does **not** interrupt the session. Instead, show the same quiet, persistent text-link indicator already used for undecided pending items (e.g. "3 Classroom items to review" — Section 6 of UX-UI-Design-Review.md), and open the full popup only when the user next visits Task Board outside of an active session. This follows the same low-friction principle already applied to Pomodoro elsewhere (Section 15): a review decision can wait a few minutes; a focus session's continuity is worth protecting.

**Decisions are permanent, unconditionally (Clarified in v0.11):** both **Create Task** and **Ignore** are terminal — `classroom_sync_state.state` moves from `pending` to `imported` or `ignored` exactly once per assignment and is never reset by a later sync, **regardless of whether the assignment's `updateTime` subsequently changes on Google's side.** (Section 13.3's change-detection concept still defines what "changed" means for logging/display purposes, but a changed `updateTime` does not reopen an already-decided item — see Section 13.3.) Deleting an imported task does not reset it either (Section 13.2).

**Accepted limitation (recurring non-assignment posts):** each new occurrence of a recurring post still requires its own Ignore click in the popup.

**Explicitly out of scope:** real-time push notifications via Google Cloud Pub/Sub remain rejected for the MVP.

**(New in v0.12) Not shared with LINE task creation:** tasks created via the LINE flow (Section 14.3) never enter `classroom_sync_state` or the review popup — the review step exists specifically because Classroom fetches are passive (the system pulled the data), whereas a LINE-created task is the direct result of the user actively completing a creation flow. There is no `pending`/review state for LINE-sourced tasks.

---

## 14. LINE Integration (New in v0.12)

### 14.1 Purpose and Rationale

This section adds a second external integration, independent of Google Classroom, addressing two gaps identified during a scope review that were not resolved by any feature already in this document:

1. **Source coverage.** Section 3 lists five sources of assignments besides Google Classroom (verbal announcements, Microsoft Teams, Discord, Facebook, Line), but until this version the app only automatically captured one source (Classroom); everything else required opening the desktop app and using the manual task form.
2. **The "app must be running" limitation.** Section 11.2 documents, as an accepted limitation, that desktop notifications only fire while the app is running. A student who does not open their laptop for a day receives no reminder at all during that time.

Both directions below are implemented as Supabase Edge Functions — serverless functions hosted on the same Supabase project already used for cloud sync (Section 18) — rather than a new server (Section 21). A LINE Official Account (Messaging API) is the second external API in the stack, alongside the Google Classroom API (Section 16).

**Explicit non-goal:** this integration does not attempt to solve source coverage for Microsoft Teams, Discord, or Facebook directly (no API integration with those platforms is added). It solves the *general* version of the problem — "a way to log a task without opening the desktop app" — regardless of which platform originally announced it. See Section 14.6 for further scope boundaries.

### 14.2 Account Linking (Confirmed)

- Settings gains a **"Connect LINE"** action, independent of the Google Classroom connection (Section 13.1).
- Pressing it generates a short-lived numeric code, stored in `line_link_codes` with a 10-minute expiry, tied to the currently logged-in app user.
- The user sends this code as a plain text message to the LINE Official Account. A Supabase Edge Function checks the code against `line_link_codes`; if valid and unexpired, it records the mapping in `line_account_links` (`line_user_id` from LINE ↔ `app_user_id` from Supabase Auth) and replies confirming the connection.
- A symmetric **"Disconnect LINE"** action is available in Settings, consistent with the existing Google Classroom disconnect pattern (Section 13.4). Disconnecting removes the row from `line_account_links` but does not delete any tasks previously created via LINE (Section 14.5).
- LINE connection is entirely optional and independent of the Google Classroom connection (Section 13.1) — a user may connect one, both, or neither, and the LINE first-run experience is not tied to the existing Google first-run prompt (Section 13.1).
- Both directions of LINE integration (14.3, 14.4) require this link to exist first; neither functions for an unlinked LINE user beyond receiving the "please connect first" reply.

### 14.3 Task Creation via LINE (Confirmed)

- Reached by sending a trigger phrase (e.g. "เพิ่มงาน") to the LINE Official Account, only after account linking (14.2) is complete. An unlinked user who sends the trigger phrase receives a reply directing them to Settings to connect first.
- Task details are collected through a short, structured, multi-step exchange — not a single freeform message:
  1. **Course** — presented as LINE Quick Reply buttons, populated from the linked user's existing `course_name` values (pulled from their synced `tasks`), plus a free-text fallback option for a course with no prior history.
  2. **Title** — free-text message.
  3. **Due date** — LINE's native Datetime Picker action, not free-text.
- **(New in v0.13)** The flow does not ask for Priority. A LINE-created task has `priority` unset until the user sets it in the desktop app, which keeps the flow at three steps (Section 14.6).
- **No natural-language or freeform parsing of task details is used anywhere in this flow.** Every field is captured through a discrete, explicit prompt-and-response step using LINE's built-in structured input components. This is a deliberate scope boundary — see Section 14.6 for the rationale.
- Once all three fields are collected, a row is inserted directly into `tasks` (`source = 'line'`, `status = not_started` per Section 9.1) using the same task-creation logic already used for manual entry (Section 17.2) — it does **not** pass through the Classroom Review Popup (Section 13.5). That review step exists specifically for passively-fetched Classroom data; a LINE-created task is the direct, explicit result of the user completing the flow, so no additional review step is needed.
- In-progress conversation state is tracked in `line_conversation_state`, keyed by `line_user_id` (Section 19.4). A flow that receives no further input for 10 minutes is cleared automatically; the next message the user sends starts a fresh flow rather than resuming a stale, possibly-forgotten one.
- Tasks created via this flow sync down into the local SQLite database through the existing pull mechanism (Section 18.2) — no new sync path is introduced for this data; it is simply a new way of getting a row into the same `tasks` table that Classroom import and manual entry already write to.

**Traceability:** maps to *"Assignments come from multiple, disconnected sources"* and *"Users often forget to record assignments in the first place"* (Section 3).

### 14.4 Deadline Notifications via LINE (Confirmed)

- Runs entirely on Supabase, independently of the local desktop app and independently of the local 15-minute notification interval (Section 11.2) — implemented as a second Supabase Edge Function, triggered on a fixed schedule (target: every 15–30 minutes) via `pg_cron`.
- On each run, the function: reads `tasks` for every user with an active row in `line_account_links`, computes deadline state using the identical rules defined in Section 9.2, compares the result against `line_notification_log`, and sends a LINE push message via the Messaging API for any task whose deadline state has changed since it was last notified through this channel.
- Uses the same three default rules as desktop notifications (Section 11.1) — Due Today, Overdue, and the reminder-window threshold — with no separate LINE-specific configuration.
- `line_notification_log` (Section 19.4) is a separate table from the local-only `notification_log` (Section 19). The cloud function has no access to the local SQLite file, so it maintains its own dedup state rather than sharing the app's.
- **Accepted duplication, not deduplicated:** a user who has the desktop app open at the moment a deadline state changes, and who has also connected LINE, may receive both a desktop notification and a LINE push for the same change. This is treated as an intentional trade-off rather than a defect: LINE is meant as a fallback channel for when the app is not running (Section 11.2), and building cross-system deduplication between a local SQLite process and a stateless cloud function would add meaningful complexity for a low-frequency event (at most a handful of notifications per task's lifetime).

**Traceability:** mitigates the accepted limitation documented in Section 11.2 (no notifications while the app is closed).

### 14.5 Data Lifecycle and Edge Cases (Confirmed)

- Disconnecting LINE (Section 14.2) does not delete tasks previously created via LINE — consistent with the equivalent rule for Google Classroom (Section 13.4).
- A course name entered through the free-text fallback (14.3) is not validated or reconciled against existing `course_name` values from Classroom-sourced tasks. A typo or alternate naming (e.g. "OS" vs. "ระบบปฏิบัติการ") produces a distinct grouping on Task Board rather than merging with the existing course. This is documented as an accepted limitation, not solved in this version — a candidate for future work, similar in spirit to the account-mixing limitation already accepted in Section 20.
- LINE Official Account free-tier push-message volume limits (per LINE Messaging API terms) are a known constraint on how many notifications can be sent per month; not expected to be reached at the scale of the planned user evaluation (Section 20).
- If a user connects LINE but never triggers the "เพิ่มงาน" flow, only the notification direction (14.4) is active for them — the two directions are independent and neither requires the other.

### 14.6 Explicitly Out of Scope for LINE Integration (Confirmed)

- **No natural-language or freeform-text parsing of task details**, in either direction. All structured input in Section 14.3 uses LINE's native button and date-picker components; nothing is inferred or extracted from an unstructured sentence.
- **No AI/LLM component of any kind.** Task creation uses discrete structured-input steps; the notification check uses deterministic rule evaluation identical to Section 9.2. This mirrors the reasoning already applied elsewhere in this document to reject AI/ML components without a demonstrable, evaluable benefit (Section 9.5's rejection of a learned Urgency Score weighting is the precedent for this stance).
- **No workflow-automation tool (e.g. n8n).** Both directions are implemented as plain Supabase Edge Functions with `pg_cron` for scheduling, to avoid introducing a third external managed service beyond Supabase and the Google/LINE APIs already in the stack (Section 16, Section 21).
- **No support for LINE group chats.** The Official Account only processes direct 1:1 messages from a linked individual user; group-chat messages are not parsed or acted upon.
- **No integration with Microsoft Teams, Discord, or Facebook directly** — this remains out of scope (Section 24), unchanged from prior versions. LINE addresses the *general* need for a low-friction, always-reachable capture channel, not platform-specific integrations with each source named in Section 3.

---

## 15. Pomodoro / Focus Sessions

**Confirmed decision (Revised in v0.8):** Pomodoro is reached exclusively through a task. There is no standalone Pomodoro page and no general, task-less focus session.

**Rationale for removing the general-session entry point:** every signal that depends on Pomodoro data needs a task link to mean anything — Time-to-Start Lag, Neglect Factor, and Longest Inactive Assignment all require `task_id`. Removing the general session removes real weight from both UI and data model.

### 15.1 Partial Sessions (Confirmed)

If the application is closed mid-session, the partial elapsed time is recorded with a `completed = false` flag. A session lost to a hard crash is an accepted limitation.

### 15.2 Session Notes (Finalized)

Pomodoro session data remains a **separate, display-only record**. It is never auto-written into the task's Notes field.

### 15.3 Multi-Session Batches (New in v0.6)

**Confirmed decision:** starting a Pomodoro session begins with choosing how many focus+break cycles to run back-to-back as one batch, with the total elapsed time previewed live.

**Side effects of pressing "Start Working" (New in v0.8):**
1. `last_focus_started_at` is set to the current timestamp on every batch start.
2. If status is still `Not Started`, it auto-transitions to `In Progress` (only the first time).

**Phase transition behavior:** focus → break → next focus, automatically, until the batch ends. The user can pause or stop at any point.

**Data model:** each focus period is its own row in `pomodoro_sessions`; `batch_id`, `session_index`, `session_total` reconstruct batch membership. Break periods are not persisted.

### 15.4 Phase Notifications and Floating Widget (New in v0.6)

**Confirmed decision:** phase transitions are surfaced through OS-level notifications and a persistent, always-on-top floating widget showing phase, remaining time, and batch position.

**Architectural note:** implemented as a second Electron `BrowserWindow`, presentational only, communicating via IPC.

---

## 16. Technology Stack (Confirmed)

| Layer | Choice | Notes |
|---|---|---|
| Desktop Framework | Electron | Packaged and tested for Windows only (see Section 5). |
| Frontend | HTML, CSS, JavaScript | No frontend framework. |
| Local Database | SQLite | Primary data store; app must remain fully usable offline. |
| Cloud Backend | Supabase (PostgreSQL) | Background sync/backup; also hosts the Edge Functions used by LINE integration (Section 14). |
| Authentication | Google OAuth 2.0 | Used for Classroom API access and, where convenient, as the identity provider for Supabase. |
| External API | Google Classroom API | Scheduled automatic fetch with review (Section 13.5). |
| External API | **(New in v0.12)** LINE Messaging API | Task creation via structured chat flow and deadline push notifications (Section 14). |
| Serverless Compute | **(New in v0.12)** Supabase Edge Functions | Hosts the LINE webhook handler and the scheduled deadline-check function (Section 14, Section 17). |
| Scheduling | **(New in v0.12)** Supabase `pg_cron` | Triggers the LINE deadline-check Edge Function on a fixed interval (Section 14.4). |
| Target Platform | Windows Desktop | See Section 5. |

---

## 17. Software Architecture

The application follows a **Local-First Architecture**: SQLite is the source of truth for all normal operation, and Supabase exists purely as a background sync/backup layer, with the addition (v0.12) of two Edge Functions that operate directly against Supabase's copy of the data for the LINE integration (Section 14).

### 17.1 High-Level Structure

```
┌───────────────────────────────┐
│  Renderer Process (UI)        │   HTML / CSS / JS
│  Interactive Room + Pages     │   (Task Board, Dashboard,
│                                │    Pomodoro, Calendar, Settings)
└───────────────┬────────────────┘
                 │ IPC
┌───────────────┴────────────────┐
│  Main Process (Electron)       │
│  ┌───────────────────────────┐ │
│  │ Application Services      │ │  Task Service · Classroom Sync
│  │                           │ │  Service · Pomodoro Service ·
│  │                           │ │  Dashboard Service · Notification
│  │                           │ │  Service · Cloud Sync Service
│  └─────────────┬─────────────┘ │
└────────────────┼────────────────┘
                  │
     ┌────────────┼────────────────┐
     │                              │
┌────┴─────┐                ┌───────┴────────┐
│ SQLite    │  background   │ Supabase &      │
│ (local)   │◄──  sync  ───►│ Google Classroom│
└───────────┘                │ APIs           │
                              └───────┬────────┘
                                      │
                       ┌──────────────┴───────────────┐
                       │  (New in v0.12)               │
                       │  Supabase Edge Functions       │
                       │  ┌─────────────┐ ┌───────────┐ │
                       │  │ line-webhook│ │notify-check│ │
                       │  │ (task create│ │ (pg_cron,  │ │
                       │  │  + linking) │ │  deadline  │ │
                       │  │             │ │  push)     │ │
                       │  └─────────────┘ └───────────┘ │
                       └──────────────┬─────────────────┘
                                      │
                              ┌───────┴────────┐
                              │  LINE Messaging │
                              │  API            │
                              └─────────────────┘

     (New in v0.6)
┌───────────────────────────────┐
│  Floating Widget (BrowserWindow)│  Always-on-top, presentational
│  Pomodoro phase / time remaining│  only — reads state via IPC from
└───────────────┬─────────────────┘  the Pomodoro Service above
```

### 17.2 Key Architectural Decisions

- **Single point of database access (local).** All SQLite access happens in Electron's main process; the renderer never touches the database directly.
- **Service-per-feature layering.** Each core feature is implemented as its own service module.
- **The Interactive Room is purely presentational.**
- **No custom backend server.** Supabase is used as a managed backend; the two Edge Functions added in v0.12 (Section 14) are hosted and scaled by Supabase, not self-managed infrastructure, and are treated as an extension of the existing managed service rather than a new server (Section 21).
- The scheduled Classroom fetch logic is implemented as an extension of the existing Classroom Sync Service.
- The review popup calls into the same Task Service already used for manual task creation.
- The Pomodoro Service manages a secondary always-on-top `BrowserWindow` (the floating widget).
- The manual "Sync now" action calls the same Classroom Sync Service function used by the automatic schedule.
- **(New in v0.12)** The two Edge Functions operate independently of the Electron main process — they read and write Supabase's copy of `tasks` and their own LINE-specific tables (Section 19.4) directly, and never call into the desktop app's services. Tasks they create reach the local SQLite database only through the existing Supabase → local pull mechanism (Section 18.2), the same path any other Supabase-originated change would take.
- **(New in v0.12)** Deadline-state computation (Section 9.2) is implemented twice — once in the Electron renderer/main process for local/desktop display, and once inside the `notify-check` Edge Function for LINE notifications — since the two runtimes (Node/Electron vs. Deno) do not currently share a code module. This duplication is a known maintainability risk, flagged in Section 20, rather than an oversight.

---

## 18. Synchronization Strategy

### 18.1 Principles (Confirmed)

- SQLite is the primary source of data during normal application usage.
- Data is synchronized to Supabase in the background whenever a connection is available.
- Google Classroom synchronization is a separate concern from this cloud sync.
- **(New in v0.12)** LINE integration (Section 14) is a separate concern from both of the above — it reads and writes Supabase directly rather than participating in the local-first sync described here, except that LINE-created tasks land in the same `tasks` table and therefore flow down to local SQLite through the mechanics below like any other Supabase-side change.

### 18.2 Mechanics (Finalized)

- **Sync triggers:** a background sync attempt runs on a fixed interval (default: every 5–10 minutes), plus an immediate, debounced attempt shortly after any local write.
- **Direction:** local → Supabase push; Supabase → local pull, tracked via a locally stored sync cursor.
- **Conflict resolution:** Last-Write-Wins (LWW), compared using **server-assigned** timestamps. `tasks.updated_at` is reserved exclusively for this purpose — it must not be repurposed as an activity or neglect signal (see `last_focus_started_at`, Section 19).
- **Deletions:** tasks use a soft-delete flag (`deleted_at`).
- **Retry behavior:** a failed sync attempt is simply retried on the next scheduled interval.
- **What is synced:** `tasks` and `pomodoro_sessions`. Local-only data — `notification_log`, `classroom_sync_state`, and `settings` — is **not** synced. **(New in v0.12)** The LINE-specific tables (`line_link_codes`, `line_account_links`, `line_conversation_state`, `line_notification_log` — Section 19.4) are Supabase-only and likewise never synced down to local SQLite; they exist solely for the Edge Functions described in Section 14 to read and write, and the desktop app never queries them directly.
- **What is never synced:** Google OAuth refresh tokens, stored only via OS-level secure storage. LINE Channel Access Token and Channel Secret (Section 14) are stored as Supabase Edge Function secrets, never in any synced table or in the desktop app.

---

## 19. Database Design (Conceptual)

This section defines entities and key fields at a specification level. Exact SQL types, indexes, and migration scripts are an implementation detail left to development.

**`tasks`**

| Field | Notes |
|---|---|
| id | Primary key |
| title | |
| notes | Free text (Section 12) |
| status | not_started / in_progress / completed. |
| due_date | Nullable (Section 9.2) |
| progress_percentage | Manual, 0–100 |
| priority | Nullable. **(New in v0.13.)** `low` / `medium` / `high`; `null` = not set. User-set only (Section 9.3). Feeds the Priority Factor of the Urgency Score (Section 9.5). Synced like other task fields. |
| source | manual / google_classroom / **line** *(new value, v0.12 — Section 14.3)* |
| classroom_assignment_id | Nullable, unique when present |
| course_name | Nullable. **(Renamed in v0.13 from `classroom_course_name`.)** The course a task belongs to, used for Task Board grouping and for the LINE Quick Reply options (Section 14.3). Filled from the Classroom course name when a Classroom item is imported (Section 13.5); for manual and LINE-created tasks it is entered by the user (optional). |
| classroom_last_updated | Nullable — Classroom's own `updateTime` (Section 13.3) |
| completed_at | Nullable, set on transition to Completed |
| deleted_at | Nullable — soft delete (Section 18.2) |
| last_focus_started_at | Nullable. Set to the current timestamp whenever a Pomodoro session starts for this task (Section 15.3). Drives Neglect Factor (Section 9.5) and Longest Inactive Assignment (Section 10.2). |
| created_at / updated_at | `updated_at` is reserved for LWW sync conflict resolution only (Section 18.2). It must **not** be read as an activity/neglect signal. For Classroom-sourced tasks, `created_at` is the local import timestamp; for LINE-sourced tasks, it is the moment the LINE creation flow completes (Section 14.3). |

**`classroom_sync_state`** — tracks assignments seen from Classroom, independent of whether they became tasks

| Field | Notes |
|---|---|
| classroom_assignment_id | Primary key |
| course_name | |
| last_seen_updated | Last-seen `updateTime` from Classroom |
| state | pending / imported / ignored / excluded |
| linked_task_id | Nullable FK to `tasks.id`, set when `state = imported`. Not cleared when the linked task is later soft-deleted. |

**`pomodoro_sessions`**

| Field | Notes |
|---|---|
| id | Primary key |
| task_id | FK to `tasks.id` — **not nullable**. |
| started_at | |
| planned_duration_seconds | |
| actual_duration_seconds | |
| completed | Boolean — false for partial sessions (Section 15.1) |
| batch_id | Nullable. Groups sessions belonging to the same batch (Section 15.3). |
| session_index | Nullable. This session's 1-based position within its batch. |
| session_total | Nullable. Total number of sessions in the batch. |
| created_at / updated_at | |

**`notification_log`** — local only, not synced

| Field | Notes |
|---|---|
| task_id | FK to `tasks.id`. |
| last_notified_state | Tracks the state last notified for (Section 11.3). Matches the five deadline states plus one notification-only value, `upcoming_within_window`. |
| notified_at | |

**`settings`** — local only, not synced; simple key-value store for notification preferences and app-level settings, including the Classroom import cutoff date (Section 13.1). Google OAuth tokens are **not** stored here — see Section 20.2.

**(New in v0.9)** `has_seen_first_run_prompt` — Boolean. Set `true` once the user dismisses or completes the first-run Google-connect prompt (Section 13.1); prevents the prompt from reappearing on subsequent launches. Local only, not synced, consistent with the rest of the `settings` table.

### 19.4 LINE Integration Tables (New in v0.12)

These four tables exist only on Supabase — they are read and written exclusively by the two Edge Functions described in Section 14, never by the desktop app, and are never synced to local SQLite (Section 18.2).

**`line_link_codes`** — short-lived codes used during account linking (Section 14.2)

| Field | Notes |
|---|---|
| code | Primary key. Short numeric string. |
| app_user_id | FK to `auth.users.id` (Supabase Auth). |
| expires_at | Default: 10 minutes after creation. Rows are not actively purged; an expired code simply fails validation. |

**`line_account_links`** — the confirmed mapping between a LINE user and an app user (Section 14.2)

| Field | Notes |
|---|---|
| app_user_id | FK to `auth.users.id`. |
| line_user_id | Unique. The `userId` value LINE assigns to the linked LINE account. |
| linked_at | |

**`line_conversation_state`** — tracks progress through the structured task-creation flow (Section 14.3)

| Field | Notes |
|---|---|
| line_user_id | Primary key. |
| current_step | e.g. `waiting_course` / `waiting_title` / `waiting_date`. |
| partial_task_data | JSON. Holds fields collected so far in the current flow. |
| updated_at | Used to detect and clear a stale, abandoned flow after 10 minutes of inactivity (Section 14.3). |

**`line_notification_log`** — deduplication state for LINE push notifications (Section 14.4), structurally parallel to `notification_log` but maintained separately since the cloud function has no access to the local table

| Field | Notes |
|---|---|
| task_id | FK to `tasks.id`. |
| line_user_id | |
| last_notified_state | Same six-value range as `notification_log.last_notified_state` (Section 11.3). |
| notified_at | |

---

## 20. Non-Functional Requirements

- **Performance:** the app should feel responsive on typical student laptop hardware for realistic data volumes (hundreds, not millions, of tasks).
- **Reliability:** SQLite provides local durability by default; Pomodoro sessions are preserved on ordinary shutdown even if interrupted. Data loss on hard crashes/power loss is an accepted limitation.
- **Security:**
  - Google OAuth refresh tokens are stored using OS-level secure storage (Electron's `safeStorage` API).
  - Supabase Auth reuses the same Google identity via Supabase's built-in Google OAuth provider support, rather than a separate username/password account system.
  - Supabase row-level security should scope each user's data to their own account.
  - **(New in v0.12)** The LINE Channel Access Token and Channel Secret (Section 14) are stored as Supabase Edge Function environment secrets, never committed to source control, and never exposed to the desktop client.
- **Usability:** navigation should stay consistent with the low-friction, Room-based philosophy in Section 6.
- **Maintainability:** the layered structure in Section 17 and the deliberately small stack (Section 16) keep the codebase within the ability of a two-person undergraduate team. **(New in v0.12) Known limitation — duplicated deadline-state logic:** the deadline-state computation (Section 9.2) is implemented once in the Electron app and once in the `notify-check` Edge Function (Section 17.2), because the two runtimes do not currently share a code module. A future change to the Section 9.2 rules must be applied in both places by hand; documented here as an accepted maintainability risk rather than solved in this version, consistent with this document's existing practice of surfacing known limitations rather than hiding them (see the account-mixing limitation below for the established precedent).
- **Testability:** deadline state computation, the Time-to-Start Lag percentage calculation, the Urgency Score calculation, dashboard metric aggregation, and LWW conflict resolution are good candidates for unit tests.
- **Portability:** intentionally out of scope beyond Windows (Section 5).

**(New in v0.9) Known limitation — no cloud backup without Google connection:** since Supabase Auth relies exclusively on Google identity (this section, above), a user who declines the first-run prompt (Section 13.1) and never connects Google Classroom afterward has no cloud backup; data exists only in local SQLite. This is an accepted trade-off given the app's desktop-only target (Section 5) — cross-device switching is inherently less common on desktop than on mobile, and moving to an unfamiliar machine (e.g., a friend's computer or a shared university lab machine) would require reinstalling the app, which is friction that already makes this scenario uncommon regardless of backup availability. This is documented here explicitly rather than left implicit, consistent with this document's existing practice of surfacing accepted limitations (see Section 11.2 for a precedent: the app already cannot observe activity that happens while it is closed, so work done outside the app — on any device — falls outside the system's tracking scope by design, not as a new gap introduced by this limitation).

**(New in v0.9) Known limitation — single account per device:** Section 13.1 supports one connected Google Classroom account at a time. Switching from one Google account to another on the same device is not guarded against at the data layer — local `tasks` rows carry no per-account owner field (the local schema is designed for a single account, consistent with Section 13.1's "only a single connected Classroom account is supported"). This could result in tasks from two different accounts mixing within the same local SQLite file if a user disconnects one account and connects a different one. No mitigation is implemented for MVP scope; flagged here as a candidate for future work (e.g., detecting a Google account-ID mismatch on reconnect and warning the user, or requiring explicit confirmation before proceeding, rather than silently mixing or silently clearing local data).

**(New in v0.12) Known limitation — course-name mismatch for LINE-created tasks:** as noted in Section 14.5, a course entered through the LINE free-text fallback is not reconciled against existing Classroom course names, so a typo or alternate spelling produces a separate grouping on Task Board rather than merging with the existing course. No mitigation is implemented for MVP scope; flagged as a candidate for future work alongside the account-mixing limitation above.

**(New in v0.12) Known limitation — LINE push volume limits:** LINE Official Account free-tier plans cap the number of push messages sendable per month (per LINE's own Messaging API terms). This is an external platform constraint, not something StudyFlow controls; not expected to be reached at the scale of the planned user evaluation, but documented here rather than left implicit.

**(New in v0.13) Known limitation — Priority can be flattened by the user:** Priority is user-set and optional (Section 9.3). If a user marks every task High, every non-completed task receives the same 20-point increment, so Priority no longer separates tasks and the ordering reduces to what the other three signals produce. This is the same behaviour that led to Priority's removal in v0.8; it is accepted here because Priority is now bounded to one component of the Urgency Score and an unset priority contributes nothing, so the worst case is a loss of information, not a distorted ranking. No mitigation (such as limiting how many tasks can be High) is implemented for MVP scope; it can be revisited after the planned user evaluation (Section 29).

---

## 21. Design Constraints

- Two undergraduate developers.
- Target: approximately 2–3 months total for this phase of the project, including roughly 2 months of implementation after the proposal defense.
- Feature-scope trade-offs are **deliberately not pre-decided in this document** — deferred to committee feedback at the proposal defense.
- No custom backend server — Supabase is used as a managed service. **(New in v0.12)** The Supabase Edge Functions used for LINE integration (Section 14) are treated as an extension of this same managed service, not a new server, for the same reason: Supabase handles hosting, scaling, and deployment, and no infrastructure is self-managed.
- No offline peer-to-peer or multi-node sync; Supabase is the only synchronization mechanism.
- No OS-level background service for notifications or Classroom fetching — checks only occur while the app is running, or via an explicit user tap on "Sync now". **(New in v0.12)** The LINE deadline-check (Section 14.4) is an explicit, documented exception to "checks only occur while the app is running" — it runs on Supabase's `pg_cron`, independent of the desktop app's process, by design (that independence is the entire point of the feature — see Section 14.1).
- Google Classroom fetch runs automatically on app launch plus an on-demand manual trigger, but does **not** use push-based infrastructure (Section 13.5).
- **(New in v0.12)** No workflow-automation tool (e.g. n8n) is used for LINE integration — both directions are implemented as Supabase Edge Functions, to avoid adding a third external managed service beyond Supabase, Google, and LINE (Section 14.6).
- **(New in v0.12)** No AI/LLM component is used anywhere in the LINE integration — both directions use deterministic, structured logic only (Section 14.6).
- These constraints exist specifically to keep the project achievable; relaxing any of them should be treated as a scope-risk decision requiring discussion with the thesis advisor.

---

## 22. MVP Definition

The MVP is the complete set of features required for thesis submission. Every item below traces to at least one problem in Section 3.

**Included:**
- Interactive Room navigation layer (Section 7)
- Manual task creation and management, including computed Urgency Score (Section 9.5) and an optional user-set Priority that feeds it (Section 9.3)
- Google Classroom fetch — automatic on every app launch, plus manual on-demand sync — with user review before import (Section 13, 13.5)
- **(New in v0.9)** A one-time first-run prompt offering to connect Google Classroom, with the option to defer (Section 13.1)
- **(New in v0.12)** LINE integration: task creation via a structured chat flow, and deadline-state push notifications independent of whether the desktop app is running (Section 14)
- Computed deadline state: Upcoming / Due Today / Overdue / No Deadline / Completed (Section 9.2)
- Manual progress percentage and free-form notes (Section 12)
- Dashboard with the seven finalized metrics and This Week / This Month / All Time filtering (Section 10)
- Desktop notifications with default deadline-state-based rules (Section 11)
- Pomodoro: task-linked sessions only, multi-session batches with phase-transition notifications and a persistent floating widget, partial-session recording (Section 15)
- Background Supabase sync with LWW conflict resolution (Section 18)
- Google OAuth 2.0 connection for Classroom access (Section 16)

**Explicitly excluded from MVP** (see Section 24 for the full list):
- Gamification / Study Companions in any form
- Multiple simultaneous Classroom accounts
- Automatic handling of Classroom assignments edited after import
- Cross-platform support
- Real-time push-based Classroom notifications via Google Cloud Pub/Sub
- "Assignment recommendation" — resolved, see Section 26
- **(New in v0.9)** A mandatory login/account system, or any mechanism preventing local data mixing across Google accounts on the same device — see Section 20's known limitations
- **(New in v0.12)** Any AI/LLM component within the LINE integration, natural-language parsing of LINE-submitted task details, or a workflow-automation tool (e.g. n8n) — see Section 14.6
- **(New in v0.12)** Integration with Microsoft Teams, Discord, or Facebook directly — LINE addresses the general capture-without-opening-the-app need, not platform-specific integrations with every source named in Section 3

---

## 23. Current Decisions (Confirmed)

- Desktop-first, Windows only.
- Google Classroom is the primary external integration for automatic task capture in the MVP; **(New in v0.12)** LINE is a second, independent external integration added for structured manual capture and cloud-scheduled notifications (Section 14).
- Manual task entry remains supported alongside Classroom sync, including via the LINE structured chat flow (Section 14.3).
- The Interactive Room is a navigation layer, not a feature in itself, and contains no business logic (Section 17.2) — LINE integration adds no Room object, since it is reached entirely outside the desktop app (Section 7).
- Progress is updated manually by the user.
- The application's role is to reduce friction — not to replace user decision-making.
- Google Classroom account connection/OAuth is managed in Settings, including the mandatory import cutoff date set on first connect (Section 13.1); newly-fetched assignments are surfaced via a review popup rather than appearing directly on Task Board (Section 13.5).
- **(New in v0.9)** On first launch, the app offers — but does not require — connecting Google Classroom via a one-time, dismissible prompt (Section 13.1); declining routes the user directly into normal, fully offline-capable use, with Google connection still available later in Settings at any time.
- Google Classroom fetch runs automatically once on every app launch, and can also be triggered manually at any time via "Sync now" on Task Board. Fetched assignments enter a review queue and are presented to the user (Create Task / Ignore) rather than being imported directly, unless a Pomodoro session is currently running, in which case the review is held behind a quiet indicator until the session ends. Both Create Task and Ignore are unconditionally permanent — never reopened by a later sync, regardless of any subsequent edit to the assignment on Google's side.
- Disconnecting a Google Classroom account does not delete already-imported tasks.
- **(New in v0.12)** LINE connection is managed in Settings, independently of Google Classroom connection, via a short numeric code exchanged between the app and a message sent to the LINE Official Account (Section 14.2). Disconnecting LINE does not delete already-created tasks.
- **(New in v0.12)** Task creation via LINE uses a structured, button-and-picker chat flow — never freeform natural-language parsing — and creates tasks directly, without passing through the Classroom review popup (Section 14.3).
- **(New in v0.12)** Deadline notifications are pushed to LINE on a fixed cloud-side schedule, independent of whether the desktop app is running, mitigating (not eliminating) the accepted limitation that desktop notifications require the app to be open (Section 11.2, Section 14.4).
- **(New in v0.12)** No AI/LLM component and no workflow-automation tool (e.g. n8n) are used anywhere in the LINE integration (Section 14.6).
- Pomodoro is reached exclusively through a task — there is no general/task-less session and no Room entry point for it (the Clock object is removed, Section 7). Sessions run as configurable multi-session batches with automatic focus→break→next-focus progression, OS notifications at each phase transition, and a persistent always-on-top floating widget. Starting a task's first batch auto-transitions its status from Not Started to In Progress and sets `last_focus_started_at`.
- Dashboard supports This Week / This Month / All Time filtering; Overdue and Longest Inactive Assignment are always real-time. Average Time-to-Start Lag is expressed as a percentage of each task's own available time window.
- Deadline state is computed at read-time and includes a "No Deadline" state; completed tasks are never shown as Overdue.
- Tasks imported from Google Classroom are assigned an initial status based on the corresponding `StudentSubmission.state`, checked at the moment of import confirmation. Tasks created via LINE always start at Not Started (Section 9.1).
- **(New in v0.13)** Priority (Low / Medium / High, optional, user-set, no default) is reinstated, but only as one weighted component (0.2) of the Urgency Score, which remains the sole signal driving Task Board's default sort order (Sections 9.3, 9.5). It was originally removed in v0.8 as a standalone field.
- **(New in v0.13)** `tasks.course_name` (renamed from `classroom_course_name`) holds the course for tasks from every source, so manual and LINE-created tasks can be grouped by course (Section 19).
- Neglect-related signals are driven by `tasks.last_focus_started_at`, not `tasks.updated_at` — the latter is reserved exclusively for LWW sync conflict resolution.
- The reminder-window notification rule tracks a sixth, notification-only state (`upcoming_within_window`) in `notification_log`, fixing a dedup bug (Section 11.3); LINE notifications track the same state independently in `line_notification_log` (Section 11.3, Section 19.4).
- The stale "assignment recommendation" open question is resolved: matched to the existing Urgency Score plus Deadline-State-bucket grouping.
- The project timeline is stated concretely as ~2–3 months total, ~2 months of implementation after the proposal defense.
- The Task Board / Room object previously named "Quest Board" is renamed "Task Board" throughout the application.
- **(New in v0.9)** A user who never connects Google Classroom (whether by declining the first-run prompt or simply never opening Settings to connect) has no cloud backup for their data; this is an accepted, documented limitation, not an oversight (Section 20).
- **(New in v0.9)** Switching Google accounts on the same device is not guarded against at the data layer for MVP; this is an accepted, documented limitation and a candidate for future work (Section 20).
- Technology stack: Electron, HTML/CSS/JS, SQLite (local), Supabase/PostgreSQL (cloud sync), Google OAuth 2.0, Google Classroom API (Section 16). **(New in v0.12)** Extended with LINE Messaging API, Supabase Edge Functions, and Supabase `pg_cron`.
- Architecture: local-first, single-process database access, service-per-feature layering (Section 17); **(New in v0.12)** two Supabase Edge Functions operate directly against Supabase's copy of the data for LINE integration, outside the local-first path, and are documented as a deliberate exception (Section 17.2).
- Sync: interval-based background sync with LWW conflict resolution using server timestamps; soft deletes; OAuth tokens never synced (Section 18). LINE-specific tables are Supabase-only and never synced to local SQLite (Section 18.2).

---

## 24. Out of Scope (Current)

- Jira integration
- Microsoft Teams integration
- Discord integration
- Facebook integration
- AI-generated task progress
- Automatic progress estimation
- Cross-platform support
- Multiple simultaneous Google Classroom accounts
- Automatic handling of Classroom assignments that were edited after import
- OS-level background notification service (Section 11.2)
- Custom-built backend server (Supabase is used as a managed service)
- Study Companions in any form, including a reduced version (see Section 25)
- Real-time push notifications for Google Classroom changes via Google Cloud Pub/Sub
- Untethered/general Pomodoro sessions not linked to any task
- **(New in v0.9)** A mandatory login/account-creation flow of any kind. Google connection is always optional and never gates entry to the app (Section 13.1).
- **(New in v0.9)** Automatic detection or prevention of mixed local data across different Google accounts on the same device — documented as a known limitation (Section 20) rather than solved in this version.
- **(New in v0.12)** Any AI/LLM component within the LINE integration; natural-language or freeform-text parsing of LINE-submitted task details (Section 14.6).
- **(New in v0.12)** A workflow-automation tool such as n8n — LINE integration is implemented entirely as Supabase Edge Functions (Section 14.6).
- **(New in v0.12)** LINE group-chat support — only 1:1 messages from a linked individual are processed (Section 14.6).
- **(New in v0.12)** Reconciliation of mismatched or misspelled course names entered through the LINE free-text fallback — documented as a known limitation (Section 20) rather than solved in this version.

---

## 25. Future Features (Only If Time Allows)

These are optional stretch goals. Their absence should **not** affect thesis completion or evaluation.

- Room customization
- Decorations
- Cosmetic rewards
- Expanded gamification
- **(New in v0.9)** Detecting a Google account-ID mismatch on reconnect and warning the user before local data could mix across accounts (see Section 20's known limitation)
- **(New in v0.12)** Reconciling course names entered via the LINE free-text fallback against existing Classroom-sourced course names, to prevent duplicate groupings from typos or alternate spellings (see Section 20's known limitation)
- **(New in v0.12)** Sharing a single deadline-state computation module between the Electron app and the `notify-check` Edge Function, to remove the duplicated-logic maintainability risk documented in Section 20

**Study Companions were considered during early design exploration but have been formally removed from the project scope due to thesis feasibility.**

They are not part of the MVP or future implementation.

---

## 26. Open Questions

**(Resolved in v0.8)** The former item 1, "business rules for assignment recommendation," is now closed — matched to Deadline-State-bucket grouping (Section 9.2) combined with Urgency Score (Section 9.5).

The following remains genuinely deferred:

1. **Assignment-level UX details deferred to implementation**: exact clock time for daily notification checks, exact wording/iconography for Room indicators, exact visual layout of the Classroom review popup, the Pomodoro floating widget, the first-run prompt (Section 13.1), and **(New in v0.12)** the exact wording of the LINE structured chat flow's prompts and buttons (Section 14.3). Precise Electron IPC message shapes, and precise LINE Edge Function payload shapes. These are intentionally left to implementation.
2. **(New in v0.12)** The exact polling interval for the LINE deadline-check (`pg_cron` schedule, Section 14.4) is stated as a 15–30 minute target range, not a single confirmed value — the final figure is an implementation-time trade-off between notification freshness and LINE API/Supabase invocation volume, deferred to implementation.

All other items previously listed as `TBD` are now confirmed decisions — see Sections 9–23 and the Changelog below.

---

## 27. AI Instructions

Any AI assistant working with this project must:

Treat this document as the Single Source of Truth.

Do not invent requirements.

Challenge unnecessary complexity.

Ask for clarification when information is insufficient.

This document overrides any conflicting assumptions from previous conversations.

---

## 28. Changelog

*(Section numbers referenced inside each changelog entry below reflect the numbering that was current **at the time that entry was written** — they are a historical record, not live cross-references. See Section 1 for the v0.12 renumbering note.)*

### v0.12 → v0.13

| Section | Change | Reason |
|---|---|---|
| Header | Version bumped to 0.13; status and Supersedes line updated (Supersedes was still v0.11) | Standard versioning practice for an evolving SSOT document |
| 1 | Added a v0.13 note: no sections added or renumbered; derived documents must be updated | Avoids a repeat of the v0.12 renumbering confusion and flags the follow-up work on derived documents |
| 8 | Core Features entry for task management now mentions the optional Priority input to the Urgency Score | Keeps the feature list in sync with Sections 9.3 and 9.5 |
| 9.3 | Reinstated Priority as an optional, user-set Low / Medium / High field with no default; documented where it is and is not set, why it returns, and why the v0.8 objection is mitigated; the original removal rationale is kept as history | Advisor feedback: system-derived signals alone cannot express the importance or size of a task, so long projects ranked below short tasks |
| 9.5 | Added a fourth signal, Priority Factor (weight 0.2; High = 1, Medium = 0.5, Low / not set = 0); re-balanced the other weights to 0.4 / 0.24 / 0.16 (the v0.12 proportions × 0.8); updated the formula, the no-`due_date` rule, and the weight-tuning limitation; rewrote the sentence that called the score purely system-derived | Priority is only useful if it feeds the ranking, and the "no subjective input" claim is no longer true |
| 14.3 | Noted that the LINE flow does not ask for Priority | Keeps the flow at three steps and within the scope set in Section 14.6 |
| 19 | Renamed `tasks.classroom_course_name` to `course_name` and applied it to all sources; added `tasks.priority` | Section 14.3 referred to `course_name` on `tasks`, which did not exist in the data model; manual and LINE-created tasks had no field to hold a course |
| 20 | Added a known limitation: users can flatten Priority by marking everything High | Same practice as earlier versions of documenting accepted limitations; this is the reason Priority was removed in v0.8 |
| 22 | Included list mentions Priority; removed the "manual Priority field" line from Explicitly Excluded | Keeps the MVP list in sync |
| 23 | Replaced the "Priority is removed" decision with the reinstatement decision; added a `course_name` decision | Keeps the decision summary in sync |
| 24 | Removed "Manual Priority field" from Out of Scope | No longer out of scope |
| 28 | Added this v0.12 → v0.13 changelog entry | Standard practice for this document |
| 29 | Added a v0.13 note on how to describe the Urgency Score now that it has one user-set input | Prevents the defense from repeating the earlier "no subjective input" framing |

### v0.11 → v0.12

| Section | Change | Reason |
|---|---|---|
| Header | Version bumped to 0.12; status and Supersedes line updated | Standard versioning practice for an evolving SSOT document |
| 1 | Added a v0.12 note explaining that inserting Section 14 shifted all subsequent section numbers by one, and that historical changelog entries below retain their original, as-written section numbers | A scope review identified two gaps (source coverage beyond Classroom; no notifications while the app is closed) not addressed by any existing feature; documenting the renumbering explicitly avoids ambiguity when cross-referencing older changelog rows against the new numbering |
| 8 | Added LINE-based manual task creation and LINE-based deadline notifications to the Core Features list | Keeps the feature list in sync with the new Section 14 |
| 9.1 | Added a note that LINE-created tasks always start at Not Started, since there is no Classroom-equivalent submission-state signal for them | Section 9.1's status-assignment rule was previously written only with Classroom import in mind |
| 9.2 | Added a note that the deadline-state rules are re-implemented, unchanged, inside the LINE notification Edge Function, and flagged the resulting duplication as a maintainability risk | The same computation now exists in two runtimes (Electron and Deno/Supabase) with no shared code module |
| 10.3 | Clarified that `created_at` for LINE-created tasks is the moment the LINE flow completes, for Time-to-Start Lag purposes | Keeps the metric's definition unambiguous now that a third task-creation path exists |
| 11.1 | Noted that the same three default notification rules also drive LINE pushes, with no separate LINE-specific configuration | Avoids implying a second, independently configurable rule set |
| 11.2 | Revised the "app not running" known limitation to note that it is mitigated (not eliminated) for users who have connected LINE | The LINE notification check (Section 14.4) directly addresses this previously-accepted limitation for a subset of users |
| 11.3 | Added a note that `line_notification_log` is a separate dedup table from `notification_log`, and that cross-channel duplication (desktop + LINE) is accepted rather than solved | The cloud-side check has no access to the local dedup state |
| 13.1 | Added a note that the Google first-run prompt and LINE connection are independent, with no combined onboarding step | Prevents an implicit assumption that connecting one implies or triggers the other |
| 13.5 | Added a note that LINE-created tasks never enter `classroom_sync_state` or the review popup | Clarifies why the two task-creation paths (Classroom review vs. LINE direct-create) intentionally behave differently |
| 14 (new) | Added the full LINE Integration section: purpose/rationale (14.1), account linking (14.2), task creation via structured chat flow (14.3), deadline notifications (14.4), data lifecycle/edge cases (14.5), and explicit out-of-scope boundaries — no AI/LLM, no NLP parsing, no workflow-automation tool (14.6) | Addresses the two gaps identified in the scope review: source coverage beyond Classroom, and no notifications while the app is closed (Section 3, Section 11.2) |
| 15–29 | Renumbered from old Sections 14–28 (Pomodoro through Thesis Readiness Assessment), with internal cross-references updated accordingly | Made room for the new Section 14; see Section 1 |
| 16 (Tech Stack) | Added rows for LINE Messaging API, Supabase Edge Functions, and Supabase `pg_cron` | Keeps the stack table in sync with Section 14 |
| 17 (Architecture) | Added the two Edge Functions and the LINE Messaging API to the high-level structure diagram; added two bullets to Key Architectural Decisions noting the Edge Functions' independence from the Electron process and the duplicated deadline-state logic | Keeps the architecture diagram and decisions list in sync with Section 14 |
| 18.1 / 18.2 (Sync) | Noted that LINE integration is a separate concern from local-first sync, and that the four LINE-specific tables are Supabase-only and never synced to local SQLite | Prevents an incorrect assumption that LINE data participates in the existing local ↔ cloud sync cursor mechanism |
| 19 | Added new Section 19.4, "LINE Integration Tables," documenting all four new tables (`line_link_codes`, `line_account_links`, `line_conversation_state`, `line_notification_log`); added `line` as a new accepted value for `tasks.source` | Keeps the data model in sync with Section 14 |
| 20 | Added three known limitations: duplicated deadline-state logic across runtimes; course-name mismatch for LINE free-text fallback; LINE push volume limits on free-tier plans | Follows this document's established practice of surfacing accepted limitations explicitly (precedent: Section 20's existing no-backup and single-account limitations from v0.9) |
| 21 | Added two bullets clarifying that the Edge Functions count as an extension of the existing managed Supabase service (not a new server), that the LINE cloud-scheduled check is a deliberate, documented exception to "checks only occur while the app is running," and that no workflow-automation tool or AI/LLM component is used | Keeps the design-constraints list in sync with Section 14 and Section 14.6 |
| 22 | Added the LINE integration to the MVP Included list; added two lines to Explicitly Excluded clarifying no AI/LLM/NLP/workflow-tool, and no direct Teams/Discord/Facebook integration | Keeps the MVP list in sync with Section 14 |
| 23 | Added decision bullets summarizing LINE connection management, structured task creation, cloud-scheduled notifications, and the explicit no-AI/no-workflow-tool stance | Keeps the decision summary in sync with the rest of the document |
| 24 | Added four Out of Scope bullets: AI/LLM/NLP parsing within LINE integration; workflow-automation tooling; LINE group-chat support; course-name reconciliation | Documents what this version explicitly does not attempt to solve, consistent with how other deferred items are recorded elsewhere in this document |
| 25 | Added two Future Feature entries: course-name reconciliation for the LINE fallback; sharing a single deadline-state module between the Electron app and the Edge Function | Gives both newly-documented limitations a named place to be revisited if time allows |
| 26 | Added two Open Questions: exact wording of the LINE chat flow's prompts/buttons; the exact `pg_cron` polling interval within the stated 15–30 minute range | Same category of "cheap to decide during development" detail as the existing entries |
| 28 | Added this v0.11 → v0.12 changelog entry, and a header note clarifying that section numbers inside changelog rows are historical, not live | Standard practice for this document |

*(For v0.10 → v0.11 and earlier changelog entries, see PROJECT_v0.11.md.)*

---

## 29. Thesis Readiness Assessment

**Proposal submission — Ready.** The problem statement (Section 3), target users (Section 4), and scope boundaries (Sections 5, 21, 24, 25) are explicit and internally consistent.

**Implementation — Ready to begin, with one new, explicitly scoped addition.** Core modules have clear, non-contradictory business rules and a defined data model. **(v0.12 note)** The LINE integration (Section 14) is new implementation work — unlike the v0.9 first-run prompt, which reused an existing flow verbatim, this version adds two new Supabase Edge Functions, four new tables, and a second external API. It is scoped narrowly and deliberately (structured input only, no AI/LLM, no third-party workflow tool — Section 14.6) specifically so that its implementation risk stays bounded and estimable within the existing ~2-month post-defense timeline (Section 21); it is not a thin addition on the order of v0.9's prompt, and should be planned for accordingly rather than treated as trivial.

**Thesis defense framing — Strengthened.** Average Time-to-Start Lag (Section 10.3) and Urgency Score (Section 9.5) remain the project's clearest academic contribution — one designed technique applied twice. **(v0.12 addition)** The LINE integration adds a second kind of contribution: a deliberate, documented decision *not* to reach for AI/LLM components where a structured, deterministic alternative achieves the same user-facing outcome with less risk and better testability (Section 14.6) — directly continuing the "exclude/document rather than silently guess or hide" posture already established for the rejected learned-Urgency-Score-weighting idea (Section 9.5) and the v0.9 known-limitation entries. This gives the defense a coherent, explicit position on AI/ML scope, rather than an implicit absence that could otherwise be read as an oversight.

The evaluation gap flagged in earlier readiness assessments remains addressed: real user testing with currently-enrolled junior students is planned. **(v0.12 note)** This user testing window is also the natural point to validate whether the LINE integration is used enough, by enough participants, to be worth reporting on quantitatively — an outcome that cannot be predicted in advance and should not be assumed.

**Timeline — affected, and this should be stated plainly rather than minimized.** Section 21's ~2-month post-defense implementation estimate now needs to absorb the LINE integration's estimated implementation time (accountlinking, the structured chat-flow state machine, and the scheduled notification function — roughly 2.5–3 weeks by the team's own estimate). Unlike the v0.9 and v0.10 additions, this is not a documentation-only or thin-UI change; it should be explicitly budgeted for in the implementation plan presented at defense, not treated as absorbed into the existing estimate by default.

**(v0.13 note) Describing the Urgency Score at the defense.** The Urgency Score is no longer entirely system-derived: three of its four components (deadline, progress gap, neglect) are computed from data the app already holds, and the fourth (Priority) is a user-set input added after advisor feedback. It should be presented that way, with Priority's weight (0.2) described as a reasoned starting point rather than a tuned value, and with the flattening limitation (Section 20) stated up front. It should not be claimed that Priority makes the ranking more accurate; the intended and defensible claim is narrower: it lets the user tell the app that a long or important task matters, which the other three signals cannot express.
