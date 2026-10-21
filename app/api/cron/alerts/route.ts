import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";

const SLA_THRESHOLD_MS = 2 * 3_600_000; // 2 hours
const VIP_RESPONSE_THRESHOLD_HOURS = 1;
const BACKLOG_THRESHOLD = 200;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) {
    return Response.json({ ok: true, skipped: "TEAMS_WEBHOOK_URL not configured" });
  }

  const sql = getDb();
  const findings: Array<{ text: string; key?: string; url?: string }> = [];
  const jiraBase = process.env.JIRA_BASE_URL ?? "";

  const slaAtRisk = await sql`
    SELECT DISTINCT ON (s.ticket_id) t.jira_key, t.summary,
      s.sla_name, s.remaining_ms
    FROM sla_snapshots s
    JOIN tickets t ON t.id = s.ticket_id
    WHERE s.status = 'ONGOING'
      AND s.remaining_ms IS NOT NULL
      AND s.remaining_ms > 0
      AND s.remaining_ms < ${SLA_THRESHOLD_MS}
      AND s.captured_at > NOW() - INTERVAL '4 hours'
    ORDER BY s.ticket_id, s.captured_at DESC
    LIMIT 10
  `;

  for (const row of slaAtRisk) {
    const mins = Math.floor(Number(row.remaining_ms) / 60_000);
    findings.push({
      text: `SLA "${row.sla_name}" su ${row.jira_key} sfora tra ${mins} min — ${row.summary}`,
      key: row.jira_key,
      url: jiraBase ? `${jiraBase}/browse/${row.jira_key}` : undefined,
    });
  }

  const vipNoResponse = await sql`
    SELECT jira_key, summary, created_at
    FROM tickets
    WHERE is_vip = TRUE
      AND status NOT IN ('Resolved', 'Closed', 'Done')
      AND first_response_at IS NULL
      AND created_at < NOW() - INTERVAL '1 hour'
    ORDER BY created_at ASC
    LIMIT 5
  `;

  for (const row of vipNoResponse) {
    const hours = Math.floor(
      (Date.now() - new Date(row.created_at).getTime()) / 3_600_000,
    );
    findings.push({
      text: `VIP ${row.jira_key} senza risposta da ${hours}h — ${row.summary}`,
      key: row.jira_key,
      url: jiraBase ? `${jiraBase}/browse/${row.jira_key}` : undefined,
    });
  }

  const [{ count: backlogCount }] = await sql`
    SELECT COUNT(*)::int AS count FROM tickets
    WHERE status NOT IN ('Resolved', 'Closed', 'Done')
  `;

  if (backlogCount > BACKLOG_THRESHOLD) {
    findings.push({
      text: `Backlog a ${backlogCount} ticket (soglia: ${BACKLOG_THRESHOLD})`,
    });
  }

  if (findings.length === 0) {
    return Response.json({ ok: true, alerts: 0 });
  }

  const bodyItems = findings.map((f) => {
    const item: Record<string, unknown> = {
      type: "TextBlock",
      text: f.text,
      wrap: true,
      size: "Small",
    };
    return item;
  });

  const actions = findings
    .filter((f) => f.url)
    .slice(0, 3)
    .map((f) => ({
      type: "Action.OpenUrl",
      title: `Apri ${f.key}`,
      url: f.url,
    }));

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
            {
              type: "TextBlock",
              text: `JSM Ops Alert — ${findings.length} segnalazion${findings.length === 1 ? "e" : "i"}`,
              weight: "Bolder",
              size: "Medium",
            },
            ...bodyItems,
          ],
          actions,
        },
      },
    ],
  };

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  });

  return Response.json({ ok: true, alerts: findings.length });
}
