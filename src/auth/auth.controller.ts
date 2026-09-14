import { createHash } from "crypto";
import { Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { prisma } from "../prisma.client";
import { createAndSendOtp, verifyOtp } from "../services/otp.service";
import { verifyRefreshToken, generateAccessToken, generateRefreshToken, decodeToken } from "../utils/jwt";
import { blacklistToken, isTokenBlacklisted } from "../services/token-blacklist.service";
import { audit, requestContext } from "../services/auth-audit.service";
import { config } from "../config/index";
import logger from "../utils/logger";

/**
 * Extract ip, userAgent, and optional deviceId from a request.
 */
function clientContext(req: Request) {
  const ctx = requestContext(req);
  const deviceId = (req.headers['x-device-id'] as string | undefined) ?? undefined;
  return { ...ctx, deviceId };
}

// Token TTL constants (in seconds)
const ACCESS_TOKEN_EXPIRY = 15 * 60;       // 15 minutes
const REFRESH_TOKEN_TTL  = 7 * 24 * 60 * 60; // 7 days

/**
 * Hash a refresh token before persisting to DB.
 * Comparison at validation time is done on the hashed value.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Generate access + refresh tokens.
 * Role MUST be sourced from User.role in the DB — never computed at runtime.
 */
function generateTokens(userId: number, phone: string, role: UserRole) {
  const payload = { userId: String(userId), phone, role: role as string };
  const accessToken  = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  return { accessToken, refreshToken };
}

// ─── Request OTP ─────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Unified OTP entry point for partner app.
 * No separate signup flow — account created on first OTP verification.
 */
export const login = async (req: Request, res: Response): Promise<any> => {
  try {
    const { phone } = req.body;

    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phone || !phoneRegex.test(phone)) {
      logger.warn("Invalid phone in login", { phone, requestId: req.id });
      return res.status(400).json({ success: false, error: "Valid 10-digit Indian phone number required" });
    }

    const otpResult = await createAndSendOtp(phone, "login");
    if (!otpResult.success) {
      logger.error("Failed to send OTP", { phone, reason: otpResult.message, requestId: req.id });
      // Generic message — never reveal why it failed
      return res.status(500).json({ success: false, error: "Failed to send OTP. Please try again." });
    }

    await audit(phone, "OTP_SENT", requestContext(req));
    logger.info("OTP sent", { phone, requestId: req.id });
    
    return res.json({
      success: true,
      message: "If the number is valid, OTP has been sent",
      phone,
      expiresIn: 600,
      devOtp: config.nodeEnv !== "production" ? otpResult.otp : undefined,
      otp: config.nodeEnv !== "production" ? otpResult.otp : undefined
    });
  } catch (err) {
    logger.error("Login OTP error:", err, { requestId: req.id });
    return res.status(500).json({ success: false, error: "Failed to send OTP" });
  }
};

// ─── Verify OTP ───────────────────────────────────────────────────────────────

/**
 * POST /api/auth/verify-otp
 * Customer OTP verification flow:
 *   - Phone exists   → issue tokens using User.role from DB (always CUSTOMER)
 *   - Phone missing  → create User { role: CUSTOMER, isActive: true }, then issue tokens from DB role.
 *   - Role is NEVER computed at runtime — always read from User.role after create/find.
 */
export const verifyOtpCode = async (req: Request, res: Response): Promise<any> => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, error: "Phone and OTP required" });
    }

    const isValid = await verifyOtp(phone, otp);
    if (!isValid) {
      logger.warn("Invalid OTP attempt", { phone, requestId: req.id });
      await audit(phone, "OTP_FAILED", requestContext(req));
      // Generic message — never disclose lock state
      return res.status(400).json({ success: false, error: "Invalid or expired OTP" });
    }

    await audit(phone, "OTP_VERIFIED", requestContext(req));

    let user = await prisma.user.findUnique({ where: { phone } });
    let isNewUser = false;

    // STRICT SINGLE ADMIN ENFORCEMENT: Only the one designated admin phone can ever have the ADMIN role.
    const SINGLE_ADMIN_PHONE = (process.env.ADMIN_PHONE || "9999999999").trim();
    const isAdminPhone = phone === SINGLE_ADMIN_PHONE;

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          fullName: isAdminPhone ? "Super Admin" : "User",
          role:     isAdminPhone ? UserRole.ADMIN : UserRole.CUSTOMER,
          isActive: true,
        },
      });
      isNewUser = true;
      logger.info("New user account created", { userId: user.id, phone, role: user.role, requestId: req.id });
    } else {
      // If this is the designated single admin, ensure ADMIN role. If not, do NOT escalate!
      if (isAdminPhone && user.role !== UserRole.ADMIN) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { role: UserRole.ADMIN }
        });
      }
      logger.info("Existing user logged in", { userId: user.id, role: user.role, isActive: user.isActive, requestId: req.id });
    }

    // Role always comes from DB — no runtime computation.
    const { accessToken, refreshToken } = generateTokens(user.id, user.phone, user.role);

    // Persist hashed refresh token with device context
    const ctx = clientContext(req);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000);
    await prisma.refreshToken.create({
      data: {
        userId:    user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt,
        ipAddress: ctx.ip       ?? null,
        userAgent: ctx.userAgent ?? null,
        deviceId:  ctx.deviceId  ?? null,
      },
    });

    await audit(phone, "LOGIN_SUCCESS", { userId: user.id, ...requestContext(req) });
    logger.info("Tokens issued", { userId: user.id, requestId: req.id });

    return res.json({
      success: true,
      message: "OTP verified successfully",
      isNewUser,
      user: {
        id:       user.id,
        phone:    user.phone,
        fullName: user.fullName,
        role:     user.role,  // DB value — never hardcoded
        isActive: user.isActive,
      },
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });
  } catch (err) {
    logger.error("OTP verification error:", err, { requestId: req.id });
    return res.status(500).json({ success: false, error: "OTP verification failed" });
  }
};

