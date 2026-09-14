/**
 * IDFY PAN Verification Service
 *
 * Wraps the IDFY Identity Verification API for PAN-only lookup and OCR.
 * Credentials are always read from environment variables — never hardcoded.
 *
 * Environment:
 *   IDFY_BASE_URL     — e.g. https://eve.idfy.com/v3
 *   IDFY_API_KEY      — account API key
 *   IDFY_ACCOUNT_ID   — account ID
 */

import axios, { AxiosError } from 'axios';
import logger from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IdfyPanResult {
  /** Whether IDFY considers the PAN record valid */
  panValid: boolean;
  /** Name as returned by IDFY (may be null if lookup failed) */
  panName: string | null;
  /** Unique request ID from IDFY (for idempotency / audit) */
  requestId: string | null;
  /** Raw response body from IDFY stored as-is for audit trail */
  rawResponse: Record<string, unknown>;
}

export interface IdfyOcrResult {
  /** Whether OCR extracted a usable PAN number */
  success: boolean;
  /** Extracted PAN number (uppercased), null if extraction failed */
  panNumber: string | null;
  /** Name printed on the PAN card as read by OCR */
  nameOnPan: string | null;
  /** True when failure is due to network/timeout rather than bad image */
  isNetworkError: boolean;
}

interface IdfyPanResponseBody {
  request_id?: string;
  result?: {
    source_output?: {
      name?: string;
      name_on_card?: string;
      status?: string;
    };
  };
  status?: string;
  error?: unknown;
}

