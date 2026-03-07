"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ExternalLinkIcon } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";
import { useEmails } from "@/hooks/useEmails";
import { useChats } from "@/hooks/useChats";
import { useSlackFeed } from "@/hooks/useSlackFeed";
import { useAsanaComments } from "@/hooks/useAsanaComments";
import type { EmailDetail } from "@/lib/email-reply";
import {
  buildOutlookComposeUrl,
  buildReplyQueue,
  formatRelativeTime,
  type ReplyQueueItem,
  type ReplySource,
} from "@/lib/reply-center";

type FilterId = "all" | ReplySource;
type ComposerMode = "draft" | "ai";

interface StoredReplyState {
  dismissedIds: string[];
  snoozedUntil: Record<string, number>;
}

const FILTER_LABELS: Record<FilterId, string> = {
  all: "All",
  email: "Email",
  teams: "Teams",
  slack_context: "Slack",
  asana_comment: "Comments",
};

const SOURCE_BADGES: Record<ReplySource, string> = {
  email: "Outlook",
  teams: "Teams",
  slack_context: "Slack",
  asana_comment: "Asana",
};

const SOURCE_STYLES: Record<ReplySource, string> = {
  email: "tag-email",
  teams: "tag-teams",
  slack_context: "tag-slack",
  asana_comment: "tag-asana",
};

const QUICK_PROMPTS: Record<
  Exclude<ReplySource, "slack_context">,
  Array<{ id: string; label: string; prompt: string }>
> = {
  email: [
    {
      id: "ack",
      label: "Acknowledge",
      prompt:
        "Acknowledge the message, confirm I saw it, and keep the reply concise.",
    },
    {
      id: "next",
      label: "Next steps",
      prompt:
        "Reply with crisp next steps, ownership, and timing. Keep it direct.",
    },
    {
      id: "context",
      label: "Need context",
      prompt:
        "Reply with the minimum clarifying questions needed to move this forward.",
    },
    {
      id: "decline",
      label: "Decline",
      prompt:
        "Reply graciously, decline clearly, and avoid over-explaining.",
    },
  ],
  teams: [
    {
      id: "ack",
      label: "Acknowledge",
      prompt:
        "Write a concise Teams reply acknowledging the message and confirming I saw it.",
    },
    {
      id: "next",
      label: "Move it forward",
      prompt:
        "Write a short Teams reply that proposes the next step and a clear owner.",
    },
    {
      id: "context",
      label: "Clarify",
      prompt:
        "Write a short Teams reply asking for only the context needed to move this forward.",
    },
  ],
  asana_comment: [
    {
      id: "ack",
      label: "Acknowledge",
      prompt:
        "Draft a short Asana comment acknowledging the update and confirming I saw it.",
    },
    {
      id: "status",
      label: "Status check",
      prompt:
        "Draft a concise Asana comment asking for the current status and any blocker.",
    },
    {
      id: "next",
      label: "Next step",
      prompt:
        "Draft a concise Asana comment that aligns on the next step and who owns it.",
    },
  ],
};

const EMPTY_REPLY_STATE: StoredReplyState = {
  dismissedIds: [],
  snoozedUntil: {},
};

const SNOOZE_MS = 12 * 60 * 60 * 1000;

function parseStoredState(raw: string | null): StoredReplyState {
  if (!raw) return EMPTY_REPLY_STATE;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredReplyState>;
    return {
      dismissedIds: Array.isArray(parsed.dismissedIds)
        ? parsed.dismissedIds
        : [],
      snoozedUntil:
        parsed.snoozedUntil && typeof parsed.snoozedUntil === "object"
          ? parsed.snoozedUntil
          : {},
    };
  } catch {
    return EMPTY_REPLY_STATE;
  }
}

function pruneSnoozes(snoozedUntil: Record<string, number>) {
  const now = Date.now();
  return Object.fromEntries(
    Object.entries(snoozedUntil).filter(([, until]) => until > now)
  );
}

