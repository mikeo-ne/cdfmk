import "server-only";
import type {
  DistrictStat,
  Endorsement,
  Region,
  VerificationStatus,
  WallEntry,
} from "@/lib/types";
import { buildSeedEndorsements } from "@/lib/seeds";
import {
  formatDisplayFromE164,
  maskName,
  phoneKey,
  regionForDistrict,
} from "@/lib/utils";
import { DISTRICT_REGION } from "@/lib/data";
import { getSupabaseAdmin } from "./supabaseAdmin";

export class DuplicateError extends Error {
  field: "nin" | "phone";
  constructor(field: "nin" | "phone") {
    super(field === "nin" ? "NIN already used" : "Phone already used");
    this.name = "DuplicateError";
    this.field = field;
  }
}

export interface ListQuery {
  search?: string;
  status?: "all" | VerificationStatus;
  region?: string;
}

export interface CreateEndorsementInput {
  fullName: string;
  /** Display phone, e.g. "+256 772 123 456". */
  phone: string;
  /** E.164 phone, e.g. "+256772123456" (stored + used for SMS). */
  phoneE164: string;
  nin: string;
  district: string;
  subCounty: string;
  village?: string;
  signatureSvg: string;
  signatureMode: "drawn" | "typed";
  termsAccepted: boolean;
  verified: boolean;
  verificationMethod: "sms" | "demo";
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface OtpRecord {
  id: string;
  phone: string;
  codeHash: string;
  status: "pending" | "verified" | "expired" | "cancelled";
  attempts: number;
  expiresAt: number;
  createdAt: number;
  smsStatus?: string | null;
}

export interface EndorsementStore {
  readonly kind: "supabase" | "memory";
  list(query?: ListQuery): Promise<Endorsement[]>;
  wall(limit?: number): Promise<WallEntry[]>;
  stats(): Promise<DistrictStat[]>;
  create(input: CreateEndorsementInput): Promise<Endorsement>;
  createOtp(input: {
    phone: string;
    codeHash: string;
    expiresAt: Date;
    smsStatus?: string | null;
  }): Promise<OtpRecord>;
  getLatestPendingOtp(phone: string): Promise<OtpRecord | null>;
  updateOtp(
    id: string,
    patch: Partial<Pick<OtpRecord, "status" | "attempts">> & { verifiedAt?: Date }
  ): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function isDuplicateError(err: unknown): DuplicateError | null {
  const e = err as { code?: string; message?: string; details?: string } | null;
  if (!e || e.code !== "23505") return null;
  const text = `${e.message ?? ""} ${e.details ?? ""}`;
  if (/unique_nin|nin/i.test(text)) return new DuplicateError("nin");
  if (/unique_phone|phone/i.test(text)) return new DuplicateError("phone");
  return new DuplicateError("nin");
}

/* ------------------------------------------------------------------ */
/* Supabase implementation (endorsements table + Storage bucket)       */
/* ------------------------------------------------------------------ */

type DbEndorsement = {
  id: string;
  full_name: string;
  phone_number: string;
  nin: string;
  district: string;
  sub_county: string | null;
  village: string | null;
  signature_url: string;
  status: VerificationStatus | "flagged" | "rejected";
  otp_verified: boolean;
  created_at: string;
};

function rowToEndorsement(r: DbEndorsement): Endorsement {
  return {
    id: r.id,
    fullName: r.full_name,
    phone: formatDisplayFromE164(r.phone_number),
    nin: r.nin,
    district: r.district,
    region: regionForDistrict(r.district),
    subCounty: r.sub_county || r.village || "",
    // Stored as a public Supabase Storage URL (rendered directly in <img>).
    signatureSvg: r.signature_url,
    signatureMode: "drawn",
    termsAccepted: true,
    verified: r.status === "verified" || r.otp_verified,
    createdAt: new Date(r.created_at).getTime(),
  };
}

class SupabaseStore implements EndorsementStore {
  readonly kind = "supabase" as const;

