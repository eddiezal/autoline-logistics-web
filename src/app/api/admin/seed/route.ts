/**
 * POST /api/admin/seed?token=...  — DEV-ONLY Firestore seeder.
 *
 * Loads the mock shipments into the Firestore `shipments` collection so the
 * portal has real data to render before live SD data exists. Runs inside Next
 * (not a standalone script) so the TypeScript mock module + path aliases just
 * work — no extra tooling to install.
 *
 * Guards: refuses to run when NODE_ENV=production, and requires SEED_TOKEN to
 * match. Delete this route (and SEED_TOKEN) before launch.
 *
 * Usage (dev): POST http://localhost:3000/api/admin/seed?token=YOUR_SEED_TOKEN
 */

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { MOCK_SHIPMENTS } from "@/lib/mock/shipments";
import {
  checkRateLimit,
  getClientIp,
  tooManyRequestsResponse,
} from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Seeder is disabled in production." },
      { status: 403 },
    );
  }
  // Even in dev, throttle to 3/min/IP — defense in depth against accidental
  // loops or anyone who finds SEED_TOKEN in a leaked .env.
  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: `admin-seed:${ip}`,
    limit: 3,
    windowMs: 60_000,
  });
  if (!rl.success) return tooManyRequestsResponse(rl);

  const token = new URL(req.url).searchParams.get("token");
  if (!process.env.SEED_TOKEN || token !== process.env.SEED_TOKEN) {
    return NextResponse.json(
      { error: "Missing or invalid seed token." },
      { status: 401 },
    );
  }

  try {
    const db = getAdminDb();
    const batch = db.batch();
    for (const shipment of MOCK_SHIPMENTS) {
      // Store email lowercased so the dashboard's case-insensitive email
      // lookup (Firebase session emails are lowercased) matches reliably.
      const doc = {
        ...shipment,
        customer: {
          ...shipment.customer,
          email: shipment.customer.email.trim().toLowerCase(),
        },
      };
      batch.set(db.collection("shipments").doc(shipment.orderNumber), doc);
    }
    await batch.commit();
    return NextResponse.json({
      seeded: MOCK_SHIPMENTS.length,
      orderNumbers: MOCK_SHIPMENTS.map((s) => s.orderNumber),
    });
  } catch (err) {
    console.error("Seed failed:", err);
    return NextResponse.json(
      { error: "Seed failed — check Firebase admin env + Firestore exists." },
      { status: 500 },
    );
  }
}
