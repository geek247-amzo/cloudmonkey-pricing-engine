import logo from "../assets/cm-logo.png";

export type WorkspaceBillingDetails = {
  legalName: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  registrationNumber: string;
  vatNumber: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankBranchCode: string;
  invoiceNotes: string;
};

export type InvoiceDocumentItem = {
  id: string;
  description: string;
  quantity: number;
  unitPriceExVat: number;
  vatAmount: number;
  amount: number;
};

export type InvoiceDocumentData = {
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    currency: string;
    issuedAt: string;
    dueDate: string;
    paidAt: string | null;
    billingPeriodStart: string | null;
    billingPeriodEnd: string | null;
    paystackUrl: string | null;
    notes: string | null;
  };
  customer: {
    name: string;
    email: string;
    company: string | null;
    address: string | null;
    vatNumber: string | null;
  };
  workspaceBilling: WorkspaceBillingDetails;
  items: InvoiceDocumentItem[];
  totals: {
    subtotalExVat: number;
    vatAmount: number;
    totalDue: number;
    vatRateBps: number;
    currency: string;
  };
};

const defaultBilling: WorkspaceBillingDetails = {
  legalName: "CloudMonkey (Pty) Ltd",
  email: "billing@cloudmonkey.co.za",
  phone: "+27 21 300 1234",
  website: "cloudmonkey.co.za",
  address: "377 Rivonia Boulevard\nSandton, 2196\nSouth Africa",
  registrationNumber: "2021/743645/07",
  vatNumber: "",
  bankName: "FNB Cheque",
  bankAccountName: "CloudMonkey (Pty) Ltd",
  bankAccountNumber: "63157566664",
  bankBranchCode: "250068",
  invoiceNotes: "Cloud made simple. Support that cares.",
};

export function getWorkspaceBillingDetails(settings: Record<string, unknown> | null | undefined): WorkspaceBillingDetails {
  return {
    legalName: stringOrDefault(settings?.billingLegalName, defaultBilling.legalName),
    email: stringOrDefault(settings?.billingEmail, defaultBilling.email),
    phone: stringOrDefault(settings?.billingPhone, defaultBilling.phone),
    website: stringOrDefault(settings?.billingWebsite, defaultBilling.website),
    address: stringOrDefault(settings?.billingAddress, defaultBilling.address),
    registrationNumber: stringOrDefault(settings?.billingRegistrationNumber, defaultBilling.registrationNumber),
    vatNumber: stringOrDefault(settings?.billingVatNumber, defaultBilling.vatNumber),
    bankName: stringOrDefault(settings?.billingBankName, defaultBilling.bankName),
    bankAccountName: stringOrDefault(settings?.billingBankAccountName, defaultBilling.bankAccountName),
    bankAccountNumber: stringOrDefault(settings?.billingBankAccountNumber, defaultBilling.bankAccountNumber),
    bankBranchCode: stringOrDefault(settings?.billingBankBranchCode, defaultBilling.bankBranchCode),
    invoiceNotes: stringOrDefault(settings?.billingInvoiceNotes, defaultBilling.invoiceNotes),
  };
}

export function parseWorkspaceBillingSnapshot(value: string | null | undefined, fallback: WorkspaceBillingDetails) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export function formatInvoiceNumber(id: string, explicit?: string | null) {
  if (explicit) return explicit;
  const suffix = id.replace(/^inv[_-]?/i, "").replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase();
  return `INV-${suffix || id.slice(-8).toUpperCase()}`;
}

export function calculateVatInclusiveTotals(totalDue: number, vatRateBps: number) {
  void vatRateBps;
  return {
    subtotalExVat: totalDue,
    vatAmount: 0,
    totalDue,
  };
}

