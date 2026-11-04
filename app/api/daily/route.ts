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
  const period = req.nextUrl.searchParams.get("period") ?? "day";
  const interval = PERIODS[period] ?? PERIODS.day;

  const rows = await sql`
    SELECT
      COUNT(*) FILTER (
        WHERE created_at >= CURRENT_DATE - ${interval}::interval
      )::int AS opened,
      COUNT(*) FILTER (
        WHERE created_at >= CURRENT_DATE - ${interval}::interval
          AND status NOT IN ('Resolved', 'Closed', 'Done')
      )::int AS still_open,
      COUNT(*) FILTER (
        WHERE resolved_at >= CURRENT_DATE - ${interval}::interval
          AND created_at::date = resolved_at::date
      )::int AS closed_same_day,
      COUNT(*) FILTER (
        WHERE resolved_at >= CURRENT_DATE - ${interval}::interval
          AND created_at::date < resolved_at::date
      )::int AS closed_from_backlog
    FROM tickets
  `;

  const { opened, still_open, closed_same_day, closed_from_backlog } = rows[0];

  const openedList = await sql`
    SELECT jira_key, summary, status, priority, organization_name, assignee_team, created_at
    FROM tickets
    WHERE created_at >= CURRENT_DATE - ${interval}::interval
    ORDER BY created_at DESC
    LIMIT 100
  `;

  const stillOpenList = await sql`
    SELECT jira_key, summary, status, priority, organization_name, assignee_team, created_at,
      (CURRENT_DATE - created_at::date)::int AS age_days
    FROM tickets
    WHERE created_at >= CURRENT_DATE - ${interval}::interval
      AND status NOT IN ('Resolved', 'Closed', 'Done')
    ORDER BY created_at ASC
    LIMIT 100
  `;

  const closedSameDayList = await sql`
    SELECT jira_key, summary, status, priority, organization_name, assignee_team, created_at, resolved_at
    FROM tickets
    WHERE resolved_at >= CURRENT_DATE - ${interval}::interval
      AND created_at::date = resolved_at::date
    ORDER BY resolved_at DESC
    LIMIT 100
  `;

  const closedBacklogList = await sql`
    SELECT jira_key, summary, status, priority, organization_name, assignee_team, created_at, resolved_at,
      (resolved_at::date - created_at::date)::int AS age_days
    FROM tickets
    WHERE resolved_at >= CURRENT_DATE - ${interval}::interval
      AND created_at::date < resolved_at::date
    ORDER BY resolved_at DESC
    LIMIT 100
  `;

  return Response.json({
    opened,
    still_open,
    closed_same_day,
    closed_from_backlog,
    openedList,
    stillOpenList,
    closedSameDayList,
    closedBacklogList,
    jiraBaseUrl: process.env.JIRA_BASE_URL ?? null,
    period,
  });
}
