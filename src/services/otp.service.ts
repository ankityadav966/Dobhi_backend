import axios, { AxiosError } from "axios";
import twilio from "twilio";
import { config } from "../config/index";
import logger from "../utils/logger";
import { getRedis } from "./redis.service";
import {
  isOtpLocked,
  recordOtpFailure,
  recordOtpSuccess,
  checkResendAllowed,
  recordResendSent,
} from "./otp-security.service";

/**
 * MSG91 OTP API base URL.
 */
const MSG91_OTP_BASE = "https://control.msg91.com/api/v5/otp";

// In-memory OTP storage fallback (when Redis is down or for high availability)
const inMemoryOtpStore = new Map<string, { otp: string; expiresAt: number }>();

/**
 * Strip non-digits, remove leading 91 country code if present.
 */
function normalizePhoneNumber(phone: string): string {
  let normalized = phone.replace(/[^0-9]/g, "");
  if (normalized.startsWith("91") && normalized.length === 12) {
    normalized = normalized.slice(2);
  }
  return normalized;
}

/**
 * Prepend Indian country code for MSG91 / Twilio mobile parameter.
 */
function withCountryCode(phone: string): string {
  return `91${phone}`;
}

/**
 * Get configured Twilio client instance
 */
function getTwilioClient(): twilio.Twilio | null {
  const { accountSid, apiKeySid, authToken } = config.otp.twilio;
  if (!authToken) return null;

  try {
    if (accountSid?.startsWith("AC") && apiKeySid?.startsWith("SK")) {
      return twilio(apiKeySid, authToken, { accountSid });
    }
    if (accountSid?.startsWith("AC")) {
      return twilio(accountSid, authToken);
    }
    if (apiKeySid?.startsWith("AC")) {
      return twilio(apiKeySid, authToken);
    }
  } catch (err: any) {
    logger.error("Failed to initialize Twilio client", { error: err.message });
  }

  return null;
}

/**
 * Store generated OTP in Redis and in-memory fallback
 */
async function storeOtp(phone: string, otp: string): Promise<void> {
  const ttlSec = config.otp.expire || 600;
  inMemoryOtpStore.set(phone, {
    otp,
    expiresAt: Date.now() + ttlSec * 1000,
  });

  try {
    const redis = await getRedis();
    if (redis) {
      await redis.setEx(`otp:${phone}`, ttlSec, otp);
    }
  } catch (err: any) {
    logger.warn("Could not save OTP to Redis, using in-memory store", { error: err.message });
  }
}

/**
 * Retrieve stored OTP
 */
async function getStoredOtp(phone: string): Promise<string | null> {
  try {
    const redis = await getRedis();
    if (redis) {
      const val = await redis.get(`otp:${phone}`);
      if (val) return val;
    }
  } catch (err: any) {
    logger.warn("Could not fetch OTP from Redis", { error: err.message });
  }

  const memoryRecord = inMemoryOtpStore.get(phone);
  if (memoryRecord) {
    if (Date.now() < memoryRecord.expiresAt) {
      return memoryRecord.otp;
    }
    inMemoryOtpStore.delete(phone);
  }

  return null;
}

/**
 * Remove stored OTP after successful verification
 */
async function clearStoredOtp(phone: string): Promise<void> {
  inMemoryOtpStore.delete(phone);
  try {
    const redis = await getRedis();
    if (redis) {
      await redis.del(`otp:${phone}`);
    }
  } catch {}
}

/**
 * Send OTP via Twilio SMS
 */
async function sendViaTwilio(
  phone: string,
  otp: string
): Promise<{ success: boolean; message: string }> {
  const client = getTwilioClient();
  const from = config.otp.twilio.phoneNumber;

  if (!client || !from) {
    logger.warn("Twilio client or phone number not properly configured", {
      hasClient: !!client,
      hasFrom: !!from,
    });
    return { success: false, message: "Twilio not fully configured" };
  }

  const formattedFrom = from.startsWith("+") || from.startsWith("MG") ? from : `+91${from}`;
  const formattedTo = `+91${phone}`;

  try {
    const message = await client.messages.create({
      body: `Your verification code is ${otp}. Valid for ${Math.floor(config.otp.expire / 60)} minutes.`,
      from: formattedFrom,
      to: formattedTo,
    });

    logger.info("OTP sent via Twilio", { phone, messageSid: message.sid });
    return { success: true, message: "OTP sent successfully via Twilio" };
  } catch (error: any) {
    logger.error("Twilio send error", {
      phone,
      code: error.code,
      error: error.message,
    });
    return { success: false, message: error.message || "Failed to send OTP via Twilio" };
  }
}

/**
 * Send OTP via MSG91
 */
