"use client";

import { useEffect, useState } from "react";

/** Returns false during SSR + first client render, true after mount. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
