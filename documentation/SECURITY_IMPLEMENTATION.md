# Production-Level Security Implementation

## Overview
This document outlines the comprehensive security implementations added to the Zynexx Partner Backend for production-level authentication and data protection.

## 🔒 Security Enhancements Implemented

### 1. **Authentication & Authorization**

#### JWT Token Management
- **Access Token**: 15-minute expiration (short-lived)
- **Refresh Token**: 7-day expiration (long-lived)
- **Token Payload**: Includes userId, phone, and role
- **Token Blacklisting**: Invalidates tokens on logout

#### OTP-Based Authentication
- **Phone Verification**: Indian 10-digit phone numbers
- **OTP Expiry**: 10 minutes (configurable)
- **Rate Limiting**: 
  - Signup: 5 accounts per day per IP
  - Login: 5 attempts per 15 minutes
  - OTP Requests: 3 per 30 minutes

### 2. **Middleware Protection**

#### Security Headers (Helmet.js)
- `Content-Security-Policy`: Strict directive limits
- `Strict-Transport-Security`: Forces HTTPS
- `X-Frame-Options`: deny (prevents clickjacking)
- `X-Content-Type-Options`: nosniff
- `X-XSS-Protection`: 1; mode=block
- `Referrer-Policy`: strict-origin-when-cross-origin

#### CORS Configuration
- Whitelist-based origin validation
- Credential support enabled
- Custom allowed headers
- Preflight cache: 1 hour

#### Rate Limiting (Multiple Strategies)
- **General API**: 100 requests per 15 minutes
- **Auth Endpoints**: 5 requests per 15 minutes
- **OTP Endpoints**: 3 requests per 30 minutes
- **Login Attempts**: 5 per 15 minutes
- **Password Reset**: 3 per hour
- **Token Refresh**: 10 per hour
- **Signup**: 5 per day per IP

#### Input Validation & Sanitization
- Phone: 10 digits starting with 6-9
- Email: Valid format with normalization
- Password: Minimum 8 chars with uppercase, lowercase, number, special char
- Full Name: 2-100 chars, letters/spaces/hyphens only
- PAN: Valid Indian PAN format
- GST: Valid Indian GST format
- Bank Details: IFSC code validation, 9-18 digit account numbers
- All text inputs: HTML tag removal, XSS vector prevention

#### HTTP Parameter Pollution (HPP) Protection
- Query string length limiting (2000 chars max)
- Prevents parameter injection attacks

#### Request Size Limiting
- JSON payload max: 10MB
- URL-encoded payload max: 10MB

### 3. **Request Tracking & Logging**

#### Request ID Tracking
- Unique ID for each request
- Passed through all operations
- Included in logs for traceability

#### Security Logging
- All authentication attempts
- Failed validations
- Rate limit violations
- Token operations
- User account changes
- Suspicious activities

### 4. **Token Blacklisting**

#### Token Revocation
- Logout immediately invalidates refresh tokens
- In-memory store (upgrade to Redis for distributed systems)
- Automatic cleanup of expired tokens (hourly)
- Prevents token reuse after logout

### 5. **Error Handling**

#### Secure Error Responses
- No sensitive information in error messages
- Consistent error format
- Proper HTTP status codes
- Request ID included for debugging

#### Error Types Handled
- 400: Bad Request (validation errors)
- 401: Unauthorized (auth failures)
- 403: Forbidden (insufficient permissions)
- 404: Not Found
- 409: Conflict (duplicate accounts)
- 429: Too Many Requests (rate limit)
- 500: Server Error (with request ID)

### 6. **Password Security**

#### Requirements
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (@$!%*?&)

### 7. **Data Validation**

#### Phone Number Validation
- Indian format: 10 digits starting with 6-9
- Regex: `^[6-9]\d{9}$`

#### Bank Details Validation
- Account Number: 9-18 digits
- IFSC Code: Standard Indian format
- Account Type: SAVINGS or CURRENT

#### Location Validation
- Latitude: -90 to 90
- Longitude: -180 to 180
- Accuracy: Positive number

#### Pagination Validation
- Page: Positive integer
- Limit: 1-100 (prevents large data dumps)

## 📋 Validation Rules by Endpoint

### Authentication Endpoints
```
POST /api/auth/signup
- phone: 10 digits (6-9xxxxxx)
- fullName (optional): 2-100 chars

POST /api/auth/login
- phone: 10 digits (6-9xxxxxx)

POST /api/auth/request-otp
- phone: 10 digits (6-9xxxxxx)

POST /api/auth/verify-otp
- phone: 10 digits (6-9xxxxxx)
- otp: 4-6 digits
- fullName (if new user): 2-100 chars

POST /api/auth/refresh-token
- refreshToken: Valid JWT token

POST /api/auth/logout
- refreshToken (optional): Token to blacklist
(Requires Authorization header with access token)
```

### User Profile Endpoints
```
POST /api/users/profile (requires auth)
- fullName: 2-100 chars
- email: Valid format
- address: 5-200 chars
- city: 2-50 chars
- pinCode: 6 digits
```

