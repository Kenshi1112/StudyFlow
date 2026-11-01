# UI/UX Design Review
### Academic Task Manager — based on PROJECT_v0.16.md
**Reviewer stance:** Senior Product / UX / Desktop App Designer
**Scope:** Presentation layer only. No features added, removed, or redefined. Every recommendation below maps to something already confirmed in PROJECT_v0.16.md (cited by section).
**Target:** Desktop (Windows, Electron, HTML/CSS/JS). Deliverable-ready for Figma.

---

## Revision Note — v0.16 changes (applied on top of the v0.14 pass below)

PROJECT_v0.15 changed nothing visible, so this document stayed at v0.14. PROJECT_v0.16 changes one control in Settings:

| PROJECT_v0.16 change | Where it affects this document |
|---|---|
| The single reminder-window value is replaced by reminders the user ticks: 7, 3, 2 and/or 1 day before the due date, default 1 day only (Sections 11.1, 11.4) | **Section 5 (Settings)** — the numeric stepper next to "Remind me about upcoming deadlines" becomes a row of four checkboxes; the "include" list no longer has a stepper; microcopy added |
| LINE follows the same selection (Section 14.4) | **Section 5 (Settings)** — no new control; the existing "Also sent to LINE" helper line now also covers the chosen days |

## Revision Note — v0.14 changes (applied on top of the v0.13 pass below)

| PROJECT_v0.14 change | Where it affects this document |
|---|---|
| "Longest Inactive Assignment" is removed; the Dashboard has six metrics (Section 10.2) | **Section 3 (Dashboard)** — Needs Attention strip now holds Overdue only, layout sketch redrawn, the "link to the task's detail" bullet removed, and "seven metrics" changed to "six" in the hierarchy text, the avoid list, the information-density list and the top-priorities summary |
| Time-to-Start Lag counts from the first "Start Working" press (`first_started_at`) (Sections 10.3, 15.3) | No visual change; the Time-to-Start Lag card and its plain-language example stay as they are |

---

## Revision Note — Aligned to PROJECT_v0.13.md

This document was previously aligned to PROJECT_v0.11.md and is now revised to match PROJECT_v0.13.md. Only the v0.13 changes are applied in this pass:

| PROJECT_v0.13 change | Where it affects this document |
|---|---|
| Priority (Low / Medium / High, optional, user-set, no default) is reinstated as one weighted input to the Urgency Score; the Urgency Score remains the sole signal driving default order (Sections 9.3, 9.5) | **Section 2 (Task Board)** — card tier table, ordering note, new Task Create / Edit Form subsection, Include / Avoid lists; **Section 6** — the color-collision guidance returns to three signals (Deadline State, Priority, Urgency Score); **Summary priority list** — item 3 updated, item 12 added |
| `classroom_course_name` is renamed `course_name` and now applies to tasks from every source; manual tasks can carry an optional course (Sections 14.3, 19) | **Section 2** — the card shows a course for any task that has one, not only Classroom-sourced tasks; the form gains an optional Course field; the Course filter is no longer Classroom-only |
| **(Applied in the same pass)** LINE integration, introduced in v0.12 and never reflected here: Connect / Disconnect LINE in Settings (Section 14.2); `line` as a third task source (Sections 14.3, 19); LINE-created tasks bypass the Classroom Review Popup (Section 14.3); the three notification rules also drive LINE pushes with no separate configuration (Sections 11.1, 14.4) | **Section 2 (Task Board)** — source icon, Source filter, Detail panel line; **Section 5 (Settings)** — LINE card in category 1, LINE note under Notifications, control count; **Section 6** — consistency and honesty notes; **Summary** — item 13 |
| Nothing else changes: Dashboard metrics (Section 10), Pomodoro (Section 15), sync (Section 18) | **Sections 0, 1, 3, 4** — unchanged |

**Applied — PROJECT_v0.12.md (LINE integration).** This document had stayed aligned to v0.11 while the spec moved on. The LINE items are now covered in the same pass as v0.13. Wording of the LINE chat flow itself (prompts, buttons) is not a screen in this app and is out of scope here (Section 26).

<details>
<summary>Prior revision note — Aligned to PROJECT_v0.11.md (historical)</summary>

This document was previously aligned to PROJECT_v0.10.md and was revised to match PROJECT_v0.11.md. Three related changes:

| PROJECT_v0.11 change | Where it affects this document |
|---|---|
| Classroom fetch moves from four fixed daily windows to launch-triggered (plus existing manual Sync Now), decoupled from the notification interval (Sections 11.2, 13.2, 13.5) | **Section 5 (Settings)** — status microcopy no longer promises a "next automatic check" time; **Section 2 (Classroom Review Popup)** — trigger wording updated to launch-time fetch |
| Delete/Ignore are now unconditionally permanent, never reopened by a later sync (Sections 13.2, 13.3, 13.5) | No presentation-layer change — this was a data/business-logic correction only |
| A new Classroom item found while a Pomodoro session is running no longer interrupts it with the review popup (Section 13.5) | **Section 2 (Classroom Review Popup)** — added the session-safe exception, reusing the existing pending-review indicator pattern |

</details>

<details>
<summary>Prior revision note — Aligned to PROJECT_v0.10.md (historical)</summary>

This document was previously aligned to PROJECT_v0.9.md and is now revised to match PROJECT_v0.10.md. One spec change, narrow in scope:

| PROJECT_v0.10 change | Where it affects this document |
|---|---|
| The manual "Sync now" trigger moves from Settings to Task Board's top bar; a manual trigger that finds zero new items now shows a brief confirmation instead of staying silent (Sections 13.1, 13.2, 13.5) | **Section 2 (Task Board)** — top-bar note now includes the Sync Now button and last-synced label; **Section 5 (Settings)** — connection card keeps last-sync time as read-only status, drops the button; **Section 2 (Classroom Review Popup)** — trigger wording updated to Task Board; **Summary priority list** — item 9 updated |

</details>

<details>
<summary>Prior revision note — Aligned to PROJECT_v0.9.md (historical)</summary>

This document was previously aligned to PROJECT_v0.8.md and is now revised to match PROJECT_v0.9.md. The only spec change is additive and narrow in scope:

| PROJECT_v0.9 change | Where it affects this document |
|---|---|
| A one-time, dismissible First-Run Prompt is added, offering to connect Google Classroom on first launch — declining routes straight into normal use (Section 13.1) | **New Section 0 (First Launch)** — added to cover the prompt's layout, button weighting, and dismiss behavior; **Section 5 (Settings)** — added a quiet "not connected" banner for users who declined or haven't yet connected; **Section 6** — added a consistency note tying the prompt's and banner's microcopy together |