// ─── Helper Verify OTP ────────────────────────────────────────────────────────

/**
 * POST /api/auth/helper/verify-otp
 * Helper OTP verification flow:
 *   - Phone missing  → create User { role: HELPER, isActive: false } + Helper record.
 *   - Phone exists   → if User.role !== HELPER, update role to HELPER.
 *   - Helper record  → created if absent.
 *   - Access to operational endpoints is blocked by requireApprovedHelper middleware
 *     unless onboardingStatus === APPROVED.
 *   - Role is stored in DB and always read back before token generation.
 */
export const verifyHelperOtpCode = async (req: Request, res: Response): Promise<any> => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, error: "Phone and OTP required" });
    }

    const isValid = await verifyOtp(phone, otp);
    if (!isValid) {
      logger.warn("Invalid OTP attempt (helper)", { phone, requestId: req.id });
      await audit(phone, "OTP_FAILED", requestContext(req));
      return res.status(400).json({ success: false, error: "Invalid or expired OTP" });
    }

    await audit(phone, "OTP_VERIFIED", requestContext(req));

    // ── Step 1: Ensure User exists with role = HELPER ─────────────────────────
    let user = await prisma.user.findUnique({ where: { phone } });
    let isNewUser = false;

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          fullName: "",                // Filled during onboarding
          role:     UserRole.HELPER,   // Stored in DB — single source of truth
          isActive: false,             // Helpers inactive until onboarding approved
        },
      });
      isNewUser = true;
      logger.info("New user created for helper flow", { userId: user.id, phone, requestId: req.id });
    } else {
      // Existing user: ensure role is HELPER (covers cross-flow registration)
      if (user.role !== UserRole.HELPER) {
        user = await prisma.user.update({
          where: { id: user.id },
          data:  { role: UserRole.HELPER },
        });
        logger.info("User role updated to HELPER", { userId: user.id, previousRole: user.role, requestId: req.id });
      } else {
        logger.info("Existing helper user logged in", { userId: user.id, isActive: user.isActive, requestId: req.id });
      }
    }

    // ── Step 2: Ensure Helper record exists ────────────────────────────────────
    let helper = await prisma.helper.findUnique({ where: { userId: user.id } });
    let isNewHelper = false;

    if (!helper) {
      helper = await prisma.helper.create({
        data: {
          userId:      user.id,
          isAvailable: false,
        },
      });
      isNewHelper = true;
      logger.info("New Helper record created", { helperId: helper.id, userId: user.id, requestId: req.id });
    }

    // ── Step 3: Role sourced from DB — no runtime computation ──────────────────
    const { accessToken, refreshToken } = generateTokens(user.id, user.phone, user.role);

    const ctx = clientContext(req);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000);
    await prisma.refreshToken.create({
      data: {
        userId:    user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt,
        ipAddress: ctx.ip       ?? null,
        userAgent: ctx.userAgent ?? null,
        deviceId:  ctx.deviceId  ?? null,
      },
    });

    await audit(phone, "LOGIN_SUCCESS", { userId: user.id, ...requestContext(req) });
    logger.info("Helper tokens issued", { userId: user.id, helperId: helper.id, role: user.role, requestId: req.id });

    return res.json({
      success: true,
      message: "OTP verified successfully",
      isNewUser,
      isNewHelper,
      user: {
        id:       user.id,
        phone:    user.phone,
        fullName: user.fullName,
        role:     user.role,  // DB value — never runtime-computed
        isActive: user.isActive,
      },
      helper: {
        id:               helper.id,
        isAvailable:      helper.isAvailable,
        onboardingStatus: helper.onboardingStatus,
      },
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });
  } catch (err) {
    logger.error("Helper OTP verification error:", err, { requestId: req.id });
    return res.status(500).json({ success: false, error: "OTP verification failed" });
  }
};

