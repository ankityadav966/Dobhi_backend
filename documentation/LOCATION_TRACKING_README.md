# Location Tracking & Google Maps Integration

## 📍 Overview

This module provides real-time GPS-based location tracking for users and service partners with full Google Maps integration. It enables:

- **Real-time location updates** from frontend GPS
- **Live route visualization** on Google Maps
- **Distance calculations** between users and partners
- **Location history tracking** for audit and analytics
- **Range validation** for service partners
- **Path visualization** showing historical movement

## 🎯 Features

### 1. **Real-Time Location Updates**
- Frontend sends GPS coordinates every 10-30 seconds
- Backend stores in PostgreSQL with timestamp
- Validates coordinate accuracy
- Supports accuracy metadata from GPS

### 2. **Route Visualization**
- Direct routes between user and partner
- Polyline path showing movement history
- Google Maps SDK compatible format
- Distance calculations using Haversine formula

### 3. **Location History**
- Maintains location history per user
- Configurable time windows (hours)
- Indexed database queries for performance
- Used for path visualization and analytics

### 4. **Range Checking**
- Validates if partner is within acceptable distance
- Default 10km radius (configurable)
- Real-time distance calculation
- Alert triggers for out-of-range scenarios

### 5. **Data Privacy**
- Users can only access their own location history
- Location updates only during active bookings
- All endpoints require JWT authentication
- Configurable data retention period

## 📁 File Structure

```
src/
├── services/location.service.ts          # Business logic
├── controllers/location.controller.ts    # HTTP handlers
├── routes/location.routes.ts             # API endpoints
├── prisma/
│   ├── schema.prisma                     # Database schema
│   └── migrations/
│       └── 20260131100953.../migration.sql
└── middlewares/auth.middleware.ts        # Authentication

Documentation/
├── GOOGLE_MAPS_INTEGRATION.md            # Frontend guide
├── LOCATION_API_DOCS.md                  # API reference
├── LOCATION_TRACKING_DEMO.html           # Testing UI
└── README.md                             # This file
```

## 🚀 Quick Start

### Backend Setup

1. **Update Prisma Schema** (Already done ✓)
   - Added LocationHistory model
   - Added relations to User

2. **Run Migration**
   ```bash
   npm run prisma:migrate
   ```

3. **Start Server**
   ```bash
   npm run dev
   ```

4. **Verify Endpoints**
   ```bash
   curl http://localhost:5000/api/locations/update \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -X POST \
     -d '{"latitude":28.6139,"longitude":77.2090}'
   ```

### Frontend Setup

1. **Install Google Maps Library**
   ```bash
   npm install @react-google-maps/api
   # or
   npm install google-map-react
   ```

2. **Get Google Maps API Key**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Enable Maps JavaScript API
   - Create API key with restrictions

3. **Add to Environment**
   ```
   REACT_APP_GOOGLE_MAPS_API_KEY=your_key_here
   ```

4. **Implement Location Component**
   - See example in GOOGLE_MAPS_INTEGRATION.md
   - Or use LOCATION_TRACKING_DEMO.html for testing

## 🔌 API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/locations/update` | Update user location |
| GET | `/locations/route/:bookingId` | Get route data for Google Maps |
| GET | `/locations/current/:bookingId` | Get current locations |
| GET | `/locations/history/:userId` | Get location history |
| GET | `/locations/check-range/:bookingId` | Check if partner in range |
| GET | `/locations/stream/:bookingId` | Stream location updates |

### Example: Update Location
```bash
curl -X POST http://localhost:5000/api/locations/update \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 28.6139,
    "longitude": 77.2090,
    "accuracy": 10.5
  }'
```

**Response:**
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

### Example: Get Real-Time Route
```bash
curl -X GET http://localhost:5000/api/locations/route/booking123 \
  -H "Authorization: Bearer eyJhbGc..."
```

**Response:**
```json
{
  "success": true,
  "data": {
    "route": {
      "origin": { "lat": 28.6139, "lng": 77.2090, "name": "Customer" },
      "destination": { "lat": 28.6245, "lng": 77.2054, "name": "Helper" },
      "userLocation": {
        "lat": 28.6139,
        "lng": 77.2090,
        "name": "Customer Location",
        "address": "123 Main St, Delhi",
        "timestamp": "2025-01-31T10:09:53Z"
      },
      "partnerLocation": {
        "lat": 28.6245,
        "lng": 77.2054,
        "name": "Partner Location",
        "address": "456 Park Ave, Delhi",
        "timestamp": "2025-01-31T10:09:52Z"
      }
    },
    "googleMapsFormat": {
      "origin": { "lat": 28.6139, "lng": 77.2090 },
      "destination": { "lat": 28.6245, "lng": 77.2054 },
      "waypoints": [...],
      "travelMode": "DRIVING"
    },
    "waypoints": [...],
    "bookingStatus": "IN_PROGRESS",
    "distance": 1.45
  }
}
```

## 💻 Frontend Implementation Example

### Basic React Component

