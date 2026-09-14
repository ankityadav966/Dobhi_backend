#!/bin/bash

# Partner Backend - Installation & Setup Script
# Run this script to quickly set up the project

echo "🎉 Partner Backend Setup Script"
echo "================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Generate Prisma Client
echo "🔧 Generating Prisma client..."
npm run prisma:generate

if [ $? -ne 0 ]; then
    echo "❌ Failed to generate Prisma client"
    exit 1
fi

echo "✅ Prisma client generated"
echo ""

# Run migrations
echo "📊 Running database migrations..."
npm run prisma:migrate

if [ $? -ne 0 ]; then
    echo "❌ Failed to run migrations. Make sure PostgreSQL is running and DATABASE_URL is set in .env"
    exit 1
fi

echo "✅ Database migrations completed"
echo ""

# Seed database
read -p "Do you want to seed sample data? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🌱 Seeding database..."
    npm run seed
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to seed database"
        exit 1
    fi
    
    echo "✅ Database seeded"
else
    echo "⏭️  Skipped seeding"
fi

echo ""
echo "🎉 Setup Complete!"
echo ""
echo "📋 Next steps:"
echo "1. Review .env configuration"
echo "2. Start development server: npm run dev"
echo "3. Visit http://localhost:5000/health"
echo "4. Check documentation in README.md"
echo ""
echo "📚 Documentation:"
echo "- START_HERE.md - Quick overview"
echo "- QUICKSTART.md - Setup guide"
echo "- API_DOCUMENTATION.md - Complete API reference"
echo "- ENDPOINTS.md - Quick endpoint reference"
echo ""
echo "Happy coding! 🚀"
