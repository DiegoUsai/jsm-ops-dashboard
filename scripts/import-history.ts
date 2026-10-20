import { neon } from "@neondatabase/serverless";
import { createHash, createHmac } from "crypto";

const JIRA_BASE_URL = process.env.JIRA_BASE_URL!;
const JIRA_AUTH =
  "Basic " +
  Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString("base64");
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY ?? "AM00";

const sql = neon(process.env.DATABASE_URL!);

function pseudonymize(email: string): string {
  return createHmac("sha256", process.env.HMAC_SECRET!).update(email.toLowerCase()).digest("hex").slice(0, 16);
}

interface JiraIssue {
  id: string;
  key: string;
  fields: Record<string, unknown>;
}

async function importAll() {
  let nextPageToken: string | undefined;
  let imported = 0;
  let errors = 0;
  let page = 0;

  console.log(`Importing tickets from project ${PROJECT_KEY} on ${JIRA_BASE_URL}...`);

  while (true) {
    const params = new URLSearchParams({
      jql: `project = ${PROJECT_KEY} ORDER BY created DESC`,
      maxResults: "100",
      fields: "summary,description,status,priority,issuetype,assignee,reporter,created,updated,resolutiondate,project",
    });
    if (nextPageToken) params.set("nextPageToken", nextPageToken);

    const res = await fetch(`${JIRA_BASE_URL}/rest/api/3/search/jql?${params}`, {
      headers: { Authorization: JIRA_AUTH, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Jira ${res.status}: ${await res.text()}`);

    const data = await res.json() as { issues: JiraIssue[]; nextPageToken?: string; isLast: boolean };
    page++;

    console.log(`Page ${page}: ${data.issues.length} issues (last: ${data.isLast})`);

    for (const issue of data.issues) {
      try {
        const f = issue.fields;
        const reporterEmail = (f.reporter as Record<string, unknown>)?.emailAddress as string | null;

        await sql.query(
          `INSERT INTO tickets (jira_key, jira_id, project_key, summary, description_hash, status,
            priority, issue_type, assignee_team, reporter_pseudo, organization_id, organization_name,
            is_vip, created_at, updated_at, resolved_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
          ON CONFLICT (jira_key) DO UPDATE SET
            status = EXCLUDED.status,
            priority = EXCLUDED.priority,
            updated_at = EXCLUDED.updated_at,
            resolved_at = EXCLUDED.resolved_at`,
          [
            issue.key,
            Number(issue.id),
            (f.project as Record<string, unknown>).key as string,
            f.summary as string,
            f.description ? createHash("sha256").update(JSON.stringify(f.description)).digest("hex") : null,
            (f.status as Record<string, unknown>).name as string,
            (f.priority as Record<string, unknown>)?.name as string ?? null,
            (f.issuetype as Record<string, unknown>)?.name as string ?? null,
            null,
            reporterEmail ? pseudonymize(reporterEmail) : null,
            null,
            null,
            false,
            f.created as string,
            f.updated as string,
            (f.resolutiondate as string) ?? null,
          ]
        );
        imported++;
      } catch (e) {
        errors++;
        console.error(`Error importing ${issue.key}:`, (e as Error).message);
      }
    }

    if (data.isLast) break;
    nextPageToken = data.nextPageToken;

    // Rate limit pause
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\nDone. Imported: ${imported}, Errors: ${errors}`);
}

importAll().catch(console.error);
