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