async function sendViaMsg91(
  phone: string,
  type: "signup" | "login"
): Promise<{ success: boolean; message: string }> {
  if (!config.otp.msg91.authKey || !config.otp.msg91.templateId) {
    return { success: false, message: "MSG91 not configured" };
  }

  try {
    const response = await axios.post(
      MSG91_OTP_BASE,
      {
        template_id: config.otp.msg91.templateId,
        mobile: withCountryCode(phone),
      },
      {
        headers: {
          authkey: config.otp.msg91.authKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data?.type === "success" || response.status === 200) {
      logger.info("OTP sent via MSG91", { phone, type });
      return { success: true, message: "OTP sent successfully" };
    }

    return { success: false, message: "Failed to send OTP via MSG91" };
  } catch (error: any) {
    const axiosError = error as AxiosError;
    logger.error("MSG91 OTP send error", {
      phone,
      status: axiosError.response?.status,
      error: axiosError.response?.data ?? axiosError.message,
    });
    return { success: false, message: "Failed to send OTP via MSG91" };
  }
}

/**
 * Trigger OTP generation and delivery
 */
export async function createAndSendOtp(
  phone: string,
  type: "signup" | "login"
): Promise<{ success: boolean; message: string; otp?: string }> {
  const normalizedPhone = normalizePhoneNumber(phone);

  // Generate dynamic 4-digit OTP matching admin input length
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  await storeOtp(normalizedPhone, otp);

  // In development, log OTP prominently for immediate access
  logger.info(`\n======================================================\n🔑 [DYNAMIC OTP GENERATED] Phone: ${normalizedPhone} -> OTP: ${otp}\n======================================================\n`);

  const provider = config.otp.provider;

  if (provider === "twilio" || config.otp.twilio.authToken) {
    const twilioResult = await sendViaTwilio(normalizedPhone, otp);
    if (twilioResult.success) {
      await recordResendSent(normalizedPhone);
      return { success: true, message: "OTP sent successfully", otp };
    }
    logger.warn("Twilio send failed, checking MSG91 fallback", { twilioError: twilioResult.message });
  }

  if (config.otp.msg91.authKey) {
    const msg91Result = await sendViaMsg91(normalizedPhone, type);
    if (msg91Result.success) {
      await recordResendSent(normalizedPhone);
      return { success: true, message: "OTP sent successfully", otp };
    }
  }

  // In non-production, return the real generated OTP
  if (config.nodeEnv !== "production") {
    await recordResendSent(normalizedPhone);
    return { success: true, message: "OTP generated successfully", otp };
  }

  return { success: false, message: "Failed to send OTP. Please try again." };
}

/**
 * Verify an OTP
 */
export async function verifyOtp(phone: string, otp: string): Promise<boolean> {
  const normalizedPhone = normalizePhoneNumber(phone);

  // Allow standard dev OTP in non-production environments
  if (config.nodeEnv !== "production" && (otp.trim() === "1234" || otp.trim() === "123456")) {
    logger.info("Dev master OTP accepted", { phone: normalizedPhone });
    await recordOtpSuccess(normalizedPhone);
    return true;
  }

  // 1. Brute-force protection check
  const locked = await isOtpLocked(normalizedPhone);
  if (locked) {
    logger.warn("OTP verification blocked — phone locked", { phone: normalizedPhone });
    return false;
  }

  // 2. Check stored OTP (Twilio / backend generated)
  const storedOtp = await getStoredOtp(normalizedPhone);
  if (storedOtp) {
    if (storedOtp === otp.trim()) {
      logger.info("OTP verified successfully from store", { phone: normalizedPhone });
      await clearStoredOtp(normalizedPhone);
      await recordOtpSuccess(normalizedPhone);
      return true;
    }
  }

  // 3. Check MSG91 verification if configured
  if (config.otp.msg91.authKey) {
    try {
      const response = await axios.get(`${MSG91_OTP_BASE}/verify`, {
        params: {
          mobile: withCountryCode(normalizedPhone),
          otp,
        },
        headers: {
          authkey: config.otp.msg91.authKey,
        },
      });

      if (response.data?.type === "success") {
        logger.info("OTP verified via MSG91", { phone: normalizedPhone });
        await recordOtpSuccess(normalizedPhone);
        return true;
      }

      const responseMessage: string = response.data?.message ?? "";
      if (responseMessage.toLowerCase().includes("already verified")) {
        logger.info("OTP already verified via MSG91", { phone: normalizedPhone });
        await recordOtpSuccess(normalizedPhone);
        return true;
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      logger.error("MSG91 OTP verify error", {
        phone: normalizedPhone,
        status: axiosError.response?.status,
        error: axiosError.response?.data ?? axiosError.message,
      });
    }
  }

  logger.warn("Invalid OTP attempt", { phone: normalizedPhone });
  await recordOtpFailure(normalizedPhone);
  return false;
}

/**
 * Resend OTP
 */
export async function resendOtp(
  phone: string,
  type: "signup" | "login"
): Promise<{ success: boolean; message: string }> {
  const normalizedPhone = normalizePhoneNumber(phone);

  const { allowed, reason } = await checkResendAllowed(normalizedPhone);
  if (!allowed) {
    logger.warn("OTP resend blocked", { phone: normalizedPhone, reason });
    return { success: false, message: "Please wait before requesting another OTP" };
  }

  return createAndSendOtp(phone, type);
}
