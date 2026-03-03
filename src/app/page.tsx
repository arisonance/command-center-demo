"use client";
import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { TabBar, type TabId } from "@/components/layout/TabBar";
import { Footer } from "@/components/layout/Footer";
import { CommandCenterView } from "@/components/views/CommandCenterView";
import { PeopleView } from "@/components/views/PeopleView";
import { usePeople } from "@/hooks/usePeople";
import { TimelineView } from "@/components/views/TimelineView";
import { TrendsView } from "@/components/views/TrendsView";
import { SalesView } from "@/components/views/SalesView";
import { EODSummary } from "@/components/modals/EODSummary";
import { LiveDataProvider, useLiveData } from "@/lib/live-data-context";

export default function Home() {
  return (
    <LiveDataProvider>
      <HomeContent />
    </LiveDataProvider>
  );
}

function HomeContent() {
  const [activeTab, setActiveTab] = useState<TabId>("command-center");
  const [eodOpen, setEodOpen] = useState(false);
  const { loading, fetchedAt, error, refetch } = useLiveData();
  const { people } = usePeople();

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Grain overlay */}
      <div className="grain-overlay" aria-hidden="true" />

      <Header
        onRefresh={refetch}
        isSyncing={loading}
        lastSyncedAt={fetchedAt}
        syncError={error}
      />

      <TabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="mb-5"
      />

      <main className="px-6 pb-8">
        {activeTab === "command-center" && <CommandCenterView />}
        {activeTab === "sales" && <SalesView />}
        {activeTab === "people" && <PeopleView people={people} />}
        {activeTab === "timeline" && <TimelineView />}
        {activeTab === "trends" && <TrendsView />}
      </main>

      <Footer onEodSummary={() => setEodOpen(true)} />

      <EODSummary isOpen={eodOpen} onClose={() => setEodOpen(false)} />
    </div>
  );
}