### Service Endpoints
```
POST /api/services (requires auth)
- category: Predefined list
- title: 3-100 chars
- description: Max 1000 chars
- hourlyRate: Positive float
- minimumHours: 1-100
```

### Booking Endpoints
```
POST /api/bookings (requires auth)
- serviceId: Valid UUID
- startTime: ISO8601, future date
- totalHours: 1-100
- address: 5-200 chars
- city: 2-50 chars
- pinCode: 6 digits
```

### Partner/Helper Registration
```
POST /api/auth/partner-registration
- All signup fields +
- businessName: 3-100 chars
- gst: Valid GST format
- address: 5-200 chars
- city: 2-50 chars
- pinCode: 6 digits
```

## 🔐 Environment Variables Required

```env
# JWT Configuration
JWT_SECRET=your_strong_secret_key_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d

# OTP Configuration
OTP_EXPIRE=600
MSG91_AUTH_KEY=your_msg91_key
MSG91_ROUTE=your_msg91_route

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Redis (for production)
REDIS_URL=redis://localhost:6379

# Node Environment
NODE_ENV=production
PORT=5000
```

## 🚀 Deployment Recommendations

### Production Checklist
- [ ] Use strong JWT secrets (minimum 32 characters)
- [ ] Enable HTTPS/TLS for all endpoints
- [ ] Use Redis for token blacklisting (not in-memory)
- [ ] Configure proper CORS origins
- [ ] Set NODE_ENV=production
- [ ] Enable database SSL connections
- [ ] Use environment variables (never commit secrets)
- [ ] Set up monitoring and alerting
- [ ] Enable audit logging
- [ ] Regular security patches
- [ ] Database backups and recovery plan

### Redis Setup for Production
```javascript
// Install for distributed systems
npm install redis

// In token-blacklist.service.ts:
import { createClient } from 'redis';
const client = await createClient({
  url: config.redis.url
}).connect();
```

### Monitoring
- Track failed auth attempts
- Monitor rate limit violations
- Alert on unusual activity patterns
- Log all token operations
- Database query performance monitoring

## 🔄 Token Flow Diagram

```
User Login/Signup
    ↓
Phone Validation + OTP Request
    ↓
OTP Verification
    ↓
Generate Access & Refresh Tokens
    ↓
Return to Client
    ↓
Client Stores Access Token (15 min)
Client Stores Refresh Token (7 days)
    ↓
API Requests (with Access Token)
    ↓
Token Expires → Use Refresh Token
    ↓
Generate New Access Token
    ↓
Logout → Blacklist Refresh Token
```

## 🛡️ Attack Prevention

### SQL Injection
- Prisma ORM with parameterized queries
- Input validation before database queries

### XSS (Cross-Site Scripting)
- Input sanitization removing HTML tags
- Content Security Policy headers
- No eval() or dangerous functions

### CSRF (Cross-Site Request Forgery)
- Same-site cookie attributes
- Token validation on state-changing operations

### Brute Force
- Rate limiting on auth endpoints
- Exponential backoff recommended for frontend
- Account lockout after failed attempts

### Token Hijacking
- Short-lived access tokens (15 minutes)
- Secure refresh token rotation
- Token blacklisting on logout

### Data Exposure
- No sensitive data in error messages
- Proper HTTP status codes
- Secure logging without sensitive info

## 📊 Security Audit Points

1. **Token Security**
   - ✅ JWT signature verification
   - ✅ Token expiration checks
   - ✅ Refresh token rotation
   - ✅ Token blacklisting on logout

2. **Authentication**
   - ✅ OTP-based verification
   - ✅ Phone number validation
   - ✅ User existence checks
   - ✅ Rate limiting

3. **Authorization**
   - ✅ Role-based access control (RBAC)
   - ✅ Protected endpoints
   - ✅ Permission checks

4. **Data Protection**
   - ✅ Input validation
   - ✅ Output encoding
   - ✅ Rate limiting
   - ✅ CORS protection

5. **Logging & Monitoring**
   - ✅ Request ID tracking
   - ✅ Security event logging
   - ✅ Error tracking
   - ✅ Audit trail

## 🔍 Testing Security

### Manual Testing
```bash
# Test invalid phone
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "123"}'

# Test rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"phone": "9876543210"}'
done

# Test invalid token
curl -X GET http://localhost:5000/api/users/profile \
  -H "Authorization: Bearer invalid_token"
```

## 📈 Next Steps

1. **Database Level Security**
   - Enable row-level security
   - Encrypt sensitive fields
   - Regular backups

2. **API Gateway**
   - DDoS protection
   - Web Application Firewall (WAF)
   - API throttling

3. **Monitoring**
   - Set up Sentry for error tracking
   - Implement DataDog or similar
   - Create security dashboards

4. **Compliance**
   - GDPR compliance for EU users
   - Data retention policies
   - Privacy policy implementation

## 🆘 Support & Debugging

All requests include a unique `X-Request-ID` header that can be:
1. Logged in the response
2. Used to trace through system logs
3. Provided to support team for investigation

Example error response:
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "phone",
      "message": "Invalid Indian phone number",
      "value": "123"
    }
  ],
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

**Last Updated**: February 18, 2026
**Security Level**: Production-Ready
