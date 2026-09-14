# Quick Start Guide

## 🚀 Getting Started with Partner Backend

### Prerequisites
- Node.js 16 or higher
- PostgreSQL 12 or higher
- npm or yarn

### Step 1: Installation

```bash
# Navigate to project directory
cd partner-backend

# Install dependencies
npm install
```

### Step 2: Database Setup

```bash
# Create PostgreSQL database
createdb partner_db

# Copy environment file
cp .env.example .env

# Update .env with your database credentials
# Edit .env and set:
# DATABASE_URL="postgresql://user:password@localhost:5432/partner_db"
```

### Step 3: Run Migrations

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations to create tables
npm run prisma:migrate

# (Optional) Seed sample data
npm run seed
```

### Step 4: Start Development Server

```bash
npm run dev
```

Server will start at `http://localhost:5000`

### Verify Server is Running

Open your browser and visit:
```
http://localhost:5000/health
```

You should see:
```json
{
  "success": true,
  "message": "Server is running"
}
```

---

## 📱 Testing the API

### 1. Send OTP
```bash
curl -X POST http://localhost:5000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210"}'
```

Response:
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "otp": "123456"
}
```

### 2. Verify OTP
```bash
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone":"9876543210",
    "otp":"123456"
  }'
```

Response:
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "user": {...},
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

### 3. Get User Profile (Using Token)
```bash
curl -X GET http://localhost:5000/api/users/profile \
  -H "Authorization: Bearer {accessToken}"
```

---

## 📚 API Documentation

- **Full API Docs:** See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- **Quick Reference:** See [ENDPOINTS.md](./ENDPOINTS.md)

---

## 🗂️ Project Structure

```
src/
├── config/              # Configuration settings
├── controllers/         # Request handlers (Business logic)
├── middlewares/         # Express middleware
├── routes/             # API route definitions
├── utils/              # Utility functions
├── prisma/             # Database schema
├── app.ts              # Express app configuration
├── server.ts           # Server entry point
└── seed.ts             # Sample data seeding
```

---

## 🔑 Key Features

✅ **Authentication**
- OTP-based login (SMS via MSG91)
- JWT tokens (Access & Refresh)
- Phone verification

✅ **User Management**
- Customer and Helper roles
- Profile management
- KYC verification
- Bank details storage

✅ **Services**
- Service listing and browsing
- Helper profiles with ratings
- Service categorization
- Availability management

✅ **Bookings**
- Create and manage bookings
- Track booking status
- Location-based matching
- Special requirements

✅ **Payments**
- Razorpay integration
- Multiple payment methods
- Payment tracking
- Refunds

✅ **Ratings**
- 5-star rating system
- Detailed reviews
- Helper statistics
- Rating history

---

## 🛠️ Available Commands

```bash
# Development
npm run dev              # Start dev server with auto-reload

# Building
npm run build            # Compile TypeScript to JavaScript
npm start                # Run compiled app

# Database
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run pending migrations
npm run prisma:studio    # Open Prisma Studio (GUI)
npm run seed             # Seed sample data

# Other
npm test                 # Run tests (if configured)
```

---

## 📝 Environment Variables

Create a `.env` file in the root directory:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/partner_db"

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRE=30d

# SMS
MSG91_AUTH_KEY=your_auth_key
MSG91_ROUTE=your_route
OTP_EXPIRE=600

# Redis (optional)
REDIS_URL=redis://localhost:6379

# AWS S3 (for file uploads)
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET=your-bucket

# Payment Gateway
RAZORPAY_KEY_ID=your_key
RAZORPAY_KEY_SECRET=your_secret
```

---

## 🐛 Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
- Check PostgreSQL is running
- Verify DATABASE_URL in .env
- Create database if it doesn't exist

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::5000
```
- Change PORT in .env
- Or kill process: `lsof -i :5000` (Mac/Linux)

### Dependencies Issue
```
npm ERR! Could not resolve dependency
```
- Delete node_modules and package-lock.json
- Run `npm install` again

---

## 📖 Next Steps

1. **Read the Documentation**
   - [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - Complete API reference
   - [ENDPOINTS.md](./ENDPOINTS.md) - Quick endpoint summary

2. **Explore the Code**
   - Check `src/controllers/` for business logic
   - Review `src/routes/` for API endpoints
   - See `src/prisma/schema.prisma` for data models

3. **Test the APIs**
   - Use Postman or curl to test endpoints
   - Start with authentication endpoints
   - Then test user and service endpoints

4. **Configure Integrations**
   - Set up MSG91 for SMS
   - Configure Razorpay for payments
   - Set up AWS S3 for file uploads

5. **Deploy**
   - Push code to GitHub
   - Set up CI/CD pipeline
   - Deploy to your hosting provider

---

## 🤝 Support

For issues or questions:
1. Check existing GitHub issues
2. Review documentation
3. Check logs in `logs/` directory
4. Open a new issue with details

---

## 📄 License

MIT License - See LICENSE file for details

---

Happy coding! 🎉
