import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { fetchTicketSla } from "@/lib/jira";
import { projectSla } from "@/lib/sla-projection";

let cache: { data: unknown; at: number } | null = null;
const CACHE_TTL = 60_000;

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") ?? "open";

  if (cache && Date.now() - cache.at < CACHE_TTL) {
    return Response.json(cache.data);
  }

  try {
    const sql = getDb();

    const openStatuses = ["Open", "In Progress", "Waiting for support", "Waiting for customer", "Escalated"];
    const tickets = await sql`
      SELECT id, jira_key, summary, status, priority, assignee_team,
             organization_name, is_vip, created_at
      FROM tickets
      WHERE ${status === "open" ? sql`status = ANY(${openStatuses})` : sql`TRUE`}
      ORDER BY created_at DESC
      LIMIT 200
    `;

    const BATCH_SIZE = 10;
    const results = [];

    for (let i = 0; i < tickets.length; i += BATCH_SIZE) {
      const batch = tickets.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (ticket) => {
          try {
            const slaValues = await fetchTicketSla(ticket.jira_key as string);
            const projections = projectSla(slaValues);

            for (const p of projections) {
              await sql`
                INSERT INTO sla_snapshots (ticket_id, sla_name, status, elapsed_ms, remaining_ms,
                  breached, goal_ms, projected_breach_at)
                VALUES (${ticket.id}, ${p.sla_name}, ${p.status}, ${p.elapsed_ms},
                  ${p.remaining_ms}, ${p.breached}, ${p.goal_ms}, ${p.projected_breach_at})
              `;
            }

            return { ...ticket, sla: projections };
          } catch {
            return { ...ticket, sla: [] };
          }
        })
      );
      results.push(...batchResults);
    }

    const warningMs = Number(process.env.SLA_WARNING_THRESHOLD_MS ?? 7200000);
    const atRisk = results.filter((t) =>
      t.sla.some(
        (s: { status: string; remaining_ms: number | null }) =>
          s.status === "ONGOING" && s.remaining_ms !== null && s.remaining_ms < warningMs
      )
    );

    const response = {
      tickets: results,
      atRisk,
      totalOpen: results.length,
      totalBreached: results.filter((t) => t.sla.some((s: { breached: boolean }) => s.breached)).length,
    };

    cache = { data: response, at: Date.now() };
    return Response.json(response);
  } catch (err) {
    console.error("SLA fetch error:", err);
    return Response.json({ error: "Failed to fetch SLA data" }, { status: 500 });
  }
}