function titleCaseTag(tag: string) {
  return tag
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildSlackSummary(item: ReplyQueueItem) {
  const tagSummary =
    item.tags.length > 0 ? item.tags.join(" · ") : "No engagement metadata";
  return `Slack context from ${item.sender}. ${
    item.summary || "Open in Slack to review the thread."
  } ${tagSummary}.`;
}

function handoffLabel(item: ReplyQueueItem, hasDraft: boolean) {
  if (item.source === "email") {
    return hasDraft ? "Open draft in Outlook" : "Reply in Outlook";
  }
  if (item.source === "teams") return "Open in Teams";
  if (item.source === "slack_context") return "Open in Slack";
  return "Open in Asana";
}

function formatRecipientList(values: string[]) {
  return values.join(", ");
}

function buildPriorityReasonLine(item: ReplyQueueItem) {
  return item.priorityReasons.join(" · ");
}

function ScoreBadge({ score }: { score: number }) {
  const styles =
    score >= 80
      ? "border-red-400/25 bg-red-400/10 text-red-200"
      : score >= 65
        ? "border-accent-amber/25 bg-accent-amber/10 text-accent-amber"
        : "border-teal-400/25 bg-teal-400/10 text-teal-200";

  return (
    <div
      className={cn(
        "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl border text-center",
        styles
      )}
    >
      <span className="text-[9px] uppercase tracking-[0.24em] opacity-70">Pri</span>
      <span className="text-sm font-semibold tabular-nums">{score}</span>
    </div>
  );
}

function buildPriorityPills(item: ReplyQueueItem) {
  const pills: Array<{ label: string; className: string }> = [];

  if (item.unread) {
    pills.push({
      label: "Unread",
      className: "border-accent-amber/20 bg-accent-amber/10 text-accent-amber",
    });
  }
  if (item.prioritySignals.urgent) {
    pills.push({
      label: "Urgent",
      className: "border-red-400/20 bg-red-400/10 text-red-200",
    });
  }
  if (item.prioritySignals.legal) {
    pills.push({
      label: "Legal",
      className: "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200",
    });
  }
  if (item.prioritySignals.financial) {
    pills.push({
      label: "Financial",
      className: "border-accent-amber/20 bg-accent-amber/10 text-accent-amber",
    });
  }
  if (item.prioritySignals.multiplePeopleWaiting) {
    pills.push({
      label: "Team thread",
      className: "border-sky-400/20 bg-sky-400/10 text-sky-200",
    });
  }
  if (item.prioritySignals.aging) {
    pills.push({
      label: "Aging",
      className: "border-red-400/20 bg-red-400/10 text-red-200",
    });
  }

  return pills.slice(0, 4);
}

export function ReplyCenter() {
  const { emails, loading: emailsLoading } = useEmails();
  const { chats, loading: chatsLoading } = useChats();
  const { messages: slackMessages, loading: slackLoading } = useSlackFeed();
  const { comments: asanaComments, loading: asanaLoading } = useAsanaComments();
  const { user } = useAuth();
  const { addToast } = useToast();

  const loading = emailsLoading || chatsLoading || slackLoading || asanaLoading;

  const currentUserName = user?.user_metadata?.full_name ?? "";
  const currentUserEmail = user?.email ?? "";
  const storageKey = useMemo(() => {
    const identity = (currentUserEmail || currentUserName).trim().toLowerCase();
    return identity ? `reply-center:${identity}` : null;
  }, [currentUserEmail, currentUserName]);

  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [snoozedUntil, setSnoozedUntil] = useState<Record<string, number>>({});
  const [storageReady, setStorageReady] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [composerState, setComposerState] = useState<{
    itemId: string;
    mode: ComposerMode;
  } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [promptTexts, setPromptTexts] = useState<Record<string, string>>({});
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [emailDetails, setEmailDetails] = useState<Record<string, EmailDetail>>(
    {}
  );
  const [emailDetailLoading, setEmailDetailLoading] = useState<
    Record<string, boolean>
  >({});
  const [emailDetailErrors, setEmailDetailErrors] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (!storageKey) {
      setDismissedIds(new Set());
      setSnoozedUntil({});
      setStorageReady(true);
      return;
    }

    const stored = parseStoredState(window.localStorage.getItem(storageKey));
    setDismissedIds(new Set(stored.dismissedIds));
    setSnoozedUntil(pruneSnoozes(stored.snoozedUntil));
    setStorageReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !storageReady) return;

    const payload: StoredReplyState = {
      dismissedIds: Array.from(dismissedIds),
      snoozedUntil: pruneSnoozes(snoozedUntil),
    };

    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [dismissedIds, snoozedUntil, storageKey, storageReady]);

  const queueItems = useMemo(
    () =>
      buildReplyQueue({
        emails,
        chats,
        slackMessages,
        asanaComments,
        currentUserName,
      }),
    [asanaComments, chats, currentUserName, emails, slackMessages]
  );

  const visibleItems = useMemo(() => {
    const now = Date.now();
    return queueItems.filter((item) => {
      if (dismissedIds.has(item.id)) return false;
      if (snoozedUntil[item.id] && snoozedUntil[item.id] > now) return false;
      if (activeFilter !== "all" && item.source !== activeFilter) return false;
      return true;
    });
  }, [activeFilter, dismissedIds, queueItems, snoozedUntil]);

  const counts = useMemo(() => {
    const now = Date.now();
    const activeItems = queueItems.filter((item) => {
      if (dismissedIds.has(item.id)) return false;
      if (snoozedUntil[item.id] && snoozedUntil[item.id] > now) return false;
      return true;
    });

    return {
      all: activeItems.length,
      email: activeItems.filter((item) => item.source === "email").length,
      teams: activeItems.filter((item) => item.source === "teams").length,
      slack_context: activeItems.filter((item) => item.source === "slack_context")
        .length,
      asana_comment: activeItems.filter((item) => item.source === "asana_comment")
        .length,
    };
  }, [dismissedIds, queueItems, snoozedUntil]);

  async function ensureEmailDetail(item: ReplyQueueItem) {
    if (item.source !== "email" || !item.messageId) return null;

    if (emailDetails[item.messageId]) {
      return emailDetails[item.messageId];
    }

    if (emailDetailLoading[item.messageId]) {
      return null;
    }

    setEmailDetailLoading((current) => ({
      ...current,
      [item.messageId!]: true,
    }));
    setEmailDetailErrors((current) => {
      const next = { ...current };
      delete next[item.messageId!];
      return next;
    });

    try {
      const res = await fetch(
        `/api/data/email-detail?messageId=${encodeURIComponent(item.messageId)}`
      );
      const data = (await res.json()) as EmailDetail | { error?: string };

      if (!res.ok) {
        throw new Error(
          "error" in data && data.error
            ? data.error
            : `HTTP ${res.status}`
        );
      }

      const detail = data as EmailDetail;
      setEmailDetails((current) => ({
        ...current,
        [item.messageId!]: detail,
      }));
      return detail;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load the original email.";
      setEmailDetailErrors((current) => ({
        ...current,
        [item.messageId!]: message,
      }));
      return null;
    } finally {
      setEmailDetailLoading((current) => ({
        ...current,
        [item.messageId!]: false,
      }));
    }
  }

  function toggleExpanded(item: ReplyQueueItem) {
    setExpandedId((current) => (current === item.id ? null : item.id));
    if (item.source === "email") {
      void ensureEmailDetail(item);
    }
  }

  function openComposer(item: ReplyQueueItem, mode: ComposerMode) {
    setExpandedId(item.id);
    setComposerState({ itemId: item.id, mode });
    setDraftErrors((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });

    if (item.source === "email") {
      void ensureEmailDetail(item);
    }
  }

  function dismissItem(itemId: string) {
    setDismissedIds((current) => new Set(current).add(itemId));
    if (expandedId === itemId) setExpandedId(null);
    if (composerState?.itemId === itemId) setComposerState(null);
  }

  function snoozeItem(itemId: string) {
    setSnoozedUntil((current) => ({
      ...current,
      [itemId]: Date.now() + SNOOZE_MS,
    }));
    if (expandedId === itemId) setExpandedId(null);
    if (composerState?.itemId === itemId) setComposerState(null);
    addToast("Snoozed for 12 hours.", "default");
  }

  async function copyText(text: string, message = "Copied to clipboard.") {
    if (!text.trim()) return;
    await navigator.clipboard.writeText(text);
    addToast(message, "success");
  }

  function applyQuickPrompt(item: ReplyQueueItem, prompt: string) {
    setPromptTexts((current) => ({ ...current, [item.id]: prompt }));
    openComposer(item, "ai");
  }

  async function handleAIDraft(item: ReplyQueueItem) {
    const prompt = promptTexts[item.id]?.trim();
    if (!prompt || streamingId) return;

    if (item.source === "email") {
      const detail = await ensureEmailDetail(item);
      if (!detail) {
        setDraftErrors((current) => ({
          ...current,
          [item.id]: "Load the original email before drafting a reply.",
        }));
        return;
      }
    }

    setStreamingId(item.id);
    setDraftErrors((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });

    try {
      const res = await fetch("/api/ai/draft-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: item.messageId,
          message:
            item.source === "slack_context" ? buildSlackSummary(item) : item.message,
          prompt,
          channel:
            item.source === "asana_comment"
              ? "asana comment"
              : item.source === "slack_context"
                ? "slack context"
                : item.source,
          sender: item.sender,
          subject: item.title,
        }),
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || `HTTP ${res.status}`);
      }

      setDrafts((current) => ({
        ...current,
        [item.id]: text.trim(),
      }));
      setComposerState({ itemId: item.id, mode: "draft" });
    } catch (error) {
      setDraftErrors((current) => ({
        ...current,
        [item.id]:
          error instanceof Error ? error.message : "Unable to draft right now.",
      }));
    } finally {
      setStreamingId(null);
    }
  }

  function getHandoffUrl(item: ReplyQueueItem) {
    if (item.source === "email") {
      return buildOutlookComposeUrl({
        to: item.senderEmail,
        subject: item.title,
        body: drafts[item.id] || "",
      });
    }

    return item.url;
  }

  function getEmailDetail(item: ReplyQueueItem) {
    if (item.source !== "email" || !item.messageId) return null;
    return emailDetails[item.messageId] || null;
  }

  function renderContext(item: ReplyQueueItem) {
    if (item.source !== "email") {
      return (
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-text-body">
          {item.source === "slack_context"
            ? buildSlackSummary(item)
            : item.message || item.summary}
        </p>
      );
    }

    const detail = getEmailDetail(item);
    const isLoading = item.messageId ? emailDetailLoading[item.messageId] : false;
    const error = item.messageId ? emailDetailErrors[item.messageId] : "";

    if (detail) {
      return (
        <div className="space-y-3">
          <div className="grid gap-2 rounded-xl border border-[var(--bg-card-border)] bg-black/10 p-3 text-[11px] text-text-muted lg:grid-cols-2">
            <div>
              <span className="text-text-body">From</span>
              <div className="mt-1 break-words">
                {detail.fromName || detail.fromEmail || item.sender}
                {detail.fromEmail &&
                  detail.fromName &&
                  detail.fromEmail !== detail.fromName && (
                    <span className="ml-1 opacity-70">{`<${detail.fromEmail}>`}</span>
                  )}
              </div>
            </div>
            <div>
              <span className="text-text-body">Received</span>
              <div className="mt-1">
                {detail.receivedAt
                  ? `${new Date(detail.receivedAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: "America/Los_Angeles",
                    })} · ${formatRelativeTime(detail.receivedAt)}`
                  : item.meta}
              </div>
            </div>
            {detail.to.length > 0 && (
              <div className="lg:col-span-2">
                <span className="text-text-body">To</span>
                <div className="mt-1 break-words">{formatRecipientList(detail.to)}</div>
              </div>
            )}
            {detail.cc.length > 0 && (
              <div className="lg:col-span-2">
                <span className="text-text-body">Cc</span>
                <div className="mt-1 break-words">{formatRecipientList(detail.cc)}</div>
              </div>
            )}
          </div>
          <div className="max-h-[360px] overflow-y-auto rounded-xl border border-[var(--bg-card-border)] bg-black/10 p-4">
            <p className="whitespace-pre-wrap text-xs leading-6 text-text-body">
              {detail.latestMessageText || detail.bodyText || item.message || item.summary}
            </p>
          </div>
          {detail.earlierThreadText && (
            <details className="rounded-xl border border-[var(--bg-card-border)] bg-black/10 p-3">
              <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
                Earlier thread context
              </summary>
              <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-text-body">
                {detail.earlierThreadText}
              </p>
            </details>
          )}
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="rounded-xl border border-[var(--bg-card-border)] bg-black/10 p-4 text-xs text-text-muted animate-pulse">
          Loading the full email…
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {error && (
          <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200">
            {error}
          </div>
        )}
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-text-body">
          {item.message || item.summary}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md border border-[var(--bg-card-border)] px-2.5 py-1.5 text-[11px] text-text-muted transition-colors hover:text-text-body"
            onClick={() => void ensureEmailDetail(item)}
          >
            Retry load
          </button>
          {item.url && (
            <a
              className="inline-flex items-center gap-1 rounded-md border border-[var(--bg-card-border)] px-2.5 py-1.5 text-[11px] text-text-muted transition-colors hover:text-text-body"
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open original
              <ExternalLinkIcon size={11} />
            </a>
          )}
        </div>
      </div>
    );
  }

  function renderComposer(item: ReplyQueueItem) {
    if (composerState?.itemId !== item.id) return null;

    const isAiMode = composerState.mode === "ai";
    const draft = drafts[item.id] || "";
    const promptText = promptTexts[item.id] || "";
    const quickPrompts =
      item.source === "slack_context" ? [] : QUICK_PROMPTS[item.source];
    const emailLoading =
      item.source === "email" && item.messageId
        ? emailDetailLoading[item.messageId]
        : false;
    const emailError =
      item.source === "email" && item.messageId
        ? emailDetailErrors[item.messageId]
        : "";
    const emailReady =
      item.source !== "email" || Boolean(item.messageId && emailDetails[item.messageId]);

    return (
      <div className="mt-4 rounded-2xl border border-[rgba(212,164,76,0.14)] bg-[var(--draft-bg)] p-4">
        {item.source === "slack_context" ? (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-text-body">
              {buildSlackSummary(item)}
            </p>
            <div className="flex flex-wrap gap-2">
              {item.url && (
                <a
                  className="rounded-md bg-accent-amber px-3 py-1.5 text-[11px] font-semibold text-[#0d0d0d] transition-colors hover:bg-accent-amber/90"
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Slack
                </a>
              )}
              <button
                className="rounded-md border border-[var(--bg-card-border)] px-2.5 py-1.5 text-[11px] text-text-muted transition-colors hover:text-text-body"
                onClick={() => copyText(buildSlackSummary(item))}
              >
                Copy summary
              </button>
            </div>
          </div>
        ) : isAiMode ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((entry) => (
                <button
                  key={entry.id}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] transition-colors",
                    promptText === entry.prompt
                      ? "border-accent-amber bg-accent-amber/15 text-accent-amber"
                      : "border-[var(--bg-card-border)] text-text-muted hover:text-text-body"
                  )}
                  onClick={() =>
                    setPromptTexts((current) => ({
                      ...current,
                      [item.id]: entry.prompt,
                    }))
                  }
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <textarea
              className="h-24 w-full rounded-xl border border-[var(--bg-card-border)] bg-transparent p-3 text-xs leading-relaxed text-text-body outline-none transition-colors focus:border-accent-amber/40"
              placeholder="Add guidance for the reply..."
              value={promptText}
              onChange={(event) =>
                setPromptTexts((current) => ({
                  ...current,
                  [item.id]: event.target.value,
                }))
              }
            />
            {item.source === "email" && !emailReady && (
              <div className="rounded-xl border border-[var(--bg-card-border)] bg-black/10 p-3 text-[11px] text-text-muted">
                {emailLoading
                  ? "Loading the original email so the draft is grounded in the full message."
                  : emailError ||
                    "Load the original email before generating a reply."}
              </div>
            )}
            {draftErrors[item.id] && (
              <p className="text-[11px] text-accent-red">{draftErrors[item.id]}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-md bg-accent-amber px-3 py-1.5 text-[11px] font-semibold text-[#0d0d0d] transition-colors hover:bg-accent-amber/90 disabled:opacity-50"
                disabled={
                  !promptText.trim() ||
                  streamingId === item.id ||
                  (item.source === "email" && !emailReady)
                }
                onClick={() => void handleAIDraft(item)}
              >
                {streamingId === item.id ? "Drafting…" : "Create draft"}
              </button>
              <button
                className="rounded-md border border-[var(--bg-card-border)] px-2.5 py-1.5 text-[11px] text-text-muted transition-colors hover:text-text-body"
                onClick={() => setComposerState({ itemId: item.id, mode: "draft" })}
              >
                Write manually
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              className="min-h-[120px] w-full rounded-xl border border-[var(--bg-card-border)] bg-transparent p-3 text-xs leading-relaxed text-text-body outline-none transition-colors focus:border-accent-amber/40"
              placeholder={
                item.source === "asana_comment"
                  ? "Draft the comment you want to leave on this Asana task..."
                  : item.source === "teams"
                    ? "Draft the reply you want to send in Teams..."
                    : "Draft your reply..."
              }
              value={draft}
              onChange={(event) =>
                setDrafts((current) => ({
                  ...current,
                  [item.id]: event.target.value,
                }))
              }
            />
            {draftErrors[item.id] && (
              <p className="text-[11px] text-accent-red">{draftErrors[item.id]}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-md border border-[var(--bg-card-border)] px-2.5 py-1.5 text-[11px] text-text-muted transition-colors hover:text-text-body"
                onClick={() => setComposerState({ itemId: item.id, mode: "ai" })}
              >
                AI assist
              </button>
              {draft && (
                <button
                  className="rounded-md border border-[var(--bg-card-border)] px-2.5 py-1.5 text-[11px] text-text-muted transition-colors hover:text-text-body"
                  onClick={() =>
                    void copyText(
                      draft,
                      item.source === "asana_comment"
                        ? "Comment copied."
                        : "Draft copied."
                    )
                  }
                >
                  Copy
                </button>
              )}
              {getHandoffUrl(item) && (
                <a
                  className="rounded-md bg-accent-amber px-3 py-1.5 text-[11px] font-semibold text-[#0d0d0d] transition-colors hover:bg-accent-amber/90"
                  href={getHandoffUrl(item)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {handoffLabel(item, Boolean(draft.trim()))}
                </a>
              )}
              {item.source === "email" && item.url && (
                <a
                  className="rounded-md border border-[var(--bg-card-border)] px-2.5 py-1.5 text-[11px] text-text-muted transition-colors hover:text-text-body"
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open original
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="glass-card anim-card relative overflow-hidden" style={{ animationDelay: "80ms" }}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-70"
        style={{
          background:
            "radial-gradient(circle at top left, rgba(212, 164, 76, 0.18), transparent 48%)",
        }}
      />

      <div className="relative space-y-5">
        <div className="flex flex-col gap-4 border-b border-[var(--bg-card-border)] pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(212,164,76,0.16)] bg-[rgba(212,164,76,0.08)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-accent-amber">
              Priority Workspace
            </div>
            <div>
              <h2 className="flex items-center gap-3 text-lg font-semibold text-text-heading">
                Priority Replies
                <span className="inline-flex items-center rounded-full bg-accent-amber/15 px-2.5 py-1 text-xs font-medium text-accent-amber">
                  {counts.all}
                </span>
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-muted">
                One ranked queue of emails, chats, and comments that need your response. The score reflects urgency, freshness, and how many people are waiting on you.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(FILTER_LABELS) as FilterId[]).map((filter) => (
              <button
                key={filter}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs transition-colors",
                  activeFilter === filter
                    ? "bg-[var(--tab-active-bg)] text-accent-amber"
                    : "bg-transparent text-text-muted hover:bg-[var(--tab-bg)] hover:text-text-body"
                )}
                onClick={() => setActiveFilter(filter)}
              >
                {FILTER_LABELS[filter]}
                <span className="ml-1 opacity-70">{counts[filter]}</span>
              </button>
            ))}
          </div>
        </div>

        {loading && visibleItems.length === 0 ? (
          <div className="py-8 text-center text-sm text-text-muted animate-pulse">
            Building your ranked reply queue…
          </div>
        ) : visibleItems.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-[var(--bg-card-border)] overflow-hidden rounded-[28px] border border-[var(--bg-card-border)] bg-black/10">
            {visibleItems.map((item, index) => {
              const isExpanded = expandedId === item.id;
              const isComposerOpen = composerState?.itemId === item.id;
              const priorityPills = buildPriorityPills(item);

              return (
                <div
                  key={item.id}
                  className={cn(
                    "px-4 py-4 transition-colors",
                    isExpanded || isComposerOpen ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"
                  )}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <div className="flex items-start gap-3 lg:min-w-0 lg:flex-1">
                      <div className="pt-0.5">
                        <ScoreBadge score={item.displayScore} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                              SOURCE_STYLES[item.source]
                            )}
                          >
                            {SOURCE_BADGES[item.source]}
                          </span>
                          {index < 3 && (
                            <span className="rounded-md border border-accent-amber/20 bg-accent-amber/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-amber">
                              Top queue
                            </span>
                          )}
                          <span className="text-[11px] text-text-muted">{item.meta}</span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-start gap-3">
                          <button
                            className="hot-link text-left text-base font-medium leading-tight text-text-heading"
                            onClick={() => toggleExpanded(item)}
                          >
                            {item.title}
                          </button>
                          <span className="mt-0.5 text-xs text-text-muted">
                            {item.sender}
                            {item.projectName ? ` · ${item.projectName}` : ""}
                          </span>
                        </div>

                        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-text-body">
                          {item.summary}
                        </p>
                        {item.priorityReasons.length > 0 && (
                          <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
                            <span className="mr-1 uppercase tracking-[0.18em] text-[10px] text-accent-amber">
                              Why
                            </span>
                            {buildPriorityReasonLine(item)}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {priorityPills.map((pill) => (
                            <span
                              key={`${item.id}-${pill.label}`}
                              className={cn(
                                "rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em]",
                                pill.className
                              )}
                            >
                              {pill.label}
                            </span>
                          ))}
                          {item.tags.slice(0, 3).map((tag) => (
                            <span
                              key={`${item.id}-${tag}`}
                              className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-text-muted"
                            >
                              {titleCaseTag(tag)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:w-[280px] lg:justify-end">
                      {item.source !== "slack_context" && (
                        <button
                          className="rounded-md border border-[var(--bg-card-border)] px-2.5 py-1.5 text-[11px] text-text-muted transition-colors hover:text-text-body"
                          onClick={() => openComposer(item, "draft")}
                        >
                          {item.source === "asana_comment" ? "Draft comment" : "Draft"}
                        </button>
                      )}
                      {item.source === "slack_context" ? (
                        <button
                          className="rounded-md border border-[var(--bg-card-border)] px-2.5 py-1.5 text-[11px] text-text-muted transition-colors hover:text-text-body"
                          onClick={() => toggleExpanded(item)}
                        >
                          Summarize context
                        </button>
                      ) : (
                        <button
                          className="rounded-md border border-[var(--bg-card-border)] px-2.5 py-1.5 text-[11px] text-text-muted transition-colors hover:text-text-body"
                          onClick={() => openComposer(item, "ai")}
                        >
                          AI assist
                        </button>
                      )}
                      {item.url && item.source !== "email" && (
                        <a
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--bg-card-border)] px-2.5 py-1.5 text-[11px] text-text-muted transition-colors hover:text-text-body"
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {handoffLabel(item, Boolean(drafts[item.id]?.trim()))}
                          <ExternalLinkIcon size={11} />
                        </a>
                      )}
                      <button
                        className="rounded-md border border-[var(--bg-card-border)] px-2.5 py-1.5 text-[11px] text-text-muted transition-colors hover:text-text-body"
                        onClick={() => snoozeItem(item.id)}
                      >
                        Snooze
                      </button>
                      <button
                        className="rounded-md px-2.5 py-1.5 text-[11px] text-text-muted transition-colors hover:text-accent-red"
                        onClick={() => dismissItem(item.id)}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>

                  {(isExpanded || isComposerOpen) && (
                    <div className="mt-4 rounded-[24px] border border-[var(--bg-card-border)] bg-[var(--tab-bg)] p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-text-muted">
                          {item.source === "email"
                            ? "Full message"
                            : item.source === "asana_comment"
                              ? "Latest comment"
                              : item.source === "slack_context"
                                ? "Thread context"
                                : "Conversation context"}
                        </div>

                        {item.source !== "slack_context" && !isComposerOpen && (
                          <div className="flex flex-wrap gap-1.5">
                            {QUICK_PROMPTS[item.source].map((entry) => (
                              <button
                                key={entry.id}
                                className="rounded-full border border-[var(--bg-card-border)] px-2.5 py-1 text-[10px] text-text-muted transition-colors hover:text-text-body"
                                onClick={() => applyQuickPrompt(item, entry.prompt)}
                              >
                                {entry.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {item.priorityReasons.length > 0 && (
                        <div className="mb-4 rounded-xl border border-[var(--bg-card-border)] bg-black/10 px-3 py-2 text-[11px] text-text-muted">
                          <span className="mr-2 uppercase tracking-[0.18em] text-[10px] text-accent-amber">
                            Why this is high
                          </span>
                          {buildPriorityReasonLine(item)}
                        </div>
                      )}

                      {renderContext(item)}
                      {renderComposer(item)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
