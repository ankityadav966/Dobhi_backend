# Middleware Layer Upgrade - Production Grade

## Required Dependencies
```bash
npm install redis express-rate-limit helmet compression hpp express-slow-down express-validator xss-clean
npm install --save-dev @types/hpp
```

## Middleware Order (CRITICAL for security)

1. Request ID tracking
2. Security headers (Helmet)
3. Compression
4. Trust proxy (reverse proxy awareness)
5. CORS
6. Request size limiting
7. JSON body parser (general routes)
8. Rate limiting (global)
9. Slow-down middleware
10. XSS sanitization
11. Input validation (routes)
12. Route handlers
13. 404 handler
14. Error handler

## Key Changes

### 1. Rate Limiting
- Redis-based for horizontal scaling
- Per-IP limiting (general endpoints)
- Per-user limiting (authenticated endpoints)
- Separate strict limits for auth endpoints

### 2. HPP Protection
- Uses `hpp` package instead of custom logic
- Prevents query parameter pollution

### 3. Input Validation
- Uses `express-validator` in routes
- NO silent mutation of request body
- Explicit validation errors

### 4. CORS Security
- Requires ALLOWED_ORIGINS env var in production
- Fails startup if missing
- Localhost allowed only in development

### 5. Error Handling
- Standardized response format
- Error codes for client-side handling
- Stack trace hidden in production
- Full logging internally
- Request ID included for tracing

### 6. Logging
- HEALTH_CHECK requests skipped
- Authorization header masked
- Environment-based log levels
- Sensitive data redaction

### 7. Webhook Security
- Raw body middleware ONLY on /webhook/razorpay
- JSON parsing happens after signature verification
- No middleware interference

### 8. Compression
- Gzip compression for response bodies
- Improves API performance
- Bandwidth savings

## Production vs Development

| Feature | Development | Production |
|---------|-------------|-----------|
| CORS origins | Localhost only | ALLOWED_ORIGINS env var (required) |
| Rate limit | Relaxed | Strict |
| Log level | DEBUG | INFO/WARN |
| Error stack trace | Shown | Hidden |
| Trust proxy | Off | On |
| Compression | Off | On |
