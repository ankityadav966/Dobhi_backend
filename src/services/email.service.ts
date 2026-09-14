import nodemailer from 'nodemailer';
import logger from '../utils/logger';
import { prisma } from '../prisma.client';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  metadata?: Record<string, any>;
  notificationType?: string;
}

// Nodemailer SMTP Transporter
let mailTransporter: nodemailer.Transporter | null = null;
let testAccountInitAttempted = false;

function getTransporter(): nodemailer.Transporter | null {
  if (mailTransporter) return mailTransporter;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (user && pass) {
    mailTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    });
    logger.info(`[Email Service] Configured live SMTP transport via ${host}:${port} (${user})`);
    return mailTransporter;
  }

  return null;
}

/**
 * Send an email notification.
 * Safe service: Dispatches via SMTP if configured, logs output, stores in PlatformNotification.
 * Never throws an uncaught error to prevent crashing API flows.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const { to, subject, html, text, metadata = {}, notificationType = 'GENERAL' } = options;

  try {
    const cleanTo = String(to).trim().toLowerCase();
    
    // Log outbound email event
    logger.info(`[Email Service] Dispatched email to ${cleanTo} | Subject: "${subject}" | Type: ${notificationType}`);

    // Console indicator for local development & testing
    console.log(`\n======================================================`);
    console.log(`📨 [OUTBOUND EMAIL DISPATCHED]`);
    console.log(`To: ${cleanTo}`);
    console.log(`Subject: ${subject}`);
    console.log(`Type: ${notificationType}`);
    if (metadata.otp) {
      console.log(`🔑 SECURE OTP CODE: [ ${metadata.otp} ]`);
    }

    // Attempt real SMTP dispatch if credentials configured
    const transporter = getTransporter();
    let smtpDispatched = false;

    if (transporter) {
      const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_USER || `"GROCERYLAUNDRY Partner" <${process.env.SMTP_USER || 'no-reply@grocerylaundry.com'}>`;
      try {
        const info = await transporter.sendMail({
          from: fromAddress,
          to: cleanTo,
          subject,
          html,
          text: text || subject,
        });
        smtpDispatched = true;
        console.log(`✅ [REAL SMTP DELIVERED] MessageId: ${info.messageId} to ${cleanTo}`);
      } catch (smtpErr: any) {
        console.error(`❌ [SMTP ERROR] Failed to deliver real email to ${cleanTo}:`, smtpErr.message);
        logger.error(`[Email Service] SMTP send error:`, smtpErr);
      }
    } else {
      console.log(`⚠️ [SMTP NOTICE] No SMTP_USER and SMTP_PASS configured in .env.`);
      console.log(`ℹ️ Email logged to database and console. To receive emails in real inbox, set SMTP_USER and SMTP_PASS in Dobhi_backend/.env`);
    }
    console.log(`======================================================\n`);

    // Record notification in database
    await prisma.$executeRawUnsafe(`
      INSERT INTO "PlatformNotification" ("recipientType", "recipientEmail", "title", "message", "type", "metadata", "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, metadata.recipientType || 'USER', cleanTo, subject, text || subject, notificationType, JSON.stringify(metadata)).catch(() => {});

    return true;
  } catch (error: any) {
    logger.error('[Email Service] Failed to send email:', error);
    return false;
  }
}

/**
 * 1. Seller Login OTP Email Template
 */
export async function sendSellerOtpEmail(email: string, otp: string, storeName?: string): Promise<boolean> {
  const cleanEmail = String(email).trim().toLowerCase();
  console.log(`[Email Service] OTP request received for email: ${cleanEmail}`);
  console.log(`[Email Service] OTP generated successfully`);
  console.log(`[Email Service] Sending OTP to: ${cleanEmail}`);
  const subject = `Your Seller Login OTP: ${otp}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="background: #0B2239; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
        <h2 style="color: #38bdf8; margin: 0; font-size: 20px;">Partner Store Portal</h2>
      </div>
      <p style="color: #334155; font-size: 15px; line-height: 1.5;">Hello <strong>${storeName || 'Store Owner'}</strong>,</p>
      <p style="color: #334155; font-size: 15px; line-height: 1.5;">Use the secure 6-digit one-time password (OTP) below to access your Seller Dashboard:</p>
      <div style="background: #f8fafc; border: 2px dashed #0284c7; padding: 18px; border-radius: 8px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f172a;">${otp}</span>
      </div>
      <p style="color: #64748b; font-size: 13px;">• This OTP is valid for <strong>10 minutes</strong>.<br>• For your security, never share this code with anyone.<br>• If you did not request this code, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">© 2026 GROCERYLAUNDRY & Partner Network. All rights reserved.</p>
    </div>
  `;
  const result = await sendEmail({
    to: cleanEmail,
    subject,
    html,
    text: `Your Seller Portal OTP is ${otp}. Valid for 10 minutes.`,
    metadata: { otp, recipientType: 'SELLER', storeName },
    notificationType: 'SELLER_LOGIN_OTP',
  });
  if (result) console.log(`[Email Service] Email sent successfully to: ${cleanEmail}`);
  return result;
}

