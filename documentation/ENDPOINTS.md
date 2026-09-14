# Partner Backend Endpoints Summary

## Quick Reference Guide

### Authentication (No Auth Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/send-otp` | Send OTP to phone number |
| POST | `/api/auth/verify-otp` | Verify OTP and get tokens |
| POST | `/api/auth/refresh-token` | Get new access token |

### Authentication (Auth Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/logout` | Logout user |

### Users (No Auth Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/helper/:helperId` | Get helper profile |
| GET | `/api/users/search-helpers` | Search helpers |

### Users (Auth Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/profile` | Get user profile |
| PUT | `/api/users/profile` | Update profile |
| POST | `/api/users/register-helper` | Register as helper |
| PUT | `/api/users/bank-details` | Update bank details |
| POST | `/api/users/upload-photo` | Upload profile photo |
| POST | `/api/users/upload-kyc` | Upload KYC documents |

### Services (No Auth Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/services` | List all services |
| GET | `/api/services/:serviceId` | Get service details |
| GET | `/api/services/helper/:helperId` | Get helper services |

### Services (Auth Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/services` | Create service |
| PUT | `/api/services/:serviceId` | Update service |
| DELETE | `/api/services/:serviceId` | Delete service |

### Jobs (No Auth Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs` | List jobs |
| GET | `/api/jobs/:jobId` | Get job details |

### Jobs (Auth Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/jobs` | Create job |
| GET | `/api/jobs/user/jobs` | Get user jobs |
| PUT | `/api/jobs/:jobId` | Update job |
| DELETE | `/api/jobs/:jobId` | Delete job |

### Bookings (No Auth Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bookings/:bookingId` | Get booking details |

### Bookings (Auth Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bookings` | Create booking |
| GET | `/api/bookings` | Get my bookings |
| PUT | `/api/bookings/:bookingId/status` | Update status |
| POST | `/api/bookings/:bookingId/cancel` | Cancel booking |
| GET | `/api/bookings/helper/bookings` | Get helper bookings |

### Payments (Auth Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/initiate` | Initiate payment |
| POST | `/api/payments/verify` | Verify payment |
| GET | `/api/payments/:paymentId` | Get payment details |
| GET | `/api/payments` | Get payment history |
| POST | `/api/payments/:paymentId/refund` | Refund payment |

### Ratings (No Auth Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ratings/service/:serviceId` | Get service ratings |
| GET | `/api/ratings/helper/:helperId` | Get helper ratings |
| GET | `/api/ratings/stats/:helperId` | Get rating stats |

### Ratings (Auth Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ratings` | Create rating |
| PUT | `/api/ratings/:ratingId` | Update rating |
| DELETE | `/api/ratings/:ratingId` | Delete rating |

---

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

---

## Common Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 10) |
| `status` | string | Filter by status |
| `category` | string | Filter by category |
| `city` | string | Filter by city |
| `sort` | string | Sort order |

---

## Authentication Header

All protected endpoints require:
```
Authorization: Bearer {accessToken}
```

---

## Service Categories

- PLUMBING
- ELECTRICAL
- CARPENTRY
- PAINTING
- CLEANING
- GARDENING
- APPLIANCE_REPAIR
- FURNITURE_REPAIR
- PEST_CONTROL
- AC_SERVICE
- OTHER

---

## Status Values

**Booking Status:** PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED

**Payment Status:** PENDING, COMPLETED, FAILED, REFUNDED

**KYC Status:** PENDING, SUBMITTED, APPROVED, REJECTED
