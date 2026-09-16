# Send2U Design System (`design.md`)

Authoritative visual and UX reference for the Send2U Expo React Native
application. It documents the design language **as established by the
current implementation** (`constants/theme.ts`, `components/ui/*`,
existing screens), states binding rules for future work, and lists known
inconsistencies to avoid repeating.

Conventions used throughout:

- **Established pattern** — what the code does today; follow it.
- **Inconsistency** — where the code deviates from its own pattern; do
  not copy it (each names the direction to follow instead).
- **Rule** — binding for new screens and mockups.
- **Future** — prescribed but not yet implemented; do not treat as
  existing behavior.

No section of this document authorizes backend, product-scope, or
navigation-architecture changes on its own. Status vocabulary in §12
mirrors `lib/orders.ts`, which remains the runtime source of truth.

---

## 1. Product and navigation overview

Send2U has one main requester application with three bottom-navigation
destinations — **Home**, **Requests**, **Profile** (`app/(requester)/`).
A verified Helper (`role = requester` + `is_verified_helper = true`) uses
the same app and additionally enters the **Helper Portal** from Profile.
Vendors use a separate three-tab application (Stall / Menu / Profile).
There is no admin UI.

**Rule.** The Helper Portal is a capability inside Send2U, never a
second app. Nothing may look or read like "Requester Mode", "Helper
Mode", "Switch to Helper", or a separate Helper application.

---

## 2. Visual identity

Send2U is a white, typography-led, calm production interface. Structure
comes from hierarchy and whitespace, not from surfaces: the `Card`
primitive is a flat spacing wrapper with no surface, border, radius, or
shadow, and the theme file states that shadows are intentionally unused
anywhere. Grey page backgrounds and coloured sections are not used to
create structure.

**Established pattern.** Production polish comes from: consistent 20pt
horizontal margins with 16pt vertical rhythm; one 22pt title per screen
at most; 15pt semibold row titles with 13pt secondary subtitles; hairline
`#E7DFDC` dividers between list content; a single filled red primary
action where a task exists; honest copy that names real backend states.
Screens feel complete because every state (loading, empty, error,
refresh) is designed, not because they are decorated.

**Rule.** New screens must read as finished commercial product on first
paint: aligned content, resolved hierarchy, designed states, no
lorem-ipsum spacing, no decorative concept-UI elements.

---

## 3. Prohibited UI Patterns

Prohibited unless an exceptionally strong product reason exists. The
only permitted tab-style navigation is the application's actual bottom
navigation.

- **Badges / pills.** Permitted only for order/payment status and the
  notification unread dot. Never for categories, counts-as-decoration,
  marketing labels, or static information that plain text can carry.
- **Gradients.** None in the interface. (`expo-linear-gradient` is
  installed but unimported; the last scrim was removed.)
- **Cards (visual).** The `Card` component is a spacing wrapper, not a
  visual container — do not give it surfaces, borders, or shadows, and
  do not stack bordered boxes to simulate dashboards.
- **Decorative tabs / segmented controls beyond their two jobs.**
  `ActiveHistoryToggle` (Active/History lists) and the notification
  filter are the only segmented controls. No decorative tab bars.
- **Excessive containers, borders, separators.** One divider system
  (`border`, hairline) between list content; no boxes around boxes, no
  separators after every element by default — only where they
  materially improve readability.
- **Excessive colour.** White dominates; red is rationed (§8). Status
  colour must communicate meaning, never decoration.
- **Decorative illustrations, emojis.** None exist. Empty states use a
  64pt tinted icon medallion, not artwork.
- **Oversized headers / hero sections.** Titles cap at 22pt semibold;
  headers establish context then yield the viewport (§4).
- **Excessive empty space / dense dumps.** Neither giant blank areas
  nor crammed screens; lists carry identification-level information,
  details live on detail pages (§9, §10).
- **Repeated buttons / duplicate navigation.** One primary action per
  task; one back control per screen (the header chevron).
- **Unnecessary confirmation dialogs.** Consequential actions use the
  slider language in §13; everything else confirms inline or not at all.
- **Task-competing elements.** Nothing beside the primary action may
  be equally loud.

Minimalist here means *restrained and complete*, never empty: whitespace,
hierarchy, typography, alignment, and density must make each screen feel
finished.

---

## 4. Headers

Three header treatments exist, one per screen class:

