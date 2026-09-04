-- =====================================================================
-- CDF Muhoozi 2031 — National Endorsement & Digital Signature Portal
-- Supabase schema. Run top-to-bottom in the Supabase SQL Editor.
--
-- Design:
--   endorsements            – one row per endorser (identity, geo, storage
--                             signature URL, OTP status, anti-fraud metadata)
--   storage bucket "signatures" – public SVG signature artefacts
--   otp_verifications       – server-side SMS OTP audit records (hashed codes)
--   public_supporter_wall   – privacy-masked public feed (view)
--   get_regional_endorsement_stats() – district tallies (RPC)
-- =====================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Enum for Verification Status
DO $$ BEGIN
    CREATE TYPE endorsement_status AS ENUM ('pending', 'verified', 'flagged', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 1. ENDORSEMENTS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.endorsements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Supporter Identity Details
    full_name TEXT NOT NULL,
    phone_number VARCHAR(15) NOT NULL,  -- stored as compact E.164, e.g. +256772123456
    nin VARCHAR(14) NOT NULL,           -- National Identification Number

    -- Geographic Information
    district TEXT NOT NULL,
    sub_county TEXT,
    village TEXT,

    -- Signature Reference (Supabase Storage public URL)
    signature_url TEXT NOT NULL,

    -- Verification & Anti-Fraud Metadata
    status endorsement_status DEFAULT 'pending',
    otp_verified BOOLEAN DEFAULT FALSE,
    ip_address INET,
    user_agent TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- STRICT DUPLICATE PREVENTION CONSTRAINTS
    CONSTRAINT unique_nin UNIQUE (nin),
    CONSTRAINT unique_phone UNIQUE (phone_number)
);

-- 2. INDEXES FOR HIGH-PERFORMANCE SEARCHING & ANALYTICS
CREATE INDEX IF NOT EXISTS idx_endorsements_district ON public.endorsements(district);
CREATE INDEX IF NOT EXISTS idx_endorsements_status ON public.endorsements(status);
CREATE INDEX IF NOT EXISTS idx_endorsements_created_at ON public.endorsements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_endorsements_nin ON public.endorsements(nin);

-- 3. AUTO-UPDATE TIMESTAMP TRIGGER
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_endorsements_updated_at ON public.endorsements;
CREATE TRIGGER update_endorsements_updated_at
BEFORE UPDATE ON public.endorsements
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- 4. OTP VERIFICATIONS (server-side Africa's Talking SMS flow)
--    Codes are stored ONLY as SHA-256 hashes, never in plain text.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.otp_verifications (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone        VARCHAR(15) NOT NULL,          -- E.164 the code was sent to
    code_hash    TEXT NOT NULL,                 -- sha256(phone:code)
    status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'verified', 'expired', 'cancelled')),
    attempts     SMALLINT NOT NULL DEFAULT 0,
    sms_gateway  TEXT NOT NULL DEFAULT 'africastalking',
    sms_status   TEXT,
    expires_at   TIMESTAMPTZ NOT NULL,
    verified_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_phone ON public.otp_verifications (phone, created_at DESC);

-- ---------------------------------------------------------------------
-- 5. SIGNATURES STORAGE BUCKET (public, 2 MB max, images + SVG)
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'signatures',
    'signatures',
    true,
    2097152, -- 2MB max file size
    ARRAY['image/png', 'image/jpeg', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- STORAGE RLS POLICIES
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow public/unauthenticated users to upload signature files
DROP POLICY IF EXISTS "Allow public signature uploads" ON storage.objects;
CREATE POLICY "Allow public signature uploads"
ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'signatures');

-- Policy 2: Allow public read access to signature images
DROP POLICY IF EXISTS "Allow public viewing of signatures" ON storage.objects;
CREATE POLICY "Allow public viewing of signatures"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'signatures');

-- ---------------------------------------------------------------------
-- 6. ENDORSEMENTS ROW LEVEL SECURITY
--    (The app's API routes also write with the service-role key after OTP;
--     these policies additionally permit direct client submission.)
-- ---------------------------------------------------------------------
ALTER TABLE public.endorsements ENABLE ROW LEVEL SECURITY;

-- POLICY 1: Public can submit an endorsement
DROP POLICY IF EXISTS "Enable public endorsement submission" ON public.endorsements;
CREATE POLICY "Enable public endorsement submission"
ON public.endorsements
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- POLICY 2: Authenticated Campaign Admins have full access
DROP POLICY IF EXISTS "Admins full access to endorsements" ON public.endorsements;
CREATE POLICY "Admins full access to endorsements"
ON public.endorsements
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- OTP records are server-only; enable RLS with no anon policies.
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 7. PUBLIC SUPPORTER WALL VIEW (masked identities, verified only)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.public_supporter_wall AS
SELECT
    id,
    -- Masks "John Doe" into "J*** D***" for public privacy
    regexp_replace(full_name, '(\w)\w+', '\1***', 'g') AS masked_name,
    district,
    created_at
FROM public.endorsements
WHERE status = 'verified' OR otp_verified = true
ORDER BY created_at DESC;

-- Grant public select permissions to the view
GRANT SELECT ON public.public_supporter_wall TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. REGIONAL / DISTRICT ENDORSEMENT STATS RPC
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_regional_endorsement_stats()
RETURNS TABLE (district TEXT, total_endorsements BIGINT)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT
        district,
        COUNT(id) AS total_endorsements
    FROM public.endorsements
    WHERE status = 'verified' OR otp_verified = true
    GROUP BY district
    ORDER BY total_endorsements DESC;
$$;

GRANT EXECUTE ON FUNCTION get_regional_endorsement_stats() TO anon, authenticated;
