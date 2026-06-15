# Corridor Pricing Snapshot

**Status:** Spec locked 2026-06-14. Day-1 build scope: CA-TX only.
**Owner:** Eddie (engineering) + Ben (carrier API access).
**Linked rule:** Cached display price is never quoted price. See [autoline-pricing-authority-split](../../spaces/3156b33d-20dc-4a8d-a07e-6f57ba5fd5c1/memory/autoline_pricing_authority_split.md).

---

## Purpose

Corridor landing pages (e.g. `/corridors/california-texas`) target buyers already searching to ship, not deciding ship-vs-drive. They need pricing intelligence on the specific lane: today's typical range by vehicle type and a realistic transit window. The card answers "is this fair, and how long?" without forcing them through the quote form to find out.

## Hard rule

**Firestore is the source of truth for the display snapshot. Super Dispatch (live) is the source of truth for any quoted or locked price.** A cached `$1,150` in Firestore is never the same as a confirmed customer quote. /quote always hits SD live. If we ever blur this, trust and margin both break.

## Architecture

```
                        Vercel Cron (2x daily)
                              │
                              ▼
                      /api/cron/sync-pricing
                              │
                              ├── Calls Super Dispatch Pricing Insights API
                              │   (sedan, SUV, pickup × CA→TX endpoints)
                              │   Low concurrency, retry/backoff, 429 detect
                              │
                              ▼
                      Firebase Admin SDK
                              │
                              ▼
                  Firestore: corridors/{key}/pricing/{vehicleType}
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
   Corridor page (display)           /quote form (NEVER reads cache)
   - reads Firestore                 - calls SD live always
   - applies staleness rule          - returns the real locked price
   - renders snapshot card
```

## Firestore schema

Path: `corridors/{corridorKey}/pricing/{vehicleType}`

```ts
{
  priceLow: number;              // dollars
  priceHigh: number;             // dollars
  recommendedPrice: number | null;  // SD's "carrier suggested" if present
  transitMinDays: number;
  transitMaxDays: number;
  pickupWindowMinDays: number;
  pickupWindowMaxDays: number;
  fetchedAt: Timestamp;
  source: "super_dispatch";
  status: "fresh" | "stale" | "error";
  lastError: string | null;      // for ops visibility
}
```

`vehicleType` enum: `"sedan" | "suv" | "pickup"`. Add more as we expand.
`corridorKey`: matches the existing slug in `src/lib/corridors.ts` (e.g. `"california-texas"`).

## Staleness rules

Computed against `fetchedAt` at render time.

| Age | Behavior |
|---|---|
| < 48 h | Display normally. |
| 48-72 h | Display, soften copy ("typical range" → "recent range"), drop the "today's pricing" eyebrow. |
| > 72 h | Hide the price card entirely. Replace with a CTA: "Get today's locked price". |

Rationale: prevents a stale cache from selling "from $1,150" for a week if the cron ever silently dies.

## Cron schedule

Two runs per day, fixed local time so price deltas are measurable.

| Run | Pacific | UTC | Vercel cron expression |
|---|---|---|---|
| Morning | 6:00 AM PT | 13:00 UTC | `0 13 * * *` |
| Evening | 5:00 PM PT | 00:00 UTC (next day) | `0 0 * * *` |

Fits Vercel free-tier cron limits exactly (2 invocations/day).

DST note: PT shifts between UTC-8 (PST) and UTC-7 (PDT). Vercel cron expressions are UTC, so the local time will drift by an hour twice a year. Acceptable for our use case; revisit if seasonality readings end up affected.

## API call budget

```
Day 1 scope:    1 corridor × 3 vehicle types × 2 runs/day = 6 calls/day
Full scope:    80 corridors × 3 vehicle types × 2 runs/day = 480 calls/day
```

SD's pricing-tier limit is undocumented as of 2026-06-14. We design as if a limit exists. Ben to confirm with SD CSM in parallel.

## Failure handling

```
SD returns 429 (rate limited):
  - retry with exponential backoff (1s, 4s, 16s)
  - if still 429, write Firestore status="error", lastError=...
  - Sentry log with corridor + vehicle context
  - existing fresh/stale doc remains in place (no overwrite with bad data)

SD returns 5xx or network failure:
  - same as 429: log, leave last-good in place

SD returns unexpected shape:
  - log full response to Sentry for inspection
  - leave last-good

If a corridor pricing doc is older than 72h:
  - render path hides the price card (staleness rule)
  - no user-visible error
```

## Render-side flow

```
1. Corridor page server component reads Firestore for the corridor key.
2. For each vehicle type, compute age = now - fetchedAt.
3. If any vehicle type is fresh (< 48h), render full card with all available types.
4. If all are 48-72h, render with softened copy.
5. If all are > 72h, hide card; show "Get today's locked price" CTA.
6. The card NEVER triggers a booking. It's display only.
7. Below the card, a quiet text link "See today's locked price →" goes to /quote.
```

## Components

```
/api/cron/sync-pricing       (new) cron handler, hits SD, writes Firestore
src/lib/pricing/sd-client.ts (probably new) SD API client with retry
src/lib/pricing/firestore.ts (probably new) typed read/write helpers
src/components/CorridorPricingCard.tsx (new) the snapshot card
src/app/[locale]/corridors/california-texas/page.tsx (edit) swap card
src/messages/{en,es}.json   (edit) new i18n keys
vercel.json                 (edit) cron schedule entries
```

## What the card shows (Day 1)

```
┌─────────────────────────────────────────┐
│ TODAY'S PRICING · CA → TX               │
├─────────────────────────────────────────┤
│ Sedan        $1,140 - $1,280            │
│ SUV          $1,250 - $1,420            │
│ Pickup       $1,420 - $1,650            │
│                                         │
│ TRANSIT TIME                            │
│ 3-5 days                                │
│ Typical CA→TX carrier transit once      │
│ picked up. Pickup availability changes  │
│ by date and vehicle type.               │
└─────────────────────────────────────────┘

      See today's locked price →
```

No second orange CTA inside the card (avoids competing with hero CTA).

## What changes at Day 30

The same card gets a second column showing a 30-day average:

```
Sedan        $1,140 - $1,280   30d avg: $1,210
SUV          $1,250 - $1,420   30d avg: $1,330
Pickup       $1,420 - $1,650   30d avg: $1,540
```

No structural rebuild; the cron has been logging from Day 1, we just expose the trend.

## Open items

```
SD rate limit         Ben to confirm via SD CSM. Not a blocker.
Hawaii/Alaska scope   Ocean pricing has different model. Build after 6/29.
SD response shape     Validate against actual API response during recon.
Authentication        Confirm cron route is protected (Vercel cron secret).
```

## Sequence

```
1. Recon: existing SD client + Firestore Admin (task 11)
2. Build /api/cron/sync-pricing (task 12)
3. Wire vercel.json cron schedule (task 13)
4. Build CorridorPricingCard component (task 14)
5. Add EN + ES i18n keys (task 15)
6. Swap dark glass card on CA-TX corridor page (task 16)
7. Backfill Firestore + smoke test live (task 17)
```