1. **Bottom-tab roots** use the native header or a custom in-screen
   header: Home and Requests hide the native header and render their
   own brand/title row; Profile and all vendor tabs use the native
   centered header.
2. **Secondary screens** use `GlassHeader`: an absolute
   48pt + safe-inset overlay (`expo-blur`, intensity 15, near-white
   veil) with a 44pt back chevron at left, a centered 17pt semibold
   title (single line), and an optional right action. Content uses
   `Screen beneathHeader` so it starts below the glass and slides
   behind it on scroll — the header stays light while scrolling and
   never grows.
3. **Dialog-level chrome** (overflow menu, delete confirm) is inline,
   never a second header.

Back behavior is uniform: `canGoBack() ? back() : replace(fallbackHref)`,
one chevron per screen, never duplicated. Header actions sit at right:
notification bell (48pt control, dot iff unread) and the Profile gear.
Touch targets are 44–48pt with 8pt slop.

**Established pattern.** Compact chrome, centered titles, content-first
viewport, fading glass over scrolled content.

**Inconsistency.** The bell is not yet present on all three primary
pages in every role: requester Home and Requests have it, Profile
carries the gear instead, vendor tabs and Helper Portal screens have no
header actions at all.

**Rule.** The notification icon must remain available and visible in the
header of the three primary pages across all roles. Do not add further
header controls. When adding a bell to a surface that lacks one, reuse
`HeaderBell`/`NotificationBell` unchanged.

---

## 5. Bottom navigation

Three destinations per application (requester: Home / Requests /
Profile; vendor: Stall / Menu / Profile). Pure white background, 1px top
hairline, 70pt height plus bottom safe inset, 12pt semibold labels;
selected tab is Send2U red with a matching icon, unselected is muted
grey. The bar floats (`position: absolute`) so scrolled content slides
behind it; tab roots add one tab-height of bottom clearance
(`Screen underTabs`). Pushed screens hide the bar entirely rather than
shrinking content around it.

**Rule.** Navigation background stays purely white. No floating pills,
containers, gradients, or effects. Labels always accompany icons.

---

## 6. White background treatment

Main content, headers, and bottom navigation are all white (`background`
/ `surface` = `#FFFFFF`). `surfaceElevated` (`#FDFCFC`) and
`surfaceSecondary` (`#F1ECEA`) exist only for transient needs
(skeletons, pressed file rows, segmented containers, icon tiles) — never
as page backgrounds.

**Rule.** Do not introduce grey page backgrounds or coloured sections to
manufacture structure. Group with hierarchy and whitespace first,
hairlines second, tinted tiles last and sparingly.

---

## 7. Lists

The canonical row is `ListRow`: 60pt minimum height, 8pt vertical
padding, 12pt gaps; a 44pt red-tinted icon chip (22pt red glyph) at
left; 15pt semibold title with an optional 13pt secondary subtitle;
optional trailing content; a muted chevron iff the row navigates.
Tappable rows dim to 70% opacity.

- Rows of the same object share identical dimensions; a row never grows
  taller to smuggle in more detail — detail belongs on the detail page.
- Separators are hairlines between content blocks, not automatic rules
  after every element.
- A list row identifies and navigates; trailing content is one element
  (an amount, a status, *or* a chevron-led action — not all three).
- Loading uses motion-free skeleton rows mirroring real row geometry;
  empty uses the medallion empty state with at most one action;
  errors use the error state with retry.

**Inconsistency.** A few rows still pair a status word in the subtitle
with a status badge on the trailing edge (double encoding). Follow the
single-encoding direction: badge *or* subtitle, never both.

---

## 8. Colour system

| Token | Value | Use |
|---|---|---|
| `primary` (Send2U red) | `#DA0A1B` | Primary actions, selected tab, brand accents, key emphasis only |
| `primaryPressed` | `#A80815` | Pressed/emphasis red on tinted surfaces |
| `primarySoft` | `#FBE7E9` | Icon chips, selected option wash |
| `onPrimary` / white | `#FFFFFF` | Page, header, nav backgrounds; on-red text |
| `text` | `#22191B` | Primary text |
| `secondary` | `#5A4E52` | Secondary text, subtitles |
| `muted` | `#8D8287` | Captions, placeholders, inactive tabs |
| `border` / `divider` | `#E7DFDC` / `#E9E2E0` | Hairlines, dividers |
| `surfaceSecondary` | `#F1ECEA` | Skeleton, segmented containers, thumb tiles |
| `success` | `#1D7A4C` | Genuine success, finalized earnings |
| `warning` | `#96590A` | Caution states |
| `error` | `#BC3A2A` | Errors, destructive actions |
| `info` (deep red) | `#8A1A24` | In-transit order states only |
| `disabled` | `#9AA3AB` on `#E9EDF0` | Disabled, never by opacity alone |

