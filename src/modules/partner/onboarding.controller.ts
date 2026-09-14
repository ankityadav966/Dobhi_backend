import { Response } from 'express';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { OnboardingStatus } from '@prisma/client';
import { audit, requestContext } from '../../services/auth-audit.service';
import { createRazorpayContactAndFundAccount } from '../../services/razorpay.contact.service';
import { lookupIFSC } from '../../services/ifsc.service';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

// ─── Helper: ensure Helper row exists ────────────────────────────────────────

async function ensureHelper(userId: number) {
  const existing = await prisma.helper.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.helper.create({
    data: { userId, onboardingStatus: OnboardingStatus.PENDING_KYC, isAvailable: false, isOnline: false },
  });
}

// ─── Submit Profile (Step 1) ──────────────────────────────────────────────────

/**
 * POST /api/partner/onboarding/profile
 * Helper only.
 * Body: { gender?, address?, city?, pinCode?, workType?, experienceYears?, serviceIds? }
 *
 * Upserts HelperProfile and (if serviceIds provided) replaces HelperService records.
 * Does NOT advance onboardingStatus — that happens at KYC step.
 */
export const submitProfile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const userId = parseInt(req.user.userId, 10);
    const { fullName, gender, address, city, pinCode, workType, experienceYears, serviceIds, latitude, longitude } = req.body;

    // Validate fullName
    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return res.status(400).json({ success: false, message: 'fullName is required and must not be empty' });
    }
    const trimmedName = fullName.trim();

    const helper = await ensureHelper(userId);

    // Pre-validate service IDs before entering the transaction
    let serviceIdNums: number[] = [];
    if (Array.isArray(serviceIds) && serviceIds.length > 0) {
      serviceIdNums = serviceIds.map((id: any) => parseInt(id, 10));
      if (serviceIdNums.some(isNaN)) {
        return res.status(400).json({ success: false, message: 'All serviceIds must be valid numbers' });
      }

      const found = await prisma.service.findMany({
        where: { id: { in: serviceIdNums } },
        select: { id: true },
      });
      if (found.length !== serviceIdNums.length) {
        const missing = serviceIdNums.filter(id => !found.map(s => s.id).includes(id));
        return res.status(404).json({ success: false, message: `Services not found: ${missing.join(', ')}` });
      }
    }

    // Single atomic transaction: sync User.fullName + upsert HelperProfile + replace HelperService
    const { profile } = await prisma.$transaction(async (tx) => {
      // Sync fullName to User table
      await tx.user.update({
        where: { id: userId },
        data: { fullName: trimmedName },
      });

      // Upsert HelperProfile
      const profile = await tx.helperProfile.upsert({
        where: { helperId: helper.id },
        update: {
          ...(gender          !== undefined && { gender }),
          ...(address         !== undefined && { address }),
          ...(city            !== undefined && { city }),
          ...(pinCode         !== undefined && { pinCode }),
          ...(workType        !== undefined && { workType }),
          ...(experienceYears !== undefined && { experienceYears: Number(experienceYears) }),
          ...(latitude        !== undefined && { latitude: Number(latitude) }),
          ...(longitude       !== undefined && { longitude: Number(longitude) }),
        },
        create: {
          helperId: helper.id,
          gender,
          address,
          city,
          pinCode,
          workType,
          ...(experienceYears !== undefined && { experienceYears: Number(experienceYears) }),
          ...(latitude        !== undefined && { latitude: Number(latitude) }),
          ...(longitude       !== undefined && { longitude: Number(longitude) }),
        },
      });

      // Replace HelperService records inside the same transaction
      if (serviceIdNums.length > 0) {
        await tx.helperService.deleteMany({ where: { helperId: helper.id } });
        await tx.helperService.createMany({
          data: serviceIdNums.map(serviceId => ({ helperId: helper.id, serviceId })),
        });
      }

      return { profile };
    });

    logger.info('Partner profile submitted', { userId, helperId: helper.id });

    return res.json({
      success: true,
      message: 'Profile saved successfully.',
      data: { helperId: helper.id, profile, onboardingStatus: helper.onboardingStatus },
    });
  } catch (error) {
    logger.error('Submit profile error:', error);
    return res.status(500).json({ success: false, message: 'Failed to save profile' });
  }
};

// ─── Submit KYC (Step 2) ──────────────────────────────────────────────────────

/**
 * POST /api/partner/onboarding/kyc
 * Helper only.
 * Body: { selfieUrl?, panUrl?, policeUrl?, panNumber }
 *
 * Stores the KYC document URLs and PAN number.
 * Sets verificationStatus = PENDING_REVIEW for manual admin review.
 * Advances onboardingStatus → PENDING_APPROVAL.
 * Admin does final approval — never auto-approved.
 */
