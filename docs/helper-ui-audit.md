# Current Helper UI Structure Audit Report

> SUPERSEDED (2026-09-16): this report describes the pre-migration
> `(helper)` tab application, which has been deleted. Verified helpers
> are now `role = requester` + `is_verified_helper = true` and use
> `/(requester)/helper-portal/` (queue, delivery workspace, My
> Deliveries, Payment QR) inside the main app. Kept for historical
> reference only — do not build against the routes below.

## 1. Audit Scope

This report is an **audit and documentation task only**. It covers the **frontend UI structure, navigation, layout hierarchy, and task workflows of the Helper role exclusively** in the Send2U Expo React Native application. 

Out of scope for this report:
- Requester role screens and flows (order placement, menu browsing, vendor selection, requester checkout/payment).
- Vendor / Cafeteria stall role screens and flows.
- Admin dashboard.
- Any backend RPC, database schema, or code modifications.

Shared components are documented solely through the lens of how they are rendered within the Helper user experience.

---

## 2. Helper Screen Inventory

The following table lists every Helper screen, route file, purpose, navigation entry point, primary actions, and current implementation status verified in the codebase:

| Screen | Route / File | Purpose | Entry Point | Main Actions | Status |
| ------ | ------------ | ------- | ----------- | ------------ | ------ |
| **Available Jobs / Helper Hub** | `/(helper)`<br>`app/(helper)/index.tsx` | Main tab landing for helpers; displays availability toggle and list of open, unassigned pending orders. | Bottom Tab bar ("Jobs") / Role redirection after sign-in | Toggle online/offline status, refresh job queue, accept job directly from card, view job details. | Fully Implemented |
| **My Deliveries** | `/(helper)/deliveries`<br>`app/(helper)/deliveries.tsx` | Tab listing currently active assigned jobs as well as completed/terminal delivery history. | Bottom Tab bar ("My Deliveries") / "View My Deliveries" button after job acceptance | Segmented toggle (Active / History), pull-to-refresh, open job detail, navigate to job queue when empty. | Fully Implemented |
| **Earnings & Payouts** | `/(helper)/earnings`<br>`app/(helper)/earnings.tsx` | Tab displaying total finalized earnings from completed delivery fees and breakdown of past trips. | Bottom Tab bar ("Earnings") / Profile menu row ("Payouts") | View cumulative fee earnings, inspect completed trip details and fronted food cost. | Fully Implemented |
| **Helper Profile** | `/(helper)/profile`<br>`app/(helper)/profile.tsx` | Profile settings, payment QR code upload/management, navigation shortcuts, dev profile switcher, and sign-out. | Bottom Tab bar ("Profile") | Upload payment QR image, preview staged QR, replace/remove QR, switch dev accounts, sign out. | Fully Implemented |
| **Job Details & Fulfilment Workflow** | `/(helper)/jobs/[id]`<br>`app/(helper)/jobs/[id].tsx` | Primary workspace for job inspection, acceptance, step-by-step fulfilment status advancing, and history inspection. | Tapping any job card from Jobs tab, My Deliveries tab, Earnings tab, or Notification item | Accept job, advance status (`go_to_vendor`, `arrive`, `report_food_available`, `report_food_unavailable`, `purchase`, `mark_picked_up`, `start_delivery`, `mark_delivered`, `report_failed`, `release`, `abandon`), inspect requester payment receipt. | Fully Implemented |
| **Notification Center** | `/(helper)/notifications`<br>`app/(helper)/notifications.tsx` | Dedicated notifications route displaying order lifecycle updates for the helper. | Top header bell icon on any main Helper tab | Filter notifications (All, Unread, Orders, System), mark individual or all read, tap to open job detail. | Fully Implemented |

---

## 3. Helper Navigation Architecture

### Navigation Hierarchy
The Helper experience is mounted under the `(helper)` route group governed by `app/(helper)/_layout.tsx`. 

1. **Role Guard**: `app/(helper)/_layout.tsx` checks authentication state (`user`) and role (`role`). Non-authenticated users redirect to `/(auth)/sign-in`. Requesters redirect to `/(requester)`, and vendors redirect to `/(vendor)`.
2. **Tab Layout Shell**: Uses Expo Router's `Tabs` component with `backBehavior="history"`.
   - Native header is enabled globally (`headerShown: true`).
   - Bottom tab bar is styled with 70pt height, 8pt padding, top border (`colors.border`), and light background (`colors.surface`).
   - Header right slot renders `HeaderBell` with an unread badge counter (synced globally via `UnreadSync`).
3. **Tab Screens**:
   - `index` ("Jobs", icon: `work-outline`)
   - `deliveries` ("My Deliveries", icon: `delivery-dining`)
   - `earnings` ("Earnings", icon: `account-balance-wallet`)
   - `profile` ("Profile", icon: `person-outline`)
4. **Hidden Secondary Screens** (Hidden from tab bar via `href: null`):
   - `jobs/[id]` ("Job details", back button: `HeaderBack` falling back to `/(helper)`)
   - `notifications` ("Notifications", back button: `HeaderBack` falling back to `/(helper)`)

### Navigation Map

