"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Search,
  Download,
  ShieldCheck,
  Clock3,
  X,
  Users,
  CheckCircle2,
  PenLine,
  RefreshCw,
  Database,
  HardDrive,
} from "lucide-react";
import type { Endorsement, VerificationStatus } from "@/lib/types";
import { REGIONS } from "@/lib/data";
import {
  downloadCsv,
  endorsementsToCsv,
  formatTimestamp,
  maskPhone,
  phoneKey,
  classNames,
} from "@/lib/utils";
import { svgToDataUrl } from "@/lib/signature";
import { useToast } from "./Toaster";
import { fetchEndorsements, isBackendEnabled } from "@/lib/api";

interface AdminDashboardProps {
  endorsements: Endorsement[];
  onRefresh?: (rows: Endorsement[]) => void;
}

type StatusFilter = "all" | VerificationStatus;

export function AdminDashboard({ endorsements, onRefresh }: AdminDashboardProps) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [region, setRegion] = useState<string>("all");
  const [preview, setPreview] = useState<Endorsement | null>(null);
  const [syncing, setSyncing] = useState(false);

  const syncServer = useCallback(async () => {
    if (!isBackendEnabled) return;
    setSyncing(true);
    try {
      const { endorsements: rows } = await fetchEndorsements();
      onRefresh?.(rows);
      toast.success("Register synced", `${rows.length} records loaded from the database.`);
    } catch (err) {
      toast.error("Sync failed", err instanceof Error ? err.message : "Could not reach the database.");
    } finally {
      setSyncing(false);
    }
  }, [onRefresh, toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return endorsements
      .filter((e) => {
        if (status !== "all" && e.verified !== (status === "verified")) return false;
        if (region !== "all" && e.region !== region) return false;
        if (!q) return true;
        return (
          e.nin.includes(q) ||
          phoneKey(e.phone).includes(q.replace(/\D/g, "")) ||
          e.district.toUpperCase().includes(q) ||
          e.fullName.toUpperCase().includes(q) ||
          e.subCounty.toUpperCase().includes(q)
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [endorsements, query, status, region]);

  const stats = useMemo(
    () => ({
      total: endorsements.length,
      verified: endorsements.filter((e) => e.verified).length,
      pending: endorsements.filter((e) => !e.verified).length,
    }),
    [endorsements]
  );

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.error("Nothing to export", "Adjust your filters — no records match.");
      return;
    }
    const csv = endorsementsToCsv(filtered);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`muhoozi-2031-endorsements-${stamp}.csv`, csv);
    toast.success("CSV exported", `${filtered.length} endorsement records downloaded.`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-ugyellow">
            Restricted · Campaign Officials Only
          </p>
          <h2 className="mt-2 font-display text-3xl uppercase tracking-tight text-white sm:text-4xl">
            Admin <span className="text-gold-gradient">Control Panel</span>
          </h2>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
            Search, verify and export the full endorsement register.
            <span
              className={classNames(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase",
                isBackendEnabled
                  ? "bg-green-500/15 text-green-400"
                  : "bg-slate-500/15 text-slate-400"
              )}
            >
              {isBackendEnabled ? (
                <>
                  <Database className="h-3 w-3" /> Supabase live
                </>
              ) : (
                <>
                  <HardDrive className="h-3 w-3" /> Local demo
                </>
              )}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {isBackendEnabled && (
            <button onClick={syncServer} disabled={syncing} className="btn-ghost">
              {syncing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync DB
            </button>
          )}
          <button onClick={exportCsv} className="btn-primary">
            <Download className="h-5 w-5" />
            Export All Records to CSV
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard
          icon={<Users className="h-5 w-5 text-ugyellow" />}
          label="Total Records"
          value={stats.total}
        />
        <StatCard
          icon={<ShieldCheck className="h-5 w-5 text-green-400" />}
          label="Verified"
          value={stats.verified}
        />
        <StatCard
          icon={<Clock3 className="h-5 w-5 text-orange-400" />}
          label="Pending"
          value={stats.pending}
        />
      </div>

      {/* Filters */}
      <div className="card-dark mb-5 space-y-3 p-4 sm:flex sm:items-center sm:gap-3 sm:space-y-0">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by NIN, phone, name, district or village…"
            className="w-full rounded-xl border-2 border-white/10 bg-white/5 py-3 pl-12 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-ugyellow focus:outline-none focus:ring-4 focus:ring-ugyellow/20"
          />
        </div>
        <div className="flex gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="flex-1 rounded-xl border-2 border-white/10 bg-panel px-3 py-3 text-sm font-semibold text-white focus:border-ugyellow focus:outline-none sm:flex-none"
          >
            <option value="all">All statuses</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
          </select>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="flex-1 rounded-xl border-2 border-white/10 bg-panel px-3 py-3 text-sm font-semibold text-white focus:border-ugyellow focus:outline-none sm:flex-none"
          >
            <option value="all">All regions</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mb-3 text-sm text-slate-400">
        Showing <span className="font-bold text-white">{filtered.length}</span> of{" "}
        {endorsements.length} records
      </p>

      {/* Table (desktop) */}
      <div className="hidden overflow-hidden rounded-2xl border border-white/10 lg:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Supporter</th>
              <th className="px-4 py-3">NIN</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">District / Region</th>
              <th className="px-4 py-3">Signature</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((e) => (
              <tr key={e.id} className="bg-ink/60 transition-colors hover:bg-white/5">
                <td className="px-4 py-3 font-semibold text-white">{e.fullName}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-300">{e.nin}</td>
                <td className="px-4 py-3 text-slate-300">{e.phone}</td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-slate-200">{e.district}</span>
                  <span className="block text-xs text-slate-500">{e.region}</span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setPreview(e)}
                    className="flex h-10 w-24 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white transition-transform hover:scale-105"
                    title="View signature"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={svgToDataUrl(e.signatureSvg)}
                      alt="Signature preview"
                      className="h-full w-full object-contain p-1"
                    />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge verified={e.verified} />
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{formatTimestamp(e.createdAt)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                  No endorsement records match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cards (mobile/tablet) */}
      <div className="space-y-3 lg:hidden">
        {filtered.map((e) => (
          <div key={e.id} className="card-dark p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold text-white">{e.fullName}</p>
                <p className="mt-0.5 font-mono text-xs text-slate-400">{e.nin}</p>
              </div>
              <StatusBadge verified={e.verified} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-slate-500">Phone</dt>
              <dd className="text-right text-slate-200">{maskPhone(e.phone)}</dd>
              <dt className="text-slate-500">District</dt>
              <dd className="text-right text-slate-200">
                {e.district} · {e.region}
              </dd>
              <dt className="text-slate-500">Submitted</dt>
              <dd className="text-right text-slate-200">{formatTimestamp(e.createdAt)}</dd>
            </dl>
            <button
              onClick={() => setPreview(e)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 py-2 text-xs font-bold text-slate-200 transition-colors hover:border-ugyellow/50 hover:text-ugyellow"
            >
              <PenLine className="h-3.5 w-3.5" /> View Signature
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="card-dark p-10 text-center text-slate-500">
            No endorsement records match your search.
          </div>
        )}
      </div>

      {/* Signature preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setPreview(null)}
        >
          <div
            className="w-full max-w-lg animate-scale-in overflow-hidden rounded-2xl border border-white/15 bg-ink shadow-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flag-stripe h-1" />
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-xl uppercase text-white">Attached Signature</h3>
                  <p className="text-sm text-slate-400">
                    {preview.fullName} · {preview.signatureMode === "drawn" ? "Drawn" : "Typed"} signature
                  </p>
                </div>
                <button
                  onClick={() => setPreview(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                  aria-label="Close preview"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-5 rounded-xl border-2 border-dashed border-slate-300 bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={svgToDataUrl(preview.signatureSvg)}
                  alt="Attached digital signature"
                  className="mx-auto h-auto w-full max-w-md"
                />
              </div>
              <dl className="mt-5 space-y-2 rounded-xl bg-white/5 p-4 text-sm">
                <Row label="NIN" value={preview.nin} mono />
                <Row label="Phone" value={preview.phone} />
                <Row label="District" value={`${preview.district} (${preview.region})`} />
                <Row label="Sub-County" value={preview.subCounty} />
                <Row label="Submitted" value={formatTimestamp(preview.createdAt)} />
              </dl>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="card-dark flex items-center gap-3 p-4">
      <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 sm:flex">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-display text-xl text-white sm:text-2xl">{value.toLocaleString()}</p>
        <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-bold text-green-400">
      <CheckCircle2 className="h-3.5 w-3.5" /> Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-bold text-orange-400">
      <Clock3 className="h-3.5 w-3.5" /> Pending
    </span>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="shrink-0 text-slate-400">{label}</dt>
      <dd className={classNames("truncate text-right font-semibold text-white", mono && "font-mono text-xs")}>
        {value}
      </dd>
    </div>
  );
}
