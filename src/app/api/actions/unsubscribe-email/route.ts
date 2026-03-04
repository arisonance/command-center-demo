import { NextRequest, NextResponse } from 'next/server';

const CLIENT_ID = process.env.M365_CLIENT_ID!;
const TENANT_ID = process.env.M365_TENANT_ID!;
const REFRESH_TOKEN = process.env.M365_REFRESH_TOKEN!;

async function getToken(): Promise<string> {
  const res = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: REFRESH_TOKEN,
      scope: 'https://graph.microsoft.com/.default',
    }),
  });
  const data = await res.json();
  return data.access_token;
}

function parseListUnsubscribeUrl(headerValue: string): string | null {
  // Header looks like: <https://example.com/unsub?token=abc>, <mailto:unsub@example.com>
  // We want the https URL, not mailto
  const matches = headerValue.match(/<(https?:\/\/[^>]+)>/gi);
  if (!matches) return null;
  const httpMatch = matches.find(m => m.toLowerCase().startsWith('<https') || m.toLowerCase().startsWith('<http'));
  if (!httpMatch) return null;
  return httpMatch.slice(1, -1); // strip < and >
}

function parseMailtoAddress(headerValue: string): string | null {
  const match = headerValue.match(/<mailto:([^>]+)>/i);
  if (!match) return null;
  return match[1]; // e.g. "unsub@example.com?subject=unsubscribe"
}

export async function POST(req: NextRequest) {
  try {
    const { messageId } = await req.json();
    if (!messageId) return NextResponse.json({ error: 'Missing messageId' }, { status: 400 });

    const token = await getToken();

    // 1. Fetch the message with internet headers
    const msgRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=id,subject,from,internetMessageHeaders`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const msg = await msgRes.json();
    const headers: { name: string; value: string }[] = msg.internetMessageHeaders || [];

    const unsubHeader = headers.find(h => h.name.toLowerCase() === 'list-unsubscribe');
    const unsubPostHeader = headers.find(h => h.name.toLowerCase() === 'list-unsubscribe-post');

    let unsubMethod = 'none';
    let unsubResult = '';

    if (unsubHeader) {
      const httpUrl = parseListUnsubscribeUrl(unsubHeader.value);
      const isOneClick = unsubPostHeader?.value?.toLowerCase().includes('list-unsubscribe=one-click');

      if (httpUrl && isOneClick) {
        // RFC 8058 one-click: POST with body
        try {
          const r = await fetch(httpUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'List-Unsubscribe=One-Click',
          });
          unsubMethod = 'one-click-post';
          unsubResult = `HTTP ${r.status}`;
        } catch (e) {
          unsubResult = `POST failed: ${e}`;
        }
      } else if (httpUrl) {
        // Standard HTTP GET unsubscribe link
        try {
          const r = await fetch(httpUrl, { method: 'GET', redirect: 'follow' });
          unsubMethod = 'http-get';
          unsubResult = `HTTP ${r.status}`;
        } catch (e) {
          unsubResult = `GET failed: ${e}`;
        }
      } else {
        // mailto: unsubscribe — send email via Graph
        const mailtoRaw = parseMailtoAddress(unsubHeader.value);
        if (mailtoRaw) {
          const [toAddress, queryString] = mailtoRaw.split('?');
          const subjectMatch = queryString?.match(/subject=([^&]+)/i);
          const subject = subjectMatch ? decodeURIComponent(subjectMatch[1]) : 'Unsubscribe';
          try {
            await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: {
                  subject,
                  body: { contentType: 'Text', content: 'Unsubscribe' },
                  toRecipients: [{ emailAddress: { address: toAddress } }],
                },
              }),
            });
            unsubMethod = 'mailto';
            unsubResult = `Sent to ${toAddress}`;
          } catch (e) {
            unsubResult = `mailto failed: ${e}`;
          }
        }
      }
    }

    // 2. Always move the message to Deleted Items regardless of unsubscribe result
    await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}/move`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinationId: 'deleteditems' }),
    });

    return NextResponse.json({ ok: true, method: unsubMethod, result: unsubResult });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
