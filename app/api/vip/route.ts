import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const sql = getDb();
  const rules = await sql`
    SELECT id, organization_id, organization_name, reporter_pattern,
           priority_boost, max_first_response_ms, notes, active
    FROM vip_rules
    ORDER BY organization_name NULLS LAST, id
  `;
  return Response.json({ rules });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const sql = getDb();

  const [rule] = await sql`
    INSERT INTO vip_rules (organization_id, organization_name, reporter_pattern,
                           priority_boost, max_first_response_ms, notes, active)
    VALUES (${body.organization_id || null},
            ${body.organization_name || null},
            ${body.reporter_pattern || null},
            ${body.priority_boost ?? 0.3},
            ${body.max_first_response_ms || null},
            ${body.notes || null},
            TRUE)
    RETURNING *
  `;

  return Response.json({ rule }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const sql = getDb();
  await sql`DELETE FROM vip_rules WHERE id = ${Number(id)}`;
  return Response.json({ ok: true });
}
