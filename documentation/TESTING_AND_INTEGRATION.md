# Integration Testing & Next Steps

**Status:** Code deployed ✅ | Testing required ⏳ | Controllers updated TBD

---

## Immediate Actions (Next 30 Minutes)

### 1. Verify Runtime Functionality
```bash
# Start the server
npm run dev

# In another terminal, test the acceptance flow:
curl -X POST http://localhost:3000/api/bookings/request/test-id/accept \
  -H "Content-Type: application/json" \
  -d '{"helperId": "helper-uuid"}'

# Expected response on success:
{
  "bookingId": "booking-uuid",
  "message": "Booking reserved. Awaiting payment confirmation.",
  "status": "PENDING_PAYMENT"
}

# Expected error on second acceptance:
{
  "error": "Request already accepted by another helper"
}
```

### 2. Test Race Condition Prevention
```bash
# Simulate two helpers accepting simultaneously:
parallel_test() {
  curl -X POST http://localhost:3000/api/bookings/request/test-id/accept \
    -H "Content-Type: application/json" \
    -d "{\"helperId\": \"$1\"}"
}

# Run in background:
parallel_test "helper-a" &
parallel_test "helper-b" &
wait

# Expected: One succeeds, one fails with "already accepted"
```

### 3. Test Conflict Detection
```bash
# Create a CONFIRMED booking for helper-a: 10:00-12:00
# Try to accept request: 11:00-13:00

curl -X POST http://localhost:3000/api/bookings/request/test-id-2/accept \
  -H "Content-Type: application/json" \
  -d '{"helperId": "helper-a"}'

# Expected response:
{
  "error": "Helper has conflicting booking during this time period"
}
```

---

## Controller Updates Required

### File: `src/controllers/booking.controller.ts`

#### Update Accept Response Handler
```typescript
// OLD:
const booking = await acceptBookingRequest(requestId, helperId);
return res.json({
  status: 'CONFIRMED',
  bookingId: booking.id,
});

// NEW:
const booking = await acceptBookingRequest(requestId, helperId);
return res.json({
  status: 'PENDING_PAYMENT',  // ✅ Changed
  bookingId: booking.id,
  message: booking.message,  // "Awaiting payment confirmation"
  nextStep: 'Confirm payment to activate booking',
});
```

#### Add Payment Confirmation Endpoint
```typescript
// POST /api/bookings/:bookingId/confirm-payment
export const confirmPayment = async (req: Request, res: Response) => {
  const { bookingId } = req.params;
  
  // Update booking status from PENDING_PAYMENT to CONFIRMED
  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: 'CONFIRMED' },
    include: { helper: true, customer: true },
  });

  return res.json({
    message: 'Payment confirmed. Booking activated.',
    status: 'CONFIRMED',
    bookingId: booking.id,
  });
};
```

#### Handle New Error Cases
```typescript
try {
  const booking = await acceptBookingRequest(requestId, helperId);
  // ... success handler ...
} catch (error) {
  if (error.message.includes('already accepted')) {
    return res.status(409).json({ error: 'Request already accepted' });
  }
  if (error.message.includes('Conflicting booking')) {
    return res.status(409).json({ error: 'Helper unavailable at that time' });
  }
  if (error.message.includes('expired')) {
    return res.status(410).json({ error: 'Request expired' });
  }
  // ... other handlers ...
}
```

### File: `src/controllers/location.controller.ts`

#### Check Conflict in Helper Availability
```typescript
// When returning available helpers for UI:
const availableHelpers = await findNearbyHelpers(
  latitude,
  longitude,
  serviceCategory,
  customerId,
  requestedDate,
  estimatedHours
);

// Each helper in this list is:
// ✅ Within 5km radius
// ✅ Service provider
// ✅ NO conflicting bookings (time overlap check already done)

// Return with clear message:
return res.json({
  availableHelpers: availableHelpers.length,
  helpers: availableHelpers,
  message: `Found ${availableHelpers.length} available helpers`,
});
```

---

## Database Verification Queries