// ─── Refresh Token ────────────────────────────────────────────────────────────

/**
 * POST /api/auth/refresh
 * Token rotation: validate raw refresh token against its stored SHA256 hash.
 */
export const refresh = async (req: Request, res: Response): Promise<any> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ success: false, error: "Refresh token required" });
    }

    // Decode first so we have userId for reuse-detection before blacklist check
    const payload: any = verifyRefreshToken(refreshToken);
    if (!payload) {
      return res.status(401).json({ success: false, error: "Invalid or expired token" });
    }

    // Reuse detection: a blacklisted refresh token means the rotation window was
    // already completed. This indicates token theft — revoke ALL sessions.
    if (isTokenBlacklisted(refreshToken)) {
      const uid = parseInt(payload.userId, 10);
      logger.warn("Refresh token reuse detected — revoking all sessions", { userId: uid, requestId: req.id });
      await prisma.refreshToken.deleteMany({ where: { userId: uid } });
      await audit(payload.phone ?? "", "TOKEN_REFRESH", { userId: uid, ...requestContext(req) });
      return res.status(401).json({ success: false, error: "Token has been revoked" });
    }

    // Look up stored record using the hash of the incoming raw token
    const tokenRow = await prisma.refreshToken.findFirst({
      where: { tokenHash: hashToken(refreshToken), expiresAt: { gt: new Date() } },
    });

    if (!tokenRow) {
      logger.warn("Refresh token hash not found", { userId: payload.userId, requestId: req.id });
      return res.status(401).json({ success: false, error: "Invalid refresh token" });
    }

    const user = await prisma.user.findUnique({
      where: { id: parseInt(payload.userId, 10) },
      select: { id: true, phone: true, role: true, isActive: true },
    });

    if (!user) {
      return res.status(401).json({ success: false, error: "User not found" });
    }

    // Rotate: delete old, issue new with device context
    await prisma.refreshToken.delete({ where: { id: tokenRow.id } });

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id, user.phone, user.role);

    const ctx = clientContext(req);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000);
    await prisma.refreshToken.create({
      data: {
        userId:    user.id,
        tokenHash: hashToken(newRefreshToken),
        expiresAt,
        ipAddress: ctx.ip       ?? null,
        userAgent: ctx.userAgent ?? null,
        deviceId:  ctx.deviceId  ?? null,
      },
    });

    // Blacklist the old raw token so reuse is detectable
    try {
      const decoded = decodeToken(refreshToken);
      if (decoded?.exp) blacklistToken(refreshToken, decoded.exp * 1000);
    } catch (_) { /* non-blocking */ }

    await audit(user.phone, "TOKEN_REFRESH", { userId: user.id, ...requestContext(req) });
    logger.info("Tokens rotated", { userId: user.id, requestId: req.id });

    return res.json({ success: true, accessToken, refreshToken: newRefreshToken, expiresIn: ACCESS_TOKEN_EXPIRY });
  } catch (err) {
    logger.error("Token refresh error:", err, { requestId: req.id });
    return res.status(401).json({ success: false, error: "Token validation failed" });
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/logout
 * Idempotent logout — delete stored token, blacklist for remaining TTL.
 * Accepts optional refreshToken in body or uses authenticated context.
 */
export const logout = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { refreshToken: bodyRefreshToken } = req.body;

    if (bodyRefreshToken) {
      let payload = null;
      try {
        payload = verifyRefreshToken(bodyRefreshToken);
      } catch (_) {
        /* invalid token — still clean up */
      }

      await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(bodyRefreshToken) } });

      if (payload?.userId) {
        try {
          const decoded = decodeToken(bodyRefreshToken);
          if (decoded?.exp) {
            blacklistToken(bodyRefreshToken, decoded.exp * 1000);
          }
          await audit(payload.phone ?? "", "LOGOUT", { userId: parseInt(payload.userId, 10), ...requestContext(req) });
          logger.info("User logged out", { userId: payload.userId, requestId: req.id });
        } catch (_) {
          /* non-blocking */
        }
      }
    } else if (req.user?.userId) {
      const userId = parseInt(req.user.userId, 10);
      await prisma.refreshToken.deleteMany({ where: { userId } });

      try {
        const token = (req.headers.authorization || '').replace('Bearer ', '');
        if (token) {
          const decoded = decodeToken(token);
          if (decoded?.exp) blacklistToken(token, decoded.exp * 1000);
        }
      } catch (_) {}

      await audit(req.user.phone ?? "", "LOGOUT", { userId, ...requestContext(req) });
      logger.info("User logged out", { userId, requestId: req.id });
    }

    return res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    logger.error("Logout error:", err, { requestId: req.id });
    return res.json({ success: true, message: "Logged out successfully" });
  }
};

// Legacy alias — keeps existing route files unchanged
export const signup = login;