export function buildInvoiceDocumentData(input: {
  invoice: any;
  items: any[];
  customer: any;
  workspaceSettings: Record<string, unknown> | null | undefined;
}): InvoiceDocumentData {
  const fallbackBilling = getWorkspaceBillingDetails(input.workspaceSettings);
  const workspaceBilling = parseWorkspaceBillingSnapshot(input.invoice.workspaceBillingSnapshot, fallbackBilling);
  const vatRateBps = 0;
  const totalDue = Number(input.invoice.amount ?? 0);
  const totals = calculateVatInclusiveTotals(totalDue, vatRateBps);
  const items = (input.items.length ? input.items : [{
    id: `${input.invoice.id}:item`,
    description: "CloudMonkey subscription",
    quantity: 1,
    amount: totalDue,
  }]).map((item) => {
    const amount = Number(item.amount ?? 0);
    const itemTotals = calculateVatInclusiveTotals(amount, vatRateBps);
    const quantity = Number(item.quantity ?? 1) || 1;
    return {
      id: String(item.id),
      description: String(item.description ?? "CloudMonkey service"),
      quantity,
      unitPriceExVat: Math.round(itemTotals.subtotalExVat / quantity),
      vatAmount: itemTotals.vatAmount,
      amount,
    };
  });

  return {
    invoice: {
      id: input.invoice.id,
      invoiceNumber: formatInvoiceNumber(input.invoice.id, input.invoice.invoiceNumber),
      status: input.invoice.status ?? "pending",
      currency: input.invoice.currency ?? "ZAR",
      issuedAt: toIso(input.invoice.issuedAt ?? input.invoice.createdAt),
      dueDate: toIso(input.invoice.dueDate),
      paidAt: input.invoice.paidAt ? toIso(input.invoice.paidAt) : null,
      billingPeriodStart: input.invoice.billingPeriodStart ? toIso(input.invoice.billingPeriodStart) : null,
      billingPeriodEnd: input.invoice.billingPeriodEnd ? toIso(input.invoice.billingPeriodEnd) : null,
      paystackUrl: input.invoice.paystackUrl ?? null,
      notes: input.invoice.notes ?? null,
    },
    customer: {
      name: input.invoice.customerName ?? input.customer?.name ?? "CloudMonkey Customer",
      email: input.invoice.customerEmail ?? input.customer?.email ?? "",
      company: input.invoice.customerCompany ?? null,
      address: input.invoice.customerAddress ?? null,
      vatNumber: input.invoice.customerVatNumber ?? null,
    },
    workspaceBilling,
    items,
    totals: {
      ...totals,
      vatRateBps,
      currency: input.invoice.currency ?? "ZAR",
    },
  };
}

