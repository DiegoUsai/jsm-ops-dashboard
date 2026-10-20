import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { title, text, ticketKey, ticketUrl } = (await req.json()) as {
    title: string;
    text: string;
    ticketKey?: string;
    ticketUrl?: string;
  };

  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) {
    return Response.json({ error: "TEAMS_WEBHOOK_URL not configured" }, { status: 500 });
  }

  const card = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", text: title, weight: "Bolder", size: "Medium" },
            { type: "TextBlock", text, wrap: true },
          ],
          actions: ticketUrl
            ? [{ type: "Action.OpenUrl", title: `Apri ${ticketKey ?? "ticket"}`, url: ticketUrl }]
            : [],
        },
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  });

  if (!res.ok) {
    return Response.json({ error: "Teams webhook failed", status: res.status }, { status: 502 });
  }

  return Response.json({ ok: true });
}
