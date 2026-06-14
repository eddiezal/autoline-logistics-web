/**
 * Resend transport for lead notification emails.
 *
 * Replaces the Firebase Trigger Email extension path (Blaze billing
 * blocker on Ben's GCP). Resend free tier handles Phase 1 volume in
 * one HTTP call from /api/lead.
 *
 * Sender (LEADS_FROM_EMAIL) must be at a Resend-verified domain. While
 * autolinelogistics.com is being verified, fall back to onboarding@resend.dev.
 */

import "server-only";
import { Resend } from "resend";

let _client: Resend | null = null;

function getClient(): Resend {
  if (_client) return _client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not set. Add it to .env.local (local dev) " +
        "and to Vercel Production/Preview env vars.",
    );
  }
  _client = new Resend(apiKey);
  return _client;
}

export interface SendLeadEmailInput {
  to: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  tags?: Array<{ name: string; value: string }>;
}

export interface SendLeadEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendLeadEmail(input: SendLeadEmailInput): Promise<SendLeadEmailResult> {
  const from =
    process.env.LEADS_FROM_EMAIL ??
    "Auto Line Logistics <onboarding@resend.dev>";

  try {
    const { data, error } = await getClient().emails.send({
      from,
      to: input.to,
      bcc: input.bcc,
      replyTo: input.replyTo,
      subject: input.subject,
      text: input.text,
      html: input.html,
      tags: input.tags,
    });

    if (error) {
      return { ok: false, error: error.message ?? String(error) };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