Red must regain meaning with every use: one dominant red per viewport —
the primary action. Normal in-progress states must not read as errors;
keep the deep-red `info` pills small and pair them with neutral dates
and muted copy. Destructive red stays visually subordinate to the
primary action (borderless text buttons) while remaining unmistakable.
Disabled states change colour tokens, add borders where the enabled
variant has them, and never rely on dimming the label alone.

---

## 9. Progressive information hierarchy

Follow **List → Detail → Decision → Action → Result**:

- Lists identify and navigate (vendor, items summary, location, date).
- Detail pages explain (breakdown, route, timeline, evidence).
- Decisions happen where the consequences live (confirm screens state
  irreversibility; destructive advances carry dispute captions).
- Actions are single and ordered (primary first, safe exits last).
- Results confirm inline (success hero + next step, never a dead end).

Do not build hide/show or expand/collapse systems merely to fit more
onto one screen. The single sanctioned exception is the delivery
workspace's order-details disclosure (open while deciding/buying,
closed once moving), because the same task needs different detail
density at different states. When information needs real explanation,
it gets a page — see the confirm checklist, payment steps, and help
articles.

---

## 10. Action hierarchy

- **Primary** — filled red, 52pt minimum, 12pt radius, white semibold
  label. Exactly one per task viewport, placed where the task resolves.
- **Secondary** — white with 1.5pt red border and red label. Safe
  alternatives and onward navigation.
- **Tertiary** — borderless red text, 48pt. Harmless exits (release
  before purchase, back-outs, disclosure toggles).
- **Destructive** — borderless brick-red text, 48pt. Disputes,
  deletions, removals. Always reachable, never louder than the primary.
- **Navigation** — rows with chevrons, header chevron, text links.
- **Utility/icon** — 44–48pt icon-only controls with 8pt slop where
  meaning is universal (back, bell, gear, download, copy, close).

Buttons are never placed at the very top of content (header controls
excepted) and are never made large for emphasis alone — 52pt primary /
48pt subordinate is the system. During any in-flight mutation, siblings
disable and only the acting control spins.

Overlays and floating actions are rationed: the sole `Modal` is the
request-detail overflow menu; the sole `Alert` is the vendor item-delete
confirm; there are no bottom sheets or snackbars — errors and empty
states render inline. The sole FAB is the red 60pt cart circle with a
count badge, bottom-right on Home, item, and vendor screens only, hidden
when the cart is empty and clearing the tab bar on Home.

---

## 11. Confirmation interaction

**Future — not implemented.** No slider, swipe-to-confirm, bottom
sheet, or snackbar exists in the app today (the only `Modal` is the
request-detail overflow menu; the only `Alert` is vendor item delete).
Consequential actions are currently confirmed with explicit full-width
buttons plus inline consequence copy.

Prescribed language for consequential actions (irreversible
confirmation, destructive advances, payment submission):

- "Slide to accept" — claiming work or starting an irreversible step.
- "Slide to confirm" — attesting receipt, submitting evidence.
- "Slide again to cancel" — safe reversal where the backend permits one.

Implemented for job acceptance (`SlideToConfirm` on Job Detail: drag
past ~70% to commit, early release springs back, screen-reader tap
equivalent, disabled state with reason). Other consequential actions
still use explicit buttons with inline consequence copy — adopt the
slider there only when a pass touches those flows.

Never use sliders for ordinary navigation or harmless actions; the
interaction weight must match the consequence.

---

## 12. Status vocabulary

Order statuses render Title Case from `snake_case` (`lib/orders.ts` is
authoritative). Tones: pre-dispatch fulfilment is deep-red `info`;
`out_for_delivery` is `warning`; delivered / confirmed / completed are
`success`; cancelled / disputed are `error`. Requester-facing wording is
fixed: "Waiting for a helper", "Helper assigned", "Helper is going to
the vendor", "Helper is at the vendor", "Food is available", "Food
purchased", "Request picked up", "On the way", "Delivered", "Payment
required", "Completed", "Cancelled", "Under review". Payment states:
"Verification pending" (`submitted`), "Payment verified" (`verified`),
"Payment rejected" (`rejected`) — `verified` here means the requester's
submitted receipt closed the order (self-attestation), never an
approval. The payable total is always food subtotal + the fixed RM2.00
delivery fee, computed server-side.