No other page (Room, Task Board, Dashboard, Pomodoro) is affected — the first-run prompt is a one-time overlay shown before the Room is ever seen, and nothing about Sections 9–17 of PROJECT.md changed in this version. Earlier revision notes (v0.3→v0.5 through v0.7→v0.8) have been kept below for historical reference.

</details>

<details>
<summary>Prior revision note — Aligned to PROJECT_v0.8.md (historical)</summary>

This document was previously aligned to PROJECT_v0.7.md and is now revised to match PROJECT_v0.8.md. The headline change is a simplification, not an addition:

| PROJECT_v0.8 change | Where it affects this document |
|---|---|
| Pomodoro is now reached exclusively through a task — the general/task-less session and its Room "Clock" entry point are removed (Sections 7, 14) | **Section 1 (Room)** — dropped from four objects to three, redrew the layout sketch; **Section 4 (Pomodoro)** — removed the "or General session" fallback state and the two-entry-point framing throughout; **Section 6** — retired the now-moot "two entry points must look identical" guidance, added a new consistency note for the auto status-transition instead |
| Starting a task's first Pomodoro batch auto-transitions its status from Not Started to In Progress (Sections 9.1, 14.3) | **Section 4** — added a note that this is a silent side effect, not a confirmation-dialog moment; **Section 6** — new consistency note about keeping status displays in sync across pages |
| The manual Priority field is removed; Task Board ordering now relies entirely on the computed Urgency Score (Section 9.3, 9.5) | **Section 2 (Task Board)** — removed the Priority flag from the card hierarchy tier table, the filter bar, and the "avoid" list; simplified the Urgency-Score-should-have-no-chip guidance to a two-system (not three-system) concern; **Section 6** — collapsed the Priority/Deadline-State/Urgency-Score three-way color-collision guidance down to Deadline-State vs. Urgency-Score only. *(Reversed in v0.13: Priority returns, see the revision note above.)* |

</details>

<details>
<summary>Prior revision note — Aligned to PROJECT_v0.7.md (historical)</summary>

This document was previously aligned to PROJECT_v0.6.md and was revised to match PROJECT_v0.7.md. One focused spec change required updates at that time:

| PROJECT_v0.7 change | Where it affected this document |
|---|---|
| Google Classroom fetch schedule expanded from three unnamed windows to four confirmed times (06:00, 12:00, 18:00, 00:00); a manual "Sync now" trigger is added alongside the automatic schedule (Section 13.5) | **Section 5 (Settings)** — added the "Sync now" control, updated status microcopy and control count; **Section 2 (Task Board)** — clarified the top-bar "no sync button" guidance now that Settings has one; **Section 6** — updated the "checks a few times a day" framing to four windows, and noted manual sync as a partial mitigation for Problem 3 |

</details>

<details>
<summary>Prior revision note — Aligned to PROJECT_v0.6.md (historical)</summary>

This document was previously aligned to PROJECT_v0.3.md, then PROJECT_v0.5.md, and was revised to match PROJECT_v0.6.md. Six spec changes required updates at that time:

| PROJECT_v0.6 change | Where it affected this document |
|---|---|
| "Quest Board" renamed to "Task Board" (Section 7) | Every section — global terminology rename, no behavior change |
| Google Classroom sync reinstates a review step: fetched items are now queued and presented for Create Task / Ignore, rather than imported directly (Sections 13.2, 13.5) | **Section 2 (Task Board)** — added a new Classroom Review Popup subsection; removed the dismissible-banner and "auto-import only" language; **Section 6** — the "no ignore list" guidance is reversed |
| The Recently Imported "New" badge is removed (Section 9.4) | **Section 1, Section 2, Section 6** — all New-badge-specific layout, color-token, and collision guidance removed |
| A new computed Urgency Score is added, separate from manual Priority, used to drive default sort order (Section 9.5) | **Section 2** — recommends a silent, no-new-chip treatment; **Section 6** — extends the existing Priority/Deadline-State collision guidance to cover a third signal |
| Pomodoro now supports multi-session batches with phase notifications and a required (not optional) floating widget (Sections 14.3, 14.4) | **Section 4** — added a session-count selection step, a "Session X of Y" indicator, and upgraded the floating/mini-timer guidance from optional to required |
| Default reminder window changed from 3 days to 1 day; the Classroom-import notification toggle is removed (Section 11.1) | **Section 5** — updated toggle list and microcopy |

</details>

<details>
<summary>Prior revision note — Aligned to PROJECT_v0.5.md (historical)</summary>

This document was originally written against PROJECT_v0.3.md and was revised to match PROJECT_v0.5.md. Two spec changes required updates at that time:

| PROJECT_v0.5 change | Where it affected this document |
|---|---|
| Average Time-to-Start Lag redefined as a percentage of each task's time window (Section 10.3), with a recommended plain-language display example | Section 3 (Dashboard) — added as a 7th metric with dedicated layout treatment |
| Google Classroom sync redesigned from manual-trigger + per-item review to scheduled automatic fetch + auto-import, with no ignore-list (Section 13.2, 13.5) | Section 2 (Quest Board), Section 5 (Settings), Section 6 (App-Wide Review) — removed the Classroom Review panel, the manual Sync button, and the Ignored-list UI; added the "New" badge (Section 9.4), an auto-import notification banner, and the mandatory cutoff-date setting |

</details>

---

## How to use this document

Each page section follows the same lens: purpose → hierarchy → layout → components → cognitive load → clicks → emphasis → desktop best practice → inspiration. Wireframes are plain-text sketches (block layout only) meant to guide Figma frames, not final visuals.

Two constraints from the source document shape almost every recommendation below, so they're worth stating once up front:

1. **Section 6 / Section 20** — this is a one-person, one-year thesis build with a deliberately small stack (no frontend framework). Every UI suggestion needs to be buildable in vanilla HTML/CSS/JS without exotic tooling. I've flagged anything that's "nice but optional" separately from "recommended."
2. **Section 16.2** — the Interactive Room and every page are purely presentational; they read from the same services. That means whatever indicator/badge logic appears in the Room must show *exactly* the same state as the Dashboard and Task Board — this is a recurring theme below (see the "Application-Wide Review").

---

## 0. First Launch (New in v0.9)

