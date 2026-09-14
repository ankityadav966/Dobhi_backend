# Google Maps Integration Guide for Real-Time Location Tracking

## Overview
This guide explains how to integrate Google Maps API with the partner-backend for real-time location tracking between users and service partners/helpers.

## Setup

### 1. Backend Requirements
- Location service endpoints are available
- Database schema includes LocationHistory model
- All APIs require authentication via JWT token

### 2. Frontend Setup

#### Install Google Maps Library
```bash
npm install @google/maps google-map-react
# or
yarn add @google/maps google-map-react
```

#### Get Google Maps API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Maps JavaScript API and Directions API
4. Create an API key with restrictions
5. Add to your `.env` or `.env.local`:
```
REACT_APP_GOOGLE_MAPS_API_KEY=your_api_key_here
```

## Frontend Implementation

### 1. Location Tracking Component

```tsx
import { useEffect, useState } from 'react';
import { GoogleMap, LoadScript, MarkerF, PolylineF } from '@react-google-maps/api';

interface LocationData {
  lat: number;
  lng: number;
  name: string;
}

interface RouteData {
  userLocation: LocationData;
  partnerLocation: LocationData;
  waypoints: Array<{ lat: number; lng: number; timestamp: Date }>;
  distance: number;
}

export const RealTimeMapComponent = ({ bookingId, token }) => {
  const [route, setRoute] = useState<RouteData | null>(null);
  const [userLocation, setUserLocation] = useState<LocationData | null>(null);
  const [partnerLocation, setPartnerLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);

  // Get user's current GPS location
  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            resolve({ latitude, longitude, accuracy });
          },
          (error) => reject(error)
        );
      } else {
        reject(new Error('Geolocation not supported'));
      }
    });
  };

  // Update location to backend
  const updateLocationToBackend = async (latitude: number, longitude: number, accuracy?: number) => {
    try {
      const response = await fetch('http://localhost:5000/api/locations/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude,
          longitude,
          accuracy,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update location');
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating location:', error);
      throw error;
    }
  };

  // Fetch real-time route from backend
  const fetchRealTimeRoute = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/locations/route/${bookingId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch route');
      }

      const data = await response.json();
      setRoute(data.data.route);
      setUserLocation(data.data.route.userLocation);
      setPartnerLocation(data.data.route.partnerLocation);

      return data.data;
    } catch (error) {
      console.error('Error fetching route:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Start continuous location tracking
  useEffect(() => {
    const startTracking = async () => {
      try {
        // Get and send current location
        const location = await getCurrentLocation();
        await updateLocationToBackend(location.latitude, location.longitude, location.accuracy);

        // Fetch route
        await fetchRealTimeRoute();

        // Set up periodic location updates (every 10 seconds)
        const locationInterval = setInterval(async () => {
          try {
            const location = await getCurrentLocation();
            await updateLocationToBackend(location.latitude, location.longitude, location.accuracy);
          } catch (error) {
            console.error('Error in location tracking interval:', error);
          }
        }, 10000);

        // Set up periodic route refresh (every 5 seconds)
        const routeInterval = setInterval(async () => {
          try {
            await fetchRealTimeRoute();
          } catch (error) {
            console.error('Error refreshing route:', error);
          }
        }, 5000);

        return () => {
          clearInterval(locationInterval);
          clearInterval(routeInterval);
        };
      } catch (error) {
        console.error('Error starting tracking:', error);
      }
    };

    startTracking();
  }, [bookingId, token]);

  if (loading || !userLocation || !partnerLocation) {
    return <div>Loading map...</div>;
  }

  const mapCenter = {
    lat: (userLocation.lat + partnerLocation.lat) / 2,
    lng: (userLocation.lng + partnerLocation.lng) / 2,
  };

  const mapContainerStyle = {
    width: '100%',
    height: '600px',
  };

  return (
    <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY || ''}>
      <GoogleMap mapContainerStyle={mapContainerStyle} center={mapCenter} zoom={15}>
        {/* User Location Marker */}
        <MarkerF
          position={{ lat: userLocation.lat, lng: userLocation.lng }}
          title={userLocation.name}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          }}
        />

        {/* Partner Location Marker */}
        <MarkerF
          position={{ lat: partnerLocation.lat, lng: partnerLocation.lng }}
          title={partnerLocation.name}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#EA4335',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          }}
        />

        {/* Route Polyline */}
        {route && route.waypoints && (
          <PolylineF
            path={route.waypoints.map((wp) => ({ lat: wp.lat, lng: wp.lng }))}
            options={{
              strokeColor: '#34A853',
              strokeOpacity: 0.8,
              strokeWeight: 3,
              geodesic: true,
            }}
          />
        )}
      </GoogleMap>

      {/* Distance Display */}
      {route && (
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f5f5f5' }}>
          <p>
            <strong>Distance:</strong> {route.distance?.toFixed(2)} km
          </p>
          <p>
            <strong>User Location:</strong> {route.userLocation.lat.toFixed(4)}, {route.userLocation.lng.toFixed(4)}
          </p>
          <p>
            <strong>Partner Location:</strong> {route.partnerLocation.lat.toFixed(4)},{' '}
            {route.partnerLocation.lng.toFixed(4)}
          </p>
        </div>
      )}
    </LoadScript>
  );
};
```