**Rule.** Never surface raw status keys, and never invent friendlier
states that imply tracking, ETAs, preparation, or refunds the backend
does not have.

---

## 13. Typography

The system font stack renders: display 28/700 (rare, celebratory
headings only), title 22/700 (one per screen at most), subtitle 17/600
(section labels, row-adjacent headings), body 16/400 (default text),
secondary 15 (row titles, semibold), caption 13 (metadata, subtitles,
hints), eyebrow 12/700 uppercase +0.8 tracking (section kickers),
button 16/600, price 17/700 tabular (money), status 13/600 (badges).
Hierarchy comes from size/weight pairing, never from cards or pills;
 practical ceiling is 28pt and only for success/hero moments.

---

## 14. Icons

MaterialIcons throughout, 20–26pt in place (22pt row chips, 24–26pt
header controls, 32pt state medallions, 40pt upload affordance),
tinted-chip leading icons in lists, chevron-right for navigation,
universally understood glyphs for utility actions. Icons never replace
text on consequential actions; every primary/destructive button carries
a verb label.

---

## 15. Spacing and density

Scale: 4 / 8 / 12 / 16 / 20 / 24 / 32. Screen margins 20pt horizontal,
section gaps 16pt, intra-group gaps 8–12pt, radii 8–16 (999 only for
pills, icon medallions, and the cart FAB). Rows breathe at 60pt; dense
metadata sits at 13pt/18pt line-height. A screen is done when scanning
takes seconds: complete but never crowded, calm but never unfinished.

---

## 16. Production quality principles

Consistency of chrome and components; predictable navigation (same back
semantics everywhere); hierarchy readable in seconds; stable layouts
(silent background refresh preserves rows and scroll — skeletons only
on true first mount); ≥48pt targets; immediate control feedback
(pressed dimming, spinners, disabled tokens); designed loading, error
(with retry/dismiss), and empty (with at most one action) states;
pull-to-refresh on list surfaces; safe-area-aware headers, bars, and
sheets; honest, state-accurate wording with no backend jargon.

---

## 17. Copy and wording

