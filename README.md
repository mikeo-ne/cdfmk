# CDF Muhoozi 2026 — National Candidate Endorsement & Digital Signature Portal

A modern, mobile-first web application for the grassroots digital signature drive
endorsing **CDF General Muhoozi Kainerugaba** for 2026. Built with Next.js (App
Router), React, Tailwind CSS, and Lucide icons, using Ugandan flag colors
(deep yellow, red, slate black) with gold accents.

## Features

### Public Portal
- **Hero & live tally** — animating "Total Endorsements Captured: 148,920+" counter
  with a live ticker of recent endorsers and a smooth-scroll "Endorse & Sign Now" CTA.
- **Multi-step endorsement form**
  1. **Supporter details** — full name, MTN/Airtel Uganda phone (`+256…`) with
     automatic formatting/validation, 14-character NIN, district dropdown
     (Kampala, Mbarara, Gulu, Jinja, Arua, Masaka, Mbale, Lira, Wakiso, Mukono),
     and sub-county/village input with datalist hints.
  2. **Touchscreen signature pad** — HTML5 canvas with pointer events (mouse +
     touch + stylus), DPR-aware rendering, **Clear Canvas**, **Undo Last Stroke**,
     and a **Toggle Typed Signature** mode (formal cursive SVG). Terms checkbox.
  3. **SMS OTP verification (simulated)** — modal with a 4-box code input,
     Africa's Talking resend timer (30 s), and demo code **`1234`**.
- **Anti-duplicate logic** — NIN and phone number are validated against all stored
  records; duplicates trigger a toast: *"This NIN has already submitted an
  endorsement signature."*
- **Supporter wall** — live feed of recent endorsers with masked name/phone/NIN,
  district, relative timestamps, and signature thumbnails.
- **Regional analytics** — chart and table views broken down by Central, Western,
  Northern, and Eastern regions.
- **USSD/SMS fallback notice** — feature-phone users are pointed to `*255#` / SMS `8226`.

### Admin Dashboard (toggle in the header)
- Search by NIN, phone, name, district, or village.
- Filter by verification status and region.
- Attached **signature SVG preview** modal for every record.
- **Export All Records to CSV** (respects active filters).
- Stat cards for total / verified / pending records.

### Technical
- **Persistence** — endorsements persist in `localStorage`; first visit is seeded
  with 18 mock supporters so the wall is never empty.
- **Reusable components** — `SignaturePad`, `VerificationModal`, `SupporterWall`,
  `AdminDashboard`, `Toaster`, `Header`, `Hero`, `EndorsementForm`, `Footer`.
- Fully responsive with large touch targets; mobile gets a card-based admin view.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm start        # serve production build
```

## Project structure

```
app/            # Next.js App Router (layout, page, global styles)
components/     # UI components (form, canvas, modal, wall, admin, …)
lib/            # types, district/region data, validation & formatting utils,
                # signature SVG engine, localStorage store, seed data
public/         # hero illustration
```

> Demo/simulation build: OTP, SMS gateway, and the national tally are simulated
> client-side. No real personal data is transmitted.
