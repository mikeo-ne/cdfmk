"use client";

import type { Endorsement } from "./types";
import { buildSeedEndorsements } from "./seeds";

const STORAGE_KEY = "cdfmk.endorsements.v2";

/**
 * Load endorsements from LocalStorage. On first visit the store is seeded
 * with recent mock supporters so the public wall is never empty.
 */
export function loadEndorsements(): Endorsement[] {
  if (typeof window === "undefined") return buildSeedEndorsements();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = buildSeedEndorsements();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as Endorsement[];
    if (!Array.isArray(parsed)) throw new Error("bad store");
    return parsed;
  } catch {
    const seeded = buildSeedEndorsements();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

export function saveEndorsements(list: Endorsement[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // storage full or unavailable — fail silently; in-memory state still works.
  }
}

/** Baseline live tally shown before locally stored records are added. */
export const TALLY_BASELINE = 148_920;
