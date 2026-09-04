"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import type { ToastKind, ToastMessage } from "@/lib/types";
import { classNames, uid } from "@/lib/utils";

interface ToastApi {
  push: (kind: ToastKind, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const ICONS: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-ugyellow" />,
  error: <AlertTriangle className="h-5 w-5 text-red-400" />,
  info: <Info className="h-5 w-5 text-sky-300" />,
};

const ACCENT: Record<ToastKind, string> = {
  success: "border-ugyellow/40",
  error: "border-red-500/50",
  info: "border-sky-400/40",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback(
    (kind: ToastKind, title: string, description?: string) => {
      const id = uid();
      setToasts((t) => [...t.slice(-3), { id, kind, title, description }]);
      timers.current[id] = setTimeout(() => dismiss(id), 5200);
    },
    [dismiss]
  );

  const api: ToastApi = {
    push,
    success: (t, d) => push("success", t, d),
    error: (t, d) => push("error", t, d),
    info: (t, d) => push("info", t, d),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 top-3 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:top-5 sm:w-[400px]"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={classNames(
              "pointer-events-auto flex w-full animate-scale-in items-start gap-3 rounded-xl border bg-ink/95 p-4 shadow-2xl backdrop-blur",
              ACCENT[t.kind]
            )}
          >
            <div className="mt-0.5 shrink-0">{ICONS[t.kind]}</div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm uppercase tracking-wide text-white">{t.title}</p>
              {t.description && <p className="mt-0.5 text-sm text-slate-300">{t.description}</p>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
