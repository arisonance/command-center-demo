"use client";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { PersonDetailPanel } from "./PersonDetailPanel";
import { usePinnedPeople } from "@/hooks/usePinnedPeople";
import type { Person } from "@/hooks/usePeople";

const URGENCY_BORDERS: Record<string, string> = {
  red:   "border-l-4 border-l-accent-red",
  amber: "border-l-4 border-l-accent-amber",
  teal:  "border-l-4 border-l-accent-teal",
  gray:  "border-l-4 border-l-[#555]",
};

const URGENCY_AVATAR_BG: Record<string, string> = {
  red:   "bg-accent-red/20 text-accent-red ring-accent-red/30",
  amber: "bg-accent-amber/20 text-accent-amber ring-accent-amber/30",
  teal:  "bg-accent-teal/20 text-accent-teal ring-accent-teal/30",
  gray:  "bg-white/10 text-text-muted ring-white/10",
};

const URGENCY_BAR_COLOR: Record<string, string> = {
  red:   "bg-accent-red",
  amber: "bg-accent-amber",
  teal:  "bg-accent-teal",
  gray:  "bg-white/20",
};

const TIER_CONFIG = [
  { key: "red"   as const, label: "Needs Action Now", color: "text-accent-red" },
  { key: "amber" as const, label: "Follow Up",        color: "text-accent-amber" },
  { key: "teal"  as const, label: "Monitor",          color: "text-accent-teal" },
  { key: "gray"  as const, label: "Low Priority",     color: "text-text-muted" },
];

const CH_COLORS: Record<string, string> = {
  email:   "tag-email",
  teams:   "tag-teams",
  asana:   "tag-asana",
  slack:   "tag-slack",
  meeting: "bg-purple-500/15 text-purple-400",
};

const CH_ICONS: Record<string, string> = {
  email:   "\u2709",
  teams:   "\uD83D\uDCAC",
  asana:   "\u2713",
  slack:   "#",
  meeting: "\uD83D\uDCC5",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) {
    const mins = Math.floor(-diff / 60000);
    if (mins < 60) return `in ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `in ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `in ${days}d`;
  }
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface PeopleViewProps {
  people?: Person[];
  loading?: boolean;
}

