/**
 * razorpay.contact.service.ts
 *
 * Creates a Razorpay Contact + Fund Account for a helper during bank onboarding.
 * Stores the resulting fund_account_id in HelperBank.razorpayFundAccountId.
 *
 * Called from: onboarding.controller.ts → submitBank
 */

import axios from 'axios';
import { prisma } from '../prisma.client';
import logger from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RazorpayContactParams {
  helperId:      number;
  fullName:      string;
  phone:         string;
  email?:        string;
  accountName:   string;
  accountNumber: string;
  ifsc:          string;
}

// ─── Main exported function ───────────────────────────────────────────────────

/**
 * Creates a Razorpay Contact and Fund Account for the given helper.
 * Updates HelperBank.razorpayFundAccountId with the resulting fund_account_id.
 *
 * @returns The Razorpay fund_account_id string (e.g. "fa_XXXXXXXXXXXX")
 * @throws  On any Razorpay API error — caller must handle
 */
export async function createRazorpayContactAndFundAccount(
  params: RazorpayContactParams,
): Promise<string> {
  const { helperId, fullName, phone, email, accountName, accountNumber, ifsc } =
    params;

  const razorpayAuth = {
    username: process.env.RAZORPAY_KEY_ID!,
    password: process.env.RAZORPAY_KEY_SECRET!,
  };

  // ── Step 1: Create Contact ─────────────────────────────────────────────────

  const contactPayload: Record<string, unknown> = {
    name:         fullName,
    contact:      phone,
    type:         'vendor',
    reference_id: `helper_${helperId}`,
    notes:        { helperId: String(helperId) },
  };
  if (email) contactPayload.email = email;

  logger.info('Creating Razorpay contact', { helperId });
  const contactResponse = await axios.post(
    'https://api.razorpay.com/v1/contacts',
    contactPayload,
    { auth: razorpayAuth },
  );
  const contact: { id: string } = contactResponse.data;

  if (!contact?.id) {
    throw new Error(`Razorpay contact creation returned no id (helperId=${helperId})`);
  }
  logger.info('Razorpay contact created', { helperId, contactId: contact.id });

  // ── Step 2: Create Fund Account ────────────────────────────────────────────

  const fundAccountPayload = {
    contact_id:   contact.id,
    account_type: 'bank_account',
    bank_account: {
      name:           accountName,
      ifsc:           ifsc.toUpperCase(),
      account_number: accountNumber,
    },
  };

  logger.info('Creating Razorpay fund account', {
    helperId,
    contactId: contact.id,
  });
  const fundAccountResponse = await axios.post(
    'https://api.razorpay.com/v1/fund_accounts',
    fundAccountPayload,
    { auth: razorpayAuth },
  );
  const fundAccount: { id: string } = fundAccountResponse.data;

  if (!fundAccount?.id) {
    throw new Error(
      `Razorpay fund account creation returned no id (helperId=${helperId}, contactId=${contact.id})`,
    );
  }
  logger.info('Razorpay fund account created', {
    helperId,
    fundAccountId: fundAccount.id,
  });

  // ── Step 3: Persist fund account ID ───────────────────────────────────────

  await prisma.helperBank.update({
    where: { helperId },
    data:  { razorpayFundAccountId: fundAccount.id, isVerified: true } as any,
  });

  logger.info('razorpayFundAccountId saved to HelperBank and isVerified set', {
    helperId,
    fundAccountId: fundAccount.id,
  });

  return fundAccount.id;
}
