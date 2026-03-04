import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(req: NextRequest) {
  try {
    const { fromEmail, fromName } = await req.json();
    if (!fromEmail) return NextResponse.json({ error: 'fromEmail required' }, { status: 400 });

    const token = await getToken();
    const res = await fetch('https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messageRules', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        displayName: `Block: ${fromName || fromEmail}`,
        sequence: 1,
        isEnabled: true,
        conditions: { senderContains: [fromEmail] },
        actions: { delete: true },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
