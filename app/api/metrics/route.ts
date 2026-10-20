import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const sql = getDb();
  const days = Math.min(Number(req.nextUrl.searchParams.get("days") ?? 30), 90);

  const interval = `${days} days`;

  const metrics = await sql`
    SELECT team_name, metric_date, tickets_opened, tickets_resolved,
           avg_first_response_ms, avg_resolution_ms, sla_breach_count, backlog_size
    FROM team_metrics_daily
    WHERE metric_date >= CURRENT_DATE - ${interval}::interval
    ORDER BY metric_date DESC, team_name
  `;

  const volumeTrend = await sql`
    SELECT created_at::date AS date,
           COUNT(*) FILTER (WHERE resolved_at IS NULL OR resolved_at > created_at::date + INTERVAL '1 day') AS opened,
           COUNT(*) FILTER (WHERE resolved_at IS NOT NULL AND resolved_at::date = created_at::date) AS resolved
    FROM tickets
    WHERE created_at >= CURRENT_DATE - ${interval}::interval
    GROUP BY created_at::date
    ORDER BY date
  `;

  const backlogAging = await sql`
    SELECT
      CASE
        WHEN EXTRACT(EPOCH FROM NOW() - created_at) / 3600 < 24 THEN '< 1g'
        WHEN EXTRACT(EPOCH FROM NOW() - created_at) / 3600 < 72 THEN '1-3g'
        WHEN EXTRACT(EPOCH FROM NOW() - created_at) / 3600 < 168 THEN '3-7g'
        ELSE '> 7g'
      END AS bucket,
      COUNT(*) AS count
    FROM tickets
    WHERE status NOT IN ('Resolved', 'Closed', 'Done')
    GROUP BY bucket
    ORDER BY MIN(EXTRACT(EPOCH FROM NOW() - created_at))
  `;

  return Response.json({ metrics, volumeTrend, backlogAging });
}