```text
Root Gate (app/index.tsx)
└── Auth & Role Check (role === 'helper')
    └── Helper Layout Shell (app/(helper)/_layout.tsx)
        ├── UnreadSync (Background realtime notification badge counter sync)
        │
        ├── Bottom Tab Bar (Primary Navigation)
        │   ├── Jobs Tab [/(helper)] (app/(helper)/index.tsx)
        │   │   ├── Header: "Jobs" + HeaderBell (Unread badge)
        │   │   ├── Toggle: Online / Offline Switch
        │   │   └── Job Cards → Navigate to Job Details [/(helper)/jobs/[id]]
        │   │
        │   ├── My Deliveries Tab [/(helper)/deliveries] (app/(helper)/deliveries.tsx)
        │   │   ├── Header: "My Deliveries" + HeaderBell
        │   │   ├── Segmented Toggle: [Active] | [History]
        │   │   └── Active/History Cards → Navigate to Job Details [/(helper)/jobs/[id]]
        │   │
        │   ├── Earnings Tab [/(helper)/earnings] (app/(helper)/earnings.tsx)
        │   │   ├── Header: "Earnings" + HeaderBell
        │   │   └── Trip Cards → Navigate to Job Details [/(helper)/jobs/[id]]
        │   │
        │   └── Profile Tab [/(helper)/profile] (app/(helper)/profile.tsx)
        │       ├── Header: "Profile" + HeaderBell
        │       ├── ListRow Shortcuts:
        │       │   ├── "My deliveries" → Navigate to [/(helper)/deliveries]
        │       │   └── "Payouts" → Navigate to [/(helper)/earnings]
        │       └── Payment QR Section (Upload / Preview / Replace / Remove)
        │
        └── Stack Sub-Screens (Hidden from Tab Bar)
            ├── Job Details & Workflow [/(helper)/jobs/[id]] (app/(helper)/jobs/[id].tsx)
            │   ├── Header: Vendor Name / "Job details" (No HeaderBell, back chevron)
            │   ├── State A: Open Pending Job → Accept Job
            │   ├── State B: Active Job (Assigned → Out For Delivery) → Step Actions
            │   ├── State C: Delivered / Confirmed → Payment Receipt Card
            │   └── State D: Terminal Job (Completed / Disputed) → HelperHistoryDetail (Read-only)
            │
            └── Notifications Center [/(helper)/notifications] (app/(helper)/notifications.tsx)
                ├── Header: "Notifications" (No HeaderBell, back chevron, "Mark all read" button)
                └── Notification Items → Navigate to Job Details [/(helper)/jobs/[id]]
```

---

## 4. Helper Screen-by-Screen UI Analysis

### Available Jobs / Helper Hub (`index.tsx`)

* **Route**: `/(helper)`
* **File Path**: `app/(helper)/index.tsx`
* **Purpose**: Primary dashboard for helpers to toggle availability and browse open, unassigned delivery requests.
* **Entry point**: App launch when signed in as helper, tapping "Jobs" tab, or clicking "Back to jobs" from job details.
* **Layout structure**: Vertical scrollable `Screen` with pull-to-refresh (`RefreshControl`).
* **Header**: Native tab header titled "Jobs". Renders `HeaderBell` on the right showing unread notification badge. Includes `SectionHeader` inside content area with eyebrow "Helper hub", title "Delivery jobs", and optional badge showing `X open` count.
* **Main content**:
  1. **Availability Card**: Contains status text ("You're available" / "You're offline"), optional error message, and a native `Switch` control.
  2. **Job Queue List**: When online and requests exist, renders vertical cards for each available job.
     - Card header: List row with `delivery-dining` icon, vendor name, summary text (`X × Item + Y more · Dropoff Location · Date`), subtotal price formatted in MYR (bold primary color `#DA0A1B`).
     - Card action: Full-width primary `Button` titled "Accept job".
* **Primary action**: Toggle availability switch; tap "Accept job" on a specific card.
* **Secondary actions**: Tap job card row (opens job detail without accepting); pull down to refresh queue.
* **Navigation**: Tapping "Accept job" claims the job and navigates to `/(helper)/jobs/[id]`. Tapping a row navigates to `/(helper)/jobs/[id]` to inspect details.
* **UI states**:
  - *Offline State*: Renders `EmptyState` (`schedule` icon) with "You're offline" and "Go available to see open requests."
  - *Loading State*: Renders `Card` with `LoadingState` spinner ("Finding open jobs…").
  - *Error State*: Renders `Card` with `ErrorState` ("Couldn't load open jobs") and a "Try again" button.
  - *Empty State (Online)*: Renders `EmptyState` (`work-outline` icon) with "No open requests" and "Pull to refresh."
  - *Action Error*: Floating `ErrorState` banner at top of list if job acceptance fails (e.g., lost race condition).
* **Components used**: `Screen`, `SectionHeader`, `Card`, `Text`, `Switch`, `EmptyState`, `LoadingState`, `ErrorState`, `ListRow`, `Button`.
* **Current observations**: Renders duplicate headers (native tab header "Jobs" + in-screen `SectionHeader` "Delivery jobs"). Renders `Accept job` both inline on each card and inside the job detail view.

---

### My Deliveries (`deliveries.tsx`)

