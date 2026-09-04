import "server-only";
import type { Endorsement, Region } from "@/lib/types";
import { buildSeedEndorsements } from "@/lib/seeds";
import { phoneKey } from "@/lib/utils";
import { getSupabaseAdmin } from "./supabaseAdmin";

export class DuplicateError extends Error {
  field: "nin" | "phone";
  constructor(field: "nin" | "phone") {
    super(field === "nin" ? "NIN already used" : "Phone already used");
    this.name = "DuplicateError";
    this.field = field;
  }
}

export interface CreateSupporterInput {
  fullName: string;
  phone: string;
  nin: string;
  district: string;
  region: Region;
  subCounty: string;
  signatureSvg: string;
  signatureMode: "drawn" | "typed";
  termsAccepted: boolean;
  verified: boolean;
  verificationMethod: "sms" | "demo";
}

export interface ListQuery {
  search?: string;
  status?: "all" | "verified" | "pending";
  region?: string;
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
  create(input: CreateSupporterInput): Promise<Endorsement>;
  createOtp(input: {
    phone: string;
    codeHash: string;
    expiresAt: Date;
    smsStatus?: string | null;
  }): Promise<OtpRecord>;
  getLatestPendingOtp(phone: string): Promise<OtpRecord | null>;
  updateOtp(id: string, patch: Partial<Pick<OtpRecord, "status" | "attempts">> & { verifiedAt?: Date }): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Supabase implementation                                             */
/* ------------------------------------------------------------------ */

type DbSupporter = {
  id: string;
  full_name: string;
  phone: string;
  nin: string;
  district: string;
  region: Region;
  sub_county: string;
  verified: boolean;
  verification_method: string;
  created_at: string;
};

function rowToEndorsement(
  s: DbSupporter,
  signature?: { svg: string; mode: "drawn" | "typed" } | null
): Endorsement {
  return {
    id: s.id,
    fullName: s.full_name,
    phone: s.phone,
    nin: s.nin,
    district: s.district,
    region: s.region,
    subCounty: s.sub_county,
    signatureSvg: signature?.svg ?? "",
    signatureMode: signature?.mode ?? "drawn",
    termsAccepted: true,
    verified: s.verified,
    createdAt: new Date(s.created_at).getTime(),
  };
}

class SupabaseStore implements EndorsementStore {
  readonly kind = "supabase" as const;

  async list(query?: ListQuery): Promise<Endorsement[]> {
    const supabase = getSupabaseAdmin()!;
    let req = supabase
      .from("supporters_with_signatures")
      .select("*")
      .order("created_at", { ascending: false });
    if (query?.region && query.region !== "all") req = req.eq("region", query.region);
    if (query?.status && query.status !== "all") req = req.eq("verified", query.status === "verified");
    if (query?.search) {
      const q = `%${query.search}%`;
      req = req.or(
        `full_name.ilike.${q},nin.ilike.${q},district.ilike.${q},sub_county.ilike.${q},phone.ilike.${q}`
      );
    }
    const { data, error } = await req.limit(500);
    if (error) throw error;
    return (data ?? []).map((r) =>
      rowToEndorsement(r as DbSupporter, {
        svg: (r as { signature_svg?: string }).signature_svg ?? "",
        mode: ((r as { signature_mode?: "drawn" | "typed" }).signature_mode ?? "drawn"),
      })
    );
  }

  async create(input: CreateSupporterInput): Promise<Endorsement> {
    const supabase = getSupabaseAdmin()!;
    const { data: supporter, error } = await supabase
      .from("supporters")
      .insert({
        full_name: input.fullName,
        phone: input.phone,
        nin: input.nin.toUpperCase(),
        district: input.district,
        region: input.region,
        sub_county: input.subCounty,
        verified: input.verified,
        verification_method: input.verificationMethod,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        // Unique violation — disambiguate which constraint.
        const detail = (error.message || "") + " " + (error.details || "");
        throw new DuplicateError(/nin/i.test(detail) ? "nin" : "phone");
      }
      throw error;
    }

    const { error: sigError } = await supabase.from("signatures").insert({
      supporter_id: supporter.id,
      svg: input.signatureSvg,
      mode: input.signatureMode,
      terms_accepted: input.termsAccepted,
    });
    if (sigError) throw sigError;

    return rowToEndorsement(supporter as DbSupporter, {
      svg: input.signatureSvg,
      mode: input.signatureMode,
    });
  }

  async createOtp(input: { phone: string; codeHash: string; expiresAt: Date; smsStatus?: string | null }): Promise<OtpRecord> {
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
    if (query?.region && query.region !== "all") rows = rows.filter((r) => r.region === query.region);
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

  async create(input: CreateSupporterInput): Promise<Endorsement> {
    if (this.endorsements.some((e) => e.nin.toUpperCase() === input.nin.toUpperCase()))
      throw new DuplicateError("nin");
    if (this.endorsements.some((e) => phoneKey(e.phone) === phoneKey(input.phone)))
      throw new DuplicateError("phone");
    const record: Endorsement = {
      id: `SRV-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      fullName: input.fullName,
      phone: input.phone,
      nin: input.nin.toUpperCase(),
      district: input.district,
      region: input.region,
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

  async createOtp(input: { phone: string; codeHash: string; expiresAt: Date; smsStatus?: string | null }): Promise<OtpRecord> {
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
