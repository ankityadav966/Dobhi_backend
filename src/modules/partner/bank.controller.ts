/**
 * bank.controller.ts
 *
 * Partner bank detail endpoints.
 *
 * Routes:
 *   GET  /api/partner/bank-details   — fetch current bank record
 *   POST /api/partner/bank-details   — create / register bank details
 *   PUT  /api/partner/bank-details   — update existing bank details
 *
 * Auth: requireApprovedHelper
 *
 * IFSC auto-fill:
 *   When bankName / branchName are omitted the controller calls the Razorpay
 *   public IFSC API to resolve them.  If the external API is unreachable the
 *   fields are stored as null (fallback to manual input on the next PUT).
 */

import { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';
import { lookupIFSC } from '../../services/ifsc.service';

// ─── Shared helper resolver ───────────────────────────────────────────────────

async function resolveHelper(userId: number) {
  return prisma.helper.findUnique({
    where:  { userId },
    select: { id: true },
  });
}

// ─── Shared response shape ────────────────────────────────────────────────────

function bankPayload(bank: {
  accountName:           string;
  accountNumber:         string;
  ifsc:                  string;
  bankName:              string | null;
  branchName:            string | null;
  isVerified:            boolean;
  razorpayFundAccountId: string | null;
}) {
  return {
    accountName:           bank.accountName,
    accountNumber:         bank.accountNumber,
    ifsc:                  bank.ifsc,
    bankName:              bank.bankName ?? null,
    branchName:            bank.branchName ?? null,
    isVerified:            bank.isVerified,
    razorpayFundAccountId: bank.razorpayFundAccountId ?? null,
  };
}

// ─── Validation chains ────────────────────────────────────────────────────────

export const validateCreateBankDetails = [
  body('accountName')
    .notEmpty().withMessage('accountName is required'),
  body('accountNumber')
    .notEmpty().withMessage('accountNumber is required')
    .matches(/^\d{9,18}$/).withMessage('accountNumber must be 9-18 digits (numbers only)'),
  body('ifsc')
    .notEmpty().withMessage('ifsc is required')
    .matches(/^[A-Z]{4}[A-Z0-9]{7}$/i).withMessage('Invalid IFSC format (e.g. SBIN0001234)'),
  body('bankName').optional().isString(),
  body('branchName').optional().isString(),
];

export const validateUpdateBankDetails = [
  body('accountName').optional().notEmpty().withMessage('accountName cannot be blank'),
  body('accountNumber')
    .optional()
    .matches(/^\d{9,18}$/).withMessage('accountNumber must be 9-18 digits (numbers only)'),
  body('ifsc')
    .optional()
    .matches(/^[A-Z]{4}[A-Z0-9]{7}$/i).withMessage('Invalid IFSC format (e.g. SBIN0001234)'),
  body('bankName').optional().isString(),
  body('branchName').optional().isString(),
];

// ─── GET /api/partner/bank-details ───────────────────────────────────────────

/**
 * Returns the HelperBank record for the authenticated helper.
 * Responds with { success: true, data: null } if no bank has been registered yet.
 */
export async function getPartnerBankDetailsHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const userId = parseInt(req.user.userId, 10);
    const helper = await resolveHelper(userId);
    if (!helper) { res.status(403).json({ success: false, message: 'Helper profile not found' }); return; }

    const bank = await prisma.helperBank.findUnique({ where: { helperId: helper.id } });

    if (!bank) { res.status(200).json({ success: true, data: null }); return; }

    logger.info('Fetched bank details', { helperId: helper.id });
    res.status(200).json({ success: true, data: bankPayload(bank) });
  } catch (err) {
    logger.error('getPartnerBankDetailsHandler error', { err });
    res.status(500).json({ success: false, message: 'Failed to fetch bank details' });
  }
}

// ─── POST /api/partner/bank-details ──────────────────────────────────────────

/**
 * Create / register bank details for the first time.
 *
 * Body:
 *   accountName    — required
 *   accountNumber  — required
 *   ifsc           — required
 *   bankName       — optional (auto-fetched from IFSC API if omitted)
 *   branchName     — optional (auto-fetched from IFSC API if omitted)
 */
