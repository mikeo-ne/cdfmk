export type Region = "Central" | "Western" | "Northern" | "Eastern";

export type VerificationStatus = "verified" | "pending";

export interface SignaturePoint {
  x: number;
  y: number;
}

export interface SignatureStroke {
  points: SignaturePoint[]
}

export interface Endorsement {
  id: string;
  fullName: string;
  phone: string; // normalized, display format e.g. +256 772 123 456
  nin: string; // uppercase 14-char NIN
  district: string;
  region: Region;
  subCounty: string;
  /** Signature as standalone SVG markup (string) */
  signatureSvg: string;
  signatureMode: "drawn" | "typed";
  termsAccepted: boolean;
  verified: boolean;
  createdAt: number; // epoch ms
}

export type ToastKind = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
}

/* ---------------- API request / response payloads ---------------- */

export interface OtpRequestPayload {
  phone: string;
  fullName?: string;
}

export interface OtpRequestResponse {
  ok: boolean;
  /** True when an SMS was dispatched through Africa's Talking. */
  smsSent?: boolean;
  /** Present only in demo/sandbox mode so the UI can show the test code. */
  devCode?: string;
  cooldownSeconds?: number;
  error?: string;
}

export interface OtpVerifyPayload {
  phone: string;
  code: string;
}

export interface OtpVerifyResponse {
  ok: boolean;
  /** Short-lived verification token required to create the endorsement. */
  token?: string;
  error?: string;
}

export interface EndorsementCreatePayload {
  fullName: string;
  phone: string;
  nin: string;
  district: string;
  subCounty: string;
  signatureSvg: string;
  signatureMode: "drawn" | "typed";
  termsAccepted: boolean;
  /** Verification token from /api/otp/verify (real mode). */
  token?: string;
}

export interface EndorsementListResponse {
  endorsements: Endorsement[];
  source: "supabase" | "demo";
}