export const submitKyc = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const userId = parseInt(req.user.userId, 10);
    const { selfieUrl, panUrl, policeUrl, panNumber } = req.body;

    const helper = await ensureHelper(userId);

    if (helper.onboardingStatus === OnboardingStatus.APPROVED) {
      return res.status(409).json({ success: false, message: 'Partner is already approved' });
    }

    // ── PAN validation ────────────────────────────────────────────────────────
    if (!panNumber || typeof panNumber !== 'string') {
      return res.status(400).json({ success: false, message: 'PAN number is required' });
    }

    const normalizedPan = panNumber.trim().toUpperCase();
    if (!PAN_REGEX.test(normalizedPan)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PAN format. Must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)',
      });
    }

    // ── Uniqueness check ──────────────────────────────────────────────────────
    const existing = await prisma.helperKyc.findFirst({
      where: { panNumber: normalizedPan, helperId: { not: helper.id } },
      select: { helperId: true },
    });
    if (existing) {
      logger.warn('PAN already registered to another helper', { helperId: helper.id });
      return res.status(409).json({
        success: false,
        message: 'This PAN is already registered to another account',
      });
    }

    // ── Persist doc URLs + set PENDING_REVIEW for manual admin review ─────────
    await prisma.helperKyc.upsert({
      where: { helperId: helper.id },
      update: {
        ...(selfieUrl !== undefined && { selfieUrl }),
        ...(panUrl    !== undefined && { panUrl }),
        ...(policeUrl !== undefined && { policeUrl }),
        panNumber:          normalizedPan,
        verificationStatus: 'PENDING_REVIEW',
        rejectionReason:    null,
      },
      create: {
        helperId:           helper.id,
        selfieUrl,
        panUrl,
        policeUrl,
        panNumber:          normalizedPan,
        verificationStatus: 'PENDING_REVIEW',
      },
    });

    // ── Advance onboarding (never to APPROVED — admin does final approval) ────
    let newStatus = helper.onboardingStatus;
    if (
      helper.onboardingStatus === OnboardingStatus.PENDING_KYC ||
      helper.onboardingStatus === OnboardingStatus.REJECTED
    ) {
      await prisma.helper.update({
        where: { id: helper.id },
        data:  { onboardingStatus: OnboardingStatus.PENDING_APPROVAL },
      });
      newStatus = OnboardingStatus.PENDING_APPROVAL;
    }

    // ── Audit ─────────────────────────────────────────────────────────────────
    const ctx = requestContext(req);
    await audit('', 'KYC_SUBMITTED', { userId, ...ctx });

    logger.info('Partner KYC submitted for manual review', { userId, helperId: helper.id, newStatus });

    return res.json({
      success: true,
      message: 'KYC submitted. Awaiting review.',
      data: {
        helperId:         helper.id,
        onboardingStatus: newStatus,
      },
    });
  } catch (error) {
    logger.error('Submit KYC error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit KYC' });
  }
};

// ─── Submit Bank (Step 3) ─────────────────────────────────────────────────────

/**
 * POST /api/partner/onboarding/bank
 * Helper only.
 * Body: { accountName, accountNumber, ifsc }
 */
