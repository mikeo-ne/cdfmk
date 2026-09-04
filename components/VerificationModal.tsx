"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck, MessageSquareText, RefreshCw, X, Loader2, LockKeyhole } from "lucide-react";
import { maskPhone } from "@/lib/utils";
import { isBackendEnabled, requestOtp, verifyOtp } from "@/lib/api";
import { DEMO_OTP_CODE } from "@/lib/config";

interface VerificationModalProps {
  open: boolean;
  phone: string;
  fullName: string;
  /** Called with a signed verification token after the code is accepted. */
  onVerified: (token: string) => void;
  onClose: () => void;
}

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
  const [smsSent, setSmsSent] = useState(false);
  const [autoVerifying, setAutoVerifying] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const code = digits.join("");

  // Reset state whenever the modal opens and (in backend mode) request the OTP.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDigits(["", "", "", ""]);
    setError(null);
    setVerifying(false);
    setSending(false);
    setCooldown(RESEND_SECONDS);
    setResentCount(0);
    setSmsSent(false);
    setAutoVerifying(false);
    const focusT = setTimeout(() => inputsRef.current[0]?.focus(), 300);

    if (isBackendEnabled) {
      setSending(true);
      requestOtp(phone)
        .then((res) => {
          if (cancelled) return;
          setSending(false);
          setSmsSent(Boolean(res.smsSent));
          if (res.cooldownSeconds) setCooldown(res.cooldownSeconds);
        })
        .catch((err: Error) => {
          if (cancelled) return;
          setSending(false);
          setError(err.message || "Could not send the SMS code. You may retry.");
        });
    }

    return () => {
      cancelled = true;
      clearTimeout(focusT);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phone]);

  // Resend cooldown timer
  useEffect(() => {
    if (!open || cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [open, cooldown]);

  const verify = useCallback(
    async (value: string) => {
      setError(null);
      setVerifying(true);

      const accept = (token: string) => {
        setVerifying(false);
        onVerified(token);
      };

      if (isBackendEnabled) {
        try {
          const res = await verifyOtp(phone, value);
          if (res.ok && res.token) {
            accept(res.token);
          } else {
            throw new Error(res.error || "Verification failed.");
          }
        } catch (err) {
          setVerifying(false);
          setError(err instanceof Error ? err.message : "Verification failed. Try again.");
          setDigits(["", "", "", ""]);
          inputsRef.current[0]?.focus();
        }
        return;
      }

      // Demo (simulated) gateway — local round-trip.
      setTimeout(() => {
        if (value === DEMO_OTP_CODE) {
          accept(`demo-${DEMO_OTP_CODE}`);
        } else {
          setVerifying(false);
          setError("Incorrect code. Please check the SMS and try again.");
          setDigits(["", "", "", ""]);
          inputsRef.current[0]?.focus();
        }
      }, 700);
    },
    [onVerified, phone]
  );

  // Auto-verify when 4 digits are entered
  useEffect(() => {
    if (code.length === 4 && !verifying && !autoVerifying) {
      setAutoVerifying(true);
      void verify(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const resend = async () => {
    if (cooldown > 0 || sending) return;
    setError(null);
    if (!isBackendEnabled) {
      setSending(true);
      setTimeout(() => {
        setSending(false);
        setResentCount((n) => n + 1);
        setCooldown(RESEND_SECONDS);
        setDigits(["", "", "", ""]);
        inputsRef.current[0]?.focus();
      }, 700);
      return;
    }
    setSending(true);
    try {
      const res = await requestOtp(phone);
      setSending(false);
      setResentCount((n) => n + 1);
      setCooldown(res.cooldownSeconds ?? RESEND_SECONDS);
      setSmsSent(Boolean(res.smsSent));
      setDigits(["", "", "", ""]);
      inputsRef.current[0]?.focus();
    } catch (err) {
      setSending(false);
      setError(err instanceof Error ? err.message : "Resend failed. Try again shortly.");
    }
  };

  const handleChange = (i: number, raw: string) => {
    setAutoVerifying(false);
    const val = raw.replace(/\D/g, "");
    if (!val) {
      setDigits((d) => {
        const next = [...d];
        next[i] = "";
        return next;
      });
      return;
    }
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
    if (e.key === "Backspace" && !digits[i] && i > 0) inputsRef.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) inputsRef.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 3) inputsRef.current[i + 1]?.focus();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
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
            <span className="font-semibold text-white">{fullName.split(" ")[0] || "Supporter"}</span>,
            a 4-digit verification code was sent via{" "}
            <span className="font-semibold text-ugyellow">Africa&apos;s Talking SMS</span> to{" "}
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
                disabled={verifying || sending}
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
          {sending && !verifying && (
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" /> Sending your code via Africa&apos;s
              Talking SMS…
            </p>
          )}

          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <MessageSquareText className="h-4 w-4 text-ugyellow" />
              {sending
                ? "Dispatching SMS…"
                : smsSent
                  ? resentCount > 0
                    ? `Code resent via SMS (${resentCount})`
                    : "SMS dispatched"
                  : "Sandbox / demo gateway"}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              {isBackendEnabled ? (
                smsSent ? (
                  <>
                    A real SMS was sent through <strong>Africa&apos;s Talking</strong>. Standard
                    network rates apply. If no SMS arrives, use resend or check the gateway logs.
                  </>
                ) : (
                  <>
                    Connected to the live gateway. OTPs are 4 digits and expire after 5 minutes.
                  </>
                )
              ) : (
                <>
                  This is a simulated flow (no SMS gateway configured). Use code{" "}
                  <span className="rounded bg-ugyellow px-1.5 py-0.5 font-display text-sm tracking-widest text-ugblack">
                    {DEMO_OTP_CODE}
                  </span>{" "}
                  to verify. Add Africa&apos;s Talking credentials to <code>.env.local</code> to
                  send real SMS.
                </>
              )}
            </p>
          </div>

          <button
            onClick={resend}
            disabled={cooldown > 0 || sending}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 py-3 text-sm font-bold text-slate-200 transition-all hover:border-ugyellow/50 hover:text-ugyellow disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
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