```typescript
import { useEffect, useState } from 'react';
import { GoogleMap, LoadScript, MarkerF, PolylineF } from '@react-google-maps/api';

export const LocationTracking = ({ bookingId, token }) => {
  const [route, setRoute] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  // Get current GPS location
  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        reject
      );
    });
  };

  // Send location to backend
  const updateBackendLocation = async () => {
    const location = await getCurrentLocation();
    const response = await fetch('http://localhost:5000/api/locations/update', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      }),
    });
    return response.json();
  };

  // Get route from backend
  const fetchRoute = async () => {
    const response = await fetch(`http://localhost:5000/api/locations/route/${bookingId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  };

  // Setup tracking
  useEffect(() => {
    // Update location every 10 seconds
    const locationInterval = setInterval(updateBackendLocation, 10000);
    
    // Fetch route every 5 seconds
    const routeInterval = setInterval(() => {
      fetchRoute().then(data => setRoute(data.data.route));
    }, 5000);

    return () => {
      clearInterval(locationInterval);
      clearInterval(routeInterval);
    };
  }, [bookingId, token]);

  if (!route) return <div>Loading...</div>;

  return (
    <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '600px' }}
        center={{ lat: route.userLocation.lat, lng: route.userLocation.lng }}
        zoom={15}
      >
        {/* User marker */}
        <MarkerF
          position={{ lat: route.userLocation.lat, lng: route.userLocation.lng }}
          title="Your Location"
        />
        
        {/* Partner marker */}
        <MarkerF
          position={{ lat: route.partnerLocation.lat, lng: route.partnerLocation.lng }}
          title="Partner Location"
        />
        
        {/* Path polyline */}
        {route.waypoints && (
          <PolylineF
            path={route.waypoints.map(wp => ({ lat: wp.lat, lng: wp.lng }))}
            options={{
              strokeColor: '#34A853',
              strokeOpacity: 0.8,
              strokeWeight: 3,
            }}
          />
        )}
      </GoogleMap>
    </LoadScript>
  );
};
```

## 🗄️ Database Schema

### LocationHistory Table

```sql
CREATE TABLE "LocationHistory" (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL,
  
  FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE CASCADE,
  INDEX (userId),
  INDEX (timestamp)
);
```

## 📊 Testing

### Using the Demo HTML File

Open `LOCATION_TRACKING_DEMO.html` in your browser:

1. Replace `YOUR_GOOGLE_MAPS_API_KEY` with your actual key
2. Enter JWT token and Booking ID
3. Click "Start Tracking"
4. Monitor real-time updates on the map

### Using cURL

```bash
# Update location
curl -X POST http://localhost:5000/api/locations/update \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitude":28.6139,"longitude":77.209,"accuracy":10}'

# Get route
curl http://localhost:5000/api/locations/route/BOOKING_ID \
  -H "Authorization: Bearer TOKEN"

# Check range
curl "http://localhost:5000/api/locations/check-range/BOOKING_ID?maxDistance=10" \
  -H "Authorization: Bearer TOKEN"
```

## 🔒 Security

- ✓ JWT authentication on all endpoints
- ✓ User can only access own location history
- ✓ Coordinate validation (valid lat/lng ranges)
- ✓ HTTPS recommended for production
- ✓ Rate limiting on location updates
- ✓ Timestamp validation

## 🎨 Frontend Integration Checklist

- [ ] Install Google Maps library
- [ ] Get and configure API key
- [ ] Implement geolocation permission handling
- [ ] Create location update service
- [ ] Create route fetch service
- [ ] Build map component with markers
- [ ] Add polyline for path visualization
- [ ] Implement polling for real-time updates
- [ ] Add error handling
- [ ] Test with actual GPS device
- [ ] Optimize update intervals for battery life
- [ ] Add privacy controls

## ⚙️ Configuration

### Update Intervals (Recommended)

- **Location Update**: 10-30 seconds
- **Route Refresh**: 5-10 seconds  
- **History Query**: As needed (hourly or on-demand)

### Distance Calculations

- Default max distance: 10 km
- Unit: Kilometers
- Formula: Haversine (accurate for Earth surface)

### Data Retention

- Location history: 30 days (configurable via cron job)
- User current location: Always up-to-date
- Old records: Can be archived/deleted

## 🐛 Troubleshooting

### Location Not Updating

**Problem**: Frontend location isn't sending
- Check if `navigator.geolocation` is available
- Verify HTTPS is used (required for geolocation)
- Check browser permissions
- Verify GPS is enabled on device

### Map Not Loading

**Problem**: Google Maps component shows blank
- Verify API key is valid and not restricted
- Check if Maps JavaScript API is enabled
- Look for CORS errors in console
- Verify API key has proper restrictions (should allow your domain)

### Distance Incorrect

**Problem**: Distance calculation seems wrong
- Verify coordinates are in correct format: latitude, longitude
- Check GPS accuracy (may have 10-20m error)
- Ensure same coordinate system (WGS 84)

### API Returning 404

**Problem**: Endpoints not found
- Verify location routes are imported in app.ts
- Check booking exists in database
- Verify bookingId is correct

## 📈 Performance Tips

1. **Reduce Update Frequency**: Start with 30s, optimize down
2. **Use Indexed Fields**: userId and timestamp are indexed
3. **Implement Cleanup**: Remove old history monthly
4. **Batch Updates**: Cache updates before sending
5. **Optimize Queries**: Use time ranges in history queries
6. **Monitor Database**: Track LocationHistory table size

## 🔄 Future Enhancements

- [ ] WebSocket for true real-time (not polling)
- [ ] Route optimization using Google Directions API
- [ ] ETA calculation for partner arrival
- [ ] Geofencing alerts
- [ ] Heat maps showing popular service areas
- [ ] Integration with notification system
- [ ] Location-based analytics dashboard
- [ ] Support for multiple service areas

## 📚 Related Documentation

- [GOOGLE_MAPS_INTEGRATION.md](./GOOGLE_MAPS_INTEGRATION.md) - Frontend integration guide
- [LOCATION_API_DOCS.md](./LOCATION_API_DOCS.md) - Complete API reference
- [LOCATION_TRACKING_DEMO.html](./LOCATION_TRACKING_DEMO.html) - Interactive demo

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review LOCATION_API_DOCS.md for detailed API info
3. Check browser console for frontend errors
4. Check server logs for backend errors
5. Verify all environment variables are set
