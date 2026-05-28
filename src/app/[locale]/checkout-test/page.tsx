import { PaymentForm } from "@/components/PaymentForm";

/**
 * TEMPORARY sandbox test harness for the Accept.js → /api/payments/charge flow.
 * Visit /en/checkout-test. Charges $1.00 against the Auth.net sandbox.
 *
 * REMOVE before production launch — this is a dev-only proving ground, not a
 * real checkout. The real payment UI lives in the portal billing section.
 */
export default function CheckoutTestPage() {
  return (
    <main className="max-w-md mx-auto px-4 py-12">
      <h1
        className="text-2xl font-bold mb-1"
        style={{ color: "var(--color-text-default)" }}
      >
        Sandbox checkout test
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        Test card 4111 1111 1111 1111 · any future expiry · any CVV.
      </p>
      <PaymentForm
        amountCents={100}
        refId="TEST-001"
        description="Sandbox test charge"
        customerEmail="test@autolinelogistics.com"
      />
    </main>
  );
}
