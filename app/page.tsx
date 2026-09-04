"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ToastProvider } from "@/components/Toaster";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { EndorsementForm } from "@/components/EndorsementForm";
import { SupporterWall } from "@/components/SupporterWall";
import { AdminDashboard } from "@/components/AdminDashboard";
import { Footer } from "@/components/Footer";
import { loadEndorsements, saveEndorsements } from "@/lib/storage";
import { fetchEndorsements, isBackendEnabled } from "@/lib/api";
import type { Endorsement } from "@/lib/types";

export default function Home() {
  const [view, setView] = useState<"portal" | "admin">("portal");
  // Seed with local demo data immediately (no hydration flash), then sync
  // with the live Supabase-backed API in the background when configured.
  const [endorsements, setEndorsements] = useState<Endorsement[]>(() => loadEndorsements());
  const [source, setSource] = useState<"supabase" | "demo" | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (isBackendEnabled) {
      fetchEndorsements()
        .then(({ endorsements: rows, source: src }) => {
          if (rows.length > 0) {
            setEndorsements(rows);
            saveEndorsements(rows);
          }
          setSource(src);
        })
        .catch((err) => {
          console.error("Failed to sync with backend, using local store:", err);
          setSource("demo");
        });
    } else {
      setSource("demo");
    }
  }, []);

  // Persist the local copy (demo mode offline support + optimistic cache).
  useEffect(() => {
    saveEndorsements(endorsements);
  }, [endorsements]);

  const addEndorsement = useCallback((record: Endorsement) => {
    setEndorsements((list) => [record, ...list]);
  }, []);

  const replaceAll = useCallback((rows: Endorsement[]) => {
    setEndorsements(rows);
  }, []);

  return (
    <ToastProvider>
      <Header
        view={view}
        onToggleView={() => setView((v) => (v === "portal" ? "admin" : "portal"))}
      />

      {view === "portal" ? (
        <main>
          <Hero endorsements={endorsements} backendEnabled={isBackendEnabled} source={source} />
          <EndorsementForm endorsements={endorsements} onSubmit={addEndorsement} />
          <SupporterWall endorsements={endorsements} />
        </main>
      ) : (
        <main className="min-h-screen">
          <AdminDashboard endorsements={endorsements} onRefresh={replaceAll} />
        </main>
      )}

      <Footer />
    </ToastProvider>
  );
}
