"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Eraser, Undo2, Keyboard, PenTool, Hand } from "lucide-react";
import type { SignaturePoint, SignatureStroke } from "@/lib/types";
import {
  SIG_HEIGHT,
  SIG_WIDTH,
  strokesToSvg,
  svgToDataUrl,
  typedSignatureSvg,
} from "@/lib/signature";
import { classNames } from "@/lib/utils";

export interface SignaturePadHandle {
  /** Returns the SVG string, or null if the pad is empty. */
  getSignature: () => { svg: string; dataUrl: string; mode: "drawn" | "typed" } | null;
  clear: () => void;
}

interface SignaturePadProps {
  typedName: string;
  onChange?: (hasSignature: boolean) => void;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad({ typedName, onChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const strokesRef = useRef<SignatureStroke[]>([]);
    const currentRef = useRef<SignaturePoint[] | null>(null);
    const drawingRef = useRef(false);
    const dprRef = useRef(1);

    const [mode, setMode] = useState<"draw" | "typed">("draw");
    const [hasInk, setHasInk] = useState(false);

    const notify = useCallback(
      (has: boolean) => {
        setHasInk(has);
        onChange?.(has);
      },
      [onChange]
    );

    /* ---------- canvas setup (DPR-aware, responsive) ---------- */

    const setupCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const cssW = wrap.clientWidth;
      const cssH = Math.max(180, Math.round(cssW * (SIG_HEIGHT / SIG_WIDTH)));
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      dprRef.current = dpr;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
      redraw(cssW, cssH);
    }, []);

    const redraw = useCallback((cssW?: number, cssH?: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = cssW ?? canvas.clientWidth;
      const h = cssH ?? canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      // baseline guide
      ctx.strokeStyle = "rgba(17,24,39,0.18)";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(16, h - 34);
      ctx.lineTo(w - 16, h - 34);
      ctx.stroke();
      ctx.setLineDash([]);

      const scaleX = w / SIG_WIDTH;
      const scaleY = h / SIG_HEIGHT;
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 2.4 * Math.max(1, (scaleX + scaleY) / 2) * 0.8;
      const all = currentRef.current
        ? [...strokesRef.current, { points: currentRef.current }]
        : strokesRef.current;
      for (const stroke of all) drawStroke(ctx, stroke.points, scaleX, scaleY);
    }, []);

