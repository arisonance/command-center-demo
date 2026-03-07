interface EmailParticipant {
  name: string;
  address: string;
}

export interface EmailDetail {
  messageId: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  to: string[];
  cc: string[];
  receivedAt: string;
  bodyText: string;
  bodyHtml: string;
  latestMessageText: string;
  earlierThreadText: string;
  replyableText: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) =>
      String.fromCodePoint(Number.parseInt(dec, 10))
    );
}

function normalizePlainText(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function htmlToText(value: string | null | undefined): string {
  if (!value) return "";

  const withBreaks = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h1|h2|h3|h4|h5|h6|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ");

  const text = decodeHtmlEntities(withBreaks).replace(/<[^>]*>/g, " ");
  return normalizePlainText(text);
}

const QUOTED_MARKERS = [
  /^on .+ wrote:$/i,
  /^from:\s/i,
  /^sent:\s/i,
  /^to:\s/i,
  /^subject:\s/i,
  /^-{2,}\s*original message\s*-{2,}$/i,
  /^>+/,
];

export function stripQuotedText(value: string | null | undefined): string {
  return splitThreadText(value).latestMessageText;
}

export function splitThreadText(value: string | null | undefined): {
  latestMessageText: string;
  earlierThreadText: string;
} {
  const normalized = normalizePlainText(value || "");
  if (!normalized) {
    return {
      latestMessageText: "",
      earlierThreadText: "",
    };
  }

  const lines = normalized.split("\n");
  const quotedAt = lines.findIndex((line, index) => {
    if (index < 2) return false;
    const trimmed = line.trim();
    return QUOTED_MARKERS.some((pattern) => pattern.test(trimmed));
  });

  if (quotedAt >= 3) {
    const latestMessageText = normalizePlainText(
      lines.slice(0, quotedAt).join("\n")
    );
    const earlierThreadText = normalizePlainText(
      lines.slice(quotedAt).join("\n")
    );

    if (latestMessageText.length >= 24) {
      return {
        latestMessageText,
        earlierThreadText:
          earlierThreadText.length >= 24 ? earlierThreadText : "",
      };
    }
  }

  return {
    latestMessageText: normalized,
    earlierThreadText: "",
  };
}

function parseParticipant(value: unknown): EmailParticipant {
  const record = asRecord(value);
  const emailAddress = asRecord(record?.emailAddress);

  const name = String(
    emailAddress?.name ?? record?.name ?? record?.displayName ?? ""
  ).trim();
  const address = String(
    emailAddress?.address ?? record?.address ?? record?.email ?? ""
  ).trim();

  return { name, address };
}

function formatParticipant(participant: EmailParticipant): string {
  if (
    participant.name &&
    participant.address &&
    participant.name.toLowerCase() !== participant.address.toLowerCase()
  ) {
    return `${participant.name} <${participant.address}>`;
  }

  return participant.name || participant.address;
}

function parseRecipients(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => formatParticipant(parseParticipant(entry)))
    .filter(Boolean);
}

export function extractEmailDetail(
  payload: Record<string, unknown>,
  fallbackMessageId = ""
): EmailDetail {
  const body = asRecord(payload.body);
  const from = parseParticipant(payload.from);
  const bodyHtml = String(
    body?.content ?? payload.body_html ?? payload.bodyHtml ?? ""
  );
  const preview = String(payload.bodyPreview ?? payload.preview ?? "");
  const bodyText = htmlToText(bodyHtml) || normalizePlainText(preview);
  const { latestMessageText, earlierThreadText } = splitThreadText(bodyText);
  const replyableText = latestMessageText || bodyText;

  return {
    messageId: String(payload.id ?? payload.message_id ?? fallbackMessageId),
    subject: String(payload.subject ?? "(no subject)"),
    fromName: from.name,
    fromEmail: from.address,
    to: parseRecipients(payload.toRecipients ?? payload.to ?? []),
    cc: parseRecipients(payload.ccRecipients ?? payload.cc ?? []),
    receivedAt: String(
      payload.receivedDateTime ?? payload.received_at ?? payload.sentDateTime ?? ""
    ),
    bodyText,
    bodyHtml,
    latestMessageText,
    earlierThreadText,
    replyableText: replyableText || bodyText,
  };
}
