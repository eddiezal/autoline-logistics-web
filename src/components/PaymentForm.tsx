"use client";

/**
 * Accept.js checkout form (SANDBOX-ready).
 *
 * PCI model: card fields live on our page, but their values are handed
 * straight to Accept.dispatchData() in the browser and exchanged for an
 * opaque token. The raw card number NEVER touches our server — we only
 * POST the opaque token to /api/payments/charge.
 *
 * Browser-safe credentials (exposed by design, hence NEXT_PUBLIC_):
 *   NEXT_PUBLIC_AUTHNET_API_LOGIN_ID  — same value as the server's login id
 *   NEXT_PUBLIC_AUTHNET_CLIENT_KEY    — the "Public Client Key" from the
 *                                       sandbox dashboard (NOT the Transaction
 *                                       or Signature Key — those stay server-only)
 *   NEXT_PUBLIC_AUTHNET_ENV           — "sandbox" | "production" (CDN switch)
 *
 * Sandbox test card: 4111 1111 1111 1111, any future expiry, any 3-digit CVV.
 */

import { useEffect, useState, type CSSProperties, type FormEvent } from "react";

/* Accept.js global (loaded from the CDN script). */
interface AcceptResponse {
  messages: {
    resultCode: string;
    message: Array<{ code: string; text: string }>;
  };
  opaqueData?: { dataDescriptor: string; dataValue: string };
}
declare global {
  interface Window {
    Accept?: {
      dispatchData: (
        data: {
          authData: { clientKey: string; apiLoginID: string };
          cardData: {
            cardNumber: string;
            month: string;
            year: string;
            cardCode: string;
            zip?: string;
          };
        },
        handler: (response: AcceptResponse) => void,
      ) => void;
    };
  }
}

const ENV =
  process.env.NEXT_PUBLIC_AUTHNET_ENV === "production" ? "production" : "sandbox";
const ACCEPT_JS_URL =
  ENV === "production"
    ? "https://js.authorize.net/v1/Accept.js"
    : "https://jstest.authorize.net/v1/Accept.js";
const API_LOGIN_ID = process.env.NEXT_PUBLIC_AUTHNET_API_LOGIN_ID || "";
const CLIENT_KEY = process.env.NEXT_PUBLIC_AUTHNET_CLIENT_KEY || "";

type Status =
  | { kind: "idle" }
  | { kind: "tokenizing" }
  | { kind: "charging" }
  | { kind: "approved"; transactionId: string; last4: string | null }
  | { kind: "declined"; message: string }
  | { kind: "error"; message: string };

interface Props {
  amountCents: number;
  refId?: string;
  description?: string;
  customerEmail?: string;
  onApproved?: (transactionId: string) => void;
}

