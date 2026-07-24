ALTER TABLE "invoice_payment" ADD COLUMN IF NOT EXISTS "idempotencyKey" text;
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_payment_invoice_idempotency_key_unique"
  ON "invoice_payment" ("invoiceId", "idempotencyKey");
