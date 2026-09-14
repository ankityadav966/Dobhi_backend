# PARTNER BACKEND MASTER API DOCUMENTATION

> **Scope:** Partner-side Node.js + Express + Prisma + Socket.io backend.
> All routes are authenticated via JWT bearer tokens unless explicitly marked public.
> Token payload shape: `{ userId: string, phone: string, role: string }`
> User roles in this system: `HELPER`, `ADMIN`.

---

## Table of Contents

1. [Authentication Flow](#1-authentication-flow)
2. [Onboarding Flow](#2-onboarding-flow)
3. [Online / Offline State](#3-online--offline-state)
4. [Booking Request Flow (Dispatch Engine)](#4-booking-request-flow-dispatch-engine)
5. [Booking Lifecycle](#5-booking-lifecycle)
6. [No-Show Engine](#6-no-show-engine)
7. [Earnings & Payout Flow](#7-earnings--payout-flow)
8. [Earnings APIs](#8-earnings-apis)
9. [Helper Dashboard API](#9-helper-dashboard-api)
10. [Discipline API](#10-discipline-api)
11. [Socket Events Summary](#11-socket-events-summary)
12. [Cron Jobs Summary](#12-cron-jobs-summary)
13. [State Machines Overview](#13-state-machines-overview)

---

## 1. Authentication Flow

The authentication system is phone-number + OTP based (via MSG91). There is no separate signup; the first OTP verification auto-creates a `HELPER` account.

### Endpoints

---

#### `POST /api/auth/login`

Sends an OTP to the given phone number.  
Rate-limited: **5 requests per 15 minutes** per IP.  
The response is always the same whether the phone exists or not (prevents enumeration).

**Request body:** `{ phone: string }` — 10-digit Indian mobile number (starts with 6–9).

**What it does:**
- Validates phone format.
- Triggers OTP dispatch via MSG91.
- Emits an audit event `OTP_SENT`.
- Returns OTP expiry: **10 minutes**.

> `POST /api/auth/signup` is a legacy alias for `/login` — both behave identically.

---

#### `POST /api/auth/verify-otp`

Verifies the OTP and issues JWT tokens.  
Rate-limited: **3 requests per 30 minutes** per IP.

**Request body:** `{ phone: string, otp: string }`

**What it does:**
- Validates OTP against the stored record.
- If phone is **new**: auto-creates `User { role: HELPER, isActive: false }`.
- If phone **exists**: authenticates the existing user.
- Issues an access token (15-minute TTL) and a refresh token (7-day TTL).
- Persists a **hashed** refresh token (`SHA-256`) in `RefreshToken` table with device context (`ip`, `userAgent`, optional `x-device-id` header).
- Emits audit event `LOGIN_SUCCESS`.
- Returns `isNewUser: true` flag so the client knows to start onboarding.

**Token response:** `{ accessToken, refreshToken, expiresIn: 900, isNewUser, user: { id, phone, fullName, role, isActive } }`

---

#### `POST /api/auth/refresh-token`

Rotates the refresh token pair.  
Rate-limited: **10 requests per hour** per IP.

**Request body:** `{ refreshToken: string }`

**What it does:**
- Verifies and decodes the raw refresh token.
- Checks the in-memory blacklist — if found, all sessions for that user are **revoked** (theft detection).
- Looks up the stored hash. If expired or not found → 401.
- Deletes the old `RefreshToken` row and issues a brand-new pair.
- Blacklists the old raw token for the remainder of its TTL.

> Token rotation is **single-use**: each refresh token can only be used once.

---

#### `POST /api/auth/logout`

Revokes the current refresh token.  
Requires: valid access token in `Authorization: Bearer <token>`.

**Request body:** `{ refreshToken: string }` (optional — if missing, request still succeeds).

**What it does:**
- Deletes the `RefreshToken` record matching the token hash.
- Blacklists the raw token for remaining TTL.
- Emits audit event `LOGOUT`.
- Always returns 200 (idempotent).

---

### Middleware

**`authMiddleware`**  
Applied to all protected routes. Validates the bearer access token, rejects expired or malformed tokens, and checks if the helper's account is suspended (`User.suspendedUntil > now` → 403).

**`checkRole(...roles)`**  
Applied per-route after `authMiddleware`. Rejects requests from tokens whose role is not in the allowed list.

**`requireApprovedHelper`**  
Stronger version of auth for helper-facing booking routes. Validates auth token, confirms `User.isActive = true`, confirms `Helper.onboardingStatus = APPROVED`. Attaches `req.helper = { id, onboardingStatus, isAvailable }` for downstream use.

---

## 2. Onboarding Flow

A new partner passes through a multi-step onboarding before they can receive bookings. Each step is a separate API call. **Admin approval is the final gate.**

### Onboarding State Transitions

```
[OTP Verified] → isActive: false, onboardingStatus: PENDING_KYC
         ↓
  PUT /api/users/profile        → fullName, avatar stored; status stays PENDING_KYC
         ↓
  POST /api/users/register-helper → Helper row created; status → PENDING_KYC
         ↓
  POST /api/pan/initiate         → PAN details submitted to IDFY
  POST /api/pan/verify           → PAN verified; status → DOCUMENTS_SUBMITTED
         ↓
  POST /api/users/upload-kyc    → KYC documents uploaded (Aadhaar, etc.)
         ↓
  PUT  /api/users/bank-details  → Bank account saved in HelperBank
         ↓
  [Admin reviews and approves]
         ↓
  onboardingStatus → APPROVED, isActive → true
         ↓
  Helper may now go online and receive bookings
```

> Helpers can obtain tokens at any stage but will receive `403 FORBIDDEN` from booking routes until `onboardingStatus = APPROVED`.

---

### Endpoints

---

#### `GET /api/users/profile`

Returns the authenticated user's profile (User + Helper fields if they exist).

---

#### `PUT /api/users/profile`

Updates `fullName`, `avatar`, and extended profile fields.  
Requires: `authMiddleware`.

---

#### `POST /api/users/register-helper`

Creates the `Helper` row linked to the authenticated `User`.  
Should be called once after first OTP verification.  
Validated fields include: `fullName`, `city`, and service preferences.

---

#### `PUT /api/users/bank-details`

Saves or updates bank account details in `HelperBank` (`accountName`, `accountNumber`, `ifsc`).  
Required before the payout system will process any payment to this helper.  
Requires: `authMiddleware`.

---

#### `POST /api/users/upload-photo`

Uploads a profile photograph. Returns a stored URL.  
Requires: `authMiddleware`.

---

#### `POST /api/users/upload-kyc`

Uploads KYC identity documents (Aadhaar front/back, etc.).  
Requires: `authMiddleware`.

---

#### `POST /api/pan/initiate`

Submits PAN details to the IDFY verification service and creates a `PanVerification` record.

**Request body:** `{ panNumber: string, fullName: string, dateOfBirth: "YYYY-MM-DD" }`

**What it does:**
- Validates PAN format (`/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/`).
- Calls IDFY API to initiate PAN verification.
- Returns a `requestId` for polling / callback.

---

#### `POST /api/pan/verify`

Completes PAN verification using the IDFY callback `requestId`.

**Request body:** `{ requestId: string }`

**What it does:**
- Fetches verification result from IDFY.
- On success: updates `PanVerification.status = VERIFIED` and sets `onboardingStatus = DOCUMENTS_SUBMITTED` on the `Helper`.

---

#### `GET /api/pan/status`

Returns the current PAN verification status for the authenticated helper. Used by the client to poll during onboarding.

---

#### `GET /api/users/helper/:helperId`

Public endpoint. Returns a helper profile by numeric ID. Used for customer-facing display.

---

#### `GET /api/users/search-helpers`

Public endpoint. Search helpers by city and service category. Used for browsing / discovery.

---

## 3. Online / Offline State

The `isOnline` flag controls whether a helper appears in the dispatch pool when new booking requests are created.

### `PATCH /api/helper/status`

**Auth required:** `authMiddleware` + `checkRole(HELPER)`

**Request body:**

```json
{ "isOnline": true }
```

Or, to force offline when a job is active:

```json
{ "isOnline": false, "force": true }
```

---

### Rules

**Going ONLINE (`isOnline: true`):**

- Checks `User.suspendedUntil`. If `suspendedUntil > now`, the request is rejected with **403** and the suspension expiry timestamp.
- If the account is clear, sets `Helper.isOnline = true` and updates `lastActiveAt`.

**Going OFFLINE (`isOnline: false`):**

- Checks for any booking in `IN_PROGRESS` status for this helper.
- If one exists, rejects with **409** and returns the `activeBookingId`.
- To override this safety guard, pass `force: true` in the body.
- If clear (or `force: true`), sets `Helper.isOnline = false`.

**Response:** Returns the updated `{ id, isOnline, lastActiveAt }`.

> Helpers who are offline (`isOnline: false`) are **excluded from all dispatch queries**. They will not receive `booking:new` socket events.

---

## 4. Booking Request Flow (Dispatch Engine)

The dispatch engine connects customers to nearby helpers in a real-time, race-safe flow. The partner app interacts with the accept and reject endpoints; the create endpoint is called from the customer side.

---

### Step 1 — Customer Creates a Booking Request

#### `POST /api/booking-requests/create`

Called by the customer app. Creates and dispatches a `BookingRequest`.

**What it does:**

1. Calculates an expiry window: `now + 30 seconds`.
2. Calls `findNearbyHelpers(lat, lon, serviceId, customerId, requestedDate, estimatedHours)`:
   - Filters helpers by `isOnline: true`.
   - Filters helpers who offer the requested `serviceId` (via `HelperService` join table).
   - Filters out helpers with a conflicting booking in the same time window.
   - Uses the Haversine formula to compute distance; includes only helpers within **5 km**.
   - Returns up to **5** helpers, ranked by distance.
3. Creates the `BookingRequest` record with `status: PENDING`, `dispatchedHelperIds`, and `expiresAt`.
4. Emits `booking:new` socket event to **each dispatched helper's room** (`helper:<id>`).

---

### Socket Event — `booking:new`

**Direction:** Server → Helper client  
**Trigger:** Immediately after a `BookingRequest` is created and dispatched.

**Payload:**

```json
{
  "requestId": 42,
  "serviceId": 3,
  "location": {
    "address": "...",
    "city": "Jaipur",
    "latitude": 26.9124,
    "longitude": 75.7873
  },
  "requestedDate": "2026-02-21T10:00:00.000Z",
  "estimatedHours": 2,
  "estimatedBudget": 500.00,
  "expiresAt": "2026-02-21T10:00:30.000Z",
  "acceptanceWindowSeconds": 30
}
```

The helper app should display a timed popup and wait for the user to accept or reject.

---

### Step 2 — Helper Accepts

#### `POST /api/booking-requests/:requestId/accept`

**Auth required:** `authMiddleware` + `checkRole(HELPER)`

**Race protection:** Uses `prisma.bookingRequest.updateMany({ where: { id, status: 'PENDING' } })`. Only the **first** helper to call this succeeds; all others get `count === 0`.

**What it does (in a single `$transaction`):**

1. Loads the `BookingRequest`. Validates it exists and has not expired.
2. Checks the accepting helper for a conflicting booking in the same time window.
3. Validates `estimatedBudget > 0`.
4. **Atomic race-safe update:** Sets `status = ACCEPTED`, `helperId = acceptingHelperId`. Returns `count`.
5. If `count === 0` → another helper already won. Emits `booking:alreadyAccepted` to the losing helper and throws.
6. Creates a `Booking` record with `status: PENDING_PAYMENT` and a `paymentExpiresAt` set to **now + 5 minutes**.
7. Rejects all other `PENDING` requests from the same customer in the same transaction.
8. On success: emits `booking:closed` to all OTHER helpers in `dispatchedHelperIds`.

**Returns:** `{ bookingId, message: "Booking reserved. Awaiting payment confirmation." }`

---

### Socket Event — `booking:alreadyAccepted`

**Direction:** Server → Losing helper client  
**Trigger:** When `acceptBookingRequest` fails the race check (`count === 0`).

**Payload:**

```json
{
  "requestId": 42,
  "message": "This booking was accepted by another helper."
}
```

---

### Socket Event — `booking:closed`

**Direction:** Server → All dispatched helpers **except** the winner  
**Trigger:** Immediately after a helper successfully accepts a booking request.

**Payload:**

```json
{
  "requestId": 42,
  "reason": "accepted_by_another",
  "message": "This booking request was accepted by another helper."
}
```

---

### Step 3 — Helper Rejects

#### `POST /api/booking-requests/:requestId/reject`

**Auth required:** `authMiddleware` + `checkRole(HELPER)` 

**Request body:** `{ reason?: string }` (max 200 chars)

**What it does:**
- Validates that the request is still `PENDING` and has not expired.
- Marks the helper's rejection and records the reason.
- Triggers automatic **redispatch** to the next eligible helper from `dispatchedHelperIds`, if the window has not expired.
- Does NOT apply a discipline strike; a separate ignore-tracking system handles unresponsiveness.

---

### Step 4 — Expiry Cron

**Cron:** `processExpiredRequests` — runs every **5 seconds**.

**What it does:**

1. Finds all `BookingRequest` records where `status = PENDING` and `expiresAt < now`.
2. Batch-updates them to `status = EXPIRED`.
3. For each expired request where no helper accepted (`helperId = null`), records an **ignore** discipline event (`recordIgnore`) for every helper in `dispatchedHelperIds`.
4. Emits `booking:expired` to each dispatched helper via socket.

---

### Socket Event — `booking:expired`

**Direction:** Server → All dispatched helpers  
**Trigger:** When the expiry cron transitions a `BookingRequest` to `EXPIRED`.

**Payload:**

```json
{
  "requestId": 42,
  "message": "This booking request has expired."
}
```

---

### Helper Polling Endpoints

#### `GET /api/booking-requests/helper/pending`

Returns all `PENDING` requests in `dispatchedHelperIds` for the authenticated helper that have not yet expired. Used as a fallback if the socket connection was lost.

**Auth required:** `authMiddleware` + `checkRole(HELPER)`

---

#### `GET /api/booking-requests/:requestId/status`

Returns the current status of a specific request. Accessible by both auth helper and customer.

---

#### `GET /api/booking-requests/customer/history`

Returns all booking requests created by a customer, filterable by status.

---

## 5. Booking Lifecycle

Once a `Booking` is created (by the accept flow), it passes through a strict state machine. Only authorised parties may trigger each transition.

### Status Transition Flow

```
PENDING_PAYMENT
    │
    │  (Payment confirmed by webhook / Razorpay callback)
    ▼
CONFIRMED
    │
    │  (Helper calls startBooking)
    ▼
IN_PROGRESS
    │
    │  (Helper calls completeBooking)
    ▼
COMPLETED ──── triggers commission snapshot + payout hold
    │
CANCELLED (from any state before IN_PROGRESS, under applicable rules)
```

---

### `confirmBooking(bookingId)`

**Trigger:** Called internally by the Razorpay payment webhook after payment is captured.

**Transition:** `PENDING_PAYMENT → CONFIRMED`

**Guards:**
- Payment record must exist for this booking.
- Payment status must be `PENDING` (i.e. captured but not yet confirmed).
- **Race-safe:** Uses `updateMany({ where: { id, status: PENDING_PAYMENT } })`. If `count === 0`, the booking was already confirmed or cancelled.

**Side effects:** Booking becomes scheduled and visible to the helper.

---

### `startBooking(bookingId, helperId)`

**Trigger:** Helper manually calls this endpoint when they arrive on-site.

**Transition:** `CONFIRMED → IN_PROGRESS`

**Guards:**
- Validates the booking exists.
- Validates `helperId` matches `booking.helperId` (only the assigned helper may start).
- Status must be `CONFIRMED`.
- Sets `startedAt = now`.

---

### `completeBooking(bookingId, helperId)`

**Trigger:** Helper calls this when the service is finished.

**Transition:** `IN_PROGRESS → COMPLETED`

**Guards:**
- Validates helper ownership.
- Status must be `IN_PROGRESS`.
- Sets `completedAt = now`.

**Commission snapshot (frozen at this moment):**
- Fetches the current commission rate from `PlatformSetting`.
- Calculates and stores three frozen values on the `Booking` row:
  - `commissionRateSnapshot` — rate used for this booking.
  - `platformCommissionAmount` — platform's cut.
  - `helperPayoutAmount` — amount the helper will receive.
- These values **never change** after completion. The payout system reads from these fields, not from a live rate.

**Payout hold:**
- Sets `payoutStatus = PENDING`.
- Sets `payoutEligibleAt = now + 2 hours`.
- Escrow transitions to `RELEASED`.

---

### `cancelBooking(bookingId)`

**Trigger:** Customer or platform cancellation.

**Business rules:**
- Allowed from `PENDING_PAYMENT` or `CONFIRMED` status only.
- If payment exists, a refund is issued (payment escrow set to `REFUNDED`).
- Cannot cancel after `IN_PROGRESS`.

---

### `helperCancelBooking(bookingId, helperId, reason)`

**Trigger:** Helper voluntarily cancels.

**Guards:**
- Only the assigned helper may cancel (`booking.helperId === helperId`).
- Cannot cancel from `IN_PROGRESS`, `COMPLETED`, or already `CANCELLED`.

**Stricter rules depending on current status:**

| Status | Strike Applied | Refund |
|---|---|---|
| `PENDING_PAYMENT` | No strike | Refund if payment exists |
| `CONFIRMED`, ≥ 2 hours before start | +1 strike | Full refund |
| `CONFIRMED`, < 2 hours before start | +2 strikes | Full refund |

**Strike threshold → Suspension:**
- If `strikeCount >= 3` after applying strikes → `User.suspendedUntil = now + 24 hours`.
- The strike count, `lastStrikeAt`, and optional `suspendedUntil` are all updated in a single atomic `$transaction`.
- **Race-safe:** Booking status update uses `updateMany({ where: { id, status: CONFIRMED } })`.
- Cannot cancel after the scheduled `startTime` has passed.

**Returns:** `{ success, message, suspended?, suspendedUntil? }`

---

### Helper Booking Queries

#### `GET /api/bookings/helper/bookings`

Returns all bookings assigned to the authenticated, approved helper.  
**Auth required:** `requireApprovedHelper`

---

#### `GET /api/bookings/:bookingId`

Returns a single booking by ID. Validates `bookingId` format.

---

## 6. No-Show Engine

The no-show engine automatically detects helpers who fail to start a confirmed booking on time.

### Detection Logic

**Cron:** `autoCancelNoShowBookings` — runs every **2 minutes**.

A no-show is detected when:

- `Booking.status = CONFIRMED`
- `Booking.bookingDate < now - 30 minutes` (30-minute grace period after scheduled start)
- `Booking.startedAt = null` (helper never called `startBooking`)

### Actions Taken (in a single `$transaction`)

1. Transitions booking: `CONFIRMED → CANCELLED` with reason `"No-show: Helper did not start booking within 30 minutes"`.
2. Full refund: sets `Payment.status = REFUNDED`, `Payment.escrowStatus = REFUNDED`.
3. Records no-show discipline: calls `recordNoShow(helperId)`.

### Discipline — `recordNoShow`

- Increments `Helper.noShowCount`.
- **Threshold check:** If `noShowCount >= 2`, applies a **48-hour suspension** on `User.suspendedUntil`.
- The suspension check is evaluated against the lifetime `noShowCount` counter.

### Additional Suspension Triggers (via `helper-discipline.service`)

| Violation | Threshold | Window | Suspension Duration |
|---|---|---|---|
| No-show | 2 | Lifetime count | 48 hours |
| Cancellation by helper | 3 | 7 days | 24 hours |
| Penalty (8h timeout) | 3 | 30 days | 72 hours |
| Ignored requests | 3 | 24 hours | 2 hours |

---

## 7. Earnings & Payout Flow

### Commission Snapshot Architecture

When `completeBooking` is called, three values are **frozen** onto the `Booking` row:

- `commissionRateSnapshot` — the platform commission percentage at the time of completion (read from `PlatformSetting`).
- `platformCommissionAmount` — computed as `totalAmount × commissionRateSnapshot / 100`.
- `helperPayoutAmount` — computed as `totalAmount - platformCommissionAmount`.

Once frozen, these values are immutable. Even if an admin changes the commission rate afterwards, completed bookings are unaffected.

---

### Payout Hold

After `completeBooking`:

- `Booking.payoutStatus` is set to `PENDING`.
- `Booking.payoutEligibleAt` is set to `now + 2 hours`.

The payout cron will not process this booking until `payoutEligibleAt` has elapsed.

---

### Payout State Machine

```
PENDING
   │
   │  (Cron acquires lock)
   ▼
PROCESSING
   │          │
   ▼          ▼
  PAID      FAILED   ← permanent error
             │
             ▼
           PENDING   ← transient error: reverted for retry
```

---

### `processPendingPayouts` — Cron (every 5 minutes)

**This function is production-grade concurrency-safe.**

Steps for each eligible booking:

1. **Eligibility filter:** `status = COMPLETED`, `payoutStatus = PENDING`, `payoutEligibleAt <= now`.
2. **Lock acquisition (race-safe):** `updateMany({ where: { id, payoutStatus: PENDING }, data: { payoutStatus: PROCESSING } })`. If `count === 0`, another cron instance already locked it — skip.
3. **Pre-flight validations:**
   - Payment record exists with `status = captured` and `escrowStatus = LOCKED`.
   - `HelperBank` record exists (account number + IFSC).
   - `helperPayoutAmount > 0`.
4. **Dispatches payout via Razorpay API** (currently stubbed — replace with `razorpay.payouts.create` in production). Uses `bookingId` as the idempotency key.
5. **On success:** Atomic `$transaction`: sets `payoutStatus = PAID`, stores `payoutId` and `payoutAt`, releases escrow to `RELEASED`.
6. **On transient error** (network, 429, 5xx): Reverts `payoutStatus` back to `PENDING` for retry.
7. **On permanent error** (400, rejected): Sets `payoutStatus = FAILED`.

---

### Escrow Release Timing

| Event | Escrow State |
|---|---|
| Booking created | `LOCKED` |
| Booking completed | `LOCKED` (still holds during 2-hour window) |
| Payout successfully transmitted | `RELEASED` |
| Booking cancelled (any reason) | `REFUNDED` |

---

## 8. Earnings APIs

All endpoints require `authMiddleware` + `checkRole(HELPER)`.  
Base path: `/api/helper/earnings`

---

#### `GET /api/helper/earnings/summary`

Returns aggregated earnings across four time windows.

**Response structure:**

```json
{
  "success": true,
  "data": {
    "today": { "count": 2, "gross": 1200.00, "payout": 1020.00 },
    "thisWeek": { "count": 8, "gross": 4800.00, "payout": 4080.00 },
    "thisMonth": { "count": 32, "gross": 19200.00, "payout": 16320.00 },
    "allTime": { "count": 120, "gross": 72000.00, "payout": 61200.00 }
  }
}
```

- `gross` = `totalAmount` (full booking value).
- `payout` = `helperPayoutAmount` (earnings after commission deduction).
- Only `COMPLETED` bookings are included.
- Commission deduction uses the frozen `helperPayoutAmount` snapshot from each booking, not a live rate.

---

#### `GET /api/helper/earnings/history`

Returns a paginated list of completed bookings with earnings detail.

**Query params:** `?page=1&limit=20`

**Response:** Array of `{ bookingId, bookingDate, totalAmount, helperPayoutAmount, payoutStatus, payoutAt, serviceId, address }` sorted by `completedAt` descending.

---

#### `GET /api/helper/earnings/:bookingId`

Returns full payout detail for a single completed booking.

**Response includes:**
- Booking metadata (date, address, service, hours, total).
- Commission breakdown: `commissionRateSnapshot`, `platformCommissionAmount`, `helperPayoutAmount`.
- Payout state: `payoutStatus`, `payoutAt`, `payoutId` (Razorpay ID).
- Escrow state: `escrowStatus`.

---

## 9. Helper Dashboard API

#### `GET /api/helper/dashboard`

**Auth required:** `authMiddleware` + `checkRole(HELPER)`

Returns a **single unified operational snapshot** for the helper home screen. All data is fetched in parallel with `Promise.all` — one HTTP call replaces seven separate queries.

**What is aggregated:**

| Section | Source | Description |
|---|---|---|
| `helper` | `Helper` table | `id`, `name`, `avatar`, `isOnline`, `isAvailable`, `lastActiveAt`, `rating`, `totalRatings`, `onboardingStatus` |
| `suspension` | `User.suspendedUntil` | `isSuspended` flag + expiry timestamp if active |
| `discipline` | `Helper` counters | `strikeCount`, `noShowCount`, `cancelCount` as a summary |
| `activeBooking` | `Booking` where `status = IN_PROGRESS` | Currently running job (null if none) |
| `upcomingBooking` | `Booking` where `status = CONFIRMED`, `startTime > now` | Next scheduled job (null if none) |
| `pendingRequestsCount` | `BookingRequest` count | PENDING requests in `dispatchedHelperIds` that haven't expired |
| `completedToday` | `Booking` count | Jobs completed since midnight today |
| `earnings` | `getEarningsSummary()` | Today / week / month / all-time payouts |

**Response:** `{ success: true, data: { helper, suspension, discipline, activeBooking, upcomingBooking, pendingRequestsCount, completedToday, earnings } }`

---

## 10. Discipline API

#### `GET /api/helper/discipline`

**Auth required:** `authMiddleware` + `checkRole(HELPER)`

Returns the full discipline record for the authenticated helper. Intended for the "My Account" / warnings screen.

**Response structure:**

```json
{
  "success": true,
  "data": {
    "counts": {
      "strikes": 1,
      "noShows": 0,
      "cancelledByHelper": 2,
      "ignoredRequests": 1,
      "penalties": 0
    },
    "lastStrikeAt": "2026-02-20T14:30:00.000Z",
    "suspension": {
      "isSuspended": false,
      "suspendedUntil": null,
      "remainingMs": 0,
      "remainingHours": 0
    },
    "recentCancelledBookings": [
      {
        "id": 88,
        "status": "CANCELLED",
        "cancelReason": "...",
        "updatedAt": "...",
        "startTime": "..."
      }
    ]
  }
}
```

**Fields explained:**

- `strikes` — voluntary cancellations with penalty weight (+1 or +2 per cancel).
- `noShows` — missed starts detected by the no-show cron.
- `cancelledByHelper` — total bookings cancelled by this helper.
- `ignoredRequests` — booking requests expired without this helper responding.
- `penalties` — stale in-progress bookings timed out by the 8-hour cron.
- `suspension.remainingHours` — ceiling of remaining suspension in hours (0 if not suspended).
- `recentCancelledBookings` — last 10 bookings this helper cancelled, for reference.

---

## 11. Socket Events Summary

All socket connections require JWT authentication via the `auth` handshake:

```json
{ "auth": { "token": "Bearer <accessToken>" } }
```

The server resolves `Helper.id` from the JWT, then joins the socket to room `helper:<id>`. All events below are emitted to a helper's private room.

| Event | Direction | Trigger | Sent To | Purpose |
|---|---|---|---|---|
| `booking:new` | Server → Client | New `BookingRequest` dispatched | All helpers in `dispatchedHelperIds` | Notify helper of incoming job opportunity |
| `booking:closed` | Server → Client | Another helper accepted the request | All dispatched helpers **except** the winner | Tell helpers the request is no longer available |
| `booking:alreadyAccepted` | Server → Client | Helper loses accept race (`count === 0`) | The losing helper only | Immediate feedback that they were too slow |
| `booking:expired` | Server → Client | Expiry cron finds `PENDING` request past `expiresAt` | All helpers in `dispatchedHelperIds` | Dismiss the pending popup on client |
| `pong` | Server → Client | Helper sends `ping` event | Sending helper | Connection health check response |

---

## 12. Cron Jobs Summary

All cron jobs are initialised at server start via `initializeCronJobs()` in `src/tasks/expiry-cronjob.ts`. They stop cleanly on `SIGINT` / `SIGTERM`.

| Cron Name | Function | Runs Every | Purpose |
|---|---|---|---|
| `processExpiredRequests` | `booking-dispatch.service` | **5 seconds** | Marks `PENDING` booking requests as `EXPIRED` when `expiresAt < now`; records ignore discipline; emits `booking:expired` |
| `processPaymentExpirations` | `booking-dispatch.service` | **5 seconds** | Cancels `PENDING_PAYMENT` bookings where `paymentExpiresAt < now` (5-minute payment window) |
| `autoCancelNoShowBookings` | `noShowAutoCancel.service` | **2 minutes** | Cancels `CONFIRMED` bookings not started within 30 minutes of `bookingDate`; full refund; records no-show discipline |
| `autoCancelInactiveConfirmedBookings` | `booking-lifecycle.service` | **5 minutes** | Cancels `CONFIRMED` bookings created more than 30 minutes ago that are still awaiting payment (belt-and-suspenders alongside 5-second payment cron) |
| `autoCancelStaleInProgressBookings` | `inProgressTimeout.service` | **5 minutes** | Cancels `IN_PROGRESS` bookings exceeding an **8-hour timeout**; applies penalty discipline to helper |
| `processPendingPayouts` | `payout.service` | **5 minutes** | Processes `PENDING` payouts where `payoutEligibleAt <= now`; concurrency-safe via `PROCESSING` lock; calls Razorpay payout API |

---

## 13. State Machines Overview

### BookingRequest States

```
PENDING   — Created, dispatched, awaiting a helper to accept within the window
ACCEPTED  — A helper won the acceptance race; Booking row created
REJECTED  — All dispatched helpers rejected (or redispatch exhausted)
EXPIRED   — expiresAt passed without acceptance; set by cron
CANCELLED — Customer or system cancelled before dispatch completed
```

---

### Booking States

```
PENDING_PAYMENT  — Created by accept flow; awaiting Razorpay capture (5-min limit)
CONFIRMED        — Payment captured; job scheduled; helper must arrive on time
IN_PROGRESS      — Helper called startBooking; service is underway
COMPLETED        — Helper called completeBooking; commission snapshot frozen; payout hold started
CANCELLED        — Can occur from PENDING_PAYMENT or CONFIRMED only; full refund issued
```

---

### Payout Status (on `Booking.payoutStatus`)

```
PENDING     — Default after completion; waiting for 2-hour hold to elapse
PROCESSING  — Cron acquired lock; payout API call in-flight
PAID        — Razorpay payout transmitted; escrow released; payoutId stored
FAILED      — Permanent payout failure (e.g. invalid bank details)
CANCELLED   — Booking was cancelled; no payout will occur
```

---

### Suspension Logic

Suspensions are stored on `User.suspendedUntil` (datetime).  
`authMiddleware` and `toggleOnlineStatus` both check this field before allowing access.

A suspension is **active** when: `User.suspendedUntil != null AND User.suspendedUntil > now`.

| Trigger | Duration |
|---|---|
| `strikeCount >= 3` (via helperCancelBooking) | 24 hours |
| `noShowCount >= 2` (via recordNoShow) | 48 hours |
| 3+ cancellations in 7 days (via recordCancellation) | 24 hours |
| 3+ ignored requests in 24 hours (via recordIgnore) | 2 hours |
| 3+ penalties in 30 days (via inProgressTimeout cron) | 72 hours |

Multiple suspensions do **not** stack — each trigger independently sets a new `suspendedUntil` datetime.

A suspended helper:
- Cannot authenticate past `authMiddleware` (403 returned).
- Cannot toggle `isOnline = true` (403 returned from `/api/helper/status`).
- Receives suspension details (`suspendedUntil`) in both error responses.
