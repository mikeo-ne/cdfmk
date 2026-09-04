"use client";

import { ShieldCheck, PhoneCall, MessageSquare, MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink">
      <div className="flag-stripe h-1" />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ugyellow text-ugblack">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <div>
                <p className="font-display text-lg uppercase text-white">
                  Muhoozi <span className="text-gold-gradient">2026</span>
                </p>
                <p className="text-xs uppercase tracking-widest text-slate-500">
                  Endorsement Portal
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              The official grassroots digital signature drive endorsing CDF General Muhoozi
              Kainerugaba for 2026. One Uganda, one mission.
            </p>
          </div>

          <div>
            <p className="font-display text-sm uppercase tracking-wide text-ugyellow">
              Offline Channels
            </p>
            <ul className="mt-4 space-y-3 text-sm text-slate-400">
              <li className="flex items-center gap-2.5">
                <PhoneCall className="h-4 w-4 text-ugyellow" />
                USSD: dial <span className="font-display tracking-widest text-white">*255#</span>
              </li>
              <li className="flex items-center gap-2.5">
                <MessageSquare className="h-4 w-4 text-ugyellow" />
                SMS: NIN + District to{" "}
                <span className="font-display tracking-widest text-white">8226</span>
              </li>
              <li className="flex items-center gap-2.5">
                <MapPin className="h-4 w-4 text-ugyellow" />
                Mobilization offices in all 4 regions
              </li>
            </ul>
          </div>

          <div>
            <p className="font-display text-sm uppercase tracking-wide text-ugyellow">
              Trust &amp; Security
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              <li>· SMS OTP verification via Africa&apos;s Talking</li>
              <li>· NIN-based duplicate protection</li>
              <li>· Signatures captured as tamper-evident SVG</li>
              <li>· Public wall shows masked identities only</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row">
          <p>© 2026 Muhoozi National Mobilization. A demonstration endorsement platform.</p>
          <p className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-ugblack ring-1 ring-white/20" />
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-ugyellow" />
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-ugred" />
            Built for Uganda — Kabako? Tweyagala.
          </p>
        </div>
      </div>
    </footer>
  );
}