/**
 * 1b. Seller Registration Verification OTP Email Template
 */
export async function sendSellerRegistrationOtpEmail(email: string, otp: string): Promise<boolean> {
  const cleanEmail = String(email).trim().toLowerCase();
  console.log(`[Email Service] Registration OTP request received for email: ${cleanEmail}`);
  console.log(`[Email Service] OTP generated successfully`);
  console.log(`[Email Service] Sending Registration OTP to: ${cleanEmail}`);
  const subject = `Verify Your Email: ${otp} - Seller Onboarding`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="background: #0B2239; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
        <h2 style="color: #10b981; margin: 0; font-size: 20px;">Seller Onboarding Verification</h2>
      </div>
      <p style="color: #334155; font-size: 15px; line-height: 1.5;">Welcome to <strong>GROCERYLAUNDRY Partner Network</strong>!</p>
      <p style="color: #334155; font-size: 15px; line-height: 1.5;">Please use the 6-digit verification code below to verify your email address and continue your seller registration:</p>
      <div style="background: #f0fdf4; border: 2px dashed #10b981; padding: 18px; border-radius: 8px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #065f46;">${otp}</span>
      </div>
      <p style="color: #64748b; font-size: 13px;">• This OTP is valid for <strong>10 minutes</strong>.<br>• Enter this code on the screen to verify your email and complete store setup.<br>• Never share your verification code.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">© 2026 GROCERYLAUNDRY Partner Network. All rights reserved.</p>
    </div>
  `;
  const result = await sendEmail({
    to: cleanEmail,
    subject,
    html,
    text: `Your Seller Registration verification OTP is ${otp}. Valid for 10 minutes.`,
    metadata: { otp, recipientType: 'SELLER_REGISTRATION' },
    notificationType: 'SELLER_REGISTRATION_OTP',
  });
  if (result) console.log(`[Email Service] Registration Email sent successfully to: ${cleanEmail}`);
  return result;
}

/**
 * 2. Worker Login OTP Email Template
 */
export async function sendWorkerOtpEmail(email: string, otp: string, workerName: string, storeName: string): Promise<boolean> {
  const subject = `Your Delivery Partner OTP: ${otp}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="background: #0f172a; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
        <h2 style="color: #10b981; margin: 0; font-size: 20px;">Worker & Delivery Portal</h2>
      </div>
      <p style="color: #334155; font-size: 15px; line-height: 1.5;">Hello <strong>${workerName}</strong>,</p>
      <p style="color: #334155; font-size: 15px; line-height: 1.5;">You are logging in as a Delivery Partner for <strong>${storeName}</strong>.</p>
      <p style="color: #334155; font-size: 15px; line-height: 1.5;">Your 6-digit access code is:</p>
      <div style="background: #f0fdf4; border: 2px dashed #10b981; padding: 18px; border-radius: 8px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #065f46;">${otp}</span>
      </div>
      <p style="color: #64748b; font-size: 13px;">• Valid for <strong>10 minutes</strong> for a single login session.<br>• Do not disclose this code.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">© 2026 GROCERYLAUNDRY Delivery Operations.</p>
    </div>
  `;
  return sendEmail({
    to: email,
    subject,
    html,
    text: `Hello ${workerName}, your worker login OTP for ${storeName} is ${otp}. Valid for 10 minutes.`,
    metadata: { otp, recipientType: 'WORKER', workerName, storeName },
    notificationType: 'WORKER_LOGIN_OTP',
  });
}

/**
 * 3. Customer Delivery Arrival Verification OTP Email Template
 */
export async function sendCustomerDeliveryOtpEmail(
  email: string,
  otp: string,
  customerName: string,
  orderNumber: string,
  workerName: string
): Promise<boolean> {
  const subject = `Your Order #${orderNumber} Delivery Verification OTP: ${otp}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="background: #0284c7; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px;">Delivery Partner Has Arrived! 🚚</h2>
      </div>
      <p style="color: #334155; font-size: 15px; line-height: 1.5;">Hello <strong>${customerName}</strong>,</p>
      <p style="color: #334155; font-size: 15px; line-height: 1.5;">Your delivery partner <strong>${workerName}</strong> has arrived at your location with order <strong>#${orderNumber}</strong>.</p>
      <p style="color: #334155; font-size: 15px; line-height: 1.5;">Please share this 6-digit delivery verification OTP with the delivery partner upon receiving your package:</p>
      <div style="background: #e0f2fe; border: 2px dashed #0284c7; padding: 20px; border-radius: 8px; text-align: center; margin: 24px 0;">
        <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #0369a1;">${otp}</span>
      </div>
      <p style="color: #64748b; font-size: 13px;">• Only share this OTP after you have verified the delivered items.<br>• Online payment will be confirmed upon OTP validation.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">Thank you for ordering with us!</p>
    </div>
  `;
  return sendEmail({
    to: email,
    subject,
    html,
    text: `Hello ${customerName}, your delivery partner ${workerName} has arrived with Order #${orderNumber}. Share OTP ${otp} to verify delivery.`,
    metadata: { otp, recipientType: 'CUSTOMER', customerName, orderNumber, workerName },
    notificationType: 'CUSTOMER_DELIVERY_OTP',
  });
}