export const submitBank = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const userId = parseInt(req.user.userId, 10);
    const { accountName, accountNumber, ifsc } = req.body;

    if (!accountName || !accountNumber || !ifsc) {
      return res.status(400).json({
        success: false,
        message: 'accountName, accountNumber, and ifsc are required',
      });
    }

    if (!/^\d{9,18}$/.test(String(accountNumber))) {
      return res.status(400).json({
        success: false,
        message: 'accountNumber must be 9-18 digits (numbers only)',
      });
    }

    const helper = await ensureHelper(userId);

    // ── Resolve bankName / branchName ─────────────────────────────────────────
    let finalBankName:   string | undefined = (req.body.bankName   as string | undefined)?.trim() || undefined;
    let finalBranchName: string | undefined = (req.body.branchName as string | undefined)?.trim() || undefined;

    if (!finalBankName || !finalBranchName) {
      try {
        const ifscData = await lookupIFSC(ifsc);
        if (!ifscData || !ifscData.bankName || !ifscData.branchName) {
          return res.status(422).json({
            success: false,
            message: 'IFSC lookup failed or returned incomplete data. Please provide bankName and branchName manually.',
          });
        }
        if (!finalBankName)   finalBankName   = ifscData.bankName;
        if (!finalBranchName) finalBranchName = ifscData.branchName;
      } catch (ifscErr: any) {
        return res.status(422).json({ success: false, message: ifscErr.message });
      }
    }

    if (!finalBankName || !finalBranchName) {
      return res.status(422).json({
        success: false,
        message: 'Bank name and branch name are required. Could not resolve from IFSC — please provide them manually.',
      });
    }

    const bank = await prisma.helperBank.upsert({
      where:  { helperId: helper.id },
      update: { accountName, accountNumber, ifsc, bankName: finalBankName, branchName: finalBranchName },
      create: { helperId: helper.id, accountName, accountNumber, ifsc, bankName: finalBankName, branchName: finalBranchName },
    });

    logger.info('Partner bank details submitted', { userId, helperId: helper.id });

    // ── Determine payout setup state ───────────────────────────────────────────
    // If fund account already registered, mark ACTIVE and skip Razorpay calls.
    const existingFundAccountId = (bank as any).razorpayFundAccountId as string | null | undefined;
    const existingPayoutEnabled = (helper as any).payoutEnabled as boolean | undefined;

    if (existingFundAccountId && existingPayoutEnabled) {
      logger.info('Razorpay fund account already registered — skipping creation', {
        helperId:      helper.id,
        fundAccountId: existingFundAccountId,
      });
      return res.json({
        success:          true,
        message:          'Bank details saved.',
        payoutRegistered: true,
        payoutSetupStatus: 'ACTIVE',
        data: { helperId: helper.id, bank },
      });
    }

    // ── Auto-create Razorpay Contact + Fund Account ────────────────────────────
    let payoutRegistered = false;
    let payoutSetupStatus = 'PENDING';

    try {
      const user = await prisma.user.findUnique({
        where:  { id: userId },
        select: { fullName: true, phone: true },
      });

      if (!user) throw new Error(`User not found (userId=${userId})`);

      await createRazorpayContactAndFundAccount({
        helperId:      helper.id,
        fullName:      user.fullName,
        phone:         user.phone,
        accountName,
        accountNumber,
        ifsc,
      });

      // Fetch updated bank to get the persisted fundAccountId
      const updatedBank = await prisma.helperBank.findUnique({
        where:  { helperId: helper.id },
        select: { razorpayFundAccountId: true },
      });

      // Success — enable payout
      await prisma.helper.update({
        where: { id: helper.id },
        data: {
          payoutEnabled:     true,
          payoutSetupStatus: 'ACTIVE',
          payoutRetryCount:  0,
        } as any,
      });

      payoutRegistered  = true;
      payoutSetupStatus = 'ACTIVE';
      logger.info('Razorpay fund account created and payout enabled', { helperId: helper.id });

      return res.json({
        success:           true,
        message:           'Bank details saved and payout account created',
        payoutRegistered:  true,
        payoutSetupStatus: 'ACTIVE',
        data: {
          razorpayFundAccountId: updatedBank?.razorpayFundAccountId ?? null,
        },
      });
    } catch (rzpErr: any) {
      // Non-fatal: bank details are persisted; retry cron will register fund account later
      logger.error(
        'Razorpay contact/fund account creation failed — payout registration deferred',
        {
          helperId: helper.id,
          message:  rzpErr?.message,
          stack:    rzpErr?.stack,
          response: rzpErr?.response?.data,
        },
      );

      await prisma.helper.update({
        where: { id: helper.id },
        data: {
          payoutEnabled:     false,
          payoutSetupStatus: 'PENDING',
          payoutRetryCount:  0,
        } as any,
      }).catch((dbErr: unknown) =>
        logger.error('Failed to persist PENDING payout setup status', { helperId: helper.id, error: dbErr }),
      );

      payoutRegistered  = false;
      payoutSetupStatus = 'PENDING';
    }

    return res.json({
      success:           true,
      message:           'Bank details saved.',
      payoutRegistered,
      payoutSetupStatus,
      data: { helperId: helper.id, bank },
    });
  } catch (error) {
    logger.error('Submit bank error:', error);
    return res.status(500).json({ success: false, message: 'Failed to save bank details' });
  }
};

// ─── Approve Onboarding ───────────────────────────────────────────────────────

/**
 * POST /api/partner/onboarding/approve/:helperId
 * Admin only.
 * Sets onboardingStatus = APPROVED, isAvailable = true, User.isActive = true.
 */
