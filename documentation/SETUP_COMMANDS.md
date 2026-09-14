# LOCATION TRACKING - SETUP COMMANDS

## Quick Setup

```bash
# 1. Generate Prisma Client
npm run prisma:generate

# 2. Run Migration
npm run prisma:migrate

# 3. Start Server
npm run dev
```

## Testing Backend

```bash
# In another terminal, test the update endpoint
curl -X POST http://localhost:5000/api/locations/update \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 28.6139,
    "longitude": 77.2090,
    "accuracy": 10.5
  }'

# Expected response:
# {
#   "success": true,
#   "message": "Location updated successfully",
#   "data": {
#     "latitude": 28.6139,
#     "longitude": 77.2090,
#     "accuracy": 10.5,
#     "timestamp": "2025-01-31T..."
#   }
# }
```

## Frontend Setup

```bash
# 1. Install Google Maps library
npm install @react-google-maps/api

# 2. Get API key from Google Cloud Console
# https://console.cloud.google.com/

# 3. Add to .env.local
echo "REACT_APP_GOOGLE_MAPS_API_KEY=your_key_here" >> .env.local

# 4. Use the component in your React app
# Import from COMPLETE_FRONTEND_EXAMPLE.tsx
```

## Quick Test Without React

1. Open `LOCATION_TRACKING_DEMO.html` in a browser
2. Replace `YOUR_GOOGLE_MAPS_API_KEY` with your actual key
3. Enter JWT token and booking ID
4. Click "Start Tracking"

## Full Setup Instructions

1. **Backend**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   npm run dev
   ```

2. **Test with Postman or cURL**
   - POST to `/api/locations/update`
   - GET from `/api/locations/route/{bookingId}`

3. **Frontend**
   ```bash
   npm install @react-google-maps/api
   ```
   - Set `REACT_APP_GOOGLE_MAPS_API_KEY` in `.env.local`
   - Use `COMPLETE_FRONTEND_EXAMPLE.tsx` component

4. **Documentation**
   - `QUICK_REFERENCE.md` - 5-minute guide
   - `LOCATION_TRACKING_README.md` - Complete overview
   - `GOOGLE_MAPS_INTEGRATION.md` - Frontend details
   - `LOCATION_API_DOCS.md` - API reference

## Verification Checklist

- [ ] Database migration ran successfully
- [ ] Server starts without errors
- [ ] Can POST to `/locations/update` endpoint
- [ ] Can GET from `/locations/route/{bookingId}` endpoint
- [ ] Google Maps API key obtained
- [ ] React component compiles
- [ ] HTML demo loads and works

## Troubleshooting

**Prisma migration fails:**
```bash
# Check schema is valid
npm run prisma:validate

# Reset database (development only!)
npm run prisma:reset
```

**Server won't start:**
```bash
# Check if port 5000 is in use
# Verify environment variables are set
cat .env
```

**Frontend map not showing:**
- Verify Google Maps API key
- Check API key restrictions
- Enable Maps JavaScript API in Google Cloud
- Look for errors in browser console

## Environment Variables

Create `.env` file:
```
DATABASE_URL=postgresql://user:password@localhost:5432/partner_backend
JWT_SECRET=your_secret_key
```

Create `.env.local` (frontend):
```
REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
REACT_APP_API_BASE_URL=http://localhost:5000/api
```

## Next Steps

1. ✅ Run migrations
2. ✅ Start backend
3. ✅ Get Google Maps API key
4. ✅ Install frontend library
5. ✅ Implement React component
6. ✅ Test on mobile device
7. ✅ Deploy to production

## Getting Help

- Read `LOCATION_TRACKING_README.md` for full details
- Check `LOCATION_API_DOCS.md` for endpoint documentation
- See `GOOGLE_MAPS_INTEGRATION.md` for frontend questions
- Review `QUICK_REFERENCE.md` for quick answers
- Open `LOCATION_TRACKING_DEMO.html` to test without React

All files are ready! Just follow the steps above. 🚀