* **Route**: `/(helper)/deliveries`
* **File Path**: `app/(helper)/deliveries.tsx`
* **Purpose**: Manage ongoing assigned deliveries and view past delivery history.
* **Entry point**: Tapping "My Deliveries" tab or clicking "View My Deliveries" button on job detail screen.
* **Layout structure**: Vertical scrollable `Screen` with pull-to-refresh (`RefreshControl`).
* **Header**: Native tab header titled "My Deliveries" with `HeaderBell` on right. In-screen `SectionHeader` with eyebrow "Deliveries" and dynamic title ("Your active jobs" or "Delivery history").
* **Main content**:
  1. **Active/History Segmented Switch**: `ActiveHistoryToggle` component (`[Active]` | `[History · X]`).
  2. **Delivery Cards List**:
     - *Active Tab*: Displays cards for assigned, in-transit, or delivered orders. Renders vendor name, drop-off location, timestamp, total MYR price, order status badge (e.g. `Assigned`, `Out for delivery`, `Delivered`), and payment status badge (`Unpaid`, `Submitted`, `Verified`).
     - *History Tab*: Displays cards for completed or disputed orders. Renders vendor name, drop-off location, date, delivery fee, total MYR price, and order status badge.
* **Primary action**: Toggle between Active and History tabs; tap any delivery card to view its workspace.
* **Secondary actions**: Pull to refresh active or history lists; empty state button "Browse jobs" (navigates to `/(helper)`).
* **Navigation**: Tapping a delivery card opens `/(helper)/jobs/[id]`.
* **UI states**:
  - *Loading State*: Card containing `LoadingState` ("Loading your deliveries…" / "Loading your history…").
  - *Error State*: Card containing `ErrorState` with "Try again" retry trigger.
  - *Empty State (Active)*: `EmptyState` component with "No active deliveries" or "No deliveries yet", plus a "Browse jobs" button.
  - *Empty State (History)*: `EmptyState` component with `history` icon and "No history yet".
* **Components used**: `Screen`, `SectionHeader`, `ActiveHistoryToggle`, `Card`, `ListRow`, `Badge`, `Text`, `EmptyState`, `LoadingState`, `ErrorState`.
* **Current observations**: Re-uses `SectionHeader` below native tab bar header. The segmented toggle is custom-built and distinct from standard segmented controls used elsewhere in the design system.

---

### Earnings & Payouts (`earnings.tsx`)

* **Route**: `/(helper)/earnings`
* **File Path**: `app/(helper)/earnings.tsx`
* **Purpose**: Display cumulative finalized delivery fee earnings and itemized breakdown of completed trips.
* **Entry point**: Tapping "Earnings" tab or tapping "Payouts" row on Helper Profile screen.
* **Layout structure**: Vertical scrollable `Screen` with pull-to-refresh (`RefreshControl`).
* **Header**: Native tab header titled "Earnings" with `HeaderBell` on right. In-screen `SectionHeader` with eyebrow "Earnings", title "Your payouts".
* **Main content**:
  1. **Earnings Summary Card**: Displays label "Finalized delivery earnings", large primary-colored total MYR amount (`formatMYR(totalCents)`), and caption explaining completed trip count. Explicit note states: *"Fronted food costs are never counted as earnings — only the fee is."*
  2. **Trip History List**: Card for each completed order. Displays list row with `payments` icon, vendor name, timestamp, fronted food cost note, and green bold delivery fee text (`+RM 2.00`).
* **Primary action**: Tap any trip card to review its historical read-only record.
* **Secondary actions**: Pull to refresh.
* **Navigation**: Tapping a trip card opens `/(helper)/jobs/[id]`.
* **UI states**:
  - *Loading State*: Card with `LoadingState` ("Loading earnings…").
  - *Error State*: Card with `ErrorState` ("Couldn't load earnings").
  - *Empty State*: `EmptyState` (`account-balance-wallet` icon) with "No earnings yet".
* **Components used**: `Screen`, `SectionHeader`, `Card`, `Text`, `ListRow`, `EmptyState`, `LoadingState`, `ErrorState`.
* **Current observations**: Clean single-purpose interface. Accurately isolates delivery fees (helper earnings) from fronted food subtotal costs.

---

### Helper Profile & Payment QR (`profile.tsx`)

* **Route**: `/(helper)/profile`
* **File Path**: `app/(helper)/profile.tsx`
* **Purpose**: Manage helper identity display, upload and maintain payment QR code image, access internal navigation, switch dev profiles, and sign out.
* **Entry point**: Tapping "Profile" tab.
* **Layout structure**: Vertical scrollable `Screen` with `underTabs` property.
* **Header**: Custom centered profile header layout (avatar circle with `delivery-dining` icon in `primarySoft` background, subtitle "Student helper", user email caption). No `SectionHeader` used.
* **Main content**:
  1. **Shortcuts Card**: `ListRow` for "My deliveries" (navigates to `/(helper)/deliveries`) and "Payouts" (navigates to `/(helper)/earnings`).
  2. **Payment QR Management Card**:
     - Header: Subtitle "Payment QR".
     - QR Display: Shows existing QR via `DownloadableQR` component (includes download button), or a muted caption "Requesters can't pay you without one."
     - Error Text: Displays `qrError` if upload/removal fails.
     - Staged Preview: When a new image is picked, renders `StagedFileCard` with image preview, file name/size, "Confirm & set/replace QR" button, "Rechoose" button, and "Cancel" button.
     - Upload/Replace Button: Secondary variant `Button` titled "Upload QR" or "Replace QR".
     - Remove QR Button: Danger variant `Button` titled "Remove QR" (shown when QR exists).
  3. **Dev Profile Switcher Card**: Rendered via `DevProfileSwitcher` (allows quick switching between test accounts).
  4. **Sign Out Button**: Danger variant `Button` titled "Sign out".
