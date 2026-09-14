# Quick Reference Guide - Location Tracking Integration

## 🚀 5-Minute Setup

### Backend Setup
```bash
# 1. Apply database migration
npm run prisma:generate
npm run prisma:migrate

# 2. Start server
npm run dev

# 3. Test endpoint
curl -X POST http://localhost:5000/api/locations/update \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitude":28.6139,"longitude":77.2090}'
```

### Frontend Setup
```bash
# 1. Install Google Maps library
npm install @react-google-maps/api

# 2. Add to .env.local
REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# 3. Use the component
import { RealTimeLocationTracker } from './COMPLETE_FRONTEND_EXAMPLE';
```

## 📍 Core API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/locations/update` | POST | Send GPS location |
| `/locations/route/:bookingId` | GET | Get route for Google Maps |
| `/locations/current/:bookingId` | GET | Get current locations |
| `/locations/history/:userId` | GET | Get location history |
| `/locations/check-range/:bookingId` | GET | Check distance |
| `/locations/stream/:bookingId` | GET | Stream updates |

## 💾 What's Created

**Backend Files:**
- ✅ `src/services/location.service.ts` - Business logic
- ✅ `src/controllers/location.controller.ts` - API handlers
- ✅ `src/routes/location.routes.ts` - Route definitions
- ✅ Database migration file - LocationHistory table
- ✅ Updated Prisma schema

**Frontend Resources:**
- ✅ `COMPLETE_FRONTEND_EXAMPLE.tsx` - Production-ready component
- ✅ `LOCATION_TRACKING_DEMO.html` - Test without React

**Documentation:**
- ✅ `LOCATION_TRACKING_README.md` - Full guide
- ✅ `GOOGLE_MAPS_INTEGRATION.md` - Frontend setup
- ✅ `LOCATION_API_DOCS.md` - API reference
- ✅ `IMPLEMENTATION_SUMMARY.md` - What was done

## 🔌 API Examples

### Send Location
```bash
curl -X POST http://localhost:5000/api/locations/update \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 28.6139,
    "longitude": 77.2090,
    "accuracy": 10.5
  }'
```

### Get Route
```bash
curl http://localhost:5000/api/locations/route/BOOKING_ID \
  -H "Authorization: Bearer TOKEN"
```

### Check Range
```bash
curl "http://localhost:5000/api/locations/check-range/BOOKING_ID?maxDistance=10" \
  -H "Authorization: Bearer TOKEN"
```

## 💻 Frontend Usage (React)

```typescript
import { RealTimeLocationTracker } from './COMPLETE_FRONTEND_EXAMPLE';

// In your component:
<RealTimeLocationTracker 
  bookingId="booking123" 
  jwtToken={authToken}
/>
```

### Vanilla JavaScript
Use `LOCATION_TRACKING_DEMO.html` - includes all functionality in a single HTML file.

## 🗄️ Database

New table: `LocationHistory`
```sql
- id (PK)
- userId (FK)
- latitude (Float)
- longitude (Float)
- accuracy (Float, optional)
- timestamp (DateTime)
- createdAt, updatedAt

Indexes: userId, timestamp
```

## 🔐 Key Features

✅ Real-time GPS tracking
✅ Google Maps route visualization
✅ Distance calculation (Haversine)
✅ Location history (1+ hours)
✅ Range validation (default 10km)
✅ JWT authentication
✅ Data privacy controls
✅ Timestamp tracking

## ⚙️ Configuration

### Update Intervals (Recommended)
```javascript
// Location update: every 10 seconds
setInterval(updateLocation, 10000);

// Route refresh: every 5 seconds
setInterval(fetchRoute, 5000);
```

### Distance Check
```javascript
// Check if within 10km
const isInRange = await fetch(
  '/api/locations/check-range/bookingId?maxDistance=10'
);
```

## 🧪 Quick Test

### Option 1: Use HTML Demo
1. Open `LOCATION_TRACKING_DEMO.html` in browser
2. Set Google Maps API key
3. Enter JWT token & booking ID
4. Click "Start Tracking"

### Option 2: Use Postman
1. POST to `/locations/update` with coordinates
2. GET from `/locations/route/{bookingId}`
3. Verify response includes route data

### Option 3: Use cURL
```bash
# Send location
curl -X POST http://localhost:5000/api/locations/update \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitude":28.6139,"longitude":77.209}'

# Get route
curl http://localhost:5000/api/locations/route/booking123 \
  -H "Authorization: Bearer TOKEN"
```

## 📊 Response Format

```json
{
  "success": true,
  "data": {
    "route": {
      "origin": { "lat": 28.6139, "lng": 77.209 },
      "destination": { "lat": 28.6245, "lng": 77.2054 },
      "userLocation": { "lat": 28.6139, "lng": 77.209, "name": "User" },
      "partnerLocation": { "lat": 28.6245, "lng": 77.2054, "name": "Partner" }
    },
    "distance": 1.45,
    "waypoints": [...],
    "bookingStatus": "IN_PROGRESS"
  }
}
```

## 🎯 Flow

```
Frontend GPS → Update Location → Backend → Database
                                    ↓
                             Store in LocationHistory
                                    ↓
Frontend Polls Route → Backend Retrieves Both Locations → Formats for Google Maps
                                                                    ↓
                                                            Frontend Displays Map
```

## 📱 Mobile Considerations

- Use HTTPS (required for geolocation API)
- Request permission before accessing GPS
- Handle background location updates
- Optimize battery (adjust update intervals)
- Cache updates locally before sending

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| Location not updating | Check permission, enable GPS, use HTTPS |
| Map not loading | Verify API key, enable Maps API in Google Cloud |
| 401 Unauthorized | Check JWT token validity |
| 404 Booking not found | Verify bookingId exists in database |
| Distance incorrect | Verify coordinates are lat,lng not lng,lat |

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `LOCATION_TRACKING_README.md` | Complete feature overview |
| `GOOGLE_MAPS_INTEGRATION.md` | Frontend integration guide |
| `LOCATION_API_DOCS.md` | Detailed API documentation |
| `COMPLETE_FRONTEND_EXAMPLE.tsx` | Production-ready React component |
| `LOCATION_TRACKING_DEMO.html` | Standalone testing UI |
| `IMPLEMENTATION_SUMMARY.md` | What was implemented |
| `QUICK_REFERENCE.md` | This file! |

## 🚀 Next Steps

1. ✅ Run `npm run prisma:migrate`
2. ✅ Start server: `npm run dev`
3. ✅ Test with cURL or Postman
4. ✅ Install Google Maps library
5. ✅ Implement React component or use demo HTML
6. ✅ Get Google Maps API key
7. ✅ Set environment variables
8. ✅ Test on mobile device

## 🎓 Learning Resources

- [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript)
- [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
- [Haversine Formula](https://en.wikipedia.org/wiki/Haversine_formula)

## 💡 Tips

1. **Battery Life**: Use 30s intervals instead of 10s for long sessions
2. **Accuracy**: GPS has ~10-20m error margin, plan accordingly
3. **Testing**: Use browser DevTools to mock location for testing
4. **Privacy**: Only enable location during active booking
5. **Error Handling**: Always have fallback for when GPS is unavailable

## 📞 Support

1. Check `LOCATION_API_DOCS.md` for API details
2. Check `GOOGLE_MAPS_INTEGRATION.md` for frontend issues
3. Review `LOCATION_TRACKING_README.md` troubleshooting section
4. Check server logs: `npm run dev`
5. Check browser console for frontend errors

---

**Everything is ready to use!** Start with backend setup, then move to frontend. Good luck! 🚀
