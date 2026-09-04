"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, MessageSquareText, RefreshCw, X, Loader2, LockKeyhole } from "lucide-react";
import { maskPhone } from "@/lib/utils";

interface VerificationModalProps {
  open: boolean;
  phone: string;
  fullName: string;
  onVerified: () => void;
  onClose: () => void;
}

const DEMO_CODE = "1234";
const RESEND_SECONDS = 30;

export function VerificationModal({
  open,
  phone,
  fullName,
  onVerified,
  onClose,
}: VerificationModalProps) {
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [resentCount, setResentCount] = useState(0);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const code = digits.join("");

  // Reset state whenever the modal opens
  useEffect(() => {
    if (open) {
      setDigits(["", "", "", ""]);
      setError(null);
      setVerifying(false);
      setSending(false);
      setCooldown(RESEND_SECONDS);
      setResentCount(0);
      const t = setTimeout(() => inputsRef.current[0]?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Resend cooldown timer
  useEffect(() => {
    if (!open || cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [open, cooldown]);

  // Auto-verify when 4 digits entered
  useEffect(() => {
    if (code.length === 4 && !verifying) {
      verify(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const verify = (value: string) => {
    setError(null);
    setVerifying(true);
    // Simulated gateway round-trip
    setTimeout(() => {
      if (value === DEMO_CODE) {
        setVerifying(false);
        onVerified();
      } else {
        setVerifying(false);
        setError("Incorrect code. Please check the SMS and try again.");
        setDigits(["", "", "", ""]);
        inputsRef.current[0]?.focus();
      }
    }, 900);
  };

  const resend = () => {
    if (cooldown > 0 || sending) return;
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setResentCount((n) => n + 1);
      setCooldown(RESEND_SECONDS);
      setDigits(["", "", "", ""]);
      setError(null);
      inputsRef.current[0]?.focus();
    }, 800);
  };

  const handleChange = (i: number, raw: string) => {
    const val = raw.replace(/\D/g, "");
    if (!val) {
      setDigits((d) => {
        const next = [...d];
        next[i] = "";
        return next;
      });
      return;
    }
    // Support paste of full code
    if (val.length > 1) {
      const chars = val.slice(0, 4).split("");
      setDigits((d) => {
        const next = [...d];
        chars.forEach((c, idx) => (next[idx] = c));
        return next;
      });
      inputsRef.current[Math.min(chars.length, 3)]?.focus();
      return;
    }
    setDigits((d) => {
      const next = [...d];
      next[i] = val;
      return next;
    });
    if (i < 3) inputsRef.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && i > 0) inputsRef.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 3) inputsRef.current[i + 1]?.focus();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="SMS verification"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-scale-in overflow-hidden rounded-t-3xl border border-white/15 bg-ink shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flag-stripe h-1" />
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ugyellow/15">
                <ShieldCheck className="h-6 w-6 text-ugyellow" />
              </span>
              <div>
                <h3 className="font-display text-xl uppercase tracking-wide text-white">
                  Verify Your Endorsement
                </h3>
                <p className="text-sm text-slate-400">SMS OTP confirmation</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close verification"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-slate-300">
            <span className="font-semibold text-white">{fullName.split(" ")[0]}</span>, a 4-digit
            verification code was sent via <span className="font-semibold text-ugyellow">Africa&apos;s Talking SMS</span> to{" "}
            <span className="font-semibold text-white">{maskPhone(phone)}</span>. Enter it below to
            finalize your digital signature.
          </p>

          <div className="mt-6 flex justify-between gap-2 sm:gap-3">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputsRef.current[i] = el;
                }}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={4}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                disabled={verifying}
                className="otp-input"
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>

          {error && (
            <p className="mt-3 animate-fade-in rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300">
              {error}
            </p>
          )}

          {verifying && (
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-ugyellow">
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying with the national endorsement
              registry…
            </p>
          )}

          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <MessageSquareText className="h-4 w-4 text-ugyellow" />
              {sending ? "Sending SMS…" : resentCount > 0 ? `Code resent (${resentCount})` : "Demo gateway notice"}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              This is a simulated flow. Use code{" "}
              <span className="rounded bg-ugyellow px-1.5 py-0.5 font-display text-sm tracking-widest text-ugblack">
                {DEMO_CODE}
              </span>{" "}
              to verify. Standard SMS rates apply on the live Africa&apos;s Talking gateway.
            </p>
          </div>

          <button
            onClick={resend}
            disabled={cooldown > 0 || sending}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 py-3 text-sm font-bold text-slate-200 transition-all hover:border-ugyellow/50 hover:text-ugyellow disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {cooldown > 0
              ? `Resend code via Africa's Talking in ${cooldown}s`
              : "Resend code via Africa's Talking"}
          </button>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <LockKeyhole className="h-3 w-3" />
            End-to-end secured · Your NIN is encrypted and never shared publicly.
          </p>
        </div>
      </div>
    </div>
  );
}
