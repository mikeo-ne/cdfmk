import { NextResponse } from "next/server";
import type { OtpVerifyPayload, OtpVerifyResponse } from "@/lib/types";
import { e164UgandaPhone } from "@/lib/utils";
import { getStore } from "@/lib/server/store";
import {
  OTP_MAX_ATTEMPTS,
  hashOtp,
  safeEqual,
  signOtpToken,
} from "@/lib/server/otp";
import { DEMO_OTP_CODE } from "@/lib/config";

export const runtime = "nodejs";

/**
 * POST /api/otp/verify
 * Checks the submitted 4-digit code against the latest pending OTP record.
 * On success returns a signed token the client presents when posting the
 * endorsement.
 */
export async function POST(req: Request) {
  let body: OtpVerifyPayload;
  try {
    body = (await req.json()) as OtpVerifyPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const phone = e164UgandaPhone(body.phone ?? "");
  const code = (body.code ?? "").replace(/\D/g, "").slice(0, 4);
  if (!phone) {
    return NextResponse.json({ ok: false, error: "Invalid phone number." }, { status: 400 });
  }
  if (code.length !== 4) {
    return NextResponse.json({ ok: false, error: "Enter the 4-digit code." }, { status: 400 });
  }

  const store = getStore();

  try {
    const record = await store.getLatestPendingOtp(phone);

    // Demo fallback: accept 1234 even without a stored record.
    if (!record) {
      if (code === DEMO_OTP_CODE) {
        return NextResponse.json<OtpVerifyResponse>({
          ok: true,
          token: `demo-${DEMO_OTP_CODE}`,
        });
      }
      return NextResponse.json(
        { ok: false, error: "No active verification code. Please request a new one." },
        { status: 400 }
      );
    }

    if (safeEqual(hashOtp(phone, code), record.codeHash)) {
      await store.updateOtp(record.id, { status: "verified", verifiedAt: new Date() });
      return NextResponse.json<OtpVerifyResponse>({ ok: true, token: signOtpToken(phone) });
    }

    const attempts = record.attempts + 1;
    await store.updateOtp(record.id, {
      attempts,
      ...(attempts >= OTP_MAX_ATTEMPTS ? { status: "expired" } : {}),
    });

    if (attempts >= OTP_MAX_ATTEMPTS) {
      return NextResponse.json(
        { ok: false, error: "Too many attempts. Request a new code." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { ok: false, error: `Incorrect code. ${OTP_MAX_ATTEMPTS - attempts} attempt(s) left.` },
      { status: 400 }
    );
  } catch (err) {
    console.error("[otp] verify failed", err);
    return NextResponse.json({ ok: false, error: "Verification service error." }, { status: 500 });
  }
}
