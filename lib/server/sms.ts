import "server-only";

export interface SmsResult {
  sent: boolean;
  provider: "africastalking" | "simulated";
  status?: string;
  messageId?: string;
  error?: string;
}

/**
 * Send an OTP SMS via the Africa's Talking messaging API.
 * Docs: https://developers.africastalking.com/docs/sms/sending/bulk
 *
 * Credentials come from env:
 *   AT_API_KEY  – live or sandbox API key
 *   AT_USERNAME – "sandbox" in test mode, your live username otherwise
 *   AT_SENDER_ID – optional registered sender ID
 */
export async function sendOtpSms(phone: string, code: string): Promise<SmsResult> {
  const apiKey = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME ?? "sandbox";
  const senderId = process.env.AT_SENDER_ID ?? "";

  // No gateway configured — simulate (demo mode still returns devCode to client).
  if (!apiKey || apiKey.includes("your-africastalking")) {
    return { sent: false, provider: "simulated" };
  }

  const message =
    `Your Muhoozi 2031 endorsement verification code is ${code}. ` +
    `Never share this code. It expires in 5 minutes.`;

  const params = new URLSearchParams({
    username,
    to: phone, // E.164, e.g. +256772123456
    message,
  });
  if (senderId) params.set("from", senderId);

  try {
    const res = await fetch("https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: {
        apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
    });
    const data = (await res.json()) as {
      SMSMessageData?: {
        Message?: string;
        Recipients?: Array<{
          status?: string;
          messageId?: string;
          cost?: string;
        }>;
      };
    };
    const recipient = data?.SMSMessageData?.Recipients?.[0];
    if (!res.ok || !recipient) {
      return {
        sent: false,
        provider: "africastalking",
        error: data?.SMSMessageData?.Message ?? `HTTP ${res.status}`,
      };
    }
    return {
      sent: true,
      provider: "africastalking",
      status: recipient.status,
      messageId: recipient.messageId,
    };
  } catch (err) {
    return {
      sent: false,
      provider: "africastalking",
      error: err instanceof Error ? err.message : "network error",
    };
  }
}
