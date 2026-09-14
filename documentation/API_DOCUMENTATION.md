# Zynexx Partner Backend — Complete API Documentation

> **Base URL (Production):** `http://3.110.231.111:5001`
> **Content-Type:** `application/json` (all requests unless noted)
> **Authentication:** `Authorization: Bearer <accessToken>` (where required)

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Core — Booking Requests](#2-core--booking-requests)
3. [Core — Payments](#3-core--payments)
4. [Core — Ratings](#4-core--ratings)
5. [Core — Services](#5-core--services)
6. [User Module](#6-user-module)
7. [Partner Module](#7-partner-module)
8. [Admin Module](#8-admin-module)
9. [Notifications](#9-notifications)
10. [Webhooks](#10-webhooks)
11. [Debug (Dev Only)](#11-debug-dev-only)
12. [Complete Route Summary](#12-complete-route-summary)

---

## Auth Conventions

| Symbol | Meaning |
|--------|---------|
| Public | No token required |
| JWT | `authMiddleware` — valid JWT required |
| HELPER | Role: `HELPER` enforced |
| ADMIN | Role: `ADMIN` enforced |
| Approved | `requireApprovedHelper` — HELPER + onboarding APPROVED + not suspended |

---

## 1. Authentication

Base path: `/api/auth`

### POST /api/auth/signup
Register a new customer account using a phone number. Sends an OTP.

**Rate limit:** 5 per day per IP

**Request Body:**
```json
{ "phone": "+919876543210" }
```

**Response 200:**
```json
{ "success": true, "message": "OTP sent" }
```

---

### POST /api/auth/login
Login with an existing phone number. Sends an OTP.

**Rate limit:** 5 per 15 minutes per IP

**Request Body:**
```json
{ "phone": "+919876543210" }
```

**Response 200:**
```json
{ "success": true, "message": "OTP sent" }
```

---

### POST /api/auth/verify-otp
Verify OTP for a customer login/signup. Returns access + refresh tokens.

**Rate limit:** 3 per 30 minutes per IP

**Request Body:**
```json
{ "phone": "+919876543210", "otp": "123456" }
```

**Response 200:**
```json
{
  "success": true,
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>",
  "user": { "id": 1, "phone": "+919876543210", "role": "USER" }
}
```

---

### POST /api/auth/helper/verify-otp
Verify OTP for a helper login/signup. Creates `User` + `Helper` records if absent. Does **not** mutate an existing role.

**Rate limit:** 3 per 30 minutes per IP

**Request Body:**
```json
{ "phone": "+919876543210", "otp": "123456" }
```

**Response 200:** Same shape as `/verify-otp` with `role: "HELPER"`.

---

### POST /api/auth/refresh-token
Exchange a valid refresh token for a new access token.

**Rate limit:** 10 per hour

**Request Body:**
```json
{ "refreshToken": "<jwt>" }
```

**Response 200:**
```json
{ "success": true, "accessToken": "<new-jwt>" }
```

---

### POST /api/auth/logout
Requires: JWT

Invalidate the current refresh token.

**Response 200:**
```json
{ "success": true, "message": "Logged out successfully" }
```

---

## 2. Core — Booking Requests

Base path: `/api/booking-requests`

### POST /api/booking-requests/create
Requires: JWT

Create a new booking request. Dispatches to nearby helpers (10-second acceptance window per helper).

**Request Body:**
```json
{
  "serviceId": 1,
  "servicePlanId": 2,
  "address": "123 Main Street, Apartment 4B",
  "city": "Mumbai",
  "pinCode": "400001",
  "latitude": 19.076,
  "longitude": 72.877,
  "estimatedHours": 2,
  "description": "Optional job description (max 500 chars)",
  "specialRequirements": "Optional (max 300 chars)",
  "requestedTime": "10:00 AM"
}
```

**Validation:**
- `serviceId` / `servicePlanId` — integer >= 1
- `address` — 5–200 characters
- `city` — 2–50 characters
- `pinCode` — exactly 6 digits
- `latitude` — float −90 to 90
- `longitude` — float −180 to 180
- `estimatedHours` — integer 1–100
- `requestedTime` — 12-hour format `"10:00 AM"` (optional)

**Response 201:**
```json
{ "success": true, "requestId": "req_abc123", "message": "Booking request created and dispatched" }
```

---

### POST /api/booking-requests/:requestId/accept
Requires: JWT + HELPER

Helper accepts a dispatched booking request within the 10-second window.

**Response 200:**
```json
{ "success": true, "bookingId": 42, "message": "Request accepted" }
```

---

### POST /api/booking-requests/:requestId/reject
Requires: JWT + HELPER

Helper rejects a request. System auto-redispatches if time permits.

**Request Body (optional):**
```json
{ "reason": "Too far away" }
```

**Response 200:**
```json
{ "success": true, "message": "Request rejected" }
```

---

### GET /api/booking-requests/:requestId/status
Requires: JWT

Get current status of a booking request. Accessible by both customer and assigned helper.

**Response 200:**
```json
{ "success": true, "request": { "id": "req_abc123", "status": "ACCEPTED", "assignedHelperId": 7 } }
```

---

### GET /api/booking-requests/helper/pending
Requires: JWT + HELPER

Get all requests currently dispatched to this helper (awaiting accept/reject).

**Response 200:**
```json
{ "success": true, "requests": [ { "id": "req_abc123", "serviceId": 1, "expiresAt": "..." } ] }
```

---

### GET /api/booking-requests/customer/history
Requires: JWT

Get the authenticated customer's booking request history.

**Query Params:** `status` — PENDING | ACCEPTED | EXPIRED | REJECTED (optional filter)

**Response 200:**
```json
{ "success": true, "requests": [ /* array of request objects */ ] }
```

---

## 3. Core — Payments

Base path: `/api/payments`

### POST /api/payments/create-order
Requires: JWT

Create a Razorpay order for a booking.

**Request Body:**
```json
{ "bookingId": 42, "amount": 50000 }
```

**Response 201:**
```json
{ "success": true, "order": { "id": "order_abc123", "amount": 50000, "currency": "INR" } }
```

---

### POST /api/payments/initiate
Requires: JWT

Initiate payment for a booking (creates a payment record).

**Request Body:**
```json
{ "bookingId": 42 }
```

**Response 200:**
```json
{ "success": true, "paymentId": 12, "razorpayOrderId": "order_abc123" }
```

---

### POST /api/payments/verify
Requires: JWT

Verify Razorpay payment after client-side checkout completes.

**Request Body:**
```json
{
  "razorpayOrderId": "order_abc123",
  "razorpayPaymentId": "pay_xyz789",
  "razorpaySignature": "<hmac-sha256>"
}
```

**Response 200:**
```json
{ "success": true, "message": "Payment verified", "bookingId": 42 }
```

---

### GET /api/payments/:paymentId
Requires: JWT

Get details of a specific payment.

**Response 200:**
```json
{ "success": true, "payment": { "id": 12, "bookingId": 42, "amount": 50000, "status": "CAPTURED" } }
```

---

### GET /api/payments
Requires: JWT

Get payment history for the authenticated user.

**Response 200:**
```json
{ "success": true, "payments": [ /* array */ ] }
```

---

### POST /api/payments/:paymentId/refund
Requires: JWT + ADMIN

Initiate a refund for a captured payment.

**Request Body:**
```json
{ "amount": 50000, "reason": "Customer request" }
```

**Response 200:**
```json
{ "success": true, "refundId": "rfnd_abc", "message": "Refund initiated" }
```

---

## 4. Core — Ratings

Base path: `/api/ratings`

### POST /api/ratings
Requires: JWT

Submit a rating for a completed booking.

**Request Body:**
```json
{ "bookingId": 42, "helperId": 7, "serviceId": 1, "rating": 4, "review": "Great service!" }
```

**Response 201:**
```json
{ "success": true, "ratingId": 15, "message": "Rating submitted" }
```

---

### GET /api/ratings/service/:serviceId
Public. Get all ratings for a service.

**Response 200:**
```json
{ "success": true, "ratings": [ { "id": 15, "rating": 4, "review": "..." } ] }
```

---

### GET /api/ratings/helper/:helperId
Public. Get all ratings for a helper.

**Response 200:**
```json
{ "success": true, "ratings": [ /* array */ ] }
```

---

### GET /api/ratings/stats/:helperId
Public. Get aggregated rating statistics for a helper.

**Response 200:**
```json
{
  "success": true,
  "stats": {
    "average": 4.3,
    "count": 127,
    "distribution": { "5": 60, "4": 40, "3": 15, "2": 8, "1": 4 }
  }
}
```

---

### PUT /api/ratings/:ratingId
Requires: JWT

Update an existing rating.

**Request Body:**
```json
{ "rating": 5, "review": "Updated review" }
```

**Response 200:**
```json
{ "success": true, "message": "Rating updated" }
```

---

### DELETE /api/ratings/:ratingId
Requires: JWT

Delete a rating.

**Response 200:**
```json
{ "success": true, "message": "Rating deleted" }
```

---

## 5. Core — Services

Base path: `/api/services`

### POST /api/services
Requires: JWT

Create a new service listing.

**Request Body:**
```json
{ "name": "House Cleaning", "description": "Full house cleaning", "basePrice": 499, "category": "CLEANING" }
```

**Response 201:**
```json
{ "success": true, "service": { "id": 1, "name": "House Cleaning" } }
```

---

### GET /api/services
Public. List all available services.

**Response 200:**
```json
{ "success": true, "services": [ { "id": 1, "name": "House Cleaning" } ] }
```

---

### GET /api/services/helper/:helperId
Public. Get all services offered by a specific helper.

**Response 200:**
```json
{ "success": true, "services": [ /* array */ ] }
```

---

### GET /api/services/:serviceId
Public. Get details of a specific service including its plans.

**Response 200:**
```json
{ "success": true, "service": { "id": 1, "name": "House Cleaning", "plans": [ /* array */ ] } }
```

---

### PUT /api/services/:serviceId
Requires: JWT. Update a service.

**Response 200:**
```json
{ "success": true, "service": { /* updated */ } }
```

---

### DELETE /api/services/:serviceId
Requires: JWT. Delete a service.

**Response 200:**
```json
{ "success": true, "message": "Service deleted" }
```

---

## 6. User Module

Base path: `/api/user`

### GET /api/user/profile
Requires: JWT

**Response 200:**
```json
{ "success": true, "user": { "id": 1, "name": "Ravi Kumar", "phone": "+919876543210", "role": "USER" } }
```

---

### PUT /api/user/profile
Requires: JWT

**Request Body:**
```json
{ "name": "Ravi Kumar", "email": "ravi@example.com" }
```

**Response 200:**
```json
{ "success": true, "user": { /* updated */ } }
```

---

### POST /api/user/register-helper
Requires: JWT. Register the authenticated user as a Helper partner.

**Response 201:**
```json
{ "success": true, "helperId": 7, "message": "Helper account created" }
```

---

### PUT /api/user/bank-details
Requires: JWT. Update bank account details for payouts.

**Request Body:**
```json
{ "accountNumber": "1234567890", "ifscCode": "HDFC0001234", "accountHolderName": "Ravi Kumar", "bankName": "HDFC Bank" }
```

**Response 200:**
```json
{ "success": true, "message": "Bank details updated" }
```

---

### POST /api/user/upload-photo
Requires: JWT. Upload profile photo (multipart form-data, field `photo`).

**Response 200:**
```json
{ "success": true, "photoUrl": "https://s3.amazonaws.com/..." }
```

---

### POST /api/user/upload-kyc
Requires: JWT. Upload KYC documents (multipart form-data).

**Response 200:**
```json
{ "success": true, "message": "KYC documents uploaded" }
```

---

### GET /api/user/helper/:helperId
Public. Get public profile of a helper.

**Response 200:**
```json
{ "success": true, "helper": { "id": 7, "name": "Suresh Singh", "rating": 4.5, "completedJobs": 120 } }
```

---

### GET /api/user/search-helpers
Public. Search for available helpers.

**Query Params:** `serviceId`, `city`, `page`, `limit`

**Response 200:**
```json
{ "success": true, "helpers": [ /* array */ ], "total": 45, "page": 1 }
```

---

### GET /api/user/bookings
Requires: JWT. Customer's own bookings (paginated).

**Query Params:** `page` (default 1), `limit` (default 10), `status` (optional)

**Response 200:**
```json
{
  "success": true,
  "bookings": [ { "id": 42, "status": "COMPLETED", "helper": { "name": "Suresh" }, "totalAmount": 499 } ],
  "total": 12,
  "page": 1
}
```

---

### GET /api/user/bookings/:bookingId
Requires: JWT. Full booking detail. Ownership enforced.

**Response 200:**
```json
{
  "success": true,
  "booking": { "id": 42, "status": "COMPLETED", "otp": "4829", "workPhotos": { "before": [], "after": [] } }
}
```

---

### POST /api/user/bookings/:bookingId/cancel
Requires: JWT. Cancel a booking (only pre-IN_PROGRESS).

**Response 200:**
```json
{ "success": true, "message": "Booking cancelled" }
```

---

### GET /api/user/addresses
Requires: JWT. List all saved addresses.

**Response 200:**
```json
{
  "success": true,
  "addresses": [
    {
      "id": 3,
      "label": "Home",
      "addressLine1": "Flat 4B, Rose Apartments",
      "city": "Mumbai",
      "pinCode": "400001",
      "isDefault": true
    }
  ]
}
```

---

### POST /api/user/addresses
Requires: JWT. Add a new saved address.

**Request Body:**
```json
{
  "label": "Home",
  "addressLine1": "Flat 4B, Rose Apartments",
  "addressLine2": "MG Road",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pinCode": "400001",
  "latitude": 19.076,
  "longitude": 72.877,
  "isDefault": true
}
```

**Response 201:**
```json
{ "success": true, "address": { "id": 3 } }
```

---

### PUT /api/user/addresses/:addressId
Requires: JWT. Update a saved address. Ownership enforced.

**Request Body:** Any subset of address fields.

**Response 200:**
```json
{ "success": true, "address": { /* updated */ } }
```

---

### DELETE /api/user/addresses/:addressId
Requires: JWT. Delete a saved address. Ownership enforced.

**Response 200:**
```json
{ "success": true, "message": "Address deleted" }
```

---

## 7. Partner Module

Base path: `/api/partner`

### 7.1 Partner Onboarding

All routes require: JWT + HELPER

#### GET /api/partner/onboarding/status

**Response 200:**
```json
{ "success": true, "status": "PENDING_KYC", "steps": { "profile": true, "kyc": false, "bank": false } }
```

---

#### POST /api/partner/onboarding/profile

**Request Body:**
```json
{ "fullName": "Suresh Singh", "city": "Mumbai", "serviceArea": "Andheri West", "skills": ["House Cleaning"] }
```

**Response 200:**
```json
{ "success": true, "message": "Profile submitted" }
```

---

#### POST /api/partner/onboarding/kyc

**Request Body:**
```json
{ "aadhaarNumber": "1234 5678 9012", "panNumber": "ABCDE1234F" }
```

**Response 200:**
```json
{ "success": true, "message": "KYC submitted for review" }
```

---

#### POST /api/partner/onboarding/bank

**Request Body:**
```json
{ "accountNumber": "1234567890", "ifscCode": "HDFC0001234", "accountHolderName": "Suresh Singh" }
```

**Response 200:**
```json
{ "success": true, "message": "Bank details submitted" }
```

---

### 7.2 Partner KYC (Image-based)

Three-step flow. All steps require: JWT + HELPER.

#### POST /api/partner/kyc/upload-selfie
Step 1. Upload selfie image.

**Form Data:** `file` — JPEG or PNG only

**Response 200:**
```json
{ "success": true, "selfieUrl": "https://s3.amazonaws.com/..." }
```

---

#### POST /api/partner/kyc/verify-pan
Step 2. Upload PAN card image. Runs IDFY OCR + verification. Requires Step 1 completed.

**Form Data:** `file` — JPEG or PNG only

**Response 200:**
```json
{ "success": true, "verificationStatus": "VERIFIED", "panUrl": "https://s3.amazonaws.com/..." }
```

---

#### POST /api/partner/kyc/upload-police
Step 3. Upload police verification document. Requires `verificationStatus === VERIFIED` from Step 2.

**Form Data:** `file` — JPEG, PNG, or PDF

**Response 200:**
```json
{ "success": true, "policeDocUrl": "https://s3.amazonaws.com/..." }
```

---

### 7.3 Partner PAN Verification (Legacy)

#### POST /api/partner/pan/initiate
Initiate PAN verification via data flow.

**Request Body:**
```json
{ "panNumber": "ABCDE1234F", "fullName": "Suresh Singh", "dateOfBirth": "1990-05-15" }
```

Validation: panNumber `[A-Z]{5}[0-9]{4}[A-Z]`; dateOfBirth `YYYY-MM-DD`.

**Response 200:**
```json
{ "success": true, "requestId": "idfy_req_abc123" }
```

---

#### POST /api/partner/pan/verify

**Request Body:**
```json
{ "requestId": "idfy_req_abc123" }
```

**Response 200:**
```json
{ "success": true, "verified": true, "name": "SURESH SINGH" }
```

---

#### GET /api/partner/pan/status

**Response 200:**
```json
{ "success": true, "status": "VERIFIED", "panNumber": "ABCDE****F" }
```

---

### 7.4 Partner Earnings

All routes require: JWT + HELPER

#### GET /api/partner/earnings/summary

**Response 200:**
```json
{ "success": true, "summary": { "totalEarnings": 12500, "pendingPayout": 2500, "completedJobs": 47, "thisMonthEarnings": 3200 } }
```

---

#### GET /api/partner/earnings/history

**Query Params:** `page` (default 1), `limit` (default 10)

**Response 200:**
```json
{
  "success": true,
  "history": [ { "bookingId": 42, "amount": 450, "status": "PAID", "paidAt": "..." } ],
  "total": 47,
  "page": 1
}
```

---

#### GET /api/partner/earnings/:bookingId

**Response 200:**
```json
{ "success": true, "earning": { "bookingId": 42, "grossAmount": 499, "platformFee": 49, "netAmount": 450, "payoutStatus": "PAID" } }
```

---

### 7.5 Partner Operational

All routes require: Approved Helper (`requireApprovedHelper`)

#### PATCH /api/partner/ops/status
Toggle online/offline.

**Request Body:**
```json
{ "isOnline": true, "force": false }
```

`force: true` allows going offline even during an IN_PROGRESS job.

**Response 200:**
```json
{ "success": true, "isOnline": true }
```

---

#### GET /api/partner/ops/dashboard
Unified snapshot: identity, online state, active/upcoming booking, pending request count, today's completions, earnings, discipline counters.

**Response 200:**
```json
{
  "success": true,
  "dashboard": {
    "helper": { "id": 7, "name": "Suresh", "isOnline": true },
    "activeBooking": null,
    "pendingRequestCount": 2,
    "todayCompletedJobs": 3,
    "earningsSummary": { "today": 1200, "week": 4500 },
    "discipline": { "strikes": 0, "noShows": 0 }
  }
}
```

---

#### GET /api/partner/ops/discipline
Detailed discipline record: strikes, no-shows, cancellations, ignores, penalties, suspension window.

**Response 200:**
```json
{ "success": true, "discipline": { "strikes": 1, "noShows": 2, "cancellations": 3, "suspensionEndsAt": null } }
```

---

### 7.6 Partner Location

#### POST /api/partner/location/update
Requires: Approved Helper. Update GPS location.

**Request Body:**
```json
{ "latitude": 19.076, "longitude": 72.877, "accuracy": 5.0 }
```

**Response 200:**
```json
{ "success": true, "message": "Location updated" }
```

---

#### GET /api/partner/location/route/:bookingId
Requires: JWT. Real-time route for an active booking.

**Response 200:**
```json
{ "success": true, "route": { "helperLocation": { "lat": 19.076, "lng": 72.877 }, "estimatedArrival": "10 mins" } }
```

---

#### GET /api/partner/location/current/:bookingId
Requires: JWT. Current locations of both parties.

**Response 200:**
```json
{ "success": true, "helper": { "lat": 19.076, "lng": 72.877 }, "customer": { "lat": 19.080, "lng": 72.880 } }
```

---

#### GET /api/partner/location/history/:userId
Requires: JWT. Location history for a user.

**Response 200:**
```json
{ "success": true, "history": [ { "lat": 19.076, "lng": 72.877, "timestamp": "..." } ] }
```

---

#### GET /api/partner/location/check-range/:bookingId
Requires: JWT. Check if helper is within range of customer.

**Response 200:**
```json
{ "success": true, "inRange": true, "distance": 0.8, "threshold": 1.0 }
```

---

#### GET /api/partner/location/stream/:bookingId
Requires: JWT. Stream real-time location updates (SSE or polling).

---

### 7.7 Partner Jobs

#### GET /api/partner/jobs/user/jobs
Requires: JWT. Jobs created by the authenticated user.

---

#### POST /api/partner/jobs
Requires: JWT. Create new job details.

**Request Body:**
```json
{ "title": "AC Repair Specialist", "description": "5 years experience", "skills": ["AC Repair"], "hourlyRate": 200 }
```

**Response 201:**
```json
{ "success": true, "job": { "id": 5 } }
```

---

#### GET /api/partner/jobs/:jobId
Public. Get a specific job listing.

---

#### GET /api/partner/jobs
Public. List all job listings.

---

#### PUT /api/partner/jobs/:jobId
Requires: JWT. Update a job listing.

---

#### DELETE /api/partner/jobs/:jobId
Requires: JWT. Delete a job listing.

---

### 7.8 Partner Bookings

All routes require: Approved Helper

#### GET /api/partner/bookings
Helper's assigned bookings (paginated).

**Query Params:** `status` (COMPLETED|CONFIRMED|IN_PROGRESS|CANCELLED), `page`, `limit`

**Response 200:**
```json
{
  "success": true,
  "bookings": [ { "id": 42, "status": "IN_PROGRESS", "customer": { "name": "Ravi" }, "address": "123 Main St" } ],
  "total": 18
}
```

---

#### GET /api/partner/bookings/:bookingId
Booking detail. Ownership enforced.

**Response 200:**
```json
{ "success": true, "booking": { "id": 42, "status": "IN_PROGRESS", "otp": "4829" } }
```

---

#### POST /api/partner/bookings/:bookingId/start
OTP-based service start. Helper submits the 4-digit OTP from the customer's app.

**Request Body:**
```json
{ "otp": "4829" }
```

**Response 200:**
```json
{ "success": true, "message": "Booking started", "startedAt": "2024-01-15T10:05:00Z" }
```

Errors: `400` Invalid OTP; `409` OTP expired or booking not CONFIRMED.

---

#### POST /api/partner/bookings/:bookingId/regenerate-otp
Re-issue an expired OTP (previous OTP > 30 minutes old).

**Response 200:**
```json
{ "success": true, "message": "New OTP sent to customer" }
```

---

#### POST /api/partner/bookings/:bookingId/complete
Mark booking as COMPLETED. Only assigned helper, only on IN_PROGRESS bookings.

**Response 200:**
```json
{ "success": true, "message": "Booking completed" }
```

---

#### POST /api/partner/bookings/:bookingId/before-photos
Upload before-work photos (max 5 images, JPEG/PNG, 5 MB each).

**Form Data:** `photos[]` — up to 5 files

**Response 200:**
```json
{ "success": true, "photoUrls": ["https://s3.amazonaws.com/..."] }
```

---

#### POST /api/partner/bookings/:bookingId/start-timer
Start the job timer. Requires: at least 1 before-photo uploaded, booking IN_PROGRESS. Can only trigger once.

**Response 200:**
```json
{ "success": true, "timerStartedAt": "2024-01-15T10:10:00Z" }
```

---

#### POST /api/partner/bookings/:bookingId/after-photos
Upload after-work photos (max 5 images). Requires IN_PROGRESS and timer started.

**Form Data:** `photos[]` — up to 5 files

**Response 200:**
```json
{ "success": true, "photoUrls": ["https://s3.amazonaws.com/..."] }
```

---

#### POST /api/partner/bookings/:bookingId/report-issue
Report a problem to admin/support. Allowed statuses: CONFIRMED, IN_PROGRESS. One issue per booking.

**Request Body:**
```json
{ "issueType": "CUSTOMER_NOT_AVAILABLE", "description": "Customer did not open door after 30 minutes." }
```

**Response 201:**
```json
{ "success": true, "issueId": 8, "message": "Issue reported" }
```

---

### 7.9 Partner Reviews

#### GET /api/partner/reviews
Requires: Approved Helper. Reviews (ratings) received from customers.

**Query Params:** `page`, `limit`

**Response 200:**
```json
{ "success": true, "reviews": [ { "id": 15, "rating": 5, "review": "Excellent!", "customer": { "name": "Ravi" } } ], "average": 4.5, "total": 47 }
```

---

### 7.10 Partner Bank Details

#### GET /api/partner/bank-details
Requires: Approved Helper.

**Response 200:**
```json
{ "success": true, "bankDetails": { "accountNumber": "****7890", "ifscCode": "HDFC0001234", "accountHolderName": "Suresh Singh" } }
```

---

### 7.11 Partner Address

#### GET /api/partner/address
Requires: Approved Helper. Get service area address.

**Response 200:**
```json
{ "success": true, "address": { "street": "15 Park Lane", "city": "Mumbai", "pinCode": "400053" } }
```

---

#### PUT /api/partner/address
Requires: Approved Helper. Update service area address.

**Request Body:**
```json
{ "street": "22 Station Road", "city": "Mumbai", "state": "Maharashtra", "pinCode": "400054" }
```

**Response 200:**
```json
{ "success": true, "address": { /* updated */ } }
```

---

### 7.12 Partner Services

#### GET /api/partner/services
Requires: Approved Helper. List offered services.

**Response 200:**
```json
{ "success": true, "services": [ { "id": 1, "name": "House Cleaning", "isActive": true } ] }
```

---

#### PUT /api/partner/services
Requires: Approved Helper. Update offered services.

**Request Body:**
```json
{ "serviceIds": [1, 3, 5] }
```

**Response 200:**
```json
{ "success": true, "services": [ /* updated list */ ] }
```

---

## 8. Admin Module

Base path: `/api/admin`

> All admin routes require: JWT + ADMIN role

### 8.1 Admin Settings & Platform

#### GET /api/admin/settings/commission

**Response 200:**
```json
{ "success": true, "commission": 10.0, "updatedAt": "2024-01-01T00:00:00Z" }
```

---

#### PUT /api/admin/settings/commission

**Request Body:**
```json
{ "commission": 12.5 }
```

**Response 200:**
```json
{ "success": true, "commission": 12.5 }
```

---

#### PATCH /api/admin/platform-settings
Update platform-wide config (fee caps, limits, feature flags).

**Request Body:**
```json
{ "maxBookingHours": 8, "cancellationFeePercent": 10, "minBookingHours": 1 }
```

**Response 200:**
```json
{ "success": true, "settings": { /* updated */ } }
```

---

### 8.2 Admin Services & Plans

#### GET /api/admin/services

**Response 200:**
```json
{ "success": true, "services": [ { "id": 1, "name": "House Cleaning" } ] }
```

---

#### POST /api/admin/services

**Request Body:**
```json
{ "name": "Plumbing", "description": "...", "category": "REPAIRS" }
```

**Response 201:**
```json
{ "success": true, "service": { "id": 6 } }
```

---

#### PATCH /api/admin/services/:id

**Response 200:**
```json
{ "success": true, "service": { /* updated */ } }
```

---

#### DELETE /api/admin/services/:id

**Response 200:**
```json
{ "success": true, "message": "Service deleted" }
```

---

#### GET /api/admin/service-plans

**Response 200:**
```json
{ "success": true, "plans": [ { "id": 1, "serviceId": 1, "name": "Basic 2hr", "price": 499 } ] }
```

---

#### POST /api/admin/service-plans

**Request Body:**
```json
{ "serviceId": 1, "name": "Basic 2hr", "description": "2-hour clean", "price": 499, "durationHours": 2 }
```

**Response 201:**
```json
{ "success": true, "plan": { "id": 3 } }
```

---

#### PATCH /api/admin/service-plans/:id

**Response 200:**
```json
{ "success": true, "plan": { /* updated */ } }
```

---

#### DELETE /api/admin/service-plans/:id

**Response 200:**
```json
{ "success": true, "message": "Plan deleted" }
```

---

### 8.3 Admin Bookings

#### GET /api/admin/bookings
Paginated booking list for Admin Order Management.

**Query Params:** `page` (default 1), `limit` (default 20), `search` (name/phone/helperId/bookingId), `status`

**Response 200:**
```json
{
  "success": true,
  "stats": { "totalBookings": 1250, "activeNow": 8, "pending": 12, "completed": 1100 },
  "bookings": [ { "id": 42, "status": "COMPLETED", "customer": { "name": "Ravi" }, "helper": { "name": "Suresh" }, "totalAmount": 499 } ],
  "total": 1250,
  "page": 1
}
```

---

#### GET /api/admin/bookings/:bookingId
Full booking detail.

**Response 200:**
```json
{
  "success": true,
  "booking": {
    "id": 42,
    "status": "COMPLETED",
    "customer": { /* full profile */ },
    "helper": { /* full profile */ },
    "payment": { /* payment info */ },
    "workPhotos": { "before": [], "after": [] },
    "timeline": { "createdAt": "...", "completedAt": "..." },
    "issue": null
  }
}
```

---

#### POST /api/admin/bookings/:bookingId/cancel
Admin override cancellation. Cancels regardless of status (except COMPLETED/EXPIRED). Captured payment → REFUNDED. If payout PAID → `payoutReversalRequired: true`.

**Request Body:**
```json
{ "reason": "Customer complaint escalation", "overridePayout": false }
```

`reason` required. `overridePayout` boolean (default false).

**Response 200:**
```json
{ "success": true, "message": "Booking cancelled", "bookingId": 42, "payoutReversalRequired": false }
```

---

### 8.4 Admin Users

#### GET /api/admin/users

**Query Params:** `page`, `limit`, `search`, `status` (active|blocked)

**Response 200:**
```json
{
  "success": true,
  "cards": { "total": 4500, "active": 4300, "blocked": 200 },
  "users": [ { "id": 1, "name": "Ravi Kumar", "isBlocked": false, "totalBookings": 12, "totalSpent": 5999 } ],
  "total": 4500
}
```

---

#### GET /api/admin/users/stats
User aggregate counts. Must be registered BEFORE `/:userId`.

**Response 200:**
```json
{ "success": true, "total": 4500, "active": 4300, "blocked": 200 }
```

---

#### GET /api/admin/users/:userId
Full user profile with booking stats and 10 most recent bookings.

**Response 200:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "name": "Ravi Kumar",
    "isBlocked": false,
    "bookingStats": { "total": 12, "completed": 10, "cancelled": 2, "totalSpent": 5999 },
    "recentBookings": [ /* 10 most recent */ ]
  }
}
```

---

#### POST /api/admin/users/:userId/block

**Request Body:**
```json
{ "reason": "Repeated policy violations" }
```

**Response 200:**
```json
{ "success": true, "message": "User blocked" }
```

---

#### POST /api/admin/users/:userId/unblock

**Response 200:**
```json
{ "success": true, "message": "User unblocked" }
```

---

#### GET /api/admin/users/:userId/bookings

**Query Params:** `page`, `limit`

**Response 200:**
```json
{ "success": true, "bookings": [ /* array */ ], "total": 12, "page": 1 }
```

---

### 8.5 Admin Helpers

#### GET /api/admin/helpers

**Query Params:** `page`, `limit`, `search`, `status` (active|inactive)

**Response 200:**
```json
{
  "success": true,
  "helpers": [ { "id": 7, "name": "Suresh Singh", "onboardingStatus": "APPROVED", "totalOrders": 120, "totalEarnings": 54000 } ],
  "total": 250
}
```

---

#### GET /api/admin/helpers/stats
Helper aggregate counts. Must be registered BEFORE `/:helperId`.

**Response 200:**
```json
{ "success": true, "totalHelpers": 250, "activeHelpers": 180, "inactiveHelpers": 70 }
```

---

#### GET /api/admin/helpers/:helperId
Full helper profile with services, earnings, and 10 recent bookings.

**Response 200:**
```json
{
  "success": true,
  "helper": {
    "id": 7,
    "onboardingStatus": "APPROVED",
    "services": [ /* offered services */ ],
    "earnings": { "total": 54000, "pending": 1200 },
    "recentBookings": [ /* 10 most recent */ ]
  }
}
```

---

#### GET /api/admin/helpers/:helperId/bookings
Paginated booking history. Registered BEFORE `/:helperId`.

**Query Params:** `page`, `limit`, `status`

**Response 200:**
```json
{ "success": true, "bookings": [ /* array */ ], "total": 120, "page": 1 }
```

---

#### PATCH /api/admin/helpers/:helperId/status

**Request Body:**
```json
{ "status": "inactive" }
```

Valid values: `"active"` | `"inactive"`

**Response 200:**
```json
{ "success": true, "status": "inactive" }
```

---

### 8.6 Admin Finance

#### GET /api/admin/finance/summary

**Response 200:**
```json
{
  "success": true,
  "summary": { "totalRevenue": 1250000, "platformFees": 125000, "helperPayouts": 1125000, "pendingPayouts": 45000, "refundsIssued": 12500 }
}
```

---

#### GET /api/admin/finance/payouts

**Query Params:** `page`, `limit`, `status` (PENDING|PAID|FAILED)

**Response 200:**
```json
{
  "success": true,
  "payouts": [ { "bookingId": 42, "helperId": 7, "helperName": "Suresh", "amount": 450, "status": "PAID" } ],
  "total": 850
}
```

---

#### GET /api/admin/finance/payouts/:bookingId
Payout audit for a specific booking.

**Response 200:**
```json
{
  "success": true,
  "audit": { "bookingId": 42, "grossAmount": 499, "platformFee": 49, "netAmount": 450, "payoutStatus": "PAID", "reversalRequired": false }
}
```

---

### 8.7 Admin Onboarding

#### POST /api/admin/onboarding/approve/:helperId

**Response 200:**
```json
{ "success": true, "message": "Helper approved", "helperId": 7 }
```

---

#### POST /api/admin/onboarding/reject/:helperId

**Request Body (optional):**
```json
{ "reason": "KYC documents unclear" }
```

**Response 200:**
```json
{ "success": true, "message": "Helper rejected", "helperId": 7 }
```

---

### 8.8 Admin Payout

#### POST /api/admin/payout/:bookingId/mark-paid
Manually mark a helper's payout as PAID (for offline transfers).

**Response 200:**
```json
{ "success": true, "message": "Payout marked as paid", "bookingId": 42 }
```

---

## 9. Notifications

Base path: `/api/notifications`

All notification routes require: JWT

### POST /api/notifications/register-device
Register an FCM device token for push notifications.

**Request Body:**
```json
{ "token": "fcm_token_string", "platform": "ANDROID" }
```

Valid platforms: `ANDROID` | `IOS` | `WEB`

**Response 200:**
```json
{ "success": true, "message": "Device registered" }
```

---

### DELETE /api/notifications/register-device
Remove a device token (call on logout).

**Request Body:**
```json
{ "token": "fcm_token_string" }
```

**Response 200:**
```json
{ "success": true, "message": "Device unregistered" }
```

---

### GET /api/notifications
Paginated notification history.

**Query Params:** `page` (default 1), `limit` (default 20)

**Response 200:**
```json
{
  "success": true,
  "notifications": [ { "id": 100, "title": "Booking Confirmed", "body": "Suresh is on the way!", "isRead": false } ],
  "total": 45,
  "unreadCount": 3,
  "page": 1
}
```

---

### PATCH /api/notifications/read-all
Mark all notifications as read.

**Response 200:**
```json
{ "success": true, "message": "All notifications marked as read" }
```

---

### PATCH /api/notifications/:notificationId/read
Mark a single notification as read.

**Response 200:**
```json
{ "success": true, "notificationId": 100, "isRead": true }
```

Errors: `404` — not found or not owned by the user.

---

## 10. Webhooks

Server-to-server callbacks from Razorpay. Raw body + HMAC-SHA256 signature verification. No JWT auth.

### POST /webhook/razorpay
Razorpay payment webhook.

**Events handled:**
- `payment.captured` — payment successful, booking status updated
- `payment.failed` — payment failed, event logged

**Headers:** `X-Razorpay-Signature` — HMAC-SHA256 over raw body, verified against `WEBHOOK_SECRET`.

| Response | Meaning |
|----------|---------|
| 200 | Processed |
| 401 | Invalid/missing signature |
| 500 | Internal error (Razorpay retries) |

---

### POST /webhook/razorpayx
RazorpayX payout webhook (helper payouts).

**Headers:** `X-Razorpay-Signature` — HMAC-SHA256 verified.

**Response:** `200` on success.

---

## 11. Debug (Dev Only)

> Active only when `NODE_ENV !== 'production'`.

### GET /debug-s3
Test S3 bucket connectivity and list objects.

**Response 200:**
```json
{ "success": true, "bucket": "zynexx-uploads", "objectCount": 42 }
```

---

## 12. Complete Route Summary

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | /api/auth/signup | — | any | Register with phone |
| POST | /api/auth/login | — | any | Login with phone |
| POST | /api/auth/verify-otp | — | any | Verify OTP (customer) |
| POST | /api/auth/helper/verify-otp | — | any | Verify OTP (helper) |
| POST | /api/auth/refresh-token | — | any | Refresh access token |
| POST | /api/auth/logout | JWT | any | Logout |
| POST | /api/booking-requests/create | JWT | any | Create booking request |
| POST | /api/booking-requests/:requestId/accept | JWT | HELPER | Accept request |
| POST | /api/booking-requests/:requestId/reject | JWT | HELPER | Reject request |
| GET | /api/booking-requests/:requestId/status | JWT | any | Request status |
| GET | /api/booking-requests/helper/pending | JWT | HELPER | Helper's pending requests |
| GET | /api/booking-requests/customer/history | JWT | any | Customer request history |
| POST | /api/payments/create-order | JWT | any | Create Razorpay order |
| POST | /api/payments/initiate | JWT | any | Initiate payment |
| POST | /api/payments/verify | JWT | any | Verify payment |
| GET | /api/payments/:paymentId | JWT | any | Payment detail |
| GET | /api/payments | JWT | any | Payment history |
| POST | /api/payments/:paymentId/refund | JWT | ADMIN | Refund payment |
| POST | /api/ratings | JWT | any | Submit rating |
| GET | /api/ratings/service/:serviceId | — | any | Service ratings |
| GET | /api/ratings/helper/:helperId | — | any | Helper ratings |
| GET | /api/ratings/stats/:helperId | — | any | Helper rating stats |
| PUT | /api/ratings/:ratingId | JWT | any | Update rating |
| DELETE | /api/ratings/:ratingId | JWT | any | Delete rating |
| POST | /api/services | JWT | any | Create service |
| GET | /api/services | — | any | List services |
| GET | /api/services/helper/:helperId | — | any | Helper's services |
| GET | /api/services/:serviceId | — | any | Service detail |
| PUT | /api/services/:serviceId | JWT | any | Update service |
| DELETE | /api/services/:serviceId | JWT | any | Delete service |
| GET | /api/user/profile | JWT | any | User profile |
| PUT | /api/user/profile | JWT | any | Update profile |
| POST | /api/user/register-helper | JWT | any | Register as helper |
| PUT | /api/user/bank-details | JWT | any | Update bank details |
| POST | /api/user/upload-photo | JWT | any | Upload profile photo |
| POST | /api/user/upload-kyc | JWT | any | Upload KYC docs |
| GET | /api/user/helper/:helperId | — | any | Helper public profile |
| GET | /api/user/search-helpers | — | any | Search helpers |
| GET | /api/user/bookings | JWT | any | My bookings |
| GET | /api/user/bookings/:bookingId | JWT | any | Booking detail |
| POST | /api/user/bookings/:bookingId/cancel | JWT | any | Cancel booking |
| GET | /api/user/addresses | JWT | any | List addresses |
| POST | /api/user/addresses | JWT | any | Add address |
| PUT | /api/user/addresses/:addressId | JWT | any | Update address |
| DELETE | /api/user/addresses/:addressId | JWT | any | Delete address |
| GET | /api/partner/onboarding/status | JWT | HELPER | Onboarding status |
| POST | /api/partner/onboarding/profile | JWT | HELPER | Submit profile |
| POST | /api/partner/onboarding/kyc | JWT | HELPER | Submit KYC |
| POST | /api/partner/onboarding/bank | JWT | HELPER | Submit bank details |
| POST | /api/partner/kyc/upload-selfie | JWT | HELPER | Upload selfie (Step 1) |
| POST | /api/partner/kyc/verify-pan | JWT | HELPER | Verify PAN image (Step 2) |
| POST | /api/partner/kyc/upload-police | JWT | HELPER | Upload police doc (Step 3) |
| POST | /api/partner/pan/initiate | — | any | Initiate PAN (legacy) |
| POST | /api/partner/pan/verify | — | any | Verify PAN (legacy) |
| GET | /api/partner/pan/status | — | any | PAN status |
| GET | /api/partner/earnings/summary | JWT | HELPER | Earnings summary |
| GET | /api/partner/earnings/history | JWT | HELPER | Earnings history |
| GET | /api/partner/earnings/:bookingId | JWT | HELPER | Booking earning |
| PATCH | /api/partner/ops/status | Approved | HELPER | Toggle online/offline |
| GET | /api/partner/ops/dashboard | Approved | HELPER | Dashboard snapshot |
| GET | /api/partner/ops/discipline | Approved | HELPER | Discipline record |
| POST | /api/partner/location/update | Approved | HELPER | Update GPS location |
| GET | /api/partner/location/route/:bookingId | JWT | any | Real-time route |
| GET | /api/partner/location/current/:bookingId | JWT | any | Current locations |
| GET | /api/partner/location/history/:userId | JWT | any | Location history |
| GET | /api/partner/location/check-range/:bookingId | JWT | any | Check range |
| GET | /api/partner/location/stream/:bookingId | JWT | any | Stream location |
| GET | /api/partner/jobs/user/jobs | JWT | any | User's jobs |
| POST | /api/partner/jobs | JWT | any | Create job |
| GET | /api/partner/jobs/:jobId | — | any | Job detail |
| GET | /api/partner/jobs | — | any | List jobs |
| PUT | /api/partner/jobs/:jobId | JWT | any | Update job |
| DELETE | /api/partner/jobs/:jobId | JWT | any | Delete job |
| GET | /api/partner/bookings | Approved | HELPER | Helper's bookings |
| GET | /api/partner/bookings/:bookingId | Approved | HELPER | Booking detail |
| POST | /api/partner/bookings/:bookingId/start | Approved | HELPER | Start with OTP |
| POST | /api/partner/bookings/:bookingId/regenerate-otp | Approved | HELPER | Re-send OTP |
| POST | /api/partner/bookings/:bookingId/complete | Approved | HELPER | Complete booking |
| POST | /api/partner/bookings/:bookingId/before-photos | Approved | HELPER | Before photos |
| POST | /api/partner/bookings/:bookingId/start-timer | Approved | HELPER | Start timer |
| POST | /api/partner/bookings/:bookingId/after-photos | Approved | HELPER | After photos |
| POST | /api/partner/bookings/:bookingId/report-issue | Approved | HELPER | Report issue |
| GET | /api/partner/reviews | Approved | HELPER | Received reviews |
| GET | /api/partner/bank-details | Approved | HELPER | Bank details |
| GET | /api/partner/address | Approved | HELPER | Service address |
| PUT | /api/partner/address | Approved | HELPER | Update address |
| GET | /api/partner/services | Approved | HELPER | Offered services |
| PUT | /api/partner/services | Approved | HELPER | Update services |
| GET | /api/admin/settings/commission | JWT | ADMIN | Get commission |
| PUT | /api/admin/settings/commission | JWT | ADMIN | Update commission |
| PATCH | /api/admin/platform-settings | JWT | ADMIN | Platform settings |
| GET | /api/admin/services | JWT | ADMIN | List services |
| POST | /api/admin/services | JWT | ADMIN | Create service |
| PATCH | /api/admin/services/:id | JWT | ADMIN | Update service |
| DELETE | /api/admin/services/:id | JWT | ADMIN | Delete service |
| GET | /api/admin/service-plans | JWT | ADMIN | List plans |
| POST | /api/admin/service-plans | JWT | ADMIN | Create plan |
| PATCH | /api/admin/service-plans/:id | JWT | ADMIN | Update plan |
| DELETE | /api/admin/service-plans/:id | JWT | ADMIN | Delete plan |
| GET | /api/admin/bookings | JWT | ADMIN | All bookings |
| GET | /api/admin/bookings/:bookingId | JWT | ADMIN | Booking detail |
| POST | /api/admin/bookings/:bookingId/cancel | JWT | ADMIN | Cancel booking |
| GET | /api/admin/users | JWT | ADMIN | User list |
| GET | /api/admin/users/stats | JWT | ADMIN | User stats |
| GET | /api/admin/users/:userId | JWT | ADMIN | User details |
| POST | /api/admin/users/:userId/block | JWT | ADMIN | Block user |
| POST | /api/admin/users/:userId/unblock | JWT | ADMIN | Unblock user |
| GET | /api/admin/users/:userId/bookings | JWT | ADMIN | User bookings |
| GET | /api/admin/helpers | JWT | ADMIN | Helper list |
| GET | /api/admin/helpers/stats | JWT | ADMIN | Helper stats |
| GET | /api/admin/helpers/:helperId | JWT | ADMIN | Helper details |
| GET | /api/admin/helpers/:helperId/bookings | JWT | ADMIN | Helper bookings |
| PATCH | /api/admin/helpers/:helperId/status | JWT | ADMIN | Update status |
| GET | /api/admin/finance/summary | JWT | ADMIN | Finance summary |
| GET | /api/admin/finance/payouts | JWT | ADMIN | Payout list |
| GET | /api/admin/finance/payouts/:bookingId | JWT | ADMIN | Payout audit |
| POST | /api/admin/onboarding/approve/:helperId | JWT | ADMIN | Approve helper |
| POST | /api/admin/onboarding/reject/:helperId | JWT | ADMIN | Reject helper |
| POST | /api/admin/payout/:bookingId/mark-paid | JWT | ADMIN | Mark payout paid |
| POST | /api/notifications/register-device | JWT | any | Register FCM token |
| DELETE | /api/notifications/register-device | JWT | any | Unregister FCM token |
| GET | /api/notifications | JWT | any | Notification history |
| PATCH | /api/notifications/read-all | JWT | any | Mark all read |
| PATCH | /api/notifications/:notificationId/read | JWT | any | Mark one read |
| POST | /webhook/razorpay | — | server | Razorpay webhook |
| POST | /webhook/razorpayx | — | server | RazorpayX webhook |
| GET | /debug-s3 | — | dev | S3 test (dev only) |

---

*Regenerated from full source scan of all 31 route files in `/src`. Last updated: 2025.*
