import { NextResponse } from "next/server";
import type { EndorsementCreatePayload, EndorsementListResponse } from "@/lib/types";
import { DISTRICTS } from "@/lib/data";
import { e164UgandaPhone, isValidNin, normalizeNin } from "@/lib/utils";
import { DuplicateError, getStore } from "@/lib/server/store";
import { verifyOtpToken } from "@/lib/server/otp";
import { DEMO_OTP_CODE } from "@/lib/config";

export const runtime = "nodejs";

/** Best-effort client IP from common proxy headers. */
function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

/**
 * GET /api/endorsements?search=&status=&region=
 * Admin/full listing (newest first) — used by the admin panel when Supabase
 * is configured. Public masked feed lives at /api/supporter-wall.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const store = getStore();
  try {
    const rows = await store.list({
      search: url.searchParams.get("search") ?? undefined,
      status:
        (url.searchParams.get("status") as "verified" | "pending" | "all") ?? "all",
      region: url.searchParams.get("region") ?? undefined,
    });
    return NextResponse.json<EndorsementListResponse>({
      endorsements: rows,
      source: store.kind === "supabase" ? "supabase" : "demo",
    });
  } catch (err) {
    console.error("[endorsements] list failed", err);
    return NextResponse.json(
      { ok: false, error: "Failed to load endorsements." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/endorsements
 * OTP-verified submission: uploads the signature SVG to Supabase Storage and
 * inserts an `endorsements` row. Requires a valid OTP token.
 */
export async function POST(req: Request) {
  const store = getStore();
  let body: EndorsementCreatePayload;
  try {
    body = (await req.json()) as EndorsementCreatePayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  // ---- normalize & validate ----
  const phoneE164 = e164UgandaPhone(body.phone ?? "");
  const displayPhone =
    phoneE164 && phoneE164.length > 9
      ? `+256 ${phoneE164.slice(-9, -6)} ${phoneE164.slice(-6, -3)} ${phoneE164.slice(-3)}`
      : body.phone ?? "";
  const nin = normalizeNin(body.nin ?? "");
  const fullName = (body.fullName ?? "").trim().replace(/\s+/g, " ");
  const district = (body.district ?? "").trim();
  const subCounty = (body.subCounty ?? "").trim().replace(/\s+/g, " ");

  const problems: Record<string, string> = {};
  if (fullName.length < 4 || fullName.split(" ").length < 2)
    problems.fullName = "Enter your full official name.";
  if (!phoneE164) problems.phone = "Enter a valid Ugandan phone number.";
  if (!isValidNin(nin)) problems.nin = "NIN must be 14 characters.";
  if (!DISTRICTS.includes(district)) problems.district = "Unsupported district.";
  if (subCounty.length < 3) problems.subCounty = "Sub-county/village required.";
  if (!body.signatureSvg || !body.signatureSvg.includes("<svg"))
    problems.signatureSvg = "A digital signature is required.";
  if (!body.termsAccepted) problems.termsAccepted = "Terms acceptance is required.";

  if (Object.keys(problems).length > 0) {
    return NextResponse.json(
      { ok: false, error: "Validation failed.", fields: problems },
      { status: 400 }
    );
  }

  // ---- OTP authorization ----
  const isDemoToken = body.token === `demo-${DEMO_OTP_CODE}`;
  const tokenOk = phoneE164 && body.token
    ? verifyOtpToken(body.token, phoneE164) || isDemoToken
    : false;
  if (!tokenOk) {
    return NextResponse.json(
      { ok: false, error: "Phone not verified. Please complete SMS verification." },
      { status: 401 }
    );
  }

  try {
    const record = await store.create({
      fullName,
      phone: displayPhone,
      phoneE164: phoneE164!,
      nin,
      district,
      subCounty,
      signatureSvg: body.signatureSvg,
      signatureMode: body.signatureMode === "typed" ? "typed" : "drawn",
      termsAccepted: true,
      verified: true,
      verificationMethod: isDemoToken ? "demo" : "sms",
      ipAddress: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true, endorsement: record });
  } catch (err) {
    if (err instanceof DuplicateError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            err.field === "nin"
              ? "This NIN has already submitted an endorsement signature."
              : "This phone number has already submitted an endorsement signature.",
          duplicateField: err.field,
        },
        { status: 409 }
      );
    }
    console.error("[endorsements] create failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not save endorsement." },
      { status: 500 }
    );
  }
}
