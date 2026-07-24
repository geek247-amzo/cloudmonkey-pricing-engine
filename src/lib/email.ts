import nodemailer from "nodemailer";
import logo from "../assets/cm-logo.png";

type EmailTemplateId =
  | "invoice_created"
  | "payment_received"
  | "lead_created"
  | "onboarding_received"
  | "support_notification"
  | "welcome"
  | "seo_scan_results"
  | "generic";

type SendEmailInput = {
  template: EmailTemplateId | string;
  to: string;
  subject: string;
  data?: Record<string, unknown>;
  idempotencyKey?: string;
  customId?: string;
};

type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

const featureBlocks = [
  { icon: "✦", title: "Automate", body: "Streamline workflows and eliminate repetitive tasks." },
  { icon: "↗", title: "Innovate", body: "Leverage AI to unlock new opportunities and insights." },
  { icon: "◇", title: "Secure", body: "Enterprise-grade security to protect what matters most." },
];

export async function sendEmail(input: SendEmailInput) {
  const user = process.env.MAILJET_SMTP_USER;
  const pass = process.env.MAILJET_SMTP_PASS;
  const fromEmail = process.env.MAILJET_FROM_EMAIL ?? "info@cloudmonkey.co.za";
  const fromName = process.env.MAILJET_FROM_NAME ?? "CloudMonkey";

  if (!user || !pass || !fromEmail) {
    throw new Error("Mailjet SMTP is not configured");
  }

  const rendered = renderEmailTemplate(input.template, input.subject, input.data ?? {});
  const transporter = nodemailer.createTransport({
    host: process.env.MAILJET_SMTP_HOST ?? "in-v3.mailjet.com",
    port: Number(process.env.MAILJET_SMTP_PORT ?? 587),
    secure: process.env.MAILJET_SMTP_SECURE === "true",
    auth: { user, pass },
  });

  const headers: Record<string, string> = {};
  if (input.idempotencyKey) headers["X-CloudMonkey-Idempotency-Key"] = input.idempotencyKey;
  if (input.customId) headers["X-Mailjet-CustomID"] = input.customId;

  await transporter.sendMail({
    from: `${fromName} <${fromEmail}>`,
    to: input.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });
}

export function renderEmailTemplate(template: string, fallbackSubject: string, data: Record<string, unknown>): RenderedEmail {
  const firstName = firstString(data.firstName, data.name, data.customerName, data.userName, "there").split(" ")[0];
  const ctaText = firstString(data.primaryCtaText, data.ctaText, "Open CloudMonkey");
  const ctaUrl = firstString(data.primaryCtaUrl, data.ctaUrl, process.env.BETTER_AUTH_URL ?? "https://cloudmonkey.co.za");
  const logoUrl = assetUrl(logo);
  const title = getTemplateTitle(template, data);
  const intro = getTemplateIntro(template, data);
  const body = getTemplateBody(template, data);
  const subject = firstString(data.subject, fallbackSubject, title);
  const html = renderEmailShell({
    firstName,
    logoUrl,
    title,
    intro,
    body,
    ctaText,
    ctaUrl,
  });

  return {
    subject,
    html,
    text: [
      `Hi ${firstName},`,
      title,
      intro,
      body,
      `${ctaText}: ${ctaUrl}`,
      "The CloudMonkey Team",
    ].filter(Boolean).join("\n\n"),
  };
}

function getTemplateTitle(template: string, data: Record<string, unknown>) {
  if (data.emailTitle) return String(data.emailTitle);
  switch (template) {
    case "invoice_created":
      return `Invoice ${firstString(data.invoiceNumber, data.invoiceId, "")} is ready`;
    case "payment_received":
      return "Payment received";
    case "lead_created":
      return "New CloudMonkey lead";
    case "onboarding_received":
      return "Onboarding received";
    case "support_notification":
      return "Support update";
    case "welcome":
      return "Welcome to CloudMonkey";
    case "seo_scan_results":
      return "Your CloudMonkey SEO check is ready";
    default:
      return "CloudMonkey update";
  }
}

function getTemplateIntro(template: string, data: Record<string, unknown>) {
  if (data.emailIntro) return String(data.emailIntro);
  switch (template) {
    case "invoice_created":
      return `Your invoice for ${firstString(data.productName, data.subscriptionName, "CloudMonkey services")} is ready.`;
    case "payment_received":
      return `Thanks, your payment for ${firstString(data.productName, data.subscriptionName, "CloudMonkey services")} has been received.`;
    case "lead_created":
      return `${firstString(data.name, "A visitor")} submitted a new CloudMonkey lead.`;
    case "onboarding_received":
      return "A customer submitted onboarding details for a paid subscription.";
    case "support_notification":
      return firstString(data.summary, "There is an update on a CloudMonkey support request.");
    case "welcome":
      return "Your CloudMonkey account is ready. Here are the next steps to get value quickly.";
    case "seo_scan_results":
      return "Your initial SEO checker results are ready to review.";
    default:
      return firstString(data.emailIntro, "We're writing with an update from CloudMonkey.");
  }
}