export async function createPartnerBankDetailsHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ success: false, errors: errors.array() });
      return;
    }

    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const userId = parseInt(req.user.userId, 10);
    const helper = await resolveHelper(userId);
    if (!helper) { res.status(403).json({ success: false, message: 'Helper profile not found' }); return; }

    // Prevent duplicate registration
    const existing = await prisma.helperBank.findUnique({ where: { helperId: helper.id } });
    if (existing) {
      res.status(409).json({ success: false, message: 'Bank details already registered. Use PUT to update.' });
      return;
    }

    const { accountName, accountNumber, ifsc } = req.body as {
      accountName:  string;
      accountNumber: string;
      ifsc:          string;
    };

    // Capture user-provided values — these always take priority
    let finalBankName:   string | undefined = (req.body.bankName   as string | undefined)?.trim() || undefined;
    let finalBranchName: string | undefined = (req.body.branchName as string | undefined)?.trim() || undefined;

    // Only call IFSC API when at least one field is missing
    if (!finalBankName || !finalBranchName) {
      try {
        const ifscData = await lookupIFSC(ifsc);
        if (!ifscData || !ifscData.bankName || !ifscData.branchName) {
          // API unreachable or returned incomplete data — refuse to save nulls
          res.status(422).json({
            success: false,
            message: 'IFSC lookup failed or returned incomplete data. Please provide bankName and branchName manually.',
          });
          return;
        }
        // Fill only the fields the user didn't supply
        if (!finalBankName)   finalBankName   = ifscData.bankName;
        if (!finalBranchName) finalBranchName = ifscData.branchName;
      } catch (ifscErr: any) {
        res.status(422).json({ success: false, message: ifscErr.message });
        return;
      }
    }

    // Final guard — never save null values
    if (!finalBankName || !finalBranchName) {
      res.status(422).json({
        success: false,
        message: 'Bank name and branch name are required. Could not resolve them from the IFSC code — please provide them manually.',
      });
      return;
    }

    const bank = await prisma.helperBank.create({
      data: {
        helperId:      helper.id,
        accountName:   accountName.trim(),
        accountNumber: accountNumber.trim(),
        ifsc:          ifsc.toUpperCase().trim(),
        bankName:      finalBankName,
        branchName:    finalBranchName,
      },
    });

    logger.info('Bank details created', { helperId: helper.id });
    res.status(201).json({ success: true, data: bankPayload(bank) });
  } catch (err) {
    logger.error('createPartnerBankDetailsHandler error', { err });
    res.status(500).json({ success: false, message: 'Failed to save bank details' });
  }
}

// ─── PUT /api/partner/bank-details ───────────────────────────────────────────

/**
 * Update existing bank details.
 * Passing a new IFSC automatically re-fetches bankName / branchName unless
 * the caller also supplies those fields explicitly.
 *
 * Body (all optional):
 *   accountName, accountNumber, ifsc, bankName, branchName
 */
export async function updatePartnerBankDetailsHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ success: false, errors: errors.array() });
      return;
    }

    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const userId = parseInt(req.user.userId, 10);
    const helper = await resolveHelper(userId);
    if (!helper) { res.status(403).json({ success: false, message: 'Helper profile not found' }); return; }

    const existing = await prisma.helperBank.findUnique({ where: { helperId: helper.id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'No bank details found. Use POST to create.' });
      return;
    }

    const { accountName, accountNumber } = req.body as {
      accountName?:  string;
      accountNumber?: string;
    };
    const { ifsc } = req.body as { ifsc?: string };

    // Capture user-provided values — these always take priority over API response
    let finalBankName:   string | undefined = (req.body.bankName   as string | undefined)?.trim() || undefined;
    let finalBranchName: string | undefined = (req.body.branchName as string | undefined)?.trim() || undefined;

    const ifscChanged = !!ifsc && ifsc.toUpperCase().trim() !== existing.ifsc;
    // Use effective IFSC: incoming if changed, otherwise existing
    const effectiveIfsc = ifsc ?? existing.ifsc;

    // Trigger IFSC lookup when:
    //   - existing record has null bankName/branchName (heal stale nulls), OR
    //   - IFSC has changed and we need fresh data
    // Only runs if the user hasn't already supplied both fields manually.
    if ((!existing.bankName || !existing.branchName || ifscChanged) && (!finalBankName || !finalBranchName)) {
      try {
        const ifscData = await lookupIFSC(effectiveIfsc);
        if (!ifscData || !ifscData.bankName || !ifscData.branchName) {
          res.status(422).json({
            success: false,
            message: 'IFSC lookup failed or returned incomplete data. Please provide bankName and branchName manually.',
          });
          return;
        }
        // Fill only the fields the user didn't supply
        if (!finalBankName)   finalBankName   = ifscData.bankName;
        if (!finalBranchName) finalBranchName = ifscData.branchName;
      } catch (ifscErr: any) {
        res.status(422).json({ success: false, message: ifscErr.message });
        return;
      }
    }

    // Final guard — never save null values (applies regardless of trigger path)
    if (finalBankName === undefined && !existing.bankName) {
      res.status(422).json({
        success: false,
        message: 'Bank name is required. Could not resolve it from IFSC — please provide it manually.',
      });
      return;
    }
    if (finalBranchName === undefined && !existing.branchName) {
      res.status(422).json({
        success: false,
        message: 'Branch name is required. Could not resolve it from IFSC — please provide it manually.',
      });
      return;
    }

    // Build the partial update — only touch supplied fields
    const updateData: Record<string, unknown> = {};
    if (accountName   !== undefined) updateData.accountName   = accountName.trim();
    if (accountNumber !== undefined) updateData.accountNumber = accountNumber.trim();
    if (ifsc          !== undefined) updateData.ifsc          = ifsc.toUpperCase().trim();
    if (finalBankName   !== undefined) updateData.bankName   = finalBankName;
    if (finalBranchName !== undefined) updateData.branchName = finalBranchName;

    // Re-verify if any financial field changed
    if (accountNumber || ifsc) updateData.isVerified = false;

    const bank = await prisma.helperBank.update({
      where: { helperId: helper.id },
      data:  updateData,
    });

    logger.info('Bank details updated', { helperId: helper.id, changed: Object.keys(updateData) });
    res.status(200).json({ success: true, data: bankPayload(bank) });
  } catch (err) {
    logger.error('updatePartnerBankDetailsHandler error', { err });
    res.status(500).json({ success: false, message: 'Failed to update bank details' });
  }
}
