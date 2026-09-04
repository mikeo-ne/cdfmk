"use client";

import { useMemo, useRef, useState } from "react";
import {
  User,
  PenLine,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Phone,
  CreditCard,
  MapPin,
  Home,
  CheckCircle2,
  PhoneCall,
  AlertCircle,
} from "lucide-react";
import type { Endorsement } from "@/lib/types";
import { DISTRICTS, SUB_COUNTY_HINTS } from "@/lib/data";
import {
  classNames,
  isValidNin,
  normalizeNin,
  normalizeUgandaPhone,
  phoneKey,
  regionForDistrict,
  uid,
} from "@/lib/utils";
import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";
import { VerificationModal } from "./VerificationModal";
import { useToast } from "./Toaster";
import { createEndorsement, isBackendEnabled } from "@/lib/api";

interface EndorsementFormProps {
  endorsements: Endorsement[];
  onSubmit: (e: Endorsement) => void;
}

interface FormState {
  fullName: string;
  phone: string;
  nin: string;
  district: string;
  subCounty: string;
  terms: boolean;
}

const STEPS = [
  { id: 1, label: "Supporter Details", icon: User },
  { id: 2, label: "Digital Signature", icon: PenLine },
  { id: 3, label: "Verify & Submit", icon: ShieldCheck },
] as const;

