import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/webhook-verify";
import { pseudonymize, pseudonymizeText } from "@/lib/pseudonymize";
import { isVip } from "@/lib/vip";
import { createHash } from "crypto";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-hub-signature");

  if (!verifyWebhookSignature(body, signature)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(body);
  const webhookEvent = event.webhookEvent as string;

  try {
    if (webhookEvent === "jira:issue_created" || webhookEvent === "jira:issue_updated") {
      await handleIssue(event);
    } else if (webhookEvent === "comment_created") {
      await handleComment(event);
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}

async function handleIssue(event: Record<string, unknown>) {
  const sql = getDb();
  const issue = event.issue as Record<string, unknown>;
  const fields = issue.fields as Record<string, unknown>;

  const reporterEmail = (fields.reporter as Record<string, unknown>)?.emailAddress as string | null;
  const orgId = (fields.customfield_10002 as Record<string, unknown>)?.id as string | null;
  const orgName = (fields.customfield_10002 as Record<string, unknown>)?.name as string | null;
  const assigneeTeam = extractTeam(fields);

  const vip = await isVip(orgId, reporterEmail);

  await sql`
    INSERT INTO tickets (jira_key, jira_id, project_key, summary, description_hash, status, priority,
      issue_type, assignee_team, reporter_pseudo, organization_id, organization_name, is_vip,
      created_at, updated_at, resolved_at, first_response_at, custom_fields, raw_webhook)
    VALUES (
      ${issue.key as string},
      ${Number(issue.id)},
      ${(fields.project as Record<string, unknown>).key as string},
      ${fields.summary as string},
      ${fields.description ? createHash("sha256").update(String(fields.description)).digest("hex") : null},
      ${(fields.status as Record<string, unknown>).name as string},
      ${(fields.priority as Record<string, unknown>)?.name as string ?? null},
      ${(fields.issuetype as Record<string, unknown>)?.name as string ?? null},
      ${assigneeTeam},
      ${reporterEmail ? pseudonymize(reporterEmail) : null},
      ${orgId},
      ${orgName},
      ${vip},
      ${fields.created as string},
      ${fields.updated as string},
      ${(fields.resolutiondate as string) ?? null},
      ${null},
      ${JSON.stringify(extractCustomFields(fields))},
      ${JSON.stringify(event)}
    )
    ON CONFLICT (jira_key) DO UPDATE SET
      status = EXCLUDED.status,
      priority = EXCLUDED.priority,
      assignee_team = EXCLUDED.assignee_team,
      is_vip = EXCLUDED.is_vip,
      updated_at = EXCLUDED.updated_at,
      resolved_at = EXCLUDED.resolved_at,
      custom_fields = EXCLUDED.custom_fields,
      raw_webhook = EXCLUDED.raw_webhook
  `;
}

async function handleComment(event: Record<string, unknown>) {
  const sql = getDb();
  const comment = event.comment as Record<string, unknown>;
  const issue = event.issue as Record<string, unknown>;
  const jiraKey = issue.key as string;

  const ticketRows = await sql`SELECT id FROM tickets WHERE jira_key = ${jiraKey}`;
  if (!ticketRows.length) return;

  const bodyText = (comment.body as string) ?? "";
  const bodyPseudo = pseudonymizeText(bodyText);

  await sql`
    INSERT INTO comments (ticket_id, jira_comment_id, author_team, is_public, body_pseudo, body_hash, created_at)
    VALUES (
      ${ticketRows[0].id as number},
      ${Number(comment.id)},
      ${extractCommentAuthorTeam(comment)},
      ${(comment.jsdPublic as boolean) ?? true},
      ${bodyPseudo},
      ${createHash("sha256").update(bodyText).digest("hex")},
      ${comment.created as string}
    )
    ON CONFLICT (jira_comment_id) DO NOTHING
  `;
}

function extractTeam(fields: Record<string, unknown>): string | null {
  const assignee = fields.assignee as Record<string, unknown> | null;
  if (!assignee) return null;
  const groups = (assignee.groups as Record<string, unknown>)?.items as Record<string, unknown>[] | undefined;
  return groups?.[0]?.name as string ?? "unassigned";
}

function extractCommentAuthorTeam(comment: Record<string, unknown>): string | null {
  const author = comment.author as Record<string, unknown> | null;
  if (!author) return null;
  return (author.displayName as string)?.split(" ")[0] ?? null;
}

function extractCustomFields(fields: Record<string, unknown>): Record<string, unknown> {
  const custom: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(fields)) {
    if (key.startsWith("customfield_") && key !== "customfield_10002" && val != null) {
      custom[key] = val;
    }
  }
  return custom;
}
