"use client";
import { WeatherCard } from "@/components/command-center/WeatherCard";
import { SlackCard } from "@/components/command-center/SlackCard";
import { AIFeedCard } from "@/components/command-center/AIFeedCard";
import { CalendarTimeline } from "@/components/command-center/CalendarTimeline";
import { ReplyCenter } from "@/components/command-center/ReplyCenter";
import { JeanaSection } from "@/components/command-center/JeanaSection";
import { SalesforcePipeline } from "@/components/command-center/SalesforcePipeline";
import { PowerBIKPIs } from "@/components/command-center/PowerBIKPIs";
import { PowerBIReports } from "@/components/command-center/PowerBIReports";
import { MeetingPrep } from "@/components/command-center/MeetingPrep";
import { OverdueTasks } from "@/components/command-center/OverdueTasks";
import { useAuth } from "@/hooks/useAuth";
import { useCalendar } from "@/hooks/useCalendar";
import { useTasks } from "@/hooks/useTasks";
import {
  transformCalendarEvents,
  transformMeetingPrep,
  transformOverdueTasks,
  transformJeanaItems,
} from "@/lib/transformers";

export function CommandCenterView() {
  const { isAri } = useAuth();
  const { events: calEvents } = useCalendar();
  const { tasks } = useTasks();

  const calTimeline = transformCalendarEvents(calEvents);
  const meetingPrep = transformMeetingPrep(calEvents);
  const { overdue, stale } = transformOverdueTasks(tasks);
  const jeanaItems = transformJeanaItems(tasks);

  return (
    <div className="space-y-5">

      {/* ── Row 1: Priority Replies (full width, most important) ────── */}
      <ReplyCenter />

      {/* ── Row 2: Calendar + Weather/Slack side-by-side ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
        <CalendarTimeline events={calTimeline} />
        <div className="space-y-5">
          <WeatherCard />
          <SlackCard />
        </div>
      </div>

      {/* ── Row 3: Meeting Prep + Jeana ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MeetingPrep meetings={meetingPrep} />
        {isAri && <JeanaSection items={jeanaItems} />}
      </div>

      {/* ── Row 4: AI Feed ──────────────────────────────────────────── */}
      <AIFeedCard />

      {/* ── Row 5: Overdue Tasks ────────────────────────────────────── */}
      {(overdue.length > 0 || stale.length > 0) && (
        <OverdueTasks items={overdue} staleItems={stale} />
      )}

      {/* ── Row 6: Power BI ─────────────────────────────────────────── */}
      <PowerBIKPIs />
      <PowerBIReports />

      {/* ── Row 7: Salesforce Pipeline ──────────────────────────────── */}
      <SalesforcePipeline />

    </div>
  );
}
