/**
 * Plant (or remove) two TEST shipments owned by Eddie's email so the
 * portal can be verified end-to-end with SHIPMENTS_SOURCE=firestore —
 * the ownership check 404s any shipment that isn't yours, so real
 * customer docs can't be used for testing.
 *
 * Also handy for quarterly-deck screenshots: one in-transit view with a
 * live map position, one fully delivered with milestones.
 *
 * Usage:
 *   node scripts/make-test-shipments.mjs           # create/refresh
 *   node scripts/make-test-shipments.mjs --delete  # remove them
 */
import { config as loadEnv } from "dotenv";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

loadEnv({ path: ".env.local" });
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!getApps().length) {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  else initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore();

const OWNER_EMAIL = "eddiezal28@gmail.com";
const IDS = ["ALL-TEST-0001", "ALL-TEST-0002"];

if (process.argv.includes("--delete")) {
  for (const id of IDS) await db.collection("shipments").doc(id).delete();
  console.log(`Deleted ${IDS.join(", ")}.`);
  process.exit(0);
}

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();
const customer = {
  id: "TEST-EDDIE",
  email: OWNER_EMAIL,
  phone: "+18185550100",
  name: { first: "Eddie", last: "Zaldivar" },
  locale: "en",
  preferredChannel: "email",
};
const coordinator = {
  name: "Ginger Marie",
  phone: "",
  email: "ginger@autolinelogistics.com",
  languages: ["en"],
  hours: { start: "07:00", end: "19:00", timezone: "America/Los_Angeles" },
};

/** In transit: LA → Miami, currently near Albuquerque. */
const inTransit = {
  id: "ALL-TEST-0001",
  orderNumber: "ALL-TEST-0001",
  status: "inTransit",
  customer,
  coordinator,
  vehicle: { year: 2022, make: "Toyota", model: "Camry", condition: "operable", enclosedRequired: false },
  origin: { zip: "90012", city: "Los Angeles", state: "CA" },
  destination: { zip: "33101", city: "Miami", state: "FL" },
  tier: "priority",
  priceLockedCents: 129_500,
  createdAt: daysAgo(6),
  bookedAt: daysAgo(6),
  pickedUpAt: daysAgo(2),
  currentLocation: {
    lat: 35.0844,
    lng: -106.6504,
    label: "Near Albuquerque, NM",
    lastUpdatedAt: daysAgo(0),
  },
  eta: { at: daysAgo(-2), confidenceScore: 0.85, computedAt: daysAgo(0) },
  milestones: [
    { id: "t1-booked", type: "booked", at: daysAgo(6) },
    { id: "t1-pickedUp", type: "pickedUp", at: daysAgo(2) },
    { id: "t1-waypoint", type: "atWaypoint", at: daysAgo(1), location: { lat: 33.4484, lng: -112.074, label: "Phoenix, AZ" } },
  ],
  payments: [],
  proabdAbdId: "TEST-0001",
  proabdStatusId: "19",
  proabdStatusText: "In Transit",
  proabdTrailerType: "Open",
};

/** Delivered: Phoenix → Dallas, completed last week. */
const delivered = {
  id: "ALL-TEST-0002",
  orderNumber: "ALL-TEST-0002",
  status: "delivered",
  customer,
  coordinator,
  vehicle: { year: 2019, make: "Ford", model: "F-150", condition: "operable", enclosedRequired: false },
  origin: { zip: "85004", city: "Phoenix", state: "AZ" },
  destination: { zip: "75201", city: "Dallas", state: "TX" },
  tier: "standby",
  priceLockedCents: 89_900,
  createdAt: daysAgo(14),
  bookedAt: daysAgo(13),
  pickedUpAt: daysAgo(9),
  deliveredAt: daysAgo(7),
  milestones: [
    { id: "t2-booked", type: "booked", at: daysAgo(13) },
    { id: "t2-pickedUp", type: "pickedUp", at: daysAgo(9) },
    { id: "t2-delivered", type: "delivered", at: daysAgo(7) },
  ],
  payments: [],
  proabdAbdId: "TEST-0002",
  proabdStatusId: "20",
  proabdStatusText: "Delivered",
  proabdTrailerType: "Open",
};

await db.collection("shipments").doc(inTransit.id).set(inTransit);
await db.collection("shipments").doc(delivered.id).set(delivered);
console.log(`Created ${IDS.join(", ")} owned by ${OWNER_EMAIL}.`);
console.log("Portal login with that email → both should appear.");
console.log("Remove later with: node scripts/make-test-shipments.mjs --delete");
process.exit(0);