  async list(query?: ListQuery): Promise<Endorsement[]> {
    const supabase = getSupabaseAdmin()!;
    let req = supabase
      .from("endorsements")
      .select("*")
      .order("created_at", { ascending: false });
    if (query?.region && query.region !== "all") {
      // Region is derived from district — constrain via the known districts.
      const districts = Object.entries(DISTRICT_REGION)
        .filter(([, reg]) => reg === query.region)
        .map(([d]) => d);
      req = req.in("district", districts);
    }
    if (query?.status && query.status !== "all") {
      req = req.eq("otp_verified", query.status === "verified");
    }
    if (query?.search) {
      const q = `%${query.search}%`;
      req = req.or(
        `full_name.ilike.${q},nin.ilike.${q},district.ilike.${q},sub_county.ilike.${q},phone_number.ilike.${q}`
      );
    }
    const { data, error } = await req.limit(500);
    if (error) throw error;
    return (data ?? []).map((r) => rowToEndorsement(r as DbEndorsement));
  }

  async wall(limit = 50): Promise<WallEntry[]> {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase
      .from("public_supporter_wall")
      .select("*")
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      maskedName: (r.masked_name as string) ?? "",
      district: r.district as string,
      createdAt: new Date(r.created_at as string).getTime(),
    }));
  }

  async stats(): Promise<DistrictStat[]> {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase.rpc("get_regional_endorsement_stats");
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      district: r.district as string,
      totalEndorsements: Number(r.total_endorsements ?? r.totalEndorsements ?? 0),
    }));
  }

  async create(input: CreateEndorsementInput): Promise<Endorsement> {
    const supabase = getSupabaseAdmin()!;

    // 1) Upload the signature SVG to the public "signatures" Storage bucket.
    const fileName = `sig-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.svg`;
    const blob = new Blob([input.signatureSvg], { type: "image/svg+xml" });
    const { error: upErr } = await supabase.storage
      .from("signatures")
      .upload(fileName, blob, { contentType: "image/svg+xml", upsert: false });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from("signatures").getPublicUrl(fileName);
    const signatureUrl = pub.publicUrl;

    // 2) Insert the endorsement row.
    const { data, error } = await supabase
      .from("endorsements")
      .insert({
        full_name: input.fullName,
        phone_number: input.phoneE164,
        nin: input.nin.toUpperCase(),
        district: input.district,
        sub_county: input.subCounty || null,
        village: input.village || null,
        signature_url: signatureUrl,
        status: input.verified ? "verified" : "pending",
        otp_verified: input.verified,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
      })
      .select("*")
      .single();

    if (error) {
      const dup = isDuplicateError(error);
      if (dup) throw dup;
      throw error;
    }

    return rowToEndorsement(data as DbEndorsement);
  }

  async createOtp(input: {
    phone: string;
    codeHash: string;
    expiresAt: Date;
    smsStatus?: string | null;
  }): Promise<OtpRecord> {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase
      .from("otp_verifications")
      .insert({
        phone: input.phone,
        code_hash: input.codeHash,
        expires_at: input.expiresAt.toISOString(),
        sms_status: input.smsStatus ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return {
      id: data.id,
      phone: data.phone,
      codeHash: data.code_hash,
      status: data.status,
      attempts: data.attempts,
      expiresAt: new Date(data.expires_at).getTime(),
      createdAt: new Date(data.created_at).getTime(),
      smsStatus: data.sms_status,
    };
  }

  async getLatestPendingOtp(phone: string): Promise<OtpRecord | null> {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase
      .from("otp_verifications")
      .select("*")
      .eq("phone", phone)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      phone: data.phone,
      codeHash: data.code_hash,
      status: data.status,
      attempts: data.attempts,
      expiresAt: new Date(data.expires_at).getTime(),
      createdAt: new Date(data.created_at).getTime(),
      smsStatus: data.sms_status,
    };
  }

  async updateOtp(
    id: string,
    patch: Partial<Pick<OtpRecord, "status" | "attempts">> & { verifiedAt?: Date }
  ): Promise<void> {
    const supabase = getSupabaseAdmin()!;
    const body: Record<string, unknown> = {};
    if (patch.status) body.status = patch.status;
    if (typeof patch.attempts === "number") body.attempts = patch.attempts;
    if (patch.verifiedAt) body.verified_at = patch.verifiedAt.toISOString();
    const { error } = await supabase.from("otp_verifications").update(body).eq("id", id);
    if (error) throw error;
  }
}

