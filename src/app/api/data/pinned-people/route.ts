import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

function getUserId(request: NextRequest): string | null {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/cortex_user=([^;]+)/);
  if (!match) return null;
  try {
    const user = JSON.parse(decodeURIComponent(match[1]));
    return user.email || null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pinned_people")
    .select("*")
    .eq("user_id", userId)
    .order("pinned_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ pinned: data });
}

export async function POST(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { person_name, person_email } = await request.json();
  if (!person_name) {
    return NextResponse.json({ error: "person_name is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pinned_people")
    .upsert(
      {
        user_id: userId,
        person_name,
        person_email: person_email || null,
        pinned_at: new Date().toISOString(),
      },
      { onConflict: "user_id,person_name" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ pinned: data });
}

export async function DELETE(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { person_name } = await request.json();
  if (!person_name) {
    return NextResponse.json({ error: "person_name is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("pinned_people")
    .delete()
    .eq("user_id", userId)
    .eq("person_name", person_name);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ unpinned: true });
}