export const approveOnboarding = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const helperIdNum = parseInt(req.params.helperId, 10);
    if (isNaN(helperIdNum)) {
      return res.status(400).json({ success: false, message: 'Invalid helper ID' });
    }

    const helper = await prisma.helper.findUnique({
      where: { id: helperIdNum },
      select: { id: true, userId: true, onboardingStatus: true },
    });
    if (!helper) return res.status(404).json({ success: false, message: 'Helper not found' });

    if (helper.onboardingStatus === OnboardingStatus.APPROVED) {
      return res.status(409).json({ success: false, message: 'Partner is already approved' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedHelper = await tx.helper.update({
        where: { id: helperIdNum },
        data: { onboardingStatus: OnboardingStatus.APPROVED, isAvailable: true },
      });

      await tx.user.update({
        where: { id: helper.userId },
        data: { isActive: true },
      });

      // Mark KYC as verified
      await tx.helperKyc.updateMany({
        where: { helperId: helperIdNum },
        data: { isVerified: true, verifiedAt: new Date(), rejectionReason: null },
      });

      return updatedHelper;
    });

    logger.info('Partner onboarding approved', { helperId: helperIdNum, userId: helper.userId });

    return res.json({
      success: true,
      message: 'Partner approved and account activated',
      data: {
        helperId:         result.id,
        userId:           helper.userId,
        onboardingStatus: result.onboardingStatus,
        isAvailable:      result.isAvailable,
      },
    });
  } catch (error) {
    logger.error('Approve onboarding error:', error);
    return res.status(500).json({ success: false, message: 'Failed to approve onboarding' });
  }
};

// ─── Reject Onboarding ────────────────────────────────────────────────────────

/**
 * POST /api/partner/onboarding/reject/:helperId
 * Admin only. Sets onboardingStatus = REJECTED, stores reason in HelperKyc.
 * Body: { reason? }
 */
export const rejectOnboarding = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const helperIdNum = parseInt(req.params.helperId, 10);
    if (isNaN(helperIdNum)) {
      return res.status(400).json({ success: false, message: 'Invalid helper ID' });
    }

    const helper = await prisma.helper.findUnique({
      where: { id: helperIdNum },
      select: { id: true, onboardingStatus: true },
    });
    if (!helper) return res.status(404).json({ success: false, message: 'Helper not found' });

    const reason: string | undefined = req.body?.reason;

    await prisma.$transaction(async (tx) => {
      await tx.helper.update({
        where: { id: helperIdNum },
        data: { onboardingStatus: OnboardingStatus.REJECTED },
      });

      if (reason) {
        await tx.helperKyc.updateMany({
          where: { helperId: helperIdNum },
          data: { isVerified: false, rejectionReason: reason },
        });
      }
    });

    logger.info('Partner onboarding rejected', { helperId: helperIdNum, reason });

    return res.json({
      success: true,
      message: 'Partner onboarding rejected',
      data: { helperId: helperIdNum, onboardingStatus: OnboardingStatus.REJECTED, reason: reason ?? null },
    });
  } catch (error) {
    logger.error('Reject onboarding error:', error);
    return res.status(500).json({ success: false, message: 'Failed to reject onboarding' });
  }
};

// ─── Get Onboarding Status ────────────────────────────────────────────────────

/**
 * GET /api/partner/onboarding/status
 * Returns the authenticated partner's full onboarding state.
 */
export const getOnboardingStatus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const userId = parseInt(req.user.userId, 10);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, isActive: true },
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const helper = await prisma.helper.findUnique({
      where: { userId },
      select: {
        id:               true,
        onboardingStatus: true,
        isAvailable:      true,
        createdAt:        true,
        profile:          true,
        kyc:              { select: { selfieUrl: true, panUrl: true, policeUrl: true, panNumber: true, isVerified: true, verifiedAt: true, rejectionReason: true } },
        bank:             { select: { accountName: true, accountNumber: true, ifsc: true, isVerified: true } },
        helperServices: {
          select: {
            serviceId: true,
            service: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Compute currentStep strictly by data presence (per requirements)
    let currentStep = 2;
    if (!helper) {
      currentStep = 2;
    } else if (!helper.profile) {
      currentStep = 2;
    } else if (!helper.kyc) {
      currentStep = 3;
    } else if (!helper.bank) {
      currentStep = 4;
    } else {
      currentStep = 5;
    }
    if (helper && helper.onboardingStatus === OnboardingStatus.APPROVED) {
      currentStep = 6;
    }

    return res.json({
      success: true,
      data: {
        user: { fullName: user.fullName, isActive: user.isActive },
        helper: helper
          ? {
              helperId:         helper.id,
              onboardingStatus: helper.onboardingStatus,
              isAvailable:      helper.isAvailable,
              profile:          helper.profile,
              kyc:              helper.kyc,
              bank:             helper.bank,
              services:         helper.helperServices.map(hs => hs.service),
              submittedAt:      helper.createdAt,
            }
          : null,
        currentStep,
      },
    });
  } catch (error) {
    logger.error('Get onboarding status error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch onboarding status' });
  }
};
