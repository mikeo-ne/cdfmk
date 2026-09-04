"use client";

import type {
  DistrictStat,
  Endorsement,
  EndorsementCreatePayload,
  OtpRequestResponse,
  OtpVerifyResponse,
  WallEntry,
} from "./types";
import { isBackendEnabled } from "./config";

export { isBackendEnabled };

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    (err as Error & { status?: number; fields?: Record<string, string> }).status = res.status;
    (err as Error & { fields?: Record<string, string> }).fields = (
      data as { fields?: Record<string, string> }
    ).fields;
    throw err;
  }
  return data;
}

export interface ListParams {
  search?: string;
  status?: "all" | "verified" | "pending";
  region?: string;
}

export async function fetchEndorsements(
  params: ListParams = {}
): Promise<{ endorsements: Endorsement[]; source: "supabase" | "demo" }> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.region && params.region !== "all") qs.set("region", params.region);
  const data = await jsonFetch<{ endorsements: Endorsement[]; source: "supabase" | "demo" }>(
    `/api/endorsements?${qs.toString()}`
  );
  return { endorsements: data.endorsements, source: data.source };
}

export async function requestOtp(phone: string): Promise<OtpRequestResponse> {
  return jsonFetch<OtpRequestResponse>("/api/otp/request", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export async function verifyOtp(phone: string, code: string): Promise<OtpVerifyResponse> {
  return jsonFetch<OtpVerifyResponse>("/api/otp/verify", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
}

export async function createEndorsement(
  payload: EndorsementCreatePayload
): Promise<{ endorsement: Endorsement }> {
  return jsonFetch<{ endorsement: Endorsement }>("/api/endorsements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Privacy-masked public supporter wall (from public_supporter_wall view). */
export async function fetchSupporterWall(): Promise<WallEntry[]> {
  const data = await jsonFetch<{ entries: WallEntry[] }>("/api/supporter-wall");
  return data.entries;
}

/** Verified endorsements per district (from get_regional_endorsement_stats RPC). */
export async function fetchRegionalStats(): Promise<DistrictStat[]> {
  const data = await jsonFetch<{ stats: DistrictStat[] }>("/api/stats");
  return data.stats;
}
