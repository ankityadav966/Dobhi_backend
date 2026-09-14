# Razorpay Payment Integration

Production-grade Razorpay payment integration with webhook signature verification, idempotent handlers, and transaction safety.

## Environment Variables (Required)

Add these to `.env`:

```env
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
```

**⚠️ CRITICAL SECURITY**:
- Keep `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` in `.env`, never commit to git
- Use strong secrets from Razorpay dashboard
- Webhook secret is used to verify signature - DO NOT skip this

## Files Created

### 1. Service: `src/services/razorpay.service.ts`

Contains three functions:

**`createRazorpayOrder(bookingId: string)`**
- Creates Razorpay order via API
- Converts amount to paise (multiply by 100)
- Saves `razorpayOrderId` in Payment table
- Returns order details for frontend

**`verifyRazorpaySignature(body, signature)`**
- ⚠️ CRITICAL: Verifies webhook signature using HMAC-SHA256
- DO NOT skip this - fraud risk
- Returns `true` if valid, `false` if invalid

**`handlePaymentCaptured(payload)`**
- Processes `payment.captured` event
- Updates Payment: status = COMPLETED, escrowStatus = LOCKED
- Updates Booking: status = CONFIRMED
- Idempotent: Safe if called twice
- Transaction-safe with updateMany race checks

**`handlePaymentFailed(payload)`**
- Processes `payment.failed` event
- Updates Payment: status = FAILED
- Booking stays PENDING_PAYMENT (customer can retry)
- Idempotent: Safe if called twice

### 2. Route: `src/routes/razorpay.routes.ts`

**Webhook Endpoint**: `POST /webhook/razorpay`
- Receives Razorpay webhook events
- Verifies signature (401 if invalid)
- Logs all payloads for debugging
- Handles: `payment.captured`, `payment.failed`
- Returns 200 immediately for Razorpay (async processing safe)
- Returns 500 on error for Razorpay to retry

### 3. Controller Update: `src/controllers/payment.controller.ts`

**New Endpoint**: `POST /api/payments/create-order`
- Requires authentication
- Validates booking ownership
- Calls `createRazorpayOrder` service
- Returns order ID + amount for frontend

### 4. App Update: `src/app.ts`

- Added raw body capture middleware for signature verification
- Registered `/webhook` routes

## API Flow

### Customer Side:

1. **Create Razorpay Order**:
   ```
   POST /api/payments/create-order
   Body: { bookingId: "booking_123" }
   Response: { orderId, amount, keyId }
   ```

2. **Frontend Integration** (Razorpay Checkout SDK):
   ```javascript
   const options = {
     key: response.keyId,
     amount: response.amount * 100,
     order_id: response.orderId,
     handler: function(response) {
       // On payment success, Razorpay sends webhook
     }
   };
   ```

3. **Webhook Auto-Confirms Booking**:
   - Razorpay sends `payment.captured` webhook
   - Service verifies signature
   - Booking auto-confirmed in database
   - No manual confirmation needed

### Payment States:

```
PENDING_PAYMENT booking
    ↓ (customer initiates payment)
PENDING payment
    ↓ (Razorpay processes)
COMPLETED payment (webhook: payment.captured)
    ↓ (booking auto-confirms)
CONFIRMED booking
    ↓
IN_PROGRESS → COMPLETED
```

### Failed Payment:

```
PENDING_PAYMENT booking
    ↓ (payment attempt fails)
FAILED payment (webhook: payment.failed)
    ↓ (booking stays PENDING_PAYMENT)
PENDING_PAYMENT booking (customer can retry)
```

## Security Features

### Signature Verification (⚠️ CRITICAL)
```typescript
// DO NOT SKIP THIS
const isValid = verifyRazorpaySignature(rawBody, signature);
if (!isValid) {
  return 401; // Reject webhook
}
```

### Race Condition Safety
```typescript
// updateMany with status check prevents duplicate processing
const updated = await tx.booking.updateMany({
  where: {
    id: bookingId,
    status: BookingStatus.PENDING_PAYMENT, // Must match
  },
  data: { status: BookingStatus.CONFIRMED }
});

if (updated.count === 0) {
  // Status already changed or webhook processed twice
  throw new Error('Status mismatch');
}
```

### Idempotent Handlers
- Each webhook handler checks if already processed
- Safe to receive duplicate webhooks
- Returns success gracefully if already handled

### Transaction Atomicity
```typescript
await prisma.$transaction(async (tx) => {
  // Both payment + booking updates in single transaction
  // Either both succeed or both rollback
});
```

## Testing

### Create Order (Auth Required)
```bash
curl -X POST http://localhost:3000/api/payments/create-order \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "bookingId": "booking_123" }'
```

### Webhook (No Auth, Signature Required)
```bash
curl -X POST http://localhost:3000/webhook/razorpay \
  -H "X-Razorpay-Signature: <valid_signature>" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "payment.captured",
    "payment": { "id": "pay_xxx", "amount": 50000 },
    "order": { "id": "order_xxx" }
  }'
```

Razorpay dashboard generates signature - do not create manually.

## Logging

All operations logged:
- Order creation: amount, orderId, status
- Webhook verification: signature result, event type
- Payment capture: bookingId, paymentId, confirmation status
- Payment failure: orderId, error description
- Errors: with full context for debugging

Check logs for:
- Signature verification failures (security issue)
- Duplicate webhook processing (handled gracefully)
- Payment update race conditions (handled gracefully)

## TODOs for Production

- [ ] Set up Razorpay webhook in dashboard → `POST /webhook/razorpay`
- [ ] Add `.env` variables with real keys
- [ ] Test payment flow end-to-end
- [ ] Enable Razorpay dashboard webhook retries
- [ ] Monitor webhook logs for failed attempts
- [ ] Add payment receipt generation
- [ ] Add refund API integration
- [ ] Add payment analytics dashboard

## Key Design Decisions

1. **No direct confirmBooking()**: Payment confirmed ONLY via webhook
2. **Webhook async processing**: Return 200 immediately, process async
3. **Full amount to escrow**: `escrowStatus = LOCKED` on payment capture
4. **2-hour payout hold**: Set after booking completion, not on capture
5. **Race condition safe**: updateMany with status checks throughout
6. **Idempotent handlers**: Safe for duplicate webhooks from Razorpay

## ⚠️ Important Reminders

- **DO NOT skip signature verification** - This is the ONLY way to verify webhooks come from Razorpay
- **Keep secrets in .env** - Never commit `RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET`
- **Log webhook payloads** - Essential for debugging payment issues
- **Test webhook retries** - Razorpay will retry if you don't return 200
