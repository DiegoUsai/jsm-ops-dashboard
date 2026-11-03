import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`ALTER TABLE team_metrics_daily ADD COLUMN IF NOT EXISTS same_day_closed INTEGER DEFAULT 0`;
  console.log("OK: added same_day_closed column");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
