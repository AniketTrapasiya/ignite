/**
 * Stripe integration.
 *
 * Credentials:
 *   apiKey = Stripe Secret Key (sk_live_... or sk_test_...)
 *
 * Used as a data enrichment source — fetch revenue, customers, recent charges.
 */

const STRIPE_API = "https://api.stripe.com/v1";

function stripeHeaders(secretKey: string) {
  return {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

export interface StripeCharge {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  customerEmail?: string;
  created: number;
}

export interface StripeBalance {
  available: { amount: number; currency: string }[];
  pending: { amount: number; currency: string }[];
}

/**
 * Get recent charges.
 */
export async function getStripeCharges(
  secretKey: string,
  limit = 10
): Promise<{ ok: boolean; charges?: StripeCharge[]; error?: string }> {
  try {
    const params = new URLSearchParams({ limit: String(limit), expand: "data.customer" });
    const res = await fetch(`${STRIPE_API}/charges?${params}`, {
      headers: stripeHeaders(secretKey),
      cache: "no-store",
    });
    const json = await res.json() as {
      data?: Array<{
        id: string; amount: number; currency: string; status: string;
        description: string; created: number;
        customer?: { email: string };
        billing_details?: { email: string };
      }>;
      error?: { message: string };
    };
    if (!res.ok || json.error) return { ok: false, error: json.error?.message ?? `Stripe HTTP ${res.status}` };
    const charges: StripeCharge[] = (json.data ?? []).map((c) => ({
      id: c.id,
      amount: c.amount / 100,
      currency: c.currency.toUpperCase(),
      status: c.status,
      description: c.description ?? "",
      customerEmail: c.customer?.email ?? c.billing_details?.email,
      created: c.created,
    }));
    return { ok: true, charges };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Get Stripe account balance.
 */
export async function getStripeBalance(
  secretKey: string
): Promise<{ ok: boolean; balance?: StripeBalance; error?: string }> {
  try {
    const res = await fetch(`${STRIPE_API}/balance`, {
      headers: stripeHeaders(secretKey),
      cache: "no-store",
    });
    const json = await res.json() as {
      available?: { amount: number; currency: string }[];
      pending?: { amount: number; currency: string }[];
      error?: { message: string };
    };
    if (!res.ok || json.error) return { ok: false, error: json.error?.message ?? `Stripe HTTP ${res.status}` };
    return {
      ok: true,
      balance: {
        available: (json.available ?? []).map((b) => ({ ...b, amount: b.amount / 100 })),
        pending: (json.pending ?? []).map((b) => ({ ...b, amount: b.amount / 100 })),
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function formatStripeContext(balance: StripeBalance, charges: StripeCharge[]): string {
  const balanceStr = balance.available
    .map((b) => `${b.currency} ${b.amount.toFixed(2)}`)
    .join(", ");
  const recentStr = charges
    .slice(0, 5)
    .map((c) => `  ${c.currency} ${c.amount.toFixed(2)} — ${c.status}${c.customerEmail ? ` (${c.customerEmail})` : ""}`)
    .join("\n");
  return `Stripe Balance (available): ${balanceStr}\nRecent charges:\n${recentStr}`;
}