* **Primary action**: Upload / Replace / Remove Payment QR code; Sign Out.
* **Secondary actions**: Tap navigation shortcuts; switch dev profiles.
* **Navigation**: Links directly to `/(helper)/deliveries` and `/(helper)/earnings`. Sign out triggers root auth redirect.
* **UI states**:
  - *No QR Set*: Shows placeholder warning text + "Upload QR" button.
  - *QR Set*: Shows `DownloadableQR` + "Replace QR" button + "Remove QR" button.
  - *Staged QR State*: Shows `StagedFileCard` preview with confirmation controls.
  - *Uploading/Working Busy State*: Buttons display loading spinner and busy text ("Choosing image…", "Uploading QR…").
* **Components used**: `Screen`, `Card`, `Text`, `Button`, `ListRow`, `DownloadableQR`, `StagedFileCard`, `DevProfileSwitcher`.
* **Current observations**: The Payment QR uploaded here is a critical prerequisite for receiving payment, as requesters must scan this exact QR to transfer funds.

---

### Job Details & Fulfilment Workflow (`jobs/[id].tsx`)

* **Route**: `/(helper)/jobs/[id]`
* **File Path**: `app/(helper)/jobs/[id].tsx`
* **Purpose**: Comprehensive workspace for evaluating a job, executing step-by-step physical delivery fulfilment actions, and reviewing payment/history records.
* **Entry point**: Opening any job card from Jobs Queue, My Deliveries, Earnings, or Notifications.
* **Layout structure**: Vertical scrollable `Screen`. Native Stack header with back chevron (no top notification bell).
* **Header**: Dynamic Stack header showing vendor name (e.g. "Malay Stall"). In-screen heading displays Vendor Name + Status Badge (e.g., `Pending`, `Assigned`, `Going to vendor`, `At vendor`, `Food available`, `Food purchased`, `Picked up`, `Out for delivery`, `Delivered`, `Confirmed`) + timestamp.
* **Main content**:
  1. **Location Card**: Vendor pickup location hint (`storefront` icon) and drop-off campus location name (`place` icon).
  2. **Order Breakdown Card**: `OrderBreakdown` component listing items, quantities, unit prices, food subtotal, and delivery fee. Caption explicitly notes: *"You pay the stall first; the requester repays food + delivery."*
  3. **State-Driven Action Card** (Renders specific actions based on `job.status`):
     - *Pending (Unassigned)*: Shows "Accept job" button.
     - *Assigned*: Shows "Go to vendor" button + "Release job" button.
     - *Going to Vendor*: Shows "I'm at the vendor" button + "Release job" button.
     - *At Vendor*: Shows "Food available" button + "Food unavailable" button + "Release job" button.
     - *Food Available*: Shows "Food purchased with my money" button + "Release job" button.
     - *Food Purchased*: Shows "Confirm pickup" button + "Can't complete this job" button (dispute trigger).
     - *Picked Up*: Shows "Start delivery" button + "Can't complete this job" button.
     - *Out for Delivery*: Shows "Mark delivered" button + "Requester unavailable" button.
     - *Delivered*: Shows "Waiting for requester to confirm receipt" info text.
     - *Confirmed*: Shows "Requester confirmed receipt" info text.
  4. **Payment Card**: Renders `HelperPaymentCard` at the bottom of active jobs to inspect the requester's uploaded payment receipt and verification status.
* **Terminal Historical Variant**: If `isTerminalOrderStatus(job.status)` is true (`completed` or `disputed`), renders `HelperHistoryDetail` instead, which provides a read-only view including settlement records, timeline, rating section, and receipt evidence.
* **Primary action**: Advance fulfilment status button corresponding to current physical progress step.
* **Secondary actions**: Release job, report exception/dispute ("Can't complete", "Food unavailable", "Requester unavailable"), refresh payment card, back button.
* **Navigation**: Back chevron returns to caller or `/(helper)`. Accepting an unassigned job updates state in-place and provides buttons to navigate to `/(helper)/deliveries` or back to jobs.
* **UI states**:
  - *Loading*: `LoadingState` ("Loading job…").
  - *Job Missing/Taken*: `ErrorState` ("Job not available") with "Back to jobs" button.
  - *Action Error*: `ErrorState` banner inside action card if an RPC transition fails.
  - *Terminal History View*: Read-only view via `HelperHistoryDetail`.
