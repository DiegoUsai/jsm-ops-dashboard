import { createHmac } from "crypto";

const SECRET = () => process.env.HMAC_SECRET!;

export function pseudonymize(email: string): string {
  return createHmac("sha256", SECRET()).update(email.toLowerCase()).digest("hex").slice(0, 16);
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function pseudonymizeText(text: string): string {
  return text.replace(EMAIL_RE, (match) => `[${pseudonymize(match)}]`);
}