export function PeopleView({ people = [], loading = false }: PeopleViewProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const { isPinned, togglePin } = usePinnedPeople();

  const maxTouchpoints = useMemo(
    () => Math.max(1, ...people.map((p) => p.touchpoints)),
    [people]
  );

  const pinnedPeople = useMemo(
    () => people.filter((p) => isPinned(p.name)),
    [people, isPinned]
  );

  function toggle(name: string) {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  if (loading && people.length === 0) {
    return (
      <div className="space-y-5">
        {[1,2,3].map(i => (
          <div key={i} className="glass-card anim-card p-5 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/10" />
              <div className="flex-1">
                <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
                <div className="h-3 bg-white/5 rounded w-2/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (people.length === 0) return <EmptyState />;

  function renderPersonCard(person: Person, showPin = true) {
    const isExpanded = expandedCards.has(person.name);
    const teamsItems = person.items.filter(i => i.ch === 'teams');
    const emailItems = person.items.filter(i => i.ch === 'email');
    const meetingItems = person.items.filter(i => i.ch === 'meeting');
    const asanaItems = person.items.filter(i => i.ch === 'asana');
    const slackItems = person.items.filter(i => i.ch === 'slack');
    const densityPct = Math.round((person.touchpoints / maxTouchpoints) * 100);
    const pinned = isPinned(person.name);

    return (
      <div
        key={person.name}
        className={cn(
          "glass-card rounded-xl overflow-hidden transition-all",
          URGENCY_BORDERS[person.urgency]
        )}
      >
        {/* Card header */}
        <button
          className="w-full text-left p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
          onClick={() => toggle(person.name)}
        >
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ring-1",
                URGENCY_AVATAR_BG[person.urgency]
              )}
            >
              {getInitials(person.name)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-semibold text-text-heading">
                  {person.name}
                </span>
                {showPin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(person.name, person.email);
                    }}
                    className={cn(
                      "text-[11px] transition-colors",
                      pinned ? "text-accent-amber" : "text-text-muted/40 hover:text-accent-amber/70"
                    )}
                    title={pinned ? "Unpin" : "Pin"}
                  >
                    {pinned ? "\u2605" : "\u2606"}
                  </button>
                )}
                {/* Channel badges */}
                <div className="flex items-center gap-1">
                  {teamsItems.length > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded tag-teams">
                      {teamsItems.length}
                    </span>
                  )}
                  {emailItems.length > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded tag-email">
                      {emailItems.length}
                    </span>
                  )}
                  {meetingItems.length > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">
                      {meetingItems.length}
                    </span>
                  )}
                  {asanaItems.length > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded tag-asana">
                      {asanaItems.length}
                    </span>
                  )}
                  {slackItems.length > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded tag-slack">
                      {slackItems.length}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-text-muted">{person.action}</span>
                {person.lastContact && (
                  <>
                    <span className="text-text-muted opacity-30">{"\u00B7"}</span>
                    <span className="text-[11px] text-text-muted">{person.lastContact}</span>
                  </>
                )}
              </div>

              {/* Interaction density bar */}
              <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", URGENCY_BAR_COLOR[person.urgency])}
                  style={{ width: `${densityPct}%` }}
                />
              </div>
            </div>

            <svg
              width="14" height="14"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={cn("shrink-0 text-text-muted mt-2 transition-transform", isExpanded && "rotate-180")}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>

        {/* Expanded touchpoints */}
        {isExpanded && (
          <div className="border-t border-[var(--bg-card-border)] divide-y divide-[var(--bg-card-border)]">
            {person.items.map((item, i) => (
              <div key={i} className="px-4 py-2.5 flex items-start gap-2.5">
                <span className={cn(
                  "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 mt-0.5",
                  CH_COLORS[item.ch]
                )}>
                  {CH_ICONS[item.ch]} {item.ch}
                </span>
                <div className="min-w-0 flex-1">
                  {item.url && item.url !== '#' ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-text-body hover:text-accent-amber transition-colors line-clamp-2"
                    >
                      {item.text}
                    </a>
                  ) : (
                    <div className="text-xs text-text-body line-clamp-2">{item.text}</div>
                  )}
                  {item.preview && item.preview !== item.text && (
                    <div className="text-[11px] text-text-muted mt-0.5 line-clamp-1">{item.preview}</div>
                  )}
                </div>
                {item.timestamp && (
                  <span className="text-[10px] text-text-muted whitespace-nowrap shrink-0 mt-0.5">
                    {formatRelativeTime(item.timestamp)}
                  </span>
                )}
              </div>
            ))}

            {/* Quick actions */}
            <div className="px-4 py-2.5 flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPerson(person);
                }}
                className="text-[10px] px-2.5 py-1 rounded border border-accent-amber/30 text-accent-amber hover:bg-accent-amber/10 transition-colors font-medium"
              >
                Deep Dive
              </button>
              {person.email && (
                <a
                  href={`https://outlook.office.com/mail/new?to=${person.email}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] px-2.5 py-1 rounded border border-[var(--bg-card-border)] text-text-muted hover:text-text-body hover:border-accent-amber/30 transition-colors"
                >
                  {"\u2709"} Email
                </a>
              )}
              {person.teamsChatId && (
                <span className="text-[10px] px-2.5 py-1 rounded border border-[var(--bg-card-border)] text-text-muted">
                  {"\uD83D\uDCAC"} Teams DM
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pinned People Section */}
      {pinnedPeople.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-accent-amber">
              {"\u2605"} Pinned
            </h3>
            <span className="text-[10px] bg-white/5 text-text-muted px-2 py-0.5 rounded-full">
              {pinnedPeople.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {pinnedPeople.map(person => renderPersonCard(person, true))}
          </div>
        </div>
      )}

      {TIER_CONFIG.map(tier => {
        const tierPeople = people.filter(p => p.urgency === tier.key);
        if (tierPeople.length === 0) return null;

        return (
          <div key={tier.key}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className={cn("text-xs font-semibold uppercase tracking-wider", tier.color)}>
                {tier.label}
              </h3>
              <span className="text-[10px] bg-white/5 text-text-muted px-2 py-0.5 rounded-full">
                {tierPeople.length}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {tierPeople.map(person => renderPersonCard(person))}
            </div>
          </div>
        );
      })}

      {selectedPerson && (
        <PersonDetailPanel
          person={selectedPerson}
          onClose={() => setSelectedPerson(null)}
        />
      )}
    </div>
  );
}
