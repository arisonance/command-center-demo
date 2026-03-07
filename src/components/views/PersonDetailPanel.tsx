"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { usePersonDetail } from "@/hooks/usePersonDetail";
import { usePersonSummary } from "@/hooks/usePersonSummary";
import type { Person } from "@/hooks/usePeople";
import type {
  PersonDetailEmail,
  PersonDetailMeeting,
  PersonDetailChat,
  PersonDetailSlack,
  PersonDetailTask,
  PersonDetailResponse,
} from "@/hooks/usePersonDetail";

// ── Constants ────────────────────────────────────────────────────────────

const URGENCY_COLORS: Record<string, string> = {
  red: "text-accent-red",
  amber: "text-accent-amber",
  teal: "text-accent-teal",
  gray: "text-text-muted",
};

const URGENCY_BG: Record<string, string> = {
  red: "bg-accent-red/20 text-accent-red",
  amber: "bg-accent-amber/20 text-accent-amber",
  teal: "bg-accent-teal/20 text-accent-teal",
  gray: "bg-white/10 text-text-muted",
};

const TABS = ["timeline", "emails", "meetings", "messages", "tasks"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  timeline: "Timeline",
  emails: "Emails",
  meetings: "Meetings",
  messages: "Messages",
  tasks: "Tasks",
};

interface TimelineItem {
  ch: "email" | "meeting" | "teams" | "slack" | "asana";
  text: string;
  subtext?: string;
  date: string;
  url: string;
}

const CH_ICONS: Record<string, string> = {
  email: "\u2709",
  meeting: "\uD83D\uDCC5",
  teams: "\uD83D\uDCAC",
  slack: "#",
  asana: "\u2713",
};

const CH_COLORS: Record<string, string> = {
  email: "tag-email",
  meeting: "bg-purple-500/15 text-purple-400",
  teams: "tag-teams",
  slack: "tag-slack",
  asana: "tag-asana",
};

// ── Helpers ──────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 0) {
    const days = Math.floor(-diff / 86400000);
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    return `in ${days}d`;
  }
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFullDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Los_Angeles" });
}

function daysBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (isNaN(da) || isNaN(db)) return 0;
  return Math.floor(Math.abs(db - da) / 86400000);
}

function getDateGroup(iso: string): string {
  if (!iso) return "Older";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Older";
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 0) return "Upcoming";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This Week";
  if (days < 30) return "This Month";
  return "Older";
}

function computeRelationshipStrength(detail: PersonDetailResponse): {
  score: number;
  label: string;
  color: string;
} {
  const raw =
    detail.stats.totalEmails * 2 +
    detail.stats.totalMeetings * 3 +
    detail.chats.length +
    detail.slackMessages.length +
    detail.tasks.length;
  const score = Math.min(100, raw);
  if (score >= 70) return { score, label: "Strong", color: "bg-accent-green" };
  if (score >= 40) return { score, label: "Active", color: "bg-accent-amber" };
  if (score >= 10) return { score, label: "Light", color: "bg-accent-teal" };
  return { score, label: "New", color: "bg-white/20" };
}

// ── Main Component ───────────────────────────────────────────────────────

interface PersonDetailPanelProps {
  person: Person;
  onClose: () => void;
}

