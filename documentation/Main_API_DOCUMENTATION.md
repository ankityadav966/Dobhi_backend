# Zynexx Partner Backend — Complete API Documentation

> **Base URL (Production):** `http://3.110.231.111:5001`
> **Content-Type:** `application/json` (all requests unless noted)
> **Authentication:** `Authorization: Bearer <accessToken>` (where required)

---

## Table of Contents

1. [Health Check](#health-check)
2. [Authentication](#authentication)
3. [User (Customer) Routes](#user-customer-routes)
4. [Partner (Helper) Routes](#partner-helper-routes)
   - [Onboarding](#partner-onboarding)
   - [KYC — 3-Step Document Upload](#partner-kyc-document-upload)
   - [PAN Verification (Legacy)](#partner-pan-verification)
   - [Operational](#partner-operational)
   - [Earnings](#partner-earnings)
   - [Location](#partner-location)
   - [Jobs](#partner-jobs)
   - [Bookings](#partner-bookings)
5. [Admin Routes](#admin-routes)
   - [Payout Approval](#admin-payout-approval)
   - [Finance Dashboard](#admin-finance-dashboard)
6. [Financial Ledger System](#financial-ledger-system)
   - [Data Model](#ledger-data-model)
   - [Entry Types](#ledger-entry-types)
   - [Integration Points](#ledger-integration-points)
   - [Internal Services](#ledger-internal-services)
   - [Backfill Script](#ledger-backfill)
7. [Core — Booking Requests](#core--booking-requests)
8. [Core — Payments](#core--payments)
9. [Core — Ratings](#core--ratings)
10. [Core — Services](#core--services)
11. [Webhooks](#webhooks)
12. [Common Error Responses](#common-error-responses)
13. [Route Summary Table](#route-summary-table)

---

## Middleware Glossary

| Middleware | Behaviour |
|---|---|
| `authMiddleware` | Validates JWT access token; rejects with `401` if missing/invalid |
| `checkRole(role)` | Validates `User.role === role` in DB; rejects with `403` |
| `requireApprovedHelper` | `authMiddleware` + `HELPER` role + `onboardingStatus === APPROVED` + not suspended |
| `generalLimiter` | Applied globally to all `/api/*` routes |
| `loginLimiter` | 5 requests per 15 min per IP |
| `signupLimiter` | 5 requests per day per IP |
| `otpLimiter` | 3 requests per 30 min per IP |
| `refreshTokenLimiter` | 10 requests per hour per IP |

---

## CORS Configuration

**File:** `src/middlewares/security.middleware.ts`  
**Applied in:** `src/app.ts` — globally via `app.use(cors(corsOptions))`, registered before all route handlers.

### Allowed Origins

| Origin | Environment |
|---|---|
| `http://localhost:3000` | Development (hard-coded) |
| `http://localhost:3001` | Development (hard-coded) |
| `http://localhost:5173` | Development — Vite dev server (hard-coded) |
| `http://127.0.0.1:3000` | Development (hard-coded) |
| `https://admin.zynexxindia.com` | Production (via `ALLOWED_ORIGINS` env var) |
| `https://zynexxindia.com` | Production (via `ALLOWED_ORIGINS` env var) |

### Behaviour

- **`credentials: true`** — `Authorization` headers and cookies are forwarded.
- **Preflight (`OPTIONS`)** — handled automatically; `optionsSuccessStatus: 200` ensures compatibility with all browsers.
- **Unknown origins** — rejected silently (`callback(null, false)`); a structured warning is written to the logger. `origin: *` is never used.
- **Development vs Production** — In `development`, the hard-coded `DEV_ORIGINS` list is used. In `production`, the middleware reads the `ALLOWED_ORIGINS` environment variable (comma-separated). If `ALLOWED_ORIGINS` is unset in production, all cross-origin requests are blocked and an error is logged.

### Environment Variable (production)

```
ALLOWED_ORIGINS=https://admin.zynexxindia.com,https://zynexxindia.com,http://localhost:3000,http://localhost:5173
```

Set this in your production `.env` / deployment secrets. Multiple origins are comma-separated with no spaces.

### Full CORS options applied

```ts
{
  origin: <dynamic allowlist function>,
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Razorpay-Signature'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'],
  maxAge: 3600,
}
```

---

## Health Check

### `GET /health`

Liveness probe. No authentication. No rate limiting.

**Response `200`**
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2026-02-24T10:00:00.000Z"
}
```

---

## Authentication

**Base path:** `/api/auth`

### Route Summary

| Method | Path | Auth | Rate Limiter | Role |
|---|---|---|---|---|
| POST | `/api/auth/signup` | No | signupLimiter | Public |
| POST | `/api/auth/login` | No | loginLimiter | Public |
| POST | `/api/auth/verify-otp` | No | otpLimiter | Public |
| POST | `/api/auth/helper/verify-otp` | No | otpLimiter | Public |
| POST | `/api/auth/refresh-token` | No | refreshTokenLimiter | Public |
| POST | `/api/auth/logout` | Yes | generalLimiter | Any |

---

### `POST /api/auth/signup`

Request OTP to begin a customer signup / login flow. Accounts are created on first OTP verification.

**Rate limit:** 5 per day per IP.

**Request Body**

| Field | Type | Required | Validation |
|---|---|---|---|
| `phone` | string | Yes | 10-digit Indian mobile (starts 6–9) |

```json
{ "phone": "9876543210" }
```

**Response `200`**
```json
{
  "success": true,
  "message": "If the number is valid, OTP has been sent",
  "phone": "9876543210",
  "expiresIn": 600
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"Valid 10-digit Indian phone number required"` |
| 429 | Rate limit exceeded |
| 500 | `"Failed to send OTP"` |

---

### `POST /api/auth/login`

Request an OTP for login. Unified OTP entry point (same as signup).

**Rate limit:** 5 per 15 min per IP.

**Request Body**

| Field | Type | Required | Validation |
|---|---|---|---|
| `phone` | string | Yes | 10-digit Indian mobile |

```json
{ "phone": "9876543210" }
```

**Response `200`**
```json
{
  "success": true,
  "message": "If the number is valid, OTP has been sent",
  "phone": "9876543210",
  "expiresIn": 600
}
```

---

### `POST /api/auth/verify-otp`

Verify OTP for **customer** (`CUSTOMER` role). Creates a `User` record if new; issues access + refresh tokens.

**Rate limit:** 3 per 30 min per IP.

**Request Body**

| Field | Type | Required | Validation |
|---|---|---|---|
| `phone` | string | Yes | 10-digit Indian mobile |
| `otp` | string | Yes | 4–6 numeric digits |

```json
{
  "phone": "9876543210",
  "otp": "1234"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
    "user": {
      "id": 1,
      "phone": "9876543210",
      "role": "CUSTOMER",
      "isNewUser": false
    }
  }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"Invalid or expired OTP"` |
| 429 | Rate limit exceeded |

---

### `POST /api/auth/helper/verify-otp`

Verify OTP for **helper** (`HELPER` role). Creates `User` + `Helper` records if new.

**Rate limit:** 3 per 30 min per IP.

**Request Body**

| Field | Type | Required | Validation |
|---|---|---|---|
| `phone` | string | Yes | 10-digit Indian mobile |
| `otp` | string | Yes | 4–6 numeric digits |

```json
{
  "phone": "9876543210",
  "otp": "5678"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
    "user": {
      "id": 2,
      "phone": "9876543210",
      "role": "HELPER",
      "isNewUser": true
    }
  }
}
```

---

### `POST /api/auth/refresh-token`

Exchange a valid refresh token for a new access token. Refresh token TTL: 7 days; access token TTL: 15 minutes.

**Rate limit:** 10 per hour per IP.

**Request Body**

| Field | Type | Required |
|---|---|---|
| `refreshToken` | string | Yes |

```json
{ "refreshToken": "eyJhbGciOiJIUzI1NiJ9..." }
```

**Response `200`**
```json
{
  "success": true,
  "data": { "accessToken": "eyJhbGciOiJIUzI1NiJ9..." }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 401 | `"Invalid or expired refresh token"` |

---

### `POST /api/auth/logout`

Blacklists the current refresh token.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body**

| Field | Type | Required |
|---|---|---|
| `refreshToken` | string | Yes |

```json
{ "refreshToken": "eyJhbGciOiJIUzI1NiJ9..." }
```

**Response `200`**
```json
{ "success": true, "message": "Logged out successfully" }
```

---

## User (Customer) Routes

**Base path:** `/api/user`

### Route Summary

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | `/api/user/profile` | Yes | Customer |
| PUT | `/api/user/profile` | Yes | Customer |
| POST | `/api/user/register-helper` | Yes | Customer |
| PUT | `/api/user/bank-details` | Yes | Customer |
| POST | `/api/user/upload-photo` | Yes | Customer |
| POST | `/api/user/upload-kyc` | Yes | Customer |
| GET | `/api/user/helper/:helperId` | No | Public |
| GET | `/api/user/search-helpers` | No | Public |
| GET | `/api/user/bookings` | Yes | Customer |
| GET | `/api/user/bookings/:bookingId` | Yes | Customer / Helper (own booking) / Admin |
| POST | `/api/user/bookings/:bookingId/cancel` | Yes | Customer |
| GET | `/api/user/address` | Yes | Customer |
| PUT | `/api/user/address` | Yes | Customer |

---

### `GET /api/user/profile`

Returns the authenticated user profile including helper sub-record (if applicable).

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "phone": "9876543210",
    "fullName": "Ravi Kumar",
    "avatar": null,
    "role": "CUSTOMER",
    "isActive": true,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "helper": null
  }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 401 | `"Unauthorized"` |
| 404 | `"User not found"` |

---

### `PUT /api/user/profile`

Update the authenticated user profile. All fields optional.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body**

| Field | Type | Validation |
|---|---|---|
| `fullName` | string | 2–100 chars |
| `email` | string | Valid email |
| `address` | string | 5–200 chars |
| `city` | string | 2–50 chars |
| `pinCode` | string | 6 digits |

```json
{
  "fullName": "Ravi Kumar",
  "email": "ravi@example.com"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": { "id": 1, "phone": "9876543210", "fullName": "Ravi Kumar", "avatar": null }
}
```

---

### `POST /api/user/register-helper`

Upgrade a CUSTOMER account to register as a HELPER.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body**

| Field | Type | Required | Validation |
|---|---|---|---|
| `phone` | string | Yes | 10-digit Indian mobile |
| `fullName` | string | Yes | 2–100 chars |
| `gender` | string | No | `MALE`, `FEMALE`, `OTHER` |
| `address` | string | Yes | 5–200 chars |
| `city` | string | Yes | 2–50 chars |
| `pinCode` | string | Yes | 6 digits |

```json
{
  "phone": "9876543210",
  "fullName": "Ravi Kumar",
  "gender": "MALE",
  "address": "12 Main Street",
  "city": "Mumbai",
  "pinCode": "400001"
}
```

**Response `200`**
```json
{ "success": true, "message": "Registered as helper successfully" }
```

---

### `PUT /api/user/bank-details`

Save or update bank account information.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body**

| Field | Type | Required | Validation |
|---|---|---|---|
| `bankAccountName` | string | Yes | 3–100 chars |
| `bankAccountNumber` | string | Yes | 9–18 digits |
| `bankIFSCCode` | string | Yes | e.g. `SBIN0001234` |
| `bankName` | string | Yes | 2–100 chars |
| `accountType` | string | Yes | `SAVINGS` or `CURRENT` |

```json
{
  "bankAccountName": "Ravi Kumar",
  "bankAccountNumber": "123456789012",
  "bankIFSCCode": "SBIN0001234",
  "bankName": "State Bank of India",
  "accountType": "SAVINGS"
}
```

**Response `200`**
```json
{ "success": true, "message": "Bank details updated successfully" }
```

---

### `POST /api/user/upload-photo`

Upload profile photo. Send as `multipart/form-data`.

**Headers:** `Authorization: Bearer <accessToken>`, `Content-Type: multipart/form-data`

**Form Field:** `file` — image file

**Response `200`**
```json
{
  "success": true,
  "message": "Profile photo uploaded successfully",
  "data": { "id": 1, "avatar": "/uploads/photo-uuid.jpg" }
}
```

---

### `POST /api/user/upload-kyc`

Upload KYC documents. Send as `multipart/form-data`.

**Headers:** `Authorization: Bearer <accessToken>`, `Content-Type: multipart/form-data`

**Form Fields:** Check controller implementation for exact field names.

---

### `GET /api/user/helper/:helperId`

Get public details of a specific helper.

**Path Parameter:** `helperId` — integer

**Response `200`**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "rating": 4.7,
    "totalRatings": 23,
    "isAvailable": true,
    "user": { "fullName": "Suresh Patel" },
    "profile": { "experienceYears": 4, "city": "Pune", "workType": "FULL_TIME" },
    "helperServices": [{ "service": { "id": 3, "name": "Plumbing" } }]
  }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 404 | `"Helper not found"` |

---

### `GET /api/user/search-helpers`

Search available helpers.

**Query Parameters**

| Parameter | Type | Description |
|---|---|---|
| `city` | string | Filter by city |
| `serviceId` | integer | Filter by service |
| `page` | integer | Page number |
| `limit` | integer | Per page (1–100) |

**Response `200`**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": { "page": 1, "limit": 10, "total": 42 }
}
```

---

### `GET /api/user/bookings`

Get the authenticated customer's bookings (paginated).

**Headers:** `Authorization: Bearer <accessToken>`

**Query Parameters:** `status`, `page`, `limit`

**Response `200`**
```json
{
  "success": true,
  "data": [
    { "id": 101, "status": "CONFIRMED", "city": "Mumbai", "totalAmount": 1200.00 }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 5 }
}
```

---

### `GET /api/user/bookings/:bookingId`

Get a single booking by ID. Requires authentication. Only the **customer who owns the booking**, the **assigned helper**, or an **ADMIN** may access it.

**Headers:** `Authorization: Bearer <accessToken>`

**Path Parameter:** `bookingId` — positive integer

**Response `200`**
```json
{
  "success": true,
  "data": { "id": 101, "status": "CONFIRMED", "totalAmount": 1200.00 }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"Invalid booking ID format"` |
| 401 | `"Unauthorized"` |
| 403 | `"Forbidden"` |
| 404 | `"Booking not found"` |

---

### `POST /api/user/bookings/:bookingId/cancel`

Customer cancels their own booking.

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{ "success": true, "message": "Booking cancelled successfully" }
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | Cannot cancel in current status |
| 401 | `"Unauthorized"` |
| 403 | Not your booking |
| 404 | Booking not found |

---

### `GET /api/user/address`

Returns the authenticated user's saved address. All fields are `null` if no address has been set yet.

**Auth:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{
  "success": true,
  "data": {
    "address": "123 MG Road",
    "city": "Mumbai",
    "pinCode": "400001",
    "latitude": 19.0760,
    "longitude": 72.8777
  }
}
```

---

### `PUT /api/user/address`

Save or update the authenticated user's address.

**Auth:** `Authorization: Bearer <accessToken>`

**Request Body**

| Field | Type | Required | Validation |
|---|---|---|---|
| `address` | string | ✅ | Non-empty |
| `city` | string | ✅ | Non-empty |
| `pinCode` | string | ✅ | Non-empty, max 10 chars |
| `latitude` | float | ❌ | Valid float |
| `longitude` | float | ❌ | Valid float |

```json
{
  "address": "123 MG Road",
  "city": "Mumbai",
  "pinCode": "400001",
  "latitude": 19.0760,
  "longitude": 72.8777
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Address updated successfully"
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"address is required"` |
| 400 | `"city is required"` |
| 400 | `"pinCode is required"` |
| 400 | `"pinCode must be at most 10 characters"` |
| 401 | `"Unauthorized"` |
| 404 | `"User not found"` |
| 500 | `"Failed to update address"` |

---

## Partner (Helper) Routes

**Base path:** `/api/partner`

---

## Partner Onboarding

### Route Summary

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | `/api/partner/onboarding/status` | Yes | Helper |
| POST | `/api/partner/onboarding/profile` | Yes | Helper |
| POST | `/api/partner/onboarding/kyc` | Yes | Helper |
| POST | `/api/partner/onboarding/bank` | Yes | Helper |

---

### `GET /api/partner/onboarding/status`

Returns current onboarding status.

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{
  "success": true,
  "data": {
    "onboardingStatus": "PENDING_KYC",
    "steps": { "profile": true, "kyc": false, "bank": false }
  }
}
```

---

### `POST /api/partner/onboarding/profile`

Submit or update helper profile (Step 1 of onboarding). All fields optional.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body**

| Field | Type | Description |
|---|---|---|
| `gender` | string | `MALE`, `FEMALE`, `OTHER` |
| `address` | string | 5–200 chars |
| `city` | string | 2–50 chars |
| `pinCode` | string | 6 digits |
| `workType` | string | e.g. `FULL_TIME`, `PART_TIME` |
| `experienceYears` | integer | Years of experience |
| `serviceIds` | integer[] | Array of service IDs |
| `latitude` | float | -90 to 90 |
| `longitude` | float | -180 to 180 |

```json
{
  "gender": "MALE",
  "address": "45 Helper Lane",
  "city": "Pune",
  "pinCode": "411001",
  "workType": "FULL_TIME",
  "experienceYears": 3,
  "serviceIds": [1, 3],
  "latitude": 18.5204,
  "longitude": 73.8567
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Profile saved successfully.",
  "data": { "helperId": 5, "onboardingStatus": "PENDING_KYC" }
}
```

---

### `POST /api/partner/onboarding/kyc`

> ⚠️ **Deprecated flow.** The new production KYC flow is a 3-step image-based process at `/api/partner/kyc/*` (see [KYC — 3-Step Document Upload](#partner-kyc-document-upload)). This endpoint accepts JSON metadata but does not handle file uploads directly.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `panNumber` | string | Yes | `ABCDE1234F` format |
| `selfieUrl` | string | No | Pre-uploaded S3 URL to selfie |
| `panUrl` | string | No | Pre-uploaded S3 URL to PAN card image |
| `policeUrl` | string | No | Pre-uploaded S3 URL to police verification |

**Response `200`**
```json
{
  "success": true,
  "message": "KYC submitted successfully",
  "data": { "verificationStatus": "IN_PROGRESS", "onboardingStatus": "PENDING_ADMIN" }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"Invalid PAN format"` |
| 400 | `"PAN already registered with another helper"` |

---

### `POST /api/partner/onboarding/bank`

Submit bank account details (Step 3).

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body**

| Field | Type | Required | Validation |
|---|---|---|---|
| `bankAccountName` | string | Yes | 3–100 chars |
| `bankAccountNumber` | string | Yes | 9–18 digits |
| `bankIFSCCode` | string | Yes | IFSC format |
| `bankName` | string | Yes | 2–100 chars |
| `accountType` | string | Yes | `SAVINGS` or `CURRENT` |

```json
{
  "bankAccountName": "Suresh Patel",
  "bankAccountNumber": "123456789012",
  "bankIFSCCode": "HDFC0001234",
  "bankName": "HDFC Bank",
  "accountType": "SAVINGS"
}
```

**Response `200`** — Razorpay fund account registration succeeded
```json
{
  "success": true,
  "message": "Bank details saved.",
  "payoutRegistered": true,
  "payoutSetupStatus": "ACTIVE",
  "data": { "helperId": 12, "bank": { "..." } }
}
```

**Response `200`** — Razorpay registration failed (non-fatal; retry cron will attempt)
```json
{
  "success": true,
  "message": "Bank details saved.",
  "payoutRegistered": false,
  "payoutSetupStatus": "PENDING",
  "data": { "helperId": 12, "bank": { "..." } }
}
```

> **Note:** `payoutRegistered: false` does NOT block helper approval or go-live. The payout registration retry cron runs every 30 minutes and will attempt Razorpay Contact + Fund Account creation automatically.

| Field | Description |
|---|---|
| `payoutRegistered` | `true` if Razorpay Contact + Fund Account were created successfully |
| `payoutSetupStatus` | `ACTIVE` \| `PENDING` \| `FAILED` (max 5 retries before FAILED) |

---

## Partner KYC — 3-Step Document Upload

<a id="partner-kyc-document-upload"></a>

> All KYC routes require `Authorization: Bearer <accessToken>` with `role = HELPER`.
> Files are sent as `multipart/form-data` with field name `file`.
> Steps **must** be completed in order: selfie → PAN → police doc.

**Base path:** `/api/partner/kyc`

### Route Summary

| Method | Path | Auth | Role | Accepts |
|---|---|---|---|---|
| POST | `/api/partner/kyc/upload-selfie` | Yes | Helper | JPEG, PNG |
| POST | `/api/partner/kyc/verify-pan` | Yes | Helper | JPEG, PNG |
| POST | `/api/partner/kyc/upload-police` | Yes | Helper | JPEG, PNG, PDF |

---

### `POST /api/partner/kyc/upload-selfie`

**Step 1** — Upload a photo of the helper. Must be done before PAN verification.

**Headers:** `Authorization: Bearer <accessToken>`

**Request:** `multipart/form-data`

| Field | Type | Required |
|---|---|---|
| `file` | image (JPEG/PNG) | Yes |

**Response `200`**
```json
{
  "success": true,
  "data": { "selfieUrl": "https://zynexx-kyc-prod.s3.ap-south-1.amazonaws.com/partner/5/selfie/..." }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"No file uploaded"` |
| 401 | `"Unauthorized"` |
| 403 | `"Helper profile not found"` |
| 409 | `"Partner is already approved"` |
| 500 | `"Failed to upload selfie"` |

---

### `POST /api/partner/kyc/verify-pan`

**Step 2** — Upload PAN card image. Runs IDFY OCR + verification pipeline:
1. Requires selfie already uploaded (Step 1).
2. Uploads PAN image to S3 — `panUrl` is stored immediately.
3. Extracts PAN number + name via IDFY OCR.
4. Validates PAN format.
5. Verifies PAN with IDFY.
6. Compares name similarity against registered `fullName` (threshold 80% = VERIFIED, 60%+ = REVIEW).
7. Persists `verificationStatus`, `panNumber`, `nameMatchScore`, IDFY raw response.

> **IDFY bypass mode:** When `ENABLE_IDFY_OCR=false`, OCR is skipped. The PAN image is uploaded to S3 and `verificationStatus` is set to `REVIEW` for manual admin review.

**Headers:** `Authorization: Bearer <accessToken>`

**Request:** `multipart/form-data`

| Field | Type | Required |
|---|---|---|
| `file` | image (JPEG/PNG) of PAN card | Yes |

**Response `200` — VERIFIED**
```json
{
  "success": true,
  "verificationStatus": "VERIFIED",
  "panMasked": "ABCDE****F"
}
```

**Response `200` — REVIEW (name score 60–79%)**
```json
{
  "success": true,
  "verificationStatus": "REVIEW",
  "message": "PAN is under manual review"
}
```

**Response `200` — BYPASS MODE (`ENABLE_IDFY_OCR=false`)**
```json
{
  "success": true,
  "message": "PAN uploaded successfully. Verification pending manual review.",
  "data": { "panUrl": "https://zynexx-kyc-prod.s3.ap-south-1.amazonaws.com/partner/5/pan/..." }
}
```

**Response `202` — IN_PROGRESS (IDFY network/infra failure)**
```json
{
  "success": true,
  "verificationStatus": "IN_PROGRESS"
}
```

**Error Responses**

| Status | Code | Message |
|---|---|---|
| 400 | — | `"No file uploaded"` |
| 400 | — | `"Unable to read PAN card — please upload a clear, well-lit photo"` |
| 400 | — | `"Invalid PAN format detected — please upload the correct document"` |
| 400 | — | `"PAN card is invalid"` |
| 422 | `SELFIE_REQUIRED` | `"Selfie must be uploaded before PAN verification"` |
| 500 | — | `"PAN verification failed"` |

---

### `POST /api/partner/kyc/upload-police`

**Step 3** — Upload police verification document.
Requires `verificationStatus === VERIFIED` from Step 2 (PAN must pass).

**Headers:** `Authorization: Bearer <accessToken>`

**Request:** `multipart/form-data`

| Field | Type | Required |
|---|---|---|
| `file` | image (JPEG/PNG) or PDF | Yes |

**Response `200`**
```json
{
  "success": true,
  "data": { "policeUrl": "https://zynexx-kyc-prod.s3.ap-south-1.amazonaws.com/partner/5/police/..." }
}
```

**Error Responses**

| Status | Code | Message |
|---|---|---|
| 400 | — | `"No file uploaded"` |
| 403 | `PAN_VERIFICATION_REQUIRED` | `"PAN verification must be completed and approved before uploading police document"` |
| 500 | — | `"Failed to upload police document"` |

---

## Partner PAN Verification (Legacy)

> These routes exist for standalone PAN verification flows. `authMiddleware` is **not** applied on this router in the current configuration.

### Route Summary

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/partner/pan/initiate` | No | Start PAN verification |
| POST | `/api/partner/pan/verify` | No | Confirm result via requestId |
| GET | `/api/partner/pan/status` | No | Current PAN status |

---

### `POST /api/partner/pan/initiate`

**Request Body**

| Field | Type | Required | Validation |
|---|---|---|---|
| `panNumber` | string | Yes | `[A-Z]{5}[0-9]{4}[A-Z]` |
| `fullName` | string | Yes | Non-empty |
| `dateOfBirth` | string | Yes | `YYYY-MM-DD` |

```json
{
  "panNumber": "ABCDE1234F",
  "fullName": "Suresh Patel",
  "dateOfBirth": "1990-05-15"
}
```

**Response `200`**
```json
{
  "success": true,
  "data": { "requestId": "idfy-req-uuid", "status": "IN_PROGRESS" }
}
```

---

### `POST /api/partner/pan/verify`

**Request Body**

| Field | Type | Required |
|---|---|---|
| `requestId` | string | Yes |

```json
{ "requestId": "idfy-req-uuid" }
```

**Response `200`**
```json
{ "success": true, "data": { "status": "VERIFIED", "nameMatch": 95 } }
```

---

### `GET /api/partner/pan/status`

**Response `200`**
```json
{ "success": true, "data": { "status": "VERIFIED" } }
```

---

## Partner Operational

> All require `requireApprovedHelper` — valid JWT + HELPER role + `onboardingStatus = APPROVED` + not suspended.

### Route Summary

| Method | Path | Auth | Role |
|---|---|---|---|
| PATCH | `/api/partner/status` | Yes | Approved Helper |
| GET | `/api/partner/dashboard` | Yes | Approved Helper |
| GET | `/api/partner/discipline` | Yes | Approved Helper |

---

### `PATCH /api/partner/status`

Toggle helper online/offline.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `isOnline` | boolean | Yes | `true` = online |
| `force` | boolean | No | `true` allows going offline mid-job |

```json
{ "isOnline": true }
```

**Response `200`**
```json
{ "success": true, "message": "Status updated", "data": { "isOnline": true } }
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | Cannot go offline with active job (use `force: true`) |
| 403 | Not an approved helper |

---

### `GET /api/partner/dashboard`

Unified operational snapshot.

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{
  "success": true,
  "data": {
    "helper": { "id": 5, "fullName": "Suresh Patel", "isOnline": true },
    "suspensionStatus": null,
    "activeBooking": null,
    "upcomingBooking": { "id": 101, "status": "CONFIRMED" },
    "pendingRequestCount": 2,
    "todayCompletedJobs": 3,
    "earningsSummary": { "today": 1200.00, "thisWeek": 5600.00 },
    "discipline": { "strikes": 0, "noShow": 0, "cancels": 1 }
  }
}
```

---

### `GET /api/partner/discipline`

Detailed discipline record.

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{
  "success": true,
  "data": {
    "strikes": 0,
    "noShow": 0,
    "cancels": 1,
    "ignores": 0,
    "penalty": 0,
    "lastStrikeAt": null,
    "suspensionWindow": null,
    "recentCancelledBookings": []
  }
}
```

---

## Partner Earnings

> All require `authMiddleware` + `checkRole(HELPER)`.

### Route Summary

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | `/api/partner/earnings/summary` | Yes | Helper |
| GET | `/api/partner/earnings/history` | Yes | Helper |
| GET | `/api/partner/earnings/:bookingId` | Yes | Helper |

---

### `GET /api/partner/earnings/summary`

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{
  "success": true,
  "data": {
    "today": 1200.00,
    "thisWeek": 5600.00,
    "thisMonth": 18900.00,
    "total": 124500.00,
    "pendingPayout": 3200.00
  }
}
```

---

### `GET /api/partner/earnings/history`

**Headers:** `Authorization: Bearer <accessToken>`

**Query Parameters:** `page`, `limit`, `status`

**Response `200`**
```json
{
  "success": true,
  "data": [
    { "bookingId": 101, "amount": 900.00, "status": "RELEASED", "createdAt": "2026-02-01T10:00:00.000Z" }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 25 }
}
```

---

### `GET /api/partner/earnings/:bookingId`

**Headers:** `Authorization: Bearer <accessToken>`

**Path Parameter:** `bookingId` — integer

**Response `200`**
```json
{
  "success": true,
  "data": {
    "bookingId": 101,
    "grossAmount": 1200.00,
    "platformFee": 240.00,
    "netAmount": 960.00,
    "escrowStatus": "RELEASED",
    "payoutStatus": "PAID"
  }
}
```

---

## Partner Location

### Route Summary

| Method | Path | Auth | Role |
|---|---|---|---|
| POST | `/api/partner/location/update` | Yes | Approved Helper |
| GET | `/api/partner/location/route/:bookingId` | Yes | Customer or Helper |
| GET | `/api/partner/location/current/:bookingId` | Yes | Customer or Helper |
| GET | `/api/partner/location/history/:userId` | Yes | Any authenticated |
| GET | `/api/partner/location/check-range/:bookingId` | Yes | Any authenticated |
| GET | `/api/partner/location/stream/:bookingId` | Yes | Any authenticated |

---

### `POST /api/partner/location/update`

Update helper's real-time GPS coordinates. Each call upserts both `HelperProfile` (lat/lng) and the dedicated `HelperLocation` row used for live tracking and dispatch.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body**

| Field | Type | Required | Validation |
|---|---|---|---|
| `latitude` | float | Yes | -90 to 90 |
| `longitude` | float | Yes | -180 to 180 |
| `accuracy` | float | No | Positive number (metres) |
| `heading` | float | No | Degrees 0–360 |
| `speed` | float | No | m/s |

```json
{ "latitude": 18.5204, "longitude": 73.8567, "accuracy": 10.5, "heading": 90.0, "speed": 5.2 }
```

**Response `200`**
```json
{
  "success": true,
  "message": "Location updated successfully",
  "data": { "latitude": 18.5204, "longitude": 73.8567, "accuracy": 10.5, "timestamp": "2026-02-24T10:00:00.000Z" }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"Latitude and longitude are required"` |
| 400 | `"Invalid coordinates range"` |
| 403 | Not an approved helper |
| 404 | `"User not found"` |

---

### `GET /api/partner/location/route/:bookingId`

Real-time route between customer and helper. Accessible by either party.

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{
  "success": true,
  "data": {
    "route": {
      "userLocation": { "lat": 18.52, "lng": 73.85 },
      "partnerLocation": { "lat": 18.53, "lng": 73.86 }
    },
    "bookingStatus": "IN_PROGRESS",
    "distance": 1.4
  }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 403 | `"You do not have access to this booking"` |
| 404 | `"Location data not available"` |

---

### `GET /api/partner/location/current/:bookingId`

Returns the helper's latest live location from the `HelperLocation` table. Returns `404` if no helper is assigned to the booking or the helper has not yet sent a location update.

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{
  "success": true,
  "data": {
    "helperId":  12,
    "latitude":  18.5204,
    "longitude": 73.8567,
    "updatedAt": "2026-03-07T11:00:00.000Z"
  }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 403 | `"You do not have access to this booking"` |
| 404 | `"Booking not found"` |
| 404 | `"Helper location not available yet"` — helper assigned but has not pinged yet |

---

### `GET /api/partner/location/history/:userId`

Location history for a user.

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{
  "success": true,
  "data": [ { "lat": 18.52, "lng": 73.85, "timestamp": "2026-02-24T09:00:00.000Z" } ]
}
```

---

### `GET /api/partner/location/check-range/:bookingId`

Check if helper is within service range for the booking.

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{ "success": true, "data": { "inRange": true, "distance": 0.8, "threshold": 1.0 } }
```

---

### `GET /api/partner/location/stream/:bookingId`

Server-Sent Events stream of live location updates.

**Headers:** `Authorization: Bearer <accessToken>`

**Response:** `text/event-stream`

```
data: {"lat":18.52,"lng":73.85,"timestamp":"2026-02-24T10:00:01.000Z"}
```

---

## Partner Jobs

### Route Summary

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | `/api/partner/jobs/user/jobs` | Yes | Any authenticated |
| POST | `/api/partner/jobs` | Yes | Any authenticated |
| GET | `/api/partner/jobs/:jobId` | No | Public |
| GET | `/api/partner/jobs` | No | Public |
| PUT | `/api/partner/jobs/:jobId` | Yes | Any authenticated |
| DELETE | `/api/partner/jobs/:jobId` | Yes | Any authenticated |

---

### `GET /api/partner/jobs/user/jobs`

Jobs created by the authenticated user.

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{ "success": true, "data": [ ... ] }
```

---

### `POST /api/partner/jobs`

Create a new job listing.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body**

| Field | Type | Required | Validation |
|---|---|---|---|
| `jobTitle` | string | Yes | 3–100 chars |
| `jobDescription` | string | No | Max 1000 chars |
| `address` | string | Yes | 5–200 chars |
| `city` | string | Yes | 2–50 chars |
| `pinCode` | string | Yes | 6 digits |
| `jobDate` | string (ISO8601) | Yes | Future date |
| `timeSlot` | string | Yes | Non-empty |
| `estimatedHours` | integer | Yes | 1–100 |
| `estimatedBudget` | float | Yes | ≥ 0 |

```json
{
  "jobTitle": "Bathroom plumbing repair",
  "address": "12 Main Street",
  "city": "Mumbai",
  "pinCode": "400001",
  "jobDate": "2026-03-01T09:00:00.000Z",
  "timeSlot": "09:00 AM - 12:00 PM",
  "estimatedHours": 3,
  "estimatedBudget": 1500.00
}
```

**Response `201`**
```json
{ "success": true, "message": "Job created successfully", "data": { "id": 10 } }
```

---

### `GET /api/partner/jobs/:jobId`

Get a job by ID (public).

**Response `200`**
```json
{ "success": true, "data": { "id": 10, "jobTitle": "Bathroom plumbing repair" } }
```

---

### `GET /api/partner/jobs`

List all available jobs.

**Query Parameters:** `page`, `limit`, `city`, `serviceId`

**Response `200`**
```json
{ "success": true, "data": [ ... ], "pagination": { "page": 1, "limit": 10, "total": 100 } }
```

---

### `PUT /api/partner/jobs/:jobId`

Update a job listing.

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{ "success": true, "message": "Job updated successfully" }
```

---

### `DELETE /api/partner/jobs/:jobId`

Delete a job listing.

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{ "success": true, "message": "Job deleted successfully" }
```

---

## Partner Bookings

> Write routes require `requireApprovedHelper`. GET `/:bookingId` is public.

### Route Summary

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | `/api/partner/bookings` | Yes | Approved Helper |
| GET | `/api/partner/bookings/:bookingId` | Yes | Customer / Helper (own booking) / Admin |
| POST | `/api/partner/bookings/:bookingId/start` | Yes | Approved Helper |
| POST | `/api/partner/bookings/:bookingId/regenerate-otp` | Yes | Approved Helper |
| POST | `/api/partner/bookings/:bookingId/complete` | Yes | Approved Helper |
| POST | `/api/partner/bookings/:bookingId/before-photos` | Yes | Approved Helper |
| POST | `/api/partner/bookings/:bookingId/start-timer` | Yes | Approved Helper |
| POST | `/api/partner/bookings/:bookingId/after-photos` | Yes | Approved Helper |
| POST | `/api/partner/bookings/:bookingId/report-issue` | Yes | Approved Helper |

---

### `GET /api/partner/bookings`

Helper's assigned bookings (paginated).

**Headers:** `Authorization: Bearer <accessToken>`

**Query Parameters:** `status`, `page`, `limit`

**Response `200`**
```json
{
  "success": true,
  "data": [{ "id": 101, "status": "CONFIRMED", "city": "Mumbai", "totalAmount": 1200.00 }],
  "pagination": { "page": 1, "limit": 10, "total": 8 }
}
```

---

### `GET /api/partner/bookings/:bookingId`

Get a single booking by ID. Requires authentication. Only the **customer who owns the booking**, the **assigned helper**, or an **ADMIN** may access it.

**Headers:** `Authorization: Bearer <accessToken>`

**Path Parameter:** `bookingId` — positive integer

**Response `200`**
```json
{ "success": true, "data": { "id": 101, "status": "CONFIRMED" } }
```

**Error Responses**

| Status | Message |
|---|---|
| 401 | `"Unauthorized"` |
| 403 | `"Forbidden"` |
| 404 | `"Booking not found"` |

---

### `POST /api/partner/bookings/:bookingId/start`

OTP-based service start. Transitions `CONFIRMED` → `IN_PROGRESS`.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body**

| Field | Type | Required | Validation |
|---|---|---|---|
| `otp` | string | Yes | Exactly 4 numeric digits |

```json
{ "otp": "4729" }
```

**Response `200`**
```json
{
  "success": true,
  "message": "Booking started successfully",
  "data": { "bookingId": 101, "status": "IN_PROGRESS" }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"OTP must be a 4-digit numeric string"` |
| 400 | `"Booking must be CONFIRMED to start"` |
| 400 | `"Start OTP has not been generated for this booking"` |
| 400 | `"Maximum OTP attempts reached. Please contact support."` |
| 400 | `"Incorrect OTP"` |
| 400 | `"OTP has expired"` |
| 403 | `"Helper profile not found"` |
| 403 | `"Not authorized: You are not the assigned helper for this booking"` |
| 404 | `"Booking not found"` |

---

### `POST /api/partner/bookings/:bookingId/regenerate-otp`

Request a fresh OTP (valid 30 min). Booking must be `CONFIRMED`.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:** None required.

**Response `200`**
```json
{
  "success": true,
  "message": "New OTP generated successfully",
  "data": { "bookingId": 101, "otpExpiry": "2026-02-24T11:00:00.000Z" }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"OTP regeneration is only allowed for CONFIRMED bookings"` |
| 403 | `"Helper profile not found"` |
| 403 | `"Not authorized: You are not the assigned helper"` |
| 404 | `"Booking not found"` |

---

### `POST /api/partner/bookings/:bookingId/complete`

Mark `IN_PROGRESS` booking as `COMPLETED`. Triggers payout release.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:** None required.

**Response `200`**
```json
{
  "success": true,
  "message": "Booking completed successfully",
  "data": { "bookingId": 101, "status": "COMPLETED" }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"Booking must be in IN_PROGRESS status"` |
| 403 | `"Helper profile not found"` |
| 403 | `"Only the assigned helper can complete this booking"` |
| 404 | `"Booking not found"` |

---

### `POST /api/partner/bookings/:bookingId/before-photos`

Upload **before-work photos** for an `IN_PROGRESS` booking. Must be called before starting the job timer.

**Headers:** `Authorization: Bearer <accessToken>`

**Content-Type:** `multipart/form-data`

**Form Field:** `photos` — 1 to 5 image files (JPEG or PNG, max 5 MB each)

Photos are uploaded to S3 at `partner/<helperId>/work-photos/<bookingId>/before/` and stored in `BookingWorkPhoto` with `type = BEFORE`.

**Response `201`**
```json
{
  "success": true,
  "message": "Before work photos uploaded",
  "data": {
    "photos": [
      {
        "id": 1,
        "photoUrl": "https://s3.ap-south-1.amazonaws.com/zynexx/partner/12/work-photos/101/before/uuid.jpg",
        "type": "BEFORE",
        "createdAt": "2026-03-06T08:00:00.000Z"
      }
    ]
  }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"At least one photo is required"` |
| 400 | `"Maximum 5 photos allowed per upload"` |
| 400 | `"Only JPEG and PNG images are allowed"` (multer) |
| 403 | `"Helper profile not found"` |
| 403 | `"You are not the assigned helper for this booking"` |
| 404 | `"Booking not found"` |
| 409 | `"Before photos can only be uploaded when booking is IN_PROGRESS"` |

---

### `POST /api/partner/bookings/:bookingId/start-timer`

Start the **job timer** for an `IN_PROGRESS` booking. Requires at least one `BEFORE` photo to have been uploaded. Can only be called once per booking.

Sets `jobTimerStarted = true` and records `jobStartedAt` timestamp on the booking.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:** None.

**Response `200`**
```json
{
  "success": true,
  "message": "Job timer started",
  "data": {
    "jobStartedAt": "2026-03-06T08:05:00.000Z"
  }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 403 | `"Helper profile not found"` |
| 403 | `"You are not the assigned helper for this booking"` |
| 404 | `"Booking not found"` |
| 409 | `"Job timer can only be started when booking is IN_PROGRESS"` |
| 409 | `"Job timer has already been started for this booking"` |
| 422 | `"Before photos must be uploaded before starting the job timer"` |

---

### `POST /api/partner/bookings/:bookingId/after-photos`

Upload **after-work completion photos** for an `IN_PROGRESS` booking. Requires the job timer to have been started first.

**Headers:** `Authorization: Bearer <accessToken>`

**Content-Type:** `multipart/form-data`

**Form Field:** `photos` — 1 to 5 image files (JPEG or PNG, max 5 MB each)

Photos are uploaded to S3 at `partner/<helperId>/work-photos/<bookingId>/after/` and stored in `BookingWorkPhoto` with `type = AFTER`.

**Response `201`**
```json
{
  "success": true,
  "message": "After work photos uploaded",
  "data": {
    "photos": [
      {
        "id": 4,
        "photoUrl": "https://s3.ap-south-1.amazonaws.com/zynexx/partner/12/work-photos/101/after/uuid.jpg",
        "type": "AFTER",
        "createdAt": "2026-03-06T10:00:00.000Z"
      }
    ]
  }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"At least one photo is required"` |
| 400 | `"Maximum 5 photos allowed per upload"` |
| 400 | `"Only JPEG and PNG images are allowed"` (multer) |
| 403 | `"Helper profile not found"` |
| 403 | `"You are not the assigned helper for this booking"` |
| 404 | `"Booking not found"` |
| 409 | `"After photos can only be uploaded when booking is IN_PROGRESS"` |
| 409 | `"Job timer must be started before uploading after photos"` |

---

> **Job flow order for a booking:**
> 1. `POST /start` — OTP → `IN_PROGRESS`
> 2. `POST /before-photos` — upload BEFORE photos
> 3. `POST /start-timer` — start job clock
> 4. `POST /after-photos` — upload AFTER photos
> 5. `POST /complete` — mark `COMPLETED`

---

### `POST /api/partner/bookings/:bookingId/report-issue`

Report a booking problem to admin. Allowed while booking is `CONFIRMED` or `IN_PROGRESS`. Only **one** issue can be raised per booking.

**Auth:** `Authorization: Bearer <accessToken>` — Approved Helper (owns booking)

**Path Parameter:** `bookingId` — positive integer

**Request Body**
```json
{
  "reason": "CUSTOMER_NOT_AVAILABLE",
  "notes": "Optional additional details"
}
```

**Allowed Reasons**

| Value | Description |
|---|---|
| `CUSTOMER_NOT_AVAILABLE` | Customer did not open door / is unreachable |
| `WRONG_ADDRESS` | Booking address is incorrect or non-existent |
| `CUSTOMER_UNRESPONSIVE` | Customer not responding to calls/messages |
| `UNSAFE_LOCATION` | Location feels unsafe for the helper |
| `CUSTOMER_CANCEL_REQUEST` | Customer verbally requested cancellation |
| `OTHER` | Any other issue — `notes` field **required** when this reason is used |

> **Note:** When `reason = OTHER`, the `notes` field must be non-empty (returns `400` otherwise).

**Response `201`**
```json
{
  "success": true,
  "message": "Issue reported successfully",
  "data": {
    "id": 7,
    "bookingId": 101,
    "reason": "CUSTOMER_NOT_AVAILABLE",
    "notes": null,
    "createdAt": "2026-03-06T11:00:00.000Z"
  }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"Invalid bookingId"` |
| 400 | `"Notes are required when reason is OTHER"` |
| 400 | `"Invalid reason"` |
| 403 | `"Helper profile not found"` |
| 403 | `"Helper is not approved"` |
| 403 | `"You are not the assigned helper for this booking"` |
| 404 | `"Booking not found"` |
| 409 | `"An issue has already been reported for this booking"` |
| 422 | `"Issues can only be reported for CONFIRMED or IN_PROGRESS bookings"` |

> An admin Slack alert and push notification are fired automatically after issue creation.

---

## Partner Reviews

**Base path:** `/api/partner/reviews`

> Requires `requireApprovedHelper` — valid JWT + HELPER role + `onboardingStatus = APPROVED` + not suspended.

### Route Summary

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | `/api/partner/reviews` | Yes | Approved Helper |
| GET | `/api/partner/bank-details` | Yes | Approved Helper |

---

### `GET /api/partner/reviews`

Returns all ratings and reviews submitted by customers for the authenticated helper, sorted newest-first.

**Auth:** `Authorization: Bearer <accessToken>` — Approved Helper

**Response `200`**
```json
{
  "success": true,
  "data": [
    {
      "rating": 5,
      "review": "Very professional and on time!",
      "customerName": "Priya Sharma",
      "bookingId": 101,
      "createdAt": "2026-03-06T10:00:00.000Z"
    }
  ]
}
```

> `review` may be `null` if the customer submitted a star rating without a text review.

**Error Responses**

| Status | Message |
|---|---|
| 401 | `"Unauthorized"` |
| 403 | `"Helper profile not found"` |

---

## Partner Bank Details

**Base path:** `/api/partner/bank-details`

> Requires `requireApprovedHelper` — valid JWT + HELPER role + `onboardingStatus = APPROVED` + not suspended.

### Route Summary

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | `/api/partner/bank-details` | Yes | Approved Helper |

---

### `GET /api/partner/bank-details`

Returns the authenticated helper's registered bank account details. Responds with `data: null` if no bank has been added yet.

**Auth:** `Authorization: Bearer <accessToken>` — Approved Helper

**Response `200` — bank found**
```json
{
  "success": true,
  "data": {
    "accountName": "Ravi Kumar",
    "accountNumber": "1234567890",
    "ifsc": "SBIN0001234",
    "isVerified": true,
    "razorpayFundAccountId": "fa_XXXXXXXXXXXX"
  }
}
```

**Response `200` — no bank registered yet**
```json
{
  "success": true,
  "data": null
}
```

> `razorpayFundAccountId` is `null` until the payout registration job succeeds.

**Error Responses**

| Status | Message |
|---|---|
| 401 | `"Unauthorized"` |
| 403 | `"Helper profile not found"` |
| 500 | `"Failed to fetch bank details"` |

---

## Partner Address

**Base path:** `/api/partner/address`

> Requires `requireApprovedHelper` — valid JWT + HELPER role + `onboardingStatus = APPROVED` + not suspended.  
> Address data is stored in `HelperProfile`. If the profile doesn't exist yet, `PUT` creates it automatically via upsert.

### Route Summary

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | `/api/partner/address` | Yes | Approved Helper |
| PUT | `/api/partner/address` | Yes | Approved Helper |

---

### `GET /api/partner/address`

Returns the helper's saved service address from `HelperProfile`. All fields are `null` if no address has been set yet.

**Auth:** `Authorization: Bearer <accessToken>` — Approved Helper

**Response `200`**
```json
{
  "success": true,
  "data": {
    "address": "123 MG Road",
    "city": "Mumbai",
    "pinCode": "400001",
    "latitude": 19.0760,
    "longitude": 72.8777
  }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 401 | `"Unauthorized"` |
| 403 | `"Helper profile not found"` |
| 500 | `"Failed to fetch address"` |

---

### `PUT /api/partner/address`

Save or update the helper's service address. Upserts `HelperProfile` — safe to call even if the helper has not set up a profile yet.

**Auth:** `Authorization: Bearer <accessToken>` — Approved Helper

**Request Body**

| Field | Type | Required | Validation |
|---|---|---|---|
| `address` | string | ✅ | Non-empty |
| `city` | string | ✅ | Non-empty |
| `pinCode` | string | ✅ | Non-empty, max 10 chars |
| `latitude` | float | ❌ | Valid float |
| `longitude` | float | ❌ | Valid float |

```json
{
  "address": "123 MG Road",
  "city": "Mumbai",
  "pinCode": "400001",
  "latitude": 19.0760,
  "longitude": 72.8777
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Partner address updated successfully"
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"address is required"` |
| 400 | `"city is required"` |
| 400 | `"pinCode is required"` |
| 400 | `"pinCode must be at most 10 characters"` |
| 401 | `"Unauthorized"` |
| 403 | `"Helper profile not found"` |
| 500 | `"Failed to update address"` |

---

## Partner — Manage Services

**Base path:** `/api/partner/services`

> Requires `requireApprovedHelper`. `PUT` is a **full replace** — it deletes all existing `HelperService` rows for the helper and inserts the new set in a single transaction.

### Route Summary

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | `/api/partner/services` | Yes | Approved Helper |
| PUT | `/api/partner/services` | Yes | Approved Helper |

---

### `GET /api/partner/services`

Returns the list of services currently offered by the authenticated helper.

**Auth:** `Authorization: Bearer <accessToken>` — Approved Helper

**Response `200`**
```json
{
  "success": true,
  "data": [
    { "serviceId": 1, "name": "Home Cleaning" },
    { "serviceId": 3, "name": "Plumbing" }
  ]
}
```

> Returns an empty array `[]` if the helper has not registered any services yet.

**Error Responses**

| Status | Message |
|---|---|
| 401 | `"Unauthorized"` |
| 403 | `"Helper profile not found"` |
| 500 | `"Failed to fetch services"` |

---

### `PUT /api/partner/services`

Replace the helper's entire service list. Runs as a transaction: deletes all existing rows then inserts the new set.

**Auth:** `Authorization: Bearer <accessToken>` — Approved Helper

**Request Body**

| Field | Type | Required | Validation |
|---|---|---|---|
| `serviceIds` | integer[] | ✅ | Non-empty array of positive integers |

```json
{ "serviceIds": [1, 3, 5] }
```

**Response `200`**
```json
{
  "success": true,
  "message": "Services updated successfully"
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"serviceIds must be a non-empty array"` |
| 400 | `"each serviceId must be a positive integer"` |
| 401 | `"Unauthorized"` |
| 403 | `"Helper profile not found"` |
| 500 | `"Failed to update services"` |

---

## Admin Routes

**Base path:** `/api/admin`

> All admin routes require `Authorization: Bearer <accessToken>` with `role = ADMIN`.

<a id="admin-payout-approval"></a>

### Route Summary

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | `/api/admin/settings/commission` | Yes | Admin |
| PUT | `/api/admin/settings/commission` | Yes | Admin |
| POST | `/api/admin/onboarding/approve/:helperId` | Yes | Admin |
| POST | `/api/admin/onboarding/reject/:helperId` | Yes | Admin |
| POST | `/api/admin/payout/:bookingId/mark-paid` | Yes | Admin |
| GET | `/api/admin/finance/summary` | Yes | Admin |
| GET | `/api/admin/finance/payouts` | Yes | Admin |
| GET | `/api/admin/finance/payouts/:bookingId` | Yes | Admin |
| POST | `/api/admin/bookings/:bookingId/cancel` | Yes | Admin |
| GET | `/api/admin/users` | Yes | Admin |
| GET | `/api/admin/users/stats` | Yes | Admin |
| GET | `/api/admin/users/:userId` | Yes | Admin |
| POST | `/api/admin/users/:userId/block` | Yes | Admin |
| POST | `/api/admin/users/:userId/unblock` | Yes | Admin |

---

### `GET /api/admin/settings/commission`

Get the current platform commission rate.

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{
  "success": true,
  "data": {
    "commissionRate": 0.20,
    "commissionPercent": "20.00%",
    "updatedAt": "2026-01-15T00:00:00.000Z"
  }
}
```

---

### `PUT /api/admin/settings/commission`

Update the platform commission rate. Affects future payouts only.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body**

| Field | Type | Required | Validation |
|---|---|---|---|
| `commissionRate` | float | Yes | 0 – 0.50 |

```json
{ "commissionRate": 0.25 }
```

**Response `200`**
```json
{
  "success": true,
  "message": "Commission rate updated to 25.00%",
  "data": { "commissionRate": 0.25, "updatedAt": "2026-02-24T10:00:00.000Z" }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"commissionRate is required"` |
| 400 | `"commissionRate must be a number"` |
| 400 | `"commissionRate must be between 0 and 0.50"` |
| 403 | Wrong role |

---

### `POST /api/admin/onboarding/approve/:helperId`

Approve a helper's onboarding. Sets `onboardingStatus = APPROVED`.

**Headers:** `Authorization: Bearer <accessToken>`

**Path Parameter:** `helperId` — integer

**Response `200`**
```json
{ "success": true, "message": "Helper approved successfully" }
```

---

### `POST /api/admin/onboarding/reject/:helperId`

Reject a helper's onboarding.

**Headers:** `Authorization: Bearer <accessToken>`

**Path Parameter:** `helperId` — integer

**Request Body** (optional)

| Field | Type | Description |
|---|---|---|
| `reason` | string | Rejection reason |

```json
{ "reason": "PAN verification failed — name mismatch" }
```

**Response `200`**
```json
{ "success": true, "message": "Helper rejected" }
```

---

### `POST /api/admin/payout/:bookingId/mark-paid`

Manually marks a payout as **PAID** and releases escrow. Admin-only. No RazorpayX call is made — this is a pure DB state transition for exceptional cases (e.g. payout was processed offline or via bank transfer).

**Headers:** `Authorization: Bearer <accessToken>`

**Path Parameter**

| Param | Type | Description |
|---|---|---|
| `bookingId` | integer | ID of the completed booking |

**Pre-conditions (all must be true)**

| Field | Required value |
|---|---|
| `booking.status` | `COMPLETED` |
| `booking.payoutStatus` | `PENDING` |
| `payment.status` | `CAPTURED` |
| `payment.escrowStatus` | `LOCKED` |

**Atomic transaction on success**
- `booking.payoutStatus` → `PAID`
- `booking.payoutAt` → `now()`
- `payment.escrowStatus` → `RELEASED`

**Response `200`**
```json
{
  "success": true,
  "message": "Payout marked as paid successfully"
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"Invalid bookingId"` |
| 404 | `"Booking not found"` |
| 404 | `"Payment record not found"` |
| 422 | `"Booking must be COMPLETED to mark payout paid (current: ...)"` |
| 422 | `"Payout is already <status> — cannot mark as PAID"` |
| 422 | `"Payment must be CAPTURED to release escrow (current: ...)"` |
| 422 | `"Escrow must be LOCKED to release (current: ...)"` |
| 500 | `"Internal server error"` |

---

<a id="admin-finance-dashboard"></a>

## Admin — Finance Dashboard

**Base path:** `/api/admin/finance`

> All finance routes require `Authorization: Bearer <accessToken>` with `role = ADMIN`.

---

### `GET /api/admin/finance/summary`

Returns aggregated financial metrics across all bookings.

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{
  "success": true,
  "data": {
    "totalBookings": 1540,
    "totalCompleted": 1210,
    "totalRevenue": 4820000.00,
    "totalCommission": 964000.00,
    "totalHelperPayout": 3856000.00,
    "totalPaidOut": 3640000.00,
    "totalPendingPayout": 180000.00,
    "totalFailedPayout": 36000.00
  }
}
```

**Field Descriptions**

| Field | Description |
|---|---|
| `totalRevenue` | Sum of `totalAmount` for all COMPLETED bookings |
| `totalCommission` | Sum of `platformCommissionAmount` for COMPLETED bookings |
| `totalHelperPayout` | Sum of `helperPayoutAmount` for COMPLETED bookings |
| `totalPaidOut` | Sum of `helperPayoutAmount` where `payoutStatus = PAID` |
| `totalPendingPayout` | Sum of `helperPayoutAmount` where `payoutStatus IN (PENDING, PROCESSING)` |
| `totalFailedPayout` | Sum of `helperPayoutAmount` where `payoutStatus = FAILED` |

---

### `GET /api/admin/finance/payouts`

Paginated list of completed booking payout records with optional filters.

**Headers:** `Authorization: Bearer <accessToken>`

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `status` | string | No | Filter by payout status: `PENDING`, `PROCESSING`, `PAID`, `FAILED` |
| `from` | ISO date | No | Filter bookings created on/after this date |
| `to` | ISO date | No | Filter bookings created on/before this date |
| `helperId` | integer | No | Filter by specific helper |
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Records per page (default: 20, max: 100) |

**Example**
```
GET /api/admin/finance/payouts?status=FAILED&page=1&limit=20
GET /api/admin/finance/payouts?helperId=42&from=2026-01-01&to=2026-02-28
```

**Response `200`**
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "bookingId": 1051,
        "helperId": 12,
        "helperName": "Ravi Kumar",
        "payoutStatus": "PAID",
        "totalAmount": 1500.00,
        "helperPayoutAmount": 1200.00,
        "platformCommissionAmount": 300.00,
        "payoutAt": "2026-02-10T06:30:00.000Z",
        "retryCount": 0,
        "createdAt": "2026-02-10T04:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 1210,
      "page": 1,
      "limit": 20,
      "totalPages": 61
    }
  }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"Invalid status. Allowed values: PENDING, PROCESSING, PAID, FAILED"` |
| 400 | `"helperId must be a number"` |
| 400 | `"Invalid \"from\" date"` |
| 400 | `"Invalid \"to\" date"` |
| 500 | `"Failed to fetch payout records"` |

---

### `GET /api/admin/finance/payouts/:bookingId`

Full payout audit trail for a single booking.

**Headers:** `Authorization: Bearer <accessToken>`

**Path Parameter**

| Param | Type | Description |
|---|---|---|
| `bookingId` | integer | Booking ID |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "bookingId": 1051,
    "status": "COMPLETED",
    "createdAt": "2026-02-10T04:00:00.000Z",
    "completedAt": "2026-02-10T05:45:00.000Z",

    "totalAmount": 1500.00,
    "finalAmount": 1500.00,
    "commissionRateSnapshot": 0.20,
    "platformCommissionAmount": 300.00,
    "helperPayoutAmount": 1200.00,

    "payoutStatus": "PAID",
    "payoutEligibleAt": "2026-02-10T07:45:00.000Z",
    "payoutId": "pout_XXXXXXXXXXXX",
    "payoutAt": "2026-02-10T08:30:00.000Z",
    "retryCount": 0,
    "lastRetryAt": null,
    "nextRetryAt": null,

    "payment": {
      "paymentId": 210,
      "status": "CAPTURED",
      "escrowStatus": "RELEASED",
      "amount": 1500.00,
      "razorpayOrderId": "order_XXXX",
      "razorpayPaymentId": "pay_XXXX",
      "createdAt": "2026-02-10T04:01:00.000Z",
      "updatedAt": "2026-02-10T08:30:00.000Z"
    },

    "customer": {
      "id": 5,
      "fullName": "Priya Sharma",
      "phone": "9876543210"
    },

    "helper": {
      "id": 12,
      "fullName": "Ravi Kumar",
      "phone": "9123456780",
      "bank": {
        "accountName": "Ravi Kumar",
        "accountNumber": "XXXXXXXXXXXX",
        "ifsc": "SBIN0001234",
        "razorpayFundAccountId": "fa_XXXXXXXXXXXX"
      }
    }
  }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"Invalid bookingId"` |
| 404 | `"Booking not found"` |
| 500 | `"Failed to fetch payout audit"` |

---

## Admin — Booking Operations

**Base path:** `/api/admin/bookings`

> All routes require `Authorization: Bearer <accessToken>` with `role = ADMIN`.

### Route Summary

| Method | Path | Auth | Role |
|---|---|---|---|
| POST | `/api/admin/bookings/:bookingId/cancel` | Yes | Admin |

---

### `POST /api/admin/bookings/:bookingId/cancel`

Force-cancel any booking that is not yet `COMPLETED` or `EXPIRED`. **Idempotent** — if the booking is already `CANCELLED` returns `200` immediately. Executes atomically: cancels the booking, refunds the payment if captured, and resolves any open `BookingIssue` records in a single DB transaction.

**Auth:** `Authorization: Bearer <accessToken>` — Admin only

**Path Parameter:** `bookingId` — positive integer

**Request Body**
```json
{
  "reason": "Customer requested cancellation via support",
  "overridePayout": false
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `reason` | string | ✅ | Human-readable cancellation reason stored on the booking |
| `overridePayout` | boolean | ❌ | Reserved for future use; has no effect currently |

**Response `200`**
```json
{
  "success": true,
  "message": "Booking cancelled by admin",
  "bookingId": 101,
  "previousStatus": "CONFIRMED",
  "paymentRefunded": true,
  "payoutReversalRequired": false,
  "linkedIssue": {
    "id": 7,
    "reason": "CUSTOMER_NOT_AVAILABLE",
    "resolved": true
  }
}
```

| Field | Description |
|---|---|
| `paymentRefunded` | `true` if payment was `CAPTURED` and has been moved to `REFUNDED` |
| `payoutReversalRequired` | `true` if the helper was already paid out — manual reversal is needed |
| `linkedIssue` | Most recent `BookingIssue` on this booking, if any; `null` otherwise |

> When `payoutReversalRequired = true` the payout record is flagged in the DB but a manual action is still required to reclaim funds from the helper.

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"Invalid bookingId"` |
| 400 | `"Cancellation reason is required"` |
| 404 | `"Booking not found"` |
| 422 | `"Cannot cancel a COMPLETED booking"` |
| 422 | `"Cannot cancel an EXPIRED booking"` |

---

## Push Notifications

**Base path:** `/api/notifications`

> Both routes require `Authorization: Bearer <accessToken>`.

### Firebase Setup

Set the following environment variables to enable push notifications. When any of the three vars is missing, the service initialises in **no-op mode** — all `sendPush*` calls silently succeed without sending.

| Variable | Description |
|---|---|
| `FIREBASE_PROJECT_ID` | Firebase project ID (e.g. `zynexx-prod`) |
| `FIREBASE_CLIENT_EMAIL` | Service-account client email |
| `FIREBASE_PRIVATE_KEY` | PEM private key (include `\n` line breaks) |

### Push Notification Event Types

These `type` values are stored in `NotificationLog` and forwarded as the `type` key inside the FCM data payload received by the client app.

| Type | Triggered When | Recipient |
|---|---|---|
| `BOOKING_NEW` | New booking dispatched to nearby helpers | Nearby helpers |
| `BOOKING_ACCEPTED` | Helper accepts booking request | Customer |
| `BOOKING_ASSIGNED` | Helper accepts booking request | Assigned helper |
| `JOB_STARTED` | Helper verifies start OTP (`IN_PROGRESS`) | Customer |
| `JOB_COMPLETED` | Booking marked `COMPLETED` | Customer |
| `BOOKING_ISSUE_REPORTED` | Helper reports an issue | All admin users |

### Route Summary

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | `/api/notifications` | Yes | Any authenticated |
| PATCH | `/api/notifications/read-all` | Yes | Any authenticated |
| PATCH | `/api/notifications/:notificationId/read` | Yes | Any authenticated |
| POST | `/api/notifications/register-device` | Yes | Any authenticated |
| DELETE | `/api/notifications/register-device` | Yes | Any authenticated |

---

### `GET /api/notifications`

Returns a paginated list of notifications for the authenticated user, ordered newest-first.

**Auth:** `Authorization: Bearer <accessToken>`

**Query Parameters**

| Param | Type | Required | Default |
|---|---|---|---|
| `page` | integer | ❌ | `1` |
| `limit` | integer | ❌ | `20` |

**Response `200`**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userId": 42,
      "title": "Booking Confirmed",
      "body": "Your booking has been accepted by a helper.",
      "type": "BOOKING_ACCEPTED",
      "data": { "bookingId": 7 },
      "isRead": false,
      "createdAt": "2026-03-07T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20
  }
}
```

---

### `PATCH /api/notifications/read-all`

Sets `isRead = true` on every unread notification belonging to the authenticated user. Only unread records are touched (`WHERE isRead = false`).

**Auth:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{
  "success": true,
  "message": "All notifications marked as read"
}
```

---

### `PATCH /api/notifications/:notificationId/read`

Sets `isRead = true` on a single notification. Validates ownership — a user cannot mark another user's notification as read.

**Auth:** `Authorization: Bearer <accessToken>`

**Path Parameter**

| Param | Type | Description |
|---|---|---|
| `notificationId` | integer | ID of the notification to mark as read |

**Response `200`**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"Invalid notificationId"` |
| 404 | `"Notification not found"` — does not exist or belongs to another user |

---

### `POST /api/notifications/register-device`

Register (or refresh) a device push token. Uses an **upsert** — re-registering an existing token is safe. Call this on every app launch after obtaining a fresh FCM token.

**Auth:** `Authorization: Bearer <accessToken>`

**Request Body**
```json
{
  "token": "fcm-device-token-string",
  "platform": "ANDROID"
}
```

| Field | Type | Required | Allowed Values |
|---|---|---|---|
| `token` | string | ✅ | 10–512 chars |
| `platform` | string | ✅ | `ANDROID`, `IOS`, `WEB` |

**Response `200`**
```json
{
  "success": true,
  "message": "Device registered successfully"
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"token must be 10–512 characters"` |
| 400 | `"platform must be ANDROID, IOS or WEB"` |

---

### `DELETE /api/notifications/register-device`

Unregister a device token. Call on logout to stop delivering notifications to this device.

**Auth:** `Authorization: Bearer <accessToken>`

**Request Body**
```json
{
  "token": "fcm-device-token-string"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Device unregistered successfully"
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"token must be 10–512 characters"` |

---

## Admin — User Management

**Base path:** `/api/admin/users`

> All routes require `Authorization: Bearer <accessToken>` with `role = ADMIN`.

### Route Summary

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | `/api/admin/users` | Yes | Admin |
| GET | `/api/admin/users/stats` | Yes | Admin |
| GET | `/api/admin/users/:userId` | Yes | Admin |
| POST | `/api/admin/users/:userId/block` | Yes | Admin |
| POST | `/api/admin/users/:userId/unblock` | Yes | Admin |

---

### `GET /api/admin/users`

Paginated list of all users with booking stats. Booking counts and total spend are aggregated in a single JOIN query for the page (no N+1).

**Auth:** `Authorization: Bearer <accessToken>`

**Query Parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Page size (max 100) |
| `search` | string | — | Partial match on `fullName` or `phone` |
| `status` | string | — | `active` or `blocked` |

**Response `200`**
```json
{
  "success": true,
  "total": 142,
  "active": 138,
  "blocked": 4,
  "pagination": { "page": 1, "limit": 20, "totalPages": 8 },
  "data": [
    {
      "id": 5,
      "fullName": "Priya Sharma",
      "phone": "9876543210",
      "email": "priya@example.com",
      "role": "CUSTOMER",
      "isBlocked": false,
      "blockedReason": null,
      "createdAt": "2026-01-10T00:00:00.000Z",
      "totalBookings": 12,
      "totalSpent": 14400.00
    }
  ]
}
```

---

### `GET /api/admin/users/stats`

Quick aggregate user counts. Registered **before** `/:userId` in the router to prevent route shadowing.

**Auth:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{
  "success": true,
  "data": {
    "total": 142,
    "active": 138,
    "blocked": 4
  }
}
```

---

### `GET /api/admin/users/:userId`

Full user profile: basic info, helper profile (if any), booking stats, and 10 most recent bookings.

**Auth:** `Authorization: Bearer <accessToken>`

**Path Parameter:** `userId` — positive integer

**Response `200`**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "fullName": "Priya Sharma",
    "phone": "9876543210",
    "email": "priya@example.com",
    "role": "CUSTOMER",
    "isBlocked": false,
    "blockedReason": null,
    "createdAt": "2026-01-10T00:00:00.000Z",
    "helperProfile": null,
    "stats": { "totalBookings": 12, "totalSpent": 14400.00 },
    "recentBookings": [
      {
        "id": 101,
        "status": "COMPLETED",
        "totalAmount": 1200.00,
        "createdAt": "2026-03-01T00:00:00.000Z",
        "serviceName": "Home Cleaning",
        "helperName": "Ravi Kumar"
      }
    ]
  }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"Invalid userId"` |
| 404 | `"User not found"` |

---

### `POST /api/admin/users/:userId/block`

Block a user account. Returns `409` if the user is already blocked.

**Auth:** `Authorization: Bearer <accessToken>`

**Path Parameter:** `userId` — positive integer

**Request Body**
```json
{
  "reason": "Repeated fraudulent bookings"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "User blocked successfully",
  "userId": 5,
  "blockedReason": "Repeated fraudulent bookings"
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"Invalid userId"` |
| 400 | `"Block reason is required"` |
| 404 | `"User not found"` |
| 409 | `"User is already blocked"` |

---

### `POST /api/admin/users/:userId/unblock`

Unblock a previously blocked user. Returns `409` if the user is not currently blocked.

**Auth:** `Authorization: Bearer <accessToken>`

**Path Parameter:** `userId` — positive integer

**Request Body** — none required

**Response `200`**
```json
{
  "success": true,
  "message": "User unblocked successfully",
  "userId": 5
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"Invalid userId"` |
| 404 | `"User not found"` |
| 409 | `"User is not blocked"` |

---

## Core — Booking Requests

**Base path:** `/api/booking-requests`

### Route Summary

| Method | Path | Auth | Role |
|---|---|---|---|
| POST | `/api/booking-requests/create` | Yes | Customer |
| POST | `/api/booking-requests/:requestId/accept` | Yes | Helper |
| POST | `/api/booking-requests/:requestId/reject` | Yes | Helper |
| GET | `/api/booking-requests/:requestId/status` | Yes | Customer or Helper |
| GET | `/api/booking-requests/helper/pending` | Yes | Helper |
| GET | `/api/booking-requests/customer/history` | Yes | Customer |

---

### `POST /api/booking-requests/create`

Create a booking request. Dispatched to nearby available helpers; 10-second acceptance window.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body**

| Field | Type | Required | Validation |
|---|---|---|---|
| `serviceId` | integer | Yes | ≥ 1 |
| `servicePlanId` | integer | Yes | ≥ 1 |
| `address` | string | Yes | 5–200 chars |
| `city` | string | Yes | 2–50 chars |
| `pinCode` | string | Yes | 6 digits |
| `latitude` | float | Yes | -90 to 90 |
| `longitude` | float | Yes | -180 to 180 |
| `estimatedHours` | integer | Yes | 1–100 |
| `description` | string | No | Max 500 chars |
| `specialRequirements` | string | No | Max 300 chars |
| `requestedTime` | string | No | 12-hr format e.g. `"10:00 AM"` |

```json
{
  "serviceId": 3,
  "servicePlanId": 7,
  "address": "12 Main Street, Andheri West",
  "city": "Mumbai",
  "pinCode": "400053",
  "latitude": 19.1136,
  "longitude": 72.8697,
  "estimatedHours": 2,
  "description": "Kitchen sink blocked",
  "requestedTime": "10:00 AM"
}
```

**Response `201`**
```json
{
  "success": true,
  "message": "Booking request created and dispatched",
  "data": {
    "requestId": 55,
    "status": "PENDING",
    "dispatchedTo": 3,
    "expiresAt": "2026-02-24T10:00:10.000Z"
  }
}
```

---

### `POST /api/booking-requests/:requestId/accept`

Helper accepts a request within the 10-second window.

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{
  "success": true,
  "message": "Booking request accepted",
  "data": { "bookingId": 101, "status": "PENDING_PAYMENT" }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | Request expired or already accepted |
| 403 | `"Onboarding not approved"` |
| 403 | `"Helper profile not found"` |
| 404 | Request not found |

---

### `POST /api/booking-requests/:requestId/reject`

Helper rejects a request. System may re-dispatch.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body** (optional)

| Field | Type | Validation |
|---|---|---|
| `reason` | string | Max 200 chars |

```json
{ "reason": "Too far from current location" }
```

**Response `200`**
```json
{ "success": true, "message": "Booking request rejected" }
```

---

### `GET /api/booking-requests/:requestId/status`

Current status of a request. Accessible by customer and assigned helper.

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{ "success": true, "data": { "requestId": 55, "status": "ACCEPTED", "bookingId": 101 } }
```

---

### `GET /api/booking-requests/helper/pending`

All pending requests dispatched to the authenticated helper.

**Headers:** `Authorization: Bearer <accessToken>` (HELPER role)

**Response `200`**
```json
{
  "success": true,
  "data": [
    { "id": 55, "serviceId": 3, "city": "Mumbai", "estimatedHours": 2, "expiresAt": "2026-02-24T10:00:10.000Z" }
  ]
}
```

---

### `GET /api/booking-requests/customer/history`

Customer's booking request history.

**Headers:** `Authorization: Bearer <accessToken>`

**Query Parameters:** `status` (`PENDING`, `ACCEPTED`, `EXPIRED`, `REJECTED`)

**Response `200`**
```json
{
  "success": true,
  "data": [
    { "id": 55, "status": "ACCEPTED", "bookingId": 101, "createdAt": "2026-02-24T09:59:00.000Z" }
  ]
}
```

---

## Core — Payments

**Base path:** `/api/payments`

### Route Summary

| Method | Path | Auth | Role |
|---|---|---|---|
| POST | `/api/payments/create-order` | Yes | Customer |
| POST | `/api/payments/initiate` | Yes | Customer |
| POST | `/api/payments/verify` | Yes | Customer |
| GET | `/api/payments/:paymentId` | Yes | Any |
| GET | `/api/payments` | Yes | Any |
| POST | `/api/payments/:paymentId/refund` | Yes | Admin |

### Payment Flow

```
1. Booking created (status: PENDING_PAYMENT)
2. POST /api/payments/create-order   → Razorpay order created
3. POST /api/payments/initiate       → Payment.status = CREATED
4. Customer pays via Razorpay SDK
5. POST /webhook/razorpay            → payment.captured event
   OR POST /api/payments/verify      → manual confirmation
6. Payment.status = CAPTURED, EscrowStatus = LOCKED
7. Booking.status = CONFIRMED, start OTP generated
```

---

### `POST /api/payments/create-order`

Create a Razorpay order for a booking.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body**

| Field | Type | Required |
|---|---|---|
| `bookingId` | integer | Yes |

```json
{ "bookingId": 101 }
```

**Response `200`**
```json
{
  "success": true,
  "message": "Razorpay order created successfully",
  "data": {
    "orderId": "order_xyz123",
    "amount": 120000,
    "currency": "INR",
    "razorpayKeyId": "rzp_live_xxx"
  }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | Booking not in correct status |
| 403 | `"Unauthorized - booking does not belong to you"` |
| 404 | `"Booking not found"` |

---

### `POST /api/payments/initiate`

Mark payment as `CREATED` (pre-payment state).

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body**

| Field | Type | Required |
|---|---|---|
| `bookingId` | integer | Yes |

```json
{ "bookingId": 101 }
```

**Response `200`**
```json
{
  "success": true,
  "message": "Payment initiated",
  "data": { "orderId": 22, "amount": 1200.00, "currency": "INR" }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | Cannot initiate (wrong status or already captured) |
| 500 | `"Payment record missing — data integrity issue"` |

---

### `POST /api/payments/verify`

Manually verify payment after Razorpay client-side success. Atomically: captures payment, locks escrow, confirms booking, generates OTP.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `paymentId` | integer | Yes | Internal payment record ID |
| `razorpayOrderId` | string | Yes | Razorpay order ID |
| `razorpayPaymentId` | string | Yes | Razorpay payment ID |

```json
{
  "paymentId": 22,
  "razorpayOrderId": "order_xyz123",
  "razorpayPaymentId": "pay_abc456"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Payment verified",
  "data": {
    "id": 22,
    "status": "CAPTURED",
    "escrowStatus": "LOCKED",
    "booking": { "id": 101, "status": "CONFIRMED" }
  }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 403 | `"Unauthorized: You can only verify your own payments"` |
| 404 | `"Payment not found"` |

---

### `GET /api/payments/:paymentId`

Get a payment record.

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{
  "success": true,
  "data": {
    "id": 22,
    "bookingId": 101,
    "amount": 1200.00,
    "status": "CAPTURED",
    "escrowStatus": "LOCKED",
    "razorpayOrderId": "order_xyz123"
  }
}
```

---

### `GET /api/payments`

Payment history for the authenticated user.

**Headers:** `Authorization: Bearer <accessToken>`

**Query Parameters:** `page`, `limit`

**Response `200`**
```json
{ "success": true, "data": [ ... ], "pagination": { "page": 1, "limit": 10, "total": 12 } }
```

---

### `POST /api/payments/:paymentId/refund`

Initiate refund. Admin only.

**Headers:** `Authorization: Bearer <accessToken>` (ADMIN role)

**Response `200`**
```json
{ "success": true, "message": "Refund initiated successfully", "data": { "id": 22, "status": "REFUNDED" } }
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | Payment not in `CAPTURED` state |
| 403 | Wrong role |

---

## Core — Ratings

**Base path:** `/api/ratings`

### Route Summary

| Method | Path | Auth | Role |
|---|---|---|---|
| POST | `/api/ratings` | Yes | Customer |
| GET | `/api/ratings/service/:serviceId` | No | Public |
| GET | `/api/ratings/helper/:helperId` | No | Public |
| GET | `/api/ratings/stats/:helperId` | No | Public |
| PUT | `/api/ratings/:ratingId` | Yes | Rating owner |
| DELETE | `/api/ratings/:ratingId` | Yes | Rating owner |

---

### `POST /api/ratings`

Rate a completed booking. One rating per booking. Only the booking's customer may rate.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body**

| Field | Type | Required | Validation |
|---|---|---|---|
| `bookingId` | integer | Yes | Non-empty |
| `rating` | integer | Yes | 1–5 |
| `review` | string | No | Max 500 chars |

```json
{ "bookingId": 101, "rating": 5, "review": "Excellent work!" }
```

**Response `201`**
```json
{
  "success": true,
  "message": "Rating created successfully",
  "data": { "id": 33, "bookingId": 101, "rating": 5, "review": "Excellent work!" }
}
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"Rating must be an integer between 1 and 5"` |
| 400 | `"Rating already exists for this booking"` |
| 400 | `"Can only rate completed bookings"` |
| 403 | `"Unauthorized to rate this booking"` |
| 404 | `"Booking not found"` |

---

### `GET /api/ratings/service/:serviceId`

All ratings for a service (public).

**Response `200`**
```json
{ "success": true, "data": [ ... ] }
```

---

### `GET /api/ratings/helper/:helperId`

All ratings for a helper (public).

**Response `200`**
```json
{
  "success": true,
  "data": [{ "id": 33, "rating": 5, "review": "Excellent work!", "createdAt": "..." }]
}
```

---

### `GET /api/ratings/stats/:helperId`

Aggregated helper rating stats (public).

**Response `200`**
```json
{
  "success": true,
  "data": {
    "averageRating": 4.7,
    "totalRatings": 23,
    "distribution": { "5": 15, "4": 5, "3": 2, "2": 1, "1": 0 }
  }
}
```

---

### `PUT /api/ratings/:ratingId`

Update a rating. Only the original reviewer may update.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body** (all optional)

| Field | Type | Validation |
|---|---|---|
| `rating` | integer | 1–5 |
| `review` | string | Max 500 chars |

```json
{ "rating": 4, "review": "Good work overall" }
```

**Response `200`**
```json
{ "success": true, "message": "Rating updated successfully", "data": { ... } }
```

---

### `DELETE /api/ratings/:ratingId`

Delete a rating. Only the original reviewer.

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{ "success": true, "message": "Rating deleted successfully" }
```

---

## Core — Services

**Base path:** `/api/services`

### Route Summary

| Method | Path | Auth | Role |
|---|---|---|---|
| POST | `/api/services` | Yes | Any authenticated |
| GET | `/api/services/:serviceId` | No | Public |
| GET | `/api/services` | No | Public |
| GET | `/api/services/helper/:helperId` | No | Public |
| PUT | `/api/services/:serviceId` | Yes | Any authenticated |
| DELETE | `/api/services/:serviceId` | Yes | Any authenticated |

---

### `POST /api/services`

Create a service listing.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body**

| Field | Type | Required | Validation |
|---|---|---|---|
| `category` | string | Yes | `PLUMBING`, `ELECTRICAL`, `CARPENTRY`, `PAINTING`, `CLEANING`, `GARDENING`, `APPLIANCE_REPAIR`, `FURNITURE_REPAIR`, `PEST_CONTROL`, `AC_SERVICE`, `OTHER` |
| `title` | string | Yes | 3–100 chars |
| `description` | string | No | Max 1000 chars |
| `hourlyRate` | float | Yes | ≥ 0 |
| `minimumHours` | integer | No | 1–100 |

```json
{
  "category": "PLUMBING",
  "title": "Pipe Repair & Installation",
  "description": "All types of pipe repair and installation",
  "hourlyRate": 500.00,
  "minimumHours": 1
}
```

**Response `201`**
```json
{ "success": true, "message": "Service created successfully", "data": { "id": 3 } }
```

---

### `GET /api/services/:serviceId`

Get a service by ID.

**Response `200`**
```json
{
  "success": true,
  "data": { "id": 3, "category": "PLUMBING", "title": "Pipe Repair", "hourlyRate": 500.00 }
}
```

---

### `GET /api/services`

List all services.

**Query Parameters:** `category`, `page`, `limit`

**Response `200`**
```json
{ "success": true, "data": [ ... ], "pagination": { "page": 1, "limit": 10, "total": 50 } }
```

---

### `GET /api/services/helper/:helperId`

Services offered by a specific helper.

**Response `200`**
```json
{ "success": true, "data": [ ... ] }
```

---

### `PUT /api/services/:serviceId`

Update a service.

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{ "success": true, "message": "Service updated successfully" }
```

---

### `DELETE /api/services/:serviceId`

Delete a service.

**Headers:** `Authorization: Bearer <accessToken>`

**Response `200`**
```json
{ "success": true, "message": "Service deleted successfully" }
```

---

<a id="financial-ledger-system"></a>

## Financial Ledger System

> **Type:** Internal system — no public HTTP endpoints.  
> **Purpose:** Immutable double-entry audit log for every money movement on the platform.  
> **Files:** `src/services/ledger.service.ts`, `src/services/finance.ledger.service.ts`, `src/services/ledger.integrity.service.ts`

All financial events are recorded as atomic, insert-only `LedgerEntry` rows in PostgreSQL.  
Entries are **never updated or deleted**. The `@@unique([type, referenceId])` constraint provides database-level idempotency — duplicate webhook deliveries are silently swallowed.

---

<a id="ledger-data-model"></a>

### Ledger Data Model

**`LedgerEntry` table**

| Column | Type | Description |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `bookingId` | Int? | Optional booking reference (no FK — immune to cascade) |
| `userId` | Int? | Optional user reference (no FK) |
| `type` | `LedgerType` | See entry types below |
| `direction` | `LedgerDirection` | `CREDIT` or `DEBIT` |
| `amount` | `Decimal(14,2)` | Always > 0 (enforced at service layer) |
| `referenceId` | String? | Unique idempotency key (e.g. `razorpayPaymentId`) |
| `metadata` | JSON? | Structured context (rate snapshots, trigger reason, etc.) |
| `createdAt` | Timestamptz | Immutable timestamp — no `updatedAt` |

**`LedgerDirection` enum**

| Value | Meaning |
|---|---|
| `CREDIT` | Money received or earned by the platform |
| `DEBIT` | Money paid out or disbursed from the platform |

---

<a id="ledger-entry-types"></a>

### Entry Types

| `LedgerType` | Direction | `referenceId` | Created when |
|---|---|---|---|
| `PAYMENT_CAPTURED` | CREDIT | `razorpayPaymentId` | Razorpay `payment.captured` webhook — customer payment received |
| `ESCROW_LOCK` | DEBIT | `razorpayPaymentId` | Same webhook — mirrors PAYMENT_CAPTURED, marks funds as held in escrow |
| `COMMISSION_EARNED` | CREDIT | `String(bookingId)` | Same webhook — platform commission snapshotted at booking completion rate |
| `HELPER_PAYOUT` | DEBIT | `razorpayPayoutId` | RazorpayX `payout.processed` webhook — helper disbursement confirmed |
| `REFUND_ISSUED` | DEBIT | `refund-<razorpayPaymentId>` | Admin/customer refund — money returned to customer |
| `PAYOUT_REVERSAL` | CREDIT | `reversal-<razorpayPaymentId>` | Refund after payout — accounting reversal when helper was already paid |

**Double-entry balance rule:**  
`SUM(CREDIT) ≥ SUM(DEBIT)` at all times. The delta represents the platform's current float (funds held but not yet disbursed).

---

<a id="ledger-integration-points"></a>

### Integration Points

Ledger entries are written **atomically inside the same database transaction** as the originating money event:

| Event | Transaction includes | Ledger entries written |
|---|---|---|
| `POST /webhook/razorpay` — `payment.captured` | `payment.status = CAPTURED`, `escrowStatus = LOCKED`, `booking.status = CONFIRMED` | `PAYMENT_CAPTURED` + `ESCROW_LOCK` + `COMMISSION_EARNED` (if snapshot > 0) |
| `POST /webhook/razorpayx` — `payout.processed` | `booking.payoutStatus = PAID`, `escrowStatus = RELEASED` | `HELPER_PAYOUT` |
| `POST /api/payments/:paymentId/refund` | `payment.status = REFUNDED`, `booking.status = CANCELLED` | `REFUND_ISSUED` + `PAYOUT_REVERSAL` (only if `payoutStatus = PAID`) |

---

<a id="ledger-internal-services"></a>

### Internal Services

These are TypeScript service functions available server-side (not HTTP endpoints).

#### `ledger.service.ts`

```typescript
createLedgerEntry(params: CreateLedgerEntryParams, tx?: Prisma.TransactionClient): Promise<LedgerEntry | null>
```

- `tx` is optional — pass a `Prisma.TransactionClient` to include the write inside an existing `$transaction` block.
- Returns `null` on duplicate (idempotent) — does **not** throw.
- Throws `Error` if `amount ≤ 0`.

#### `finance.ledger.service.ts`

Ledger-based financial aggregations — all figures sourced from `LedgerEntry`, not raw booking fields:

| Function | Returns | Description |
|---|---|---|
| `getTotalRevenue()` | `Prisma.Decimal` | `SUM(amount)` where `type=PAYMENT_CAPTURED, direction=CREDIT` |
| `getTotalCommission()` | `Prisma.Decimal` | `SUM(amount)` where `type=COMMISSION_EARNED` |
| `getTotalHelperPayout()` | `Prisma.Decimal` | `SUM(amount)` where `type=HELPER_PAYOUT` |
| `getTotalRefunds()` | `Prisma.Decimal` | `SUM(amount)` where `type=REFUND_ISSUED` |
| `getLedgerSummary()` | `LedgerSummary` | All four totals + `netRevenue = totalRevenue - totalRefunds` in one call |
| `getBookingLedger(bookingId)` | `{ credits, debits, net }` | Per-booking credit/debit breakdown |

#### `ledger.integrity.service.ts`

```typescript
checkLedgerIntegrity(): Promise<IntegrityResult>
```

Designed to be called from a **daily cron job**. Performs two checks:

1. **Global balance check** — verifies `SUM(CREDIT) ≥ SUM(DEBIT)`.
2. **Helper payout reconciliation** — verifies `SUM(HELPER_PAYOUT DEBIT)` matches `SUM(helperPayoutAmount WHERE payoutStatus=PAID)` on the `Booking` table (tolerance: ₹0.01).

On mismatch → fires `sendAlert('FINANCE_MISMATCH', payload)` (Slack + structured log).

**`IntegrityResult` shape:**
```typescript
{
  passed:              boolean;
  creditTotal:         Prisma.Decimal;
  debitTotal:          Prisma.Decimal;
  delta:               Prisma.Decimal;  // creditTotal - debitTotal
  helperPayoutLedger:  Prisma.Decimal;  // from LedgerEntry
  helperPayoutBooking: Prisma.Decimal;  // from Booking table
  helperPayoutDelta:   Prisma.Decimal;  // absolute difference
  checkedAt:           Date;
}
```

---

<a id="ledger-backfill"></a>

### Backfill Script

**File:** `src/scripts/backfill-ledger.ts`

Idempotent script that creates `LedgerEntry` rows for all historical bookings that predate the ledger system.

**Run:**
```bash
# Development
npx ts-node src/scripts/backfill-ledger.ts

# After build
node dist/scripts/backfill-ledger.js
```

**Behaviour:**
- Processes bookings in batches of 100 (cursor-based pagination).
- Processes only bookings with a `CAPTURED` payment.
- Writes `PAYMENT_CAPTURED` + `ESCROW_LOCK` + `COMMISSION_EARNED` (if > 0) per booking.
- Writes `HELPER_PAYOUT` for bookings where `payoutStatus = PAID`.
- **Safe to run multiple times** — duplicate writes are swallowed via `@@unique([type, referenceId])`.

---

## Webhooks

### `POST /webhook/razorpay`

Razorpay event webhook. **No authentication required** — signature-based verification (HMAC-SHA256).

**Headers**

| Header | Required | Description |
|---|---|---|
| `X-Razorpay-Signature` | Yes | HMAC-SHA256 of raw body |
| `Content-Type` | Yes | `application/json` |

**Handled Events**

| Event | Action |
|---|---|
| `payment.captured` | `Payment.status = CAPTURED`, `escrowStatus = LOCKED`, `Booking.status = CONFIRMED`, OTP generated |
| `payment.failed` | `Payment.status = FAILED` |

**Response `200`**
```json
{ "success": true, "message": "Webhook processed" }
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"Raw body buffer not available"` |
| 401 | `"Invalid signature - webhook rejected"` |

---

### `POST /webhook/razorpayx`

RazorpayX payout event webhook. **No authentication required** — HMAC-SHA256 signature verification using `RAZORPAYX_WEBHOOK_SECRET`. Mounted with raw body middleware.

**Headers**

| Header | Required | Description |
|---|---|---|
| `X-Razorpay-Signature` | Yes | HMAC-SHA256 of raw body using payout webhook secret |
| `Content-Type` | Yes | `application/json` |

**Handled Events**

| Event | Action |
|---|---|
| `payout.processed` | Atomic: `Booking.payoutStatus = PAID`, `Booking.payoutAt = now`, `Payment.escrowStatus = RELEASED` |
| `payout.failed` | `Booking.payoutStatus = FAILED` (escrow remains `LOCKED`) |

> Both handlers are **idempotent** — already-PAID or already-FAILED bookings are silently acknowledged with `200`.

**Payout lifecycle**

```
PENDING → PROCESSING (cron initiates Razorpay payout)
         → PAID     (webhook: payout.processed)
         → FAILED   (webhook: payout.failed OR max cron retries exhausted)
```

**Required Env Var:** `RAZORPAYX_WEBHOOK_SECRET`

**Response `200`**
```json
{ "status": "ok" }
```

**Error Responses**

| Status | Message |
|---|---|
| 400 | `"Missing signature"` |
| 401 | `"Invalid webhook signature"` |

---

| Status | Meaning |
|---|---|
| 400 | Validation error / bad request |
| 401 | Missing, expired, or invalid JWT |
| 403 | Insufficient role or onboarding status |
| 404 | Resource not found |
| 413 | Request body > 10 MB |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

**Standard error shape:**
```json
{
  "success": false,
  "message": "Human-readable error description",
  "errors": [
    { "field": "phone", "message": "Invalid Indian phone number", "value": "123" }
  ]
}
```

**404 route not found:**
```json
{
  "success": false,
  "code": "NOT_FOUND",
  "message": "Route not found",
  "path": "/api/nonexistent",
  "requestId": "req-uuid-here"
}
```

---

## Route Summary Table

| Method | Full Path | Auth Required | Role | Rate Limiter |
|---|---|---|---|---|
| GET | `/health` | No | Public | None |
| POST | `/api/auth/signup` | No | Public | signupLimiter |
| POST | `/api/auth/login` | No | Public | loginLimiter |
| POST | `/api/auth/verify-otp` | No | Public | otpLimiter |
| POST | `/api/auth/helper/verify-otp` | No | Public | otpLimiter |
| POST | `/api/auth/refresh-token` | No | Public | refreshTokenLimiter |
| POST | `/api/auth/logout` | Yes | Any | generalLimiter |
| GET | `/api/user/profile` | Yes | Customer | generalLimiter |
| PUT | `/api/user/profile` | Yes | Customer | generalLimiter |
| POST | `/api/user/register-helper` | Yes | Customer | generalLimiter |
| PUT | `/api/user/bank-details` | Yes | Customer | generalLimiter |
| POST | `/api/user/upload-photo` | Yes | Customer | generalLimiter |
| POST | `/api/user/upload-kyc` | Yes | Customer | generalLimiter |
| GET | `/api/user/helper/:helperId` | No | Public | generalLimiter |
| GET | `/api/user/search-helpers` | No | Public | generalLimiter |
| GET | `/api/user/bookings` | Yes | Customer | generalLimiter |
| GET | `/api/user/bookings/:bookingId` | Yes | Customer/Helper(own)/Admin | generalLimiter |
| POST | `/api/user/bookings/:bookingId/cancel` | Yes | Customer | generalLimiter |
| GET | `/api/user/address` | Yes | Customer | generalLimiter |
| PUT | `/api/user/address` | Yes | Customer | generalLimiter |
| GET | `/api/partner/onboarding/status` | Yes | Helper | generalLimiter |
| POST | `/api/partner/onboarding/profile` | Yes | Helper | generalLimiter |
| POST | `/api/partner/onboarding/kyc` | Yes | Helper | generalLimiter |
| POST | `/api/partner/onboarding/bank` | Yes | Helper | generalLimiter |
| POST | `/api/partner/kyc/upload-selfie` | Yes | Helper | generalLimiter |
| POST | `/api/partner/kyc/verify-pan` | Yes | Helper | generalLimiter |
| POST | `/api/partner/kyc/upload-police` | Yes | Helper | generalLimiter |
| POST | `/api/partner/pan/initiate` | No | Public | generalLimiter |
| POST | `/api/partner/pan/verify` | No | Public | generalLimiter |
| GET | `/api/partner/pan/status` | No | Public | generalLimiter |
| PATCH | `/api/partner/status` | Yes | Approved Helper | generalLimiter |
| GET | `/api/partner/dashboard` | Yes | Approved Helper | generalLimiter |
| GET | `/api/partner/discipline` | Yes | Approved Helper | generalLimiter |
| GET | `/api/partner/earnings/summary` | Yes | Helper | generalLimiter |
| GET | `/api/partner/earnings/history` | Yes | Helper | generalLimiter |
| GET | `/api/partner/earnings/:bookingId` | Yes | Helper | generalLimiter |
| POST | `/api/partner/location/update` | Yes | Approved Helper | generalLimiter |
| GET | `/api/partner/location/route/:bookingId` | Yes | Customer/Helper | generalLimiter |
| GET | `/api/partner/location/current/:bookingId` | Yes | Customer/Helper | generalLimiter |
| GET | `/api/partner/location/history/:userId` | Yes | Any | generalLimiter |
| GET | `/api/partner/location/check-range/:bookingId` | Yes | Any | generalLimiter |
| GET | `/api/partner/location/stream/:bookingId` | Yes | Any | generalLimiter |
| GET | `/api/partner/jobs/user/jobs` | Yes | Any | generalLimiter |
| POST | `/api/partner/jobs` | Yes | Any | generalLimiter |
| GET | `/api/partner/jobs/:jobId` | No | Public | generalLimiter |
| GET | `/api/partner/jobs` | No | Public | generalLimiter |
| PUT | `/api/partner/jobs/:jobId` | Yes | Any | generalLimiter |
| DELETE | `/api/partner/jobs/:jobId` | Yes | Any | generalLimiter |
| GET | `/api/partner/bookings` | Yes | Approved Helper | generalLimiter |
| GET | `/api/partner/bookings/:bookingId` | Yes | Customer/Helper(own)/Admin | generalLimiter |
| POST | `/api/partner/bookings/:bookingId/start` | Yes | Approved Helper | generalLimiter |
| POST | `/api/partner/bookings/:bookingId/regenerate-otp` | Yes | Approved Helper | generalLimiter |
| POST | `/api/partner/bookings/:bookingId/complete` | Yes | Approved Helper | generalLimiter |
| POST | `/api/partner/bookings/:bookingId/before-photos` | Yes | Approved Helper | generalLimiter |
| POST | `/api/partner/bookings/:bookingId/start-timer` | Yes | Approved Helper | generalLimiter |
| POST | `/api/partner/bookings/:bookingId/after-photos` | Yes | Approved Helper | generalLimiter |
| POST | `/api/partner/bookings/:bookingId/report-issue` | Yes | Approved Helper | generalLimiter |
| GET | `/api/partner/reviews` | Yes | Approved Helper | generalLimiter |
| GET | `/api/partner/bank-details` | Yes | Approved Helper | generalLimiter |
| GET | `/api/partner/address` | Yes | Approved Helper | generalLimiter |
| PUT | `/api/partner/address` | Yes | Approved Helper | generalLimiter |
| GET | `/api/partner/services` | Yes | Approved Helper | generalLimiter |
| PUT | `/api/partner/services` | Yes | Approved Helper | generalLimiter |
| GET | `/api/admin/settings/commission` | Yes | Admin | generalLimiter |
| PUT | `/api/admin/settings/commission` | Yes | Admin | generalLimiter |
| POST | `/api/admin/onboarding/approve/:helperId` | Yes | Admin | generalLimiter |
| POST | `/api/admin/onboarding/reject/:helperId` | Yes | Admin | generalLimiter |
| POST | `/api/admin/payout/:bookingId/mark-paid` | Yes | Admin | generalLimiter |
| GET | `/api/admin/finance/summary` | Yes | Admin | generalLimiter |
| GET | `/api/admin/finance/payouts` | Yes | Admin | generalLimiter |
| GET | `/api/admin/finance/payouts/:bookingId` | Yes | Admin | generalLimiter |
| POST | `/api/admin/bookings/:bookingId/cancel` | Yes | Admin | generalLimiter |
| GET | `/api/notifications` | Yes | Any authenticated | generalLimiter |
| PATCH | `/api/notifications/read-all` | Yes | Any authenticated | generalLimiter |
| PATCH | `/api/notifications/:notificationId/read` | Yes | Any authenticated | generalLimiter |
| POST | `/api/notifications/register-device` | Yes | Any authenticated | generalLimiter |
| DELETE | `/api/notifications/register-device` | Yes | Any authenticated | generalLimiter |
| GET | `/api/admin/users` | Yes | Admin | generalLimiter |
| GET | `/api/admin/users/stats` | Yes | Admin | generalLimiter |
| GET | `/api/admin/users/:userId` | Yes | Admin | generalLimiter |
| POST | `/api/admin/users/:userId/block` | Yes | Admin | generalLimiter |
| POST | `/api/admin/users/:userId/unblock` | Yes | Admin | generalLimiter |
| POST | `/api/booking-requests/create` | Yes | Customer | generalLimiter |
| POST | `/api/booking-requests/:requestId/accept` | Yes | Helper | generalLimiter |
| POST | `/api/booking-requests/:requestId/reject` | Yes | Helper | generalLimiter |
| GET | `/api/booking-requests/:requestId/status` | Yes | Customer/Helper | generalLimiter |
| GET | `/api/booking-requests/helper/pending` | Yes | Helper | generalLimiter |
| GET | `/api/booking-requests/customer/history` | Yes | Customer | generalLimiter |
| POST | `/api/payments/create-order` | Yes | Customer | generalLimiter |
| POST | `/api/payments/initiate` | Yes | Customer | generalLimiter |
| POST | `/api/payments/verify` | Yes | Customer | generalLimiter |
| GET | `/api/payments/:paymentId` | Yes | Any | generalLimiter |
| GET | `/api/payments` | Yes | Any | generalLimiter |
| POST | `/api/payments/:paymentId/refund` | Yes | Admin | generalLimiter |
| POST | `/api/ratings` | Yes | Customer | generalLimiter |
| GET | `/api/ratings/service/:serviceId` | No | Public | generalLimiter |
| GET | `/api/ratings/helper/:helperId` | No | Public | generalLimiter |
| GET | `/api/ratings/stats/:helperId` | No | Public | generalLimiter |
| PUT | `/api/ratings/:ratingId` | Yes | Rating Owner | generalLimiter |
| DELETE | `/api/ratings/:ratingId` | Yes | Rating Owner | generalLimiter |
| POST | `/api/services` | Yes | Any | generalLimiter |
| GET | `/api/services/:serviceId` | No | Public | generalLimiter |
| GET | `/api/services` | No | Public | generalLimiter |
| GET | `/api/services/helper/:helperId` | No | Public | generalLimiter |
| PUT | `/api/services/:serviceId` | Yes | Any | generalLimiter |
| DELETE | `/api/services/:serviceId` | Yes | Any | generalLimiter |
| POST | `/webhook/razorpay` | No (signature) | System | None |
| POST | `/webhook/razorpayx` | No (signature) | System | None |

---

*Last updated: 27 February 2026 — Generated from source: src/app.ts, src/auth/, src/modules/, src/core/*

**Changelog (27 Feb 2026):**
- Added `POST /api/partner/kyc/upload-selfie` — Step 1 of 3-step KYC flow
- Added `POST /api/partner/kyc/verify-pan` — Step 2, IDFY OCR + verification (bypass mode when `ENABLE_IDFY_OCR=false`)
- Added `POST /api/partner/kyc/upload-police` — Step 3, police document upload
- Added `POST /api/admin/payout/:bookingId/mark-paid` — Manual admin payout approval
- `HelperBank` schema: added `razorpayFundAccountId String?` for RazorpayX integration
- `payout.service.ts`: real RazorpayX `payouts.create()` call with idempotency key, retry logic (max 3, exponential backoff)
- **Security (IDOR fix):** `GET /api/user/bookings/:bookingId` and `GET /api/partner/bookings/:bookingId` enforce ownership
- Added `POST /webhook/razorpayx` — RazorpayX payout webhook (`payout.processed` → PAID + escrow RELEASED, `payout.failed` → FAILED)
- Added daily reconciliation cron (`0 3 * * *`) — syncs PROCESSING bookings against Razorpay live status
- Added `POST /api/partner/onboarding/bank` Razorpay fund account auto-creation on bank submission; response now includes `payoutRegistered` + `payoutSetupStatus`
- `Helper` schema: added `payoutEnabled`, `payoutSetupStatus`, `payoutRetryCount`, `lastPayoutRetryAt` fields
- Added payout registration retry cron (`*/30 * * * *`) — retries failed Razorpay Contact + Fund Account creation (max 5 attempts)
- Added alerting service (`alert.service.ts`) with Slack webhook support (`SLACK_WEBHOOK_URL` env var) for `PAYOUT_FAILED`, `PAYOUT_STUCK`, `FUND_REGISTRATION_FAILED` events
- Added `GET /api/admin/finance/summary` — aggregated financial metrics
- Added `GET /api/admin/finance/payouts` — paginated payout records with filters (status, date range, helperId)
- Added `GET /api/admin/finance/payouts/:bookingId` — full payout audit trail per booking
- **[Phase 20] Immutable financial ledger system:**
  - Schema: added `LedgerType` enum (6 values), `LedgerDirection` enum, `LedgerEntry` model (`Decimal(14,2)`, insert-only, `@@unique([type, referenceId])`)
  - Migration: `20260227000004_add_ledger_entry`
  - `ledger.service.ts`: `createLedgerEntry(params, tx?)` — typed, idempotent, no `any`
  - `POST /webhook/razorpay` `payment.captured` handler: now atomically writes `PAYMENT_CAPTURED` + `ESCROW_LOCK` + `COMMISSION_EARNED` ledger entries inside the capture transaction
  - `POST /webhook/razorpayx` `payout.processed` handler: converted from array-form to interactive `$transaction`; now atomically writes `HELPER_PAYOUT` ledger entry
  - `POST /api/payments/:paymentId/refund`: wrapped in `$transaction`; writes `REFUND_ISSUED` + conditional `PAYOUT_REVERSAL` if helper was already paid
  - `alert.service.ts`: added `FINANCE_MISMATCH` to `AlertType` union
  - `finance.ledger.service.ts`: ledger-based aggregation functions (`getTotalRevenue`, `getTotalCommission`, `getTotalHelperPayout`, `getTotalRefunds`, `getLedgerSummary`, `getBookingLedger`)
  - `ledger.integrity.service.ts`: `checkLedgerIntegrity()` — daily CREDIT/DEBIT balance check + helper payout reconciliation; alerts on mismatch
  - `src/scripts/backfill-ledger.ts`: idempotent backfill for all historical CAPTURED bookings
- **[6 March 2026] Work photos + job timer:**
  - Schema: added `WorkPhotoType` enum (`BEFORE | AFTER`), `BookingWorkPhoto` model, `jobTimerStarted Boolean`, `jobStartedAt DateTime?` on `Booking`
  - Migrations: `20260306000001_add_booking_work_photos`, `20260306000002_add_booking_job_timer`
  - Added `POST /api/partner/bookings/:bookingId/before-photos` — upload 1–5 JPEG/PNG before-work photos to S3; stored in `BookingWorkPhoto` with `type=BEFORE`; requires `IN_PROGRESS`
  - Added `POST /api/partner/bookings/:bookingId/start-timer` — starts job clock (`jobTimerStarted=true`, `jobStartedAt`); requires `IN_PROGRESS` + at least 1 BEFORE photo; one-shot
  - Added `POST /api/partner/bookings/:bookingId/after-photos` — upload 1–5 JPEG/PNG after-work photos; requires `IN_PROGRESS` + timer started; stored with `type=AFTER`
- **[6 March 2026] CORS configuration:**
  - Added `http://localhost:5173` (Vite) to `DEV_ORIGINS` in `src/middlewares/security.middleware.ts`
  - Added `ALLOWED_ORIGINS` env var to `.env` for production use: `https://admin.zynexxindia.com`, `https://zynexxindia.com`, `http://localhost:3000`, `http://localhost:5173`
  - In production (`NODE_ENV=production`) the middleware reads `ALLOWED_ORIGINS` (comma-separated); unset = all cross-origin blocked + error logged
  - `credentials: true`, preflight `OPTIONS` supported, `origin: *` never used
- **[6 March 2026] Booking Issue Reporting + Admin Override Cancellation (Phases 27–28):**
  - Schema: added `BookingIssue` model with `resolved`, `resolvedAt`, `resolvedBy` fields; `issues BookingIssue[]` back-relation on `Booking`
  - Migrations: `20260306000003_add_booking_issue`, `20260306000004_booking_issue_resolution`
  - Added `POST /api/partner/bookings/:bookingId/report-issue` — helper reports a problem (CONFIRMED/IN_PROGRESS only, one issue per booking, OTHER reason requires notes, raises Slack alert + admin push notification)
  - Added `POST /api/admin/bookings/:bookingId/cancel` — admin force-cancel with atomic `$transaction`: cancels booking, refunds payment if CAPTURED, resolves open `BookingIssue` records; idempotent if already CANCELLED; sets `payoutReversalRequired` flag if helper already paid
  - `alert.service.ts`: added `BOOKING_ISSUE_REPORTED` to `AlertType` union
- **[6 March 2026] Firebase Push Notification System (Phase 29):**
  - Installed `firebase-admin` npm package
  - Schema: added `DeviceToken` model (userId, token @unique, platform), `NotificationLog` model (userId, title, body, type, data Json?), `User.blockedReason String?`; back-relations on `User`
  - Migrations: `20260306000005_add_device_tokens_and_notification_log`
  - `src/services/firebase.service.ts`: `initializeFirebase()` — reads `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY`; no-op when unconfigured
  - `src/services/push.service.ts`: `sendPushNotification`, `sendPushToMany`, `sendPushToRole`, `sendPushToHelperIds` — all fire-and-forget; prunes dead tokens; writes `NotificationLog`
  - Added `POST /api/notifications/register-device` — upsert FCM token (ANDROID/IOS/WEB)
  - Added `DELETE /api/notifications/register-device` — unregister token on logout
  - Booking lifecycle hooks: push `BOOKING_NEW` to nearby helpers on dispatch; `BOOKING_ACCEPTED` to customer + `BOOKING_ASSIGNED` to helper on accept; `JOB_STARTED` to customer after start OTP; `JOB_COMPLETED` to customer after completion; `BOOKING_ISSUE_REPORTED` to all admin users
- **[6 March 2026] Admin User Management APIs (Phase 30):**
  - Schema: added `blockedReason String?` to `User` model; migration `20260306000006_add_user_blocked_reason`
  - Added `GET /api/admin/users` — paginated user list with search/status filters + per-user booking stats (single `$queryRaw` JOIN, no N+1)
  - Added `GET /api/admin/users/stats` — aggregate `{ total, active, blocked }` counts
  - Added `GET /api/admin/users/:userId` — full profile + helper profile + recent bookings + stats
  - Added `POST /api/admin/users/:userId/block` — block with reason; 409 if already blocked
  - Added `POST /api/admin/users/:userId/unblock` — unblock; 409 if not blocked
- **[6 March 2026] Partner Reviews API:**
  - Added `GET /api/partner/reviews` — returns all ratings received by the authenticated helper, sorted newest-first; response includes `rating`, `review`, `customerName`, `bookingId`, `createdAt`; `review` is `null` if customer left no text
  - `src/modules/partner/review.controller.ts` + `review.routes.ts` created; mounted at `/reviews` in partner module index
- **[6 March 2026] Razorpay lazy initialization refactor:**
  - `src/services/razorpay.contact.service.ts`: removed module-level `const razorpay = new Razorpay(...)` singleton
  - Added `getRazorpay()` function — validates `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` presence before instantiating; throws `"Razorpay environment variables are missing"` if either is absent
  - `createRazorpayContactAndFundAccount()` now calls `getRazorpay()` on entry — instance is created only at call time, not at module import; prevents server crash on startup when env vars are not yet loaded
- **[7 March 2026] Partner Bank Details API:**
  - Added `GET /api/partner/bank-details` — returns the helper's registered bank account (`accountName`, `accountNumber`, `ifsc`, `isVerified`, `razorpayFundAccountId`); responds `data: null` if no bank registered yet
  - `src/modules/partner/bank.controller.ts` + `bank.routes.ts` created; mounted at `/bank-details` in partner module index
- **[7 March 2026] User Address APIs:**
  - Schema: added `address String?`, `city String?`, `pinCode String?`, `latitude Float?`, `longitude Float?` to `User` model; migration `20260307000001_add_user_address`
  - Added `GET /api/user/address` — returns saved address fields (`address`, `city`, `pinCode`, `latitude`, `longitude`); all fields `null` if not yet set
  - Added `PUT /api/user/address` — updates address; validates `address`, `city`, `pinCode` (required, max 10 chars), optional `latitude`/`longitude`; returns 400 on validation failure
  - `src/modules/user/address.controller.ts` + `address.routes.ts` created; mounted at `/` in user module index
- **[7 March 2026] Partner Address APIs:**
  - No schema changes — `HelperProfile` already contains `address`, `city`, `pinCode`, `latitude`, `longitude`
  - Added `GET /api/partner/address` — returns address from `HelperProfile`; all fields `null` if profile not set yet
  - Added `PUT /api/partner/address` — upserts `HelperProfile` with address data; validates `address`, `city`, `pinCode` (required, pinCode max 10), optional `latitude`/`longitude`
  - `src/modules/partner/address.controller.ts` + `address.routes.ts` created; mounted at `/address` in partner module index
- **[7 March 2026] Partner Manage Services APIs:**
  - No schema changes — uses existing `HelperService` join table
  - Added `GET /api/partner/services` — returns `[{ serviceId, name }]` for all services the helper currently offers; empty array if none registered
  - Added `PUT /api/partner/services` — full replace via `$transaction` (deleteMany + createMany); body `{ serviceIds: number[] }`, array must be non-empty with positive integers
  - `src/modules/partner/services.controller.ts` + `services.routes.ts` created; mounted at `/services` in partner module index
- **[7 March 2026] Notification Read System:**
  - Schema: added `isRead Boolean @default(false)` + `@@index([isRead])` to `NotificationLog`; migration `20260307000002_add_notification_is_read`
  - `GET /api/notifications` response now includes `isRead` field per notification
  - `PATCH /api/notifications/read-all` — now fully implemented: `updateMany({ where: { userId, isRead: false }, data: { isRead: true } })`; previously a no-op placeholder
  - Added `PATCH /api/notifications/:notificationId/read` — marks a single notification as read; validates ownership via `findFirst({ where: { id, userId } })` before updating; returns 404 if not found or unauthorized
  - `markNotificationReadHandler` added to `notification.controller.ts`; route added to `notification.routes.ts`
- **[7 March 2026] Helper Live Location System:**
  - Schema: added `HelperLocation` model (`id`, `helperId @unique`, `latitude`, `longitude`, `heading?`, `accuracy?`, `speed?`, `updatedAt @updatedAt`) + `@@index([helperId])`; added `location HelperLocation?` back-relation to `Helper`; migration `20260307000003_add_helper_location`
  - `src/services/location.service.ts`: added `updateHelperLocation(helperId, lat, lng, opts?)` — upserts `HelperLocation` row; called automatically from `updateLocation` after the `HelperProfile` upsert
  - Added `getHelperLiveLocation(bookingId)` — resolves booking → `helperId` → `HelperLocation` row; returns `{ helperId, latitude, longitude, updatedAt }` or `null`
  - `GET /api/partner/location/current/:bookingId` — updated to query `HelperLocation` (via `getHelperLiveLocation`); response is now `{ helperId, latitude, longitude, updatedAt }`; returns 404 when helper has no location row yet
  - `POST /api/partner/location/update` — now also accepts optional `heading` and `speed` body fields; both stored in `HelperLocation`
- **[7 March 2026] Geo-Dispatch System (staggered waves):**
  - `src/services/dispatch.service.ts` — production-grade geo-dispatch using `$queryRaw` against `HelperLocation`
  - `findNearbyHelpers(serviceId, latitude, longitude)` — Haversine in PostgreSQL via subquery; filters `isAvailable = true`, `onboardingStatus = 'APPROVED'`, `distance < 5km`; returns up to **20** helper IDs sorted by distance ASC (increased from 10 to cover all three waves)
  - `dispatchBookingRequest(requestId)` — staggered three-wave dispatch:
    - **Wave 1 (0s)** → `helpers[0..2]` (nearest 3) — sent immediately
    - **Wave 2 (30s)** → `helpers[3..7]` (next 5) — `setTimeout(30_000)`
    - **Wave 3 (60s)** → `helpers[8..17]` (next 10) — `setTimeout(60_000)`
    - Each wave re-checks `BookingRequest.status` before sending; silently skips if no longer `PENDING` (e.g. already ACCEPTED)
    - All `dispatchedHelperIds` (all waves combined) written to DB immediately after split
    - Internal `sendWave()` helper handles socket emit + FCM push per wave; never throws
    - Top-level function never throws — all errors caught and logged
  - Hooked into `booking-dispatch.service.ts`: `dispatchBookingRequest(bookingRequest.id).catch(() => {})` called fire-and-forget immediately after `prisma.bookingRequest.create`
- **[7 March 2026] Multi-Address System:**
  - Schema: added `UserAddress` model (`id`, `userId`, `label?`, `address`, `city`, `pinCode`, `latitude`, `longitude`, `isDefault @default(false)`, `createdAt`); added `addresses UserAddress[]` back-relation to `User`; migration `20260307000004_add_user_addresses`
  - Old single-address fields on `User` remain for backward compatibility; `UserAddress` table is now the canonical multi-address store
  - `GET /api/user/addresses` — returns all saved addresses ordered oldest-first; each record includes `id`, `label`, `address`, `city`, `pinCode`, `latitude`, `longitude`, `isDefault`, `createdAt`
  - `POST /api/user/addresses` — creates address; required: `address`, `city`, `pinCode`, `latitude`, `longitude`; optional: `label`, `isDefault`; if `isDefault=true`, all others unset atomically via `$transaction`; first address auto-gets `isDefault=true`
  - `PUT /api/user/addresses/:addressId` — updates address (ownership check; 403 if not found/owned); all fields optional; `isDefault=true` unsets others atomically
  - `DELETE /api/user/addresses/:addressId` — deletes address (ownership check); if deleted was default, oldest remaining is promoted to default
  - `src/modules/user/address.controller.ts` fully replaced (4 handlers: `getUserAddresses`, `createUserAddress`, `updateUserAddress`, `deleteUserAddress`)
  - `src/modules/user/address.routes.ts` fully replaced (`GET|POST /` + `PUT|DELETE /:addressId`)
  - `src/modules/user/index.ts`: mount changed from `router.use('/', addressRoutes)` → `router.use('/addresses', addressRoutes)`
- **[8 March 2026] Admin User Booking History API:**
  - Added `GET /api/admin/users/:userId/bookings` — paginated booking history for a specific user (admin only)
  - Query params: `page` (default 1), `limit` (default 20, max 100)
  - Validates `userId` param (400 if invalid); 404 if user not found
  - Returns each booking with: `id`, `status`, `totalAmount`, `finalAmount`, `bookingDate`, `createdAt`, `address`, `service.name`, `helper.user.fullName`
  - Response includes `pagination: { page, limit, total, totalPages }`
  - `getUserBookingsHandler` added to `src/modules/admin/admin-user.controller.ts`; route added to `src/modules/admin/admin-user.routes.ts`
- **[8 March 2026] Admin Helper Management APIs:**
  - Created `src/modules/admin/admin-helper.controller.ts` + `admin-helper.routes.ts`; mounted at `/helpers` in `src/modules/admin/index.ts`
  - `GET /api/admin/helpers` — paginated helper list; query: `page`, `limit`, `search` (name/phone), `status` (`active`|`inactive`); response per helper: `helperId`, `name`, `phone`, `rating`, `orders`, `earnings`, `status`, `joinedAt`; orders + earnings resolved in a single `$queryRaw GROUP BY` to avoid N+1
  - `GET /api/admin/helpers/stats` — `{ totalHelpers, activeHelpers, inactiveHelpers }` via three parallel `count` queries; registered before `/:helperId` to prevent route shadowing
  - `GET /api/admin/helpers/:helperId` — full helper detail: `helperId`, `name`, `phone`, `address`, `city` (from `HelperProfile`), `rating`, `totalRatings`, `status`, `joinedAt`, `services[]`, `orders`, `earnings`, `recentBookings[]` (last 10); all three queries run in `Promise.all`
  - `PATCH /api/admin/helpers/:helperId/status` — body `{ status: "active" | "inactive" }`; `active` → `user.isActive=true, isBlocked=false`; `inactive` → `$transaction` setting `user.isActive=false` + `helper.isOnline=false, isAvailable=false`; 400 on invalid status value
  - `GET /api/admin/helpers/:helperId/bookings` — paginated booking history for a helper; query: `page`, `limit`; response per booking: `bookingId`, `service`, `amount`, `status`, `bookingDate`; registered before `/:helperId` to prevent Express sub-path shadowing
- **[8 March 2026] Admin Helper Bookings — enhanced with status filter + customer + address:**
  - `GET /api/admin/helpers/:helperId/bookings` upgraded: added optional `status` query param (allowed: `COMPLETED`, `CONFIRMED`, `IN_PROGRESS`, `CANCELLED`; silently ignored if invalid)
  - Added `customer` join (`User.fullName`) and `address` field to Prisma select
  - Response shape updated: `bookingId`, `service`, `customer`, `date`, `address`, `amount`, `status` — both `findMany` and `count` share the same `where` object so pagination is always accurate with the filter applied
- **[8 March 2026] Admin Helpers List — single aggregated SQL query rewrite:**
  - `GET /api/admin/helpers` rewritten to use a single `$queryRaw` with `JOIN Helper → User LEFT JOIN Booking LEFT JOIN Payment GROUP BY h.id` — resolves `orders` (COUNT bookings) and `earnings` (SUM of CAPTURED payment amounts) in one DB round-trip; eliminates the previous 3-query flow
  - Count query runs in parallel via a lightweight subquery `SELECT COUNT(*) FROM (...GROUP BY h.id) AS sub`
  - WHERE filters built safely with `Prisma.sql` + `Prisma.join` — no string interpolation or SQL injection risk
  - `status=active` → `h."isAvailable" = true`; `status=inactive` → `h."isAvailable" = false`
  - Response field names: `id`, `name`, `phone`, `rating`, `orders`, `earnings`, `status`, `joinedAt`
- **[8 March 2026] Admin Order Management List API:**
  - Created `src/modules/admin/admin-bookings.controller.ts`; `GET /` route added to existing `src/modules/admin/admin-booking.routes.ts` (already mounted at `/api/admin/bookings`)
  - `GET /api/admin/bookings` — paginated booking list for Admin Order Management table
  - Query params: `page` (default 1), `limit` (default 20, max 100), `search` (optional), `status` (optional: `PENDING_PAYMENT` | `CONFIRMED` | `IN_PROGRESS` | `COMPLETED` | `CANCELLED`)
  - `search` matches on customer `fullName`, customer `phone`, helper `user.fullName`, or numeric `bookingId` via single `OR` clause — no N+1
  - 5 queries run in `Promise.all`: `findMany`, filtered `count`, `activeNow` (IN_PROGRESS count), `pending` (CONFIRMED count), `completed` (COMPLETED count)
  - Response includes `stats: { totalBookings, activeNow, pending, completed }` for dashboard cards, `pagination: { page, limit, total, totalPages }`, and `data[]`
  - Each row: `bookingId`, `customerName`, `customerPhone`, `helperName`, `helperId`, `serviceName`, `planType` (from `ServicePlan.type`), `bookingDate`, `amount` (`finalAmount`), `status`
- **[8 March 2026] Admin Booking Details API:**
  - Created `src/modules/admin/admin-booking-details.controller.ts`; `GET /:bookingId` route added to `src/modules/admin/admin-booking.routes.ts`
  - `GET /api/admin/bookings/:bookingId` — full booking detail for the Admin Order Management modal
  - 400 if `bookingId` is not a valid integer; 404 if booking not found
  - Single `prisma.booking.findUnique` with nested selects for `customer`, `helper.user`, `service`, `payment` — no N+1
  - Response: `{ bookingId, status, bookingDate, duration, serviceAddress, user: { id, name, phone }, partner: { id, name, service }, payment: { serviceAmount, totalAmount, paymentStatus } }`
  - `serviceAmount` = `payment.amount` (null if no payment record); `totalAmount` = `booking.finalAmount`; `paymentStatus` = `payment.status` (null if no payment record)