* **Components used**: `Screen`, `Stack.Screen`, `Card`, `Text`, `Badge`, `Button`, `OrderBreakdown`, `HelperPaymentCard`, `HelperHistoryDetail`, `ErrorState`, `LoadingState`.
* **Current observations**: Extremely thorough 10-step atomic fulfilment state machine. Contains significant dense vertical scrolling due to multiple stacked cards.

---

### Notification Center (`notifications.tsx`)

* **Route**: `/(helper)/notifications`
* **File Path**: `app/(helper)/notifications.tsx` (wraps `components/NotificationCenter.tsx`)
* **Purpose**: List and filter all in-app notifications for order lifecycle events.
* **Entry point**: Tapping header bell icon on any main Helper tab.
* **Layout structure**: Vertical scrollable `Screen` with `underHeader` layout and pull-to-refresh.
* **Header**: Translucent header displaying title "Notifications", back chevron, and "Mark all read" button action (visible when unread notifications exist).
* **Main content**:
  1. **Segmented Filter Bar**: `SegmentedControl` offering `[All]`, `[Unread]`, `[Orders]`, and `[System]` filters.
  2. **Notification Items List**: Renders list of notification cards. Unread cards feature a subtle primary tint background (`primarySoft`), primary text weight, and icon badge (`KIND_ICONS` mapping for `order.assigned`, `order.picked_up`, `order.out_for_delivery`, `order.delivered`, `order.confirmed`, `order.completed`, `order.disputed`). Displays title, body message, and relative time (e.g. "5m ago").
* **Primary action**: Tap notification card to mark read and navigate to relevant job.
* **Secondary actions**: Filter tabs; tap "Mark all read"; pull down to refresh.
* **Navigation**: Tapping any order notification opens `/(helper)/jobs/[id]`.
* **UI states**:
  - *Loading*: `LoadingState` ("Loading notifications…").
  - *Error*: `ErrorState` ("Couldn't load notifications").
  - *Empty State*: `EmptyState` customized per filter (e.g., "You're all caught up" for unread).
* **Components used**: `NotificationCenter`, `GlassHeader`, `SegmentedControl`, `Card`, `Text`, `EmptyState`, `LoadingState`, `ErrorState`.
* **Current observations**: Highly effective list filtering and visual unread distinction. Tapping an item marks it read without blocking navigation.

---

## 5. Helper Delivery Workflow

The following table maps the Helper's complete step-by-step task lifecycle across screens, states, actions, and system responses:

| Step | Screen | Helper Action | UI State | Next Step | Current Observations |
| ---- | ------ | ------------- | -------- | --------- | -------------------- |
| **1. Online Availability** | Jobs (`/(helper)`) | Toggle `Switch` to ON | `isAvailable = true` | Job Queue loads | Database executes `send2u_set_helper_availability(true)`. List displays open pending jobs. |
| **2. Job Discovery** | Jobs (`/(helper)`) | Browse queue or pull to refresh | `status = 'ready'` | Tap card or "Accept job" | Cards show vendor name, item summary, drop-off location, timestamp, and MYR subtotal. |
| **3. Job Detail Review** | Job Details (`/(helper)/jobs/[id]`) | Tap job card row | `job.status = 'pending'`, `helperId = null` | Review items & location | Shows full item list, vendor location hint, drop-off location, subtotal, fee, and "Accept job" button. |
| **4. Accept Job** | Jobs or Job Details | Tap "Accept job" | `accepting = true` → `job.status = 'assigned'` | Proceed to vendor | Executes atomic `send2u_accept_order`. On success, claimant wins and status becomes `assigned`. |
| **5. Start Trip to Vendor** | Job Details (`/(helper)/jobs/[id]`) | Tap "Go to vendor" | `job.status = 'assigned'` → `going_to_vendor` | On the way | Calls `advanceFulfilment('go_to_vendor')`. Button updates to "I'm at the vendor". |
| **6. Arrive at Vendor** | Job Details (`/(helper)/jobs/[id]`) | Tap "I'm at the vendor" | `job.status = 'going_to_vendor'` → `at_vendor` | At vendor stall | Calls `advanceFulfilment('arrive')`. Buttons present: "Food available", "Food unavailable", "Release". |
| **7. Verify Availability** | Job Details (`/(helper)/jobs/[id]`) | Tap "Food available" | `job.status = 'at_vendor'` → `food_available` | Purchase food | If unavailable, tapping "Food unavailable" hard-deletes clean cancellation or flags dispute. |
| **8. Purchase Food** | Job Details (`/(helper)/jobs/[id]`) | Tap "Food purchased with my money" | `job.status = 'food_available'` → `food_purchased` | Confirm pickup | Helper fronts food cost at stall. System snapshots `food_cost_cents = subtotal_cents`. |
| **9. Confirm Pickup** | Job Details (`/(helper)/jobs/[id]`) | Tap "Confirm pickup" | `job.status = 'food_purchased'` → `picked_up` | Start delivery | Confirming pickup verifies food in hand. Releasing is no longer clean (triggers dispute if abandoned). |
| **10. Start Delivery Run** | Job Details (`/(helper)/jobs/[id]`) | Tap "Start delivery" | `job.status = 'picked_up'` → `out_for_delivery` | Travel to drop-off | Status becomes `out_for_delivery`. Helper travels to specified campus drop-off location. |
| **11. Mark Delivered** | Job Details (`/(helper)/jobs/[id]`) | Tap "Mark delivered" | `job.status = 'out_for_delivery'` → `delivered` | Await requester receipt | Status updates to `delivered`. Helper awaits requester's confirmation & payment submission. |
| **12. Requester Confirmation & Payment** | Job Details / My Deliveries | Requester confirms receipt & uploads receipt | `job.status = 'confirmed'` / `payment.status = 'submitted'` | Review payment | Helper inspects requester's uploaded receipt via embedded `HelperPaymentCard`. |
| **13. Order Completion & Payout** | Automatic backend / System | Requester submission completes order | `job.status = 'completed'`, `payment.status = 'verified'` | View in Earnings | Order moves to terminal `completed` status. Delivery fee (+RM 2.00) is added to Helper Payouts. |

