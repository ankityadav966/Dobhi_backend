/**
 * ifsc.service.ts
 *
 * Fetches bank name and branch name from the Razorpay public IFSC API:
 *   https://ifsc.razorpay.com/{IFSC}
 *
 * Response shape (subset):
 *   { BANK: "State Bank of India", BRANCH: "Andheri East", ... }
 */

import axios from 'axios';
import logger from '../utils/logger';

const IFSC_API_BASE = 'https://ifsc.razorpay.com';

export interface IFSCDetails {
  bankName:   string | null;
  branchName: string | null;
}

/**
 * Look up bank name and branch name for a given IFSC code.
 *
 * Field mapping (in priority order):
 *   bankName   → BANK | BANKNAME
 *   branchName → BRANCH | CENTRE | DISTRICT | CITY
 *
 * @throws Error with a user-facing message when:
 *   - The IFSC format is invalid
 *   - The IFSC code is not found (404)
 * @returns null when the external API is unreachable / times out
 *   so callers can show a 422 and ask for manual input.
 */
export async function lookupIFSC(ifsc: string): Promise<IFSCDetails | null> {
  // Basic format validation: 4 alpha + 7 alphanumeric (e.g. SBIN0001234)
  const ifscRegex = /^[A-Z]{4}[A-Z0-9]{7}$/i;
  if (!ifscRegex.test(ifsc)) {
    throw new Error(`Invalid IFSC format: "${ifsc}". Expected 11 alphanumeric characters (e.g. SBIN0001234).`);
  }

  try {
    const { data } = await axios.get<Record<string, string>>(
      `${IFSC_API_BASE}/${ifsc.toUpperCase()}`,
      { timeout: 5000 },
    );

    if (!data || typeof data !== 'object') {
      logger.warn('IFSC API returned unexpected shape', { ifsc, data });
      return null;
    }

    console.log('IFSC RAW RESPONSE:', data);

    // Robust field mapping — API response fields vary across banks
    let bankName:   string | null = data.BANK   || data.BANKNAME || null;
    let branchName: string | null = data.BRANCH || data.CENTRE   || data.DISTRICT || data.CITY || null;

    // Last-resort regex fallback for malformed / non-standard responses
    if (!branchName) {
      const raw = JSON.stringify(data);
      const match = raw.match(/"BRANCH"\s*:\s*"([^"]+)"/i);
      if (match) branchName = match[1].trim();
    }

    console.log('IFSC Parsed:', { bankName, branchName });

    return { bankName, branchName };
  } catch (err: any) {
    if (err.response?.status === 404) {
      throw new Error(`IFSC code "${ifsc}" not found. Please verify and try again.`);
    }
    // Network / timeout — caller should return 422
    logger.warn('IFSC API unreachable', { ifsc, err: err.message });
    return null;
  }
}
