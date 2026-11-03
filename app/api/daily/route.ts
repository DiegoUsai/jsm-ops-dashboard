import { getDb } from "@/lib/db";

export async function GET() {
  const sql = getDb();

  const rows = await sql`
    SELECT
      COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)::int AS opened_today,
      COUNT(*) FILTER (
        WHERE resolved_at::date = CURRENT_DATE AND created_at::date = CURRENT_DATE
      )::int AS closed_same_day,
      COUNT(*) FILTER (
        WHERE resolved_at::date = CURRENT_DATE AND created_at::date < CURRENT_DATE
      )::int AS closed_from_backlog
    FROM tickets
  `;

  const { opened_today, closed_same_day, closed_from_backlog } = rows[0];

  const openedList = await sql`
    SELECT jira_key, summary, status, priority, organization_name, created_at
    FROM tickets
    WHERE created_at::date = CURRENT_DATE
    ORDER BY created_at DESC
    LIMIT 50
  `;

  const closedSameDayList = await sql`
    SELECT jira_key, summary, status, priority, organization_name, created_at, resolved_at
    FROM tickets
    WHERE resolved_at::date = CURRENT_DATE AND created_at::date = CURRENT_DATE
    ORDER BY resolved_at DESC
    LIMIT 50
  `;

  const closedBacklogList = await sql`
    SELECT jira_key, summary, status, priority, organization_name, created_at, resolved_at
    FROM tickets
    WHERE resolved_at::date = CURRENT_DATE AND created_at::date < CURRENT_DATE
    ORDER BY resolved_at DESC
    LIMIT 50
  `;

  return Response.json({
    opened_today,
    closed_same_day,
    closed_from_backlog,
    openedList,
    closedSameDayList,
    closedBacklogList,
  });
}
