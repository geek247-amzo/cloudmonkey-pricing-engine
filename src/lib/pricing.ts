// Pricing data — designed to mirror the future API shape.
// Tables: service_categories, services, service_plans, service_features, service_bundles, pricing_rules.
// Frontend reads through getCategory()/getBundles() so swapping to an API later is a one-file change.

export type Currency = "ZAR" | "USD" | "GBP" | "EUR";

export const CURRENCIES: { code: Currency; symbol: string; label: string }[] = [
  { code: "ZAR", symbol: "R", label: "South African Rand" },
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "EUR", symbol: "€", label: "Euro" },
];

// Static FX rates from ZAR. Will be replaced by pricing_rules table.
const FX: Record<Currency, number> = {
  ZAR: 1,
  USD: 0.054,
  GBP: 0.042,
  EUR: 0.049,
};

export function convert(zar: number, to: Currency): number {
  return zar * FX[to];
}

export function formatPrice(zar: number | null, currency: Currency): string {
  if (zar === null) return "Custom";
  const value = convert(zar, currency);
  const sym = CURRENCIES.find((c) => c.code === currency)!.symbol;
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 100) / 100;
  return `${sym}${rounded.toLocaleString(undefined, { minimumFractionDigits: value < 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export interface ServicePlan {
  id: string;
  name: string;
  tagline?: string;
  priceZar: number | null; // null = custom / contact
  unit?: string; // e.g. "/month", "/user/month", "/device"
  features: string[];
  highlighted?: boolean;
  badge?: string;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  plans: ServicePlan[];
  note?: string;
}

export interface ServiceCategory {
  id: "cloud" | "business" | "ai";
  name: string;
  tagline: string;
  accent: "cloud" | "business" | "ai";
  services: Service[];
}

const MONTH = "/month";
const USER_MONTH = "/user/month";

export const CATEGORIES: ServiceCategory[] = [
  {
    id: "cloud",
    name: "CloudMonkey Cloud",
    tagline: "Infrastructure without complexity.",
    accent: "cloud",
    services: [
      {
        id: "domains",
        name: "Domains",
        description: "Register, transfer, and manage your domains with DNS, nameserver, and renewal handled for you.",
        plans: [
          { id: "dom-productmonthly", name: "ProductMonthly.co.za", priceZar: 99, unit: "/year", features: ["DNS Management", "Nameserver Management", "Renewal Management"] },
          { id: "dom-r99", name: "DomainR99.com", priceZar: 99, unit: "/year", features: ["DNS Management", "Nameserver Management", "Renewal Management"] },
          { id: "dom-r150", name: "DomainR150", priceZar: 150, unit: "/year", features: ["DNS Management", "Nameserver Management", "Renewal Management"] },
        ],
      },
      {
        id: "websites",
        name: "Websites",
        description: "AI-built or fully managed websites, hosted and secured.",
        plans: [
          { id: "web-ai", name: "AI Website", priceZar: 149, unit: MONTH, features: ["AI Generated Website", "Hosting", "SSL", "Basic SEO", "Backups"] },
          { id: "web-managed", name: "Managed Website", priceZar: 299, unit: MONTH, highlighted: true, features: ["Managed Hosting", "Content Updates", "SSL", "Monitoring", "Backups", "Support"] },
        ],
      },
      {
        id: "ecommerce",
        name: "Ecommerce",
        description: "Sell online with hosted stores, payments, and AI-assisted growth tools.",
        plans: [
          { id: "ecom-starter", name: "Ecommerce Starter", priceZar: 499, unit: MONTH, features: ["Up to 100 Products", "Payment Gateway Integration", "Inventory Management", "Reporting"] },
          { id: "ecom-growth", name: "Ecommerce Growth", priceZar: 999, unit: MONTH, badge: "Most Popular", highlighted: true, features: ["Unlimited Products", "Multi-user Access", "Advanced Analytics", "AI Product Content"] },
          { id: "ecom-pro", name: "Ecommerce Pro", priceZar: 1999, unit: MONTH, features: ["Multi-store Support", "AI Marketing Tools", "Advanced Reporting", "Dedicated Support"] },
        ],
      },
      {
        id: "hosting",
        name: "VPS Hosting",
        description: "High-performance virtual servers, scale on demand.",
        plans: [
          { id: "vps-starter", name: "VPS Starter", priceZar: 299, unit: MONTH, features: ["Entry-level resources", "SSD storage", "Full root access"] },
          { id: "vps-business", name: "VPS Business", priceZar: 599, unit: MONTH, features: ["Balanced compute", "SSD storage", "Snapshots"] },
          { id: "vps-growth", name: "VPS Growth", priceZar: 999, unit: MONTH, highlighted: true, features: ["Performance tier", "More RAM & cores", "Priority network"] },
          { id: "vps-enterprise", name: "VPS Enterprise", priceZar: 1999, unit: MONTH, features: ["Top-tier compute", "Dedicated resources", "Premium support"] },
        ],
      },
      {
        id: "managed-infra",
        name: "Managed Infrastructure",
        description: "Add-on management for any CloudMonkey infrastructure.",
        plans: [
          { id: "mi-managed", name: "CloudMonkey Managed", priceZar: 299, unit: "/month add-on", features: ["Monitoring", "Updates", "Security Patching", "Incident Response"] },
        ],
      },
    ],
  },
  {
    id: "business",
    name: "CloudMonkey Business",
    tagline: "Your complete managed IT department.",
    accent: "business",
    services: [
      {
        id: "m365",
        name: "Microsoft 365 Management",
        note: "Microsoft licensing billed separately.",
        plans: [
          { id: "m365-mgmt", name: "Microsoft 365 Management", priceZar: 25, unit: USER_MONTH, features: ["User Management", "Licensing Management", "Security Policies", "Support"] },
        ],
      },
      {
        id: "gws",
        name: "Google Workspace Management",
        note: "Google licensing billed separately.",
        plans: [
          { id: "gws-mgmt", name: "Google Workspace Management", priceZar: 25, unit: USER_MONTH, features: ["User Management", "Workspace Administration", "Security Policies", "Support"] },
        ],
      },
      {
        id: "pbx",
        name: "Hosted PBX",
        description: "Cloud phone system with mobile, softphone, and AI voice add-ons.",
        plans: [
          { id: "pbx-server", name: "PBX Server", priceZar: 299, unit: MONTH, features: ["PBX Hosting", "IVR", "Ring Groups", "Queues", "Call Recording"] },
          { id: "pbx-ext", name: "Extension License", priceZar: 49, unit: USER_MONTH, features: ["Mobile App", "Softphone", "Voicemail", "Call Recording"] },
        ],
      },
      {
        id: "pbx-ai",
        name: "AI Voice Add-ons",
        description: "Layer AI intelligence onto every call.",
        plans: [
          { id: "voice-analytics", name: "Call Analytics", priceZar: 25, unit: "/extension", features: ["Real-time dashboards", "Call volume insights"] },
          { id: "voice-sentiment", name: "Sentiment Analysis", priceZar: 25, unit: "/extension", features: ["Caller sentiment scoring", "Trend reporting"] },
          { id: "voice-summary", name: "AI Call Summaries", priceZar: 25, unit: "/extension", features: ["Automatic transcripts", "Action items"] },
          { id: "voice-coach", name: "AI Agent Coaching", priceZar: 25, unit: "/extension", features: ["Live coaching prompts", "Quality scoring"] },
        ],
      },
      {
        id: "managed-it",
        name: "Managed IT Services",
        description: "End-to-end IT support, helpdesk, and reporting.",
        plans: [
          { id: "it-starter", name: "Starter", priceZar: 499, unit: MONTH, features: ["Monitoring", "Helpdesk", "User Support", "Monthly Reporting"] },
          { id: "it-business", name: "Business", priceZar: 999, unit: MONTH, highlighted: true, badge: "Most Popular", features: ["Everything in Starter", "Priority Support", "Proactive Maintenance", "Quarterly Reviews"] },
          { id: "it-premium", name: "Premium", priceZar: 2499, unit: MONTH, features: ["Everything in Business", "Dedicated Engineer", "Strategy Sessions", "24/7 Support"] },
        ],
      },
      {
        id: "security",
        name: "Security",
        description: "Endpoint, SOC, and vulnerability protection.",
        plans: [
          { id: "sec-endpoint", name: "Endpoint Monitoring", priceZar: 49, unit: "/device", features: ["EDR agent", "Threat detection", "Reporting"] },
          { id: "sec-soc", name: "SOC Monitoring", priceZar: 999, unit: MONTH, features: ["24/7 SOC", "Incident response", "Threat hunting"] },
          { id: "sec-vuln", name: "Vulnerability Scanning", priceZar: 499, unit: MONTH, features: ["Scheduled scans", "Risk reporting", "Remediation guidance"] },
        ],
      },
    ],
  },
  {
    id: "ai",
    name: "CloudMonkey AI",
    tagline: "AI that works for your business.",
    accent: "ai",
    services: [
      {
        id: "ai-assistant",
        name: "Business AI Assistant",
        description: "Your business's AI brain — connected to your data, calendar, and email.",
        plans: [
          { id: "ai-asst-starter", name: "Starter", priceZar: 999, unit: MONTH, features: ["1 Knowledge Base", "Email Integration", "Calendar Integration"] },
          { id: "ai-asst-growth", name: "Growth", priceZar: 2499, unit: MONTH, highlighted: true, badge: "Most Popular", features: ["Multiple Knowledge Bases", "Team Access", "Document Search", "Workflow Automation"] },
          { id: "ai-asst-business", name: "Business", priceZar: 4999, unit: MONTH, features: ["Advanced AI", "Multi-department Access", "Custom Automations", "Reporting"] },
        ],
      },
      {
        id: "ai-agents",
        name: "AI Agents",
        description: "Specialised AI agents purpose-built for every part of your business.",
        plans: [
          { id: "agent-marketing", name: "Marketing Agent", priceZar: 999, unit: MONTH, features: ["Campaign creation", "Content generation", "Performance insights"] },
          { id: "agent-sales", name: "Sales Agent", priceZar: 999, unit: MONTH, features: ["Lead research", "Personalised outreach", "Deal nudges"] },
          { id: "agent-support", name: "Support Agent", priceZar: 999, unit: MONTH, features: ["24/7 ticket triage", "Customer chat", "Knowledge search"] },
          { id: "agent-hr", name: "HR Agent", priceZar: 999, unit: MONTH, features: ["Recruitment workflows", "Onboarding", "Policy Q&A"] },
          { id: "agent-finance", name: "Finance Agent", priceZar: 999, unit: MONTH, features: ["Expense tracking", "Reporting", "Forecasting"] },
          { id: "agent-operations", name: "Operations Agent", priceZar: 999, unit: MONTH, features: ["Workflow automation", "Task orchestration", "Process insights"] },
        ],
      },
      {
        id: "voice-intel",
        name: "AI Voice Intelligence",
        description: "Turn every conversation into structured insight.",
        plans: [
          { id: "vi-starter", name: "Voice Intelligence Starter", priceZar: 499, unit: MONTH, features: ["Transcription", "Basic analytics"] },
          { id: "vi-business", name: "Voice Intelligence Business", priceZar: 999, unit: MONTH, highlighted: true, features: ["Sentiment analysis", "Summaries", "Search"] },
          { id: "vi-enterprise", name: "Voice Intelligence Enterprise", priceZar: 2499, unit: MONTH, features: ["Custom models", "Coaching", "Compliance reporting"] },
        ],
      },
      {
        id: "openclaw",
        name: "OpenClaw Servers",
        description: "Dedicated AI servers with PostgreSQL, vector DB, and agent workspace.",
        plans: [
          { id: "oc-starter", name: "Starter", priceZar: 1500, unit: MONTH, features: ["PostgreSQL", "Vector Database", "AI Workspace", "Monitoring"] },
          { id: "oc-business", name: "Business", priceZar: 3500, unit: MONTH, features: ["Higher capacity", "Dedicated Agents", "Priority support"] },
          { id: "oc-growth", name: "Growth", priceZar: 7500, unit: MONTH, highlighted: true, features: ["Scaled compute", "Multi-agent orchestration", "Advanced monitoring"] },
          { id: "oc-enterprise", name: "Enterprise", priceZar: null, unit: "", features: ["Custom sizing", "SLAs", "Dedicated success engineer"] },
        ],
      },
    ],
  },
];

export interface Bundle {
  id: string;
  name: string;
  priceZar: number;
  features: string[];
  highlighted?: boolean;
  badge?: string;
}

export const BUNDLES: Bundle[] = [
  { id: "bundle-start", name: "Start", priceZar: 299, features: ["Domain", "Website", "Hosting"] },
  { id: "bundle-business", name: "Business", priceZar: 999, features: ["Domain", "Website", "Hosting", "Microsoft or Google Management", "Support"] },
  { id: "bundle-connect", name: "Connect", priceZar: 1499, features: ["Hosted PBX", "10 Extensions", "Call Recording", "IVR"] },
  { id: "bundle-ai", name: "AI Business", priceZar: 2499, highlighted: true, badge: "Most Popular", features: ["AI Assistant", "Knowledge Base", "Email Integration", "Calendar Integration"] },
  { id: "bundle-complete", name: "Complete", priceZar: 4999, features: ["Cloud", "Business", "AI", "Single invoice", "Single support team", "Single dashboard"] },
];

export function getCategory(id: ServiceCategory["id"]) {
  return CATEGORIES.find((c) => c.id === id)!;
}