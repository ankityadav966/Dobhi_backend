import { prisma } from '../../prisma.client';

export interface BankDetailsInput {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName?: string;
}

/**
 * Get bank details for a helper
 */
export async function getBankDetails(helperId: number) {
  const bankDetails = await prisma.helperBank.findUnique({
    where: { helperId },
  });

  if (!bankDetails) {
    return null;
  }

  // Mask account number for security (show last 4 digits only)
  const maskedAccountNumber = `****${bankDetails.accountNumber.slice(-4)}`;

  return {
    accountHolderName: bankDetails.accountName,
    accountNumber: maskedAccountNumber,
    ifscCode: bankDetails.ifsc,
    bankName: bankDetails.accountName.split(' ')[0],
    branchName: null,
  };
}

/**
 * Upsert (create or update) bank details for a helper
 * Single bank account per helper
 */
export async function upsertBankDetails(helperId: number, data: BankDetailsInput) {
  const bankDetails = await prisma.helperBank.upsert({
    where: { helperId },
    update: {
      accountName: data.accountHolderName,
      accountNumber: data.accountNumber,
      ifsc: data.ifscCode,
    },
    create: {
      helperId,
      accountName: data.accountHolderName,
      accountNumber: data.accountNumber,
      ifsc: data.ifscCode,
    },
  });

  // Mask account number for security in response
  const maskedAccountNumber = `****${bankDetails.accountNumber.slice(-4)}`;

  return {
    accountHolderName: bankDetails.accountName,
    accountNumber: maskedAccountNumber,
    ifscCode: bankDetails.ifsc,
    bankName: data.bankName,
    branchName: data.branchName || null,
  };
}
