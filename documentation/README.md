# zynexx-Partner-backend
# Partner Backend

A comprehensive Node.js backend API for a service booking platform connecting customers with verified service providers.

## Features

✅ **User Management**
- Phone number-based authentication with OTP verification
- User registration (Customer and Helper roles)
- Profile management with image uploads
- KYC verification system

✅ **Service Management**
- Helpers can create and manage multiple services
- Service categorization and listings
- Availability management
- Pricing and booking duration settings

✅ **Job Management**
- Customers can post service requests
- Job scheduling and location-based matching
- Real-time job tracking

✅ **Booking System**
- One-click service booking
- Multiple booking statuses (Pending, Confirmed, In Progress, Completed, Cancelled)
- Booking history tracking
- Location-based service matching

✅ **Payment Integration**
- Integrated Razorpay payment gateway
- Multiple payment methods (Card, UPI, NetBanking)
- Payment status tracking
- Refund management
- Transaction history

✅ **Rating & Reviews**
- 5-star rating system
- Detailed reviews
- Helper rating aggregation
- Rating statistics and distribution

✅ **Security**
- JWT-based authentication
- Rate limiting
- Input validation
- Password hashing with bcryptjs
- CORS protection

✅ **Scalability**
- PostgreSQL database
- Redis caching
- Proper indexing
- Pagination support
- Logging system

## Tech Stack

- **Runtime:** Node.js
- **Language:** TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** JWT
- **Payment:** Razorpay
- **SMS:** MSG91
- **Cache:** Redis
- **Logging:** Winston
- **Validation:** Express Validator

## Project Structure

```
src/
├── config/              # Configuration files
├── controllers/         # Business logic
├── middlewares/         # Express middleware
├── routes/             # API routes
├── utils/              # Utility functions
├── prisma/             # Database schema and migrations
├── app.ts              # Express app setup
├── server.ts           # Server entry point
├── prisma.client.ts    # Prisma client instance
└── seed.ts             # Database seeding
```

## Installation & Setup

### Prerequisites
- Node.js 16+
- PostgreSQL 12+
- Redis (optional)
- npm or yarn

### Steps

1. **Clone and Install**
```bash
cd partner-backend
npm install
```

2. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your configurations
```

3. **Database Setup**
```bash
# Create database migration
npm run prisma:migrate

# Seed initial data (optional)
npm run seed
```

4. **Start Development Server**
```bash
npm run dev
```

Server will run on `http://localhost:5000`

## Environment Variables

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/partner_db"

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here
JWT_REFRESH_EXPIRE=30d

# OTP & SMS
MSG91_AUTH_KEY=your_msg91_auth_key
MSG91_ROUTE=your_msg91_route
OTP_EXPIRE=600

# Redis
REDIS_URL=redis://localhost:6379

# AWS S3
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=partner-bucket

# Payment
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

## API Documentation

Full API documentation is available in [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

### Quick API Overview

**Authentication:**
- `POST /api/auth/send-otp` - Send OTP to phone
- `POST /api/auth/verify-otp` - Verify OTP and login
- `POST /api/auth/refresh-token` - Refresh access token
- `POST /api/auth/logout` - Logout user

**Users:**
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `POST /api/users/register-helper` - Register as helper
- `GET /api/users/search-helpers` - Search helpers

**Services:**
- `GET /api/services` - List services
- `POST /api/services` - Create service (helper only)
- `GET /api/services/:serviceId` - Get service details

**Jobs:**
- `GET /api/jobs` - Browse jobs
- `POST /api/jobs` - Post job
- `GET /api/jobs/:jobId` - Get job details

**Bookings:**
- `POST /api/bookings` - Create booking
- `GET /api/bookings` - Get my bookings
- `PUT /api/bookings/:bookingId/status` - Update status

**Payments:**
- `POST /api/payments/initiate` - Start payment
- `POST /api/payments/verify` - Verify payment

**Ratings:**
- `POST /api/ratings` - Create rating
- `GET /api/ratings/service/:serviceId` - Get service ratings
- `GET /api/ratings/helper/:helperId` - Get helper ratings

## Scripts

```bash
# Development
npm run dev              # Start dev server with hot reload

# Production
npm run build            # Compile TypeScript
npm start                # Run compiled code

# Database
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio

# Utilities
npm run seed             # Seed initial data
```

## Database Schema

The application uses PostgreSQL with Prisma ORM. Key tables:

- **User** - Customers and Helpers
- **Service** - Services offered by helpers
- **JobDetail** - Jobs posted by customers
- **Booking** - Booking records
- **Payment** - Payment transactions
- **Rating** - Reviews and ratings
- **OTP** - OTP records for authentication
- **RefreshToken** - Refresh token storage

See [schema.prisma](./src/prisma/schema.prisma) for complete details.

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "errors": []  // Optional validation errors
}
```

## Security Features

- ✅ JWT authentication with access & refresh tokens
- ✅ Password hashing with bcryptjs
- ✅ Rate limiting (100 requests/minute per IP)
- ✅ Input validation and sanitization
- ✅ CORS protection
- ✅ Request logging
- ✅ Error handling middleware

## Logging

The application uses Winston for logging:
- Logs are saved to `logs/combined.log` and `logs/error.log`
- Console output in development mode
- Different log levels based on environment

## Contributing

1. Create a feature branch
2. Commit changes with clear messages
3. Push to repository
4. Create a pull request

## Support

For issues or questions, please create an issue in the repository.

## License

MIT License - feel free to use this project.
