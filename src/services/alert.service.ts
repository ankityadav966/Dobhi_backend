/**
 * alert.service.ts
 *
 * Centralised alerting for payout system failures.
 * Supports structured JSON logging + optional Slack webhook notifications.
 *
 * Alert types:
 *  - PAYOUT_FAILED              — individual payout permanently failed
 *  - PAYOUT_STUCK               — payout in PROCESSING > 12 hours with no payoutAt
 *  - FUND_REGISTRATION_FAILED   — Razorpay fund account registration exhausted max retries
 *
 * Configuration (optional env var):
 *  SLACK_WEBHOOK_URL  — if set, alerts are POSTed to Slack as block messages
 */

import axios from 'axios';
import logger from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertType =
  | 'PAYOUT_FAILED'
  | 'PAYOUT_STUCK'
  | 'FUND_REGISTRATION_FAILED'
  | 'FINANCE_MISMATCH'
  | 'BOOKING_ISSUE_REPORTED';

export interface AlertPayload {
  [key: string]: unknown;
}

// ─── Slack formatter ──────────────────────────────────────────────────────────

function formatSlackMessage(type: AlertType, payload: AlertPayload): object {
  const emoji: Record<AlertType, string> = {
    PAYOUT_FAILED:            ':x:',
    PAYOUT_STUCK:             ':hourglass_flowing_sand:',
    FUND_REGISTRATION_FAILED: ':bank:',
    FINANCE_MISMATCH:         ':scales:',
    BOOKING_ISSUE_REPORTED:   ':warning:',
  };

  const fields = Object.entries(payload).map(([key, value]) => ({
    type:  'mrkdwn',
    text:  `*${key}:* ${String(value ?? 'null')}`,
  }));

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type:  'plain_text',
          text:  `${emoji[type] ?? ':warning:'} ZYNEXX ALERT — ${type}`,
          emoji: true,
        },
      },
      {
        type:   'section',
        fields: fields.length ? fields : [{ type: 'mrkdwn', text: '_no payload_' }],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `*env:* ${process.env.NODE_ENV ?? 'unknown'}  |  *time:* ${new Date().toISOString()}`,
          },
        ],
      },
    ],
  };
}

// ─── Core send function ───────────────────────────────────────────────────────

/**
 * Sends a structured alert.
 * Always logs. POSTs to Slack if SLACK_WEBHOOK_URL is configured.
 * Never throws — alerting must not crash the caller.
 */
export async function sendAlert(
  type: AlertType,
  payload: AlertPayload,
): Promise<void> {
  // ── 1. Structured log (always) ────────────────────────────────────────────
  const logEntry = { alertType: type, ...payload, ts: new Date().toISOString() };

  // Use error level so it shows up in error-only log streams
  logger.error(`[ALERT] ${type}`, logEntry);

  // Also write to stderr for environments that pipe stderr separately
  console.error(JSON.stringify({ level: 'ALERT', type, ...logEntry }));

  // ── 2. Slack webhook (optional) ───────────────────────────────────────────
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (!slackUrl) return;

  try {
    const body = formatSlackMessage(type, payload);
    await axios.post(slackUrl, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    });
    logger.info(`[ALERT] Slack notification sent for ${type}`);
  } catch (slackErr) {
    // Non-fatal: log and continue. Never let Slack failure bubble up.
    logger.warn(`[ALERT] Slack POST failed for ${type} — alert was logged only`, {
      error: slackErr instanceof Error ? slackErr.message : String(slackErr),
    });
  }
}
