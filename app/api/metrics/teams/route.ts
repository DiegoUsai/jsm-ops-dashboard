import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";

const PERIODS: Record<string, string> = {
  day: "1 day",
  week: "7 days",
  month: "1 month",
  quarter: "3 months",
  year: "1 year",
};

export async function GET(req: NextRequest) {
  const sql = getDb();
  const period = req.nextUrl.searchParams.get("period") ?? "month";
  const interval = PERIODS[period] ?? PERIODS.month;

  const teams = await sql`
    SELECT
      COALESCE(assignee_team, 'Non assegnato') AS team,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - ${interval}::interval)::int AS opened,
      COUNT(*) FILTER (WHERE resolved_at >= CURRENT_DATE - ${interval}::interval)::int AS resolved,
      COUNT(*) FILTER (
        WHERE resolved_at >= CURRENT_DATE - ${interval}::interval
          AND created_at::date = resolved_at::date
      )::int AS same_day,
      COUNT(*) FILTER (WHERE status NOT IN ('Resolved', 'Closed', 'Done'))::int AS backlog,
      (AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) * 1000)
        FILTER (WHERE first_response_at IS NOT NULL
          AND created_at >= CURRENT_DATE - ${interval}::interval))::bigint AS avg_fr,
      (AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) * 1000)
        FILTER (WHERE resolved_at IS NOT NULL
          AND resolved_at >= CURRENT_DATE - ${interval}::interval))::bigint AS avg_res
    FROM tickets
    GROUP BY 1
    HAVING
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - ${interval}::interval) > 0
      OR COUNT(*) FILTER (WHERE resolved_at >= CURRENT_DATE - ${interval}::interval) > 0
      OR COUNT(*) FILTER (WHERE status NOT IN ('Resolved', 'Closed', 'Done')) > 0
    ORDER BY
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - ${interval}::interval) DESC
  `;

  return Response.json({ teams, period });
}
