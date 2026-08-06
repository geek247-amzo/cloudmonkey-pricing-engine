// Pricing data mirrors the public catalog API shape.
// Amounts are kept in ZAR here and stored as cents in the database seed.

export type Currency = "ZAR" | "USD" | "GBP" | "EUR";
export type BillingType = "recurring" | "once_off" | "quote" | "token_based";
export type BillingFrequency = "once_off" | "year" | "month";
export type CatalogAccent = "cloud" | "business" | "ai";
export type ManagementType = "managed" | "unmanaged" | "quote";

export const CURRENCIES: { code: Currency; symbol: string; label: string }[] = [
  { code: "ZAR", symbol: "R", label: "South African Rand" },
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "EUR", symbol: "€", label: "Euro" },
];

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
  return `${sym}${rounded.toLocaleString("en-ZA", {
    minimumFractionDigits: value < 100 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export interface ServicePlan {
  id: string;
  name: string;
  tagline?: string;
  priceZar: number | null;
  setupPriceZar?: number | null;
  unit?: string;
  billingFrequency?: BillingFrequency;
  minimumTerm?: string;
  minimumTermMonths?: number | null;
  billingType?: BillingType;
  priceLabel?: string;
  isBundle?: boolean;
  sortOrder?: number;
  serviceNote?: string;
  active?: boolean;
  trialDays?: number;
  features: string[];
  highlighted?: boolean;
  badge?: string;
  serviceDefinition?: ServiceDefinition;
  agreementTemplateId?: string;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  plans: ServicePlan[];
  note?: string;
  sortOrder?: number;
  active?: boolean;
}

export interface ServiceCategory {
  id: "managed-cloud" | "build" | "marketing" | "voice" | "addons" | "quote-services";
  name: string;
  tagline: string;
  accent: CatalogAccent;
  note?: string;
  sortOrder?: number;
  active?: boolean;
  services: Service[];
}

export interface Bundle {
  id: string;
  name: string;
  priceZar: number | null;
  setupPriceZar?: number | null;
  unit?: string;
  billingFrequency?: BillingFrequency;
  minimumTerm?: string;
  minimumTermMonths?: number | null;
  billingType?: BillingType;
  priceLabel?: string;
  isBundle?: boolean;
  sortOrder?: number;
  categoryNote?: string;
  serviceNote?: string;
  active?: boolean;
  features: string[];
  highlighted?: boolean;
  badge?: string;
  serviceDefinition?: ServiceDefinition;
  agreementTemplateId?: string;
}

export interface ServiceDefinition {
  managementType: ManagementType;
  setupFeeDescription?: string;
  vatTreatment: string;
  packageRules: PackageRules;
  standardTerms: string[];
  includedScope: string[];
  excludedScope: string[];
  hardLimits: string[];
  support?: string[];
  outOfScopeBilling: string;
}

export interface PackageRules {
  coverage: string[];
  serviceAllocation: string[];
  infrastructureAllocation: string[];
  supportAllocation: string[];
  responseTimes: string[];
  includedChanges: string[];
  usageLimits: string[];
  limitExceeded: string[];
}

export interface AgreementTemplateDefinition {
  id: string;
  name: string;
  documentType: "sla" | "addendum" | "service_order";
  version: string;
  title: string;
  body: string;
}

export interface AgreementSkuMapping {
  id: string;
  templateId: string;
  productType: "plan" | "bundle";
  productId: string;
  required: boolean;
}

export type PublicPricingResponse = {
  categories?: Array<{
    id: ServiceCategory["id"];
    name: string;
    tagline: string;
    accent: CatalogAccent;
    note?: string | null;
    sortOrder?: number | null;
    active?: boolean | null;
    services?: Array<{
      id: string;
      name: string;
      description?: string | null;
      note?: string | null;
      sortOrder?: number | null;
      active?: boolean | null;
      plans?: Array<{
        id: string;
        name: string;
        tagline?: string | null;
        priceZar: string | null;
        setupPriceZar?: string | null;
        unit?: string | null;
        billingFrequency?: BillingFrequency | null;
        minimumTerm?: string | null;
        minimumTermMonths?: number | null;
        billingType?: BillingType | null;
        priceLabel?: string | null;
        isBundle?: boolean | null;
        sortOrder?: number | null;
        serviceNote?: string | null;
        active?: boolean | null;
        trialDays?: number | null;
        highlighted?: boolean | null;
        badge?: string | null;
        serviceDefinition?: string | ServiceDefinition | null;
        agreementTemplateId?: string | null;
        features?: Array<{ content: string }>;
      }>;
    }>;
  }>;
  bundles?: Array<{
    id: string;
    name: string;
    priceZar: string | null;
    setupPriceZar?: string | null;
    unit?: string | null;
    billingFrequency?: BillingFrequency | null;
    minimumTerm?: string | null;
    minimumTermMonths?: number | null;
    billingType?: BillingType | null;
    priceLabel?: string | null;
    isBundle?: boolean | null;
    sortOrder?: number | null;
    categoryNote?: string | null;
    serviceNote?: string | null;
    active?: boolean | null;
    highlighted?: boolean | null;
    badge?: string | null;
    serviceDefinition?: string | ServiceDefinition | null;
    agreementTemplateId?: string | null;
    features?: Array<{ content: string }>;
  }>;
};

export type PublicPricingCatalog = {
  categories: ServiceCategory[];
  bundles: Bundle[];
};

const MONTH = "/month";
const USER_MONTH = "/user/month";
const DEVICE_MONTH = "/device/month";

export const LEGACY_CATEGORY_IDS = ["cloud", "business", "ai"] as const;

export const CATEGORIES: ServiceCategory[] = [
  {
    id: "managed-cloud",
    name: "Managed Cloud",
    tagline: "Infrastructure, hosting, domains, and cloud operations without complexity.",
    accent: "cloud",
    note: "Existing managed cloud pricing is preserved; deprecated legacy catalog rows stay hidden but available for existing subscriptions.",
    sortOrder: 10,
    services: [
      {
        id: "managed-cloud-plans",
        name: "Managed Cloud Plans",
        description:
          "Managed servers, hosting, backups, SSL, monitoring, security, and support handled by CloudMonkey.",
        note: "Setup covers onboarding, server hardening, backup policy, monitoring, DNS review, and launch support.",
        sortOrder: 5,
        plans: [
          {
            id: "managed_cloud_standard",
            name: "Managed Standard",
            priceZar: 1450,
            setupPriceZar: 4250,
            unit: MONTH,
            billingType: "recurring",
            minimumTerm: "Monthly",
            sortOrder: 10,
            features: [
              "Managed hosting or VPS",
              "SSL and DNS support",
              "Automated backups",
              "Uptime monitoring",
              "Standard support",
            ],
          },
          {
            id: "managed_cloud_business",
            name: "Managed Business",
            priceZar: 2600,
            setupPriceZar: 7000,
            unit: MONTH,
            billingType: "recurring",
            minimumTerm: "Monthly",
            highlighted: true,
            badge: "Recommended",
            sortOrder: 20,
            features: [
              "Everything in Standard",
              "Performance tuning",
              "Database support",
              "Security updates",
              "Priority support",
            ],
          },
          {
            id: "managed_cloud_enterprise",
            name: "Managed Enterprise",
            priceZar: 4750,
            setupPriceZar: 12500,
            unit: MONTH,
            billingType: "recurring",
            minimumTerm: "Monthly",
            sortOrder: 30,
            features: [
              "Everything in Business",
              "Advanced monitoring",
              "Restore testing",
              "Scaling support",
              "Architecture reviews",
            ],
          },
        ],
      },
      {
        id: "domains",
        name: "Domains",
        description:
          "Register, transfer, and manage domains with DNS, nameservers, and renewal handled for you.",
        sortOrder: 10,
        plans: [
          {
            id: "domain-za",
            name: ".co.za",
            priceZar: 99,
            unit: "/year",
            billingType: "recurring",
            sortOrder: 10,
            features: ["DNS management", "Nameserver management", "Renewal management"],
          },
          {
            id: "dom-r99",
            name: ".com",
            priceZar: 299,
            unit: "/year",
            billingType: "recurring",
            sortOrder: 20,
            features: ["DNS management", "Nameserver management", "Renewal management"],
          },
          {
            id: "dom-productmonthly",
            name: ".xyz",
            priceZar: 55,
            unit: "/year",
            billingType: "recurring",
            sortOrder: 30,
            features: ["DNS management", "Nameserver management", "Renewal management"],
          },
          {
            id: "dom-r150",
            name: ".store",
            priceZar: 80,
            unit: "/year",
            billingType: "recurring",
            sortOrder: 40,
            features: ["DNS management", "Nameserver management", "Renewal management"],
          },
        ],
      },
      {
        id: "websites",
        name: "Managed Websites",
        description:
          "AI-built or fully managed websites, hosted, secured, and supported by CloudMonkey.",
        sortOrder: 20,
        plans: [
          {
            id: "web-ai",
            name: "AI Website",
            priceZar: 149,
            setupPriceZar: 0,
            unit: MONTH,
            billingType: "token_based",
            minimumTerm: "Monthly",
            trialDays: 7,
            sortOrder: 10,
            features: ["AI generated website", "Managed hosting", "SSL", "Basic SEO", "Backups"],
          },
          {
            id: "web-managed",
            name: "Managed Website",
            priceZar: 299,
            setupPriceZar: 0,
            unit: MONTH,
            billingType: "recurring",
            minimumTerm: "Monthly",
            highlighted: true,
            trialDays: 7,
            sortOrder: 20,
            features: [
              "Managed hosting",
              "Content updates",
              "SSL",
              "Monitoring",
              "Backups",
              "Support",
            ],
          },
        ],
      },
      {
        id: "ecommerce",
        name: "Managed Ecommerce",
        description:
          "Hosted online stores with payments, inventory, reporting, and AI-assisted content.",
        sortOrder: 30,
        plans: [
          {
            id: "ecom-starter",
            name: "Ecommerce Starter",
            priceZar: 499,
            unit: MONTH,
            billingType: "recurring",
            minimumTerm: "Monthly",
            trialDays: 7,
            sortOrder: 10,
            features: [
              "Up to 100 products",
              "Payment gateway integration",
              "Inventory management",
              "Reporting",
            ],
          },
          {
            id: "ecom-growth",
            name: "Ecommerce Growth",
            priceZar: 999,
            unit: MONTH,
            billingType: "token_based",
            minimumTerm: "Monthly",
            badge: "Most Popular",
            highlighted: true,
            trialDays: 7,
            sortOrder: 20,
            features: [
              "Unlimited products",
              "Multi-user access",
              "Advanced analytics",
              "AI product content",
            ],
          },
          {
            id: "ecom-pro",
            name: "Ecommerce Pro",
            priceZar: 1999,
            unit: MONTH,
            billingType: "token_based",
            minimumTerm: "Monthly",
            trialDays: 7,
            sortOrder: 30,
            features: [
              "Multi-store support",
              "AI marketing tools",
              "Advanced reporting",
              "Dedicated support",
            ],
          },
        ],
      },
      {
        id: "hosting",
        name: "CloudMonkey VPS",
        description: "Managed high-performance virtual servers that scale on demand.",
        sortOrder: 40,
        plans: [
          {
            id: "vps-starter",
            name: "CloudMonkey VPS Starter",
            priceZar: 299,
            unit: MONTH,
            billingType: "recurring",
            sortOrder: 10,
            features: [
              "1 vCPU",
              "1 GB RAM",
              "32 GB SSD Storage",
              "1 TB Bandwidth",
              "Managed support",
            ],
          },
          {
            id: "vps-business",
            name: "CloudMonkey VPS Business",
            priceZar: 599,
            unit: MONTH,
            billingType: "recurring",
            sortOrder: 20,
            features: [
              "1 vCPU",
              "2 GB RAM",
              "55 GB SSD Storage",
              "2 TB Bandwidth",
              "Snapshots included",
              "Managed support",
            ],
          },
          {
            id: "vps-growth",
            name: "CloudMonkey VPS Growth",
            priceZar: 999,
            unit: MONTH,
            billingType: "recurring",
            highlighted: true,
            sortOrder: 30,
            features: [
              "2 vCPUs",
              "4 GB RAM",
              "80 GB SSD Storage",
              "3 TB Bandwidth",
              "Priority network",
              "Managed support",
            ],
          },
          {
            id: "vps-enterprise",
            name: "CloudMonkey VPS Enterprise",
            priceZar: 1999,
            unit: MONTH,
            billingType: "recurring",
            sortOrder: 40,
            features: [
              "4 vCPUs",
              "8 GB RAM",
              "160 GB SSD Storage",
              "4 TB Bandwidth",
              "Dedicated resources",
              "Premium support",
            ],
          },
        ],
      },
      {
        id: "managed-infra",
        name: "Managed Server",
        description:
          "Post-build monitoring, maintenance, security, and basic administration for one server.",
        sortOrder: 50,
        plans: [
          {
            id: "mi-managed",
            name: "Managed Server",
            priceZar: 999,
            unit: MONTH,
            billingType: "recurring",
            sortOrder: 10,
            features: [
              "5-minute uptime monitoring",
              "Monthly patching and health report",
              "Backup, SSL, domain, server, database, and application checks",
              "Up to 1 hour human administration per month",
              "Up to 2 support incidents per month",
            ],
          },
        ],
      },
      {
        id: "backups",
        name: "Backup Services",
        description: "Off-server backup retention and recovery options for hosted workloads.",
        sortOrder: 60,
        plans: [
          {
            id: "backup-basic",
            name: "Basic Backup",
            priceZar: 0,
            unit: "/included where eligible",
            billingType: "recurring",
            sortOrder: 10,
            features: [
              "Daily backups",
              "7-day retention",
              "Up to 10 GB",
              "1 restore request per quarter",
            ],
          },
          {
            id: "backup-business",
            name: "Business Backup",
            priceZar: 499,
            unit: MONTH,
            billingType: "recurring",
            sortOrder: 20,
            features: [
              "Daily backups with 30-day retention",
              "4 weekly and 3 monthly copies",
              "Up to 50 GB",
              "1 restore request per month",
              "Quarterly restore test",
            ],
          },
          {
            id: "backup-critical",
            name: "Critical Backup",
            priceZar: null,
            billingType: "quote",
            priceLabel: "Request Quote",
            sortOrder: 30,
            features: [
              "Custom backup frequency and retention",
              "Encrypted off-site copies",
              "Defined recovery objectives",
              "Restore testing and disaster-recovery runbook",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "build",
    name: "Build",
    tagline: "Websites, ecommerce, apps, and automations built and managed as a service.",
    accent: "ai",
    note: "Build plans combine delivery and hosting; setup fees cover project scoping and launch work.",
    sortOrder: 20,
    services: [
      {
        id: "build-websites",
        name: "Website Build",
        description:
          "Launch-ready website builds with hosting, SSL, analytics, and post-launch support.",
        sortOrder: 10,
        plans: [
          {
            id: "build_site_starter",
            name: "Build Starter",
            priceZar: 999,
            setupPriceZar: 2499,
            unit: MONTH,
            billingType: "recurring",
            minimumTerm: "3 months",
            sortOrder: 10,
            features: [
              "Up to 5 pages",
              "3 development hours per month",
              "2 revision rounds",
              "2 small content requests per month",
              "Managed hosting, daily backups, and basic uptime monitoring",
            ],
          },
          {
            id: "build_site_growth",
            name: "Build Growth",
            priceZar: 2499,
            setupPriceZar: 5999,
            unit: MONTH,
            billingType: "recurring",
            minimumTerm: "6 months",
            highlighted: true,
            badge: "Recommended",
            sortOrder: 20,
            features: [
              "Up to 15 pages",
              "8 development hours and 5 change requests per month",
              "Up to 3 basic integrations and automation workflows",
              "CMS, analytics, and one basic dashboard",
              "Daily backups, SSL monitoring, and application checks",
            ],
          },
          {
            id: "build_site_scale",
            name: "Build Scale",
            priceZar: 4999,
            setupPriceZar: 9999,
            unit: MONTH,
            billingType: "recurring",
            minimumTerm: "6 months",
            sortOrder: 30,
            features: [
              "One primary platform and one microsite",
              "18 development hours and 2 active workstreams per month",
              "Up to 5 integrations, 10 API endpoints, and 10 workflows",
              "Dedicated staging and full application monitoring",
              "Monthly roadmap review and priority support",
            ],
          },
        ],
      },
      {
        id: "build-commerce-apps",
        name: "Commerce and App Builds",
        description: "Custom ecommerce, workflow portals, and lightweight internal apps.",
        sortOrder: 20,
        plans: [
          {
            id: "build_ecommerce_launch",
            name: "Ecommerce Launch",
            priceZar: 3999,
            setupPriceZar: 9999,
            unit: MONTH,
            billingType: "recurring",
            minimumTerm: "6 months",
            sortOrder: 10,
            features: [
              "One storefront with up to 100 products and 300 variants",
              "One payment gateway and up to 3 shipping methods",
              "12 development hours and 6 changes per month",
              "Up to 1,000 monthly orders",
              "Daily backups, monitoring, hosting, and operations support",
            ],
          },
          {
            id: "build_custom_app",
            name: "Custom App Build",
            priceZar: null,
            billingType: "quote",
            priceLabel: "Request Quote",
            sortOrder: 20,
            features: [
              "Signed scope and acceptance criteria required",
              "Applications, users, roles, modules, screens, and workflows defined per order",
              "Infrastructure, environments, integrations, APIs, and migration limits defined per order",
              "Support, delivery, backup, security, availability, acceptance, and warranty terms defined per order",
              "AI remains prepaid and usage based",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "marketing",
    name: "Marketing",
    tagline: "Managed SEO, content, campaigns, intelligence, and growth operations.",
    accent: "business",
    sortOrder: 30,
    services: [
      {
        id: "competitor-intelligence",
        name: "Competitor Intelligence",
        description:
          "Managed SEO, website, and competitor intelligence that shows what competitors do better and what to fix next.",
        sortOrder: 10,
        plans: [
          {
            id: "ci-starter",
            name: "Starter",
            priceZar: 499,
            unit: MONTH,
            billingType: "token_based",
            sortOrder: 10,
            features: [
              "1 website",
              "3 competitors",
              "Monthly AI report",
              "SEO audit",
              "Keyword gap starter",
            ],
          },
          {
            id: "ci-growth",
            name: "Growth",
            priceZar: 999,
            unit: MONTH,
            billingType: "token_based",
            highlighted: true,
            badge: "Recommended",
            sortOrder: 20,
            features: [
              "1 website",
              "5 competitors",
              "Weekly tracking",
              "Content gaps",
              "AI recommendations",
              "PDF reports",
            ],
          },
          {
            id: "ci-managed",
            name: "Managed SEO",
            priceZar: 2500,
            unit: MONTH,
            billingType: "token_based",
            sortOrder: 30,
            features: [
              "CloudMonkey executes fixes",
              "Managed content plan",
              "Local SEO actions",
              "Monthly strategy review",
              "Priority support",
            ],
          },
        ],
      },
      {
        id: "marketing-growth",
        name: "Growth Marketing",
        description:
          "Content, local SEO, campaigns, and marketing automation managed month to month.",
        sortOrder: 20,
        plans: [
          {
            id: "marketing_content_engine",
            name: "Content Engine",
            priceZar: 3499,
            setupPriceZar: 2499,
            unit: MONTH,
            billingType: "token_based",
            minimumTerm: "3 months",
            sortOrder: 10,
            features: ["Content calendar", "4 managed posts", "On-page SEO", "Monthly reporting"],
          },
          {
            id: "marketing_growth_ops",
            name: "Growth Ops",
            priceZar: 7499,
            setupPriceZar: 4999,
            unit: MONTH,
            billingType: "token_based",
            minimumTerm: "3 months",
            highlighted: true,
            sortOrder: 20,
            features: [
              "Campaign management",
              "Landing page iteration",
              "Automation workflows",
              "Weekly reporting",
            ],
          },
          {
            id: "marketing_paid_media",
            name: "Paid Media Management",
            priceZar: null,
            billingType: "quote",
            priceLabel: "Request Quote",
            sortOrder: 30,
            features: [
              "Campaign strategy",
              "Budget planning",
              "Conversion tracking",
              "Performance reviews",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "voice",
    name: "Voice",
    tagline:
      "Managed VoIP, hosted PBX, SIP trunks, routing, recording, apps, reporting, and call workflow automation.",
    accent: "business",
    note: "Carrier usage, call charges, and regulatory costs may be billed separately.",
    sortOrder: 40,
    services: [
      {
        id: "pbx",
        name: "Hosted PBX",
        description:
          "Cloud phone system with mobile, softphone, routing, queues, recording, and reporting.",
        sortOrder: 10,
        plans: [
          {
            id: "pbx-server",
            name: "PBX Server",
            priceZar: 299,
            setupPriceZar: 999,
            unit: MONTH,
            billingType: "recurring",
            minimumTerm: "Monthly",
            sortOrder: 10,
            features: ["PBX hosting", "IVR", "Ring groups", "Queues", "Call recording"],
          },
          {
            id: "pbx-ext",
            name: "Extension License",
            priceZar: 49,
            setupPriceZar: 0,
            unit: USER_MONTH,
            billingType: "recurring",
            minimumTerm: "Monthly",
            highlighted: true,
            sortOrder: 20,
            features: ["Mobile app", "Softphone", "Voicemail", "Call recording"],
          },
        ],
      },
      {
        id: "sip-trunks",
        name: "SIP Trunks",
        description: "Managed SIP trunks with number allocation, routing, monitoring, and support.",
        sortOrder: 20,
        plans: [
          {
            id: "voice_sip_trunk",
            name: "SIP Trunk",
            priceZar: 99,
            setupPriceZar: 499,
            unit: MONTH,
            billingType: "recurring",
            minimumTerm: "Monthly",
            sortOrder: 10,
            features: [
              "Managed SIP trunk",
              "Inbound routing",
              "Failover support",
              "Usage reporting",
            ],
          },
          {
            id: "voice_sip_trunk_4ch",
            name: "Unlimited VoIP SIP Trunk 4 Channel",
            priceZar: 1000,
            setupPriceZar: 0,
            unit: MONTH,
            billingType: "recurring",
            minimumTerm: "Monthly",
            sortOrder: 12,
            features: [
              "4 concurrent outbound calls",
              "8 inbound calls",
              "Unlimited outbound calls (fair use)",
              "Managed SIP trunk",
              "Failover support",
            ],
          },
          {
            id: "voice_sip_trunk_8ch",
            name: "Unlimited VoIP SIP Trunk 8 Channels",
            priceZar: 2500,
            setupPriceZar: 0,
            unit: MONTH,
            billingType: "recurring",
            minimumTerm: "Monthly",
            sortOrder: 14,
            features: [
              "8 concurrent outbound calls",
              "16 inbound calls",
              "Unlimited outbound calls (fair use)",
              "Managed SIP trunk",
              "Failover support",
            ],
          },
          {
            id: "voice_sip_trunk_16ch",
            name: "Unlimited VoIP SIP Trunk 16 Channels",
            priceZar: 5000,
            setupPriceZar: 0,
            unit: MONTH,
            billingType: "recurring",
            minimumTerm: "Monthly",
            sortOrder: 16,
            features: [
              "16 concurrent outbound calls",
              "32 inbound calls",
              "Unlimited outbound calls (fair use)",
              "Managed SIP trunk",
              "Failover support",
            ],
          },
          {
            id: "voice_number_porting",
            name: "Number Porting",
            priceZar: 450,
            unit: "/number",
            billingType: "once_off",
            priceLabel: "Once-off",
            sortOrder: 20,
            features: ["Porting coordination", "Carrier follow-up", "Cutover support"],
          },
        ],
      },
      {
        id: "voice-intel",
        name: "Voice Intelligence",
        description:
          "Turn every conversation into searchable insight, summaries, and coaching actions.",
        sortOrder: 30,
        plans: [
          {
            id: "vi-starter",
            name: "Voice Intelligence Starter",
            priceZar: 499,
            unit: MONTH,
            billingType: "token_based",
            sortOrder: 10,
            features: ["Transcription", "Basic analytics"],
          },
          {
            id: "vi-business",
            name: "Voice Intelligence Business",
            priceZar: 999,
            unit: MONTH,
            billingType: "token_based",
            highlighted: true,
            sortOrder: 20,
            features: ["Sentiment analysis", "Summaries", "Search"],
          },
          {
            id: "vi-enterprise",
            name: "Voice Intelligence Enterprise",
            priceZar: 2499,
            unit: MONTH,
            billingType: "token_based",
            sortOrder: 30,
            features: ["Custom models", "Coaching", "Compliance reporting"],
          },
        ],
      },
      {
        id: "voice-quote",
        name: "Quote-based Voice",
        description:
          "Complex telephony, contact centre, compliance, and multi-site voice projects.",
        sortOrder: 40,
        plans: [
          {
            id: "voice_contact_centre",
            name: "Contact Centre",
            priceZar: null,
            billingType: "quote",
            priceLabel: "Request Quote",
            sortOrder: 10,
            features: [
              "Queues and routing",
              "Recording policy",
              "Agent reporting",
              "CRM integration",
            ],
          },
          {
            id: "voice_multi_site",
            name: "Multi-site Voice Rollout",
            priceZar: null,
            billingType: "quote",
            priceLabel: "Request Quote",
            sortOrder: 20,
            features: [
              "Branch planning",
              "Carrier coordination",
              "Cutover plan",
              "Managed support",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "addons",
    name: "Add-ons",
    tagline: "Optional services that extend managed cloud, build, marketing, and voice plans.",
    accent: "cloud",
    sortOrder: 50,
    services: [
      {
        id: "productivity",
        name: "Productivity Management",
        note: "Microsoft and Google licensing billed separately.",
        sortOrder: 10,
        plans: [
          {
            id: "m365-mgmt",
            name: "Microsoft 365 Management",
            priceZar: 25,
            unit: USER_MONTH,
            billingType: "recurring",
            sortOrder: 10,
            features: ["User management", "Licensing management", "Security policies", "Support"],
          },
          {
            id: "gws-mgmt",
            name: "Google Workspace Management",
            priceZar: 25,
            unit: USER_MONTH,
            billingType: "recurring",
            sortOrder: 20,
            features: [
              "User management",
              "Workspace administration",
              "Security policies",
              "Support",
            ],
          },
        ],
      },
      {
        id: "security",
        name: "Security",
        description: "Endpoint, SOC, and vulnerability protection.",
        sortOrder: 20,
        plans: [
          {
            id: "sec-endpoint",
            name: "Endpoint Monitoring",
            priceZar: 49,
            unit: DEVICE_MONTH,
            billingType: "recurring",
            sortOrder: 10,
            features: ["EDR agent", "Threat detection", "Reporting"],
          },
          {
            id: "sec-soc",
            name: "SOC Monitoring",
            priceZar: 999,
            unit: MONTH,
            billingType: "recurring",
            sortOrder: 20,
            features: ["24/7 SOC", "Incident response", "Threat hunting"],
          },
          {
            id: "sec-vuln",
            name: "Vulnerability Scanning",
            priceZar: 499,
            unit: MONTH,
            billingType: "recurring",
            sortOrder: 30,
            features: ["Scheduled scans", "Risk reporting", "Remediation guidance"],
          },
        ],
      },
      {
        id: "ai-agents",
        name: "AI Agents",
        description: "Specialised AI agents purpose-built for every part of your business.",
        sortOrder: 30,
        plans: [
          {
            id: "agent-marketing",
            name: "Marketing Agent",
            priceZar: 999,
            unit: MONTH,
            billingType: "token_based",
            sortOrder: 10,
            features: [
              "Campaign creation",
              "Content generation",
              "Performance insights",
              "1M AI tokens / month",
              "Managed setup and tuning",
            ],
          },
          {
            id: "agent-sales",
            name: "Sales Agent",
            priceZar: 999,
            unit: MONTH,
            billingType: "token_based",
            sortOrder: 20,
            features: [
              "Lead research",
              "Personalised outreach",
              "Deal nudges",
              "1M AI tokens / month",
              "Managed setup and tuning",
            ],
          },
          {
            id: "agent-support",
            name: "Support Agent",
            priceZar: 999,
            unit: MONTH,
            billingType: "token_based",
            sortOrder: 30,
            features: [
              "24/7 ticket triage",
              "Customer chat",
              "Knowledge search",
              "1M AI tokens / month",
              "Managed setup and tuning",
            ],
          },
          {
            id: "agent-hr",
            name: "HR Agent",
            priceZar: 999,
            unit: MONTH,
            billingType: "token_based",
            sortOrder: 40,
            features: [
              "Recruitment workflows",
              "Onboarding",
              "Policy Q&A",
              "1M AI tokens / month",
              "Managed setup and tuning",
            ],
          },
          {
            id: "agent-finance",
            name: "Finance Agent",
            priceZar: 999,
            unit: MONTH,
            billingType: "token_based",
            sortOrder: 50,
            features: [
              "Expense tracking",
              "Reporting",
              "Forecasting",
              "1M AI tokens / month",
              "Managed setup and tuning",
            ],
          },
          {
            id: "agent-operations",
            name: "Operations Agent",
            priceZar: 999,
            unit: MONTH,
            billingType: "token_based",
            sortOrder: 60,
            features: [
              "Workflow automation",
              "Task orchestration",
              "Process insights",
              "1M AI tokens / month",
              "Managed setup and tuning",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "quote-services",
    name: "Quote-based Services",
    tagline: "Custom projects and enterprise services scoped by CloudMonkey before checkout.",
    accent: "ai",
    note: "Quote-only services never expose checkout pricing. Use Request Quote to start scoping.",
    sortOrder: 60,
    services: [
      {
        id: "technical-strategic-services",
        name: "Hourly Technical & Strategic Services",
        description:
          "Technical delivery, strategic advisory, fractional CTO support, training, and project facilitation delivered on-site or remotely.",
        note: "Rate card effective 3 August 2026. Hourly work is requested and approved through a quotation, booking, or service confirmation.",
        sortOrder: 5,
        plans: [
          {
            id: "hourly_on_site",
            name: "On-site Hour",
            tagline: "Standard rate for work delivered at the client site.",
            priceZar: 1000,
            unit: "/hour",
            billingType: "quote",
            priceLabel: "R1,000 / hour",
            sortOrder: 10,
            features: [
              "Development, configuration, integrations, deployment, and troubleshooting",
              "Technology strategy, process design, product direction, and executive decision support",
              "Fractional CTO guidance, training, workshops, and project facilitation",
              "Three-hour minimum booking",
            ],
          },
          {
            id: "hourly_remote",
            name: "Remote Hour",
            tagline: "Remote delivery billed in 30-minute increments.",
            priceZar: 600,
            unit: "/hour",
            billingType: "quote",
            priceLabel: "R600 / hour",
            sortOrder: 20,
            features: [
              "Remote development, configuration, reviews, planning, and decision support",
              "Remote workshops, documentation, training, and project facilitation",
              "Recorded in 30-minute increments",
              "Approved client request required before work starts",
            ],
          },
        ],
      },
      {
        id: "strategic-advisory",
        name: "Strategic Advisory",
        description:
          "Structured access to technology strategy, product leadership, process design, and fractional CTO capacity.",
        note: "Effective 3 August 2026. Monthly allocations are paid in advance and do not include hosting, AI tokens, hardware, licences, or third-party services.",
        sortOrder: 10,
        plans: [
          {
            id: "advisory_5",
            name: "Advisory 5",
            tagline: "Light monthly guidance and decision support.",
            priceZar: 3000,
            unit: MONTH,
            billingType: "recurring",
            sortOrder: 10,
            features: [
              "5 remote hours per month",
              "Technology and AI strategy",
              "Decision support and documentation",
            ],
          },
          {
            id: "advisory_10",
            name: "Advisory 10",
            tagline: "Weekly product, process, or technology sessions.",
            priceZar: 6000,
            unit: MONTH,
            billingType: "recurring",
            sortOrder: 20,
            features: [
              "10 remote hours per month",
              "Product definition and prioritisation",
              "Roadmaps, reviews, and stakeholder facilitation",
            ],
          },
          {
            id: "advisory_20",
            name: "Advisory 20",
            tagline: "Active fractional CTO and product leadership support.",
            priceZar: 12000,
            unit: MONTH,
            billingType: "recurring",
            highlighted: true,
            badge: "Fractional CTO",
            sortOrder: 30,
            features: [
              "20 remote hours per month",
              "Fractional CTO guidance and technical governance",
              "Architecture, commercialisation, and implementation leadership",
            ],
          },
          {
            id: "advisory_onsite_10",
            name: "On-Site 10",
            tagline: "Operational workshops, implementation, and team enablement.",
            priceZar: 10000,
            unit: MONTH,
            billingType: "recurring",
            sortOrder: 40,
            features: [
              "10 on-site hours per month",
              "Operational observation and stakeholder workshops",
              "Implementation leadership and in-person training",
            ],
          },
          {
            id: "advisory_hybrid_10",
            name: "Hybrid 10",
            tagline: "A balance of strategic planning and in-person execution.",
            priceZar: 8000,
            unit: MONTH,
            billingType: "recurring",
            sortOrder: 50,
            features: [
              "5 remote + 5 on-site hours per month",
              "Strategic planning and operational execution",
              "Visible usage, outcomes, blockers, and remaining capacity",
            ],
          },
          {
            id: "advisory_payg",
            name: "Pay-as-you-go",
            tagline: "Approved time without a monthly allocation.",
            priceZar: null,
            billingType: "quote",
            priceLabel: "R600 remote / R1,000 on-site",
            sortOrder: 60,
            features: [
              "Remote sessions billed at R600/hour",
              "On-site sessions billed at R1,000/hour",
              "On-site bookings carry a three-hour minimum",
              "Book only the approved capacity required",
            ],
          },
        ],
      },
      {
        id: "managed-it",
        name: "Managed IT Services",
        description: "End-to-end IT support, helpdesk, strategy, and reporting.",
        sortOrder: 10,
        plans: [
          {
            id: "it-starter",
            name: "Starter",
            priceZar: 499,
            unit: MONTH,
            billingType: "recurring",
            sortOrder: 10,
            features: ["Monitoring", "Helpdesk", "User support", "Monthly reporting"],
          },
          {
            id: "it-business",
            name: "Business",
            priceZar: 999,
            unit: MONTH,
            billingType: "recurring",
            highlighted: true,
            badge: "Most Popular",
            sortOrder: 20,
            features: [
              "Everything in Starter",
              "Priority support",
              "Proactive maintenance",
              "Quarterly reviews",
            ],
          },
          {
            id: "it-premium",
            name: "Premium",
            priceZar: 2499,
            unit: MONTH,
            billingType: "recurring",
            sortOrder: 30,
            features: [
              "Everything in Business",
              "Dedicated engineer",
              "Strategy sessions",
              "24/7 support",
            ],
          },
          {
            id: "it_enterprise_custom",
            name: "Enterprise Managed IT",
            priceZar: null,
            billingType: "quote",
            priceLabel: "Request Quote",
            sortOrder: 40,
            features: [
              "Custom SLA",
              "Dedicated team",
              "Security governance",
              "Executive reporting",
            ],
          },
        ],
      },
      {
        id: "ai-assistant",
        name: "Business AI Assistant",
        description: "Your business AI brain connected to data, calendar, email, and workflows.",
        sortOrder: 20,
        plans: [
          {
            id: "ai-asst-starter",
            name: "Starter",
            priceZar: 999,
            unit: MONTH,
            billingType: "token_based",
            sortOrder: 10,
            features: ["1 knowledge base", "Email integration", "Calendar integration"],
          },
          {
            id: "ai-asst-growth",
            name: "Growth",
            priceZar: 2499,
            unit: MONTH,
            billingType: "token_based",
            highlighted: true,
            badge: "Most Popular",
            sortOrder: 20,
            features: [
              "Multiple knowledge bases",
              "Team access",
              "Document search",
              "Workflow automation",
            ],
          },
          {
            id: "ai-asst-business",
            name: "Business",
            priceZar: 4999,
            unit: MONTH,
            billingType: "token_based",
            sortOrder: 30,
            features: ["Advanced AI", "Multi-department access", "Custom automations", "Reporting"],
          },
          {
            id: "ai_custom_automation",
            name: "Custom AI Automation",
            priceZar: null,
            billingType: "quote",
            priceLabel: "Request Quote",
            sortOrder: 40,
            features: [
              "Custom workflows",
              "Data integrations",
              "Agent orchestration",
              "Managed rollout",
            ],
          },
        ],
      },
      {
        id: "openclaw",
        name: "OpenClaw Servers",
        description: "Dedicated AI servers with PostgreSQL, vector database, and agent workspace.",
        sortOrder: 30,
        plans: [
          {
            id: "oc-starter",
            name: "Starter",
            priceZar: 1500,
            unit: MONTH,
            billingType: "recurring",
            sortOrder: 10,
            features: ["PostgreSQL", "Vector database", "AI workspace", "Monitoring"],
          },
          {
            id: "oc-business",
            name: "Business",
            priceZar: 3500,
            unit: MONTH,
            billingType: "recurring",
            sortOrder: 20,
            features: ["Higher capacity", "Dedicated agents", "Priority support"],
          },
          {
            id: "oc-growth",
            name: "Growth",
            priceZar: 7500,
            unit: MONTH,
            billingType: "recurring",
            highlighted: true,
            sortOrder: 30,
            features: ["Scaled compute", "Multi-agent orchestration", "Advanced monitoring"],
          },
          {
            id: "oc-enterprise",
            name: "Enterprise",
            priceZar: null,
            billingType: "quote",
            priceLabel: "Request Quote",
            sortOrder: 40,
            features: ["Custom sizing", "SLAs", "Dedicated success engineer"],
          },
        ],
      },
    ],
  },
];

export const BUNDLES: Bundle[] = [
  {
    id: "bundle_build_launch",
    name: "Build Launch",
    priceZar: 3999,
    setupPriceZar: 7999,
    unit: MONTH,
    billingType: "recurring",
    isBundle: true,
    minimumTerm: "6 months",
    sortOrder: 10,
    categoryNote: "Build Bundles",
    serviceNote:
      "Website build, hosting, launch support, and monthly improvements in one managed plan.",
    features: [
      "Build Growth website",
      "Managed hosting",
      "Analytics",
      "Monthly improvements",
      "Launch support",
    ],
  },
  {
    id: "bundle_website_launch_essentials",
    name: "Website Launch Essentials",
    priceZar: 1299,
    setupPriceZar: 3499,
    unit: MONTH,
    billingType: "recurring",
    isBundle: true,
    minimumTerm: "3 months",
    sortOrder: 15,
    categoryNote: "Build Bundles",
    serviceNote:
      "Small brochure websites with managed hosting, launch support, and domain setup guidance for new businesses.",
    features: [
      "Build Starter website",
      "Managed hosting",
      "Launch support",
      "Domain configuration",
      "Basic enquiry forms",
    ],
  },
  {
    id: "bundle_website_growth_seo",
    name: "Website Growth + SEO",
    priceZar: 5999,
    setupPriceZar: 8499,
    unit: MONTH,
    billingType: "recurring",
    isBundle: true,
    minimumTerm: "6 months",
    sortOrder: 18,
    categoryNote: "Growth Bundles",
    highlighted: true,
    badge: "Growth",
    serviceNote:
      "Website build, managed content, and SEO work for businesses that want a stronger lead-generation engine.",
    features: [
      "Build Growth website",
      "Content Engine",
      "Competitor Intelligence Growth",
      "Monthly reporting",
      "SEO actions",
    ],
  },
  {
    id: "bundle_managed_cloud_care",
    name: "Managed Cloud Care",
    priceZar: 1699,
    setupPriceZar: 2499,
    unit: MONTH,
    billingType: "recurring",
    isBundle: true,
    minimumTerm: "3 months",
    sortOrder: 40,
    categoryNote: "Cloud Bundles",
    serviceNote:
      "Managed VPS hosting, server monitoring, patching, and backup coverage for a single production server.",
    features: [
      "VPS Starter",
      "Managed Server",
      "Business Backup",
      "Monitoring and patching",
      "Basic recovery support",
    ],
  },
  {
    id: "bundle_ai_business_assistant",
    name: "AI Business Assistant",
    priceZar: 3499,
    setupPriceZar: 4999,
    unit: MONTH,
    billingType: "recurring",
    isBundle: true,
    minimumTerm: "3 months",
    sortOrder: 45,
    categoryNote: "AI Bundles",
    serviceNote:
      "Business AI assistant and sales automation for teams that want guided qualification and follow-up.",
    features: [
      "AI Assistant Growth",
      "Sales Agent",
      "Knowledge search",
      "Email and calendar integration",
      "1M AI tokens per month",
    ],
  },
  {
    id: "bundle_voice_team",
    name: "Voice Team",
    priceZar: 1499,
    setupPriceZar: 2499,
    unit: MONTH,
    billingType: "recurring",
    isBundle: true,
    minimumTerm: "3 months",
    sortOrder: 20,
    categoryNote: "Voice Bundles",
    serviceNote: "Hosted PBX, SIP trunk, routing, recording, and reporting for small teams.",
    features: ["Hosted PBX", "10 extensions", "SIP trunk", "Call recording", "IVR"],
  },
  {
    id: "bundle_managed_voice",
    name: "Managed + Voice",
    priceZar: 2999,
    setupPriceZar: 3499,
    unit: MONTH,
    billingType: "recurring",
    isBundle: true,
    minimumTerm: "3 months",
    sortOrder: 30,
    categoryNote: "Managed + Voice Bundles",
    highlighted: true,
    badge: "Popular",
    serviceNote:
      "Managed cloud, productivity support, and voice operations on one monthly invoice.",
    features: [
      "Managed cloud support",
      "PBX server",
      "10 extensions",
      "Microsoft or Google management",
      "Single support team",
    ],
  },
  {
    id: "bundle_full_service_growth",
    name: "Full-Service Growth",
    priceZar: 27598,
    setupPriceZar: 14999,
    unit: MONTH,
    billingType: "recurring",
    isBundle: true,
    minimumTerm: "6 months",
    sortOrder: 40,
    categoryNote: "Full-Service Packages",
    highlighted: true,
    badge: "Full Service",
    serviceNote:
      "Managed cloud, build, marketing, voice, AI, and support for growth-focused teams.",
    features: [
      "Managed cloud",
      "Build Scale",
      "Growth Ops",
      "Hosted PBX and voice intelligence",
      "Business AI Assistant",
      "Priority support",
    ],
  },
  {
    id: "bundle_advisory_5_remote",
    name: "Advisory 5 · Remote",
    priceZar: 3000,
    setupPriceZar: 0,
    unit: MONTH,
    billingType: "recurring",
    isBundle: true,
    minimumTerm: "1 month",
    sortOrder: 60,
    categoryNote: "Advisory Bundles",
    serviceNote: "Five remote strategic, product, technology or training hours per month, paid in advance.",
    features: ["5 remote hours", "30-minute billing increments", "Priority list and session agenda", "Usage and outcome reporting"],
  },
  {
    id: "bundle_advisory_10_remote",
    name: "Advisory 10 · Remote",
    priceZar: 6000,
    setupPriceZar: 0,
    unit: MONTH,
    billingType: "recurring",
    isBundle: true,
    minimumTerm: "1 month",
    sortOrder: 61,
    categoryNote: "Advisory Bundles",
    serviceNote: "Ten remote strategic, product, technology or training hours per month, paid in advance.",
    features: ["10 remote hours", "30-minute billing increments", "Weekly product or process sessions", "Usage and outcome reporting"],
  },
  {
    id: "bundle_advisory_20_remote",
    name: "Advisory 20 · Remote",
    priceZar: 12000,
    setupPriceZar: 0,
    unit: MONTH,
    billingType: "recurring",
    isBundle: true,
    minimumTerm: "1 month",
    sortOrder: 62,
    categoryNote: "Advisory Bundles",
    serviceNote: "Twenty remote hours per month for active fractional CTO and product leadership support.",
    features: ["20 remote hours", "Architecture and prioritisation", "Fractional CTO guidance", "Usage and outcome reporting"],
  },
  {
    id: "bundle_advisory_10_onsite",
    name: "On-Site 10",
    priceZar: 10000,
    setupPriceZar: 0,
    unit: MONTH,
    billingType: "recurring",
    isBundle: true,
    minimumTerm: "1 month",
    sortOrder: 63,
    categoryNote: "Advisory Bundles",
    serviceNote: "Ten on-site hours per month for operational workshops, implementation and team enablement.",
    features: ["10 on-site hours", "Three-hour minimum per visit", "Operational workshops", "Implementation and team enablement"],
  },
  {
    id: "bundle_advisory_10_hybrid",
    name: "Hybrid 10",
    priceZar: 8000,
    setupPriceZar: 0,
    unit: MONTH,
    billingType: "recurring",
    isBundle: true,
    minimumTerm: "1 month",
    sortOrder: 64,
    categoryNote: "Advisory Bundles",
    serviceNote: "A balanced monthly allocation of five remote and five on-site hours.",
    features: ["5 remote hours", "5 on-site hours", "Three-hour minimum per on-site visit", "Usage and outcome reporting"],
  },
];

const DEFAULT_VAT_TREATMENT =
  "Prices are shown in ZAR excluding VAT unless a quote, invoice, or checkout explicitly states otherwise.";
const DEFAULT_OUT_OF_SCOPE =
  "Requests outside the included scope, hard limits, or selected plan envelope require written approval for a custom quote, change order, or hourly out-of-scope billing before work starts.";

export const STANDARD_PACKAGE_TERMS = [
  "Unused development time, support time, incidents, revisions, infrastructure capacity, and usage allowances do not roll over unless expressly stated.",
  "A package limit is a maximum allowance, not a guaranteed amount of work where delivery is blocked by missing content, approvals, access, dependencies, or client delays.",
];

export const MANAGED_SERVER_RESPONSE_TARGETS = {
  S1: "1 business hour",
  S2: "4 business hours",
  S3: "1 business day",
  S4: "2 business days",
} as const;

export const BUILD_PACKAGE_RESPONSE_TARGETS = {
  build_site_starter: "1 business day",
  build_site_growth: "8 business hours",
  build_site_scale: "4 business hours",
  build_ecommerce_launch: "4 business hours",
  build_custom_app: "Defined in the signed service order",
} as const;

const STANDARD_LIMIT_EXCEEDED = [
  "CloudMonkey may pause the affected work or usage until the client approves an upgrade, Build activation, change request, hourly overage, or separate quotation.",
];

function defaultPackageRules(
  category: ServiceCategory,
  service: Service,
  plan: ServicePlan,
): PackageRules {
  return {
    coverage: ["Coverage is limited to the quantities listed in this SKU or signed service order."],
    serviceAllocation: ["Only the listed recurring service and delivery activities are included."],
    infrastructureAllocation: [
      category.id === "managed-cloud"
        ? "Infrastructure is limited to the listed compute, storage, transfer, backup, or management envelope."
        : "Infrastructure is included only where expressly listed; otherwise it is billed separately.",
    ],
    supportAllocation: [
      "Support is limited to the listed channels, incidents, and time allowance.",
    ],
    responseTimes: ["Response targets follow the accepted SLA or signed service order."],
    includedChanges: ["Only changes expressly listed in the selected SKU are included."],
    usageLimits: [
      plan.minimumTerm
        ? `Minimum term: ${plan.minimumTerm}.`
        : "Usage follows the selected SKU limits.",
      "No unlimited support, usage, users, revisions, infrastructure, or custom work is included unless expressly stated.",
    ],
    limitExceeded: STANDARD_LIMIT_EXCEEDED,
  };
}

const BUILD_HARD_LIMITS: Record<string, string[]> = {
  build_site_starter: [
    "1 website; 1 brand; up to 5 pages; up to 2 admin users",
    "Up to 2 forms with 15 fields each; 1 design concept; 2 revision rounds",
    "Up to 2 small content requests and 3 development hours per month",
    "1 basic integration; 1 CMS collection; no products or database except basic form records",
    "Up to 5 launch blog posts, 20 processed images, 2 GB files, and 50 GB monthly bandwidth",
    "Up to 1,000 transactional emails per month; daily backups with 7-day retention",
    "2 support incidents and 30 minutes support per month; 1-business-day response target",
    "Temporary staging during build; AI, domains, and mailboxes are separate",
  ],
  build_site_growth: [
    "1 website; 1 brand; up to 15 pages; up to 5 admin users",
    "Up to 5 forms; 2 design concepts; 3 revision rounds",
    "Up to 8 development hours and 5 change requests per month",
    "Up to 3 basic integrations, 5 CMS collections, 500 CMS records, and 3 automation workflows",
    "Up to 15 launch blog posts, 75 processed images, 10 GB files, 150 GB monthly bandwidth, and a 1 GB database",
    "Up to 5,000 transactional emails per month; 2 analytics properties; 1 basic dashboard",
    "Daily backups with 14-day retention; shared staging; uptime, SSL, and basic application checks",
    "4 support incidents and 1 support hour per month; 8-business-hour response target",
    "AI uses a separate prepaid wallet; domains and licences are separate",
  ],
  build_site_scale: [
    "1 primary platform, 1 additional microsite, up to 2 brands, 30 pages/screens, 15 admin users, and 4 roles",
    "Up to 18 development hours, 2 active workstreams, and 8 change requests per month",
    "Up to 5 active integrations, 10 custom API endpoints, and 10 automation workflows",
    "Up to 10 CMS collections and 5,000 CMS/database records",
    "Up to 5 GB database, 25 GB files, 500 GB monthly bandwidth, and 15,000 transactional emails per month",
    "Up to 3 dashboards, 5 standard reports, and 5,000 rows per launch import",
    "Daily backups with 30-day retention; dedicated staging; uptime, SSL, server, database, and app checks",
    "6 support incidents, 2 support hours, and 1 priority incident per month; 4-business-hour response target",
    "1 roadmap review per month; AI and third-party licences are separate; VPS is included only within the stated resource limit",
  ],
  build_ecommerce_launch: [
    "1 storefront; 1 brand; up to 100 products, 300 variants, 20 categories, and 5 admin users",
    "1 payment gateway; up to 3 shipping methods, 3 collection points, and 10 discount rules",
    "Up to 5 standard reports and 1,000 monthly orders",
    "Up to 5 GB database, 25 GB files, 500 GB monthly bandwidth, and 20,000 transactional emails per month",
    "Up to 12 development hours, 6 changes, and 3 integrations per month",
    "Daily backups with 30-day retention; 6 support incidents and 2 support hours per month",
    "4-business-hour response target; AI, payment fees, SMS, and WhatsApp are separate",
  ],
  build_custom_app: [
    "The service order must define applications, users, roles, modules, screens, workflows, integrations, APIs, and data migration volumes",
    "The service order must define database, file storage, bandwidth, and development, staging, and production environments",
    "The service order must define support, delivery allocation, backups, security, availability, AI usage, acceptance, and warranty",
    "No custom application may start without a signed scope and acceptance criteria",
  ],
};

const BUILD_EXCLUSIONS: Record<string, string[]> = {
  build_site_starter: [
    "Ecommerce, login systems, portals, databases, booking systems, and advanced calculations",
    "Custom integrations or APIs, multilingual functionality, new page templates, and major layout redesigns",
  ],
  build_site_growth: [
    "Custom applications, complex portals, ERP modules, advanced ecommerce, and real-time integrations",
    "Custom authentication, extensive migration, multi-company tenancy, workflow engines, and mobile apps",
  ],
  build_site_scale: [
    "Unlimited custom-app development or delivery beyond the monthly allocation",
    "Large modules, migrations, integrations, or expansions not approved for delivery over multiple Build months or as a separate project",
  ],
  build_ecommerce_launch: [
    "Marketplace, multi-vendor, warehouse-management, complex ERP, or point-of-sale systems",
    "Courier APIs beyond included integrations, unlimited imports, product photography, and product copywriting",
  ],
  build_custom_app: ["Anything not named with a measurable limit in the signed service order"],
};

const BUILD_PACKAGE_RULES: Record<string, PackageRules> = {
  build_site_starter: {
    coverage: [
      "1 brand and 1 brochure website or landing presence with up to 5 pages and 2 admin users",
    ],
    serviceAllocation: ["Up to 3 development hours and 2 small content requests per month"],
    infrastructureAllocation: [
      "2 GB file storage, 50 GB monthly bandwidth, temporary staging, and basic form records only",
    ],
    supportAllocation: ["Up to 2 incidents and 30 minutes of support per month"],
    responseTimes: [BUILD_PACKAGE_RESPONSE_TARGETS.build_site_starter],
    includedChanges: [
      "1 design concept, 2 revision rounds, and small supplied text, image, contact, link, document, or opening-hour updates",
    ],
    usageLimits: BUILD_HARD_LIMITS.build_site_starter,
    limitExceeded: [
      "Upgrade to Build Growth, approve a change request, or accept a separate quotation",
    ],
  },
  build_site_growth: {
    coverage: ["1 brand and 1 growing company website with up to 15 pages and 5 admin users"],
    serviceAllocation: ["Up to 8 development hours and 5 change requests per month"],
    infrastructureAllocation: [
      "1 GB database, 10 GB files, 150 GB monthly bandwidth, and 1 shared staging environment",
    ],
    supportAllocation: ["Up to 4 incidents and 1 support hour per month"],
    responseTimes: [BUILD_PACKAGE_RESPONSE_TARGETS.build_site_growth],
    includedChanges: [
      "2 design concepts, 3 revision rounds, 3 basic integrations, and 3 basic automation workflows",
    ],
    usageLimits: BUILD_HARD_LIMITS.build_site_growth,
    limitExceeded: STANDARD_LIMIT_EXCEEDED,
  },
  build_site_scale: {
    coverage: [
      "1 primary platform, 1 microsite, up to 2 brands, 30 pages/screens, 15 admin users, and 4 roles",
    ],
    serviceAllocation: [
      "Up to 18 development hours, 2 active workstreams, 8 change requests, and 1 roadmap review per month",
    ],
    infrastructureAllocation: [
      "5 GB database, 25 GB files, 500 GB monthly bandwidth, dedicated staging, and VPS only within its stated resource limit",
    ],
    supportAllocation: ["Up to 6 incidents, 2 support hours, and 1 priority incident per month"],
    responseTimes: [BUILD_PACKAGE_RESPONSE_TARGETS.build_site_scale],
    includedChanges: [
      "Up to 5 integrations, 10 API endpoints, 10 workflows, 3 dashboards, and 5 reports within the delivery allocation",
    ],
    usageLimits: BUILD_HARD_LIMITS.build_site_scale,
    limitExceeded: [
      "Larger modules, migrations, integrations, and expansions require additional Build Scale months or a separate project quotation",
    ],
  },
  build_ecommerce_launch: {
    coverage: [
      "1 brand and 1 storefront with up to 100 products, 300 variants, 20 categories, and 5 admin users",
    ],
    serviceAllocation: ["Up to 12 development hours and 6 changes per month"],
    infrastructureAllocation: ["5 GB database, 25 GB files, and 500 GB monthly bandwidth"],
    supportAllocation: ["Up to 6 incidents and 2 support hours per month"],
    responseTimes: [BUILD_PACKAGE_RESPONSE_TARGETS.build_ecommerce_launch],
    includedChanges: [
      "1 payment gateway, up to 3 integrations, 3 shipping methods, 3 collection points, and 10 discount rules",
    ],
    usageLimits: BUILD_HARD_LIMITS.build_ecommerce_launch,
    limitExceeded: STANDARD_LIMIT_EXCEEDED,
  },
  build_custom_app: {
    coverage: [
      "The number of apps, portals, users, roles, modules, and screens must be stated in the signed service order",
    ],
    serviceAllocation: [
      "Hours, sprint capacity, or milestones must be stated in the signed service order",
    ],
    infrastructureAllocation: [
      "Database, storage, bandwidth, and development, staging, and production environments must be stated in the signed service order",
    ],
    supportAllocation: [
      "Incidents, support hours, acceptance period, and corrective-maintenance warranty must be stated in the signed service order",
    ],
    responseTimes: [BUILD_PACKAGE_RESPONSE_TARGETS.build_custom_app],
    includedChanges: [
      "Named modules, screens, workflows, integrations, endpoints, migrations, and acceptance criteria only",
    ],
    usageLimits: BUILD_HARD_LIMITS.build_custom_app,
    limitExceeded: [
      "A signed change order or separate quotation is required before expanded work starts",
    ],
  },
};

export const PROPOSAL_DEFAULT_INTRODUCTION =
  "CloudMonkey proposes a managed service engagement focused on reliability, clear support boundaries, and commercially transparent delivery.";

export const PROPOSAL_DEFAULT_EXECUTIVE_SUMMARY =
  "The selected services below include the management layer, SLA expectations, hard limits, customer request process, and commercial terms required to move from proposal to onboarding.";

function isBuildRelatedServiceName(serviceName: string) {
  return /build|website|web site|ecommerce|store/i.test(serviceName);
}

export function buildProposalTerms(serviceNames: string[] = []) {
  const clauses = [
    "Setup fees are once-off onboarding, scoping, deployment, and launch-readiness charges. Recurring service fees are billed monthly unless the proposal or invoice states otherwise.",
    "CloudMonkey delivers only the scope, service levels, and hard limits expressly listed in the accepted proposal, SLA, or service order. Any work outside that envelope is quoted and approved before it starts.",
    "Future requests submitted by WhatsApp or email will be logged into CloudMonkey's ticket queue, linked to the subscribed service, and actioned according to the applicable SLA and priority order. CloudMonkey is moving toward an automated request-routing mode, so all tickets will be handled from the same support workflow.",
    ...STANDARD_PACKAGE_TERMS,
  ];

  if (serviceNames.some(isBuildRelatedServiceName)) {
    clauses.push(
      "Build subscriptions are limited to the companies, brands, websites, applications, and active workstreams stated in the selected SKU or signed service order. Additional coverage requires a package upgrade, Build activation, change order, or separate quote.",
    );
  }

  clauses.push(
    "Pricing excludes VAT unless the final invoice or checkout explicitly states otherwise.",
  );
  return clauses.join("\n\n");
}

export const AGREEMENT_TEMPLATES: AgreementTemplateDefinition[] = [
  {
    id: "managed-services-sla",
    name: "Managed Services SLA",
    documentType: "sla",
    version: "2026-07-17",
    title: "CloudMonkey Managed Services SLA",
    body: [
      "This SLA defines the management layer for CloudMonkey managed services. The selected SKU determines the covered users, devices, service channels, response priority, setup work, hard limits, and monthly management scope.",
      "Managed services include only the monitoring, administration, patching, reporting, and support activities expressly listed in the accepted service definition. Services are remote-first unless the signed service order states otherwise.",
      "Out-of-scope work includes project delivery, migrations, custom integrations, onsite work, hardware repairs, data recovery, third-party vendor disputes, and any usage above the selected plan limits unless approved under a separate quote or change order.",
      "Setup fees are one-time onboarding or deployment fees and are separate from recurring management fees. VAT treatment is confirmed in checkout, quotes, invoices, and signed service orders.",
      "Unused support time, incidents, revisions, infrastructure capacity, and usage allowances do not roll over unless expressly stated. Package limits are maximum allowances and do not guarantee delivery where customer content, approvals, access, dependencies, or decisions are late or missing.",
      "The selected SKU and accepted service definition control product-specific coverage, allocations, response targets, changes, usage limits, and overage treatment. A public SLA summary does not expand a selected package.",
    ].join("\n\n"),
  },
  {
    id: "productivity-admin-sla",
    name: "Productivity Admin SLA",
    documentType: "sla",
    version: "2026-07-05",
    title: "Microsoft 365 and Google Workspace Administration SLA",
    body: [
      "This SLA covers administration-only support for Microsoft 365 and Google Workspace environments. Included work is limited to user creation, licensing administration, DNS records, baseline security policies, and platform administration support.",
      "Licensing fees, tenant migrations, mailbox migrations, end-user helpdesk, device support, data cleanup, security incident response, and third-party application support are excluded unless separately quoted.",
      "Customer remains responsible for licence procurement decisions, user permissions, data ownership, lawful use, and backup or retention requirements unless a signed agreement expressly assigns a task to CloudMonkey.",
    ].join("\n\n"),
  },
  {
    id: "ai-services-addendum",
    name: "AI Services Addendum",
    documentType: "addendum",
    version: "2026-07-05",
    title: "CloudMonkey AI Services Addendum",
    body: [
      "This addendum defines the operating envelope for CloudMonkey AI agents, business AI assistants, OpenClaw servers, and related AI workflows.",
      "Unless the selected SKU states otherwise, an AI Agent includes one agent, one knowledge base, one connected channel, one workflow, up to 1 million AI tokens per month, and one tuning review per billing month.",
      "AI output may be incomplete, inaccurate, biased, or unsuitable for regulated decisions. Customer must review AI output before relying on it for legal, financial, medical, employment, security, contractual, or other material decisions.",
      "Excluded work includes custom software development, complex integrations, regulated decision automation, unlimited prompt engineering, additional channels, additional knowledge bases, extra workflows, excess token usage, and customer data cleansing unless separately quoted.",
    ].join("\n\n"),
  },
  {
    id: "voice-connect-sla",
    name: "Voice Connect SLA",
    documentType: "sla",
    version: "2026-07-05",
    title: "CloudMonkey Voice and PBX SLA",
    body: [
      "This SLA covers managed VoIP, hosted PBX, SIP trunks, extensions, IVR setup, call routing, recording configuration, and reporting within the selected SKU limits.",
      "Carrier usage, call charges, number porting delays, regulatory costs, customer network quality, handset procurement, onsite cabling, and custom contact-centre projects are excluded unless a signed service order includes them.",
      "The Connect or Voice Team bundle is capped at 10 extensions unless upgraded. Additional extensions, advanced routing, compliance retention, CRM integration, and multi-site rollout work require a separate quote or plan upgrade.",
    ].join("\n\n"),
  },
  {
    id: "full-service-growth-sla",
    name: "Full-Service Growth SLA",
    documentType: "service_order",
    version: "2026-07-05",
    title: "CloudMonkey Full-Service Growth Service Order",
    body: [
      "This service order governs bundled managed cloud, build, marketing, voice, AI, and support services. The selected bundle is not unlimited support; each included lane is constrained by its SKU limits, agreed users, systems, tokens, support channels, and monthly work allocation.",
      "CloudMonkey may sequence work based on operational priority, payment status, customer dependencies, and service readiness. Any scope expansion, extra users, additional devices, extra content, new integrations, custom development, or excess AI usage requires written approval.",
      "Setup fees cover onboarding, discovery, configuration, launch planning, and initial deployment activities. Recurring fees cover ongoing management within the defined service envelope.",
    ].join("\n\n"),
  },
  {
    id: "build-service-order",
    name: "Build Service Order",
    documentType: "service_order",
    version: "2026-07-17",
    title: "CloudMonkey Build Service Order",
    body: [
      "This service order governs build subscriptions for websites, ecommerce stores, and related delivery projects. Each subscription is limited to the companies, brands, websites, applications, pages or screens, and workstreams stated in the selected SKU or signed service definition.",
      "Customer requests submitted by WhatsApp or email are logged into CloudMonkey's ticket queue and actioned against the subscribed service. CloudMonkey is moving toward automated request routing, so future requests will be triaged through the same workflow and prioritised against the agreed SLA and limits.",
      "Any additional company, brand, domain, or build project requires a separate subscription or written quote. Work outside the accepted scope, content brief, or change window is excluded until approved in writing.",
      "Setup fees cover scoping, design, build, launch, and launch-readiness work. Recurring fees cover the agreed support and hosting envelope.",
      "Corrective support is included only where the affected feature was in the approved scope, previously worked, remains supported, is reproducibly defective, was not altered by the customer, is not failing because of a third party, and the customer has an eligible active package.",
      "New fields, screens, reports, roles, approval processes, calculations, business rules, integrations, automations, templates, redesigns, imports, business units, mobile applications, and code-level performance work are development and require Build activation, a change order, or a separate quotation.",
      "Unused development time, support time, incidents, revisions, infrastructure capacity, and usage allowances do not roll over unless expressly stated. Package limits are maximum allowances and do not guarantee delivery where customer content, approvals, access, dependencies, or decisions are late or missing.",
      "While Build is active, the standard Managed Server fee is paused where Build includes the same management scope. VPS resources are bundled only when the selected Build package expressly includes that tier. When Build ends, Managed Server, VPS, backup, AI wallet, messaging, domains, and licences become separate recurring or usage line items as applicable.",
    ].join("\n\n"),
  },
];

export function agreementTemplateForService(serviceId: string, planId: string) {
  if (serviceId.startsWith("build-")) return "build-service-order";
  if (serviceId === "productivity") return "productivity-admin-sla";
  if (serviceId === "ai-agents" || serviceId === "ai-assistant" || serviceId === "openclaw") {
    return "ai-services-addendum";
  }
  if (
    serviceId === "pbx" ||
    serviceId === "sip-trunks" ||
    serviceId === "voice-intel" ||
    serviceId === "voice-quote"
  ) {
    return "voice-connect-sla";
  }
  if (planId.includes("custom") || planId.includes("quote")) return "managed-services-sla";
  return "managed-services-sla";
}

export function agreementTemplateForBundle(bundleId: string) {
  if (bundleId === "bundle_full_service_growth") return "full-service-growth-sla";
  if (bundleId === "bundle_voice_team" || bundleId === "bundle_managed_voice")
    return "voice-connect-sla";
  return "managed-services-sla";
}

export function serviceDefinitionForPlan(
  category: ServiceCategory,
  service: Service,
  plan: ServicePlan,
): ServiceDefinition {
  const packageRules = defaultPackageRules(category, service, plan);
  const standardTerms = STANDARD_PACKAGE_TERMS;

  if (service.id === "build-websites" || service.id === "build-commerce-apps") {
    const buildRules = BUILD_PACKAGE_RULES[plan.id] ?? packageRules;
    return {
      managementType: plan.billingType === "quote" ? "quote" : "managed",
      setupFeeDescription:
        plan.setupPriceZar && plan.setupPriceZar > 0
          ? "One-time scoping, design, build, deployment, and launch-readiness fee. This is separate from the recurring build subscription."
          : undefined,
      vatTreatment: DEFAULT_VAT_TREATMENT,
      packageRules: buildRules,
      standardTerms,
      includedScope: plan.features,
      excludedScope: [
        ...(BUILD_EXCLUSIONS[plan.id] ?? []),
        "Additional companies, brands, domains, or projects beyond the selected package",
        "Client delays, third-party delays, and customer-side content, access, data, or licensing issues",
      ],
      hardLimits: [
        ...(BUILD_HARD_LIMITS[plan.id] ?? ["1 company / 1 brand / 1 build subscription"]),
        plan.minimumTerm
          ? `Minimum term: ${plan.minimumTerm}`
          : "Minimum term recorded on the selected plan",
      ],
      support: [
        "WhatsApp and email requests are logged into CloudMonkey tickets",
        "Tickets are actioned against the subscribed service and SLA",
        "Automated request routing will be used as the workflow is enabled",
      ],
      outOfScopeBilling: DEFAULT_OUT_OF_SCOPE,
    };
  }

  const setupFeeDescription =
    plan.setupPriceZar && plan.setupPriceZar > 0
      ? "One-time onboarding, deployment, configuration, and launch-readiness fee. This is separate from the recurring management fee."
      : undefined;
  const baseExcluded = [
    "Work outside the selected SKU features or hard limits",
    "Customer-side content, data, licensing, or third-party provider delays",
    "Custom project work, migrations, onsite work, and integrations unless explicitly included",
  ];

  if (service.id === "managed-infra") {
    return {
      managementType: "managed",
      vatTreatment: DEFAULT_VAT_TREATMENT,
      packageRules: {
        coverage: [
          "1 server, 1 supported Linux distribution, 3 production services, 10 containers, 2 databases, and 3 domains",
        ],
        serviceAllocation: [
          "Monthly patching, 1 basic deployment, 3 service restarts, and 1 health report per month",
        ],
        infrastructureAllocation: [
          "5 SSL certificates, 3 backup jobs, and 10 automated uptime checks monitored every 5 minutes",
        ],
        supportAllocation: [
          "Up to 1 human administration hour and 2 support incidents per month during business hours",
        ],
        responseTimes: [
          `S1: ${MANAGED_SERVER_RESPONSE_TARGETS.S1}`,
          `S2: ${MANAGED_SERVER_RESPONSE_TARGETS.S2}`,
          `S3: ${MANAGED_SERVER_RESPONSE_TARGETS.S3}`,
          `S4: ${MANAGED_SERVER_RESPONSE_TARGETS.S4}`,
        ],
        includedChanges: [
          "Log review, failed-container restart, disk checks, routine patch troubleshooting, SSL or DNS checks, minor configuration correction, and basic backup-failure investigation",
        ],
        usageLimits: [
          "New development and after-hours work are excluded",
          "Backup retention follows the selected backup or VPS product",
        ],
        limitExceeded: [
          "Standard infrastructure: R1,250/hour",
          "Priority infrastructure: R1,750/hour",
          "After-hours emergency: R2,500/hour with a 2-hour minimum",
        ],
      },
      standardTerms,
      includedScope: plan.features,
      excludedScope: [
        "Application bugs caused by custom code, code changes, and new development",
        "Migrations, large restores, disaster recovery, database optimisation, and server rebuilds",
        "Security incident response, new applications or containers, major upgrades, and architecture work",
        "After-hours support",
      ],
      hardLimits: [
        "1 server; 1 supported Linux distribution; up to 3 production services, 10 containers, and 2 monitored databases",
        "Up to 3 monitored domains, 5 SSL certificates, 3 backup jobs, and 10 uptime checks at 5-minute intervals",
        "Monthly routine patching; critical patches as reasonably required",
        "Up to 1 human administration hour, 2 incidents, 3 restart requests, 1 basic deployment, and 1 health report per month",
        "Business-hours support only",
      ],
      support: [
        `S1 response: ${MANAGED_SERVER_RESPONSE_TARGETS.S1}`,
        `S2 response: ${MANAGED_SERVER_RESPONSE_TARGETS.S2}`,
        `S3 response: ${MANAGED_SERVER_RESPONSE_TARGETS.S3}`,
        `S4 response: ${MANAGED_SERVER_RESPONSE_TARGETS.S4}`,
      ],
      outOfScopeBilling:
        "Standard infrastructure work is R1,250/hour; priority infrastructure work is R1,750/hour; after-hours emergency work is R2,500/hour with a two-hour minimum.",
    };
  }

  if (service.id === "hosting") {
    const capacity: Record<string, string> = {
      "vps-starter": "1 small website",
      "vps-business": "Up to 3 small websites",
      "vps-growth": "Up to 5 websites or 1 application",
      "vps-enterprise": "1 advanced workload within the provisioned resources",
    };
    return {
      managementType: "managed",
      vatTreatment: DEFAULT_VAT_TREATMENT,
      packageRules: {
        coverage: [capacity[plan.id] ?? "Workloads within the selected VPS resources"],
        serviceAllocation: [
          "Provisioned infrastructure only; administration requires an active Managed Server or Build package",
        ],
        infrastructureAllocation: plan.features,
        supportAllocation: [
          "Supplier and platform availability support; application administration is separate",
        ],
        responseTimes: ["Response targets follow the active management package, if any"],
        includedChanges: [
          "Provisioning only; migrations, upgrades, and architecture changes are separately billed",
        ],
        usageLimits: [
          "Sustained CPU above 80%, RAM above 85%, disk exhaustion, or transfer overage may require an upgrade",
        ],
        limitExceeded: [
          "Upgrade the VPS or pay applicable transfer, storage, snapshot, IP, licence, or migration charges",
        ],
      },
      standardTerms,
      includedScope: plan.features,
      excludedScope: [
        "Unlimited administration",
        "Additional IPs, snapshots, backup storage, and operating-system licences",
        "Server migrations unless caused by CloudMonkey",
      ],
      hardLimits: [
        ...plan.features,
        capacity[plan.id] ?? "Capacity follows the accepted service order",
      ],
      outOfScopeBilling: DEFAULT_OUT_OF_SCOPE,
    };
  }

  if (service.id === "backups") {
    const backupLimits: Record<string, string[]> = {
      "backup-basic": [
        "Daily",
        "7-day retention",
        "Off-server",
        "Up to 10 GB",
        "1 restore request per quarter",
        "Restore testing excluded",
        "Best-effort recovery target",
      ],
      "backup-business": [
        "Daily with 30-day retention",
        "4 weekly and 3 monthly copies",
        "Up to 50 GB",
        "1 restore request per month",
        "Quarterly restore test",
      ],
      "backup-critical": [
        "Frequency, retention, storage, restore testing, recovery objectives, encryption, and disaster-recovery runbook defined by quote",
      ],
    };
    return {
      managementType: plan.billingType === "quote" ? "quote" : "managed",
      vatTreatment: DEFAULT_VAT_TREATMENT,
      packageRules: {
        coverage: ["1 covered workload unless the service order states otherwise"],
        serviceAllocation: ["Scheduled backup operation and monitoring within the selected tier"],
        infrastructureAllocation: backupLimits[plan.id] ?? [],
        supportAllocation: [
          plan.id === "backup-business"
            ? "1 restore request per month"
            : plan.id === "backup-basic"
              ? "1 restore request per quarter"
              : "Defined by service order",
        ],
        responseTimes: [
          plan.id === "backup-critical"
            ? "Defined recovery objectives in the service order"
            : "Best effort",
        ],
        includedChanges: [
          plan.id === "backup-business"
            ? "Quarterly restore test"
            : "Restore testing is included only where expressly listed",
        ],
        usageLimits: backupLimits[plan.id] ?? [],
        limitExceeded: [
          "Additional storage, retention, restore requests, and restore labour are billed separately",
        ],
      },
      standardTerms,
      includedScope: plan.features,
      excludedScope: [
        "Restore labour beyond the included allowance",
        "Disaster recovery unless included in a Critical Backup order",
      ],
      hardLimits: backupLimits[plan.id] ?? [],
      outOfScopeBilling: DEFAULT_OUT_OF_SCOPE,
    };
  }

  if (service.id === "domains") {
    return {
      managementType: "managed",
      vatTreatment: DEFAULT_VAT_TREATMENT,
      packageRules: {
        coverage: ["1 domain per subscription and up to 20 managed DNS records"],
        serviceAllocation: [
          "Registration or renewal, nameserver management, and SSL configuration where supported",
        ],
        infrastructureAllocation: ["Registry domain and standard DNS hosting only"],
        supportAllocation: ["Up to 3 DNS changes per month only while Managed Server is active"],
        responseTimes: [
          "Standard business-hours response targets follow the active management package",
        ],
        includedChanges: ["Nameserver changes and supported SSL configuration"],
        usageLimits: [
          "Premium domains, transfers, redemption, and registry price changes are separate",
        ],
        limitExceeded: [
          "Additional DNS work is billed as out-of-scope support; registry charges are passed through",
        ],
      },
      standardTerms,
      includedScope: plan.features,
      excludedScope: [
        "Premium domains",
        "Domain transfer and redemption fees",
        "Loss caused by incorrect ownership details or unpaid renewal invoices",
      ],
      hardLimits: [
        "1 domain",
        "Up to 20 DNS records",
        "Up to 3 DNS changes per month under Managed Server",
      ],
      outOfScopeBilling: DEFAULT_OUT_OF_SCOPE,
    };
  }

  if (service.id === "managed-it") {
    const limits: Record<string, string[]> = {
      "it-starter": [
        "Remote-only support",
        "Up to 2 users/devices",
        "Email and ticket support only",
      ],
      "it-business": [
        "Up to 5 users/devices",
        "Business-hours helpdesk",
        "Monthly report included",
      ],
      "it-premium": [
        "Up to 10 users/devices",
        "Priority support",
        "Security baseline",
        "Quarterly reviews",
      ],
    };
    return {
      managementType: plan.billingType === "quote" ? "quote" : "managed",
      setupFeeDescription,
      vatTreatment: DEFAULT_VAT_TREATMENT,
      packageRules,
      standardTerms,
      includedScope: plan.features,
      excludedScope: [
        ...baseExcluded,
        "Hardware repairs, cabling, printer support, and data recovery",
      ],
      hardLimits: limits[plan.id] ?? [
        "Custom SLA, users, devices, reporting, and escalation terms by signed service order",
      ],
      outOfScopeBilling: DEFAULT_OUT_OF_SCOPE,
    };
  }

  if (service.id === "productivity") {
    return {
      managementType: "managed",
      setupFeeDescription,
      vatTreatment: DEFAULT_VAT_TREATMENT,
      packageRules,
      standardTerms,
      includedScope: [
        "User creation",
        "Licensing administration",
        "DNS records",
        "Security policy administration",
        "Admin support",
      ],
      excludedScope: [
        "Licence fees",
        "Tenant migrations",
        "Mailbox migrations",
        "End-user helpdesk",
        "Device support",
      ],
      hardLimits: [
        "Administration-only service",
        "Licensing billed separately",
        "Per-user monthly management fee",
      ],
      outOfScopeBilling: DEFAULT_OUT_OF_SCOPE,
    };
  }

  if (service.id === "ai-agents") {
    return {
      managementType: "managed",
      setupFeeDescription,
      vatTreatment: DEFAULT_VAT_TREATMENT,
      packageRules,
      standardTerms,
      includedScope: plan.features,
      excludedScope: [
        "Custom software development",
        "Complex integrations",
        "Regulated decision automation",
        "Additional channels, knowledge bases, workflows, or excess tokens",
      ],
      hardLimits: [
        "1 agent",
        "1M AI tokens per month",
        "1 knowledge base",
        "1 channel",
        "1 workflow",
        "1 tuning review per month",
      ],
      outOfScopeBilling: DEFAULT_OUT_OF_SCOPE,
    };
  }

  if (service.id === "pbx" || service.id === "sip-trunks" || service.id === "voice-intel") {
    return {
      managementType: "managed",
      setupFeeDescription,
      vatTreatment: DEFAULT_VAT_TREATMENT,
      packageRules,
      standardTerms,
      includedScope: plan.features,
      excludedScope: [
        "Carrier usage",
        "Call charges",
        "Regulatory costs",
        "Customer network quality issues",
        "Onsite cabling or handset procurement",
      ],
      hardLimits:
        plan.id === "pbx-ext"
          ? ["Per-user extension licence", "One user per extension"]
          : ["Limits follow accepted service order quantities"],
      outOfScopeBilling: DEFAULT_OUT_OF_SCOPE,
    };
  }

  if (service.id === "technical-strategic-services" || service.id === "strategic-advisory") {
    const isHourly = service.id === "technical-strategic-services";
    return {
      managementType: plan.billingType === "quote" ? "quote" : "managed",
      vatTreatment: DEFAULT_VAT_TREATMENT,
      packageRules: {
        coverage: [
          isHourly
            ? "Technical delivery, strategic advisory, fractional CTO, training, and project facilitation within the approved booking."
            : "Capacity is limited to the remote or on-site hours included in the selected monthly allocation.",
        ],
        serviceAllocation: [
          isHourly
            ? "Work is requested or approved by an authorised client representative before delivery."
            : "Clients select priorities, stakeholders, and outputs for each monthly allocation.",
        ],
        infrastructureAllocation: [
          "Hosting, VPS infrastructure, backups, AI tokens, software licences, hardware, and third-party services are separate.",
        ],
        supportAllocation: [
          isHourly
            ? "Time, activity, outputs, and blockers may be recorded through project logs or job cards."
            : "Hours used, outcomes, blockers, and remaining capacity are reported through CloudMonkey project records.",
        ],
        responseTimes: [
          "Sessions and delivery windows follow the accepted booking, quotation, or service confirmation.",
        ],
        includedChanges: [
          "Advice, decisions, documentation, workshops, and agreed actions within purchased capacity.",
        ],
        usageLimits: [
          isHourly
            ? "On-site work has a three-hour minimum; remote work is recorded in 30-minute increments."
            : "Preparation, document review, and requested follow-up count toward the allocation when recorded.",
          "Unused monthly hours do not roll over unless agreed in writing before month-end.",
        ],
        limitExceeded: [
          "Additional hours require written approval and are billed at the applicable hourly rate.",
        ],
      },
      standardTerms: [
        "Rates are effective from 3 August 2026 and may be updated on written notice or in a renewed service schedule.",
        "Access is purchased as defined time and capacity; it does not create unlimited availability, equity, revenue share, partnership, or responsibility for client business outcomes.",
        "Strategic advice may identify development work, but that work is separately approved and scheduled.",
      ],
      includedScope: plan.features,
      excludedScope: [
        "Development or configuration beyond purchased capacity",
        "Hosting, AI tokens, hardware, licences, and third-party services",
        "Formal legal, tax, accounting, or regulated professional advice",
        "Business management authority or responsibility for client staff",
        "Equity participation, revenue share, board appointment, or partnership status",
      ],
      hardLimits: [
        isHourly
          ? "On-site minimum: three hours per booking."
          : "Monthly allocations are paid in advance and are limited to the hours listed in the selected plan.",
        isHourly
          ? "Remote billing: 30-minute increments."
          : "Additional hours require written approval.",
        "Travel, accommodation, expenses, external contractors, and pass-through costs require separate approval.",
      ],
      support: [
        "A nominated client decision-maker approves priorities and resolves scope questions.",
      ],
      outOfScopeBilling:
        "Additional approved time is billed at R1,000/hour on-site or R600/hour remote; external costs are quoted separately.",
    };
  }

  return {
    managementType: plan.billingType === "quote" ? "quote" : "managed",
    setupFeeDescription,
    vatTreatment: DEFAULT_VAT_TREATMENT,
    packageRules,
    standardTerms,
    includedScope: plan.features,
    excludedScope: baseExcluded,
    hardLimits: [
      plan.minimumTerm
        ? `Minimum term: ${plan.minimumTerm}`
        : "Monthly service envelope follows selected SKU",
      plan.trialDays
        ? `${plan.trialDays}-day trial where eligible`
        : "No unlimited support, usage, users, or custom work unless stated",
      category.name === "Managed Cloud"
        ? "Managed layer includes monitoring, patching, backups, DNS/SSL support, and support only as listed"
        : "Scope is limited to listed features and accepted service order",
    ],
    outOfScopeBilling: DEFAULT_OUT_OF_SCOPE,
  };
}

export function serviceDefinitionForBundle(bundle: Bundle): ServiceDefinition {
  const packageRules: PackageRules = {
    coverage: [
      "Coverage is limited to the users, brands, websites, apps, servers, and service lanes listed in the bundle or signed service order.",
    ],
    serviceAllocation: [
      "Delivery and managed service allocations follow the component SKU limits.",
    ],
    infrastructureAllocation: [
      "Infrastructure is included only where expressly listed in the bundle.",
    ],
    supportAllocation: [
      "Support follows the strictest applicable component SLA unless the signed order states otherwise.",
    ],
    responseTimes: ["Response targets follow the accepted SLA or signed service order."],
    includedChanges: [
      "Only changes listed in the component SKUs or signed service order are included.",
    ],
    usageLimits: ["Each service lane remains subject to its SKU quantities and fair-use limits."],
    limitExceeded: STANDARD_LIMIT_EXCEEDED,
  };
  if (bundle.id === "bundle_voice_team") {
    return {
      managementType: "managed",
      setupFeeDescription:
        "One-time setup, SIP trunk configuration, IVR design, routing, and recording configuration fee.",
      vatTreatment: DEFAULT_VAT_TREATMENT,
      packageRules,
      standardTerms: STANDARD_PACKAGE_TERMS,
      includedScope: bundle.features,
      excludedScope: [
        "Carrier usage",
        "Call charges",
        "Regulatory costs",
        "More than 10 extensions",
        "Advanced contact-centre integrations",
      ],
      hardLimits: [
        "10 extensions",
        "Hosted PBX",
        "SIP trunk",
        "IVR design",
        "Recording configuration and standard storage",
      ],
      outOfScopeBilling: DEFAULT_OUT_OF_SCOPE,
    };
  }
  if (bundle.id === "bundle_full_service_growth") {
    return {
      managementType: "managed",
      setupFeeDescription:
        "One-time onboarding, discovery, configuration, launch planning, and deployment fee across included service lanes.",
      vatTreatment: DEFAULT_VAT_TREATMENT,
      packageRules,
      standardTerms: STANDARD_PACKAGE_TERMS,
      includedScope: bundle.features,
      excludedScope: [
        "Unlimited support",
        "Unlimited users/devices",
        "Unlimited AI tokens",
        "Additional integrations",
        "Custom development outside the accepted scope",
      ],
      hardLimits: [
        "Final users, devices, support hours, AI tokens, content volume, and voice quantities must be recorded in the signed service order",
      ],
      outOfScopeBilling: DEFAULT_OUT_OF_SCOPE,
    };
  }
  return {
    managementType: "managed",
    setupFeeDescription:
      bundle.setupPriceZar && bundle.setupPriceZar > 0
        ? "One-time onboarding, deployment, configuration, and launch-readiness fee."
        : undefined,
    vatTreatment: DEFAULT_VAT_TREATMENT,
    packageRules,
    standardTerms: STANDARD_PACKAGE_TERMS,
    includedScope: bundle.features,
    excludedScope: [
      "Work outside bundled features",
      "Additional users, devices, channels, integrations, or projects unless approved",
    ],
    hardLimits: [
      bundle.minimumTerm
        ? `Minimum term: ${bundle.minimumTerm}`
        : "Bundle limits follow accepted service order quantities",
    ],
    outOfScopeBilling: DEFAULT_OUT_OF_SCOPE,
  };
}

export const AGREEMENT_SKU_MAPPINGS: AgreementSkuMapping[] = [
  ...CATEGORIES.flatMap((category) =>
    category.services.flatMap((service) =>
      service.plans.map((plan) => ({
        id: `agreement_${plan.id}`,
        templateId: plan.agreementTemplateId ?? agreementTemplateForService(service.id, plan.id),
        productType: "plan" as const,
        productId: plan.id,
        required: true,
      })),
    ),
  ),
  ...BUNDLES.map((bundle) => ({
    id: `agreement_${bundle.id}`,
    templateId: bundle.agreementTemplateId ?? agreementTemplateForBundle(bundle.id),
    productType: "bundle" as const,
    productId: bundle.id,
    required: true,
  })),
];

export function getCategory(id: ServiceCategory["id"]) {
  return CATEGORIES.find((c) => c.id === id)!;
}

function parseServiceDefinition(value: string | ServiceDefinition | null | undefined) {
  if (!value) return undefined;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as ServiceDefinition;
  } catch {
    return undefined;
  }
}

function toPriceZar(priceZar: string | number | null | undefined) {
  if (priceZar == null || priceZar === "") return null;
  if (typeof priceZar === "number") return priceZar;
  const cents = Number.parseInt(priceZar, 10);
  return Number.isNaN(cents) ? null : cents / 100;
}

function toPriceCents(priceZar: number | null | undefined) {
  if (priceZar == null) return null;
  return Math.round(priceZar * 100).toString();
}

export function toStoredCentsString(value: string | number | null | undefined) {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value).toString() : null;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes(".")) {
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? Math.round(parsed * 100).toString() : null;
  }
  return trimmed;
}

function serializeServiceDefinition(value: ServiceDefinition | undefined) {
  return value ? JSON.stringify(value) : undefined;
}

export function serializePublicPricingCatalog(
  catalog: PublicPricingCatalog,
): PublicPricingResponse {
  return {
    categories: catalog.categories.map((category) => ({
      id: category.id,
      name: category.name,
      tagline: category.tagline,
      accent: category.accent,
      note: category.note ?? null,
      sortOrder: category.sortOrder ?? 0,
      active: category.active ?? true,
      services: category.services.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description ?? null,
        note: service.note ?? null,
        sortOrder: service.sortOrder ?? 0,
        active: service.active ?? true,
        plans: service.plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          tagline: plan.tagline ?? null,
          priceZar: toPriceCents(plan.priceZar),
          setupPriceZar: toPriceCents(plan.setupPriceZar),
          unit: plan.unit ?? null,
          billingFrequency: plan.billingFrequency ?? null,
          minimumTerm: plan.minimumTerm ?? null,
          minimumTermMonths: plan.minimumTermMonths ?? null,
          billingType: plan.billingType ?? null,
          priceLabel: plan.priceLabel ?? null,
          isBundle: plan.isBundle ?? null,
          sortOrder: plan.sortOrder ?? 0,
          serviceNote: plan.serviceNote ?? null,
          active: plan.active ?? true,
          trialDays: plan.trialDays ?? null,
          highlighted: plan.highlighted ?? null,
          badge: plan.badge ?? null,
          serviceDefinition: serializeServiceDefinition(plan.serviceDefinition),
          agreementTemplateId: plan.agreementTemplateId ?? null,
          features: plan.features.map((feature) => ({ content: feature })),
        })),
      })),
    })),
    bundles: catalog.bundles.map((bundle) => ({
      id: bundle.id,
      name: bundle.name,
      priceZar: toPriceCents(bundle.priceZar),
      setupPriceZar: toPriceCents(bundle.setupPriceZar),
      unit: bundle.unit ?? null,
      billingFrequency: bundle.billingFrequency ?? null,
      minimumTerm: bundle.minimumTerm ?? null,
      minimumTermMonths: bundle.minimumTermMonths ?? null,
      billingType: bundle.billingType ?? null,
      priceLabel: bundle.priceLabel ?? null,
      isBundle: bundle.isBundle ?? true,
      sortOrder: bundle.sortOrder ?? 0,
      categoryNote: bundle.categoryNote ?? null,
      serviceNote: bundle.serviceNote ?? null,
      active: bundle.active ?? true,
      highlighted: bundle.highlighted ?? null,
      badge: bundle.badge ?? null,
      serviceDefinition: serializeServiceDefinition(bundle.serviceDefinition),
      agreementTemplateId: bundle.agreementTemplateId ?? null,
      features: bundle.features.map((feature) => ({ content: feature })),
    })),
  };
}

export function normalizePublicPricingCatalog(raw?: PublicPricingResponse): PublicPricingCatalog {
  return {
    categories: (raw?.categories ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      tagline: category.tagline,
      accent: category.accent,
      note: category.note ?? undefined,
      sortOrder: category.sortOrder ?? 0,
      active: category.active ?? true,
      services: (category.services ?? []).map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description ?? undefined,
        note: service.note ?? undefined,
        sortOrder: service.sortOrder ?? 0,
        active: service.active ?? true,
        plans: (service.plans ?? []).map((plan) => ({
          id: plan.id,
          name: plan.name,
          tagline: plan.tagline ?? undefined,
          priceZar: toPriceZar(plan.priceZar),
          setupPriceZar: toPriceZar(plan.setupPriceZar),
          unit: plan.unit ?? undefined,
          billingFrequency: plan.billingFrequency ?? undefined,
          minimumTerm: plan.minimumTerm ?? undefined,
          minimumTermMonths: plan.minimumTermMonths ?? undefined,
          billingType: plan.billingType ?? "recurring",
          priceLabel: plan.priceLabel ?? undefined,
          isBundle: plan.isBundle ?? false,
          sortOrder: plan.sortOrder ?? 0,
          serviceNote: plan.serviceNote ?? undefined,
          active: plan.active ?? true,
          trialDays: plan.trialDays ?? undefined,
          highlighted: plan.highlighted ?? false,
          badge: plan.badge ?? undefined,
          serviceDefinition: parseServiceDefinition(plan.serviceDefinition),
          agreementTemplateId: plan.agreementTemplateId ?? undefined,
          features: (plan.features ?? []).map((feature) => feature.content),
        })),
      })),
    })),
    bundles: (raw?.bundles ?? []).map((bundle) => ({
      id: bundle.id,
      name: bundle.name,
      priceZar: toPriceZar(bundle.priceZar),
      setupPriceZar: toPriceZar(bundle.setupPriceZar),
      unit: bundle.unit ?? undefined,
      billingFrequency: bundle.billingFrequency ?? undefined,
      minimumTerm: bundle.minimumTerm ?? undefined,
      minimumTermMonths: bundle.minimumTermMonths ?? undefined,
      billingType: bundle.billingType ?? "recurring",
      priceLabel: bundle.priceLabel ?? undefined,
      isBundle: bundle.isBundle ?? true,
      sortOrder: bundle.sortOrder ?? 0,
      categoryNote: bundle.categoryNote ?? undefined,
      serviceNote: bundle.serviceNote ?? undefined,
      active: bundle.active ?? true,
      highlighted: bundle.highlighted ?? false,
      badge: bundle.badge ?? undefined,
      serviceDefinition: parseServiceDefinition(bundle.serviceDefinition),
      agreementTemplateId: bundle.agreementTemplateId ?? undefined,
      features: (bundle.features ?? []).map((feature) => feature.content),
    })),
  };
}

export function buildPublicPricingResponseFromDatabase(input: {
  categories: Array<{
    id: string;
    name: string;
    tagline: string;
    accent: CatalogAccent;
    note?: string | null;
    sortOrder?: number | null;
    active?: boolean | null;
  }>;
  services: Array<{
    id: string;
    categoryId: string;
    name: string;
    description?: string | null;
    note?: string | null;
    sortOrder?: number | null;
    active?: boolean | null;
  }>;
  plans: Array<{
    id: string;
    serviceId: string;
    name: string;
    tagline?: string | null;
    priceZar?: string | number | null;
    setupPriceZar?: string | number | null;
    unit?: string | null;
    billingFrequency?: BillingFrequency | null;
    minimumTerm?: string | null;
    minimumTermMonths?: number | null;
    billingType?: BillingType | null;
    priceLabel?: string | null;
    isBundle?: boolean | null;
    sortOrder?: number | null;
    serviceNote?: string | null;
    active?: boolean | null;
    trialDays?: number | null;
    highlighted?: boolean | null;
    badge?: string | null;
    serviceDefinition?: string | ServiceDefinition | null;
    agreementTemplateId?: string | null;
  }>;
  planFeatures?: Array<{ planId: string; content: string }>;
  bundles: Array<{
    id: string;
    name: string;
    priceZar?: string | number | null;
    setupPriceZar?: string | number | null;
    unit?: string | null;
    billingFrequency?: BillingFrequency | null;
    minimumTerm?: string | null;
    minimumTermMonths?: number | null;
    billingType?: BillingType | null;
    priceLabel?: string | null;
    isBundle?: boolean | null;
    sortOrder?: number | null;
    categoryNote?: string | null;
    serviceNote?: string | null;
    active?: boolean | null;
    highlighted?: boolean | null;
    badge?: string | null;
    serviceDefinition?: string | ServiceDefinition | null;
    agreementTemplateId?: string | null;
  }>;
  bundleFeatures?: Array<{ bundleId: string; content: string }>;
}): PublicPricingResponse {
  const featuresByPlan = new Map<string, Array<{ content: string }>>();
  for (const feature of input.planFeatures ?? []) {
    const current = featuresByPlan.get(feature.planId) ?? [];
    current.push({ content: feature.content });
    featuresByPlan.set(feature.planId, current);
  }

  const featuresByBundle = new Map<string, Array<{ content: string }>>();
  for (const feature of input.bundleFeatures ?? []) {
    const current = featuresByBundle.get(feature.bundleId) ?? [];
    current.push({ content: feature.content });
    featuresByBundle.set(feature.bundleId, current);
  }

  const servicesByCategory = new Map<string, Array<(typeof input.services)[number]>>();
  for (const service of input.services) {
    if (service.active === false) continue;
    const current = servicesByCategory.get(service.categoryId) ?? [];
    current.push(service);
    servicesByCategory.set(service.categoryId, current);
  }

  const plansByService = new Map<string, Array<(typeof input.plans)[number]>>();
  for (const plan of input.plans) {
    if (plan.active === false) continue;
    const current = plansByService.get(plan.serviceId) ?? [];
    current.push(plan);
    plansByService.set(plan.serviceId, current);
  }

  const categories = input.categories
    .filter((category) => category.active !== false)
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
    .map((category) => ({
      id: category.id,
      name: category.name,
      tagline: category.tagline,
      accent: category.accent,
      note: category.note ?? null,
      sortOrder: category.sortOrder ?? 0,
      active: category.active ?? true,
      services: (servicesByCategory.get(category.id) ?? [])
        .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
        .map((service) => ({
          id: service.id,
          name: service.name,
          description: service.description ?? null,
          note: service.note ?? null,
          sortOrder: service.sortOrder ?? 0,
          active: service.active ?? true,
          plans: (plansByService.get(service.id) ?? [])
            .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
            .map((plan) => ({
              id: plan.id,
              name: plan.name,
              tagline: plan.tagline ?? null,
              priceZar: toStoredCentsString(plan.priceZar),
              setupPriceZar: toStoredCentsString(plan.setupPriceZar),
              unit: plan.unit ?? null,
              billingFrequency: plan.billingFrequency ?? null,
              minimumTerm: plan.minimumTerm ?? null,
              minimumTermMonths: plan.minimumTermMonths ?? null,
              billingType: plan.billingType ?? null,
              priceLabel: plan.priceLabel ?? null,
              isBundle: plan.isBundle ?? null,
              sortOrder: plan.sortOrder ?? 0,
              serviceNote: plan.serviceNote ?? null,
              active: plan.active ?? true,
              trialDays: plan.trialDays ?? null,
              highlighted: plan.highlighted ?? null,
              badge: plan.badge ?? null,
              serviceDefinition: serializeServiceDefinition(
                typeof plan.serviceDefinition === "string"
                  ? parseServiceDefinition(plan.serviceDefinition)
                  : (plan.serviceDefinition ?? undefined),
              ),
              agreementTemplateId: plan.agreementTemplateId ?? null,
              features: (featuresByPlan.get(plan.id) ?? []).map((feature) => ({
                content: feature.content,
              })),
            })),
        })),
    }))
    .filter((category) => category.services.length > 0);

  const bundles = input.bundles
    .filter((bundle) => bundle.active !== false)
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
    .map((bundle) => ({
      id: bundle.id,
      name: bundle.name,
      priceZar: toStoredCentsString(bundle.priceZar),
      setupPriceZar: toStoredCentsString(bundle.setupPriceZar),
      unit: bundle.unit ?? null,
      billingFrequency: bundle.billingFrequency ?? null,
      minimumTerm: bundle.minimumTerm ?? null,
      minimumTermMonths: bundle.minimumTermMonths ?? null,
      billingType: bundle.billingType ?? null,
      priceLabel: bundle.priceLabel ?? null,
      isBundle: bundle.isBundle ?? true,
      sortOrder: bundle.sortOrder ?? 0,
      categoryNote: bundle.categoryNote ?? null,
      serviceNote: bundle.serviceNote ?? null,
      active: bundle.active ?? true,
      highlighted: bundle.highlighted ?? null,
      badge: bundle.badge ?? null,
      serviceDefinition: serializeServiceDefinition(
        typeof bundle.serviceDefinition === "string"
          ? parseServiceDefinition(bundle.serviceDefinition)
          : (bundle.serviceDefinition ?? undefined),
      ),
      agreementTemplateId: bundle.agreementTemplateId ?? null,
      features: (featuresByBundle.get(bundle.id) ?? []).map((feature) => ({
        content: feature.content,
      })),
    }));

  return { categories, bundles };
}

export async function fetchPublicPricingCatalog(): Promise<PublicPricingCatalog> {
  const response = await fetch("/api/public/pricing");
  if (!response.ok) throw new Error("Failed to fetch pricing");
  return normalizePublicPricingCatalog((await response.json()) as PublicPricingResponse);
}