export function PaymentForm({
  amountCents,
  refId,
  description,
  customerEmail,
  onApproved,
}: Props) {
  const [ready, setReady] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const [card, setCard] = useState("");
  const [exp, setExp] = useState(""); // MM/YY
  const [cvc, setCvc] = useState("");
  const [zip, setZip] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // Load Accept.js from the environment-appropriate CDN.
  useEffect(() => {
    if (window.Accept) {
      setReady(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${ACCEPT_JS_URL}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => setReady(true));
      return;
    }
    const s = document.createElement("script");
    s.src = ACCEPT_JS_URL;
    s.async = true;
    s.onload = () => setReady(true);
    s.onerror = () => setScriptError(true);
    document.body.appendChild(s);
  }, []);

  const configured = Boolean(API_LOGIN_ID && CLIENT_KEY);
  const busy = status.kind === "tokenizing" || status.kind === "charging";

  function parseExp(v: string): { month: string; year: string } | null {
    const m = v.replace(/\s/g, "").match(/^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/);
    if (!m) return null;
    const month = m[1].padStart(2, "0");
    const year = m[2].length === 4 ? m[2].slice(-2) : m[2];
    if (Number(month) < 1 || Number(month) > 12) return null;
    return { month, year };
  }

  async function charge(opaque: { dataDescriptor: string; dataValue: string }) {
    setStatus({ kind: "charging" });
    try {
      const res = await fetch("/api/payments/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          opaque,
          refId,
          description,
          customerEmail,
        }),
      });
      const data = (await res.json()) as {
        approved?: boolean;
        transactionId?: string;
        last4?: string | null;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setStatus({ kind: "error", message: data.error || "Payment failed." });
        return;
      }
      if (data.approved) {
        setStatus({
          kind: "approved",
          transactionId: data.transactionId || "",
          last4: data.last4 ?? null,
        });
        onApproved?.(data.transactionId || "");
      } else {
        setStatus({ kind: "declined", message: data.message || "Card declined." });
      }
    } catch {
      setStatus({ kind: "error", message: "Network error reaching the gateway." });
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready || !window.Accept || !configured) return;

    const parsed = parseExp(exp);
    if (!parsed) {
      setStatus({ kind: "error", message: "Enter expiry as MM/YY." });
      return;
    }

    setStatus({ kind: "tokenizing" });
    window.Accept.dispatchData(
      {
        authData: { clientKey: CLIENT_KEY, apiLoginID: API_LOGIN_ID },
        cardData: {
          cardNumber: card.replace(/\s/g, ""),
          month: parsed.month,
          year: parsed.year,
          cardCode: cvc.trim(),
          zip: zip.trim() || undefined,
        },
      },
      (response) => {
        if (response.messages.resultCode === "Error" || !response.opaqueData) {
          const msg =
            response.messages.message?.[0]?.text || "Card details rejected.";
          setStatus({ kind: "error", message: msg });
          return;
        }
        void charge(response.opaqueData);
      },
    );
  }

  const inputStyle: CSSProperties = {
    background: "var(--color-surface)",
    borderColor: "var(--color-gray-300)",
    color: "var(--color-text-default)",
  };

  return (
    <div
      className="rounded-2xl border p-6 md:p-8 shadow-sm"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-gray-200)" }}
    >
      <div className="flex items-baseline justify-between">
        <h2
          className="text-xl font-bold"
          style={{ color: "var(--color-text-default)" }}
        >
          Payment
        </h2>
        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          ${(amountCents / 100).toFixed(2)}
        </span>
      </div>

      {!configured && (
        <p className="mt-4 text-sm" style={{ color: "var(--color-danger)" }}>
          Missing NEXT_PUBLIC_AUTHNET_API_LOGIN_ID / NEXT_PUBLIC_AUTHNET_CLIENT_KEY.
        </p>
      )}
      {scriptError && (
        <p className="mt-4 text-sm" style={{ color: "var(--color-danger)" }}>
          Could not load Accept.js from {ENV} CDN.
        </p>
      )}

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-semibold mb-1.5" htmlFor="card">
            Card number
          </label>
          <input
            id="card"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="4111 1111 1111 1111"
            className="w-full px-4 py-3 rounded-lg border text-base focus:outline-none focus:ring-2"
            style={inputStyle}
            value={card}
            onChange={(e) => setCard(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-semibold mb-1.5" htmlFor="exp">
              Expiry
            </label>
            <input
              id="exp"
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/YY"
              className="w-full px-4 py-3 rounded-lg border text-base focus:outline-none focus:ring-2"
              style={inputStyle}
              value={exp}
              onChange={(e) => setExp(e.target.value)}
              disabled={busy}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5" htmlFor="cvc">
              CVV
            </label>
            <input
              id="cvc"
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="123"
              className="w-full px-4 py-3 rounded-lg border text-base focus:outline-none focus:ring-2"
              style={inputStyle}
              value={cvc}
              onChange={(e) => setCvc(e.target.value)}
              disabled={busy}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5" htmlFor="zip">
              ZIP
            </label>
            <input
              id="zip"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="90001"
              className="w-full px-4 py-3 rounded-lg border text-base focus:outline-none focus:ring-2"
              style={inputStyle}
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              disabled={busy}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!ready || busy || !configured}
          className="w-full px-6 py-3 rounded-full font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{
            background: "var(--color-brand-primary)",
            color: "var(--color-brand-paper)",
          }}
        >
          {status.kind === "tokenizing"
            ? "Securing card…"
            : status.kind === "charging"
              ? "Processing…"
              : !ready
                ? "Loading…"
                : `Pay $${(amountCents / 100).toFixed(2)}`}
        </button>
      </form>

      {status.kind === "approved" && (
        <div
          className="mt-4 text-sm rounded-lg px-3 py-2"
          style={{
            color: "color-mix(in oklab, var(--color-success) 92%, black)",
            background: "color-mix(in oklab, var(--color-success) 12%, white)",
          }}
        >
          Approved · tx {status.transactionId}
          {status.last4 ? ` · card ending ${status.last4}` : ""}
        </div>
      )}
      {status.kind === "declined" && (
        <div className="mt-4 text-sm" style={{ color: "var(--color-warning)" }}>
          Declined: {status.message}
        </div>
      )}
      {status.kind === "error" && (
        <div className="mt-4 text-sm" style={{ color: "var(--color-danger)" }}>
          {status.message}
        </div>
      )}
    </div>
  );
}
