const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;

export interface InitializePaymentResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export function buildPaystackReference(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function initializePayment(input: {
  email: string;
  amountCents: number;
  invoiceId: string;
  subscriptionId: string;
  userId: string;
  planId?: string | null;
  bundleId?: string | null;
  callbackUrl?: string;
}): Promise<InitializePaymentResponse> {
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: input.amountCents,
      callback_url: input.callbackUrl,
      metadata: {
        custom_fields: [
          {
            display_name: "Invoice ID",
            variable_name: "invoice_id",
            value: input.invoiceId,
          },
        ],
        invoice_id: input.invoiceId,
        subscription_id: input.subscriptionId,
        user_id: input.userId,
        plan_id: input.planId ?? null,
        bundle_id: input.bundleId ?? null,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Paystack initialize failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

export async function verifyPayment(reference: string) {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Paystack verify failed: ${response.status}`);
  }

  return response.json();
}