Short, direct, human, action-led, contextual. Name real states
("Waiting for a helper", "Food purchased with my money"); state
consequences plainly ("Stopping here moves the order to dispute",
"This action cannot be undone", "No QR set yet. Requesters cannot pay
you without one."); remind of external payment exactly where money
moves ("Pay only after the food is in your hands"). No paragraphs that
restate the obvious, no instructions for self-evident controls, no
filler sentences. Button labels are verbs ("Accept", "Confirm pickup",
"Mark delivered", "Submit Receipt", "Save Changes").

---

## 18. Mobile layout

320pt must work: flex rows with wrapping text, truncated subtitles,
self-sizing pills, full-width buttons, no horizontal scroll, no
clipping. Long vendor/location names truncate in lists and wrap on
detail. Primary actions sit within reach of the task content, never
below unrelated sections. Keyboard-bearing screens persist taps and
keep fields visible. Dynamic content (counts, names, amounts) must not
break row geometry.

---

## 19. Role consistency and Helper Portal direction

Global across requester, helper capability, and vendor: theme tokens,
header language, list rows, buttons, state components, copy voice,
white surfaces, red discipline. Role-specific is only content and
entry: vendors see stall operations; verified helpers additionally see
the Helper entry on their normal Profile. The portal reuses portal-wide
components (`OrderBreakdown`, `OrderTimeline`, evidence views, payment
cards) with helper-appropriate copy — same shapes, task-led ordering.

**Prescribed Helper Portal shape (future mockups/redesigns).**
Exactly three bottom-navigation destinations — **Jobs, Deliveries,
Profile** — with bottom navigation (not tabs elsewhere, not a fourth
destination). The portal must not contain a sign-out button (the
account signs out from the main Profile). The portal home/header
carries a back button with the page title centered; never duplicate
Back controls. Job lists show **actionable jobs only** — accepted,
expired, or otherwise unavailable jobs leave the available list
(realtime removal, no stale rows). Each helper may hold a **maximum of
three active jobs**; the UI must make the active set continuable at a
glance without becoming a dashboard. **No estimated revenue**: the fee
is fixed at RM2 — show it as a plain fact (`+RM2.00 fee`), with richer
money detail only inside receipt/payment context. Job rows stay lean
(vendor, items summary, location, date, fee); full order information
belongs on Job Detail. **Acceptance happens on the Job Detail page**
via the §11 confirmation interaction, so the queue row itself is never
the claim control.

**Current deltas (resolved 2026-09-16 except where noted).** Portal
bottom nav (Jobs/Deliveries/Profile, no portal sign-out) is implemented;
acceptance lives on Job Detail behind the §11 slider, queue rows
navigate only; the 3-active-job cap is enforced race-safely in
`send2u_accept_order` and surfaced as plain "(n/3)" text plus a disabled
slider reason. Remaining: no slider yet on other consequential actions
(buttons + consequence copy hold); fee stays factual (`+RM fee` on
decision surfaces only, never projected).

---

## 20. Current Inconsistencies

| Area | Current behavior | Established pattern | Why inconsistent | Direction |
|---|---|---|---|---|
| Header bells | Bells on Home/Requests only; gear on Profile; none on vendor tabs or portal | Bell available on primary pages (§4) | Helpers/vendors lack ambient update signal | Add `HeaderBell` to missing primary headers; no new controls |
| Portal navigation | Bottom tabs Jobs/Deliveries/Profile since 2026-09-16 | §19 three-destination bottom nav | Resolved — keep tab roots chrome-free of extra actions |
| Queue accept control | Rows navigate; claim via Job Detail slider | §19 acceptance on Job Detail via §11 | Resolved — do not re-add row-level claim controls |
| Active-job cap | Enforced race-safely server-side, displayed as "(n/3)" text | Max three active jobs (§19) | Resolved — keep UI and RPC limit in agreement (`MAX_ACTIVE_JOBS_PER_HELPER`) |
| Sliders | Built for job acceptance; other flows use buttons | §11 confirmation language | Partially resolved — extend only when touching those flows |
| Status double-encoding | Some rows pair status subtitle + badge | Single encoding (§7) | Redundant, noisy | Badge *or* subtitle |
| Place-icon color | Drop-off red in portal, brick elsewhere | One color per concept | Same meaning, two colors | Unify on the portal treatment |
| Sign-out treatments | Outlined / danger / tertiary across roles | One account, one pattern | Three patterns for one action | Unify on the requester outlined treatment |
| `info` red breadth | All pre-dispatch pills deep red | Red rationed (§8) | Normal work reads alarming | Demote to neutral/info treatment when pills diversify |
| Redundant titles | Glass title + in-content title duplication on some secondaries | Compact chrome (§4) | Header repeats content | Keep chrome title; drop in-content repeat |
| Text-button `Mark all read` | Bare pressable, sub-48pt target | ≥48pt controls | Smallest text action | Give it a 48pt row like `SectionHeader` actions |
| Stale inventory docs | Old audit described the deleted tab app | This document as source of truth | Misleads future implementers | That audit is marked superseded; do not revive it |

---

## 21. Send2U Design Rules

Before shipping any screen, check:

- [ ] Does this screen feel like Send2U (white, calm, one red)?
- [ ] Is the hierarchy clear in seconds (state → task → detail)?
- [ ] Is the page too crowded — or unfinished-empty?
- [ ] Is there information the next page should carry instead?
- [ ] Can secondary content collapse or move below the action?
- [ ] Is there exactly one competing-free primary action?
- [ ] Is any card/bordered box earning its existence?
- [ ] Is any badge/pill carrying what plain text could?
- [ ] Is colour meaning, not decoration?
- [ ] Is whitespace balanced (no dead zones, no cram)?
- [ ] Is the header compact with a single back control?
- [ ] Is navigation (tabs, bell, gear) consistent with sibling screens?
- [ ] Is every sentence purposeful, human, and state-accurate?
- [ ] Would this pass as finished product on a 320pt phone?
- [ ] Do consequential actions resist accidents (slider where §11 applies)?
- [ ] Does it work with red removed — then re-add red once, deliberately?

---

*Document status: rewritten 2026-09-16 from direct source inspection
(`constants/theme.ts`, `components/ui/*`, all route groups, `lib/orders.ts`).
Supersedes the prior redesign-spec revision as the visual source of truth;
behavioral contracts (roles, statuses, RPCs) remain with code and migrations.*
