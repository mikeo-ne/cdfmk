import "server-only";
import { createHmac, createHash, randomInt, timingSafeEqual } from "crypto";

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const OTP_RESEND_COOLDOWN_SECONDS = 30;
export const OTP_MAX_ATTEMPTS = 5;

/** Cryptographically random 4-digit OTP. */
export function generateOtp(): string {
  return String(randomInt(0, 10000)).padStart(4, "0");
}

export function hashOtp(phone: string, code: string): string {
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * HMAC-signed, time-limited endorsement token issued after a successful OTP
 * verification. Allows the (unauthenticated) public client to prove phone
 * ownership when creating the endorsement a few moments later.
 */
function tokenSecret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.AT_API_KEY ?? "dev-otp-secret-2031";
}

export function signOtpToken(phone: string): string {
  const payload = { phone, exp: Date.now() + 10 * 60 * 1000 };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", tokenSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyOtpToken(token: string, expectedPhone: string): boolean {
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const expectedSig = createHmac("sha256", tokenSecret()).update(body).digest("base64url");
  if (!safeEqual(sig, expectedSig)) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as {
      phone: string;
      exp: number;
    };
    return payload.phone === expectedPhone && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function otpExpiry(): Date {
  return new Date(Date.now() + OTP_TTL_MS);
}

export const OTP_TTL_LABEL = "5 minutes";
