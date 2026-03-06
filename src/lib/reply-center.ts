import type {
  AsanaCommentThread,
  Chat,
  Email,
  SlackFeedMessage,
} from "@/lib/types";

export type ReplySource =
  | "email"
  | "teams"
  | "slack_context"
  | "asana_comment";

export interface ReplyPrioritySignals {
  urgent: boolean;
  financial: boolean;
  legal: boolean;
  multiplePeopleWaiting: boolean;
  aging: boolean;
  recent: boolean;
}

export interface ReplyQueueItem {
  id: string;
  source: ReplySource;
  title: string;
  sender: string;
  senderEmail?: string | null;
  messageId?: string | null;
  summary: string;
  message: string;
  timestamp: string;
  url: string;
  unread: boolean;
  tags: string[];
  meta: string;
  projectName?: string;
  sortTime: number;
  score: number;
  displayScore: number;
  prioritySignals: ReplyPrioritySignals;
}

const EMAIL_NOISE =
  /noreply|no-reply|newsletter|marketing|notification|donotreply|mailer|linkedin|twitter|digest|promo|offer|deal|vercel\.com|github\.com/i;

const URGENT_RE = /\burgent\b|asap|critical|emergency|action required|time.sensitive/i;
const FINANCIAL_RE =
  /invoice|payment|billing|budget|revenue|cost|expense|contract|pricing|tax/i;
const LEGAL_RE = /legal|lawsuit|litigation|compliance|attorney|counsel|depo/i;
const GROUP_THREAD_RE = /team|group|committee|project|weekly|sync|leadership|slt/i;

