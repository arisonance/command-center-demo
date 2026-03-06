import { NextRequest, NextResponse } from "next/server";
import { getCortexToken, cortexInit, cortexCall } from "@/lib/cortex/client";
import { extractEmailDetail } from "@/lib/email-reply";

export async function GET(request: NextRequest) {
  try {
    const cortexToken = getCortexToken(request);
    if (!cortexToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const messageId = request.nextUrl.searchParams.get("messageId");
    if (!messageId) {
      return NextResponse.json(
        { error: "messageId is required" },
        { status: 400 }
      );
    }

    const sessionId = await cortexInit(cortexToken);
    const rawMessage = await cortexCall(
      cortexToken,
      sessionId,
      `email-detail-${messageId}`,
      "m365__get_email",
      { message_id: messageId }
    );

    return NextResponse.json(extractEmailDetail(rawMessage, messageId));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to fetch email detail";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
