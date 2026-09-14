# PROJECT API FLOW — Zynexx Partner Backend

> **Architecture:** Modular Monolith · Express + TypeScript · Prisma ORM (PostgreSQL)
> **Dispatch Model:** Uber-style — customers create `BookingRequest`, system dispatches to nearby helpers in real-time.
> **Roles:** `CUSTOMER`, `HELPER`, `ADMIN`

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Authentication Flow](#2-authentication-flow)
3. [Status Enums & Definitions](#3-status-enums--definitions)
4. [Booking Lifecycle & State Machine](#4-booking-lifecycle--state-machine)
5. [API Endpoints Reference](#5-api-endpoints-reference)
   - [Auth](#51-auth--apiauth)
   - [User (Customer)](#52-user-customer--apiuser)
   - [Partner (Helper)](#53-partner-helper--apipartner)
   - [Admin](#54-admin--apiadmin)
   - [Booking Requests](#55-booking-requests--apibooking-requests)
   - [Payments](#56-payments--apipayments)
   - [Ratings](#57-ratings--apiratings)
   - [Services](#58-services--apiservices)
   - [Webhook](#59-webhook--webhook)
6. [Ownership & Role Guards](#6-ownership--role-guards)
7. [Internal Service Map](#7-internal-service-map)
8. [Module Structure](#8-module-structure)

---

## 1. System Overview

```
Customer App                 Backend (Express)               Helper App
     │                             │                              │
     │  POST /api/booking-requests/create                        │
     │──────────────────────────►  │                              │
     │                             │  booking-dispatch.service    │
     │                             │  → find nearby helpers       │
     │                             │  → emit socket event ───────►│
     │                             │                              │
     │                             │◄── POST /:requestId/accept ──│
     │                             │                              │
     │                             │  BookingRequest ACCEPTED     │
     │                             │  Booking created at          │
     │                             │  PENDING_PAYMENT             │
     │◄──────────────────────────  │                              │
     │                             │                              │
     │  POST /api/payments/initiate│                              │
     │──────────────────────────►  │                              │
     │◄── Razorpay order details ──│                              │
     │                             │                              │
     │  [User pays via Razorpay SDK]                              │
     │                             │                              │
     │  POST /webhook/razorpay     │                              │
     │──────────────────────────►  │  payment.captured            │
     │                             │  → Booking CONFIRMED         │
     │                             │  → notify helper ───────────►│
```

**Key invariants:**
- A `Booking` is only created after a `BookingRequest` is accepted (ACID transaction).
- Payment transition (`PENDING_PAYMENT → CONFIRMED`) is driven by the Razorpay webhook.
- There are no dead-letter legacy states (`CREATED`, `REQUESTED` were removed).

---

## 2. Authentication Flow

### Token model
- **Access token:** Short-lived JWT (`userId`, `role` in payload). Sent as `Authorization: Bearer <token>`.
- **Refresh token:** Long-lived JWT stored server-side. Used only at `/api/auth/refresh-token`.
- **Blacklist:** Refresh tokens are blacklisted on logout (Redis-backed).

### Step-by-step

```
1. POST /api/auth/signup        — register phone, send OTP
2. POST /api/auth/verify-otp   — verify OTP → returns { accessToken, refreshToken }

   --- or for helpers ---

1. POST /api/auth/login         — existing user login by phone, send OTP
2. POST /api/auth/helper/verify-otp
                                — verify OTP, auto-creates User + Helper records if absent
                                  → returns { accessToken, refreshToken }
                                  NOTE: Does NOT mutate role. Role is capability-based.

3. POST /api/auth/refresh-token — rotate access token; requires valid refresh token
4. POST /api/auth/logout        — blacklists refresh token; requires Bearer access token
```

### Rate limits

| Endpoint | Limit |
|---|---|
| `/signup` | 5 req / day / IP |
| `/login` | 5 req / 15 min / IP |
| `/verify-otp`, `/helper/verify-otp` | 3 req / 30 min / IP |
| `/refresh-token` | 10 req / hour / IP |

---

## 3. Status Enums & Definitions

### `BookingStatus` (Prisma enum)

| Value | Description |
|---|---|
| `PENDING_PAYMENT` | Booking created after request accepted; awaiting customer payment |
| `AWAITING_PAYMENT` | Payment initiated but not yet confirmed by webhook |
| `CONFIRMED` | Payment captured by webhook; helper notified to start |
| `IN_PROGRESS` | Helper has started the job on-site |
| `COMPLETED` | Job finished; commission snapshot recorded |
| `CANCELLED` | Cancelled by customer, helper, or system |
| `EXPIRED` | Payment window elapsed without capture |
| `NO_SHOW` | Helper or customer did not show up |

> **Removed (legacy):** `CREATED`, `REQUESTED` — no longer exist in schema or DB.

### `BookingRequest` status (string field)

| Value | Triggered by |
|---|---|
| `PENDING` | Just created / dispatched |
| `ACCEPTED` | Helper accepted within 10s window |
| `REJECTED` | Helper explicitly rejected |
| `EXPIRED` | 10s acceptance window elapsed, cron processed |
| `CANCELLED` | Customer or system cancelled before acceptance |

### `OnboardingStatus` (Helper)

| Value | Description |
|---|---|
| `PENDING_KYC` | Helper registered; KYC not yet submitted |
| `PENDING_APPROVAL` | KYC submitted; awaiting admin review |
| `APPROVED` | Admin approved; helper can go online |
| `REJECTED` | Admin rejected onboarding |

### `PaymentStatus`

| Value | Description |
|---|---|
| `PENDING` | Order created, payment not initiated |
| `INITIATED` | Payment flow started |
| `COMPLETED` | Webhook confirmed `payment.captured` |
| `FAILED` | Webhook reported `payment.failed` |
| `REFUNDED` | Admin-issued refund processed |

---

## 4. Booking Lifecycle & State Machine

### BookingRequest FSM

```
                    ┌─────────┐
        POST /create│         │
        ────────────► PENDING ├──── 10s window ────► EXPIRED (cron)
                    │         │
                    └────┬────┘
                         │
            POST /:id/accept (Helper)
                         │
                    ┌────▼────┐
                    │ ACCEPTED│ ── creates Booking at PENDING_PAYMENT
                    └─────────┘
                         │
            POST /:id/reject (Helper)
                         │
                    ┌────▼────┐
                    │REJECTED │ ── system re-dispatches if time permits
                    └─────────┘
```

### Booking FSM

```
PENDING_PAYMENT
      │
      │  POST /api/payments/initiate
      ▼
AWAITING_PAYMENT
      │
      │  POST /webhook/razorpay  (payment.captured)
      ▼
 CONFIRMED ──── POST /api/partner/bookings/:id/start ──► IN_PROGRESS
                                                               │
                                                POST /api/partner/bookings/:id/complete
                                                               │
                                                          COMPLETED
                                                 (commission snapshot recorded)

At any CONFIRMED/IN_PROGRESS state:
  Customer:  POST /api/user/bookings/:id/cancel     → CANCELLED
  Helper:    helperCancelBooking() (with strike)    → CANCELLED
  System:    noShowAutoCancel cron                  → NO_SHOW
  Cron:      processPaymentExpirations()            → EXPIRED (if PENDING_PAYMENT elapsed)
```

---

## 5. API Endpoints Reference

### 5.1 Auth — `/api/auth`

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| `POST` | `/signup` | ✗ | Any | Register phone number, sends OTP |
| `POST` | `/login` | ✗ | Any | Login by phone, sends OTP |
| `POST` | `/verify-otp` | ✗ | Any | Verify OTP → returns `{ accessToken, refreshToken }` |
| `POST` | `/helper/verify-otp` | ✗ | Any | Helper OTP verify; creates User+Helper if absent |
| `POST` | `/refresh-token` | ✗ | Any | Rotate access token using refresh token |
| `POST` | `/logout` | ✓ Bearer | Any | Blacklist refresh token, invalidate session |

**Request body — `/signup` & `/login`:**
```json
{ "phone": "9876543210" }
```

**Request body — `/verify-otp` & `/helper/verify-otp`:**
```json
{ "phone": "9876543210", "otp": "123456" }
```

---

### 5.2 User (Customer) — `/api/user`

#### Profile

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/profile` | ✓ Bearer | Get current user's profile |
| `PUT` | `/profile` | ✓ Bearer | Update profile (name, address, etc.) |
| `POST` | `/register-helper` | ✓ Bearer | Register current user as a helper |
| `PUT` | `/bank-details` | ✓ Bearer | Update bank account details |
| `POST` | `/upload-photo` | ✓ Bearer | Upload profile photo |
| `POST` | `/upload-kyc` | ✓ Bearer | Upload KYC documents |
| `GET` | `/helper/:helperId` | ✗ | Get public helper profile |
| `GET` | `/search-helpers` | ✗ | Search available helpers |

#### Customer Bookings — `/api/user/bookings`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | ✓ Bearer | List customer's own bookings (paginated). Query: `?status=&page=&limit=` |
| `GET` | `/:bookingId` | ✓ Bearer | Get single booking detail |
| `POST` | `/:bookingId/cancel` | ✓ Bearer | Cancel a booking (ownership + status enforced) |

**Ownership guard:** Customer can only view/cancel their own bookings.

**Cancel preconditions:** Booking must be in `CONFIRMED` status (not already `CANCELLED`, `COMPLETED`, `IN_PROGRESS`, etc.)

---

### 5.3 Partner (Helper) — `/api/partner`

#### Onboarding — `/api/partner/onboarding`

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/status` | ✓ Bearer | HELPER | Get current onboarding status |
| `POST` | `/profile` | ✓ Bearer | HELPER | Submit professional profile |
| `POST` | `/kyc` | ✓ Bearer | HELPER | Submit KYC documents |
| `POST` | `/bank` | ✓ Bearer | HELPER | Submit bank account for payouts |

#### Operational — `/api/partner`

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| `PATCH` | `/status` | ✓ Bearer | HELPER | Toggle online/offline. Body: `{ isOnline: boolean, force?: boolean }` |
| `GET` | `/dashboard` | ✓ Bearer | HELPER | Unified operational snapshot (identity, active job, earnings, discipline) |
| `GET` | `/discipline` | ✓ Bearer | HELPER | Discipline record (strikes, no-shows, cancels, penalties) |

> `force: true` in PATCH `/status` allows going offline even when a job is `IN_PROGRESS`.

#### Helper Bookings — `/api/partner/bookings`

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/` | ✓ Approved Helper | HELPER | Helper's assigned bookings (paginated). Query: `?status=&page=&limit=` |
| `GET` | `/:bookingId` | ✓ Bearer | HELPER | Single booking detail |

> `GET /` requires `requireApprovedHelper` — helper must be `APPROVED` and have a valid token.

#### Earnings — `/api/partner/earnings`

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/summary` | ✓ Bearer | HELPER | Aggregated earnings summary |
| `GET` | `/history` | ✓ Bearer | HELPER | Paginated earnings history |
| `GET` | `/:bookingId` | ✓ Bearer | HELPER | Earnings detail for a specific booking |

#### Jobs — `/api/partner/jobs`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/user/jobs` | ✓ Bearer | Get jobs for the authenticated user (**static route — declared before `/:jobId`**) |
| `POST` | `/` | ✓ Bearer | Create job details |
| `GET` | `/:jobId` | ✗ | Get job details by ID |
| `GET` | `/` | ✗ | List all jobs |
| `PUT` | `/:jobId` | ✓ Bearer | Update job details |
| `DELETE` | `/:jobId` | ✓ Bearer | Delete job details |

#### Location — `/api/partner/location`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/update` | Approved Helper | Update helper's real-time location |
| `GET` | `/route/:bookingId` | ✓ Bearer | Get real-time route for a booking |
| `GET` | `/current/:bookingId` | ✓ Bearer | Get current location snapshot |
| `GET` | `/history/:userId` | ✓ Bearer | Get location history for a user |
| `GET` | `/check-range/:bookingId` | ✓ Bearer | Check if helper is in service range |
| `GET` | `/stream/:bookingId` | ✓ Bearer | SSE/stream live location updates |

#### PAN Verification — `/api/partner/pan`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/initiate` | (route-level) | Initiate PAN KYC. Body: `{ panNumber, fullName, dateOfBirth (YYYY-MM-DD) }` |
| `POST` | `/verify` | (route-level) | Verify PAN with IDfy. Body: `{ requestId }` |
| `GET` | `/status` | (route-level) | Get current PAN verification status |

---

### 5.4 Admin — `/api/admin`

All admin routes require `Authorization: Bearer <adminToken>` **and** `ADMIN` role.

#### Commission Settings

| Method | Path | Description |
|---|---|---|
| `GET` | `/settings/commission` | Read current platform commission rate |
| `PUT` | `/settings/commission` | Update commission rate (0 ≤ rate ≤ 0.50) |

#### Helper Onboarding Approval

| Method | Path | Description |
|---|---|---|
| `POST` | `/onboarding/approve/:helperId` | Approve a helper's onboarding (sets `APPROVED`) |
| `POST` | `/onboarding/reject/:helperId` | Reject a helper's onboarding (sets `REJECTED`) |

---

### 5.5 Booking Requests — `/api/booking-requests`

All routes require `Authorization: Bearer <token>`.

| Method | Path | Role | Description |
|---|---|---|---|
| `POST` | `/create` | Any (Customer) | Create & dispatch a booking request to nearby helpers |
| `POST` | `/:requestId/accept` | HELPER | Accept a dispatched request (within 10s window) |
| `POST` | `/:requestId/reject` | HELPER | Reject a request (system may re-dispatch) |
| `GET` | `/:requestId/status` | Any (Customer or assigned Helper) | Get request status |
| `GET` | `/helper/pending` | HELPER | View all pending requests dispatched to this helper |
| `GET` | `/customer/history` | Any (Customer) | Customer's booking request history |

**Request body — `POST /create`:**
```json
{
  "serviceId": "uuid",
  "address": "123 Main Street",
  "city": "Mumbai",
  "pinCode": "400001",
  "latitude": 19.076090,
  "longitude": 72.877426,
  "estimatedHours": 2,
  "estimatedBudget": 500.00,        // optional
  "description": "...",             // optional, max 500 chars
  "specialRequirements": "...",     // optional, max 300 chars
  "requestedTime": "14:30"          // optional, HH:MM format
}
```

**Dispatch behavior:**
- System uses `booking-dispatch.service` to find nearby approved helpers.
- Each request has a **10-second acceptance window** per cycle.
- If no helper accepts, the request is re-dispatched or marked `EXPIRED` by cron every 5s.

---

### 5.6 Payments — `/api/payments`

All routes require `Authorization: Bearer <token>`.

| Method | Path | Role | Description |
|---|---|---|---|
| `POST` | `/create-order` | Any | Create Razorpay order for a booking |
| `POST` | `/initiate` | Any | Initiate payment flow (transitions Booking to `AWAITING_PAYMENT`) |
| `POST` | `/verify` | Any | Verify payment signature client-side |
| `GET` | `/:paymentId` | Any | Get payment details by ID |
| `GET` | `/` | Any | Get payment history for authenticated user |
| `POST` | `/:paymentId/refund` | **ADMIN only** | Issue refund for a payment |

**Flow:**
1. Customer calls `POST /api/payments/create-order` → gets Razorpay `orderId`.
2. Customer completes payment in Razorpay SDK.
3. `POST /webhook/razorpay` fires → `payment.captured` event → Booking moves to `CONFIRMED`.

---

### 5.7 Ratings — `/api/ratings`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/` | ✓ Bearer | Create a rating for a completed booking |
| `GET` | `/service/:serviceId` | ✗ | Get all ratings for a service |
| `GET` | `/helper/:helperId` | ✗ | Get all ratings for a helper |
| `GET` | `/stats/:helperId` | ✗ | Get aggregated rating stats for a helper |
| `PUT` | `/:ratingId` | ✓ Bearer | Update an existing rating |
| `DELETE` | `/:ratingId` | ✓ Bearer | Delete a rating |

---

### 5.8 Services — `/api/services`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/` | ✓ Bearer | Create a new service listing |
| `GET` | `/:serviceId` | ✗ | Get service by ID |
| `GET` | `/` | ✗ | List all services |
| `GET` | `/helper/:helperId` | ✗ | Get services offered by a specific helper |
| `PUT` | `/:serviceId` | ✓ Bearer | Update a service |
| `DELETE` | `/:serviceId` | ✓ Bearer | Delete a service |

---

### 5.9 Webhook — `/webhook`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/razorpay` | Signature (HMAC-SHA256) | Razorpay payment event webhook |

**Security:** Raw body is preserved (no JSON parsing). Signature is verified against `RAZORPAY_WEBHOOK_SECRET` using HMAC-SHA256 before any processing.

**Events handled:**
- `payment.captured` → calls `confirmBooking(bookingId)` → Booking moves to `CONFIRMED`
- `payment.failed` → marks Booking as `EXPIRED` / payment as `FAILED`
- Other events → `200 OK` with no-op (Razorpay requires 200 within 5s)

---

## 6. Ownership & Role Guards

### Middleware guards

| Guard | Behaviour |
|---|---|
| `authMiddleware` | Validates Bearer JWT; attaches `req.user = { userId, role }` |
| `checkRole(UserRole.HELPER)` | Rejects non-HELPER tokens with 403 |
| `checkRole(UserRole.ADMIN)` | Rejects non-ADMIN tokens with 403 |
| `requireApprovedHelper` | `authMiddleware` + HELPER role + `onboardingStatus === APPROVED` |

### Booking ownership rules

| Route | Who can call | Server-side check |
|---|---|---|
| `GET /api/user/bookings` | Customer | Returns only `customerId === req.user.userId` |
| `GET /api/user/bookings/:id` | Customer | Booking must belong to customer |
| `POST /api/user/bookings/:id/cancel` | Customer | `customerId === req.user.userId` + status guard |
| `GET /api/partner/bookings` | Helper | Returns only `helperId === req.user.userId` |
| `GET /api/partner/bookings/:id` | Helper | No ownership check in route (validated in service) |
| `POST /api/booking-requests/:id/accept` | HELPER | Non-expired request dispatched to this helper |
| `POST /api/booking-requests/:id/reject` | HELPER | Non-expired request dispatched to this helper |

---

## 7. Internal Service Map

```
src/services/
  ├── booking-dispatch.service.ts   — createAndDispatchBookingRequest, acceptBookingRequest,
  │                                    rejectBookingRequest, processExpiredRequests,
  │                                    processPaymentExpirations, getBookingRequestStatus
  │
  ├── booking-lifecycle.service.ts  — confirmBooking, startBooking, completeBooking,
  │                                    cancelBooking, helperCancelBooking,
  │                                    getBookingLifecycleStatus
  │
  ├── src/core/booking.service.ts   — getBookingById, getCustomerBookings,
  │   (query layer)                   cancelCustomerBooking, getHelperBookings
  │                                    throws BookingServiceError({ code, httpStatus })
  │
  ├── razorpay.service.ts           — createRazorpayOrder, verifyRazorpaySignature,
  │                                    initiatePayment, confirmPayment, refundPayment
  │
  ├── otp.service.ts                — sendOtp, verifyOtp
  ├── otp-security.service.ts       — rate limiting, attempt tracking
  ├── auth-audit.service.ts         — login event logging
  ├── token-blacklist.service.ts    — Redis-backed refresh token blacklisting
  │
  ├── earnings.service.ts           — getSummary, getHistory, getDetail
  ├── location.service.ts           — updateLocation, getRoute, getCurrentLocations, etc.
  ├── pan.service.ts                — initiatePanVerification, verifyPan
  ├── idfy.service.ts               — IDfy KYC integration
  ├── payout.service.ts             — payout disbursement logic
  ├── redis.service.ts              — shared Redis client
  │
  ├── helper-discipline.service.ts  — strike recording, suspension logic
  ├── noShowAutoCancel.service.ts   — cron-driven no-show detection
  └── inProgressTimeout.service.ts  — auto-cancel if job stuck IN_PROGRESS

src/tasks/
  └── expiry-cronjob.ts             — runs processExpiredRequests() + processPaymentExpirations()
                                       every 5 seconds

src/socket/
  └── socket.service.ts             — WebSocket server; emits dispatch events to helpers
```

### Layering contract

```
Route  →  Controller  →  Service  →  Prisma Client
```

- **Routes** handle HTTP plumbing and middleware chains.
- **Controllers** parse `req`/`res`, call services, map errors to HTTP status codes.
- **Services** own business logic and DB access; throw typed errors (never use `res` directly).
- **`booking.service.ts`** (core query layer) and **`booking-lifecycle.service.ts`** (state transitions) are the single source of truth for booking state — controllers must not call `prisma.booking.update()` directly.

---

## 8. Module Structure

```
src/
  app.ts                         ← Route mounts
  server.ts                      ← HTTP + Socket.IO startup
  prisma.client.ts               ← Shared Prisma instance

  auth/
    auth.controller.ts
    auth.routes.ts

  core/                          ← Cross-role shared routes/controllers/services
    booking.service.ts           ← Query layer (getBookingById, getCustomerBookings, etc.)
    booking-request.controller.ts
    booking-request.routes.ts
    payment.controller.ts
    payment.routes.ts
    rating.controller.ts
    rating.routes.ts
    razorpay.routes.ts
    service.controller.ts
    service.routes.ts

  modules/
    user/                        ← CUSTOMER-scoped
      index.ts                   ← Mounts /profile routes + /bookings routes
      user.controller.ts
      user.routes.ts
      user-booking.controller.ts
      user-booking.routes.ts

    partner/                     ← HELPER-scoped
      index.ts                   ← Mounts all partner sub-routes
      earnings.controller.ts + earnings.routes.ts
      helper-dashboard.controller.ts
      helper-status.controller.ts
      job.controller.ts + job.routes.ts
      location.controller.ts + location.routes.ts
      onboarding.controller.ts + onboarding.routes.ts
      operational.routes.ts
      pan.controller.ts + pan.routes.ts
      partner-booking.controller.ts + partner-booking.routes.ts

    admin/                       ← ADMIN-scoped
      index.ts
      admin.controller.ts + admin.routes.ts
      onboarding.routes.ts       ← approve/reject helper onboarding

  middlewares/
    auth.middleware.ts
    error.middleware.ts
    rateLimiter.ts
    security.middleware.ts

  services/                      ← Business logic (see Section 7)
  socket/
  tasks/
  utils/
  config/
  types/
  prisma/
    schema.prisma
```

### Route mount summary (`src/app.ts`)

```typescript
app.use('/webhook',               razorpayRoutes);          // POST /webhook/razorpay
app.use('/api/auth',              authRoutes);              // Auth
app.use('/api/user',              userModule);              // Customer profile + bookings
app.use('/api/partner',           partnerModule);           // Helper all sub-routes
app.use('/api/admin',             adminModule);             // Admin settings + onboarding
app.use('/api/booking-requests',  bookingRequestRoutes);    // Dispatch flow
app.use('/api/payments',          paymentRoutes);           // Payments
app.use('/api/ratings',           ratingRoutes);            // Ratings
app.use('/api/services',          serviceRoutes);           // Service listings
```

---

*Last updated: auto-generated from live route files.*