export function EndorsementForm({ endorsements, onSubmit }: EndorsementFormProps) {
  const toast = useToast();
  const padRef = useRef<SignaturePadHandle>(null);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({
    fullName: "",
    phone: "",
    nin: "",
    district: "",
    subCounty: "",
    terms: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [, setHasSignature] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const duplicateKeys = useMemo(() => {
    const nins = new Set<string>();
    const phones = new Set<string>();
    for (const e of endorsements) {
      nins.add(e.nin.toUpperCase());
      phones.add(phoneKey(e.phone));
    }
    return { nins, phones };
  }, [endorsements]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  /* ---------------- Step 1 validation ---------------- */

  const validateStep1 = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    const name = form.fullName.trim().replace(/\s+/g, " ");
    if (name.length < 4 || name.split(" ").length < 2) {
      next.fullName = "Enter your full official name (at least first and last name).";
    }

    const phone = normalizeUgandaPhone(form.phone);
    if (!phone) {
      next.phone = "Enter a valid MTN/Airtel number, e.g. 0772 123 456 or +256 772 123 456.";
    } else if (duplicateKeys.phones.has(phoneKey(phone))) {
      next.phone = "This phone number has already submitted an endorsement signature.";
    }

    const nin = normalizeNin(form.nin);
    if (!isValidNin(nin)) {
      next.nin = "NIN must be 14 characters (starts with a letter), as printed on your National ID.";
    } else if (duplicateKeys.nins.has(nin)) {
      next.nin = "This NIN has already submitted an endorsement signature.";
      toast.error(
        "Duplicate NIN detected",
        "This NIN has already submitted an endorsement signature."
      );
    }

    if (!form.district) next.district = "Select your district.";
    if (form.subCounty.trim().length < 3)
      next.subCounty = "Enter your sub-county, division or village.";

    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast.error("Please correct the highlighted fields");
      return false;
    }
    return true;
  };

  const goStep2 = () => {
    if (!validateStep1()) return;
    setStep(2);
    requestAnimationFrame(() =>
      window.scrollTo({
        top: document.getElementById("endorse")?.offsetTop ?? 0,
        behavior: "smooth",
      })
    );
  };

  /* ---------------- Step 2 → OTP ---------------- */

  const requestOtp = () => {
    const sig = padRef.current?.getSignature();
    if (!sig) {
      toast.error(
        "Signature required",
        "Please draw your signature or switch to the typed signature option."
      );
      return;
    }
    if (!form.terms) {
      toast.error(
        "Terms acceptance required",
        "Confirm the endorsement authorization to continue."
      );
      setErrors((er) => ({
        ...er,
        terms: "You must authorize your digital signature to continue.",
      }));
      return;
    }
    // Final duplicate re-check (guards against another tab endorsing meanwhile).
    const nin = normalizeNin(form.nin);
    const phone = normalizeUgandaPhone(form.phone)!;
    if (duplicateKeys.nins.has(nin)) {
      toast.error(
        "Duplicate NIN detected",
        "This NIN has already submitted an endorsement signature."
      );
      setStep(1);
      return;
    }
    if (duplicateKeys.phones.has(phoneKey(phone))) {
      toast.error("Duplicate phone detected", "This phone number has already submitted an endorsement.");
      setStep(1);
      return;
    }
    // The modal fires the /api/otp/request call itself (real Africa's Talking
    // SMS) or simulates the flow in demo mode.
    setOtpOpen(true);
  };

  const resetForm = () => {
    setForm({ fullName: "", phone: "", nin: "", district: "", subCounty: "", terms: false });
    setErrors({});
    setHasSignature(false);
    padRef.current?.clear();
    setStep(1);
  };

  const handleVerified = async (token: string) => {
    const sig = padRef.current?.getSignature();
    if (!sig) {
      setOtpOpen(false);
      return;
    }
    const phone = normalizeUgandaPhone(form.phone)!;
    const fullName = form.fullName.trim().replace(/\s+/g, " ");
    const subCounty = form.subCounty.trim().replace(/\s+/g, " ");

    // ---- Backend mode: persist through the Supabase-backed API ----
    if (isBackendEnabled) {
      setSaving(true);
      try {
        const { endorsement } = await createEndorsement({
          fullName,
          phone,
          nin: normalizeNin(form.nin),
          district: form.district,
          subCounty,
          signatureSvg: sig.svg,
          signatureMode: sig.mode,
          termsAccepted: true,
          token,
        });
        onSubmit(endorsement);
        setOtpOpen(false);
        setSaving(false);
        toast.success(
          "Endorsement verified and captured!",
          `Thank you, ${endorsement.fullName.split(" ")[0]} — your signature is saved to the national register.`
        );
        resetForm();
        setTimeout(
          () => document.getElementById("wall")?.scrollIntoView({ behavior: "smooth" }),
          600
        );
      } catch (err) {
        setSaving(false);
        const e = err as Error & { status?: number; fields?: Record<string, string> };
        if (e.status === 409) {
          setOtpOpen(false);
          setStep(1);
          toast.error("Duplicate detected", e.message);
        } else if (e.status === 401) {
          toast.error("Verification expired", "Please verify your phone number again.");
        } else if (e.fields) {
          setErrors(e.fields as Partial<Record<keyof FormState, string>>);
          setOtpOpen(false);
          setStep(1);
          toast.error("Please correct the highlighted fields");
        } else {
          toast.error("Submission failed", e.message || "Please try again.");
        }
      }
      return;
    }

    // ---- Demo mode: build the record locally (localStorage) ----
    const record: Endorsement = {
      id: uid(),
      fullName,
      phone,
      nin: normalizeNin(form.nin),
      district: form.district,
      region: regionForDistrict(form.district),
      subCounty,
      signatureSvg: sig.svg,
      signatureMode: sig.mode,
      termsAccepted: true,
      verified: true,
      createdAt: Date.now(),
    };
    onSubmit(record);
    setOtpOpen(false);
    toast.success(
      "Endorsement verified and captured!",
      `Thank you, ${record.fullName.split(" ")[0]} — your signature is now part of the national tally.`
    );
    resetForm();
    setTimeout(
      () => document.getElementById("wall")?.scrollIntoView({ behavior: "smooth" }),
      600
    );
  };

  const subCountyHint = form.district ? SUB_COUNTY_HINTS[form.district] : undefined;

  return (
    <section id="endorse" className="relative scroll-mt-24">
      <div className="mx-auto max-w-3xl px-4 py-14 sm:py-20">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-ugyellow">
            Official Endorsement Register
          </p>
          <h2 className="mt-2 font-display text-3xl uppercase tracking-tight text-white sm:text-4xl">
            Add Your <span className="text-gold-gradient">Digital Signature</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400 sm:text-base">
            Three quick steps. Your signature is verified by SMS and counted in the live national
            tally.
          </p>
        </div>

        {/* USSD / SMS fallback notice */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-ugyellow/30 bg-ugyellow/10 p-4">
          <PhoneCall className="mt-0.5 h-5 w-5 shrink-0 text-ugyellow" />
          <p className="text-sm text-slate-200">
            <span className="font-bold text-ugyellow">Feature phone / no internet?</span> Dial{" "}
            <span className="rounded bg-ugblack px-2 py-0.5 font-display tracking-widest text-ugyellow">
              *255#
            </span>{" "}
            or SMS your <span className="font-semibold">NIN + District</span> to{" "}
            <span className="font-display tracking-widest text-white">8226</span> to endorse via
            USSD/SMS — free on all networks.
          </p>
        </div>

        <div className="card-dark overflow-hidden">
          {/* Stepper */}
          <div className="border-b border-white/10 bg-ink/60 p-4 sm:p-5">
            <ol className="flex items-center">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const active = step === s.id;
                const done = step > s.id;
                return (
                  <li key={s.id} className={classNames("flex items-center", i < 2 && "flex-1")}>
                    <div className="flex flex-col items-center gap-1.5">
                      <span
                        className={classNames(
                          "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                          done && "border-ugyellow bg-ugyellow text-ugblack",
                          active && "border-ugyellow bg-ugyellow/15 text-ugyellow",
                          !done && !active && "border-white/20 text-slate-500"
                        )}
                      >
                        {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                      </span>
                      <span
                        className={classNames(
                          "hidden text-[11px] font-bold uppercase tracking-wide sm:block",
                          active ? "text-ugyellow" : done ? "text-white" : "text-slate-500"
                        )}
                      >
                        {s.label}
                      </span>
                    </div>
                    {i < 2 && (
                      <div
                        className={classNames(
                          "mx-2 h-0.5 flex-1 rounded transition-colors sm:mx-3",
                          done ? "bg-ugyellow" : "bg-white/15"
                        )}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="p-5 sm:p-8">
            {/* ---------------- STEP 1 (kept mounted to preserve inputs) ---------------- */}
            <div
              className={classNames(
                "space-y-5",
                step === 1 ? "animate-fade-in" : "pointer-events-none hidden"
              )}
            >
              <div>
                <label htmlFor="fullName" className="field-label !text-slate-200">
                  Full Official Name <span className="text-ugred">*</span>
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="fullName"
                    className="field-input pl-12"
                    placeholder="e.g. Mukasa John Bosco"
                    value={form.fullName}
                    onChange={(e) => set("fullName", e.target.value)}
                    autoComplete="name"
                  />
                </div>
                {errors.fullName && <FieldError msg={errors.fullName} />}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="phone" className="field-label !text-slate-200">
                    Phone Number <span className="text-ugred">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      id="phone"
                      className="field-input pl-12"
                      placeholder="+256 772 123 456"
                      inputMode="tel"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      autoComplete="tel"
                    />
                  </div>
                  {errors.phone ? (
                    <FieldError msg={errors.phone} />
                  ) : (
                    <p className="mt-1.5 text-xs text-slate-500">
                      MTN or Airtel Uganda — used for SMS verification only.
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="nin" className="field-label !text-slate-200">
                    National ID Number (NIN) <span className="text-ugred">*</span>
                  </label>
                  <div className="relative">
                    <CreditCard className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      id="nin"
                      className="field-input pl-12 uppercase tracking-wider"
                      placeholder="CF92014567P8QX"
                      value={form.nin}
                      onChange={(e) => set("nin", normalizeNin(e.target.value))}
                      maxLength={14}
                      autoComplete="off"
                    />
                  </div>
                  {errors.nin && <FieldError msg={errors.nin} />}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="district" className="field-label !text-slate-200">
                    District <span className="text-ugred">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <select
                      id="district"
                      className="field-input appearance-none pl-12"
                      value={form.district}
                      onChange={(e) => {
                        set("district", e.target.value);
                        set("subCounty", "");
                      }}
                    >
                      <option value="">Select your district…</option>
                      {DISTRICTS.map((d) => (
                        <option key={d} value={d}>
                          {d} — {regionForDistrict(d)} Region
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.district && <FieldError msg={errors.district} />}
                </div>

                <div>
                  <label htmlFor="subCounty" className="field-label !text-slate-200">
                    Sub-County / Village <span className="text-ugred">*</span>
                  </label>
                  <div className="relative">
                    <Home className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      id="subCounty"
                      className="field-input pl-12"
                      placeholder="e.g. Kawempe Division"
                      value={form.subCounty}
                      onChange={(e) => set("subCounty", e.target.value)}
                      list="subcounty-hints"
                    />
                    {subCountyHint && (
                      <datalist id="subcounty-hints">
                        {subCountyHint.map((h) => (
                          <option key={h} value={h} />
                        ))}
                      </datalist>
                    )}
                  </div>
                  {errors.subCounty && <FieldError msg={errors.subCounty} />}
                </div>
              </div>

              <button onClick={goStep2} className="btn-primary w-full text-lg">
                Continue to Signature
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>

            {/* ---------------- STEP 2 (kept mounted to preserve the canvas) ---------------- */}
            <div
              className={classNames(
                "space-y-5",
                step === 2 ? "animate-fade-in" : "pointer-events-none hidden"
              )}
            >
              <div>
                <p className="field-label !text-slate-200">
                  Sign for <span className="text-ugyellow">{form.fullName || "…"}</span>
                </p>
                <SignaturePad
                  ref={padRef}
                  typedName={form.fullName}
                  onChange={setHasSignature}
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-white/10 bg-white/5 p-4 transition-colors hover:border-ugyellow/40">
                <input
                  type="checkbox"
                  checked={form.terms}
                  onChange={(e) => {
                    set("terms", e.target.checked);
                    setErrors((er) => ({ ...er, terms: undefined }));
                  }}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-ugyellow"
                />
                <span className="text-sm leading-relaxed text-slate-200">
                  I hereby confirm my support and authorize my digital signature for candidate
                  endorsement of <strong>CDF General Muhoozi Kainerugaba</strong> for the 2031
                  national leadership journey.
                </span>
              </label>
              {errors.terms && <FieldError msg={errors.terms} />}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button onClick={() => setStep(1)} className="btn-ghost flex-1">
                  <ArrowLeft className="h-5 w-5" /> Back to Details
                </button>
                <button onClick={requestOtp} className="btn-red flex-1 text-lg">
                  Submit Endorsement
                  <ShieldCheck className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <VerificationModal
          open={otpOpen}
          phone={normalizeUgandaPhone(form.phone) ?? form.phone}
          fullName={form.fullName}
          onVerified={handleVerified}
          onClose={() => {
            if (!saving) setOtpOpen(false);
          }}
        />

        {saving && (
          <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-ugyellow/30 bg-ink px-8 py-8">
              <ShieldCheck className="h-12 w-12 animate-pulse text-ugyellow" />
              <p className="font-display text-lg uppercase tracking-wide text-white">
                Saving to National Register…
              </p>
              <p className="text-sm text-slate-400">Securing your endorsement in the database.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold text-red-400">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {msg}
    </p>
  );
}
