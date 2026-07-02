"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/components/ui";
import { StateAnalysis } from "@/components/StateAnalysis";
import { DistrictAnalysis } from "@/components/DistrictAnalysis";
import { Comparison } from "@/components/Comparison";

type Tab = "state" | "district" | "comparison";

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: "state", icon: "🗺️", label: "State Analysis" },
  { id: "district", icon: "🏘️", label: "District Analysis" },
  { id: "comparison", icon: "📊", label: "Comparison" },
];

export default function AtlasPage() {
  const [tab, setTab] = useState<Tab>("state");

  return (
    <main className="min-h-screen pb-4">
      {/* Header */}
      <header className="bg-grad-1 text-white">
        <div className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-white/70 text-sm hover:text-white transition-colors">
              ← Home
            </Link>
            <h1 className="text-3xl sm:text-4xl font-extrabold mt-1">🇮🇳 India Demographics Explorer</h1>
            <p className="text-white/80 mt-1">
              Interactive analysis of state &amp; district level demographics — Census 2011
            </p>
          </div>
          <Link
            href="/compose"
            className="hidden md:inline-flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 px-4 py-2 text-sm font-semibold backdrop-blur transition-colors"
          >
            ⚙️ Composite Builder
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Tab navigation */}
        <div className="rounded-2xl overflow-hidden shadow-card mb-8">
          <div className="flex bg-grad-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={cn("tab-btn", tab === t.id && "active")}
                onClick={() => setTab(t.id)}
              >
                <span className="text-xl">{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {tab === "state" && <StateAnalysis />}
        {tab === "district" && <DistrictAnalysis />}
        {tab === "comparison" && <Comparison />}
      </div>

      <footer className="text-center text-slate-400 text-sm py-8">
        Census of India, 2011 · Built with Next.js + FastAPI
      </footer>
    </main>
  );
}