export function renderInvoiceHtml(data: InvoiceDocumentData, options: { document?: boolean; pdf?: boolean } = {}) {
  const body = `
    <main class="cm-invoice ${options.pdf ? "cm-invoice-print" : ""}">
      <section class="cm-invoice-sheet">
        <header class="cm-invoice-header">
          <div class="cm-brand">
            <img src="${assetUrl(logo)}" alt="CloudMonkey" class="cm-brand-image" />
            <span>
              <strong>CloudMonkey</strong>
              <small>Cloud made simple. Support that cares.</small>
            </span>
          </div>
          <div class="cm-invoice-title">
            <h1>INVOICE</h1>
            <p>${escapeHtml(data.invoice.invoiceNumber)}</p>
            <span>${formatDate(data.invoice.issuedAt)}</span>
          </div>
        </header>

        <section class="cm-invoice-grid">
          <div>
            <h2>Billed To</h2>
            <p><strong>${escapeHtml(data.customer.company || data.customer.name)}</strong></p>
            ${data.customer.company ? `<p>${escapeHtml(data.customer.name)}</p>` : ""}
            ${formatMultiline(data.customer.address)}
            ${data.customer.email ? `<p>${escapeHtml(data.customer.email)}</p>` : ""}
            ${data.customer.vatNumber ? `<p>VAT: ${escapeHtml(data.customer.vatNumber)}</p>` : ""}
          </div>
          <div>
            <h2>Invoice Details</h2>
            <dl class="cm-detail-list">
              <dt>Invoice Number</dt><dd>${escapeHtml(data.invoice.invoiceNumber)}</dd>
              <dt>Issue Date</dt><dd>${formatDate(data.invoice.issuedAt)}</dd>
              <dt>Due Date</dt><dd>${formatDate(data.invoice.dueDate)}</dd>
              <dt>Billing Period</dt><dd>${formatPeriod(data)}</dd>
              <dt>Status</dt><dd><span class="cm-status">${escapeHtml(data.invoice.status)}</span></dd>
            </dl>
          </div>
        </section>

        <section class="cm-plan-card">
          <div class="cm-plan-icon">▣</div>
          <div>
            <h2>Your Plan</h2>
            <p>${escapeHtml(data.items[0]?.description ?? "CloudMonkey Services")}</p>
            <span>Billed monthly ${data.invoice.billingPeriodEnd ? `· Renews ${formatDate(data.invoice.billingPeriodEnd)}` : ""}</span>
          </div>
          <div class="cm-plan-total">
            <h2>Total Due</h2>
            <strong>${formatMoney(data.totals.totalDue, data.totals.currency)}</strong>
            <span>No VAT charged</span>
          </div>
        </section>

        <table class="cm-items">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map((item) => `
              <tr>
                <td><strong>${escapeHtml(item.description)}</strong></td>
                <td>${item.quantity}</td>
                <td>${formatMoney(item.unitPriceExVat, data.totals.currency)}</td>
                <td>${formatMoney(item.amount, data.totals.currency)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <section class="cm-totals">
          <dl>
            <dt>Subtotal</dt><dd>${formatMoney(data.totals.subtotalExVat, data.totals.currency)}</dd>
            <dt>VAT</dt><dd>${formatMoney(data.totals.vatAmount, data.totals.currency)}</dd>
            <dt>Total Due</dt><dd>${formatMoney(data.totals.totalDue, data.totals.currency)}</dd>
          </dl>
        </section>

        <section class="cm-payment">
          <h2>Payment Information</h2>
          <div class="cm-payment-grid">
            <div>
              <h3>Bank Transfer</h3>
              <p>${escapeHtml(data.workspaceBilling.bankAccountName)}</p>
              <p>${escapeHtml(data.workspaceBilling.bankName)}</p>
              <p>Account: ${escapeHtml(data.workspaceBilling.bankAccountNumber)}</p>
              <p>Branch Code: ${escapeHtml(data.workspaceBilling.bankBranchCode)}</p>
              <p>Reference: ${escapeHtml(data.invoice.invoiceNumber)}</p>
            </div>
            <div>
              <h3>Pay by Card</h3>
              <p>Pay securely online using your card.</p>
              ${data.invoice.paystackUrl ? `<p><a href="${escapeAttribute(data.invoice.paystackUrl)}">Open payment link</a></p>` : ""}
            </div>
          </div>
        </section>

        <section class="cm-notes">
          <h2>Notes</h2>
          <p>${escapeHtml(data.invoice.notes || data.workspaceBilling.invoiceNotes)}</p>
        </section>

        <footer class="cm-invoice-footer">
          <div class="cm-brand cm-brand-footer">
            <img src="${assetUrl(logo)}" alt="CloudMonkey" class="cm-brand-image" />
            <div>
              <strong>CloudMonkey</strong>
              <small>Cloud made simple. Support that cares.</small>
            </div>
          </div>
          <div>
            <h3>Contact Us</h3>
            <p>${escapeHtml(data.workspaceBilling.legalName)}</p>
            <p>Registration number: ${escapeHtml(data.workspaceBilling.registrationNumber)}</p>
            <p>${escapeHtml(data.workspaceBilling.email)}</p>
            <p>${escapeHtml(data.workspaceBilling.phone)}</p>
            <p>${escapeHtml(data.workspaceBilling.website)}</p>
          </div>
          <div>
            <h3>Registered Address</h3>
            ${formatMultiline(data.workspaceBilling.address)}
            <p>Banking details: ${escapeHtml(data.workspaceBilling.bankName)}</p>
            <p>Acc Number: ${escapeHtml(data.workspaceBilling.bankAccountNumber)}</p>
            <p>Branch code: ${escapeHtml(data.workspaceBilling.bankBranchCode)}</p>
          </div>
          <div class="cm-footer-line">Cloud made simple. Support that cares.</div>
        </footer>
      </section>
    </main>
  `;

  if (!options.document) return `<style>${invoiceCss}</style>${body}`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(data.invoice.invoiceNumber)}</title><style>${invoiceCss}</style></head><body>${body}</body></html>`;
}

export const invoiceCss = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #f6f7fb; color: #11182f; font-family: Inter, Arial, sans-serif; }
  .cm-invoice { padding: 24px; }
  .cm-invoice-sheet { width: min(100%, 980px); margin: 0 auto; overflow: hidden; border: 1px solid #d8c8ff; border-radius: 10px; background: #fff; box-shadow: 0 18px 48px rgba(18, 11, 45, .08); }
  .cm-invoice-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; padding: 42px 48px 32px; }
  .cm-brand { display: flex; align-items: center; gap: 14px; }
  .cm-brand-image { width: 68px; height: 68px; display: block; object-fit: contain; }
  .cm-brand strong { display: block; font-size: 34px; line-height: 1; letter-spacing: -0.02em; }
  .cm-brand small { display: block; margin-top: 7px; color: #5b2ee7; font-size: 12px; font-weight: 800; }
  .cm-invoice-title { text-align: right; }
  .cm-invoice-title h1 { margin: 0 0 12px; color: #5728ef; font-size: 34px; line-height: 1; }
  .cm-invoice-title p { margin: 0 0 8px; font-weight: 800; }
  .cm-invoice-title span, .cm-detail-list, .cm-plan-card span, .cm-payment p, .cm-notes p, .cm-invoice-grid p { color: #262b44; font-size: 14px; line-height: 1.55; }
  .cm-invoice-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; padding: 0 48px 34px; }
  h2 { margin: 0 0 14px; color: #5329e8; font-size: 13px; text-transform: uppercase; letter-spacing: .02em; }
  h3 { margin: 0 0 8px; font-size: 14px; }
  p { margin: 0; }
  .cm-detail-list { display: grid; grid-template-columns: 150px 1fr; gap: 8px 18px; margin: 0; }
  .cm-detail-list dt { color: #242943; font-weight: 700; }
  .cm-detail-list dd { margin: 0; }
  .cm-status { display: inline-flex; border-radius: 999px; background: #efe9ff; color: #5528e8; padding: 3px 9px; font-size: 12px; font-weight: 800; text-transform: uppercase; }
  .cm-plan-card { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 22px; margin: 0 48px 32px; padding: 28px; border: 1px solid #cbb9ff; border-radius: 8px; background: linear-gradient(100deg, #fff, #f7f2ff); }
  .cm-plan-icon { display: flex; width: 74px; height: 74px; align-items: center; justify-content: center; border-radius: 50%; background: #5728e8; color: #fff; font-size: 28px; }
  .cm-plan-card p { margin: 0 0 8px; font-size: 22px; font-weight: 900; }
  .cm-plan-total { text-align: right; }
  .cm-plan-total strong { display: block; margin: 8px 0 6px; font-size: 25px; }
  .cm-items { width: calc(100% - 96px); margin: 0 48px 18px; border-collapse: collapse; font-size: 14px; }
  .cm-items th { border-bottom: 2px solid #ddd7f6; color: #5229e8; font-size: 12px; text-align: left; text-transform: uppercase; padding: 12px 0; }
  .cm-items th:not(:first-child), .cm-items td:not(:first-child) { text-align: right; }
  .cm-items td { border-bottom: 1px solid #e6e8f0; padding: 18px 0; vertical-align: top; }
  .cm-totals { display: flex; justify-content: flex-end; padding: 0 48px 28px; }
  .cm-totals dl { min-width: 420px; display: grid; grid-template-columns: 1fr auto; gap: 12px 24px; margin: 0; }
  .cm-totals dt, .cm-totals dd { margin: 0; }
  .cm-totals dt:last-of-type, .cm-totals dd:last-of-type { padding: 12px; background: #f1ebff; color: #5528e8; font-size: 18px; font-weight: 900; }
  .cm-payment, .cm-notes { margin: 0 48px; padding: 24px 0; border-top: 1px solid #e0e4ee; }
  .cm-payment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; }
  .cm-payment a { color: #5528e8; font-weight: 800; text-decoration: none; }
  .cm-invoice-footer { display: grid; grid-template-columns: 1.2fr 1fr 1.2fr; gap: 28px; margin-top: 22px; padding: 34px 48px 22px; background: radial-gradient(circle at 20% 20%, rgba(107,48,245,.35), transparent 32%), #070720; color: #fff; }
  .cm-invoice-footer p { color: #fff; font-size: 13px; line-height: 1.45; }
  .cm-invoice-footer h3 { color: #b99bff; text-transform: uppercase; font-size: 12px; }
  .cm-brand-footer { align-items: center; }
  .cm-brand-footer div { display: flex; flex-direction: column; }
  .cm-brand-footer strong { color: #fff; font-size: 27px; }
  .cm-brand-footer small { color: #c8b8ff; font-size: 12px; font-weight: 700; margin-top: 6px; }
  .cm-footer-line { grid-column: 1 / -1; border-top: 1px solid rgba(255,255,255,.15); padding-top: 20px; text-align: center; color: #c3b0ff; font-size: 12px; font-weight: 800; }
  .cm-invoice-print .cm-invoice-sheet { overflow: visible; }
  .cm-invoice-print .cm-invoice-grid,
  .cm-invoice-print .cm-plan-card,
  .cm-invoice-print .cm-items,
  .cm-invoice-print .cm-totals,
  .cm-invoice-print .cm-payment,
  .cm-invoice-print .cm-notes {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .cm-invoice-print .cm-items { break-inside: auto; page-break-inside: auto; }
  .cm-invoice-print .cm-items thead { display: table-header-group; }
  .cm-invoice-print .cm-items tbody { display: table-row-group; }
  .cm-invoice-print .cm-items tr { break-inside: avoid; page-break-inside: avoid; }
  @media print {
    @page { size: A4; margin: 0; }
    body { background: #fff; }
    .cm-invoice { padding: 0; }
    .cm-invoice-sheet {
      width: 100%;
      border: 0;
      border-radius: 0;
      box-shadow: none;
      overflow: visible;
    }
    .cm-invoice-print .cm-plan-card,
    .cm-invoice-print .cm-payment,
    .cm-invoice-print .cm-notes {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .cm-invoice-print .cm-items thead { display: table-header-group; }
    .cm-invoice-print .cm-items tr { break-inside: avoid; page-break-inside: avoid; }
  }
`;

function stringOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function toIso(value: string | Date | null | undefined) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function formatDate(value: string | null) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-ZA", { year: "numeric", month: "short", day: "2-digit" }).format(new Date(value));
}

function formatPeriod(data: InvoiceDocumentData) {
  if (!data.invoice.billingPeriodStart || !data.invoice.billingPeriodEnd) return "N/A";
  return `${formatDate(data.invoice.billingPeriodStart)} - ${formatDate(data.invoice.billingPeriodEnd)}`;
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(cents / 100).replace("ZAR", "ZAR ");
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value: unknown) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function formatMultiline(value: string | null | undefined) {
  if (!value) return "";
  return escapeHtml(value).split("\n").filter(Boolean).map((line) => `<p>${line}</p>`).join("");
}

function assetUrl(asset: string) {
  const siteUrl = process.env.PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? "https://cloudmonkey.co.za";
  return asset.startsWith("http://") || asset.startsWith("https://") ? asset : new URL(asset, siteUrl).toString();
}