export function PersonDetailPanel({ person, onClose }: PersonDetailPanelProps) {
  const { detail, loading, error, refresh } = usePersonDetail(
    person.name,
    person.email,
    person.teamsChatId
  );
  const { data: summaryData, loading: summaryLoading } = usePersonSummary(
    person.name,
    person.email
  );
  const [activeTab, setActiveTab] = useState<Tab>("timeline");

  // Build timeline from all sources
  const timeline: TimelineItem[] = [];
  if (detail) {
    for (const e of detail.emails) {
      timeline.push({
        ch: "email",
        text: `${e.direction === "sent" ? "\u2197 " : ""}${e.subject}`,
        subtext: e.preview,
        date: e.date,
        url: e.url,
      });
    }
    for (const m of detail.meetings) {
      timeline.push({ ch: "meeting", text: m.subject, date: m.date, url: m.url });
    }
    for (const c of detail.chats) {
      timeline.push({
        ch: "teams",
        text: c.text,
        subtext: c.from ? `from ${c.from}` : undefined,
        date: c.date,
        url: c.url,
      });
    }
    for (const s of detail.slackMessages) {
      timeline.push({
        ch: "slack",
        text: s.text,
        subtext: s.channel ? `#${s.channel}` : undefined,
        date: s.date,
        url: s.url,
      });
    }
    for (const t of detail.tasks) {
      timeline.push({
        ch: "asana",
        text: t.name,
        subtext: [t.project, t.status, t.due ? `due ${t.due}` : ""].filter(Boolean).join(" \u00B7 "),
        date: t.due,
        url: t.url,
      });
    }
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  const counts: Record<Tab, number> = {
    timeline: timeline.length,
    emails: detail?.emails.length ?? 0,
    meetings: detail?.meetings.length ?? 0,
    messages: (detail?.chats.length ?? 0) + (detail?.slackMessages.length ?? 0),
    tasks: detail?.tasks.length ?? 0,
  };

  const strength = detail ? computeRelationshipStrength(detail) : null;

  // Activity highlights
  const lastEmail = detail?.emails[0];
  const [now] = useState(() => Date.now());
  const nextMeeting = detail?.meetings.find((m) => new Date(m.date).getTime() > now);
  const openTaskCount = detail?.tasks.filter((t) => t.status !== "completed").length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-[var(--bg-main)] border-l border-[var(--bg-card-border)] overflow-y-auto animate-in slide-in-from-right duration-200">
        {/* ── Header ────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-[var(--bg-main)] border-b border-[var(--bg-card-border)] px-6 py-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0",
                URGENCY_BG[person.urgency]
              )}
            >
              {getInitials(person.name)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-text-heading truncate">
                  {person.name}
                </h2>
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                    URGENCY_COLORS[person.urgency]
                  )}
                >
                  {person.urgency}
                </span>
              </div>
              {detail?.identity.title && (
                <div className="text-xs text-text-muted mt-0.5">
                  {detail.identity.title}
                  {detail.identity.department ? ` \u00B7 ${detail.identity.department}` : ""}
                </div>
              )}
              {(detail?.identity.email || person.email) && (
                <div className="text-[11px] text-text-muted mt-0.5 opacity-60">
                  {detail?.identity.email || person.email}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={refresh}
                className="text-xs px-2 py-1 rounded border border-[var(--bg-card-border)] text-text-muted hover:text-text-body transition-colors"
                title="Refresh"
              >
                \u21BB
              </button>
              <button
                onClick={onClose}
                className="text-text-muted hover:text-text-body transition-colors p-1"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Stats + Strength */}
          {detail && (
            <div className="mt-3 flex items-center gap-4">
              <div className="flex gap-3 text-[11px] text-text-muted flex-1">
                <span><strong className="text-text-body">{detail.stats.totalEmails}</strong> emails</span>
                <span><strong className="text-text-body">{detail.stats.totalMeetings}</strong> meetings</span>
                {detail.stats.firstContact && (
                  <span>since <strong className="text-text-body">{formatFullDate(detail.stats.firstContact)}</strong></span>
                )}
                {detail.stats.firstContact && detail.stats.lastContact && (
                  <span><strong className="text-text-body">{daysBetween(detail.stats.firstContact, detail.stats.lastContact)}</strong>d span</span>
                )}
              </div>
              {strength && (
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", strength.color)} style={{ width: `${strength.score}%` }} />
                  </div>
                  <span className="text-[10px] text-text-muted">{strength.label}</span>
                </div>
              )}
            </div>
          )}

          {/* Activity Highlights */}
          {detail && (lastEmail || nextMeeting || openTaskCount > 0) && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {lastEmail && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-text-muted">
                  Last email {formatDate(lastEmail.date)}: {lastEmail.subject.slice(0, 30)}{lastEmail.subject.length > 30 ? "\u2026" : ""}
                </span>
              )}
              {nextMeeting && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-teal/10 text-accent-teal">
                  Next: {nextMeeting.subject.slice(0, 25)} {formatDate(nextMeeting.date)}
                </span>
              )}
              {openTaskCount > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-amber/10 text-accent-amber">
                  {openTaskCount} open task{openTaskCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

          {/* Relationship Intelligence */}
          {(summaryData || summaryLoading) && (
            <div className="mt-3 space-y-2">
              {summaryLoading ? (
                <div className="glass-card p-3 animate-pulse">
                  <div className="h-3 bg-white/10 rounded w-3/4 mb-2" />
                  <div className="h-2 bg-white/5 rounded w-1/2" />
                </div>
              ) : summaryData && (
                <>
                  {/* AI Summary */}
                  {summaryData.summary && (
                    <div className="glass-card p-3 rounded-lg">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-accent-teal mb-1">
                        Relationship Summary
                      </div>
                      <div className="text-xs text-text-body leading-relaxed">
                        {summaryData.summary}
                      </div>
                    </div>
                  )}

                  {/* Open Loops */}
                  {summaryData.openLoops.length > 0 && (
                    <div className="glass-card p-3 rounded-lg">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-accent-red mb-1.5">
                        Open Loops ({summaryData.openLoops.length})
                      </div>
                      <div className="space-y-1">
                        {summaryData.openLoops.slice(0, 5).map((loop, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <span className={cn(
                              "text-[8px] font-bold uppercase px-1 py-0.5 rounded shrink-0 mt-0.5",
                              loop.type === "email" ? "tag-email"
                                : loop.type === "task" ? "tag-asana"
                                : "tag-slack"
                            )}>
                              {loop.type === "email" ? "\u2709" : loop.type === "task" ? "\u2713" : "#"}
                            </span>
                            {loop.url && loop.url !== "#" ? (
                              <a
                                href={loop.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-text-body hover:text-accent-amber transition-colors line-clamp-1"
                              >
                                {loop.label}
                              </a>
                            ) : (
                              <span className="text-[11px] text-text-body line-clamp-1">{loop.label}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Shared Context */}
                  {(summaryData.sharedContext.projects.length > 0 || summaryData.sharedContext.upcomingMeetings.length > 0) && (
                    <div className="glass-card p-3 rounded-lg">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-accent-amber mb-1.5">
                        Shared Context
                      </div>
                      {summaryData.sharedContext.projects.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {summaryData.sharedContext.projects.map((p, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-text-muted"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      )}
                      {summaryData.sharedContext.upcomingMeetings.length > 0 && (
                        <div className="space-y-0.5">
                          {summaryData.sharedContext.upcomingMeetings.map((m, i) => (
                            <div key={i} className="text-[11px] text-text-muted">
                              {"\uD83D\uDCC5"} {m.subject.slice(0, 40)} &middot; {formatDate(m.date)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mt-3 -mb-4 pb-0">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "text-[11px] px-3 py-1.5 rounded-t transition-colors",
                  activeTab === tab
                    ? "bg-white/5 text-text-heading font-medium border-b-2 border-accent-amber"
                    : "text-text-muted hover:text-text-body"
                )}
              >
                {TAB_LABELS[tab]}
                {counts[tab] > 0 && (
                  <span className="ml-1 text-[9px] opacity-60">{counts[tab]}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ───────────────────────────────── */}
        <div className="px-6 py-4">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="glass-card p-4 animate-pulse">
                  <div className="h-3 bg-white/10 rounded w-2/3 mb-2" />
                  <div className="h-2 bg-white/5 rounded w-1/2" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="glass-card p-4 text-accent-red text-sm">{error}</div>
          )}

          {!loading && !error && detail && (
            <>
              {activeTab === "timeline" && <TimelineView items={timeline} />}
              {activeTab === "emails" && <EmailsView emails={detail.emails} />}
              {activeTab === "meetings" && <MeetingsView meetings={detail.meetings} />}
              {activeTab === "messages" && <MessagesView chats={detail.chats} slackMessages={detail.slackMessages} />}
              {activeTab === "tasks" && <TasksView tasks={detail.tasks} />}
            </>
          )}
        </div>

        {/* ── Footer ────────────────────────────────── */}
        <div className="sticky bottom-0 bg-[var(--bg-main)] border-t border-[var(--bg-card-border)] px-6 py-3 flex gap-2">
          {(detail?.identity.email || person.email) && (
            <a
              href={`https://outlook.office.com/mail/new?to=${detail?.identity.email || person.email}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] px-3 py-1.5 rounded border border-[var(--bg-card-border)] text-text-muted hover:text-text-body hover:border-accent-amber/30 transition-colors"
            >
              \u2709 Email
            </a>
          )}
          {person.teamsChatId && (
            <span className="text-[11px] px-3 py-1.5 rounded border border-[var(--bg-card-border)] text-text-muted">
              \uD83D\uDCAC Teams DM active
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-views ────────────────────────────────────────────────────────────

function ItemLink({ url, children, className }: { url: string; children: React.ReactNode; className?: string }) {
  if (!url || url === "#") return <div className={className}>{children}</div>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={cn(className, "hover:text-accent-amber transition-colors")}>
      {children}
    </a>
  );
}

function EmptyTab({ label }: { label: string }) {
  return <div className="text-center py-8 text-text-muted text-sm">No {label} found in the last 90 days</div>;
}

function DateGroupHeader({ label }: { label: string }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mt-4 mb-1.5 first:mt-0">
      {label}
    </div>
  );
}

// ── Timeline ─────────────────────────────────────────────────────────────

function computeGroups(dates: string[]) {
  const result: string[] = [];
  let prev = "";
  for (const d of dates) {
    const g = getDateGroup(d);
    result.push(g !== prev ? g : "");
    prev = g;
  }
  return result;
}

function TimelineView({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return <EmptyTab label="interactions" />;

  const groups = computeGroups(items.map((i) => i.date));

  return (
    <div className="space-y-0">
      {items.map((item, i) => {
        const showHeader = groups[i] !== "";
        return (
          <div key={i}>
            {showHeader && <DateGroupHeader label={groups[i]} />}
            <div className="flex items-start gap-2.5 py-2.5 border-b border-[var(--bg-card-border)] last:border-0">
              <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 mt-0.5", CH_COLORS[item.ch])}>
                {CH_ICONS[item.ch]}
              </span>
              <div className="min-w-0 flex-1">
                <ItemLink url={item.url} className="text-xs text-text-body line-clamp-2">
                  {item.text}
                </ItemLink>
                {item.subtext && (
                  <div className="text-[11px] text-text-muted mt-0.5 line-clamp-1">{item.subtext}</div>
                )}
              </div>
              <span className="text-[10px] text-text-muted whitespace-nowrap shrink-0 mt-0.5">
                {formatDate(item.date)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Emails ───────────────────────────────────────────────────────────────

function EmailsView({ emails }: { emails: PersonDetailEmail[] }) {
  if (emails.length === 0) return <EmptyTab label="emails" />;

  const groups = computeGroups(emails.map((e) => e.date));

  return (
    <div>
      {emails.map((email, i) => {
        const showHeader = groups[i] !== "";
        return (
          <div key={i}>
            {showHeader && <DateGroupHeader label={groups[i]} />}
            <div className="py-2.5 border-b border-[var(--bg-card-border)] last:border-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {/* Read/unread indicator */}
                  {!email.isRead && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-amber shrink-0" title="Unread" />
                  )}
                  <ItemLink url={email.url} className="text-xs text-text-body line-clamp-1 flex-1">
                    <span className={cn("inline-block w-4 text-center mr-1", email.direction === "sent" ? "text-accent-teal" : "text-accent-amber")}>
                      {email.direction === "sent" ? "\u2197" : "\u2199"}
                    </span>
                    {email.subject}
                  </ItemLink>
                </div>
                <span className="text-[10px] text-text-muted whitespace-nowrap shrink-0">{formatDate(email.date)}</span>
              </div>
              {email.from && email.direction === "received" && (
                <div className="text-[10px] text-text-muted mt-0.5 ml-5">From {email.from}</div>
              )}
              {email.preview && (
                <div className="text-[11px] text-text-muted mt-0.5 ml-5 line-clamp-2">{email.preview}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Meetings ─────────────────────────────────────────────────────────────

function MeetingsView({ meetings }: { meetings: PersonDetailMeeting[] }) {
  const [now] = useState(() => Date.now());
  if (meetings.length === 0) return <EmptyTab label="meetings" />;
  const upcoming = meetings.filter((m) => new Date(m.date).getTime() > now);
  const past = meetings.filter((m) => new Date(m.date).getTime() <= now);

  return (
    <div className="space-y-4">
      {upcoming.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-accent-teal mb-2">
            Upcoming ({upcoming.length})
          </h4>
          {upcoming.map((m, i) => (
            <MeetingCard key={i} meeting={m} isUpcoming />
          ))}
        </div>
      )}
      {past.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">
            Past ({past.length})
          </h4>
          {past.map((m, i) => (
            <MeetingCard key={i} meeting={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function MeetingCard({ meeting, isUpcoming }: { meeting: PersonDetailMeeting; isUpcoming?: boolean }) {
  const timeRange = meeting.endTime
    ? `${formatTime(meeting.date)} \u2013 ${formatTime(meeting.endTime)}`
    : formatTime(meeting.date);

  return (
    <div className="py-2.5 border-b border-[var(--bg-card-border)] last:border-0">
      <div className="flex items-start justify-between gap-2">
        <ItemLink url={meeting.url} className="text-xs text-text-body line-clamp-1 flex-1">
          \uD83D\uDCC5 {meeting.subject}
        </ItemLink>
        <span className={cn("text-[10px] whitespace-nowrap shrink-0", isUpcoming ? "text-accent-teal" : "text-text-muted")}>
          {formatDate(meeting.date)}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1 ml-5 flex-wrap">
        <span className="text-[10px] text-text-muted">{timeRange}</span>
        {meeting.isOnline && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-teal/10 text-accent-teal font-medium">Online</span>
        )}
        {meeting.location && !meeting.isOnline && (
          <span className="text-[10px] text-text-muted truncate max-w-[150px]">{meeting.location}</span>
        )}
        {meeting.attendeeCount != null && meeting.attendeeCount > 0 && (
          <span className="text-[10px] text-text-muted">
            {meeting.attendeeCount} attendee{meeting.attendeeCount > 1 ? "s" : ""}
          </span>
        )}
      </div>
      {meeting.attendees && meeting.attendees.length > 0 && (
        <div className="text-[10px] text-text-muted mt-0.5 ml-5 line-clamp-1">
          {meeting.attendees.join(", ")}
        </div>
      )}
    </div>
  );
}

// ── Messages ─────────────────────────────────────────────────────────────

function MessagesView({ chats, slackMessages }: { chats: PersonDetailChat[]; slackMessages: PersonDetailSlack[] }) {
  if (chats.length === 0 && slackMessages.length === 0) return <EmptyTab label="messages" />;

  return (
    <div className="space-y-4">
      {chats.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">
            Teams ({chats.length})
          </h4>
          <div className="space-y-1">
            {chats.map((c, i) => {
              const group = getDateGroup(c.date);
              const prevGroup = i > 0 ? getDateGroup(chats[i - 1].date) : "";
              return (
                <div key={i}>
                  {group !== prevGroup && <DateGroupHeader label={group} />}
                  <div className="py-2 flex gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-accent-teal/15 flex items-center justify-center text-[9px] text-accent-teal font-bold shrink-0 mt-0.5">
                      {c.from?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      {c.from && (
                        <div className="text-[10px] font-medium text-text-body mb-0.5">{c.from}</div>
                      )}
                      <div className="text-xs text-text-body/80 bg-white/[0.03] rounded-lg rounded-tl-none px-3 py-1.5">
                        {c.text}
                      </div>
                      <div className="text-[9px] text-text-muted mt-0.5">{formatDate(c.date)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {slackMessages.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">
            Slack ({slackMessages.length})
          </h4>
          <div className="space-y-1">
            {slackMessages.map((s, i) => {
              const group = getDateGroup(s.date);
              const prevGroup = i > 0 ? getDateGroup(slackMessages[i - 1].date) : "";
              return (
                <div key={i}>
                  {group !== prevGroup && <DateGroupHeader label={group} />}
                  <div className="py-2 flex gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-accent-green/15 flex items-center justify-center text-[9px] text-accent-green font-bold shrink-0 mt-0.5">
                      #
                    </div>
                    <div className="min-w-0 flex-1">
                      {s.channel && (
                        <div className="text-[10px] font-medium text-text-body mb-0.5">#{s.channel}</div>
                      )}
                      <ItemLink url={s.url} className="text-xs text-text-body/80 bg-white/[0.03] rounded-lg rounded-tl-none px-3 py-1.5 block">
                        {s.text}
                      </ItemLink>
                      <div className="text-[9px] text-text-muted mt-0.5">{formatDate(s.date)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tasks ─────────────────────────────────────────────────────────────────

function TasksView({ tasks }: { tasks: PersonDetailTask[] }) {
  const [now] = useState(() => Date.now());
  if (tasks.length === 0) return <EmptyTab label="tasks" />;
  const open = tasks.filter((t) => t.status !== "completed");
  const done = tasks.filter((t) => t.status === "completed");
  const total = tasks.length;
  const completedPct = total > 0 ? Math.round((done.length / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Completion bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-accent-green transition-all" style={{ width: `${completedPct}%` }} />
        </div>
        <span className="text-[10px] text-text-muted shrink-0">
          {done.length}/{total} done
        </span>
      </div>

      {open.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-accent-amber mb-2">
            Open ({open.length})
          </h4>
          {open.map((t, i) => {
            const isOverdue = t.due && new Date(t.due).getTime() < now;
            const isDueSoon = t.due && !isOverdue && (new Date(t.due).getTime() - now) < 3 * 86400000;
            return (
              <div key={i} className="flex items-start justify-between gap-2 py-2 border-b border-[var(--bg-card-border)] last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0",
                      isOverdue ? "bg-accent-red/15 text-accent-red" : "bg-accent-amber/15 text-accent-amber"
                    )}>
                      {isOverdue ? "Overdue" : "Open"}
                    </span>
                    <ItemLink url={t.url} className="text-xs text-text-body line-clamp-1">{t.name}</ItemLink>
                  </div>
                  {t.project && <div className="text-[11px] text-text-muted mt-0.5">{t.project}</div>}
                </div>
                {t.due && (
                  <span className={cn(
                    "text-[10px] whitespace-nowrap shrink-0",
                    isOverdue ? "text-accent-red" : isDueSoon ? "text-accent-amber" : "text-text-muted"
                  )}>
                    due {formatDate(t.due)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {done.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">
            Completed ({done.length})
          </h4>
          {done.map((t, i) => (
            <div key={i} className="flex items-start justify-between gap-2 py-2 border-b border-[var(--bg-card-border)] last:border-0">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-accent-green/15 text-accent-green shrink-0">Done</span>
                <ItemLink url={t.url} className="text-xs text-text-muted line-clamp-1 line-through opacity-60">{t.name}</ItemLink>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