    function drawStroke(
      ctx: CanvasRenderingContext2D,
      points: SignaturePoint[],
      sx: number,
      sy: number
    ) {
      if (points.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(points[0].x * sx, points[0].y * sy);
      if (points.length === 1) {
        ctx.lineTo(points[0].x * sx + 0.5, points[0].y * sy);
      } else {
        for (let i = 1; i < points.length - 1; i++) {
          const mx = ((points[i].x + points[i + 1].x) / 2) * sx;
          const my = ((points[i].y + points[i + 1].y) / 2) * sy;
          ctx.quadraticCurveTo(points[i].x * sx, points[i].y * sy, mx, my);
        }
        const last = points[points.length - 1];
        ctx.lineTo(last.x * sx, last.y * sy);
      }
      ctx.stroke();
    }

    useEffect(() => {
      setupCanvas();
      const onResize = () => setupCanvas();
      window.addEventListener("resize", onResize);
      // Re-fit when the container size changes (e.g. step panel unhiding).
      const wrap = wrapRef.current;
      let observer: ResizeObserver | null = null;
      if (wrap && typeof ResizeObserver !== "undefined") {
        let lastW = wrap.clientWidth;
        observer = new ResizeObserver(() => {
          if (wrap.clientWidth !== 0 && wrap.clientWidth !== lastW) {
            lastW = wrap.clientWidth;
            setupCanvas();
          }
        });
        observer.observe(wrap);
      }
      return () => {
        window.removeEventListener("resize", onResize);
        observer?.disconnect();
      };
    }, [setupCanvas]);

    /* ---------- pointer drawing (mouse + touchscreen) ---------- */

    const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): SignaturePoint => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * SIG_WIDTH;
      const y = ((e.clientY - rect.top) / rect.height) * SIG_HEIGHT;
      return { x: Math.max(0, Math.min(SIG_WIDTH, x)), y: Math.max(0, Math.min(SIG_HEIGHT, y)) };
    };

    const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (mode !== "draw") return;
      e.preventDefault();
      canvasRef.current?.setPointerCapture(e.pointerId);
      drawingRef.current = true;
      currentRef.current = [getPoint(e)];
      redraw();
    };

    const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current || mode !== "draw" || !currentRef.current) return;
      e.preventDefault();
      // coalesced events for smoother/faster touch strokes
      const native = e.nativeEvent as PointerEvent & {
        getCoalescedEvents?: () => PointerEvent[];
      };
      const events = native.getCoalescedEvents?.() ?? [native];
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      for (const ev of events) {
        const x = ((ev.clientX - rect.left) / rect.width) * SIG_WIDTH;
        const y = ((ev.clientY - rect.top) / rect.height) * SIG_HEIGHT;
        currentRef.current.push({
          x: Math.max(0, Math.min(SIG_WIDTH, x)),
          y: Math.max(0, Math.min(SIG_HEIGHT, y)),
        });
      }
      redraw();
    };

    const finishStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      e.preventDefault();
      drawingRef.current = false;
      if (currentRef.current && currentRef.current.length > 0) {
        strokesRef.current = [...strokesRef.current, { points: currentRef.current }];
      }
      currentRef.current = null;
      redraw();
      notify(strokesRef.current.length > 0);
    };

    /* ---------- controls ---------- */

    const clear = useCallback(() => {
      strokesRef.current = [];
      currentRef.current = null;
      redraw();
      notify(false);
    }, [redraw, notify]);

    const undo = () => {
      strokesRef.current = strokesRef.current.slice(0, -1);
      redraw();
      notify(strokesRef.current.length > 0);
    };

    useImperativeHandle(ref, () => ({
      clear,
      getSignature: () => {
        if (mode === "typed") {
          if (!typedName.trim()) return null;
          const svg = typedSignatureSvg(typedName.trim());
          return { svg, dataUrl: svgToDataUrl(svg), mode: "typed" };
        }
        if (strokesRef.current.length === 0) return null;
        const svg = strokesToSvg(strokesRef.current);
        return { svg, dataUrl: svgToDataUrl(svg), mode: "drawn" };
      },
    }));

    const typedSvgDataUrl =
      mode === "typed" && typedName.trim()
        ? svgToDataUrl(typedSignatureSvg(typedName.trim()))
        : null;

    return (
      <div>
        {/* mode tabs */}
        <div className="mb-3 flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode("draw")}
            className={classNames(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all",
              mode === "draw" ? "bg-ugblack text-ugyellow shadow" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <PenTool className="h-4 w-4" /> Draw Signature
          </button>
          <button
            type="button"
            onClick={() => setMode("typed")}
            className={classNames(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all",
              mode === "typed" ? "bg-ugblack text-ugyellow shadow" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Keyboard className="h-4 w-4" /> Typed Signature
          </button>
        </div>

        <div
          ref={wrapRef}
          className="relative overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-white"
        >
          {mode === "draw" ? (
            <canvas
              ref={canvasRef}
              className="signature-canvas block w-full cursor-crosshair"
              onPointerDown={handleDown}
              onPointerMove={handleMove}
              onPointerUp={finishStroke}
              onPointerCancel={finishStroke}
              onPointerLeave={finishStroke}
            />
          ) : (
            <div className="flex min-h-[200px] items-center justify-center p-4">
              {typedSvgDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={typedSvgDataUrl}
                  alt="Typed digital signature preview"
                  className="h-auto w-full max-w-md"
                />
              ) : (
                <p className="text-center text-sm text-slate-400">
                  Enter your full name in Step 1 and your typed signature will appear here in a
                  formal signature script.
                </p>
              )}
            </div>
          )}

          {mode === "draw" && !hasInk && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Hand className="h-8 w-8" />
              <p className="text-sm font-semibold">Sign here with finger, stylus or mouse</p>
            </div>
          )}
        </div>

        {/* canvas controls */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={mode !== "draw" || strokesRef.current.length === 0}
            className="btn-ghost !border-slate-300 !bg-white !py-2.5 !text-slate-700 hover:!border-uggold disabled:!opacity-40"
          >
            <Undo2 className="h-4 w-4" /> Undo Last Stroke
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={mode !== "draw" && !typedName.trim()}
            className="btn-ghost !border-slate-300 !bg-white !py-2.5 !text-slate-700 hover:!border-ugred disabled:!opacity-40"
          >
            <Eraser className="h-4 w-4" /> Clear Canvas
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {mode === "draw"
            ? "Draw inside the box above. Your signature is captured as scalable vector graphics (SVG) for a crisp, official record."
            : "Typed signatures are rendered in a formal cursive script and legally binding when paired with SMS verification."}
        </p>
      </div>
    );
  }
);
