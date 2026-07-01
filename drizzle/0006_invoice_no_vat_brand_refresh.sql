ALTER TABLE "invoice" ALTER COLUMN "vatRateBps" SET DEFAULT 0;

UPDATE "workspace_settings"
SET
  "billingLegalName" = 'CloudMonkey (Pty) Ltd',
  "billingEmail" = 'billing@cloudmonkey.co.za',
  "billingPhone" = '+27 21 300 1234',
  "billingWebsite" = 'cloudmonkey.co.za',
  "billingAddress" = E'377 Rivonia Boulevard\nSandton, 2196\nSouth Africa',
  "billingRegistrationNumber" = '2021/743645/07',
  "billingVatNumber" = NULL,
  "billingBankName" = 'FNB Cheque',
  "billingBankAccountName" = 'CloudMonkey (Pty) Ltd',
  "billingBankAccountNumber" = '63157566664',
  "billingBankBranchCode" = '250068',
  "billingInvoiceNotes" = 'Cloud made simple. Support that cares.'
WHERE "id" = 'default';
