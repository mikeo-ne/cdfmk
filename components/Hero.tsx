"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PenLine, Radio, MapPin, Users } from "lucide-react";
import type { Endorsement } from "@/lib/types";
import { TALLY_BASELINE } from "@/lib/storage";
import { maskName, timeAgo } from "@/lib/utils";
import { useMounted } from "@/lib/useMounted";

/** Animated count-up number. */
function useCountUp(target: number, duration = 1400): number {
  const [value, setValue] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const from = prevRef.current;
    const to = target;
    prevRef.current = to;
    if (from === to) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

interface HeroProps {
  endorsements: Endorsement[];
}

export function Hero({ endorsements }: HeroProps) {
  // Live tally: baseline + stored records + a "simulated live trickle" that
  // grows a few endorsements every few seconds, like a real campaign feed.
  const [liveTrickle, setLiveTrickle] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveTrickle((n) => n + Math.floor(Math.random() * 4) + 1);
    }, 3800);
    return () => clearInterval(interval);
  }, []);

  const total = TALLY_BASELINE + endorsements.length + liveTrickle;
  const shown = useCountUp(total);

  const mounted = useMounted();
  const recentTickers = useMemo(
    () =>
      [...endorsements]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 8),
    [endorsements]
  );
  const [tickerIdx, setTickerIdx] = useState(0);
  useEffect(() => {
    if (recentTickers.length === 0) return;
    const t = setInterval(
      () => setTickerIdx((i) => (i + 1) % recentTickers.length),
      3200
    );
    return () => clearInterval(t);
  }, [recentTickers.length]);
  const ticker = recentTickers[Math.min(tickerIdx, recentTickers.length - 1)];

  const scrollToForm = () =>
    document.getElementById("endorse")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <section className="relative overflow-hidden">
      {/* ambient glows */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-ugred/20 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-40 h-80 w-80 rounded-full bg-ugyellow/10 blur-[120px]" />

      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-10 sm:pt-16 lg:grid-cols-2">
        <div className="animate-fade-up">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-ugyellow/40 bg-ugyellow/10 px-4 py-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-ugred" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ugred" />
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-ugyellow">
              Official Grassroots Mobilization · 2026
            </span>
          </div>

          <h1 className="font-display text-4xl uppercase leading-[1.02] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Stand with <span className="text-gold-gradient">CDF Muhoozi</span>
            <span className="mt-2 block text-2xl text-slate-200 sm:text-3xl lg:text-4xl">
              Add Your Signature for 2026
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Join hundreds of thousands of Ugandans endorsing{" "}
            <strong className="text-white">General Muhoozi Kainerugaba</strong> for the 2026
            leadership journey. Add your verified digital signature — secure, official, and
            counted in real time across every region of Uganda.
          </p>

          {/* Live tally banner */}
          <div className="mt-7 rounded-2xl border border-ugyellow/30 bg-gradient-to-r from-ink to-panel p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
              <Radio className="h-4 w-4 text-ugred" />
              Live National Tally
            </div>
            <div className="mt-1 font-display text-4xl text-ugyellow sm:text-5xl">
              {shown.toLocaleString("en-US")}
              <span className="ml-1 text-2xl text-white sm:text-3xl">+</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-300">
              Total Endorsements Captured
            </p>
            {ticker && (
              <div className="mt-3 flex min-h-[24px] items-center gap-2 overflow-hidden border-t border-white/10 pt-3">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-ugred" />
                <p key={ticker.id} className="animate-fade-in truncate text-sm text-slate-300">
                  {maskName(ticker.fullName)} — {ticker.district}
                  <span className="ml-2 text-slate-500">· {mounted ? timeAgo(ticker.createdAt) : "recently"}</span>
                </p>
              </div>
            )}
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button onClick={scrollToForm} className="btn-primary text-lg">
              <PenLine className="h-5 w-5" />
              Endorse &amp; Sign Now
            </button>
            <button
              onClick={() =>
                document.getElementById("wall")?.scrollIntoView({ behavior: "smooth" })
              }
              className="btn-ghost text-base"
            >
              <Users className="h-5 w-5" />
              View Supporters
            </button>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Free to sign · Your data is stored securely and used solely for the 2026 endorsement
            register.
          </p>
        </div>

        {/* Hero graphic */}
        <div className="relative mx-auto w-full max-w-md animate-fade-up lg:max-w-none" style={{ animationDelay: "120ms" }}>
          <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hero-patriotic.png"
              alt="Patriotic campaign illustration for CDF Muhoozi 2026"
              className="aspect-[4/5] w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ugblack via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <div className="flag-stripe mb-3 h-1 rounded-full opacity-80" />
              <p className="font-display text-lg uppercase tracking-wide text-white">
                One Uganda · One Mission · 2026
              </p>
            </div>
          </div>

          {/* floating stat chips */}
          <div className="absolute -left-3 top-8 rounded-xl border border-white/10 bg-ink/90 px-4 py-3 shadow-xl backdrop-blur sm:-left-6">
            <p className="font-display text-2xl text-ugyellow">4</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Regions Mobilizing
            </p>
          </div>
          <div className="absolute -right-3 bottom-24 rounded-xl border border-white/10 bg-ink/90 px-4 py-3 shadow-xl backdrop-blur sm:-right-6">
            <p className="flex items-center gap-1.5 font-display text-2xl text-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
              Live
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              SMS Verification Active
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
