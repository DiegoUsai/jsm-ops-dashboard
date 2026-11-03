import { getDb } from "./db";
import type { VipRule } from "./types";

let cachedRules: VipRule[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000;

export async function getVipRules(): Promise<VipRule[]> {
  if (cachedRules && Date.now() - cacheTime < CACHE_TTL) return cachedRules;
  const sql = getDb();
  const rows = await sql`SELECT * FROM vip_rules WHERE active = TRUE`;
  cachedRules = rows as unknown as VipRule[];
  cacheTime = Date.now();
  return cachedRules;
}

export async function isVip(organizationId: string | null, reporterEmail: string | null): Promise<boolean> {
  const rules = await getVipRules();
  return rules.some((r) => {
    if (r.organization_id && r.organization_id === organizationId) return true;
    if (r.reporter_pattern && reporterEmail && new RegExp(r.reporter_pattern, "i").test(reporterEmail))
      return true;
    return false;
  });
}