---

## 6. Helper Component Architecture

The following table summarizes all UI components used within the Helper experience:

| Component | File Path | Responsibility | Used By | Reusability / Consistency Notes |
| --------- | --------- | -------------- | ------- | ------------------------------- |
| `DownloadableQR` | `components/DownloadableQR.tsx` | Renders private storage QR image with overlaid download icon button. | Helper Profile | High reusability. Encapsulates private image signing, download progress, and error state. |
| `HelperPaymentCard` | `components/HelperPaymentCard.tsx` | Displays live payment status and requester's uploaded receipt/PDF evidence. | Job Details (`jobs/[id]`) | Helper-specific. Read-only design. Includes PDF viewer/downloader fallback. |
| `HelperHistoryDetail` | `components/HelperHistoryDetail.tsx` | Displays complete read-only historical record for completed/disputed jobs. | Job Details (`jobs/[id]`) | Helper-specific. Wraps settlement records, ratings, timeline, breakdown, and payment evidence. |
| `ActiveHistoryToggle` | `components/ActiveHistoryToggle.tsx` | Custom segmented tab control (`[Active]` \| `[History]`). | My Deliveries | Reused between Requester Orders and Helper Deliveries. Visually inconsistent with `SegmentedControl`. |
| `NotificationCenter` | `components/NotificationCenter.tsx` | Full notification list with filter tabs, unread styling, and mark-all-read. | Helper Notifications | Shared component parameterized by `role="helper"`. Handles role-specific navigation routing. |
| `HeaderBell` | `components/HeaderBell.tsx` | Header right icon button rendering a bell with red unread notification count badge. | Helper Tab Header (`_layout.tsx`) | Shared component parameterized by `role="helper"`. Reads from `useUnreadCount`. |
| `HeaderBack` | `components/HeaderBack.tsx` | Standard left back chevron button with safe fallback route for deep links. | Job Details, Notifications | Shared component used across secondary headers. |
| `UnreadSync` | `components/UnreadSync.tsx` | Invisible background wrapper managing global unread notification sync. | Helper Layout (`_layout.tsx`) | Shared component. Executes realtime listener for badge counts. |
| `StagedFileCard` | `components/StagedFileCard.tsx` | Displays picked image preview with confirmation/rechoose/cancel buttons. | Helper Profile | Shared component. Used for profile avatars and payment QR staging. |
| `OrderBreakdown` | `components/OrderBreakdown.tsx` | Itemized food list table showing items, quantities, subtotal, and delivery fee. | Job Details, HelperHistoryDetail | Shared component. Displays food subtotal vs delivery fee clearly. |
| `OrderTimeline` | `components/OrderTimeline.tsx` | Vertical step timeline showing timestamps for order lifecycle milestones. | HelperHistoryDetail | Shared component. Provides audit trail of fulfilment timestamps. |
| `ReceiptEvidenceView` | `components/ReceiptEvidenceView.tsx` | Displays receipt image or PDF file row with download capability. | HelperHistoryDetail | Shared component. Handles storage signed URLs and PDF download sheet. |
| `SettlementRecord` | `components/SettlementRecord.tsx` | Financial summary card for completed/disputed orders (fronted vs fee). | HelperHistoryDetail | Shared component. Explains financial resolution for completed/disputed jobs. |
| `OrderRatingSection` | `components/OrderRatingSection.tsx` | Renders star rating display and submission form for completed jobs. | HelperHistoryDetail | Shared component. Allows helper to view requester rating or submit rating. |
| `PrivateImage` | `components/PrivateImage.tsx` | Secure image loader for private Supabase storage buckets via short-lived URLs. | HelperPaymentCard, DownloadableQR | Shared component. Handles loading skeleton and error fallback. |
| `DevProfileSwitcher` | `components/DevProfileSwitcher.tsx` | Development drawer for quick-switching between test user accounts. | Helper Profile | Dev-only shared component. Gated by environment config. |
| `Screen` | `components/ui/Screen.tsx` | Standard view container managing safe area insets and scroll views. | All Helper Screens | Foundation UI component. Standardizes padding (`spacing.lg`) and background color. |
| `Card` | `components/ui/Card.tsx` | White rounded container (`radii.lg`) with subtle border (`colors.border`). | All Helper Screens | Foundation UI component. Enforces border-only separation (no drop shadows). |
| `Button` | `components/ui/Button.tsx` | Action button supporting primary, secondary, tertiary, and danger variants. | All Helper Screens | Foundation UI component. Standardizes height (52pt touch target) and loading states. |
| `Text` | `components/ui/Text.tsx` | Typography component mapped to design system variant tokens. | All Helper Screens | Foundation UI component. Ensures consistent font sizes, line heights, and weights. |
| `Badge` | `components/ui/Badge.tsx` | Compact status pill (success, warning, error, info, primary, neutral). | All Helper Screens | Foundation UI component. Used extensively for order status and payment status. |
| `SectionHeader` | `components/ui/SectionHeader.tsx` | Page section header rendering uppercase eyebrow, title, and optional badge. | Jobs, Deliveries, Earnings | Foundation UI component. Creates consistent section headers inside screens. |
| `ListRow` | `components/ui/ListRow.tsx` | Standard row component with left icon, title, subtitle, and right slot. | Jobs, Deliveries, Earnings, Profile | Foundation UI component. Standardizes list item layout across all tabs. |

