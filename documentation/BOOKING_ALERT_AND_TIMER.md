# Booking Alert & Auto-Reject System (Helper App)

This document explains how the booking alert and auto-reject timer (as shown in the attached screenshot) are handled in the Zynexx backend and what information/frontend logic is required.

---

## 1. Booking Alert Flow
- When a new booking request is created, the backend dispatches it to multiple eligible helpers.
- Each helper receives a **push notification** or **in-app alert** with booking details (customer, work, earnings, time, address).
- The alert includes a countdown timer (e.g., 14 seconds) for the helper to respond.

## 2. Auto-Reject Timer Logic
- The timer is managed on the **frontend** (helper app):
  - When the alert is shown, a countdown (e.g., 14s) starts.
  - If the helper does not respond within the time, the app automatically sends a **reject** action to the backend.
- On the **backend**:
  - The booking request has an `expiresAt` field (timestamp) and a `status` field.
  - If the helper does not respond in time, the backend can also mark the request as expired or rejected for that helper (for extra safety).

## 3. Backend API Usage
- **Accept Booking:**
  - Endpoint: `POST /api/partner/booking-request/:id/accept`
  - Body: `{}`
  - Only succeeds if the request is still pending and not accepted by another helper.
- **Reject Booking:**
  - Endpoint: `POST /api/partner/booking-request/:id/reject`
  - Body: `{}`
  - Can be triggered by the helper or automatically by the app after the timer expires.

## 4. What to Provide to Frontend Team
- **API contract:**
  - Booking request details API (fields: customer, work, earnings, time, address, distance, etc.)
  - Accept/reject endpoints
- **Timer value:**
  - The timer duration (e.g., 14 seconds) should be sent from backend (configurable per request or as a constant).
  - Include `expiresAt` or `timeLeft` in the booking request payload.
- **Auto-reject logic:**
  - Frontend must call the reject endpoint automatically if timer runs out.
  - Backend should also handle expiry for safety (cron or on next action).

## 5. Example API Response (for Alert)
```json
{
  "bookingRequestId": 1762415711831,
  "customer": {
    "name": "Anjali Verma"
  },
  "workDetails": "Jhadu, Pocha aur Bartan",
  "earnings": 300,
  "time": "9:00 AM - 11:00 AM",
  "address": "Apartment 302, Prestige Towers, Koramangala, Bangalore",
  "distance": 1.5,
  "expiresAt": "2026-03-18T09:00:14.000Z"
}
```

## 6. Frontend Logic (Summary)
- Show alert with timer.
- If Accept: call accept API.
- If Reject or timer runs out: call reject API.
- Hide alert after response.

---

## Summary
- The timer and auto-reject are handled by the frontend, but the backend provides the timer value and enforces expiry.
- Provide the API contract, timer value, and accept/reject endpoints to the frontend team.
- This ensures helpers cannot hold a booking indefinitely and bookings are assigned quickly.
