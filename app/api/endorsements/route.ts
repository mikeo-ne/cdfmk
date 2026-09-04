import { NextResponse } from "next/server";
import type { EndorsementCreatePayload, EndorsementListResponse } from "@/lib/types";
import { DISTRICTS } from "@/lib/data";
import {
  isValidNin,
  normalizeNin,
  normalizeUgandaPhone,
  regionForDistrict,
} from "@/lib/utils";
import { DuplicateError, getStore } from "@/lib/server/store";
import { verifyOtpToken } from "@/lib/server/otp";
import { DEMO_OTP_CODE } from "@/lib/config";

export const runtime = "nodejs";

/**
 * GET /api/endorsements?search=&status=&region=
 * List endorsements (newest first). Used by the public wall and admin panel
 * when Supabase is configured.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const store = getStore();
  try {
    const rows = await store.list({
      search: url.searchParams.get("search") ?? undefined,
      status: (url.searchParams.get("status") as "verified" | "pending" | "all") ?? "all",
      region: url.searchParams.get("region") ?? undefined,
    });
    return NextResponse.json<EndorsementListResponse>({
      endorsements: rows,
      source: store.kind === "supabase" ? "supabase" : "demo",
    });
  } catch (err) {
    console.error("[endorsements] list failed", err);
    return NextResponse.json({ ok: false, error: "Failed to load endorsements." }, { status: 500 });
  }
}

/**
 * POST /api/endorsements
 * Create a verified endorsement + attached signature.
 * Requires a valid OTP token issued by /api/otp/verify (real mode).
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
  const phone = normalizeUgandaPhone(body.phone ?? "");
  const nin = normalizeNin(body.nin ?? "");
  const fullName = (body.fullName ?? "").trim().replace(/\s+/g, " ");
  const district = (body.district ?? "").trim();
  const subCounty = (body.subCounty ?? "").trim().replace(/\s+/g, " ");

  const problems: Record<string, string> = {};
  if (fullName.length < 4 || fullName.split(" ").length < 2)
    problems.fullName = "Enter your full official name.";
  if (!phone) problems.phone = "Enter a valid Ugandan phone number.";
  if (!isValidNin(nin)) problems.nin = "NIN must be 14 characters.";
  if (!DISTRICTS.includes(district)) problems.district = "Unsupported district.";
  if (subCounty.length < 3) problems.subCounty = "Sub-county/village required.";
  if (!body.signatureSvg || !body.signatureSvg.includes("<svg"))
    problems.signatureSvg = "A digital signature is required.";
  if (!body.termsAccepted) problems.termsAccepted = "Terms acceptance is required.";

  if (Object.keys(problems).length > 0) {
    return NextResponse.json({ ok: false, error: "Validation failed.", fields: problems }, { status: 400 });
  }

  // ---- OTP authorization ----
  const isDemoToken = body.token === `demo-${DEMO_OTP_CODE}`;
  const tokenOk = phone && body.token ? verifyOtpToken(body.token, phone) || isDemoToken : false;
  if (!tokenOk) {
    return NextResponse.json(
      { ok: false, error: "Phone not verified. Please complete SMS verification." },
      { status: 401 }
    );
  }

  try {
    const record = await store.create({
      fullName,
      phone: phone!,
      nin,
      district,
      region: regionForDistrict(district),
      subCounty,
      signatureSvg: body.signatureSvg,
      signatureMode: body.signatureMode === "typed" ? "typed" : "drawn",
      termsAccepted: true,
      verified: true,
      verificationMethod: isDemoToken ? "demo" : "sms",
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
    return NextResponse.json({ ok: false, error: "Could not save endorsement." }, { status: 500 });
  }
}
