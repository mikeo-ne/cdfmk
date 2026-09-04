"use client";

import { ShieldCheck, LayoutDashboard, Users, Menu, X } from "lucide-react";
import { useState } from "react";
import { classNames } from "@/lib/utils";

interface HeaderProps {
  view: "portal" | "admin";
  onToggleView: () => void;
}

export function Header({ view, onToggleView }: HeaderProps) {
  const [open, setOpen] = useState(false);

  const scrollTo = (id: string) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-ugblack/90 backdrop-blur-md">
      <div className="flag-stripe h-1 w-full opacity-90" />
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <button
          onClick={() => view === "admin" && onToggleView()}
          className="flex items-center gap-3 text-left"
          aria-label="Muhoozi 2031 home"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ugyellow text-ugblack shadow-lg">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-sm uppercase tracking-wider text-white sm:text-base">
              Muhoozi <span className="text-gold-gradient">2031</span>
            </span>
            <span className="hidden text-[11px] font-medium uppercase tracking-widest text-slate-400 sm:block">
              Endorsement &amp; Signature Portal
            </span>
          </span>
        </button>

        <nav className="hidden items-center gap-1 md:flex">
          {view === "portal" && (
            <>
              <button
                onClick={() => scrollTo("endorse")}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-ugyellow"
              >
                Endorse
              </button>
              <button
                onClick={() => scrollTo("wall")}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-ugyellow"
              >
                Supporters
              </button>
              <button
                onClick={() => scrollTo("analytics")}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-ugyellow"
              >
                Regions
              </button>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <button onClick={onToggleView} className="btn-ghost !px-4 !py-2.5 text-xs sm:text-sm">
            {view === "portal" ? (
              <>
                <LayoutDashboard className="h-4 w-4 text-ugyellow" />
                Admin Dashboard
              </>
            ) : (
              <>
                <Users className="h-4 w-4 text-ugyellow" />
                Public Portal
              </>
            )}
          </button>
          {view === "portal" && (
            <button
              className="rounded-lg p-2 text-slate-300 hover:bg-white/10 md:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          )}
        </div>
      </div>

      {open && view === "portal" && (
        <div className="border-t border-white/10 bg-ink px-4 py-3 md:hidden">
          {[
            { id: "endorse", label: "Endorse & Sign" },
            { id: "wall", label: "Supporter Wall" },
            { id: "analytics", label: "Regional Analytics" },
          ].map((l) => (
            <button
              key={l.id}
              onClick={() => scrollTo(l.id)}
              className={classNames(
                "block w-full rounded-lg px-3 py-3 text-left font-display text-sm uppercase tracking-wide text-slate-200",
                "hover:bg-white/10 hover:text-ugyellow"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
