"use client";
import { WeatherCard } from "@/components/command-center/WeatherCard";
import { SlackCard } from "@/components/command-center/SlackCard";
import { AIFeedCard } from "@/components/command-center/AIFeedCard";
import { PriorityEngine } from "@/components/command-center/PriorityEngine";
import { CalendarTimeline } from "@/components/command-center/CalendarTimeline";
import { ReplyCenter } from "@/components/command-center/ReplyCenter";
import { JeanaSection } from "@/components/command-center/JeanaSection";
import { SalesforcePipeline } from "@/components/command-center/SalesforcePipeline";
import { PowerBIKPIs } from "@/components/command-center/PowerBIKPIs";
import { PowerBIReports } from "@/components/command-center/PowerBIReports";
import { MeetingPrep } from "@/components/command-center/MeetingPrep";
import { OverdueTasks } from "@/components/command-center/OverdueTasks";
import { useCalendar } from "@/hooks/useCalendar";
import { useTasks } from "@/hooks/useTasks";
import { useEmails } from "@/hooks/useEmails";
import { usePriorityScore } from "@/hooks/usePriorityScore";
import {
  transformCalendarEvents,
  transformMeetingPrep,
  transformOverdueTasks,
  transformJeanaItems,
} from "@/lib/transformers";

interface CommandCenterViewProps {
  onOpenPreferences?: () => void;
}

export function CommandCenterView({ onOpenPreferences }: CommandCenterViewProps) {
  const { events: calEvents } = useCalendar();
  const { tasks } = useTasks();
  const { emails } = useEmails();
  const { items: priorityItems } = usePriorityScore();

  const calTimeline = transformCalendarEvents(calEvents);
  const meetingPrep = transformMeetingPrep(calEvents);
  const { overdue, stale } = transformOverdueTasks(tasks);
  const jeanaItems = transformJeanaItems(tasks);

  return (
    <div className="space-y-5">

      {/* ── Row 1: Priority Engine (full width, most important) ─────── */}
      <PriorityEngine items={priorityItems} />

      {/* ── Row 2: Reply Center ─────────────────────────────────────── */}
      <ReplyCenter />

      {/* ── Row 3: Calendar + Weather/Slack side-by-side ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
        <CalendarTimeline events={calTimeline} />
        <div className="space-y-5">
          <WeatherCard />
          <SlackCard />
        </div>
      </div>

      {/* ── Row 4: Meeting Prep + Jeana ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MeetingPrep meetings={meetingPrep} />
        <JeanaSection items={jeanaItems} />
      </div>

      {/* ── Row 5: AI Feed ──────────────────────────────────────────── */}
      <AIFeedCard />

      {/* ── Row 6: Overdue Tasks ────────────────────────────────────── */}
      {(overdue.length > 0 || stale.length > 0) && (
        <OverdueTasks items={overdue} staleItems={stale} />
      )}

      {/* ── Row 7: Power BI ─────────────────────────────────────────── */}
      <PowerBIKPIs />
      <PowerBIReports />

      {/* ── Row 8: Salesforce Pipeline ──────────────────────────────── */}
      <SalesforcePipeline />

    </div>
  );
}