function normalize(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function stripHtml(value: string | null | undefined): string {
  return (value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string | null | undefined, max = 140): string {
  const text = stripHtml(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function detectContentFlags(value: string) {
  return {
    urgent: URGENT_RE.test(value),
    financial: FINANCIAL_RE.test(value),
    legal: LEGAL_RE.test(value),
  };
}

function ageInHours(iso: string): number {
  return Math.max(
    0,
    (Date.now() - new Date(iso || Date.now()).getTime()) / (1000 * 60 * 60)
  );
}

function isGroupConversation(chat: Chat): boolean {
  return (
    (chat.members?.length || 0) > 2 ||
    GROUP_THREAD_RE.test(`${chat.topic || ""} ${chat.last_message_preview || ""}`)
  );
}

function buildSignals(
  flags: ReturnType<typeof detectContentFlags>,
  extras: Partial<ReplyPrioritySignals> = {}
): ReplyPrioritySignals {
  return {
    urgent: flags.urgent,
    financial: flags.financial,
    legal: flags.legal,
    multiplePeopleWaiting: extras.multiplePeopleWaiting ?? false,
    aging: extras.aging ?? false,
    recent: extras.recent ?? false,
  };
}

export function formatRelativeTime(iso: string): string {
  if (!iso) return "";

  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
}

export function buildTeamsChatUrl(chatId: string): string {
  if (!chatId) return "";
  return `https://teams.microsoft.com/l/chat/${encodeURIComponent(chatId)}/conversations`;
}

export function buildOutlookComposeUrl({
  to,
  subject,
  body,
}: {
  to?: string | null;
  subject?: string | null;
  body?: string | null;
}): string {
  const params = new URLSearchParams();
  if (to) params.set("to", to);
  if (subject) {
    params.set("subject", /^re:/i.test(subject) ? subject : `Re: ${subject}`);
  }
  if (body) params.set("body", body);
  return `https://outlook.office365.com/mail/deeplink/compose?${params.toString()}`;
}

function scoreEmail(email: Email, flags: ReturnType<typeof detectContentFlags>) {
  const daysAgo = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(email.received_at).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );

  let score = 28;
  score += !email.is_read ? 22 : 8;
  score += daysAgo === 0 ? 18 : daysAgo === 1 ? 12 : daysAgo <= 3 ? 6 : 2;
  score += Math.min(email.days_overdue * 6, 18);
  if (email.has_attachments) score += 4;
  if (flags.urgent) score += 18;
  if (flags.financial) score += 10;
  if (flags.legal) score += 12;

  return clampScore(score);
}

function scoreTeams(chat: Chat, flags: ReturnType<typeof detectContentFlags>) {
  const hours = ageInHours(chat.last_activity);
  const groupConversation = isGroupConversation(chat);

  let score = 42;
  score += hours <= 4 ? 18 : hours <= 24 ? 12 : hours <= 72 ? 6 : 2;
  if (groupConversation) score += 10;
  if (flags.urgent) score += 14;
  if (flags.financial) score += 8;
  if (flags.legal) score += 10;

  return clampScore(score);
}

function scoreSlack(
  message: SlackFeedMessage,
  flags: ReturnType<typeof detectContentFlags>
) {
  const hours = ageInHours(message.timestamp);

  let score = 20;
  score += hours <= 6 ? 10 : hours <= 24 ? 6 : hours <= 72 ? 3 : 0;
  score += Math.min(message.thread_reply_count * 2, 10);
  if (message.has_files) score += 6;
  if ((message.reactions ?? []).length > 0) score += 4;
  if (flags.urgent) score += 12;
  if (flags.financial) score += 6;
  if (flags.legal) score += 8;

  return clampScore(score);
}

function scoreAsana(
  thread: AsanaCommentThread,
  flags: ReturnType<typeof detectContentFlags>
) {
  const hours = ageInHours(thread.latest_comment_at);
  const relevanceWeight = {
    assignee: 14,
    collaborator: 10,
    follower: 7,
    prior_commenter: 8,
    creator: 6,
  }[thread.relevance_reason];

  let score = 26;
  score += hours <= 8 ? 12 : hours <= 24 ? 8 : hours <= 72 ? 4 : 1;
  score += relevanceWeight;
  if (thread.participant_names.length > 2) score += 6;
  if (flags.urgent) score += 12;
  if (flags.financial) score += 6;
  if (flags.legal) score += 8;

  return clampScore(score);
}

function getSlackTags(message: SlackFeedMessage): string[] {
  const tags: string[] = [];

  if (message.thread_reply_count > 0) {
    tags.push(
      message.thread_reply_count === 1
        ? "1 reply"
        : `${message.thread_reply_count} replies`
    );
  }

  if (message.has_files) tags.push("Files");
  if ((message.reactions ?? []).length > 0) tags.push("Reactions");

  return tags;
}

function isSlackContextWorthy(message: SlackFeedMessage): boolean {
  return Boolean(
    message.permalink &&
      (message.thread_reply_count > 0 ||
        message.has_files ||
        (message.reactions ?? []).length > 0)
  );
}

export function buildReplyQueue({
  emails,
  chats,
  slackMessages,
  asanaComments,
  currentUserName,
}: {
  emails: Email[];
  chats: Chat[];
  slackMessages: SlackFeedMessage[];
  asanaComments: AsanaCommentThread[];
  currentUserName: string;
}): ReplyQueueItem[] {
  const currentUser = normalize(currentUserName);
  const items: ReplyQueueItem[] = [];
  const seenEmailThreads = new Set<string>();

  const emailItems = [...emails]
    .filter(
      (email) =>
        !EMAIL_NOISE.test(email.from_email || "") &&
        !EMAIL_NOISE.test(email.from_name || "")
    )
    .sort(
      (a, b) =>
        new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
    )
    .slice(0, 40);

  for (const email of emailItems) {
    const daysAgo = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(email.received_at).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
    const dedupeKey = `${normalize(email.from_email)}::${normalize(
      email.subject?.replace(/^(re|fw|fwd):\s*/i, "")
    )}`;

    if (seenEmailThreads.has(dedupeKey)) continue;
    seenEmailThreads.add(dedupeKey);

    const preview = truncate(email.preview, 180);
    const flags = detectContentFlags(`${email.subject} ${preview}`);

    if (
      email.is_read &&
      email.days_overdue <= 0 &&
      daysAgo > 3 &&
      !flags.urgent &&
      !flags.financial &&
      !flags.legal
    ) {
      continue;
    }

    const tags: string[] = [];
    if (!email.is_read) tags.push("Unread");
    if (email.has_attachments) tags.push("Attachments");
    if (email.days_overdue > 0) tags.push("Aging");

    items.push({
      id: `email:${email.message_id || email.id}`,
      source: "email",
      title: email.subject || "(no subject)",
      sender: email.from_name || email.from_email || "Unknown sender",
      senderEmail: email.from_email || null,
      messageId: email.message_id || email.id,
      summary: preview,
      message: email.preview || "",
      timestamp: email.received_at,
      url: email.outlook_url || "",
      unread: !email.is_read,
      tags,
      meta: formatRelativeTime(email.received_at),
      sortTime: new Date(email.received_at).getTime(),
      score: scoreEmail(email, flags),
      displayScore: scoreEmail(email, flags),
      prioritySignals: buildSignals(flags, {
        aging: email.days_overdue > 0,
        recent: daysAgo <= 1,
      }),
    });
  }

  const chatItems = chats
    .filter((chat) => {
      const topic = normalize(chat.topic);
      const sender = normalize(chat.last_message_from);
      if (!topic && !chat.last_message_preview) return false;
      if (currentUser && sender === currentUser) return false;
      if (currentUser && topic === currentUser && sender === currentUser) {
        return false;
      }
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime()
    )
    .slice(0, 20);

  for (const chat of chatItems) {
    const preview = truncate(chat.last_message_preview, 180);
    const sender = chat.last_message_from || "Teams";
    const title = chat.topic || preview || "Teams message";
    const flags = detectContentFlags(`${title} ${preview}`);
    const url = chat.web_url || buildTeamsChatUrl(chat.chat_id || chat.id);
    const groupConversation = isGroupConversation(chat);
    const score = scoreTeams(chat, flags);

    items.push({
      id: `teams:${chat.id}`,
      source: "teams",
      title,
      sender,
      summary: preview || "Open in Teams to continue the conversation.",
      message: chat.last_message_preview || preview,
      timestamp: chat.last_activity,
      url,
      unread: true,
      tags: groupConversation ? ["Group thread"] : ["Recent"],
      meta: `Teams · ${formatRelativeTime(chat.last_activity)}`,
      sortTime: new Date(chat.last_activity).getTime(),
      score,
      displayScore: score,
      prioritySignals: buildSignals(flags, {
        multiplePeopleWaiting: groupConversation,
        recent: ageInHours(chat.last_activity) <= 24,
      }),
    });
  }

  const slackItems = slackMessages
    .filter(isSlackContextWorthy)
    .sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, 12);

  for (const message of slackItems) {
    const preview = truncate(message.text, 180);
    const flags = detectContentFlags(
      `${message.channel_name} ${message.author_name} ${preview}`
    );
    const score = scoreSlack(message, flags);

    items.push({
      id: `slack:${message.id}`,
      source: "slack_context",
      title:
        preview && message.author_name
          ? `${message.author_name}: ${truncate(message.text, 72)}`
          : `Slack update in #${message.channel_name}`,
      sender: message.author_name || "Slack",
      summary: preview || `Open #${message.channel_name} in Slack.`,
      message: message.text || "",
      timestamp: message.timestamp,
      url: message.permalink || "",
      unread: false,
      tags: getSlackTags(message),
      meta: `#${message.channel_name} · ${formatRelativeTime(message.timestamp)}`,
      sortTime: new Date(message.timestamp).getTime(),
      score,
      displayScore: score,
      prioritySignals: buildSignals(flags, {
        multiplePeopleWaiting: message.thread_reply_count > 2,
        recent: ageInHours(message.timestamp) <= 24,
      }),
    });
  }

  for (const thread of asanaComments) {
    const summary = truncate(thread.latest_comment_text, 180);
    const flags = detectContentFlags(`${thread.task_name} ${summary}`);
    const score = scoreAsana(thread, flags);

    items.push({
      id: `asana:${thread.id}`,
      source: "asana_comment",
      title: thread.task_name,
      sender: thread.latest_commenter_name || "Asana",
      senderEmail: thread.latest_commenter_email || null,
      summary,
      message: thread.latest_comment_text,
      timestamp: thread.latest_comment_at,
      url: thread.permalink_url,
      unread: true,
      tags: ["Comment", thread.relevance_reason.replace("_", " ")],
      meta: `${thread.project_name} · ${formatRelativeTime(thread.latest_comment_at)}`,
      projectName: thread.project_name,
      sortTime: new Date(thread.latest_comment_at).getTime(),
      score,
      displayScore: score,
      prioritySignals: buildSignals(flags, {
        multiplePeopleWaiting: thread.participant_names.length > 2,
        recent: ageInHours(thread.latest_comment_at) <= 24,
      }),
    });
  }

  return items.sort((a, b) => {
    if (b.displayScore !== a.displayScore) {
      return b.displayScore - a.displayScore;
    }
    return b.sortTime - a.sortTime;
  });
}
