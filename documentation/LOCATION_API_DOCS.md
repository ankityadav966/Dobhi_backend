# Location API Documentation

## Overview
The Location API provides real-time GPS tracking and location sharing between users and service partners. It integrates with Google Maps to display live routes and track paths.

## Base URL
```
http://localhost:5000/api/locations
```

## Authentication
All endpoints require JWT authentication. Include the token in the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

---

## Endpoints

### 1. Update User Location
Updates the real-time location of the authenticated user.

**Endpoint:** `POST /update`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "latitude": 28.6139,
  "longitude": 77.2090,
  "accuracy": 10.5
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| latitude | number | Yes | User's latitude (-90 to 90) |
| longitude | number | Yes | User's longitude (-180 to 180) |
| accuracy | number | No | GPS accuracy in meters |

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Location updated successfully",
  "data": {
    "latitude": 28.6139,
    "longitude": 77.2090,
    "accuracy": 10.5,
    "timestamp": "2025-01-31T10:09:53.000Z"
  }
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "message": "Latitude and longitude are required"
}
```

**Example cURL:**
```bash
curl -X POST http://localhost:5000/api/locations/update \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 28.6139,
    "longitude": 77.2090,
    "accuracy": 10.5
  }'
```

---

### 2. Get Real-Time Route
Fetches the real-time route between user and partner locations formatted for Google Maps.

**Endpoint:** `GET /route/:bookingId`

**Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| bookingId | string | Booking ID to get route for |

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "route": {
      "origin": {
        "lat": 28.6139,
        "lng": 77.2090,
        "name": "Customer"
      },
      "destination": {
        "lat": 28.6245,
        "lng": 77.2054,
        "name": "Helper/Partner"
      },
      "userLocation": {
        "lat": 28.6139,
        "lng": 77.2090,
        "name": "Customer Location",
        "address": "123 Main St, Delhi",
        "timestamp": "2025-01-31T10:09:53.000Z"
      },
      "partnerLocation": {
        "lat": 28.6245,
        "lng": 77.2054,
        "name": "Partner Location",
        "address": "456 Park Ave, Delhi",
        "timestamp": "2025-01-31T10:09:52.000Z"
      }
    },
    "googleMapsFormat": {
      "origin": { "lat": 28.6139, "lng": 77.2090 },
      "destination": { "lat": 28.6245, "lng": 77.2054 },
      "waypoints": [
        {
          "location": { "lat": 28.6139, "lng": 77.2090 },
          "stopover": true
        },
        {
          "location": { "lat": 28.6245, "lng": 77.2054 },
          "stopover": true
        }
      ],
      "travelMode": "DRIVING"
    },
    "waypoints": [
      { "lat": 28.6139, "lng": 77.2090, "timestamp": "2025-01-31T10:09:53.000Z" },
      { "lat": 28.6140, "lng": 77.2091, "timestamp": "2025-01-31T10:09:48.000Z" }
    ],
    "bookingStatus": "IN_PROGRESS",
    "distance": 1.45
  }
}
```

**Response (Error - 404):**
```json
{
  "success": false,
  "message": "Location data not available. Please ensure both parties have shared their location."
}
```

**Example cURL:**
```bash
curl -X GET http://localhost:5000/api/locations/route/booking123 \
  -H "Authorization: Bearer your_jwt_token"
```

---

### 3. Get Current Locations
Gets current locations of both user and partner for a specific booking.

**Endpoint:** `GET /current/:bookingId`

**Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| bookingId | string | Booking ID |

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "userLocation": {
      "lat": 28.6139,
      "lng": 77.2090,
      "name": "Customer"
    },
    "partnerLocation": {
      "lat": 28.6245,
      "lng": 77.2054,
      "name": "Helper"
    }
  }
}
```

---

### 4. Get Location History
Retrieves location history for a user within specified hours.

**Endpoint:** `GET /history/:userId`

**Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| userId | string | User ID to get history for |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| hours | number | 1 | Number of hours to look back |

**Response (Success - 200):**
```json
{
  "success": true,
  "data": [
    {
      "lat": 28.6139,
      "lng": 77.2090,
      "timestamp": "2025-01-31T10:09:53.000Z"
    },
    {
      "lat": 28.6140,
      "lng": 77.2091,
      "timestamp": "2025-01-31T10:09:48.000Z"
    }
  ],
  "hours": 1,
  "count": 2
}
```

**Example cURL:**
```bash
curl -X GET "http://localhost:5000/api/locations/history/user123?hours=2" \
  -H "Authorization: Bearer your_jwt_token"
```

---

### 5. Check Partner In Range
Verifies if partner is within acceptable distance from customer.

**Endpoint:** `GET /check-range/:bookingId`

**Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| bookingId | string | Booking ID |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| maxDistance | number | 10 | Maximum acceptable distance in km |

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "isInRange": true,
    "distance": 1.45,
    "maxDistance": 10,
    "unit": "km"
  }
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "message": "Location data not available for one or both parties"
}
```

**Example cURL:**
```bash
curl -X GET "http://localhost:5000/api/locations/check-range/booking123?maxDistance=5" \
  -H "Authorization: Bearer your_jwt_token"
```

---

### 6. Stream Location Updates
Gets current location data (use in polling intervals for real-time updates).

**Endpoint:** `GET /stream/:bookingId`

**Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| bookingId | string | Booking ID |

**Response (Success - 200):**
```json
{
  "success": true,
  "timestamp": "2025-01-31T10:09:53.000Z",
  "data": {
    "userLocation": {
      "lat": 28.6139,
      "lng": 77.2090,
      "name": "Customer"
    },
    "partnerLocation": {
      "lat": 28.6245,
      "lng": 77.2054,
      "name": "Helper"
    }
  }
}
```

---

## Error Codes

| Status | Code | Message | Description |
|--------|------|---------|-------------|
| 200 | SUCCESS | Success | Request successful |
| 400 | BAD_REQUEST | Invalid input | Invalid coordinates or missing fields |
| 401 | UNAUTHORIZED | Unauthorized | Missing or invalid JWT token |
| 403 | FORBIDDEN | Access denied | User doesn't have permission |
| 404 | NOT_FOUND | Not found | Resource not found |
| 500 | SERVER_ERROR | Server error | Internal server error |

---

## Common Integration Patterns

### Real-Time Location Polling
```javascript
// Poll location every 10 seconds
setInterval(async () => {
  const position = await getUserPosition();
  await updateLocationToBackend(position.latitude, position.longitude);
}, 10000);

// Refresh route every 5 seconds
setInterval(async () => {
  const routeData = await fetch(`/api/locations/route/${bookingId}`);
  updateMapDisplay(routeData);
}, 5000);
```

### Initial Setup
1. Get user's current location using Geolocation API
2. Send to backend via `/update` endpoint
3. Fetch route via `/route/{bookingId}` endpoint
4. Initialize Google Maps with the route data
5. Start polling for location updates

### Distance Monitoring
```javascript
// Check if partner is within range
const checkRange = async () => {
  const response = await fetch(`/api/locations/check-range/${bookingId}?maxDistance=10`);
  const data = await response.json();
  
  if (!data.data.isInRange) {
    alert('Partner is out of acceptable range');
  }
};
```

---

## Rate Limiting
- Location updates: Recommended interval 10-30 seconds
- Route queries: Recommended interval 5-10 seconds
- History queries: Use with reasonable time windows (hours parameter)

## Data Privacy
- Users can only access their own location history
- Location is only updated during active bookings
- Historical data is maintained for 30 days (configurable)
- All endpoints require authentication

---

## Database Schema

### LocationHistory Table
```
id: String (Primary Key)
userId: String (Foreign Key → User)
latitude: Float
longitude: Float
accuracy: Float (Optional)
timestamp: DateTime
createdAt: DateTime
updatedAt: DateTime

Indexes:
- userId (for fast user lookups)
- timestamp (for time-based queries)
```
