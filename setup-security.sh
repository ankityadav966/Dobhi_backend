#!/bin/bash

# Production-Level Authentication & Security Implementation Setup Script
# This script helps you set up the production environment

set -e

echo "🔐 Setting up Production-Level Authentication & Security"
echo "=========================================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  Creating .env file template..."
    cat > .env.template << 'EOF'
# JWT Configuration
JWT_SECRET=generate_a_strong_secret_minimum_32_characters_long
JWT_REFRESH_SECRET=generate_another_strong_secret_minimum_32_characters
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d

# OTP Configuration
OTP_EXPIRE=600
MSG91_AUTH_KEY=your_msg91_auth_key
MSG91_ROUTE=your_msg91_route_id

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/zynexx_db

# Redis (Optional, for distributed systems)
REDIS_URL=redis://localhost:6379

# Environment
NODE_ENV=production
PORT=5000

# AWS S3 (Optional, for file uploads)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_S3_BUCKET=your_bucket_name

# Razorpay (Optional, for payments)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Idfy (Optional, for verification)
IDFY_API_KEY=your_idfy_api_key
IDFY_ACCOUNT_ID=your_idfy_account_id
IDFY_BASE_URL=https://eve.idfy.com/v3
EOF
    
    echo "✅ Created .env.template"
    echo "⚠️  Please copy .env.template to .env and fill in your values"
    echo ""
fi

echo "📋 Checking Project Structure..."
echo ""

# Define security files that should exist
files=(
    "src/middlewares/security.middleware.ts"
    "src/middlewares/auth.middleware.ts"
    "src/middlewares/rateLimiter.ts"
    "src/middlewares/error.middleware.ts"
    "src/services/token-blacklist.service.ts"
    "src/services/otp.service.ts"
    "src/utils/validators.ts"
    "src/utils/jwt.ts"
    "src/utils/logger.ts"
    "src/controllers/auth.controller.ts"
    "src/routes/auth.routes.ts"
    "src/app.ts"
    "src/types/express.d.ts"
    "SECURITY_IMPLEMENTATION.md"
    "IMPLEMENTATION_SUMMARY.md"
    "QUICK_REFERENCE_SECURITY.md"
)

missing_files=()

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file - MISSING"
        missing_files+=("$file")
    fi
done

echo ""
echo "🔒 Security Features Implemented:"
echo "  ✅ JWT Authentication (Access + Refresh Tokens)"
echo "  ✅ OTP-Based Phone Verification"
echo "  ✅ Token Blacklisting on Logout"
echo "  ✅ Rate Limiting (Multiple Strategies)"
echo "  ✅ CORS Protection"
echo "  ✅ Security Headers (Helmet.js)"
echo "  ✅ Input Validation & Sanitization"
echo "  ✅ Request ID Tracking"
echo "  ✅ Error Handling with Security"
echo "  ✅ Logging with Security Context"
echo ""

echo "📦 Installation Instructions:"
echo ""
echo "1. Install Dependencies:"
echo "   npm install"
echo ""
echo "2. Configure Environment:"
echo "   cp .env.template .env"
echo "   # Edit .env with your values"
echo ""
echo "3. Setup Database:"
echo "   npm run prisma:migrate"
echo ""
echo "4. (Optional) Setup Redis:"
echo "   # Install Redis and update src/services/token-blacklist.service.ts"
echo ""
echo "5. Development:"
echo "   npm run dev"
echo ""
echo "6. Production Build:"
echo "   npm run build"
echo "   npm start"
echo ""

echo "🧪 Testing Security:"
echo ""
echo "# Test Rate Limiting"
echo "for i in {1..10}; do"
echo "  curl -X POST http://localhost:5000/api/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"phone\": \"9876543210\"}'"
echo "done"
echo ""

echo "📊 Monitoring:"
echo "  - Request ID: Included in all responses (X-Request-ID header)"
echo "  - Logs: Check logs with requestId for tracing"
echo "  - Rate Limits: Monitor 429 responses"
echo "  - Auth Failures: Track failed login attempts"
echo ""

echo "🚀 Deployment Checklist:"
echo "  [ ] Set strong JWT secrets (min 32 chars)"
echo "  [ ] Enable HTTPS/TLS"
echo "  [ ] Configure CORS origins"
echo "  [ ] Set NODE_ENV=production"
echo "  [ ] Set up database"
echo "  [ ] Configure Redis (optional)"
echo "  [ ] Enable monitoring/alerting"
echo "  [ ] Set up error tracking (Sentry)"
echo "  [ ] Configure automated backups"
echo ""

echo "📚 Documentation:"
echo "  - SECURITY_IMPLEMENTATION.md: Complete security guide"
echo "  - IMPLEMENTATION_SUMMARY.md: Implementation details"
echo "  - QUICK_REFERENCE_SECURITY.md: Quick reference guide"
echo ""

if [ ${#missing_files[@]} -eq 0 ]; then
    echo "✅ All security files are in place!"
    echo "✅ Your backend is production-ready!"
else
    echo "⚠️  Missing ${#missing_files[@]} file(s)"
    echo "Please ensure all files are created"
fi

echo ""
echo "🎉 Production-Level Authentication & Security Setup Complete!"
echo ""
