import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

interface PeopleContactRow {
  user_id: string;
  name: string;
  email: string | null;
  urgency: string;
  urgency_score: number;
  touchpoint_count: number;
  last_contact_at: string | null;
  channels: Record<string, number>;
  action_summary: string;
  teams_chat_id: string | null;
  synced_at: string;
}

export async function POST(request: NextRequest) {
  try {
    const { people, user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    if (!people || !Array.isArray(people)) {
      return NextResponse.json({ error: 'Invalid payload: people array required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const now = new Date().toISOString();

    const rows: PeopleContactRow[] = people.map((p: Record<string, unknown>) => ({
      user_id,
      name: String(p.name || ''),
      email: p.email ? String(p.email) : null,
      urgency: String(p.urgency || 'gray'),
      urgency_score: Number(p.urgencyScore || 0),
      touchpoint_count: Number(p.touchpoints || 0),
      last_contact_at: p.lastContactAt ? String(p.lastContactAt) : null,
      channels: (p.channels as Record<string, number>) || {},
      action_summary: String(p.action || ''),
      teams_chat_id: p.teamsChatId ? String(p.teamsChatId) : null,
      synced_at: now,
    }));

    const { data, error } = await supabase
      .from('people_contacts')
      .upsert(rows, { onConflict: 'user_id,name' })
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from('sync_log').insert({
      data_type: 'people',
      items_synced: data.length,
      status: 'completed',
      user_id,
      started_at: now,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({ synced: data.length, timestamp: now });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
