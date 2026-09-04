import type { Region } from "./types";
import { DISTRICT_REGION } from "./data";

/* ------------------------------------------------------------------ */
/* IDs                                                                  */
/* ------------------------------------------------------------------ */

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  ).toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Phone numbers (MTN / Airtel Uganda: +256 7XX XXX XXX)                */
/* ------------------------------------------------------------------ */

/**
 * Normalizes any Ugandan mobile input into display form "+256 7XX XXX XXX".
 * Accepts: 0772123456, 772123456, 256772123456, +256772123456.
 * Returns null if the digits cannot form a valid Ugandan mobile number.
 */
export function normalizeUgandaPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let national: string;
  if (digits.startsWith("256") && digits.length === 12) {
    national = "0" + digits.slice(3);
  } else if (digits.length === 9 && digits.startsWith("7")) {
    national = "0" + digits;
  } else if (digits.length === 10 && digits.startsWith("07")) {
    national = digits;
  } else {
    return null;
  }
  // 07X followed by 7 digits (covers MTN 077x/078x/076x and Airtel 070x/075x ranges)
  if (!/^07\d{8}$/.test(national)) return null;
  const m = national.slice(1); // 9 digits
  return `+256 ${m.slice(0, 3)} ${m.slice(3, 6)} ${m.slice(6)}`;
}

/** Compact stored key used for duplicate detection, e.g. "256772123456". */
export function phoneKey(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Mask a display phone for public views: +256 7•• ••• 456 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(-9); // last 9 = national without leading 0
  if (digits.length < 9) return phone;
  return `+256 ${digits[0]}•• ••• ${digits.slice(-3)}`;
}

/* ------------------------------------------------------------------ */
/* National Identification Number (NIN)                                */
/* ------------------------------------------------------------------ */

export function normalizeNin(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
}

/** Uganda NINs are 14 characters: starts with a letter, 13 alphanumerics. */
export function isValidNin(nin: string): boolean {
  return /^[A-Z][A-Z0-9]{13}$/.test(nin);
}

/** Public masking: CF••••••••••••2A (keep first 2 and last 2 chars). */
export function maskNin(nin: string): string {
  if (nin.length < 6) return nin;
  return `${nin.slice(0, 2)}${"•".repeat(nin.length - 4)}${nin.slice(-2)}`;
}

/* ------------------------------------------------------------------ */
/* Names & dates                                                        */
/* ------------------------------------------------------------------ */

/** "Mukasa John Kato" -> "M••••• J••• K•••" */
export function maskName(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .map((part) => (part.length <= 1 ? part : part[0] + "•".repeat(Math.min(part.length - 1, 4))))
    .join(" ");
}

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w} wk${w === 1 ? "" : "s"} ago`;
  return new Date(ts).toLocaleDateString("en-UG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString("en-UG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/* ------------------------------------------------------------------ */
/* Regions                                                              */
/* ------------------------------------------------------------------ */

export function regionForDistrict(district: string): Region {
  return DISTRICT_REGION[district] ?? "Central";
}

/* ------------------------------------------------------------------ */
/* CSV export                                                           */
/* ------------------------------------------------------------------ */

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function endorsementsToCsv(rows: {
  fullName: string;
  phone: string;
  nin: string;
  district: string;
  region: string;
  subCounty: string;
  signatureMode: string;
  verified: boolean;
  createdAt: number;
}[]): string {
  const header = [
    "Record ID",
    "Full Name",
    "Phone",
    "NIN",
    "District",
    "Region",
    "Sub-County / Village",
    "Signature Type",
    "Verification Status",
    "Submitted At",
  ];
  const lines = rows.map((r, i) =>
    [
      `MK2026-${String(i + 1).padStart(6, "0")}`,
      csvEscape(r.fullName),
      r.phone,
      r.nin,
      r.district,
      r.region,
      csvEscape(r.subCounty),
      r.signatureMode,
      r.verified ? "Verified" : "Pending",
      new Date(r.createdAt).toISOString(),
    ].join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/* Misc                                                                 */
/* ------------------------------------------------------------------ */

export function classNames(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}
