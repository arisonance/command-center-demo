'use client';

import { useMemo } from 'react';
import { useEmails } from './useEmails';
import { useCalendar } from './useCalendar';
import { useTasks } from './useTasks';

interface TouchpointItem {
  ch: 'email' | 'teams' | 'asana' | 'slack';
  text: string;
  url: string;
  draft: string;
}

export interface Person {
  name: string;
  email?: string;
  urgency: 'red' | 'amber' | 'teal' | 'gray';
  touchpoints: number;
  items: TouchpointItem[];
  action: string;
}

// Known internal/noise senders to exclude from People view
const EXCLUDE_SENDERS = new Set([
  'microsoft', 'noreply', 'no-reply', 'notifications', 'donotreply',
  'do-not-reply', 'mailer', 'bounce', 'asana', 'slack', 'zoom',
  'linkedin', 'twitter', 'youtube', 'google', 'apple', 'amazon',
  'support', 'info', 'help', 'team', 'newsletter', 'marketing',
  'updates', 'alert', 'digest', 'billing', 'security', 'postmaster',
  'feedback', 'survey', 'promotion', 'offers', 'deals', 'shop',
]);

function shouldExclude(fromName: string, fromEmail: string): boolean {
  const lname = fromName.toLowerCase();
  const lemail = fromEmail.toLowerCase();
  for (const ex of EXCLUDE_SENDERS) {
    if (lname.includes(ex) || lemail.includes(ex)) return true;
  }
  // Exclude generic domains for bulk senders
  if (lemail.match(/\+(noreply|bounce|mail)\@/)) return true;
  return false;
}

function urgencyFromDaysAgo(daysAgo: number, isUnread: boolean): 'red' | 'amber' | 'teal' | 'gray' {
  if (isUnread && daysAgo >= 3) return 'red';
  if (isUnread && daysAgo >= 1) return 'amber';
  if (isUnread) return 'teal';
  return 'gray';
}

export function usePeople() {
  const { emails, loading: emailsLoading } = useEmails();
  const { events, loading: calLoading } = useCalendar();
  const { tasks, loading: tasksLoading } = useTasks();

  const loading = emailsLoading || calLoading || tasksLoading;

  const people: Person[] = useMemo(() => {
    // Map: normalized name → aggregated data
    const map = new Map<string, {
      name: string;
      email: string;
      items: TouchpointItem[];
      maxUrgency: number; // 0=gray,1=teal,2=amber,3=red
    }>();

    function upsert(name: string, email: string, item: TouchpointItem, urgencyLevel: number) {
      const key = name.toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, { name, email, items: [], maxUrgency: 0 });
      }
      const p = map.get(key)!;
      p.items.push(item);
      if (urgencyLevel > p.maxUrgency) p.maxUrgency = urgencyLevel;
    }

    const now = Date.now();

    // --- Emails ---
    for (const email of emails) {
      const name = email.from_name || email.from_email || '';
      const addr = email.from_email || '';
      if (!name || shouldExclude(name, addr)) continue;

      const daysAgo = Math.floor((now - new Date(email.received_at).getTime()) / (1000 * 60 * 60 * 24));
      const urgency = urgencyFromDaysAgo(daysAgo, !email.is_read);
      const urgencyLevel = urgency === 'red' ? 3 : urgency === 'amber' ? 2 : urgency === 'teal' ? 1 : 0;

      upsert(name, addr, {
        ch: 'email',
        text: email.subject,
        url: email.outlook_url || '#',
        draft: '',
      }, urgencyLevel);
    }

    // --- Calendar: people you have meetings with today/tomorrow ---
    const twoDaysOut = now + 2 * 24 * 60 * 60 * 1000;
    for (const event of events) {
      const startMs = new Date(event.start_time).getTime();
      if (startMs > twoDaysOut) continue;
      const organizer = event.organizer;
      if (!organizer || shouldExclude(organizer, '')) continue;
      // Skip events Ari organized himself
      if (organizer.toLowerCase().includes('ari') || organizer.toLowerCase().includes('supran')) continue;

      upsert(organizer, '', {
        ch: 'teams',
        text: `Meeting: ${event.subject}`,
        url: event.join_url || event.outlook_url || '#',
        draft: '',
      }, 1); // teal — meeting context
    }

    // --- Asana tasks assigned by/involving people (use notes field) ---
    for (const task of tasks) {
      if (task.completed) continue;
      // Only surface tasks that are overdue or due soon — they involve someone
      if (task.days_overdue <= 0 && task.due_on === '') continue;
      // Tasks don't have a "person" field directly, but overdue ones show up in priority
      // Skip here — already handled in Priority Engine
    }

    // Build result
    const urgencyMap: Record<number, 'red' | 'amber' | 'teal' | 'gray'> = {
      3: 'red', 2: 'amber', 1: 'teal', 0: 'gray',
    };

    const result: Person[] = [];
    for (const [, p] of map) {
      if (p.items.length === 0) continue;
      const urgency = urgencyMap[p.maxUrgency];

      // Build action summary
      const unreadCount = p.items.filter(i => i.ch === 'email').length;
      const meetingCount = p.items.filter(i => i.ch === 'teams').length;
      const parts: string[] = [];
      if (unreadCount > 0) parts.push(`${unreadCount} unread email${unreadCount > 1 ? 's' : ''}`);
      if (meetingCount > 0) parts.push(`${meetingCount} meeting${meetingCount > 1 ? 's' : ''}`);

      result.push({
        name: p.name,
        email: p.email,
        urgency,
        touchpoints: p.items.length,
        items: p.items.slice(0, 5), // cap per person
        action: parts.join(' · ') || 'Review',
      });
    }

    // Sort: red first, then amber, then teal, then gray; within tier by touchpoints desc
    const urgencyOrder = { red: 0, amber: 1, teal: 2, gray: 3 };
    result.sort((a, b) => {
      const ud = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (ud !== 0) return ud;
      return b.touchpoints - a.touchpoints;
    });

    return result;
  }, [emails, events, tasks]);

  return { people, loading };
}
