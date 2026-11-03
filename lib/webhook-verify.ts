import { createHmac, timingSafeEqual } from "crypto";

export function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  if (!signature) return false;
  const secret = process.env.JIRA_WEBHOOK_SECRET!;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