---

## 7. Current Design System Patterns

The Helper role UI strictly adheres to the Send2U Light-Only Design System defined in `constants/theme.ts`.

### 1. Colors (`colors`)
- **Brand Primary**: `#DA0A1B` (Send2U Red). Used for active tab icons, primary buttons, price highlights, and main callouts.
- **Primary Pressed**: `#A80815`
- **Primary Soft**: `#FBE7E9` (Light red tint used for availability switch tracks, icon container backgrounds, and unread notification backgrounds).
- **Background & Surface**: `#FFFFFF` (Pure white for background, cards, and tab bars).
- **Surface Secondary**: `#F1ECEA` (Light grey surface for quantity steppers, file rows, and segmented toggle containers).
- **Text Color Hierarchy**:
  - Primary text: `#22191B` (Dark charcoal)
  - Secondary text: `#5A4E52` (Medium charcoal)
  - Muted text: `#8D8287` (Muted grey)
- **Borders & Dividers**:
  - Border: `#E7DFDC`
  - Divider: `#E9E2E0`
- **Semantic Status Colors**:
  - Success: `#1D7A4C` / Soft: `#E4F3EB` (Completed orders, active availability, confirmed state).
  - Warning: `#96590A` / Soft: `#F9EEDB` (Unpaid state, out for delivery status).
  - Error / Danger: `#BC3A2A` / Soft: `#FAE7E3` (Release/abandon job, remove QR, sign out, error states).
  - Info: `#8A1A24` / Soft: `#F7E4E5` (Deep red info tone for in-transit order statuses).

### 2. Typography (`typography`)
- `display`: 28pt / line height 34pt / weight 700
- `title`: 22pt / line height 28pt / weight 700
- `subtitle`: 17pt / line height 24pt / weight 600
- `body`: 16pt / line height 24pt / weight 400
- `secondary`: 15pt / line height 22pt / weight 400
- `caption`: 13pt / line height 18pt / weight 400
- `eyebrow`: 12pt / line height 16pt / weight 700 / letter spacing 0.8pt (Uppercase)
- `button`: 16pt / line height 24pt / weight 600
- `price`: 17pt / line height 24pt / weight 700
- `status`: 13pt / line height 18pt / weight 600

### 3. Layout, Radii, and Spacing
- **Spacing Grid**: `xs: 4`, `sm: 8`, `md: 12`, `lg: 16`, `xl: 20`, `xxl: 24`, `xxxl: 32`.
- **Border Radii**: `sm: 8`, `md: 12`, `lg: 16`, `xl: 20`, `full: 999`.
- **Touch Targets**: Minimum interactive heights enforced (`button`: 52pt, `listRow`: 60pt, `tabBar`: 70pt).
- **Surface Elevation Pattern**: **No drop shadows or elevation shadows are used.** All cards and containers separate visually using 1px solid borders (`colors.border`) over the white background.

---

## 8. UI Inconsistencies and Structural Problems

During the audit of the Helper codebase, several structural and visual issues were observed:

### 1. Navigation & Header Chrome
- **Header Duplication on Root Tabs**:
  - *Observed Problem*: Root tab screens (`index.tsx`, `deliveries.tsx`, `earnings.tsx`) render both the native Expo Router tab header (e.g., "Jobs", "My Deliveries", "Earnings") AND an in-screen `SectionHeader` component (e.g. eyebrow "Helper hub", title "Delivery jobs").
  - *Impact*: Consumes ~120pt of vertical screen real estate before any main content or action is visible to the helper.
  - *Evidence*: `app/(helper)/_layout.tsx` defines native headers while `app/(helper)/index.tsx` renders `SectionHeader`.

### 2. Component & Control Inconsistencies
- **Multiple Segmented Control Implementation Variants**:
  - *Observed Problem*: `My Deliveries` uses `ActiveHistoryToggle` (custom styled buttons with grey background), whereas `NotificationCenter` uses `SegmentedControl`.
  - *Impact*: Creates visual and interactive inconsistency across tab screens.
  - *Evidence*: `ActiveHistoryToggle` uses `colors.surfaceSecondary` with `radii.md`, while `SegmentedControl` has a different pill animation and border styling.