### Purpose & primary actions
This is the very first screen a new user sees — before the Room, before anything else. Its only job is to let the user choose, once, whether to connect Google Classroom now or defer that decision. Per Section 13.1, this choice is **offered, never required** — the prompt must never function as a login gate, and declining it must feel like a complete, valid path into the app, not a "skip for now, we'll ask again" nag state.

### Should this look like a login screen? No.
A login screen implies the app is inaccessible without it. This is closer to a single, dismissible suggestion — the visual weight should say "here's an option," not "you must decide before proceeding." Avoid full-bleed treatments, progress indicators, or anything that visually resembles an onboarding wizard with multiple steps; this is one screen, one choice, done.

### Recommended layout
```
┌─────────────────────────────────────────────────────┐
│                                                       │
│              Connect Google Classroom?                │
│                                                       │
│        ✓  Import assignments automatically            │
│        ✓  Back up your data and use it on other       │
│           devices                                     │
│                                                       │
│        If you skip this, the app still works fully —  │
│        your data just stays on this device. You can   │
│        connect anytime later from Settings.           │
│                                                       │
│     [ Connect Google Classroom ]  [ Use without it ]  │
│                                                       │
└─────────────────────────────────────────────────────┘
```

**Design decisions worth calling out:**
- **Both buttons carry real visual weight.** "Connect Google Classroom" can be the filled/primary-styled button, but "Use without it" must not be shrunk to a bare text link or de-emphasized to the point of being easy to miss. Per Section 13.1's rationale, declining is a fully supported, equally legitimate path — not a lesser option the design should quietly discourage. This is the same principle already applied to the Classroom Review Popup's `[Later]` control (Section 2, below): a dismiss action that is a genuine choice gets real button treatment, not a link buried in a corner.
- **The explanatory line about what happens if the user skips is not optional copy.** Section 19's newly-documented known limitation (no cloud backup without a connection) is exactly the information a user needs *before* deciding, not after. Stating it plainly here — in one calm sentence, no alarming color or icon — lets the user make an informed choice instead of discovering the trade-off later.
- **No forced interaction beyond the two buttons.** No "Skip" countdown, no secondary confirmation dialog on dismiss ("Are you sure?") — a second confirmation step would contradict the "declining is a normal, complete path" principle this screen exists to support.
- **Connecting leads directly into the existing OAuth + cutoff-date flow** already specified in Section 13.1 and covered under Settings (Section 5, below) — this screen does not duplicate or shortcut that flow, it is simply a second entry point into the same one.

