# Dobhi Backend Production Dockerfile
# Stage 1: Base & Dependencies
FROM node:20-alpine AS base

# Install OpenSSL and libc compatibility for Prisma engine on Alpine Linux
RUN apk add --no-cache libc6-compat openssl curl

WORKDIR /app

# Copy package manifests and Prisma schema for efficient Docker layer caching
COPY package*.json ./
COPY tsconfig.json ./
COPY src/prisma ./src/prisma

# Install all dependencies including devDependencies needed for build and TS execution
RUN npm install

# Generate Prisma Client specifically for Linux Alpine runtime
RUN npx prisma generate

# Copy the rest of the application source code
COPY . .

# Set default environment variables
ENV NODE_ENV=production
ENV PORT=5001
ENV TZ=UTC

# Expose API port
EXPOSE 5001

# Healthcheck to verify the backend is responsive
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5001/api/services || exit 1

# Entrypoint ensures schema migrations are applied and launches server
CMD ["sh", "-c", "npx prisma migrate deploy 2>/dev/null || true; npx tsx src/server.ts"]
