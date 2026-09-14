# PAN Verification API Documentation

## Overview
PAN (Permanent Account Number) verification using IDFY API. The system stores verification status and details in the database.

## Database Schema Updates
Added the following fields to the `User` model in Prisma schema:
- `panCardNumber` (String?): Stores the user's PAN number
- `isPanVerified` (Boolean): Tracks if PAN is verified (default: false)
- `panVerificationData` (Json?): Stores detailed verification response from IDFY

## API Endpoints

### 1. Initiate PAN Verification
**POST** `/api/pan/initiate`

Initiates PAN verification with IDFY service.

**Request Body:**
```json
{
  "panNumber": "AAAAA5555P",
  "fullName": "ABC XYZ",
  "dateOfBirth": "1900-01-01"
}
```

**Response:**
```json
{
  "message": "PAN verification initiated",
  "taskId": "pan_userId_timestamp",
  "requestId": "uuid",
  "status": "pending"
}
```

**Status Codes:**
- 200: Success
- 400: Validation error or PAN already verified
- 401: Unauthorized
- 500: Server error

---

### 2. Verify PAN Status
**POST** `/api/pan/verify`

Checks and updates the PAN verification status from IDFY.

**Request Body:**
```json
{
  "requestId": "78dcef4d-e3da-40e1-bf27-984260ed3b11"
}
```

**Response:**
```json
{
  "message": "PAN verification checked",
  "isPanVerified": true,
  "status": "verified"
}
```

**Status Codes:**
- 200: Success
- 400: Missing requestId
- 401: Unauthorized
- 500: Server error

---

### 3. Get PAN Status
**GET** `/api/pan/status`

Retrieves current PAN verification status for the authenticated user.

**Response:**
```json
{
  "isPanVerified": true,
  "panCardNumber": "AAAAA5555P",
  "verificationData": {
    "source_output": {
      "aadhaar_seeding_status": true,
      "pan_status": "Existing and Valid. PAN is Operative.",
      "name_match": true,
      "dob_match": true
    },
    "input_details": {
      "input_pan_number": "AAAAA5555P",
      "input_name": "ABC XYZ",
      "input_dob": "1900-01-01"
    },
    "verified": true,
    "verifiedAt": "2026-01-22T11:42:53.000Z"
  }
}
```

**Status Codes:**
- 200: Success
- 401: Unauthorized
- 500: Server error

---

## Environment Variables Required
Add these to your `.env` file:
```
IDFY_API_KEY=your_idfy_api_key
IDFY_ACCOUNT_ID=your_idfy_account_id
IDFY_BASE_URL=https://eve.idfy.com/v3
```

## Verification Flow

1. **Initiate Verification**: User submits PAN details
   - System calls IDFY API to initiate verification
   - Stores `taskId` and `requestId` for later polling
   - Returns pending status

2. **Check Status**: User can check verification status
   - System queries IDFY API using `requestId`
   - When completed, stores result in `panVerificationData`
   - Sets `isPanVerified = true` if all validations pass

3. **Success Criteria**:
   - `pan_status` must contain "Valid"
   - `name_match` must be true
   - `dob_match` must be true

## Validation Rules

- **PAN Format**: Must match `^[A-Z]{5}[0-9]{4}[A-Z]{1}$`
  - Example: AAAAA5555P
  
- **Date Format**: Must be `YYYY-MM-DD`
  - Example: 1900-01-01

- **Full Name**: Required, non-empty string

## Error Handling

- Invalid PAN format → 400 Bad Request
- Missing credentials (IDFY not configured) → 500 Server Error
- IDFY API error → 500 Server Error with error details logged
- Verification still pending → 200 OK with `isPanVerified: false`

## Security Notes

- IDFY credentials should be stored securely in environment variables
- PAN verification data is encrypted at rest (database security)
- All API calls require authentication (user must be logged in)
- Verification can only be updated through official IDFY API

## Testing

```bash
# Initiate verification
curl -X POST http://localhost:5000/api/pan/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "panNumber": "AAAAA5555P",
    "fullName": "ABC XYZ",
    "dateOfBirth": "1900-01-01"
  }'

# Check verification status (using requestId from response above)
curl -X POST http://localhost:5000/api/pan/verify \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "78dcef4d-e3da-40e1-bf27-984260ed3b11"
  }'

# Get current status
curl -X GET http://localhost:5000/api/pan/status \
  -H "Authorization: Bearer your_token"
```