function getTemplateBody(template: string, data: Record<string, unknown>) {
  if (data.emailBody) return String(data.emailBody);
  switch (template) {
    case "invoice_created":
      return `Total due: ${firstString(data.totalDue, "")}. Due date: ${firstString(data.dueDate, "")}.`;
    case "payment_received":
      return "Your subscription is active and the next steps are available in your dashboard.";
    case "lead_created":
      return `Email: ${firstString(data.email, "N/A")}\nCompany: ${firstString(data.company, "N/A")}`;
    case "onboarding_received":
      return `Customer: ${firstString(data.customerEmail, data.email, "N/A")}\nSubscription: ${firstString(data.subscriptionName, "N/A")}`;
    case "support_notification":
      return firstString(data.body, "Open the dashboard to review the support update.");
    case "welcome":
      return "Complete your profile, connect your first service, and use the dashboard to keep everything in one place.";
    case "seo_scan_results":
      return `We found ${firstString(data.findingCount, "a few")} items worth reviewing. The dashboard shows the recommended next actions.`;
    default:
      return firstString(data.body, "Open your CloudMonkey dashboard for more detail.");
  }
}

function renderEmailShell(input: {
  firstName: string;
  logoUrl: string;
  title: string;
  intro: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
}) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;background:#050518;color:#10162f;font-family:Inter,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050518;padding:28px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:640px;max-width:94%;overflow:hidden;border:1px solid #8c6cff;border-radius:10px;background:#ffffff;">
          <tr>
            <td style="background:#080723;padding:24px 34px;">
              <table role="presentation" width="100%">
                <tr>
                  <td style="color:#fff;font-size:24px;font-weight:800;">
                    <img src="${escapeAttribute(input.logoUrl)}" alt="CloudMonkey" style="width:42px;height:42px;margin-right:10px;vertical-align:middle;display:inline-block;">
                    <span style="vertical-align:middle;">CloudMonkey</span>
                  </td>
                  <td align="right" style="color:#bda9ff;font-size:12px;font-weight:800;">Cloud made simple.<br>Support that cares.</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:linear-gradient(135deg,#ffffff 0%,#f7f0ff 55%,#fff1ed 100%);padding:46px 42px 34px;">
              <div style="max-width:440px;">
                <h1 style="margin:0 0 14px;color:#11182f;font-size:30px;line-height:1.15;">Hi ${escapeHtml(input.firstName)},</h1>
                <h2 style="margin:0 0 18px;color:#5b2ee7;font-size:28px;line-height:1.1;">${escapeHtml(input.title)}</h2>
                <p style="margin:0 0 14px;color:#222842;font-size:15px;line-height:1.65;">${escapeHtml(input.intro)}</p>
                <p style="margin:0 0 26px;color:#222842;font-size:15px;line-height:1.65;white-space:pre-line;">${escapeHtml(input.body)}</p>
                <a href="${escapeAttribute(input.ctaUrl)}" style="display:inline-block;border-radius:8px;background:#5b2ee7;color:#fff;font-size:14px;font-weight:800;padding:15px 26px;text-decoration:none;">${escapeHtml(input.ctaText)} →</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:34px 36px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  ${featureBlocks.map((feature) => `
                    <td width="33.33%" align="center" style="padding:0 18px;border-right:1px solid #e5e8f0;">
                      <div style="display:inline-block;width:58px;height:58px;border-radius:50%;line-height:58px;background:#5b2ee7;color:#fff;font-size:24px;font-weight:800;">${feature.icon}</div>
                      <h3 style="margin:18px 0 8px;color:#11182f;font-size:15px;">${feature.title}</h3>
                      <p style="margin:0;color:#424860;font-size:13px;line-height:1.55;">${feature.body}</p>
                    </td>
                  `).join("")}
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 42px 34px;color:#222842;font-size:14px;line-height:1.65;">
              <p style="margin:0 0 12px;">If you have any questions, we're here to help.</p>
              <p style="margin:0;">The CloudMonkey Team</p>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid #dfe3ef;padding:24px 34px 30px;">
              <table role="presentation" width="100%">
                <tr>
                  <td style="color:#11182f;font-size:22px;font-weight:800;">
                    <img src="${escapeAttribute(input.logoUrl)}" alt="CloudMonkey" style="width:30px;height:30px;margin-right:8px;vertical-align:middle;display:inline-block;">
                    <span style="vertical-align:middle;">CloudMonkey</span>
                  </td>
                  <td align="right" style="color:#5b2ee7;font-size:13px;">Cloud made simple. Support that cares.</td>
                </tr>
              </table>
              <p style="margin:20px 0 0;text-align:center;color:#6d7380;font-size:12px;">© 2026 CloudMonkey (Pty) Ltd. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function assetUrl(asset: string) {
  const siteUrl = process.env.PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? "https://cloudmonkey.co.za";
  return asset.startsWith("http://") || asset.startsWith("https://") ? asset : new URL(asset, siteUrl).toString();
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
