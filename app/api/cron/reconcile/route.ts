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
    const projectKey = process.env.JIRA_PROJECT_KEY ?? "SD";
    let startAt = 0;
    let total = 1;
    let synced = 0;

    while (startAt < total) {
      const result = await searchJql(
        `project = ${projectKey} AND updated >= -1d ORDER BY updated DESC`,
        startAt,
        100
      );
      total = result.total;

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
            resolved_at = EXCLUDED.resolved_at
        `;
        synced++;
      }

      startAt += result.issues.length;
    }

    // Compute daily team metrics
    await sql`
      INSERT INTO team_metrics_daily (team_name, metric_date, tickets_opened, tickets_resolved, sla_breach_count, backlog_size)
      SELECT
        COALESCE(assignee_team, 'unassigned'),
        CURRENT_DATE,
        COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE),
        COUNT(*) FILTER (WHERE resolved_at::date = CURRENT_DATE),
        0,
        COUNT(*) FILTER (WHERE status NOT IN ('Resolved', 'Closed', 'Done'))
      FROM tickets
      GROUP BY COALESCE(assignee_team, 'unassigned')
      ON CONFLICT (team_name, metric_date) DO UPDATE SET
        tickets_opened = EXCLUDED.tickets_opened,
        tickets_resolved = EXCLUDED.tickets_resolved,
        backlog_size = EXCLUDED.backlog_size
    `;

    return Response.json({ ok: true, synced });
  } catch (err) {
    console.error("Reconciliation error:", err);
    return Response.json({ error: "Reconciliation failed" }, { status: 500 });
  }
}