/* ------------------------------------------------------------------ */
/* In-memory implementation (demo / no Supabase configured)            */
/* ------------------------------------------------------------------ */

class MemoryStore implements EndorsementStore {
  readonly kind = "memory" as const;
  private endorsements: Endorsement[];
  private otps: OtpRecord[] = [];

  constructor() {
    // Seed once per server process so demo API responses mirror the client.
    this.endorsements = buildSeedEndorsements();
  }

  async list(query?: ListQuery): Promise<Endorsement[]> {
    let rows = [...this.endorsements];
    if (query?.region && query.region !== "all")
      rows = rows.filter((r) => r.region === query.region);
    if (query?.status && query.status !== "all")
      rows = rows.filter((r) => r.verified === (query.status === "verified"));
    if (query?.search) {
      const q = query.search.toUpperCase();
      rows = rows.filter(
        (r) =>
          r.fullName.toUpperCase().includes(q) ||
          r.nin.includes(q) ||
          r.district.toUpperCase().includes(q) ||
          r.subCounty.toUpperCase().includes(q) ||
          phoneKey(r.phone).includes(q.replace(/\D/g, ""))
      );
    }
    return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, 500);
  }

  async wall(limit = 50): Promise<WallEntry[]> {
    return [...this.endorsements]
      .filter((e) => e.verified)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map((e) => ({
        id: e.id,
        maskedName: maskName(e.fullName),
        district: e.district,
        createdAt: e.createdAt,
      }));
  }

  async stats(): Promise<DistrictStat[]> {
    const counts = new Map<string, number>();
    for (const e of this.endorsements) {
      if (!e.verified) continue;
      counts.set(e.district, (counts.get(e.district) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([district, totalEndorsements]) => ({ district, totalEndorsements }))
      .sort((a, b) => b.totalEndorsements - a.totalEndorsements);
  }

  async create(input: CreateEndorsementInput): Promise<Endorsement> {
    if (this.endorsements.some((e) => e.nin.toUpperCase() === input.nin.toUpperCase()))
      throw new DuplicateError("nin");
    if (this.endorsements.some((e) => phoneKey(e.phone) === phoneKey(input.phoneE164)))
      throw new DuplicateError("phone");
    const record: Endorsement = {
      id: `SRV-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      fullName: input.fullName,
      phone: input.phone,
      nin: input.nin.toUpperCase(),
      district: input.district,
      region: regionForDistrict(input.district),
      subCounty: input.subCounty,
      signatureSvg: input.signatureSvg,
      signatureMode: input.signatureMode,
      termsAccepted: input.termsAccepted,
      verified: input.verified,
      createdAt: Date.now(),
    };
    this.endorsements.unshift(record);
    return record;
  }

  async createOtp(input: {
    phone: string;
    codeHash: string;
    expiresAt: Date;
    smsStatus?: string | null;
  }): Promise<OtpRecord> {
    const rec: OtpRecord = {
      id: `otp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      phone: input.phone,
      codeHash: input.codeHash,
      status: "pending",
      attempts: 0,
      expiresAt: input.expiresAt.getTime(),
      createdAt: Date.now(),
      smsStatus: input.smsStatus ?? null,
    };
    this.otps.unshift(rec);
    return rec;
  }

  async getLatestPendingOtp(phone: string): Promise<OtpRecord | null> {
    const now = Date.now();
    const rec = this.otps
      .filter((o) => o.phone === phone && o.status === "pending")
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!rec) return null;
    if (rec.expiresAt < now) {
      rec.status = "expired";
      return null;
    }
    return rec;
  }

  async updateOtp(
    id: string,
    patch: Partial<Pick<OtpRecord, "status" | "attempts">> & { verifiedAt?: Date }
  ): Promise<void> {
    const rec = this.otps.find((o) => o.id === id);
    if (!rec) return;
    if (patch.status) rec.status = patch.status;
    if (typeof patch.attempts === "number") rec.attempts = patch.attempts;
    void patch.verifiedAt;
  }
}

/* ------------------------------------------------------------------ */
/* Factory                                                             */
/* ------------------------------------------------------------------ */

let store: EndorsementStore | null = null;

export function getStore(): EndorsementStore {
  if (store) return store;
  store = getSupabaseAdmin() ? new SupabaseStore() : new MemoryStore();
  return store;
}
