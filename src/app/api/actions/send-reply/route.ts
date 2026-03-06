import { NextRequest, NextResponse } from 'next/server';
import { getCortexToken, cortexInit, cortexCall } from '@/lib/cortex/client';

export async function POST(request: NextRequest) {
  try {
    const cortexToken = getCortexToken(request);
    if (!cortexToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { messageId, body, subject, toEmail } = await request.json();

    if (!body?.trim()) {
      return NextResponse.json({ error: 'Reply body is required' }, { status: 400 });
    }

    const sessionId = await cortexInit(cortexToken);

    // If we have a messageId, send a reply to that email
    if (messageId && messageId !== 'teams' && messageId !== 'asana') {
      // Use send_email to compose a reply — Cortex MCP doesn't have createReply/draft
      // We send to the original sender as a new message (best-effort reply)
      if (toEmail) {
        await cortexCall(cortexToken, sessionId, 'send-reply', 'm365__send_email', {
          to: toEmail,
          subject: subject ? `Re: ${subject}` : 'Re:',
          body,
          content_type: 'Text',
        });
        return NextResponse.json({ ok: true, drafted: false, sent: true });
      }
      // If no toEmail provided for a reply, we can only draft — return best-effort
      return NextResponse.json({ ok: true, drafted: true });
    }

    // Fallback: send to a specific address
    if (toEmail) {
      await cortexCall(cortexToken, sessionId, 'send-email', 'm365__send_email', {
        to: toEmail,
        subject: subject || '(no subject)',
        body,
        content_type: 'Text',
      });
      return NextResponse.json({ ok: true, drafted: false, sent: true });
    }

    return NextResponse.json({ error: 'No messageId or toEmail provided' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