### 2. Check Partner In Range Component

```tsx
interface RangeCheckResult {
  isInRange: boolean;
  distance: number;
  maxDistance: number;
}

export const CheckPartnerInRange = ({ bookingId, token, maxDistance = 10 }) => {
  const [rangeData, setRangeData] = useState<RangeCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkRange = async () => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/locations/check-range/${bookingId}?maxDistance=${maxDistance}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to check range');
      }

      const data = await response.json();
      setRangeData(data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  useEffect(() => {
    checkRange();
    const interval = setInterval(checkRange, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [bookingId, token, maxDistance]);

  return (
    <div style={{ padding: '16px', backgroundColor: rangeData?.isInRange ? '#C8E6C9' : '#FFCCCC' }}>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {rangeData && (
        <>
          <p>
            <strong>Status:</strong> {rangeData.isInRange ? '✓ Partner is in range' : '✗ Partner is out of range'}
          </p>
          <p>
            <strong>Distance:</strong> {rangeData.distance} km / {rangeData.maxDistance} km
          </p>
        </>
      )}
    </div>
  );
};
```

### 3. Location History Tracking

```tsx
export const LocationHistoryComponent = ({ userId, token }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLocationHistory = async (hours = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/locations/history/${userId}?hours=${hours}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }

      const data = await response.json();
      setHistory(data.data);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocationHistory();
  }, [userId, token]);

  return (
    <div style={{ padding: '16px' }}>
      <h3>Location History (Last 1 Hour)</h3>
      {loading && <p>Loading...</p>}
      {history.length === 0 && !loading && <p>No location history available</p>}
      <ul>
        {history.map((location, index) => (
          <li key={index}>
            {location.lat.toFixed(4)}, {location.lng.toFixed(4)} - {new Date(location.timestamp).toLocaleTimeString()}
          </li>
        ))}
      </ul>
    </div>
  );
};
```

## API Endpoints

### 1. Update Location
**POST** `/api/locations/update`
```json
{
  "latitude": 28.6139,
  "longitude": 77.2090,
  "accuracy": 10.5
}
```

### 2. Get Real-Time Route
**GET** `/api/locations/route/{bookingId}`
```json
{
  "success": true,
  "data": {
    "route": {
      "origin": { "lat": 28.6139, "lng": 77.2090 },
      "destination": { "lat": 28.6245, "lng": 77.2054 },
      "userLocation": { "lat": 28.6139, "lng": 77.2090, "name": "User", "timestamp": "2025-01-31T..." },
      "partnerLocation": { "lat": 28.6245, "lng": 77.2054, "name": "Partner", "timestamp": "2025-01-31T..." },
      "distance": 1.5
    },
    "waypoints": [...],
    "distance": 1.5
  }
}
```

### 3. Get Current Locations
**GET** `/api/locations/current/{bookingId}`

### 4. Check Partner In Range
**GET** `/api/locations/check-range/{bookingId}?maxDistance=10`

### 5. Get Location History
**GET** `/api/locations/history/{userId}?hours=1`

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://...
JWT_SECRET=your_secret_key
```

### Frontend (.env.local or .env)
```
REACT_APP_API_BASE_URL=http://localhost:5000/api
REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

## Best Practices

1. **Permission Handling**: Always request user permission for location access
2. **Accuracy Levels**: Use GPS accuracy to validate location quality
3. **Rate Limiting**: Update location every 10-30 seconds to balance accuracy and performance
4. **Error Handling**: Handle location unavailable gracefully
5. **Privacy**: Only share location during active bookings
6. **Battery Optimization**: Implement location updates with reasonable intervals
7. **Data Cleanup**: Periodically clean up old location history records

## Troubleshooting

### Location not updating:
- Check if user has granted location permissions
- Verify GPS is enabled on device
- Check network connectivity
- Verify JWT token is valid

### Map not loading:
- Verify Google Maps API key is valid
- Check API key restrictions
- Ensure Maps JavaScript API is enabled in Google Cloud
- Check for CORS issues

### Distance calculations off:
- Verify coordinates are in correct format (lat, lng)
- Check if using same coordinate system
- Ensure GPS accuracy is reasonable

## Performance Considerations

- Location updates: 10-30 second intervals recommended
- Route refresh: 5-10 second intervals
- Store location history in indexed database fields
- Clean up old history records periodically
- Use WebSocket for real-time updates (optional enhancement)

## Security

- All endpoints require authentication
- Validate coordinates before storing
- Implement rate limiting on location updates
- Only allow users to view their own location history
- Use HTTPS in production
