import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { searchJql } from "@/lib/jira";
import { pseudonymize } from "@/lib/pseudonymize";
import { isVip } from "@/lib/vip";
import { createHash } from "crypto";

export async function GET(req: NextRequest) {
  // Vercel Cron sends an authorization header
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sql = getDb();
    const projectKey = process.env.JIRA_PROJECT_KEY ?? "AM00";
    let nextPageToken: string | undefined;
    let synced = 0;

    while (true) {
      const result = await searchJql(
        `project = ${projectKey} AND updated >= -1d ORDER BY updated DESC`,
        nextPageToken,
        100
      );

      for (const issue of result.issues) {
        const f = issue.fields;
        const reporterEmail = (f.reporter as Record<string, unknown>)?.emailAddress as string | null;
        const orgId = (f.customfield_10002 as Record<string, unknown>)?.id as string | null;
        const orgName = (f.customfield_10002 as Record<string, unknown>)?.name as string | null;
        const vip = await isVip(orgId, reporterEmail);

        await sql`
          INSERT INTO tickets (jira_key, jira_id, project_key, summary, description_hash, status,
            priority, issue_type, assignee_team, reporter_pseudo, organization_id, organization_name,
            is_vip, created_at, updated_at, resolved_at)
          VALUES (
            ${issue.key},
            ${Number(issue.id)},
            ${projectKey},
            ${f.summary as string},
            ${f.description ? createHash("sha256").update(String(f.description)).digest("hex") : null},
            ${(f.status as Record<string, unknown>).name as string},
            ${(f.priority as Record<string, unknown>)?.name as string ?? null},
            ${(f.issuetype as Record<string, unknown>)?.name as string ?? null},
            ${null},
            ${reporterEmail ? pseudonymize(reporterEmail) : null},
            ${orgId},
            ${orgName},
            ${vip},
            ${f.created as string},
            ${f.updated as string},
            ${(f.resolutiondate as string) ?? null}
          )
          ON CONFLICT (jira_key) DO UPDATE SET
            status = EXCLUDED.status,
            priority = EXCLUDED.priority,
            is_vip = EXCLUDED.is_vip,
            updated_at = EXCLUDED.updated_at,
            resolved_at = EXCLUDED.resolved_at,
            assignee_team = COALESCE(tickets.assignee_team, EXCLUDED.assignee_team)
        `;
        synced++;
      }

      if (result.isLast) break;
      nextPageToken = result.nextPageToken;
    }

    // Backfill first_response_at from comments for tickets missing it
    await sql`
      UPDATE tickets SET first_response_at = c.first_comment
      FROM (
        SELECT ticket_id, MIN(created_at) AS first_comment
        FROM comments
        GROUP BY ticket_id
      ) c
      WHERE tickets.id = c.ticket_id AND tickets.first_response_at IS NULL
    `;

    // Breach counts per team from today's SLA snapshots
    const breaches = await sql`
      SELECT COALESCE(t.assignee_team, 'unassigned') AS team,
             COUNT(DISTINCT s.ticket_id)::int AS cnt
      FROM sla_snapshots s
      JOIN tickets t ON t.id = s.ticket_id
      WHERE s.breached = TRUE AND s.captured_at >= CURRENT_DATE
      GROUP BY 1
    `;
    const breachMap = new Map<string, number>();
    for (const r of breaches) breachMap.set(r.team as string, r.cnt as number);

    // Team metrics with avg response/resolution times
    const teams = await sql`
      SELECT
        COALESCE(assignee_team, 'unassigned') AS team,
        COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)::int AS opened,
        COUNT(*) FILTER (WHERE resolved_at::date = CURRENT_DATE)::int AS resolved,
        COUNT(*) FILTER (WHERE status NOT IN ('Resolved', 'Closed', 'Done'))::int AS backlog,
        (AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) * 1000)
          FILTER (WHERE first_response_at IS NOT NULL))::bigint AS avg_fr,
        (AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) * 1000)
          FILTER (WHERE resolved_at IS NOT NULL AND resolved_at::date = CURRENT_DATE))::bigint AS avg_res
      FROM tickets
      GROUP BY 1
    `;

    for (const t of teams) {
      const team = t.team as string;
      await sql`
        INSERT INTO team_metrics_daily (team_name, metric_date, tickets_opened, tickets_resolved,
          sla_breach_count, backlog_size, avg_first_response_ms, avg_resolution_ms)
        VALUES (${team}, CURRENT_DATE, ${t.opened}, ${t.resolved},
          ${breachMap.get(team) ?? 0}, ${t.backlog}, ${t.avg_fr}, ${t.avg_res})
        ON CONFLICT (team_name, metric_date) DO UPDATE SET
          tickets_opened = EXCLUDED.tickets_opened,
          tickets_resolved = EXCLUDED.tickets_resolved,
          sla_breach_count = EXCLUDED.sla_breach_count,
          backlog_size = EXCLUDED.backlog_size,
          avg_first_response_ms = EXCLUDED.avg_first_response_ms,
          avg_resolution_ms = EXCLUDED.avg_resolution_ms
      `;
    }

    return Response.json({ ok: true, synced });
  } catch (err) {
    console.error("Reconciliation error:", err);
    return Response.json({ error: "Reconciliation failed" }, { status: 500 });
  }
}