### Components to include / avoid
**Include:**
- Two clearly legible buttons, both keyboard-accessible (Tab + Enter), with the primary action visually first (left, in line with the rest of this app's left-to-right action ordering) but not overwhelmingly larger than the secondary.
- One short, calm sentence stating the consequence of declining — no warning icon, no red/orange coloring (this is a normal supported state, not an error, consistent with the guidance already given for the Settings banner below).

**Avoid:**
- A multi-step onboarding wizard, progress dots, or "1 of 3" framing — this is one screen, one decision.
- Auto-dismissing the prompt after a timeout, or defaulting focus to "Connect" in a way that makes pressing Enter accidentally start OAuth — keep both buttons neutral until the user actively chooses.
- Any visual pattern that reads as a login wall (centered logo above a single greyed-out "Continue" button, dimmed background behind a modal, etc.) — this is a suggestion, not a gate.

### Reducing cognitive load & clicks
One click, either direction, ends this screen permanently for the current install (Section 18: `settings.has_seen_first_run_prompt`). There is nothing to scroll, nothing to configure here — configuration (the cutoff date) only appears if the user chooses to connect, exactly as it already does when connecting via Settings.

### What should receive visual emphasis
The two-sentence value proposition (why connecting is useful) and the one-sentence consequence of skipping — these are the only two things a user needs to make this decision. Nothing else on this screen should compete for attention.

### Desktop UX best practices
- Keyboard-navigable from the moment the screen appears: Tab cycles between the two buttons with a visible focus ring, Enter activates whichever is focused.
- Respect window resizing the same way the Room does (Section 1) — this screen should scale/reflow rather than clip at smaller window sizes, even though it's only ever seen once.

### Modern UI inspiration
- **VS Code's "Sign in to sync settings" prompt**, or **Obsidian's optional cloud-sync upsell**: both present a genuinely optional cloud/account connection without blocking core functionality — a much closer reference than any consumer app's mandatory login screen.

---

## 1. Interactive Room (Home / Navigation Layer)

### Purpose & primary actions
The Room's only job is wayfinding (Section 7). The primary action is a single click on one of three objects: Task Board, Monitor, Calendar. There is no data entry, no reading of detail, no decision-making here — so unlike every other page in this app, "reducing cognitive load" for the Room means *reducing time spent looking at it*, not helping the user process information. Pomodoro is reachable only through Task Board now — open a task, then press "Start Working" (Section 4). It no longer has its own Room object; there's nothing to route to since Pomodoro can't run without a task attached (Section 14).

### Visual & information hierarchy
Right now the objects (Task Board, Monitor, Calendar) are described as flat peers in a room scene. Without deliberate hierarchy, a themed room reads as decorative first, functional second — the opposite of what a "here's where you left off" home screen should do. Establish hierarchy through:

- **State-driven emphasis, not fixed emphasis.** The object that needs attention right now (e.g., Task Board when overdue tasks exist) should visually lead — brighter lighting, subtle glow, or a foreground position — while the others recede slightly (lower contrast, smaller scale, background placement).
- **Fixed spatial memory otherwise.** Aside from the state-driven emphasis above, object *positions* should never move between sessions.

### Recommended layout
```
┌───────────────────────────────────────────────────┐
│  [Room background — quiet, low-saturation]         │
│                                                     │
│     ▢ Calendar          ▣ Monitor                  │
│                                                     │
│              ▣ Task Board *                        │
│                (glow if urgent)                     │
│                                                     │
│  [subtle ambient detail — plant, window, etc.]      │
└───────────────────────────────────────────────────┘
```
With the Clock removed, Task Board sits alone at the bottom, slightly larger/more central than the other two. Keep object hitboxes larger than their visible art.

### Components to include / avoid
**Include:**
- Hover state per object: slight scale-up (1.03–1.05×) + label tooltip + cursor change to pointer.
- A single, consistent badge style for "needs attention" — reused verbatim on Task Board's Room icon, the Dashboard's Overdue KPI, and the task's Deadline State chip.
- A quiet "time of day" ambient touch, only if trivial to implement.

**Avoid:**
- Animated idle loops that never stop.
- More than one badge style/color on the Room's Task Board icon.
- Text-heavy tooltips or in-room dashboards.

### Reducing cognitive load & clicks
- One click, always. No sub-menus branching off Room objects.
- Don't require the user to "solve" the room visually every time.
- The Classroom Review Popup (Section 2, below) is triggered on app open, not from a Room click — it can appear over the Room before the user has clicked anything, if pending Classroom items exist. **(v0.9 note)** This is separate from the First-Run Prompt (Section 0, above) — the two are mutually exclusive on any given launch: a brand-new install shows the First-Run Prompt (once, ever), while the Classroom Review Popup only ever appears for an account that is already connected. They should never stack or appear back-to-back on the same launch.

### What should receive visual emphasis
The single most urgent object (if any). If nothing is urgent, all three objects should sit at equal, calm visual weight.

### Desktop UX best practices
- Respect standard desktop affordances: pointer cursor on hover, click feedback, and a smooth but fast transition into the destination page (150–250ms).
- Support keyboard access as a baseline (Tab cycles through objects with visible focus rings, Enter activates).
- Make the window resizable-safe.

### Modern UI inspiration
- **Windows 11 Start menu / widgets board**, **Arc (browser)**.

---

## 2. Task Board (Primary Workspace)

*(Renamed from "Quest Board" in v0.6 — see PROJECT_v0.6.md Section 7 for rationale.)*

### Purpose & primary actions
This is the task-management feature (Sections 8–9, 13). Primary actions, roughly in order of frequency: scan tasks → open a task's detail → update status/progress → create a manual task → start a focus session on a task. Google Classroom no longer surfaces assignments directly onto this page. Newly-fetched assignments are queued and presented through a separate **Classroom Review Popup** (below); a task only ever appears on Task Board after the user has explicitly chosen "Create Task" for it.

### Visual & information hierarchy — what's grouped, what's visible, what's hidden
Group task metadata into three tiers, not one flat card:

| Tier | Fields | Where it lives |
|---|---|---|
| **Always visible (card)** | Title, Deadline State chip (Overdue/Due Today/Upcoming/No Deadline/Completed), progress bar, source icon (manual / Classroom / LINE — **(New in v0.12 pass)** three neutral icons, no color), course name if the task has one — **(Changed in v0.13)** from any source, not only Classroom; **(New in v0.13)** a small neutral Priority flag, shown only when priority is High (see below) | Task card in the list |
| **Visible on hover / secondary glance** | Quick actions (mark complete, start focus session, edit) | Card hover state, right-aligned icon row |
| **Hidden until opened** | Notes, exact due date/time, a quiet source line ("Imported from Classroom · [date]" or "Added via LINE · [date]"), **Priority control (Low / Medium / High / not set) and Course field (New in v0.13)**, full progress history, linked Pomodoro session history, Classroom import date, status dropdown | Task Detail panel |

**One data-model nuance worth flagging for Figma:** `status` and `deadline_state` are two separate systems that happen to overlap in wording ("Completed" exists in both). Don't render two chips that both can say "Completed" — let the Deadline State chip be the single colored label on the card, and represent `status` more quietly as the progress bar's fill state or a small icon.

**Two more signals feed the ordering, and neither should compete with the Deadline State chip.**

- **Urgency Score (Section 9.5): no chip at all.** It is a candidate for a card-level chip — resist the temptation. Use it purely to determine sort order *within* each Deadline State bucket.
- **Priority (Section 9.3), reinstated in v0.13: a quiet flag, never a chip.** Priority is the one input the user sets by hand, so the user will reasonably want to see that it registered. Show it, but at the lowest weight that still does the job: a small flag icon after the title, **only when priority is High**, drawn in the same neutral tone as other secondary icons. Medium and Low appear only in the Detail panel and the form. Reasons: High is the deliberate "this one matters" mark the feature exists for; showing all three levels on every card would add a third visible label system to a card that already has one dominant chip; and an unset priority (the default) should leave the card looking exactly as it did before v0.13. If user testing shows people want Medium visible too, an outlined version of the same flag is the lightest option — treat that as optional, not part of this recommendation.

### Recommended layout
```
┌─────────────────────────────────────────────────────────────┐
│  Task Board                                    [+ New Task] │
│  [Search bar.....................]  [Filters ▾]              │
├─────────────────────────────────────────────────────────────┤
│  ▾ Overdue (2)                                                │
│    ┌───────────────────────────────────────────────┐         │
│    │ ● Overdue   Essay Draft — CS101  ⚑   ▓▓▓░░ 60% │  ⋯      │
│    └───────────────────────────────────────────────┘         │
│  ▾ Due Today (1)                                               │
│  ▾ Upcoming (5)          ← ordered by Urgency Score, unlabeled │
│  ▸ No Deadline (2)            (collapsed by default)          │
│  ▸ Completed (14)             (collapsed by default)          │
└─────────────────────────────────────────────────────────────┘
        [Task Detail opens as a right-side panel, not a modal,
         so list context is never lost]
```
Group by Deadline State bucket, in urgency order, with Overdue/Due Today expanded by default and No Deadline/Completed collapsed by default. Within each bucket, order by Urgency Score descending, silently.

**(New in v0.13) What Priority does to this layout:** because Priority feeds the Urgency Score, a long project marked High rises *within its bucket* — typically toward the top of Upcoming, where before it could sit near the bottom. It never jumps to a more urgent bucket: a task in Overdue or Due Today stays above it by design. Don't add any label or animation that explains the reordering; the flag on the card is the only visible trace, and the user already knows why they set it.

**Note on the top bar (Changed in v0.10):** the top bar now includes a small, secondary-styled "Sync Now" button plus a quiet "Last synced [time]" label — this is now the single manual-sync entry point (moved from Settings; see Section 5 below, which no longer has its own trigger). Style it as secondary, not primary — the primary action on this page is still "+ New Task." Give it the same tap-feedback and toast-on-empty-result behavior described in PROJECT.md Section 13.5.

**Pending-review reminder:** if the user dismissed the Classroom Review Popup earlier in the session without deciding on every item, show a small, persistent, non-alarming indicator in the top bar — e.g., "3 Classroom items to review" as a quiet text link, not a colored badge.

### Task Create / Edit Form (New in v0.13)

This is where Priority and Course are entered (Sections 9.3, 19). Use the same fields in the same order for "+ New Task" and for editing in the Task Detail panel, so a user learns the form once.

**Create** is a short, blocking decision, so it follows the app's modal rule (Section 6): a modal. **Edit** happens in the Detail panel, in place, because the list context stays relevant.

```
┌───────────────────────────────────────────────┐
│  New Task                                [✕]  │
├───────────────────────────────────────────────┤
│  Title *        [..............................]│
│  Course         [............................▾]│
│  Due            [ 14 Mar 2026 ]  [ 17:00 ]     │
│  Priority       ( Low | Medium | High )        │
│                 Optional. Higher priority moves │
│                 a task up within its group.     │
│  Progress       [ 0 % ]                         │
│  Notes          [..............................]│
│                                                 │
│                      [ Cancel ]  [ Create Task ]│
└───────────────────────────────────────────────┘
```

**Design decisions worth calling out:**
- **Only Title is required.** Everything else is optional, in keeping with the low-friction principle (Section 6). A task with no due date and no priority is a normal task.
- **Priority is a three-way segmented control with nothing selected by default.** Section 9.3 says there is no default, so don't pre-select Low or Medium. Pressing the selected segment again clears it back to "not set." Keep it keyboard-operable (arrow keys move between segments).
- **One line of helper text under Priority, and no more.** It tells the user what the control does without exposing the formula. Don't show weights, points, or the Urgency Score next to it.
- **Course is optional free text with suggestions from the course names already in use** (a combo box). Classroom-imported tasks arrive with Course filled in. The suggestions are only a typing aid that makes it easier to reuse the same spelling; this document does not propose any matching or merging logic, consistent with the accepted limitation in Sections 14.5 and 20.
- **Due is a date and a time.** The LINE flow already collects both (Section 14.3), so the app form should offer the same. The exact storage format is an implementation detail (Section 26).
- **Don't add an "estimated time" field.** That idea was considered and rejected before it entered the specification (Section 9.5).

**In the Detail panel:** show Priority as the same segmented control, applied immediately on change (like the inline status toggle), with no confirmation and no toast. If the change moves the card within its bucket, a short reorder transition or none at all is fine.

### LINE-created tasks (New in the v0.12 pass)

A task created through the LINE chat flow (Section 14.3) is a direct, explicit result of the user finishing that flow, so it does **not** go through the Classroom Review Popup (Sections 13.5, 14.3). It simply appears on Task Board like any other task.

- **No review step, no special badge.** It is distinguished only by its LINE source icon and the quiet source line in the Detail panel.
- **It arrives through the normal sync pull (Section 18.2), not instantly.** Don't animate it as "just added" or phrase it as live (Section 6, item 3).
- **It starts as Not Started with no Priority set** (Sections 9.1, 14.3). The user can set Priority later in the Detail panel.
- **Its course may be free text that matches no existing course** (Section 14.5). Task Board will show it as its own course value; this document does not propose merging or correcting it (accepted limitation).

### Classroom Review Popup

This is the presentation-layer treatment of PROJECT.md Section 13.5's review step. It is a **separate overlay, not part of the Task Board page** — it can appear over the Room or over Task Board.

**Trigger:** shown once per app session when one or more `classroom_sync_state` records are `pending` — **(Changed in v0.11)** right after the automatic launch-time fetch completes, or immediately after the user taps "Sync Now" on Task Board if that manual fetch found anything new. If zero items are pending, a brief toast confirms this instead (PROJECT.md Section 13.5) — nothing appears silently.

**Session-safe exception (New in v0.11):** if a Pomodoro focus session is currently running when new items are found, don't show this popup at all — show the quiet "N Classroom items to review" text-link indicator (above) instead, and open the popup the next time the user visits Task Board with no session active. Interrupting an active focus session with a decision-forcing modal (even a dismissible one) works against the low-friction goal Pomodoro is designed around (Section 4, below).

**Recommended layout:**
```
┌─────────────────────────────────────────────────────┐
│  New assignments found                        [✕]   │
│  Checked today, 12:00 PM                              │
├─────────────────────────────────────────────────────┤
│  CS101 · Operating Systems                            │
│  ┌───────────────────────────────────────────────┐   │
│  │ Essay Draft                                     │   │
│  │ Due Mar 14                    [Ignore] [+ Create]│  │
│  └───────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────┐   │
│  │ Lab Report                                      │   │
│  │ Due Mar 18                    [Ignore] [+ Create]│  │
│  └───────────────────────────────────────────────┘   │
│                                                        │
│                                    [Later]             │
└─────────────────────────────────────────────────────┘
```

**Design decisions worth calling out:**
- **Per-item, instant actions — no bulk "select then import" step.** Each click on Create Task or Ignore resolves that item immediately.
- **`[Later]`, not a forced decision.** Closing via `[✕]` or `[Later]` should behave identically; neither should be phrased as "skip all."
- **Group by course, not by fetch window.**
- **Style as a modal, not a page.**
- **(New in v0.13) No Priority control in this popup.** Classroom import does not set Priority (Section 9.3); adding a third decision to a one-click-per-item step would undo the point of keeping it lightweight. The user can set it later from the card's detail panel.

### Components to include / avoid
**Include:**
- Persistent filter bar: Deadline State, Status, Source (Manual / Classroom / LINE), Course. **(Changed in v0.13)** Course now applies to tasks from any source, so it is no longer a Classroom-only filter.
- Inline search with live filtering.
- The pending-review text link described above, shown only when applicable.
- Quick-action icons on card hover: complete checkbox, "Start Focus Session", open detail.
- Task Detail as a **slide-in side panel**, containing the Priority control and Course field described above.
- **(New in v0.13)** The create / edit form described above, with the same fields in the modal and the panel.
- **(New in v0.13)** The neutral Priority flag on High-priority cards.

**Avoid:**
- Permanently visible progress-percentage number fields on the card.
- A second "Sync" button or sync log **on this page**.
- A separate "Ignored" list or management page.
- **(New in v0.13)** Color-coding Priority, or rendering it as a chip. Red, orange and the other semantic colors belong to Deadline State (Section 6).
- **(New in v0.13)** A Priority filter. The specification does not define one, and Priority already acts through the ordering.
- **(New in v0.13)** Showing the Urgency Score, its weights, or any explanation of the reordering anywhere near the Priority control.

### Reducing cognitive load & clicks
- Bucket collapsing means the default page load already answers "what needs my attention" without filtering.
- Inline status/complete toggle directly on the card.
- "Start Focus Session" from the card hover state.
- Search + filters combine (AND logic).
- The review popup keeps Classroom-specific decisions to one click per item.
- **(New in v0.13)** Priority adds no clicks to the default path: it is optional, unset by default, and set in the same form as every other field.

### What should receive visual emphasis
The Deadline State chip is the single strongest visual element on each card. The "New Task" action deserves secondary emphasis. **(v0.13)** The Priority flag is deliberately weaker than both: it should be noticed only by someone looking for it.

### Desktop UX best practices
- Keyboard shortcuts: `Ctrl+N`, `Ctrl+F`, arrow keys + Enter, `Esc` to close panels/popups.
- Right-click context menu on a card.
- Resizable/scrollable list area independent of the filter bar.

### Modern UI inspiration
- **Linear**, **Todoist / TickTick**, **Notion**. **(v0.13)** For a compact priority marker, Linear's small priority icon beside the issue title is a useful reference for how little space the marker needs.

---

## 3. Dashboard

### Purpose & primary actions
Per Section 10, this page exists to build self-awareness of *workload and behavior*, not to be a report generator. Primary action is mostly passive: glance, understand, occasionally change the time-range filter.

### Visual & information hierarchy — placing the six metrics
The six metrics (Section 10.2) are not all the same *kind* of information:

| Group | Metrics | Behavior |
|---|---|---|
| **Needs attention now** (pinned, filter-independent) | Overdue Assignments | Always real-time; does not change with the time-range filter |
| **Filtered overview** | Total Assignments, Completed Assignments, Remaining Assignments, % Completed Before Deadline | Recalculates on filter change |
| **Filtered, behavioral** | Average Time-to-Start Lag | Recalculates on filter change; expressed as a percentage with a supporting plain-language example |

### Recommended layout
```
┌───────────────────────────────────────────────────────────┐
│  Dashboard                                                   │
│                                                               │
│  ⚠ Needs Attention (always current)                          │
│  ┌─────────────────┐                                          │
│  │ Overdue: 2       │                                         │
│  └─────────────────┘                                          │
│  ───────────────────────────────────────────────────────    │
│  This period:  ( This Week | This Month | All Time )         │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────────────┐      │
│  │ Total  │ │Complete│ │Remain. │ │ % on-time complete │      │
│  │   12   │ │   7    │ │   5    │ │        83%          │      │
│  └────────┘ └────────┘ └────────┘ └──────────────────┘      │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ How early do you start?                    45%         │  │
│  │ On average, you start work after 45% of the available  │  │
│  │ time has passed — for a 10-day task, that's around      │  │
│  │ day 4–5.                                                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  [ Chart: completed vs. remaining over selected period ]     │
│  [ Chart: on-time completion trend, or status breakdown ]    │
└───────────────────────────────────────────────────────────┘
```

### Components to include / avoid
**Include:**
- A small "always current" microcopy label near the Needs Attention strip.
- The Time-to-Start Lag card must always pair the percentage with the plain-language example.
- Two supporting charts, at most.
- Empty/low-data states for new users.

**Avoid:**
- A dense multi-chart dashboard.
- Mixing the always-current metrics into the same filter-reactive KPI row.
- A calendar-style heatmap.
- Displaying Time-to-Start Lag as a raw percentage with no context.
- Adding an Urgency Score tile or chart here. **(v0.13)** The same goes for any Priority breakdown: Priority is not one of the six metrics (Section 10.2) and does not affect them.

### Reducing cognitive load & clicks
- The time-range filter should be a simple 3-way segmented control.
- Keep the whole page as close to the fold as reasonably possible.

### What should receive visual emphasis
The Needs Attention strip earns the strongest color. The Time-to-Start Lag card may be visually *wider* but should not use a louder color.

### Desktop UX best practices
- Charts should render crisply and support hover tooltips.
- Respect window resizing: 4 KPI cards reflow from 4-across to 2×2.

### Modern UI inspiration
- **Linear's** project/cycle insights view, **Todoist Karma / TickTick stats**.

---

## 4. Pomodoro / Focus Session

### Purpose & primary actions
Lowest-friction page in the app by design intent (Section 14). Primary action: start a session, in as few clicks as possible. This page is no longer reachable on its own — it only opens from a task's detail view, via a "Start Working" action.

### Should the timer dominate the screen? Yes.

### Recommended layout

**Step 1 — session count:**
```
┌───────────────────────────────────────┐
│  Essay Draft — CS101                    │
│  How many sessions?                     │
│                                          │
│      [ − ]      4      [ + ]            │
│      = 2h 0m total (25 min focus         │
│        + 5 min break each)               │
│                                          │
│   [ 2 ]      [ 4 ]      [ 6 ]            │
│                                          │
│         [ Start Working ]                │
└─────────────────────────────────────────┘
```

**Step 2 — running timer:**
```
┌───────────────────────────────────────────────────────┐
│              [ Linked task: "Essay Draft" ✎ ]            │
│                     Session 2 of 4                         │
│                    ┌───────────────┐                     │
│                    │    24:58      │   ← large, centered │
│                    │   ◐ progress  │                     │
│                    └───────────────┘                     │
│                                                           │
│                  [ ▶ Start ]  [ ⚙ ]                       │
│                                                           │
│  ───────────────────────────────────────────────────    │
│  Session history (collapsed by default) ▸                │
└───────────────────────────────────────────────────────┘
```

### Where the current task appears
Directly above the batch-count step and the timer, as a single quiet line. Always pre-filled, since Pomodoro can only be opened from a task now.

**Quiet status feedback, not a confirmation dialog:** if this is the task's first-ever Pomodoro batch, status silently flips from Not Started to In Progress the moment the batch actually starts — don't interrupt with a "status changed" toast or modal.

### Where session history appears
Below the timer, **collapsed by default**.

### Floating Widget (required, not optional)

**Confirmed decision (PROJECT.md Section 14.4):** a small, always-on-top window, separate from the main application window, is required for MVP.

**Recommended treatment:**
```
┌───────────────────────────┐
│ Essay Draft | Session 2/4  │
│                             │
│ Focus time                 │
│      24:58                 │
│  ▬▬▬░░░░░░░                │
└─────────────────────────────┘
   (small, corner-anchored,
    always-on-top, draggable)
```

### Components to include / avoid
**Include:**
- The two-step start flow above.
- One dominant Start/Pause/Reset control set.
- A subtle, optional duration/settings control.
- A clear but small task-context line.
- The floating widget described above.

**Avoid:**
- A second competing panel next to the timer.
- Auto-expanded history on page load.
- Treating the floating widget as a second full control surface.

### Reducing cognitive load & clicks
- One click from a task's detail view ("Start Working") to the session-count screen.
- Sensible remembered defaults.

### What should receive visual emphasis
The timer number and the Start button on the running screen.

### Desktop UX best practices
- The floating widget is the primary desktop-native element of this page.
- OS-level notifications at each phase transition.
- Keyboard shortcut for Start/Pause.

### Modern UI inspiration
- **TickTick's Pomo timer**, **Arc's** minimal presentation, **Spotify's mini-player** / **Windows' flyouts** for the floating widget.

---

## 5. Settings

### Purpose & primary actions
Configuration only — connecting/disconnecting Classroom, adjusting notification rules, checking sync status. Low-frequency page; clarity matters more than density.

### Categorization
Three clear categories:

1. **Account & Connections** — **(Changed in the v0.12 pass)** two independent cards, **Google Classroom** (Section 13.1: connect/disconnect, OAuth status, mandatory import cutoff date) and **LINE** (Section 14.2: connect/disconnect). Still one category, so Settings stays at three.
2. **Notifications** (Section 11.1) — three default rules shown as toggles, with the upcoming-deadline reminder days (7 / 3 / 2 / 1, default 1) as a row of four checkboxes under the third toggle.
3. **Sync & Backup** (Section 17) — cloud sync status display.

### How Google Classroom connection should be presented
A single, clear status card: connected account (email), "Connected" state with a green indicator, and a "Disconnect" action. If disconnected, show a single "Connect Google Classroom" button that starts OAuth. Explicitly note that disconnecting keeps already-imported tasks.

**(New in v0.9) "Not connected" banner:** if the user has not connected a Google Classroom account — whether from declining the First-Run Prompt (Section 0, above) or simply never having connected — show a quiet, dismissible banner near the top of this category, above the "Connect Google Classroom" button: **"Not connected — your data is stored on this device only. Connect to back up your data and use it across devices."** This must not use warning colors (no red/orange/alert icon) — declining or deferring is a normal, fully supported state per Section 13.1, not an error condition. The banner is dismissible per session but should reappear on next launch until the user connects, since the underlying condition (no backup) is still true — this mirrors how the Task Board's pending-review indicator (Section 2, above) persists until its underlying condition is resolved, not until it's merely acknowledged once.

### How LINE connection should be presented (New in the v0.12 pass)

A second status card under the Classroom card, built the same way so the user learns one pattern (Section 6).

- **Not connected:** a single "Connect LINE" button and one quiet line saying what it does (add tasks and get deadline reminders on LINE). **No banner, no First-Run Prompt, no warning color**: LINE is optional and independent of Classroom (Sections 13.1, 14.2), and being unconnected is a normal state.
- **After pressing Connect LINE:** show the short numeric code large and plain, with "Send this code to the StudyFlow LINE account within 10 minutes" and a visible expiry. When it expires, show "Get a new code" instead of leaving a dead code on screen (Section 14.2).
- **Connected:** "Connected" with the same green indicator as the Classroom card, and a "Disconnect LINE" action, with a note that tasks already created through LINE are kept (Sections 14.2, 14.5).
- **How the app learns the link succeeded is an implementation detail** (the confirmation happens on LINE's side). Whatever it does, don't show "Connected" until it is actually known, and don't promise the change is instant (Section 6, item 3).

**Mandatory cutoff date on first connect:** immediately after a successful OAuth consent, present a single, simple step: "Import assignments created on or after..." with a date picker. This step cannot be skipped. With the review popup back in the flow, frame the microcopy as "so your first review doesn't include years of old assignments."

**(Changed in v0.10) No "Sync now" button here:** the manual sync trigger now lives on Task Board (Section 2, above), not here — showing it in both places would mean keeping two buttons' loading/disabled state in sync for no benefit. This card still shows the last sync time as **read-only status text**, so a user checking connection health doesn't need to leave Settings to see it — they just can't trigger a fetch from this screen.

**(Changed in v0.11) Status microcopy must reflect the launch-plus-manual model:** since fetches now happen at app launch (not on a fixed clock schedule), don't promise a specific "next automatic check" time — show only the last check time. Since the trigger itself lives on Task Board, phrase this as pure status ("Last synced 2 hours ago"), not as an implied action.

### How notification settings should be organized
Three toggles, each labeled in plain language:
- "Notify me when something is due today"
- "Notify me when something becomes overdue"
- "Remind me about upcoming deadlines" — with a row of four checkboxes inline: **7 days**, **3 days**, **2 days**, **1 day** (before the due date). Only "1 day" is ticked by default. The user can tick several (for example 3 and 1: an early heads-up and a last nudge). While the toggle is on, the last ticked box cannot be unticked (show it disabled); turning the toggle off dims the row and keeps the choice. One quiet helper line under the row: "You get one reminder for each box you tick." No free number field, so there is nothing to validate (Section 11.4).

**(New in the v0.12 pass) No LINE-specific notification controls.** The same three rules also drive LINE pushes (Sections 11.1, 14.4). When LINE is connected, add one quiet helper line under the toggles ("Also sent to LINE"). Don't add a second set of toggles. A user with the app open and LINE connected may receive both a desktop notification and a LINE push for the same change; that is accepted (Section 14.4), so don't try to hide it in the UI.

### How cloud sync status should be displayed
A quiet status line, not a control panel. Show: last successful sync time, and a simple state (Synced / Syncing… / Retrying).

### Components to include / avoid
**Include:** status cards with clear state colors, simple toggles, one row of four day checkboxes, one simple date picker, and **(New in v0.9)** the "not connected" banner described above (shown only when applicable). **(Changed in v0.10)** No "Sync now" button — that control now lives on Task Board only.
**Avoid:** a generic settings "wall of switches," nested sub-menus, exposing database/sync internals, **(New in the v0.12 pass)** a LINE first-run prompt or "not connected" banner, and any LINE-only notification options. Also avoid any control inside Settings that duplicates the Classroom Review Popup or the First-Run Prompt — the banner should link into the *same* existing "Connect Google Classroom" button/flow, not open a third, separate connect surface.

### Reducing cognitive load & clicks
This page has roughly nine total controls across its three categories (two more than before, for Connect / Disconnect LINE).

### What should receive visual emphasis
The Classroom connection status card. **(v0.9 note)** When the "not connected" banner is showing, it should sit visually *above* the connect button as context, not compete with it — the button remains the primary action; the banner explains why it matters.

### Desktop UX best practices
Standard desktop settings conventions apply well here: left category rail + right detail pane, immediate-apply toggles.

### Modern UI inspiration
- **Windows 11 Settings app**, **Notion's** settings modal.

---

## 6. Application-Wide Usability Review

*(Aesthetics set aside — this section is about function, consistency, and complexity.)*

### UX problems
1. **Two overlapping state systems.** `status` and `deadline_state` both exist per task and both can independently say "Completed." **Fix:** one is always the headline (Deadline State), the other is always secondary (Status).
2. **Deadline State, Priority and Urgency Score can collide visually. (Changed in v0.13: three signals again, as in v0.6–v0.7.)** All three describe "how much does this task need me," and a user can read any two as the same thing. **Fix:** reserve red/orange/semantic status colors exclusively for Deadline State; draw the Priority flag in a neutral tone (it is an icon, not a chip, and appears only for High); give Urgency Score **no chip at all**.
3. **Real-time expectations vs. actual refresh behavior.** Notifications and Classroom fetching only re-check on app startup and on a periodic interval. **Fix:** never phrase or animate a notification, badge, or sync-status line as "just happened" unless it demonstrably just happened.
4. **Static Classroom snapshots read as "live" if unlabeled.** **Fix:** a quiet "Imported from Classroom · [date]" line in Task Detail.

### Inconsistencies to guard against
- **The auto status transition** (Not Started → In Progress on first Pomodoro start) touches state shown in three places — the task's card on Task Board, Task Detail, and Task Board's default sort order. None of these should show stale status after a session starts.
- **Color tokens for Overdue/urgent** must be the single same value across the Room badge, the Task Board Deadline State chip, and the Dashboard's Needs Attention strip.
- **Empty/zero states** should share one visual pattern (icon + one short sentence) across every page.
- **(New in v0.9) First-Run Prompt and Settings banner microcopy must match.** The First-Run Prompt (Section 0) and the Settings "not connected" banner (Section 5) both describe the same underlying state — no Google connection, data stored locally only. They must use the same or near-identical wording for this ("your data is stored on this device only" / "Connect to back up your data and use it across devices") rather than two independently-written descriptions of the same fact. A user who reads the First-Run Prompt, declines, and later opens Settings should recognize the banner as the same message revisited, not a differently-worded surprise.
- **(New in the v0.12 pass) The Classroom and LINE cards behave identically.** Same layout, same "Connected" indicator, same Disconnect pattern, same note that already-created tasks are kept. The one difference is deliberate: Classroom has a not-connected banner (Section 5, v0.9) and LINE does not, because only Classroom has a First-Run Prompt.
- **(New in the v0.12 pass) One source-icon set for all three sources** (manual, Classroom, LINE), in the same neutral tone, used identically on the card, in the Source filter, and in the Detail panel.
- **(New in v0.13) Priority and Course must be edited the same way everywhere.** The create modal and the Detail panel (Section 2) use the same controls, in the same order, with the same helper text. A user should never have to learn two ways to set Priority.
- **(New in v0.13) "Not set" and "Low" look different but rank the same.** Section 9.5 gives both a Priority Factor of 0. Show "not set" as an empty control and "Low" as a selected one, but never imply in the UI that choosing Low pushes a task down, and never imply that leaving Priority empty is an omission the user should fix.

### Unnecessary complexity to avoid
- Don't build a persistent global sidebar navigation that duplicates the Room's job.
- Don't surface sync internals anywhere in the UI.
- A per-item review/ignore step for Classroom sync **does** exist (Section 13.5) — keep it lightweight, no bulk-select mode.
- **(New in v0.13)** Don't turn Priority into a feature surface of its own: no Priority filter, no Priority column of counts on the Dashboard, no explanation of the Urgency Score formula. It is one optional field with one effect.

### Pages at risk of too much information
- **Task Board**, at realistic scale. **(v0.13)** Priority and course on every card would add to that risk, which is why only High priority is shown on the card and Medium / Low are left to the Detail panel.
- **Dashboard**, if all six metrics and multiple charts are given equal size/weight.

### Pages at risk of missing hierarchy
- **The Room**, if all three objects are rendered with identical visual weight regardless of state.
- **Settings**, if all controls are laid out as one flat list.

### Making it feel like a production desktop application
- **One shared design system**: a 4/8px spacing scale, 4–5 type sizes, one icon set, and a short list of named color tokens reused everywhere.
- **Consistent modal-vs-panel logic**: side panels for anything that keeps list context relevant; modals only for short, blocking decisions. **(v0.9 note)** The First-Run Prompt (Section 0) follows the same modal-for-short-blocking-decision logic as the cutoff-date step and the Classroom Review Popup — one more entry in this category, not a new pattern. **(v0.13 note)** The Task Create modal and the Detail panel edit follow the same rule.
- **Native-feeling window chrome**: a real title bar, consistent minimize/maximize/close behavior.
- **Honest, calm system-state microcopy** everywhere sync/notifications touch the UI.
- **A optional, lightweight wayfinding cue** once inside a feature page.

---

## Summary: top priorities if you only fix a handful of things

1. Establish one shared color/token system for "urgent/overdue" and reuse it identically in the Room badge, Task Board chip, and Dashboard strip.
2. Separate Dashboard's one always-current metric (Overdue) from the five filtered ones; give Time-to-Start Lag its own wider card.
3. In Task Board, make Deadline State the one dominant chip per card; give Urgency Score **no chip at all**. **(Changed in v0.13)** Priority is a quiet neutral flag on High cards, never a chip.
4. Default-collapse "No Deadline" and "Completed" buckets in Task Board.
5. Build the Classroom Review Popup as a lightweight modal — per-item, instant Create/Ignore, dismissible without forcing a decision, no bulk-select step.
6. Treat the Pomodoro floating widget as required, not a stretch goal.
7. Keep Pomodoro's main running screen the only place with a large, dominant timer.
8. Give Settings exactly three categories, no more.
9. **(Changed in v0.10)** Put the "Sync now" button in exactly one place — Task Board's top bar — and nowhere else; Settings shows the same last-sync time as read-only status only.
10. The Room has three objects now, not four — Pomodoro is reached through Task Board only.
11. **(New in v0.9)** Build the First-Run Prompt as a genuinely optional, equally-weighted two-button choice — never a login gate — and keep its "not connected" messaging word-for-word consistent with the Settings banner that echoes it later.
12. **(New in v0.13)** Build Priority as an optional three-way control with nothing selected by default, shown in the same form in the create modal and the Detail panel, and show it on the card only as a quiet flag for High. Let it work through the Urgency Score's ordering within each bucket, and nowhere else.
13. **(New in the v0.12 pass)** Add LINE as a second, optional card inside Settings category 1 (never a fourth category, never a first-run prompt), with the same Connect / Disconnect pattern as Classroom. Show LINE tasks on Task Board with a neutral source icon and no review step, and let them arrive through the normal sync rather than as a live event.
