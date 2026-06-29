/**
 * GET /api/admin/leads
 *
 * Internal debugging endpoint. Returns recent lead docs from Firestore so we
 * can diagnose pricing / agent-routing issues without opening the Firebase
 * console (Eddie's gmail can't accept the GCP org invite per Domain Restricted
 * Sharing - see autoline_firebase_org_policy memory).
 *
 * Auth:   Authorization: Bearer <CRON_SECRET>
 * Usage:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://www.autolinelogistics.com/api/admin/leads"            # last 10
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://www.autolinelogistics.com/api/admin/leads?limit=25"
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://www.autolinelogistics.com/api/admin/leads?leadRef=AL-260629-XYZ"
 *
 * Reuses CRON_SECRET so we don't introduce a new env var. If we later want
 * separate scopes, swap to a dedicated ADMIN_TOKEN.
 */

import { NextResponse } from "next/server";
import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FirestoreTimestampLike {
  toDate: () => Date;
}

function isTimestampLike(v: unknown): v is FirestoreTimestampLike {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { toDate?: unknown }).toDate === "function"
  );
}

function serializeTimestamps(value: unknown): unknown {
  if (isTimestampLike(value)) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serializeTimestamps);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = serializeTimestamps(v);
    return out;
  }
  return value;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const leadRef = url.searchParams.get("leadRef")?.trim();
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitRaw ?? "10", 10) || 10, 1), 100);

  const db = getAdminDb();
  const col = db.collection("leads");

  try {
    if (leadRef) {
      const snap = await col.where("leadRef", "==", leadRef).limit(1).get();
      if (snap.empty) {
        return NextResponse.json({ ok: false, error: "lead not found" }, { status: 404 });
      }
      const doc = snap.docs[0]!;
      return NextResponse.json({
        ok: true,
        lead: {
          id: doc.id,
          ...(serializeTimestamps(doc.data()) as Record<string, unknown>),
        },
      });
    }

    const snap = await col.orderBy("submittedAt", "desc").limit(limit).get();
    const leads = snap.docs.map((d) => ({
      id: d.id,
      ...(serializeTimestamps(d.data()) as Record<string, unknown>),
    }));
    return NextResponse.json({ ok: true, count: leads.length, leads });
  } catch (err) {
    console.error("[/api/admin/leads] firestore query failed", err);
    return NextResponse.json(
      { ok: false, error: "firestore query failed" },
      { status: 500 },
    );
  }
}
