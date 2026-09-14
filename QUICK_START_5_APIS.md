# 🚀 Quick Start: 5 Partner APIs

## 1. GET `/api/auth/me` - My Basic Info

Get logged-in partner's basic information.

### Request
```bash
GET /api/auth/me
Authorization: Bearer <access_token>
```

### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": 5,
    "fullName": "Rajesh Kumar",
    "phone": "9876543210",
    "avatar": "https://...",
    "role": "HELPER"
  }
}
```

### Error Responses
- **401**: Unauthorized (missing/invalid token)
- **404**: User not found
- **500**: Server error

---

## 2. GET `/api/partner/profile` - Full Profile

Get complete partner profile with professional details.

### Request
```bash
GET /api/partner/profile
Authorization: Bearer <access_token>
```

### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "fullName": "Rajesh Kumar",
    "phone": "9876543210",
    "gender": "Male",
    "experience": 5,
    "bio": null
  }
}
```

### Error Responses
- **401**: Unauthorized
- **404**: User/Helper not found
- **500**: Server error

---

## 3. PUT `/api/partner/profile` - Update Profile

Update partner's profile with validation.

### Request
```bash
PUT /api/partner/profile
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "fullName": "Rajesh Kumar Singh",
  "gender": "Male",
  "experience": 7
}
```

**Note:** All fields optional—send only what needs updating.

### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "fullName": "Rajesh Kumar Singh",
    "phone": "9876543210",
    "gender": "Male",
    "experience": 7,
    "bio": null
  }
}
```

### Error Responses
- **400**: Validation failed (invalid field values)
- **401**: Unauthorized
- **404**: User/Helper not found
- **422**: Validation error with details
- **500**: Server error

### Validation Rules
| Field | Type | Min | Max | Required? |
|-------|------|-----|-----|-----------|
| fullName | String | 1 | 255 | No |
| gender | String | - | - | No |
| experience | Int | 0 | - | No |

---

## 4. GET `/api/partner/bookings/history` - Past Jobs

Get completed and cancelled jobs with formatted timestamps (IST).

### Request
```bash
GET /api/partner/bookings/history
Authorization: Bearer <access_token>
```

### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "bookingId": 123,
      "customerName": "Ananya Sharma",
      "serviceName": "House Cleaning",
      "dateLabel": "Jan 15",
      "timeLabel": "10:00 AM - 11:30 AM",
      "amount": 2500,
      "status": "COMPLETED"
    },
    {
      "bookingId": 122,
      "customerName": "Priya Patel",
      "serviceName": "Laundry",
      "dateLabel": "Jan 14",
      "timeLabel": "09:00 AM - 10:00 AM",
      "amount": 1200,
      "status": "CANCELLED"
    }
  ]
}
```

### Features
- ✅ Only shows COMPLETED and CANCELLED jobs
- ✅ Sorted by latest first
- ✅ Times in IST (Asia/Kolkata)
- ✅ Includes customer name and service type
- ✅ Shows final amount paid

### Error Responses
- **401**: Unauthorized
- **404**: Helper not found
- **500**: Server error

---

## 5. POST `/api/support/ticket` - Create Ticket

Create a support ticket for issues or help requests.

### Request
```bash
POST /api/support/ticket
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "message": "The app crashed when I tried to accept a booking",
  "bookingId": 123
}
```

**Note:** `bookingId` is optional—use if ticket relates to a specific job.

### Response (201 Created)
```json
{
  "success": true,
  "data": {
    "id": 45,
    "message": "The app crashed when I tried to accept a booking",
    "bookingId": 123,
    "status": "OPEN"
  }
}
```

### Error Responses
- **400**: Validation failed (missing message or invalid bookingId)
- **401**: Unauthorized
- **404**: Helper not found
- **422**: Validation error with details
- **500**: Server error

### Validation Rules
| Field | Type | Min | Required? |
|-------|------|-----|-----------|
| message | String | 1 char | Yes |
| bookingId | Int | 1 | No |

### Example Use Cases
- **App bugs**: "Payment gateway shows error 500"
- **Account issues**: "Can't update my bank details"
- **Booking problem**: "Customer cancelled after I reached location"
- **Feature request**: "Can we add recurring bookings?"

---

## Common Headers

All requests require:
```
Authorization: Bearer <your_access_token>
Content-Type: application/json (for POST/PUT)
```

---

## Error Response Format

All errors follow this structure:
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "param": "fullName",
      "msg": "Field is required"
    }
  ]
}
```

---

## Testing with cURL

### 1. Get Basic Info
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 2. Update Profile
```bash
curl -X PUT http://localhost:3000/api/partner/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{"fullName":"New Name","experience":10}'
```

### 3. Get Job History
```bash
curl -X GET http://localhost:3000/api/partner/bookings/history \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 4. Create Support Ticket
```bash
curl -X POST http://localhost:3000/api/support/ticket \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{"message":"App is crashing","bookingId":123}'
```

---

## Environment Setup

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start development server
npm run dev

# Environment variables required (.env)
DATABASE_URL=postgresql://...
JWT_SECRET=your_secret_key
NODE_ENV=development
```

---

## Related APIs

- **POST** `/api/auth/signup` - Create account
- **POST** `/api/auth/login` - Login
- **POST** `/api/auth/helper/verify-otp` - Verify OTP
- **POST** `/api/auth/refresh-token` - Refresh access token
- **POST** `/api/auth/logout` - Logout

---

## Support

For issues or questions:
- Check server logs: `npm run dev`
- Verify token is not expired
- Ensure Authorization header format is correct
- Use POST `/api/support/ticket` to report bugs

---

**Last Updated:** Installation Complete ✅
