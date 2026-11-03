import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const sql = getDb();
  const status = req.nextUrl.searchParams.get("status");
  const vipOnly = req.nextUrl.searchParams.get("vip") === "true";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 100), 500);

  const rows = await sql`
    SELECT id, jira_key, summary, status, priority, issue_type, assignee_team,
           organization_name, is_vip, created_at, updated_at, resolved_at
    FROM tickets
    WHERE ${status ? sql`status = ${status}` : sql`TRUE`}
      AND ${vipOnly ? sql`is_vip = TRUE` : sql`TRUE`}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return Response.json({ tickets: rows, count: rows.length });
}