### 3. Layout & Ergonomics
- **Dense Vertical Card Stacking on Job Details**:
  - *Observed Problem*: `app/(helper)/jobs/[id].tsx` renders up to 5 individual `Card` containers in a single column (Heading card, Locations card, Order Breakdown card, Fulfilment Action card, Payment card).
  - *Impact*: Requires extensive vertical scrolling on standard mobile screens. Primary action buttons (e.g. "Mark delivered" or "Confirm pickup") push lower-level details off-screen.
  - *Evidence*: Lines 198–466 of `jobs/[id].tsx` instantiate 5 separate `<Card>` blocks sequentially.

### 4. Redundant Actions across Views
- **Duplicated "Accept Job" Action**:
  - *Observed Problem*: Helpers can tap "Accept job" directly on the list card in `/(helper)` OR open the detail view `/(helper)/jobs/[id]` and tap "Accept job" there.
  - *Impact*: The list card button encourages fast one-tap acceptance without reviewing item details or vendor location hints, while the detail view requires navigating into a new screen.
  - *Evidence*: `index.tsx` line 164 renders `Button title="Accept job"`, and `jobs/[id].tsx` line 265 renders another `Button title="Accept job"`.

### 5. Notification Bell Scope
- **Global Header Bell vs. Task Focus**:
  - *Observed Problem*: `HeaderBell` is displayed on all 4 main Helper tab headers (`Jobs`, `My Deliveries`, `Earnings`, `Profile`).
  - *Impact*: While useful for general awareness, tapping the bell navigates away from active workflows to `/(helper)/notifications`.

---

## 9. Helper Experience Assessment

Evaluating the current UI against the core needs of a delivery helper:

1. **Quickly seeing availability status**: **Supported.** The `Jobs` tab features a prominent toggle card at the top of the queue showing "You're available" or "You're offline".
2. **Finding relevant jobs**: **Partially Supported.** Open jobs list vendor name, drop-off location, item summary, timestamp, and subtotal. However, there is no distance/map visualization or location sorting.
3. **Understanding task value & earnings**: **Supported.** Delivery fee (+RM 2.00) is explicitly separated from fronted food costs on earnings, job detail, and history screens.
4. **Navigating pickup and drop-off**: **Partially Supported.** Vendor location hints and campus drop-off location names are displayed as plain text rows. No map integration, tap-to-navigate links, or phone contact shortcuts exist.
5. **Executing fulfilment steps**: **Supported.** The 10-step atomic state machine in `jobs/[id].tsx` clearly presents the next required action button based on order status (e.g. `Go to vendor` → `I'm at the vendor` → `Food available` → `Food purchased` → `Confirm pickup` → `Start delivery` → `Mark delivered`).
6. **Receiving & verifying payment**: **Supported with Friction.** The helper MUST upload a payment QR code in their profile. Requesters pay externally using this QR and upload a receipt. The helper inspects this receipt in `HelperPaymentCard`. However, there is no in-app payment gateway or instant verification—verification relies entirely on visual inspection of uploaded receipts.

---

## 10. Missing or Incomplete Areas

### Confirmed Missing Features
- **Map / Geolocation Integration**: No map component, live GPS tracking, or turn-by-turn navigation exists. All locations are string labels (`location.name`, `vendor.locationHint`).
- **Direct Communication Channel**: No in-app chat or phone dialer exists between helper and requester. If a helper cannot find the requester at drop-off, their only option is the "Requester unavailable" button (which triggers a dispute).
- **Batching / Multi-Order Fulfilment**: Helpers can only accept and fulfill jobs one by one. There is no UI for batching orders from the same vendor.

### Partially Implemented UI
- **Dispute Resolution Flow**: When a helper taps "Can't complete this job" or "Requester unavailable", the status advances to `disputed` with recorded fronted costs. However, the helper UI provides no form to submit explanation notes or upload dispute evidence—it simply displays a static text message stating the order is in dispute.

---

## 11. Key Findings Summary

To prepare for a future Helper role UI redesign discussion, the following key findings summarize the current state:

1. **Solid State Machine Foundation**: The Helper frontend implements a robust, 10-step atomic fulfilment workflow (`assigned` → `going_to_vendor` → `at_vendor` → `food_available` → `food_purchased` → `picked_up` → `out_for_delivery` → `delivered` → `confirmed` → `completed`).
2. **Strict Financial Separation**: The UI correctly distinguishes fronted food costs (expenses paid at the stall) from delivery fees (helper earnings), preventing financial confusion.
3. **Header Chrome Redundancy**: Dual headers (native tab bar titles combined with in-screen `SectionHeader`s) waste significant vertical space on primary tabs.
4. **Card Density & Scrolling**: The job detail view places heavy emphasis on stacked border cards, pushing critical primary action buttons lower on mobile screens.
5. **Segmented Control Divergence**: `My Deliveries` and `NotificationCenter` use differing tab toggle components (`ActiveHistoryToggle` vs `SegmentedControl`).
6. **Prerequisite Payment QR Requirement**: The helper's profile Payment QR is essential for external payments; the staging and upload experience is functional but isolated within the profile tab.

*End of Audit Report.*
