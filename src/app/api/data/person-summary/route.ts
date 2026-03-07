import { NextRequest, NextResponse } from "next/server";
import { getCortexToken, cortexInit, cortexCall } from "@/lib/cortex/client";

function asArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object"
  );
}

function stripHtml(value: string | null | undefined): string {
  return (value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function nameMatches(candidate: string, target: string): boolean {
  if (!candidate || !target) return false;
  const a = candidate.toLowerCase().trim();
  const b = target.toLowerCase().trim();
  if (a === b) return true;
  const partsA = a.split(/\s+/);
  const partsB = b.split(/\s+/);
  if (partsA.length >= 2 && partsB.length >= 2) {
    return partsA[0] === partsB[0] && partsA[partsA.length - 1] === partsB[partsB.length - 1];
  }
  return a.includes(b) || b.includes(a);
}

export async function GET(request: NextRequest) {
  const token = getCortexToken(request);
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const personName = searchParams.get("name");
  const personEmail = searchParams.get("email") || "";

  if (!personName) {
    return NextResponse.json({ error: "name parameter required" }, { status: 400 });
  }

  try {
    const sessionId = await cortexInit(token);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysOut = new Date();
    thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

    const [emailsResult, sentResult, calResult, slackResult, tasksResult] = await Promise.all([
      cortexCall(token, sessionId, "sum-inbox", "m365__list_emails", {
        limit: 50,
        folder: "inbox",
        search: personEmail || personName,
      }).catch(() => ({})),
      cortexCall(token, sessionId, "sum-sent", "m365__list_emails", {
        limit: 50,
        folder: "sentitems",
        search: personEmail || personName,
      }).catch(() => ({})),
      cortexCall(token, sessionId, "sum-cal", "m365__list_events", {
        start_date: thirtyDaysAgo.toISOString(),
        end_date: thirtyDaysOut.toISOString(),
        limit: 100,
      }).catch(() => ({})),
      cortexCall(token, sessionId, "sum-slack", "slack__search_messages", {
        query: personName,
        limit: 20,
      }).catch(() => ({})),
      cortexCall(token, sessionId, "sum-asana", "asana__search_tasks", {
        query: personName,
        limit: 20,
      }).catch(() => ({})),
    ]);

    // Count interactions in last 30 days
    const inboxEmails = asArray(emailsResult.emails ?? emailsResult.value ?? []);
    const sentEmails = asArray(sentResult.emails ?? sentResult.value ?? []);

    const relevantInbox = inboxEmails.filter((m) => {
      const sender = m.sender as Record<string, unknown> | undefined;
      const senderAddr = sender?.emailAddress as Record<string, unknown> | undefined;
      const from = String(m.from_name ?? m.from ?? senderAddr?.name ?? "");
      const fromEmail = String(m.from_email ?? senderAddr?.address ?? "");
      return nameMatches(from, personName) ||
        (personEmail && fromEmail.toLowerCase() === personEmail.toLowerCase());
    });

    const relevantSent = sentEmails.filter((m) => {
      const to = String(m.to_name ?? "");
      const toEmail = String(m.to_email ?? "");
      if (nameMatches(to, personName)) return true;
      if (personEmail && toEmail.toLowerCase() === personEmail.toLowerCase()) return true;
      const recipients = asArray(m.toRecipients);
      return recipients.some((r) => {
        const addr = r.emailAddress as Record<string, unknown> | undefined;
        return addr && (
          nameMatches(String(addr.name ?? ""), personName) ||
          (personEmail && String(addr.address ?? "").toLowerCase() === personEmail.toLowerCase())
        );
      });
    });

    const totalEmails = relevantInbox.length + relevantSent.length;

    // Unanswered emails (received but no corresponding sent reply)
    const unansweredEmails = relevantInbox.filter((e) => {
      const subject = String(e.subject ?? "").toLowerCase();
      const isRead = e.isRead === true || e.is_read === true;
      return !isRead || !relevantSent.some((s) => {
        const sentSubject = String(s.subject ?? "").toLowerCase();
        return sentSubject.includes(subject.replace(/^(re:\s*)+/i, "").trim()) ||
          subject.includes(sentSubject.replace(/^(re:\s*)+/i, "").trim());
      });
    });

    // Calendar meetings with this person
    const eventsRaw = asArray(calResult.events ?? calResult.value ?? []);
    const relevantMeetings = eventsRaw.filter((e) => {
      const organizer = String(e.organizer ?? "");
      const subject = String(e.subject ?? "");
      if (nameMatches(organizer, personName)) return true;
      if (subject.toLowerCase().includes(personName.toLowerCase())) return true;
      const attendees = asArray(e.attendees);
      return attendees.some((a) => {
        const addr = a.emailAddress as Record<string, unknown> | undefined;
        return addr && (
          nameMatches(String(addr.name ?? ""), personName) ||
          (personEmail && String(addr.address ?? "").toLowerCase() === personEmail.toLowerCase())
        );
      });
    });

    const now = Date.now();
    const pastMeetings = relevantMeetings.filter((m) => {
      const start = new Date(String(m.start_time ?? (m.start as Record<string, unknown> | undefined)?.dateTime ?? "")).getTime();
      return start < now;
    });
    const upcomingMeetings = relevantMeetings.filter((m) => {
      const start = new Date(String(m.start_time ?? (m.start as Record<string, unknown> | undefined)?.dateTime ?? "")).getTime();
      return start >= now;
    });

    // Most recent past meeting
    const lastMeeting = pastMeetings.length > 0
      ? pastMeetings.sort((a, b) => {
          const ta = new Date(String(a.start_time ?? (a.start as Record<string, unknown> | undefined)?.dateTime ?? "")).getTime();
          const tb = new Date(String(b.start_time ?? (b.start as Record<string, unknown> | undefined)?.dateTime ?? "")).getTime();
          return tb - ta;
        })[0]
      : null;

    // Next upcoming meeting
    const nextMeeting = upcomingMeetings.length > 0
      ? upcomingMeetings.sort((a, b) => {
          const ta = new Date(String(a.start_time ?? (a.start as Record<string, unknown> | undefined)?.dateTime ?? "")).getTime();
          const tb = new Date(String(b.start_time ?? (b.start as Record<string, unknown> | undefined)?.dateTime ?? "")).getTime();
          return ta - tb;
        })[0]
      : null;

    // Tasks
    const tasksRaw = asArray(tasksResult.tasks ?? tasksResult.data ?? tasksResult.value ?? []);
    const openTasks = tasksRaw.filter((t) => !t.completed);
    const taskProjects = [...new Set(tasksRaw.map((t) => String(t.project_name ?? asArray(t.projects)[0]?.name ?? "")).filter(Boolean))];

    // Slack threads
    const slackRaw = asArray(slackResult.messages ?? slackResult.matches ?? slackResult.value ?? []);

    // Shared projects from meetings + tasks
    const meetingSubjects = relevantMeetings.map((m) => String(m.subject ?? "")).filter(Boolean);
    const sharedProjects = [...new Set([...taskProjects, ...meetingSubjects.slice(0, 3)])].slice(0, 5);

    // Calendar overlap (upcoming shared meetings)
    const upcomingShared = upcomingMeetings.slice(0, 3).map((m) => ({
      subject: String(m.subject ?? ""),
      date: String(m.start_time ?? (m.start as Record<string, unknown> | undefined)?.dateTime ?? ""),
    }));

    // Build AI summary
    const totalInteractions = totalEmails + relevantMeetings.length + slackRaw.length;
    const summaryParts: string[] = [];

    if (totalInteractions > 0) {
      summaryParts.push(`${totalInteractions} interactions in 30 days`);
    }
    if (openTasks.length > 0) {
      summaryParts.push(`${openTasks.length} open task${openTasks.length > 1 ? "s" : ""}`);
    }
    if (lastMeeting) {
      const lastDate = new Date(String(lastMeeting.start_time ?? (lastMeeting.start as Record<string, unknown> | undefined)?.dateTime ?? ""));
      const daysDiff = Math.floor((now - lastDate.getTime()) / 86400000);
      const dayLabel = daysDiff === 0 ? "today" : daysDiff === 1 ? "yesterday" : daysDiff < 7 ? `${daysDiff}d ago` : lastDate.toLocaleDateString("en-US", { weekday: "long" });
      summaryParts.push(`last meeting ${dayLabel} re: ${String(lastMeeting.subject ?? "").slice(0, 40)}`);
    }

    const summary = summaryParts.join(", ");

    // Open loops
    const openLoops: { type: string; label: string; url: string }[] = [];

    for (const e of unansweredEmails.slice(0, 5)) {
      openLoops.push({
        type: "email",
        label: `Unanswered: ${String(e.subject ?? "").slice(0, 50)}`,
        url: String(e.webLink ?? e.outlook_url ?? "#"),
      });
    }

    for (const t of openTasks.slice(0, 5)) {
      const due = t.due_on ? ` (due ${String(t.due_on)})` : "";
      openLoops.push({
        type: "task",
        label: `${String(t.name ?? "")}${due}`,
        url: String(t.permalink_url ?? "#"),
      });
    }

    for (const s of slackRaw.slice(0, 3)) {
      const replies = Number(s.thread_reply_count ?? 0);
      if (replies > 0) {
        openLoops.push({
          type: "slack",
          label: `Thread: ${stripHtml(String(s.text ?? "")).slice(0, 50)} (${replies} replies)`,
          url: String(s.permalink ?? "#"),
        });
      }
    }

    return NextResponse.json({
      summary,
      openLoops,
      sharedContext: {
        projects: sharedProjects,
        upcomingMeetings: upcomingShared,
        totalEmails,
        totalMeetings: relevantMeetings.length,
        totalSlackMessages: slackRaw.length,
      },
      lastMeeting: lastMeeting ? {
        subject: String(lastMeeting.subject ?? ""),
        date: String(lastMeeting.start_time ?? (lastMeeting.start as Record<string, unknown> | undefined)?.dateTime ?? ""),
      } : null,
      nextMeeting: nextMeeting ? {
        subject: String(nextMeeting.subject ?? ""),
        date: String(nextMeeting.start_time ?? (nextMeeting.start as Record<string, unknown> | undefined)?.dateTime ?? ""),
      } : null,
    });
  } catch (err) {
    console.error("Person summary error:", err);
    return NextResponse.json(
      { error: "Failed to generate person summary" },
      { status: 500 }
    );
  }
}
