/**
 * GET /admin/export?tab=repeats|snowbirds|b2b
 *
 * CSV download for the Business view's active customer tab. Lives under
 * /admin (NOT /api) on purpose: the proxy's Basic-auth gate covers every
 * /admin path, so the browser that just viewed the dashboard downloads with
 * the credentials it already holds — no token juggling, no second auth
 * scheme. Rows come from the same aggregation module the on-screen table
 * renders from (src/lib/admin/business.ts).
 */
import { getAdminDb } from "@/lib/firebase/admin";
import { tabCsv, type BizOrder, type BusinessTab } from "@/lib/admin/business";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABS: ReadonlySet<string> = new Set(["repeats", "snowbirds", "b2b"]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tabParam = url.searchParams.get("tab") ?? "repeats";
  const tab: BusinessTab = (TABS.has(tabParam) ? tabParam : "repeats") as BusinessTab;

  let orders: BizOrder[] = [];
  try {
    const snap = await getAdminDb().collection("orders").get();
    orders = snap.docs.map((doc) => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const d: any = doc.data();
      /* eslint-enable @typescript-eslint/no-explicit-any */
      return {
        orderId: String(d.orderId ?? doc.id),
        firstName: String(d.firstName ?? ""),
        lastName: String(d.lastName ?? ""),
        email: String(d.email ?? ""),
        phone: String(d.phone ?? ""),
        originCity: String(d.originCity ?? ""),
        originState: String(d.originState ?? ""),
        originZip: String(d.originZip ?? ""),
        destCity: String(d.destCity ?? ""),
        destState: String(d.destState ?? ""),
        destZip: String(d.destZip ?? ""),
        orderCreatedAt: d.orderCreatedAt?.toDate?.() ?? null,
        availableAt: d.availableAt?.toDate?.() ?? null,
        price: Number(d.price) || 0,
        deposit: Number(d.deposit) || 0,
      };
    });
  } catch {
    return new Response("orders collection unavailable", { status: 503 });
  }

  const csv = tabCsv(orders, tab);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="autoline-${tab}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
