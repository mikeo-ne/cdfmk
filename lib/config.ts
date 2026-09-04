/**
 * Client-safe feature configuration. Only NEXT_PUBLIC_* variables may be read
 * here. When Supabase env vars are absent the app runs fully client-side with
 * localStorage persistence and the simulated OTP (code 1234).
 */
export const CAMPAIGN_YEAR = 2031;
export const CAMPAIGN_LABEL = "Muhoozi 2031";
export const DEMO_OTP_CODE = "1234";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True when Supabase credentials are wired in (real database mode). */
export const isBackendEnabled = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes("your-project-ref")
);
