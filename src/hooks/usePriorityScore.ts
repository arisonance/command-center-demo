'use client';

import { useMemo } from 'react';
import { useEmails } from './useEmails';
import { useTasks } from './useTasks';
import { useChats } from './useChats';
import { useSalesforce } from './useSalesforce';
import { PriorityItem } from '@/lib/types';

const NOISE_SENDERS = /noreply|no-reply|newsletter|marketing|notification|donotreply|mailer|linkedin|twitter|digest|promo|offer|deal|vercel\.com|github\.com/i;

function scoreItem(item: PriorityItem): number {
  let s = item.basePriority;

  // Overdue penalty (capped at 25)
  s += Math.min(item.daysOverdue * 4, 25);

  // Signals — only stack if genuinely distinct
  if (item.needsReply)            s += 15;
  if (item.urgent)                s += 20;  // only truly urgent items (keyword match)
  if (item.requiresAction)        s += 10;
  if (item.multiplePeopleWaiting) s += 8;
  if (item.hardDeadlineWithin7)   s += 12;
  if (item.financial)             s += 8;
  if (item.legal)                 s += 12;

  return Math.min(s, 100);
}

function getEnergyBonus(item: PriorityItem): number {
  const h = new Date().toLocaleString('en-US', {
    hour: 'numeric', minute: 'numeric', hour12: false, timeZone: 'America/Los_Angeles',
  }).split(':').reduce((acc, v, i) => acc + (i === 0 ? parseInt(v) : parseInt(v) / 60), 0);

  // Evening: surface only truly urgent (keyword-matched) items
  if (h >= 18) return item.urgent ? 5 : -30;
  // Late afternoon: surface strategic/multi-person items
  if (h >= 15) return (item.financial || item.legal || item.multiplePeopleWaiting) ? 10 : 0;
  // Core hours: neutral
  return 0;
}

export function usePriorityScore() {
  const { emails, loading: emailsLoading } = useEmails();
  const { tasks, loading: tasksLoading } = useTasks();
  const { chats, loading: chatsLoading } = useChats();
  const { opportunities, loading: sfLoading } = useSalesforce();

  const loading = emailsLoading || tasksLoading || chatsLoading || sfLoading;

  const items = useMemo(() => {
    const priorityItems: PriorityItem[] = [];

    // ── Emails ────────────────────────────────────────────────────────
    for (const email of emails) {
      if (NOISE_SENDERS.test(email.from_email || '') || NOISE_SENDERS.test(email.from_name || '')) continue;

      const subject = (email.subject || '').toLowerCase();
      const isFinancial = /invoice|payment|billing|budget|revenue|cost|expense|contract|pricing|tax/.test(subject);
      const isLegal = /legal|lawsuit|litigation|compliance|npi|attorney|counsel|depo/.test(subject);
      // Truly urgent = explicit keyword, NOT just "unread"
      const isUrgent = /\burgent\b|asap|critical|emergency|action required|time.sensitive/.test(subject);
      const isFromSonance = (email.from_email || '').endsWith('@sonance.com');
      const isUnread = !email.is_read;

      const receivedDaysAgo = Math.max(0, Math.floor(
        (Date.now() - new Date(email.received_at).getTime()) / (1000 * 60 * 60 * 24)
      ));

      // Base: internal Sonance > external; recent > old
      const recencyBonus = receivedDaysAgo === 0 ? 12 : receivedDaysAgo === 1 ? 6 : receivedDaysAgo <= 3 ? 2 : 0;
      const basePriority = (isFromSonance ? 28 : 18) + recencyBonus;

      priorityItems.push({
        title: email.subject,
        source: 'email',
        url: email.outlook_url,
        daysOverdue: isUnread ? Math.max(0, receivedDaysAgo - 1) : 0,
        needsReply: isUnread,
        urgent: isUrgent,              // NOT all unread
        requiresAction: isUnread && (isFinancial || isLegal || isUrgent || receivedDaysAgo <= 1),
        multiplePeopleWaiting: false,
        hardDeadlineWithin7: false,
        financial: isFinancial,
        legal: isLegal,
        basePriority,
      });
    }

    // ── Asana Tasks ───────────────────────────────────────────────────
    for (const task of tasks) {
      const isHighPriority = task.priority === 'high' || task.priority === 'urgent';
      const daysOverdue = task.days_overdue || 0;
      priorityItems.push({
        title: task.name,
        source: 'asana',
        url: task.permalink_url,
        daysOverdue: Math.max(0, daysOverdue),
        needsReply: false,
        urgent: isHighPriority && daysOverdue > 0,
        requiresAction: true,
        multiplePeopleWaiting: false,
        hardDeadlineWithin7: daysOverdue > -8 && daysOverdue <= 0,
        financial: false,
        legal: false,
        basePriority: isHighPriority ? 28 : daysOverdue > 0 ? 22 : 12,
      });
    }

    // ── Teams Chats ───────────────────────────────────────────────────
    for (const chat of chats) {
      const isGroupChat = (chat.members?.length || 0) > 2;
      priorityItems.push({
        title: chat.topic || chat.last_message_preview || 'Teams message',
        source: 'teams',
        url: '',
        daysOverdue: 0,
        needsReply: true,
        urgent: false,
        requiresAction: false,
        multiplePeopleWaiting: isGroupChat,
        hardDeadlineWithin7: false,
        financial: false,
        legal: false,
        basePriority: isGroupChat ? 18 : 12,
      });
    }

    // ── Salesforce ────────────────────────────────────────────────────
    for (const opp of opportunities) {
      if (opp.is_closed && opp.is_won) continue;
      const stage = (opp.stage || '').toLowerCase();
      const basePriority = stage.includes('negotiation') || stage.includes('closing') ? 22
        : stage.includes('proposal') ? 16
        : stage.includes('qualification') ? 10
        : 8;

      priorityItems.push({
        title: `${opp.name} — $${Number(opp.amount || 0).toLocaleString()}`,
        source: 'salesforce',
        url: opp.sf_url || '',
        daysOverdue: 0,
        needsReply: false,
        urgent: false,
        requiresAction: false,
        multiplePeopleWaiting: false,
        hardDeadlineWithin7: false,
        financial: true,
        legal: false,
        basePriority,
      });
    }

    // ── Score + Sort ──────────────────────────────────────────────────
    return priorityItems
      .map((item) => {
        const base = scoreItem(item);
        const bonus = getEnergyBonus(item);
        return { ...item, score: base, energyBonus: bonus, displayScore: Math.max(0, Math.min(100, base + bonus)) };
      })
      .filter((item) => item.displayScore > 0)
      .sort((a, b) => (b.displayScore ?? 0) - (a.displayScore ?? 0));
  }, [emails, tasks, chats, opportunities]);

  return { items, loading };
}
