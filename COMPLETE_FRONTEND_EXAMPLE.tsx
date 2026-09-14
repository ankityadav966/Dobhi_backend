// ============================================
// COMPLETE LOCATION TRACKING IMPLEMENTATION
// ============================================
// This file shows complete frontend integration
// Copy and adapt to your React project

import React, { useEffect, useState, useRef } from 'react';
import {
  GoogleMap,
  LoadScript,
  MarkerF,
  PolylineF,
  InfoWindowF,
} from '@react-google-maps/api';

// Types
interface Location {
  lat: number;
  lng: number;
  name: string;
  address?: string;
  timestamp?: Date;
}

interface RouteData {
  origin: { lat: number; lng: number; name?: string };
  destination: { lat: number; lng: number; name?: string };
  userLocation: Location;
  partnerLocation: Location;
  distance?: number;
}

interface TrackingState {
  isTracking: boolean;
  userLocation: Location | null;
  partnerLocation: Location | null;
  distance: number | null;
  error: string | null;
  routeWaypoints: Array<{ lat: number; lng: number; timestamp: Date }>;
}

// ============================================
// LOCATION TRACKER HOOK
// ============================================
const useLocationTracking = (bookingId: string, token: string) => {
  const [state, setState] = useState<TrackingState>({
    isTracking: false,
    userLocation: null,
    partnerLocation: null,
    distance: null,
    error: null,
    routeWaypoints: [],
  });

  const trackingRef = useRef({
    locationInterval: null as NodeJS.Timeout | null,
    routeInterval: null as NodeJS.Timeout | null,
  });

  // Get current GPS location
  const getCurrentLocation = async (): Promise<{
    latitude: number;
    longitude: number;
    accuracy: number;
  }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => {
          reject(new Error(`Geolocation error: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  };

  // Update location on backend
  const updateLocationToBackend = async (
    latitude: number,
    longitude: number,
    accuracy: number
  ): Promise<boolean> => {
    try {
      const response = await fetch(
        'http://localhost:5000/api/locations/update',
        {
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
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update location');
      }

      return true;
    } catch (error) {
      console.error('Error updating location:', error);
      throw error;
    }
  };

  // Fetch route from backend
  const fetchRoute = async (): Promise<RouteData | null> => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/locations/route/${bookingId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch route');
      }

      const data = await response.json();
      return data.data.route;
    } catch (error) {
      console.error('Error fetching route:', error);
      throw error;
    }
  };

  // Start location tracking
  const startTracking = async (updateIntervalSeconds: number = 10) => {
    try {
      setState((prev) => ({ ...prev, error: null }));

      // Get and send initial location
      const location = await getCurrentLocation();
      await updateLocationToBackend(
        location.latitude,
        location.longitude,
        location.accuracy
      );

      // Fetch initial route
      const route = await fetchRoute();
      if (route) {
        setState((prev) => ({
          ...prev,
          userLocation: route.userLocation,
          partnerLocation: route.partnerLocation,
          distance: route.distance || null,
        }));
      }

      setState((prev) => ({ ...prev, isTracking: true }));

      // Periodic location updates
      trackingRef.current.locationInterval = setInterval(async () => {
        try {
          const location = await getCurrentLocation();
          await updateLocationToBackend(
            location.latitude,
            location.longitude,
            location.accuracy
          );
        } catch (error) {
          console.error('Error in location update interval:', error);
        }
      }, updateIntervalSeconds * 1000);

      // Periodic route updates
      trackingRef.current.routeInterval = setInterval(async () => {
        try {
          const route = await fetchRoute();
          if (route) {
            setState((prev) => ({
              ...prev,
              userLocation: route.userLocation,
              partnerLocation: route.partnerLocation,
              distance: route.distance || null,
              routeWaypoints: route.waypoints as Array<{
                lat: number;
                lng: number;
                timestamp: Date;
              }>,
            }));
          }
        } catch (error) {
          console.error('Error in route update interval:', error);
        }
      }, 5000);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isTracking: false,
      }));
    }
  };

  // Stop tracking
  const stopTracking = () => {
    if (trackingRef.current.locationInterval) {
      clearInterval(trackingRef.current.locationInterval);
    }
    if (trackingRef.current.routeInterval) {
      clearInterval(trackingRef.current.routeInterval);
    }
    setState((prev) => ({ ...prev, isTracking: false }));
  };

  return {
    ...state,
    startTracking,
    stopTracking,
  };
};

// ============================================
// MAP COMPONENT
// ============================================
interface LocationMapProps {
  userLocation: Location | null;
  partnerLocation: Location | null;
  routeWaypoints: Array<{ lat: number; lng: number; timestamp: Date }>;
  distance: number | null;
}

const LocationMap: React.FC<LocationMapProps> = ({
  userLocation,
  partnerLocation,
  routeWaypoints,
  distance,
}) => {
  const mapCenter = {
    lat:
      userLocation && partnerLocation
        ? (userLocation.lat + partnerLocation.lat) / 2
        : 28.6139,
    lng:
      userLocation && partnerLocation
        ? (userLocation.lng + partnerLocation.lng) / 2
        : 77.209,
  };

  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);

  const mapContainerStyle = {
    width: '100%',
    height: '500px',
    borderRadius: '8px',
    overflow: 'hidden',
  };

  const mapOptions = {
    zoom: 15,
    mapTypeId: 'roadmap' as const,
  };

  if (!userLocation || !partnerLocation) {
    return (
      <div
        style={{
          ...mapContainerStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
        }}
      >
        <p>Loading map...</p>
      </div>
    );
  }

  return (
    <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY || ''}>
      <GoogleMap mapContainerStyle={mapContainerStyle} center={mapCenter} options={mapOptions}>
        {/* User Location Marker */}
        <MarkerF
          position={{ lat: userLocation.lat, lng: userLocation.lng }}
          title={userLocation.name}
          onClick={() => setSelectedMarker('user')}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          }}
        >
          {selectedMarker === 'user' && (
            <InfoWindowF onCloseClick={() => setSelectedMarker(null)}>
              <div style={{ color: '#333', fontSize: '12px' }}>
                <strong>{userLocation.name}</strong>
                <p>{userLocation.address || 'User Location'}</p>
                <p>
                  {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
                </p>
                {userLocation.timestamp && (
                  <p>{new Date(userLocation.timestamp).toLocaleTimeString()}</p>
                )}
              </div>
            </InfoWindowF>
          )}
        </MarkerF>

        {/* Partner Location Marker */}
        <MarkerF
          position={{ lat: partnerLocation.lat, lng: partnerLocation.lng }}
          title={partnerLocation.name}
          onClick={() => setSelectedMarker('partner')}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#EA4335',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          }}
        >
          {selectedMarker === 'partner' && (
            <InfoWindowF onCloseClick={() => setSelectedMarker(null)}>
              <div style={{ color: '#333', fontSize: '12px' }}>
                <strong>{partnerLocation.name}</strong>
                <p>{partnerLocation.address || 'Partner Location'}</p>
                <p>
                  {partnerLocation.lat.toFixed(6)}, {partnerLocation.lng.toFixed(6)}
                </p>
                {partnerLocation.timestamp && (
                  <p>{new Date(partnerLocation.timestamp).toLocaleTimeString()}</p>
                )}
              </div>
            </InfoWindowF>
          )}
        </MarkerF>

        {/* Route Polyline */}
        {routeWaypoints.length > 0 && (
          <PolylineF
            path={routeWaypoints.map((wp) => ({ lat: wp.lat, lng: wp.lng }))}
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
      {distance && (
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            backgroundColor: '#fff3cd',
            borderRadius: '4px',
            textAlign: 'center',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#856404',
          }}
        >
          Distance: {distance.toFixed(2)} km
        </div>
      )}
    </LoadScript>
  );
};

// ============================================
// STATUS PANEL COMPONENT
// ============================================
interface StatusPanelProps {
  isTracking: boolean;
  userLocation: Location | null;
  partnerLocation: Location | null;
  distance: number | null;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
}

const StatusPanel: React.FC<StatusPanelProps> = ({
  isTracking,
  userLocation,
  partnerLocation,
  distance,
  error,
  onStart,
  onStop,
}) => {
  return (
    <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', marginTop: '16px' }}>
      {/* Status Indicator */}
      <div
        style={{
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '16px',
          backgroundColor: isTracking ? '#d5f4e6' : '#ecf0f1',
          color: isTracking ? '#27ae60' : '#95a5a6',
          fontWeight: 'bold',
        }}
      >
        {isTracking ? '🟢 Tracking Active' : '⚪ Not Tracking'}
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '16px',
            backgroundColor: '#fadbd8',
            color: '#e74c3c',
            fontSize: '14px',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Location Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* User Location */}
        <div style={{ padding: '12px', backgroundColor: '#f0f8ff', borderRadius: '4px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#4285F4' }}>📍 Your Location</h4>
          {userLocation ? (
            <>
              <p style={{ margin: '4px 0', fontSize: '12px' }}>
                <strong>Lat:</strong> {userLocation.lat.toFixed(6)}
              </p>
              <p style={{ margin: '4px 0', fontSize: '12px' }}>
                <strong>Lng:</strong> {userLocation.lng.toFixed(6)}
              </p>
              {userLocation.timestamp && (
                <p style={{ margin: '4px 0', fontSize: '12px' }}>
                  <strong>Time:</strong> {new Date(userLocation.timestamp).toLocaleTimeString()}
                </p>
              )}
            </>
          ) : (
            <p style={{ fontSize: '12px', color: '#95a5a6' }}>Not available</p>
          )}
        </div>

        {/* Partner Location */}
        <div style={{ padding: '12px', backgroundColor: '#fff0f5', borderRadius: '4px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#EA4335' }}>🔧 Partner Location</h4>
          {partnerLocation ? (
            <>
              <p style={{ margin: '4px 0', fontSize: '12px' }}>
                <strong>Lat:</strong> {partnerLocation.lat.toFixed(6)}
              </p>
              <p style={{ margin: '4px 0', fontSize: '12px' }}>
                <strong>Lng:</strong> {partnerLocation.lng.toFixed(6)}
              </p>
              {partnerLocation.timestamp && (
                <p style={{ margin: '4px 0', fontSize: '12px' }}>
                  <strong>Time:</strong> {new Date(partnerLocation.timestamp).toLocaleTimeString()}
                </p>
              )}
            </>
          ) : (
            <p style={{ fontSize: '12px', color: '#95a5a6' }}>Not available</p>
          )}
        </div>
      </div>

      {/* Distance Display */}
      {distance && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#fff9e6',
            borderRadius: '4px',
            marginBottom: '16px',
            textAlign: 'center',
            fontSize: '14px',
          }}
        >
          <strong>Distance: {distance.toFixed(2)} km</strong>
        </div>
      )}

      {/* Control Buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onStart}
          disabled={isTracking}
          style={{
            flex: 1,
            padding: '10px',
            backgroundColor: isTracking ? '#95a5a6' : '#27ae60',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isTracking ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
          }}
        >
          ▶ Start Tracking
        </button>
        <button
          onClick={onStop}
          disabled={!isTracking}
          style={{
            flex: 1,
            padding: '10px',
            backgroundColor: !isTracking ? '#95a5a6' : '#e74c3c',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: !isTracking ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
          }}
        >
          ⏹ Stop Tracking
        </button>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
interface RealTimeLocationTrackerProps {
  bookingId: string;
  jwtToken: string;
}

export const RealTimeLocationTracker: React.FC<RealTimeLocationTrackerProps> = ({
  bookingId,
  jwtToken,
}) => {
  const tracking = useLocationTracking(bookingId, jwtToken);

  return (
    <div style={{ padding: '20px' }}>
      <h2>Real-Time Location Tracking</h2>

      <LocationMap
        userLocation={tracking.userLocation}
        partnerLocation={tracking.partnerLocation}
        routeWaypoints={tracking.routeWaypoints}
        distance={tracking.distance}
      />

      <StatusPanel
        isTracking={tracking.isTracking}
        userLocation={tracking.userLocation}
        partnerLocation={tracking.partnerLocation}
        distance={tracking.distance}
        error={tracking.error}
        onStart={() => tracking.startTracking(10)}
        onStop={() => tracking.stopTracking()}
      />
    </div>
  );
};

// ============================================
// USAGE EXAMPLE
// ============================================
/*
In your main app or page:

import { RealTimeLocationTracker } from './RealTimeLocationTracker';

export function BookingPage() {
  return (
    <RealTimeLocationTracker 
      bookingId="booking123" 
      jwtToken={localStorage.getItem('token') || ''}
    />
  );
}
*/
