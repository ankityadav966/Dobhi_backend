# Socket Booking Events & APIs (Helper App)

This document explains how the Socket.io booking events are used in the Zynexx backend, which APIs are involved, and what the frontend needs to handle for real-time booking alerts and responses.

---

## 1. Socket Events (Server → Helper)
- **booking:new**
  - Sent when a new booking request is dispatched to a helper.
  - Contains booking request details (customer, work, earnings, time, address, etc.).
- **booking:closed**
  - Sent when a pending request was accepted by another helper (so this helper should remove the alert).
- **booking:alreadyAccepted**
  - Sent if this helper tried to accept but lost the race (another helper accepted first).
- **booking:expired**
  - Sent if the booking request expired (no one accepted in time).

## 2. Socket Authentication Flow
- Helper app connects to Socket.io server and sends `{ auth: { token: "<Bearer token>" } }`.
- Server verifies JWT, resolves Helper.id, and joins room `helper:<id>`.

## 3. Booking APIs (REST)
- **Accept Booking Request**
  - `POST /api/partner/booking-request/:id/accept`
  - Body: `{}`
  - Accepts the booking if still pending.
- **Reject Booking Request**
  - `POST /api/partner/booking-request/:id/reject`
  - Body: `{}`
  - Rejects the booking for this helper.
- **Get Booking Requests (for alert)**
  - `GET /api/partner/booking-requests`
  - Returns list of pending booking requests for the helper.
- **Get Upcoming Jobs**
  - `GET /api/partner/bookings?status=CONFIRMED`
  - Returns list of confirmed bookings (for jobs screen).

## 4. Frontend Flow
- On socket event `booking:new`, show booking alert with timer.
- On Accept/Reject, call the respective API.
- On `booking:closed`, `booking:alreadyAccepted`, or `booking:expired`, hide the alert and show appropriate message.

## 5. Example Socket Event Payload
```json
{
  "event": "booking:new",
  "data": {
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
}
```

---

## Summary Table
| Event/API                | Purpose                                 |
|-------------------------|------------------------------------------|
| booking:new (socket)    | Show new booking alert                   |
| booking:closed (socket) | Remove alert if job taken by another      |
| booking:alreadyAccepted | Show "already taken" if lost race        |
| booking:expired         | Remove alert if expired                  |
| POST /booking-request/:id/accept | Accept booking request           |
| POST /booking-request/:id/reject | Reject booking request           |
| GET /booking-requests   | List pending booking requests             |
| GET /bookings?status=CONFIRMED | List confirmed jobs                |

---

## What to Provide to Frontend
- Socket event contract (event names, payloads)
- REST API endpoints for accept/reject and job lists
- Example payloads
- Timer value (`expiresAt`) for alert

This ensures the frontend can handle real-time booking alerts, accept/reject actions, and job lists as required.
