import { NextResponse } from "next/server";
import type { OtpRequestPayload, OtpRequestResponse } from "@/lib/types";
import { normalizeUgandaPhone } from "@/lib/utils";
import { getStore } from "@/lib/server/store";
import { sendOtpSms } from "@/lib/server/sms";
import {
  OTP_RESEND_COOLDOWN_SECONDS,
  generateOtp,
  hashOtp,
  otpExpiry,
} from "@/lib/server/otp";
import { DEMO_OTP_CODE } from "@/lib/config";

export const runtime = "nodejs";

/**
 * POST /api/otp/request
 * Generates a 4-digit OTP, stores its hash (Supabase or memory), and sends it
 * through Africa's Talking. In sandbox / demo mode the code is returned to the
 * client so the simulated flow stays testable without a gateway.
 */
export async function POST(req: Request) {
  let body: OtpRequestPayload;
  try {
    body = (await req.json()) as OtpRequestPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const phone = normalizeUgandaPhone(body.phone ?? "");
  if (!phone) {
    return NextResponse.json({ ok: false, error: "Enter a valid MTN/Airtel Uganda number." }, { status: 400 });
  }

  const store = getStore();

  // Resend cooldown — a pending OTP younger than 30s blocks a new one.
  try {
    const pending = await store.getLatestPendingOtp(phone);
    if (pending && Date.now() - pending.createdAt < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
      const wait = OTP_RESEND_COOLDOWN_SECONDS - Math.floor((Date.now() - pending.createdAt) / 1000);
      return NextResponse.json<OtpRequestResponse>(
        { ok: false, error: `Please wait ${wait}s before requesting another code.`, cooldownSeconds: wait },
        { status: 429 }
      );
    }
  } catch (err) {
    console.error("[otp] cooldown check failed", err);
  }

  // Demo mode (no gateway credentials): keep the stable code 1234.
  const gatewayConfigured = Boolean(process.env.AT_API_KEY && !process.env.AT_API_KEY.includes("your-africastalking"));
  const code = gatewayConfigured ? generateOtp() : DEMO_OTP_CODE;

  let smsStatus: string | null = null;
  let smsSent = false;
  if (gatewayConfigured) {
    const result = await sendOtpSms(phone, code);
    smsSent = result.sent;
    smsStatus = result.status ?? result.error ?? null;
    if (!result.sent) {
      console.error("[otp] SMS dispatch failed", result.error);
      return NextResponse.json<OtpRequestResponse>(
        { ok: false, error: "SMS gateway is temporarily unavailable. Please try again." },
        { status: 502 }
      );
    }
  }

  try {
    await store.createOtp({
      phone,
      codeHash: hashOtp(phone, code),
      expiresAt: otpExpiry(),
      smsStatus,
    });
  } catch (err) {
    console.error("[otp] persistence failed", err);
    return NextResponse.json({ ok: false, error: "Could not start verification." }, { status: 500 });
  }

  return NextResponse.json<OtpRequestResponse>({
    ok: true,
    smsSent,
    // Only exposed without a real gateway — keeps the sandbox demo self-serve.
    devCode: gatewayConfigured ? undefined : DEMO_OTP_CODE,
    cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
  });
}
