import { NextResponse } from 'next/server';

async function getToken() {
  const refreshToken = process.env.M365_REFRESH_TOKEN;
  const clientId = process.env.M365_CLIENT_ID;
  const tenantId = process.env.M365_TENANT_ID;
  if (!refreshToken || !clientId || !tenantId) throw new Error('M365 env vars missing');
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: refreshToken,
      scope: 'https://graph.microsoft.com/.default offline_access',
    }),
  });
  const data = await res.json();
  return data.access_token as string;
}

export async function GET() {
  try {
    const token = await getToken();
    const res = await fetch(
      'https://graph.microsoft.com/v1.0/me/messages?$top=60&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,isRead,inferenceClassification,bodyPreview,internetMessageId,webLink',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    const msgs = (data.value || []).filter(
      (m: Record<string, unknown>) => m.inferenceClassification === 'other'
    );

    return NextResponse.json({
      emails: msgs.map((m: Record<string, unknown>) => ({
        id: m.id,
        subject: m.subject || '(no subject)',
        from_name: (m.from as Record<string, Record<string, string>>)?.emailAddress?.name || '',
        from_email: (m.from as Record<string, Record<string, string>>)?.emailAddress?.address || '',
        received_at: m.receivedDateTime,
        is_read: m.isRead,
        preview: m.bodyPreview,
        outlook_url: m.webLink,
        internet_message_id: m.internetMessageId,
      })),
    });
  } catch (e) {
    return NextResponse.json({ emails: [], error: String(e) });
  }
}
