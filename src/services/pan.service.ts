import { config } from "../config/index";
import { prisma } from "../prisma.client";
import logger from "../utils/logger";

const fetch = global.fetch;

export interface InitiatePanRequest {
  panNumber: string;
  fullName: string;
  dateOfBirth: string; // YYYY-MM-DD format
}

export interface PanVerificationResponse {
  status: string;
  taskId: string;
  requestId: string;
  action: string;
  result?: {
    source_output: {
      aadhaar_seeding_status: boolean;
      pan_status: string;
      name_match: boolean;
      dob_match: boolean;
    };
    input_details: {
      input_pan_number: string;
      input_name: string;
      input_dob: string;
    };
  };
}

/**
 * Initiate PAN verification with IDFY
 */
export async function initiatePanVerification(
  userId: string,
  request: InitiatePanRequest
): Promise<{ taskId: string; requestId: string }> {
  try {
    if (!config.idfy.apiKey || !config.idfy.accountId) {
      throw new Error("IDFY credentials not configured");
    }

    const payload = {
      task_id: `pan_${userId}_${Date.now()}`,
      type: "ind_pan",
      group_id: userId,
      input_details: {
        input_pan_number: request.panNumber.toUpperCase(),
        input_name: request.fullName,
        input_dob: request.dateOfBirth,
      },
    };

    const response = await fetch(`${config.idfy.baseUrl}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": config.idfy.apiKey,
        "account-id": config.idfy.accountId,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      logger.error(`IDFY API error: ${response.status}`, errorData);
      throw new Error(`IDFY API error: ${response.status}`);
    }

    const data = (await response.json()) as any;

    logger.info("IDFY PAN verification initiated:", {
      taskId: data.task_id,
      requestId: data.request_id,
    });

    // Store verification data in PanVerification record
    const userIdNum = parseInt(userId, 10);
    await prisma.panVerification.upsert({
      where: { userId: userIdNum },
      update: {
        panNumber: request.panNumber.toUpperCase(),
        verificationId: data.request_id,
        isVerified: false,
      },
      create: {
        userId: userIdNum,
        panNumber: request.panNumber.toUpperCase(),
        panName: 'N/A',
        verificationId: data.request_id,
        isVerified: false,
      },
    });

    return {
      taskId: data.task_id,
      requestId: data.request_id,
    };
  } catch (error) {
    logger.error("Error initiating PAN verification:", error);
    throw error;
  }
}

/**
 * Get PAN verification status from IDFY
 */
export async function getPanVerificationStatus(
  requestId: string
): Promise<PanVerificationResponse> {
  try {
    if (!config.idfy.apiKey || !config.idfy.accountId) {
      throw new Error("IDFY credentials not configured");
    }

    const response = await fetch(
      `${config.idfy.baseUrl}/tasks?request_id=${requestId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "api-key": config.idfy.apiKey,
          "account-id": config.idfy.accountId,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      logger.error(`IDFY API error: ${response.status}`, errorData);
      throw new Error(`IDFY API error: ${response.status}`);
    }

    const data = (await response.json()) as PanVerificationResponse;

    logger.info("IDFY PAN verification status retrieved:", {
      requestId,
      status: data.status,
    });

    return data;
  } catch (error) {
    logger.error("Error getting PAN verification status:", error);
    throw error;
  }
}

/**
 * Verify and update user PAN status
 */
export async function verifyAndUpdatePanStatus(
  userId: string,
  requestId: string
): Promise<boolean> {
  try {
    const verificationResult = await getPanVerificationStatus(requestId);

    // Check if verification is completed
    if (verificationResult.status !== "completed") {
      logger.info(
        `PAN verification still pending for user ${userId}:`,
        verificationResult.status
      );
      return false;
    }

    // Check if verification was successful
    const sourceOutput = verificationResult.result?.source_output;
    const isVerified =
      sourceOutput?.pan_status &&
      sourceOutput.pan_status.includes("Valid") &&
      sourceOutput.name_match === true &&
      sourceOutput.dob_match === true;

    // Update PanVerification record
    const userIdNum = parseInt(userId, 10);
    const panName = verificationResult.result?.input_details?.input_name || 'N/A';
    await prisma.panVerification.update({
      where: { userId: userIdNum },
      data: {
        isVerified: isVerified === true,
        panName,
      },
    });

    logger.info(
      `PAN verification updated for user ${userId}: ${isVerified ? "verified" : "failed"}`
    );

    return isVerified === true;
  } catch (error) {
    logger.error("Error verifying PAN status:", error);
    throw error;
  }
}

/**
 * Get current PAN verification status for a user
 */
export async function getUserPanStatus(userId: string) {
  try {
    const userIdNum = parseInt(userId, 10);
    const panVerification = await prisma.panVerification.findUnique({
      where: { userId: userIdNum },
    });

    if (!panVerification) {
      return {
        isPanVerified: false,
        panCardNumber: null,
        verificationData: null,
      };
    }

    return {
      isPanVerified: panVerification.isVerified,
      panCardNumber: panVerification.panNumber,
      verificationData: {
        panName: panVerification.panName,
        verificationId: panVerification.verificationId,
        verifiedAt: panVerification.updatedAt,
      },
    };
  } catch (error) {
    logger.error("Error getting user PAN status:", error);
    throw error;
  }
}
