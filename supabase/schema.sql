-- =====================================================================
-- CDF Muhoozi 2031 — National Endorsement & Digital Signature Portal
-- Supabase schema. Run in the Supabase SQL Editor (or `supabase db push`).
--
-- Tables:
--   supporters       – one row per verified endorser
--   signatures       – the digital signature artefact attached to a supporter
--   otp_verifications – SMS one-time-password audit/verification records
-- =====================================================================

-- ---------------------------------------------------------------------
-- supporters
-- ---------------------------------------------------------------------
create table if not exists public.supporters (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  -- Normalized display form, e.g. "+256 772 123 456"
  phone           text not null,
  -- 14-character Uganda National Identification Number
  nin             text not null,
  district        text not null,
  region          text not null check (region in ('Central', 'Western', 'Northern', 'Eastern')),
  sub_county      text not null default '',
  verified        boolean not null default false,
  verification_method text not null default 'sms' check (verification_method in ('sms', 'demo')),
  created_at      timestamptz not null default now()
);

-- Anti-duplicate guarantees: one endorsement per NIN and per phone number.
create unique index if not exists supporters_nin_key      on public.supporters (upper(nin));
create unique index if not exists supporters_phone_key    on public.supporters (regexp_replace(phone, '\D', '', 'g'));
create index        if not exists supporters_district_idx on public.supporters (district);
create index        if not exists supporters_region_idx   on public.supporters (region);
create index        if not exists supporters_created_idx  on public.supporters (created_at desc);

-- ---------------------------------------------------------------------
-- signatures
-- ---------------------------------------------------------------------
create table if not exists public.signatures (
  id              uuid primary key default gen_random_uuid(),
  supporter_id    uuid not null references public.supporters(id) on delete cascade,
  -- Standalone SVG markup of the captured signature.
  svg             text not null,
  -- 'drawn' (touch/mouse canvas) or 'typed' (cursive script).
  mode            text not null check (mode in ('drawn', 'typed')),
  -- Virtual canvas dimensions the SVG coordinates are relative to.
  canvas_width    integer not null default 600,
  canvas_height   integer not null default 220,
  terms_accepted  boolean not null default true,
  ip_hash         text,                      -- optional privacy-preserving audit
  created_at      timestamptz not null default now()
);

create index if not exists signatures_supporter_idx on public.signatures (supporter_id);

-- ---------------------------------------------------------------------
-- otp_verifications  (real Africa's Talking SMS flow)
-- ---------------------------------------------------------------------
create table if not exists public.otp_verifications (
  id              uuid primary key default gen_random_uuid(),
  phone           text not null,             -- normalized "+256 772 ..."
  code_hash       text not null,             -- sha256 hex of the OTP (never store raw)
  status          text not null default 'pending'
                  check (status in ('pending', 'verified', 'expired', 'cancelled')),
  attempts        smallint not null default 0,
  sms_gateway     text not null default 'africastalking',
  sms_status      text,                      -- provider message status, e.g. Sent / queued
  expires_at      timestamptz not null,
  verified_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists otp_phone_idx on public.otp_verifications (phone, created_at desc);

-- ---------------------------------------------------------------------
-- Convenience view: latest signature per supporter (used by the admin panel)
-- ---------------------------------------------------------------------
create or replace view public.supporters_with_signatures as
select
  s.*,
  sig.svg          as signature_svg,
  sig.mode         as signature_mode,
  sig.terms_accepted,
  (select count(*) from public.otp_verifications o
     where o.phone = s.phone) as otp_requests
from public.supporters s
left join lateral (
  select * from public.signatures sig
  where sig.supporter_id = s.id
  order by sig.created_at desc
  limit 1
) sig on true;

-- =====================================================================
-- Row Level Security
-- The app's API routes use the SERVICE_ROLE key (server-side only), which
-- bypasses RLS. The public anon key is intentionally NOT granted write
-- access — all writes must flow through the verified OTP endpoints.
-- Enable RLS with no anon policies as a defence-in-depth measure.
-- =====================================================================
alter table public.supporters        enable row level security;
alter table public.signatures        enable row level security;
alter table public.otp_verifications enable row level security;

-- Read-only public tally: authenticated service role only. Drop or restrict
-- if a public SDK feed is ever needed, and instead create a policy such as:
--   create policy "public read supporters" on public.supporters
--     for select to anon using (true);
