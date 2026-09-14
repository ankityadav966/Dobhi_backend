# Partner APIs - Routes Reference
**Base URL:** `/api/partner`

---

## All Partner Routes

## All Partner Routes

### 1. Onboarding

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/onboarding/status` | HELPER | Get onboarding status |
| `POST` | `/onboarding/profile` | HELPER | Submit professional profile |
| `POST` | `/onboarding/kyc` | HELPER | Submit KYC info |
| `POST` | `/onboarding/bank` | HELPER | Submit bank details |

---

### 2. Operational Status

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `PATCH` | `/status` | Approved Helper | Toggle online/offline |
| `GET` | `/dashboard` | Approved Helper | Operational dashboard |
| `GET` | `/discipline` | Approved Helper | Discipline record |

---

### 3. Bookings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/bookings` | Approved Helper | List all bookings |
| `GET` | `/bookings/upcoming` | Approved Helper | Get upcoming bookings |
| `GET` | `/bookings/:bookingId` | Approved Helper | Get booking details |
| `POST` | `/bookings/:bookingId/start` | Approved Helper | Start booking with OTP |
| `POST` | `/bookings/:bookingId/regenerate-otp` | Approved Helper | Get new OTP |
| `POST` | `/bookings/:bookingId/complete` | Approved Helper | Mark as completed |
| `POST` | `/bookings/:bookingId/before-photos` | Approved Helper | Upload before photos |
| `POST` | `/bookings/:bookingId/start-timer` | Approved Helper | Start job timer |
| `POST` | `/bookings/:bookingId/after-photos` | Approved Helper | Upload after photos |
| `POST` | `/bookings/:bookingId/report-issue` | Approved Helper | Report booking issue |

---

### 4. Location

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/location/update` | Approved Helper | Update location |
| `GET` | `/location/route/:bookingId` | Authenticated | Get route to customer |
| `GET` | `/location/current/:bookingId` | Authenticated | Get current location |
| `GET` | `/location/history/:userId` | Authenticated | Get location history |
| `GET` | `/location/check-range/:bookingId` | Authenticated | Check if in range |
| `GET` | `/location/stream/:bookingId` | Authenticated | Stream live location |

---

### 5. Earnings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/earnings/summary` | HELPER | Get earnings summary |
| `GET` | `/earnings/history` | HELPER | Get earnings history |
| `GET` | `/earnings/:bookingId` | HELPER | Get earnings detail |

---

### 6. Jobs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/jobs` | Public | List all jobs |
| `POST` | `/jobs` | Authenticated | Create new job |
| `GET` | `/jobs/user/jobs` | Authenticated | Get your jobs |
| `GET` | `/jobs/:jobId` | Public | Get job details |
| `PUT` | `/jobs/:jobId` | Authenticated | Update job |
| `DELETE` | `/jobs/:jobId` | Authenticated | Delete job |

---

### 7. KYC Documents

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/kyc/upload-selfie` | HELPER | Upload selfie |
| `POST` | `/kyc/upload-pan` | HELPER | Upload PAN card |
| `POST` | `/kyc/upload-police` | HELPER | Upload police clearance |

---

### 8. Address

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/address` | Approved Helper | Get service address |
| `PUT` | `/address` | Approved Helper | Update service address |

---

### 9. Bank Details

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/bank-details` | Approved Helper | Get bank account info |

---

### 10. Services

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/services` | Approved Helper | Get offered services |
| `PUT` | `/services` | Approved Helper | Update offered services |

---

### 11. Reviews

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/reviews` | Approved Helper | Get all reviews |

---

## Authentication Types

| Type | Meaning |
|------|---------|
| **Public** | No auth required |
| **Authenticated** | Any valid JWT token |
| **HELPER** | JWT + `role === HELPER` |
| **Approved Helper** | JWT + `role === HELPER` + `onboardingStatus === APPROVED` |

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | OK / Success |
| `201` | Created |
| `400` | Bad Request |
| `401` | Unauthorized |
| `403` | Forbidden |
| `404` | Not Found |
| `409` | Conflict |
| `413` | Payload Too Large |
| `422` | Validation Error |
| `429` | Rate Limited |
| `500` | Server Error |

---

**Total Routes:** 44 endpoints  
**Last Updated:** March 2024