/**
 * 4. New Category Notification to Sellers
 */
export async function sendNewCategoryNotificationToSellers(
  categoryName: string,
  categoryDescription?: string
): Promise<number> {
  try {
    const activeSellers = await prisma.seller.findMany({
      where: {
        status: 'APPROVED',
        email: { not: null },
      },
      select: { id: true, email: true, ownerName: true, businessName: true },
    });

    let sentCount = 0;
    const subject = `New Business Category Available: ${categoryName}`;

    for (const seller of activeSellers) {
      if (!seller.email) continue;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="background: #4f46e5; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
            <h2 style="color: #ffffff; margin: 0; font-size: 20px;">New Platform Category Added 🚀</h2>
          </div>
          <p style="color: #334155; font-size: 15px; line-height: 1.5;">Hello <strong>${seller.ownerName || seller.businessName}</strong>,</p>
          <p style="color: #334155; font-size: 15px; line-height: 1.5;">We are excited to announce that a new business category has just been added to our platform:</p>
          <div style="background: #eef2ff; border: 1px solid #c7d2fe; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #3730a3; margin: 0 0 8px 0; font-size: 18px;">${categoryName}</h3>
            <p style="color: #4b5563; margin: 0; font-size: 14px;">${categoryDescription || 'Expand your offerings or update your profile to reach more customers.'}</p>
          </div>
          <p style="color: #334155; font-size: 15px; line-height: 1.5;">You can now update or expand your business profile in your Seller Dashboard to include this category if relevant to your store.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">© 2026 GROCERYLAUNDRY Partner Network.</p>
        </div>
      `;

      // Non-blocking send
      sendEmail({
        to: seller.email,
        subject,
        html,
        text: `Hello ${seller.ownerName}, a new category "${categoryName}" has been added. You can now select it in your profile.`,
        metadata: { recipientType: 'SELLER', categoryName, sellerId: seller.id },
        notificationType: 'NEW_CATEGORY_NOTIFICATION',
      }).catch(() => {});

      sentCount++;
    }

    logger.info(`[Email Service] Dispatched new category alert for "${categoryName}" to ${sentCount} active sellers.`);
    return sentCount;
  } catch (error: any) {
    logger.error('[Email Service] Error sending new category notification:', error);
    return 0;
  }
}

/**
 * 5. Platform Announcement Broadcast
 */
export async function sendAnnouncementEmail(
  title: string,
  description: string,
  targetUsers: string
): Promise<number> {
  try {
    let recipients: string[] = [];

    if (targetUsers === 'ALL_SELLERS') {
      const sellers = await prisma.seller.findMany({
        where: { email: { not: null } },
        select: { email: true }
      });
      recipients = sellers.map(s => s.email!).filter(Boolean);
    } else if (targetUsers === 'ALL_WORKERS') {
      const workers: any[] = await prisma.$queryRawUnsafe(`SELECT email FROM "SellerWorker" WHERE email IS NOT NULL AND "isActive" = true`);
      recipients = workers.map(w => w.email).filter(Boolean);
    } else if (targetUsers === 'ALL_CUSTOMERS') {
      const users = await prisma.user.findMany({
        where: { email: { not: null }, role: 'CUSTOMER' },
        select: { email: true }
      });
      recipients = users.map(u => u.email!).filter(Boolean);
    } else {
      // Fallback: all registered emails
      const sellers = await prisma.seller.findMany({ where: { email: { not: null } }, select: { email: true } });
      recipients = sellers.map(s => s.email!).filter(Boolean);
    }

    let sent = 0;
    for (const email of recipients) {
      sendEmail({
        to: email,
        subject: `Announcement: ${title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
            <div style="background: #0B2239; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
              <h2 style="color: #38bdf8; margin: 0; font-size: 20px;">Platform Announcement 📢</h2>
            </div>
            <h3 style="color: #0f172a; font-size: 18px;">${title}</h3>
            <p style="color: #334155; font-size: 15px; line-height: 1.6; white-space: pre-line;">${description}</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="color: #94a3b8; font-size: 12px; text-align: center;">© 2026 GROCERYLAUNDRY & Operations.</p>
          </div>
        `,
        text: `${title}\n\n${description}`,
        metadata: { targetUsers, title },
        notificationType: 'PLATFORM_ANNOUNCEMENT',
      }).catch(() => {});
      sent++;
    }

    return sent;
  } catch (err: any) {
    logger.error('[Email Service] Error broadcasting announcement:', err);
    return 0;
  }
}
