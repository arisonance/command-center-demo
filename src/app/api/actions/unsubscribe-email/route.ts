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
    const { messageId } = await req.json();
    if (!messageId) return NextResponse.json({ error: 'messageId required' }, { status: 400 });

    const token = await getToken();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // Move to Deleted Items
    const moveRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}/move`,
      { method: 'POST', headers, body: JSON.stringify({ destinationId: 'deleteditems' }) }
    );
    if (!moveRes.ok) {
      const err = await moveRes.text();
      return NextResponse.json({ error: err }, { status: moveRes.status });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
