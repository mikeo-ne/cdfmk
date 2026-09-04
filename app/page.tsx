"use client";

import { useEffect, useState } from "react";
import { ToastProvider } from "@/components/Toaster";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { EndorsementForm } from "@/components/EndorsementForm";
import { SupporterWall } from "@/components/SupporterWall";
import { AdminDashboard } from "@/components/AdminDashboard";
import { Footer } from "@/components/Footer";
import { loadEndorsements, saveEndorsements } from "@/lib/storage";
import type { Endorsement } from "@/lib/types";

export default function Home() {
  const [view, setView] = useState<"portal" | "admin">("portal");
  // Lazy initializer: seeds LocalStorage on first visit, no hydration flash.
  const [endorsements, setEndorsements] = useState<Endorsement[]>(() => loadEndorsements());

  useEffect(() => {
    saveEndorsements(endorsements);
  }, [endorsements]);

  const addEndorsement = (record: Endorsement) => {
    setEndorsements((list) => [record, ...list]);
  };

  return (
    <ToastProvider>
      <Header
        view={view}
        onToggleView={() => setView((v) => (v === "portal" ? "admin" : "portal"))}
      />

      {view === "portal" ? (
        <main>
          <Hero endorsements={endorsements} />
          <EndorsementForm endorsements={endorsements} onSubmit={addEndorsement} />
          <SupporterWall endorsements={endorsements} />
        </main>
      ) : (
        <main className="min-h-screen">
          <AdminDashboard endorsements={endorsements} />
        </main>
      )}

      <Footer />
    </ToastProvider>
  );
}
