"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, TrendingUp, MapPinned, BarChart3, List, Lock, ShieldCheck } from "lucide-react";
import type { DistrictStat, Endorsement, Region, WallEntry } from "@/lib/types";
import { DISTRICT_REGION, REGIONS, REGION_META } from "@/lib/data";
import { classNames, maskName, maskNin, maskPhone, timeAgo } from "@/lib/utils";
import { resolveSignatureSrc } from "@/lib/signature";
import { fetchRegionalStats, fetchSupporterWall, isBackendEnabled } from "@/lib/api";

interface SupporterWallProps {
  endorsements: Endorsement[];
}

export function SupporterWall({ endorsements }: SupporterWallProps) {
  const [regionView, setRegionView] = useState<"chart" | "table">("chart");
  const [wall, setWall] = useState<WallEntry[] | null>(null);
  const [districtStats, setDistrictStats] = useState<DistrictStat[] | null>(null);

  // Live mode: pull the masked public view + district stats RPC, poll for new rows.
  useEffect(() => {
    if (!isBackendEnabled) return;
    let alive = true;
    const load = async () => {
      try {
        const [entries, stats] = await Promise.all([
          fetchSupporterWall(),
          fetchRegionalStats(),
        ]);
        if (!alive) return;
        setWall(entries);
        setDistrictStats(stats);
      } catch (err) {
        console.error("Supporter wall data load failed", err);
      }
    };
    void load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const demoRecent = useMemo(
    () => [...endorsements].sort((a, b) => b.createdAt - a.createdAt).slice(0, 12),
    [endorsements]
  );

  const live = isBackendEnabled && wall !== null;

  const byRegion = useMemo(() => {
    const counts: Record<Region, number> = { Central: 0, Western: 0, Northern: 0, Eastern: 0 };
    if (districtStats) {
      for (const s of districtStats) {
        const region = DISTRICT_REGION[s.district] ?? "Central";
        counts[region] += s.totalEndorsements;
      }
    } else {
      for (const e of endorsements) counts[e.region] += 1;
    }
    return counts;
  }, [districtStats, endorsements]);

  const total = Object.values(byRegion).reduce((a, b) => a + b, 0);
  const maxRegion = Math.max(1, ...Object.values(byRegion));

  return (
    <section id="wall" className="scroll-mt-24 border-t border-white/10 bg-ink/40">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <div className="mb-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-ugyellow">
            Live Endorsement Feed
          </p>
          <h2 className="mt-2 font-display text-3xl uppercase tracking-tight text-white sm:text-4xl">
            The People&apos;s <span className="text-gold-gradient">Supporter Wall</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">
            Real-time endorsements from every corner of Uganda. Identities are masked publicly for
            privacy — full records are visible only in the verified admin dashboard.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-5">
          {/* Recent endorsers feed */}
          <div className="lg:col-span-3">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ugred/15">
                <Users className="h-5 w-5 text-ugred" />
              </span>
              <h3 className="font-display text-lg uppercase tracking-wide text-white">
                Recent Endorsers
              </h3>
              <span className="ml-auto flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1 text-xs font-bold text-green-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                LIVE
              </span>
            </div>

            <ul className="space-y-3">
              {live
                ? wall.slice(0, 12).map((e, idx) => (
                    <li
                      key={e.id}
                      className={classNames(
                        "card-dark flex items-center gap-3 p-4 transition-all hover:border-ugyellow/40",
                        idx === 0 && "border-ugyellow/30"
                      )}
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ugyellow/15 font-display text-xl text-ugyellow">
                        {e.maskedName.replace(/[^A-Za-z*]/g, "").charAt(0) || "U"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-white">
                          {e.maskedName}
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-ugyellow/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ugyellow">
                            <MapPinned className="h-3 w-3" />
                            {e.district}
                          </span>
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          Verified signature captured
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-semibold text-slate-300">{timeAgo(e.createdAt)}</p>
                        <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] font-bold uppercase text-green-400">
                          <Lock className="h-3 w-3" /> Verified
                        </p>
                      </div>
                    </li>
                  ))
                : demoRecent.map((e, idx) => (
                    <li
                      key={e.id}
                      className={classNames(
                        "card-dark flex items-center gap-3 p-4 transition-all hover:border-ugyellow/40",
                        idx === 0 && "border-ugyellow/30"
                      )}
                    >
                      {/* signature thumbnail */}
                      <div className="hidden h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white p-1 sm:flex">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resolveSignatureSrc(e.signatureSvg)}
                          alt=""
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-white">
                          {maskName(e.fullName)}
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-ugyellow/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ugyellow">
                            <MapPinned className="h-3 w-3" />
                            {e.district}
                          </span>
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          {maskPhone(e.phone)} · NIN {maskNin(e.nin)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-semibold text-slate-300">{timeAgo(e.createdAt)}</p>
                        {e.verified && (
                          <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] font-bold uppercase text-green-400">
                            <Lock className="h-3 w-3" /> Verified
                          </p>
                        )}
                      </div>
                    </li>
                  ))}

              {live && wall.length === 0 && (
                <li className="card-dark flex items-center gap-3 p-6 text-sm text-slate-400">
                  <ShieldCheck className="h-5 w-5 text-ugyellow" />
                  No verified endorsements yet — be the first to sign for 2031.
                </li>
              )}
            </ul>
          </div>

          {/* Regional analytics */}
          <div id="analytics" className="scroll-mt-24 lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ugyellow/15">
                <TrendingUp className="h-5 w-5 text-ugyellow" />
              </span>
              <h3 className="font-display text-lg uppercase tracking-wide text-white">
                Regional Analytics
              </h3>
            </div>

            <div className="card-dark p-5">
              {/* toggle */}
              <div className="mb-5 flex rounded-xl bg-white/5 p-1">
                <button
                  onClick={() => setRegionView("chart")}
                  className={classNames(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold transition-all",
                    regionView === "chart" ? "bg-ugyellow text-ugblack" : "text-slate-400"
                  )}
                >
                  <BarChart3 className="h-4 w-4" /> Chart
                </button>
                <button
                  onClick={() => setRegionView("table")}
                  className={classNames(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold transition-all",
                    regionView === "table" ? "bg-ugyellow text-ugblack" : "text-slate-400"
                  )}
                >
                  <List className="h-4 w-4" /> Table
                </button>
              </div>

              {regionView === "chart" ? (
                <div className="space-y-4">
                  {REGIONS.map((r) => {
                    const count = byRegion[r];
                    const pct = total ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={r}>
                        <div className="mb-1.5 flex items-center justify-between text-sm">
                          <span className="font-bold text-slate-200">{r} Region</span>
                          <span className={classNames("font-display", REGION_META[r].color)}>
                            {count.toLocaleString()}
                          </span>
                        </div>
                        <div className="h-3.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className={classNames(
                              "h-full rounded-full transition-all duration-700",
                              REGION_META[r].bar
                            )}
                            style={{ width: `${Math.max(4, (count / maxRegion) * 100)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-right text-[11px] text-slate-500">{pct}% share</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-3 py-2.5">Region</th>
                        <th className="px-3 py-2.5 text-right">Count</th>
                        <th className="px-3 py-2.5 text-right">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {REGIONS.map((r) => (
                        <tr key={r} className="border-t border-white/5">
                          <td className="px-3 py-2.5">
                            <span className="flex items-center gap-2 font-semibold text-slate-200">
                              <span className={classNames("h-2.5 w-2.5 rounded-full", REGION_META[r].ring)} />
                              {r}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-display text-white">
                            {byRegion[r].toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-400">
                            {total ? Math.round((byRegion[r] / total) * 100) : 0}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-5">
                <div className="rounded-xl bg-white/5 p-3 text-center">
                  <p className="font-display text-2xl text-ugyellow">
                    {live ? total.toLocaleString() : endorsements.length.toLocaleString()}
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {live ? "Verified Signatures" : "Captured Here"}
                  </p>
                </div>
                <div className="rounded-xl bg-white/5 p-3 text-center">
                  <p className="font-display text-2xl text-white">
                    {districtStats ? districtStats.length : 10}
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Districts Active
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