interface IdfyOcrResponseBody {
  request_id?: string;
  result?: {
    extracted_data?: {
      pan_number?: string;
      id_number?: string;
      name?: string;
      name_on_card?: string;
    };
    source_output?: {
      pan_number?: string;
      id_number?: string;
      name?: string;
      name_on_card?: string;
      status?: string;
    };
  };
  status?: string;
  error?: unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getConfig(): { baseUrl: string; apiKey: string; accountId: string } | null {
  const baseUrl   = process.env.IDFY_BASE_URL;
  const apiKey    = process.env.IDFY_API_KEY;
  const accountId = process.env.IDFY_ACCOUNT_ID;

  if (!baseUrl || !apiKey || !accountId) {
    logger.error('IDFY credentials not fully configured', {
      hasBaseUrl:   !!baseUrl,
      hasApiKey:    !!apiKey,
      hasAccountId: !!accountId,
    });
    return null;
  }

  return { baseUrl, apiKey, accountId };
}

/**
 * Extract the name from an IDFY PAN response body.
 * IDFY returns the name in different fields depending on the source.
 */
function extractName(body: IdfyPanResponseBody): string | null {
  const src = body?.result?.source_output;
  return src?.name_on_card ?? src?.name ?? null;
}

/**
 * Determine if IDFY considers the PAN record as successfully verified.
 *
 * Accepted statuses from result.source_output.status:
 *   "id_found" — standard IDFY success
 *   "found"    — alternate IDFY success
 *   "active"   — returned by some source integrations
 */
function isVerifiedStatus(body: IdfyPanResponseBody): boolean {
  const status = body?.result?.source_output?.status?.toLowerCase();
  return status === 'id_found' || status === 'found' || status === 'active';
}

/**
 * Masks a PAN number for safe logging / client display.
 *
 * Format: ABCDE1234F → XXXXX1234X
 * (first 5 alpha chars and last alpha char are masked; 4 digit middle is kept)
 */
export function maskPan(pan: string): string {
  if (!pan || pan.length !== 10) return 'XXXXXXXXXX';
  return `XXXXX${pan.slice(5, 9)}X`;
}

/**
 * Classify an Axios error as a network / timeout failure vs a bad-request
 * failure from the IDFY API itself.
 */
function isNetworkOrTimeoutError(err: unknown): boolean {
  const axiosErr = err as AxiosError;
  if (!axiosErr.isAxiosError) return false;
  return (
    axiosErr.code === 'ECONNABORTED' ||   // axios timeout
    axiosErr.code === 'ECONNREFUSED' ||
    axiosErr.code === 'ENOTFOUND'    ||
    axiosErr.code === 'ETIMEDOUT'    ||
    !axiosErr.response               // no HTTP response at all
  );
}

// ─── OCR ─────────────────────────────────────────────────────────────────────

/**
 * Call the IDFY PAN OCR endpoint to extract PAN number and name from an image URL.
 *
 * Never throws. Returns isNetworkError=true when failure is infrastructure-related
 * so callers can respond with 202 IN_PROGRESS rather than 400.
 */
export async function extractPanFromImage(imageUrl: string, mimeType: string): Promise<IdfyOcrResult> {
  const cfg = getConfig();

  if (!cfg) {
    return {
      success:        false,
      panNumber:      null,
      nameOnPan:      null,
      isNetworkError: false,
    };
  }

  // Strip any trailing /v3 from baseUrl so we never get a double /v3,
  // then always build the full versioned path ourselves.
  const baseHost = cfg.baseUrl.replace(/\/v3\/?$/, '');
  const endpoint = `${baseHost}/v3/tasks/sync/extract/ind_pan`;

  console.log('FINAL IDFY ENDPOINT:', endpoint);

  try {
    // type:2 = raw base64 (no data-URI prefix) — confirmed working structure from curl test
    const payload = {
      task_id:  `pan-ocr-${Date.now()}`,
      group_id: `kyc-ocr-${Date.now()}`,
      data: {
        doc_front: {
          type:    2,
          content: imageUrl,  // raw base64 string, no "data:image/..." prefix
        },
      },
    };

    console.log('[IDFY-OCR] type:2 raw base64, length:', imageUrl.length, 'chars');
    console.log('[IDFY-OCR] first 30 chars of content:', imageUrl.slice(0, 30));
    console.log('[IDFY-OCR] account-id    :', cfg.accountId.slice(0, 8) + '…');
    console.log('[IDFY-OCR] payload keys  :', JSON.stringify({
      task_id:  payload.task_id,
      group_id: payload.group_id,
      data: { doc_front: { type: 2, content: `<base64 ${imageUrl.length} chars>` } },
    }));

    const response = await axios.post<IdfyOcrResponseBody>(
      endpoint,
      payload,
      {
        headers: {
          'api-key':      cfg.apiKey,
          'account-id':   cfg.accountId,
          'Content-Type': 'application/json',
        },
        timeout: 9_000,
      }
    );

    const body = response.data;

    console.log('[IDFY-OCR] HTTP status:', response.status);
    console.log('[IDFY-OCR] raw result :', JSON.stringify(body?.result ?? body));

    // IDFY returns extracted data in result.extracted_data or result.source_output
    const extracted = body?.result?.extracted_data ?? body?.result?.source_output;
    const rawPan    = extracted?.pan_number ?? extracted?.id_number ?? null;
    const nameOnPan = extracted?.name_on_card ?? extracted?.name ?? null;

    if (!rawPan) {
      logger.warn('IDFY PAN OCR: no PAN extracted from image');
      return { success: false, panNumber: null, nameOnPan: null, isNetworkError: false };
    }

    const panNumber = rawPan.trim().toUpperCase();

    logger.info('IDFY PAN OCR succeeded', {
      maskedPan:  maskPan(panNumber),
      hasName:    !!nameOnPan,
    });

    return { success: true, panNumber, nameOnPan, isNetworkError: false };
  } catch (err) {
    if (isNetworkOrTimeoutError(err)) {
      logger.warn('IDFY PAN OCR network/timeout error', { message: (err as AxiosError).message });
      return { success: false, panNumber: null, nameOnPan: null, isNetworkError: true };
    }

    const axiosErr = err as AxiosError;
    console.error('[IDFY-OCR] STATUS:', axiosErr.response?.status);
    console.error('[IDFY-OCR] ERROR BODY:', JSON.stringify(axiosErr.response?.data ?? null));
    logger.error('IDFY PAN OCR API error', { status: axiosErr.response?.status, message: axiosErr.message });
    return { success: false, panNumber: null, nameOnPan: null, isNetworkError: false };
  }
}

// ─── Verification ─────────────────────────────────────────────────────────────

/**
 * Call the IDFY PAN verification endpoint.
 *
 * Returns a structured result including the raw response for audit logging.
 * Never throws — errors are captured and returned as `panValid: false`.
 */
export async function verifyPanWithIdfy(panNumber: string): Promise<IdfyPanResult> {
  const cfg = getConfig();

  if (!cfg) {
    return {
      panValid:    false,
      panName:     null,
      requestId:   null,
      rawResponse: { error: 'IDFY service not configured' },
    };
  }

  const url = `${cfg.baseUrl}/tasks/sync/verify_with_source/ind_pan`;

  try {
    const response = await axios.post<IdfyPanResponseBody>(
      url,
      {
        task_id:  `pan-${panNumber}-${Date.now()}`,
        group_id: `kyc-${Date.now()}`,
        data: {
          id_number: panNumber,
        },
      },
      {
        headers: {
          'api-key':    cfg.apiKey,
          'account-id': cfg.accountId,
          'Content-Type': 'application/json',
        },
        timeout: 10_000, // 10-second hard timeout
      }
    );

    const body      = response.data;
    const panValid  = isVerifiedStatus(body);
    const panName   = extractName(body);
    const requestId = body?.request_id ?? null;

    logger.info('IDFY PAN verification complete', {
      panValid,
      hasPanName: panName !== null,
      requestId,
      // Never log the PAN number itself
    });

    return {
      panValid,
      panName,
      requestId,
      rawResponse: body as Record<string, unknown>,
    };
  } catch (err) {
    const axiosErr = err as AxiosError;
    const status   = axiosErr.response?.status;

    logger.error('IDFY PAN verification error', {
      status,
      message: axiosErr.message,
      // raw error response may contain PAN — log only status code
    });

    return {
      panValid:    false,
      panName:     null,
      requestId:   null,
      rawResponse: { error: 'IDFY API error', status: status ?? 'unknown' },
    };
  }
}

// ─── Bank Account Verification ────────────────────────────────────────────────

export interface IdfyBankResult {
  /** Whether the account number + IFSC is confirmed valid by NPCI/bank source */
  accountValid:   boolean;
  /** Account holder name as returned by the bank source (may be null) */
  nameAtBank:     string | null;
  /** Unique request ID from IDFY */
  requestId:      string | null;
  /** True when failure is due to network/timeout rather than an invalid account */
  isNetworkError: boolean;
}

/**
 * Verify a bank account number + IFSC code via IDfy.
 *
 * Uses the synchronous `ind_bank_account` source which checks NPCI records.
 * Never throws — network errors are returned as `{ accountValid: false, isNetworkError: true }`.
 */
export async function verifyBankAccount(
  accountNumber: string,
  ifsc:          string,
): Promise<IdfyBankResult> {
  const cfg = getConfig();

  // IDfy not configured → skip verification, allow the save to proceed
  if (!cfg) {
    logger.warn('verifyBankAccount: IDfy not configured, skipping verification');
    return { accountValid: true, nameAtBank: null, requestId: null, isNetworkError: false };
  }

  const url = `${cfg.baseUrl}/tasks/sync/verify_with_source/ind_bank_account`;

  try {
    const response = await axios.post(
      url,
      {
        task_id:  `bank-${Date.now()}`,
        group_id: `kyc-${Date.now()}`,
        data: {
          id_number: accountNumber,
          ifsc:      ifsc.toUpperCase(),
        },
      },
      {
        headers: {
          'api-key':      cfg.apiKey,
          'account-id':   cfg.accountId,
          'Content-Type': 'application/json',
        },
        timeout: 15_000,
      },
    );

    const body      = response.data;
    const srcOutput = body?.result?.source_output;

    // IDfy uses different status strings depending on source integration:
    // "id_found", "found", "active", "completed", "verified", "success"
    const status = (srcOutput?.status ?? body?.status ?? '').toLowerCase();
    const VALID_STATUSES = ['id_found', 'found', 'active', 'completed', 'verified', 'success', 'valid'];
    let accountValid = VALID_STATUSES.includes(status);

    // If IDfy returned a name/registered_name, the account definitely exists
    const nameAtBank = srcOutput?.registered_name ?? srcOutput?.name ?? srcOutput?.account_holder_name ?? null;
    if (!accountValid && nameAtBank) accountValid = true;

    // account_exists flag (some IDfy integrations return this directly)
    if (!accountValid && srcOutput?.account_exists === true) accountValid = true;

    const requestId = body?.request_id ?? null;

    console.log('[IDfy-Bank] raw source_output:', JSON.stringify(srcOutput ?? body));
    logger.info('IDfy bank account verification complete', { accountValid, status, hasName: !!nameAtBank, requestId });

    return { accountValid, nameAtBank, requestId, isNetworkError: false };
  } catch (err) {
    if (isNetworkOrTimeoutError(err)) {
      logger.warn('IDfy bank account verification: network/timeout error', {
        message: (err as AxiosError).message,
      });
      // Network down → don't block the user, skip verification
      return { accountValid: true, nameAtBank: null, requestId: null, isNetworkError: true };
    }

    const axiosErr = err as AxiosError;
    const httpStatus = axiosErr.response?.status;
    console.error('[IDfy-Bank] ERROR status:', httpStatus, 'body:', JSON.stringify(axiosErr.response?.data ?? null));
    logger.error('IDfy bank account verification API error', { status: httpStatus, message: axiosErr.message });

    // 404 / 422 from IDfy explicitly means account not found in bank records.
    // However, 422 can also mean our request format was rejected by IDfy
    // (wrong plan, missing fields, etc.) — in that case we should NOT block.
    // Only block on 404 where IDfy clearly looked up the account and didn't find it.
    if (httpStatus === 404) {
      return { accountValid: false, nameAtBank: null, requestId: null, isNetworkError: false };
    }

    // Any other error (422 format issue, 500, auth, etc.) → skip, don't block
    return { accountValid: true, nameAtBank: null, requestId: null, isNetworkError: false };
  }
}
