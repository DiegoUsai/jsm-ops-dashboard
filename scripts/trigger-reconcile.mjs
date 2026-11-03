import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
const match = env.match(/^CRON_SECRET=(.+)$/m);
if (!match) { console.error("CRON_SECRET not found in .env.local"); process.exit(1); }
const secret = match[1].trim();

const url = process.argv[2] || "http://localhost:3000/api/cron/reconcile";
console.log(`Calling ${url} ...`);

const res = await fetch(url, { headers: { Authorization: `Bearer ${secret}` } });
const body = await res.json();
console.log(`Status: ${res.status}`, body);