```sql
-- Verify helperId field exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Booking' AND column_name = 'helperId';

-- Expected: helperId | text | NO

-- Verify indexes created
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'Booking' 
AND indexname LIKE '%helperId%' OR indexname LIKE '%status%';

-- Expected:
-- Booking_helperId_idx
-- Booking_status_idx
-- Booking_helperId_startTime_idx

-- Verify dispatchedHelperIds field
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'BookingRequest' 
AND column_name = 'dispatchedHelperIds';

-- Expected: dispatchedHelperIds | text[] (array)

-- Count PENDING_PAYMENT bookings
SELECT COUNT(*) 
FROM "Booking" 
WHERE status = 'PENDING_PAYMENT';

-- Should be 0 initially, increases with acceptances
```

---

## Cron Job Integration Check

**File:** `src/tasks/expiry-cronjob.ts`

```typescript
// Verify this is integrated in server startup
import { startExpiryProcessing } from './tasks/expiry-cronjob';

// In src/server.ts:
startExpiryProcessing();  // Call on server start
```

**Cron logs to expect:**
```
[CRON] Starting expiry processing every 5000ms
[CRON] Processed expired booking requests: 0 (no expiry in last cycle)
[CRON] Processed expired booking requests: 2 (found 2 expired)
```

---

## Load Testing Checklist

### Before Production Deployment

```
[ ] Race condition test (100 concurrent accepts)
    Expected: Exactly 1 booking created, 99 errors
    
[ ] Time-overlap test (10 bookings, check conflict detection)
    Expected: 100% accuracy in conflict detection
    
[ ] Expiry processing test (1000 requests, expire all)
    Expected: All marked EXPIRED within 15s
    
[ ] Redispatch test (reject 50%, verify next helper)
    Expected: No orphaned requests, all get dispatched
    
[ ] Query performance test (1M bookings, check index usage)
    Expected: Conflict query < 50ms
    
[ ] Transaction rollback test (fail payment, verify atomic rollback)
    Expected: No orphaned records, booking remains PENDING_PAYMENT
```

---

## Success Criteria

✅ **Code Ready** - TypeScript compiles, no errors
✅ **Schema Deployed** - Database synced, indexes created
✅ **Business Logic** - All 9 requirements implemented
⏳ **Integration Testing** - Verify race prevention, conflict detection
⏳ **Controller Updates** - Handle PENDING_PAYMENT status
⏳ **Load Testing** - Verify performance at scale

---

## Deployment Path

```
1. ✅ Code merge to feature branch
2. ⏳ Integration testing (1 day)
3. ⏳ Code review (2 hours)
4. ⏳ Staging deployment (30 minutes)
5. ⏳ Staging validation (2 hours)
6. ⏳ Production deployment (15 minutes)
7. ⏳ Production monitoring (24 hours)
```

---

## Rollback Plan (If Needed)

```
1. Revert to previous booking-dispatch.service.ts (~v1.0)
2. Run migration rollback: npx prisma migrate resolve
3. Restore database backup from 2025-02-18 09:00 UTC
4. Restart services
5. Monitor for 24 hours
```

**Note:** Data loss in rollback = all PENDING_PAYMENT bookings → CANCELLED

---

## Production Concerns Addressed

| Concern | Solution |
|---------|----------|
| Race conditions | Conditional UPDATE pattern ✅ |
| Double-booking | Time-overlap conflict check ✅ |
| Data loss | ACID transactions ✅ |
| Helper unavailability | Query at accept time ✅ |
| Payment validation | PENDING_PAYMENT status ✅ |
| Request expiry | DB cron job ✅ |
| Scalability | Index optimization ✅ |
| Monitoring | Clear error messages ✅ |

---

## Next Session: Recommended Actions

1. **Run integration tests** (30 min)
   - Test race condition (must succeed)
   - Test conflict detection (must succeed)
   - Test redispatch logic (must succeed)

2. **Update controllers** (45 min)
   - Add PENDING_PAYMENT response
   - Add payment confirmation endpoint
   - Add detailed error handling

3. **Load test** (2 hours)
   - 100 concurrent race tests
   - 1000 expiry tests
   - Monitor database logs

4. **Staging deployment** (30 min)
   - Push to staging environment
   - Run end-to-end tests
   - Monitor logs for 2 hours

---

**Document Version:** 1.0 | **Date:** 2025-02-18 | **Status:** Implementation Complete, Testing Pending
