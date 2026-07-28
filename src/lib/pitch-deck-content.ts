export type PitchDeckSlide = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  body?: string;
  bullets?: string[];
  columns?: Array<{ title: string; body: string; bullets?: string[]; accent?: string }>;
  metrics?: Array<{ value: string; label: string }>;
  gantt?: Array<{ label: string; weeks: [number, number]; detail: string }>;
};

export type PitchDeckContent = {
  version: number;
  client: string;
  preparedBy: string;
  date: string;
  slides: PitchDeckSlide[];
};

export const STI_ELECTRICAL_PHASE_2_DECK: PitchDeckContent = {
  version: 1,
  client: "STI Electrical (Pty) Ltd",
  preparedBy: "CloudMonkey — a trading division of H44S (Pty) Ltd T/A Geek247",
  date: "28 July 2026",
  slides: [
    {
      id: "cover",
      eyebrow: "Phase 2 ERP proposal · Business optimization retainer",
      title: "From a validated ERP to an operationally visible business.",
      subtitle:
        "A transparent path to complete Phase 2, consolidate the technology stack, and give STI Electrical a system it can run independently.",
      metrics: [
        { value: "R70,000", label: "proposed Phase 2 close-out" },
        { value: "4 weeks", label: "on-site implementation window" },
        { value: "R1,000/hr", label: "on-site rate" },
      ],
    },
    {
      id: "why-now",
      eyebrow: "The context",
      title: "The ERP is validated. The remaining dependency is real operational data.",
      body: "Phase 1 business analysis was completed and approved under the Master SLA & NDA signed 26 March 2026. Nexus ERP was built and tested against seed data: sales and quotations, workshop workflows, clients, suppliers, and invoice data were migrated and proven. The next step was always to use STI Electrical's real operational data.",
      bullets: [
        "Real asset data, financial data, and stock data are still required for the final operational rollout.",
        "The original Phase 2 window has lapsed because the data dependency remained open; this is not presented as blame on either party.",
        "The proposed on-site format turns that dependency into a practical working programme with evidence, job cards, and weekly close-offs.",
      ],
    },
    {
      id: "outcome",
      eyebrow: "What this closes",
      title: "A working ERP, a clearer business, and an independent handover.",
      columns: [
        {
          title: "Complete Phase 2",
          body: "Finish the real-data implementation, security fixes, UAT, training, documentation, and go-live readiness.",
          accent: "violet",
        },
        {
          title: "See the whole operation",
          body: "Audit the current technology stack, plant and machinery, workflows, redundancies, gaps, and consolidation opportunities.",
          accent: "cyan",
        },
        {
          title: "Leave a fair exit",
          body: "STI Electrical owns the configured outputs and receives documentation and knowledge transfer to operate independently or use another provider.",
          accent: "amber",
        },
      ],
    },
    {
      id: "scope",
      eyebrow: "Proposed scope",
      title: "The work goes beyond an ERP screen — but the boundaries stay visible.",
      bullets: [
        "Complete remaining ERP data imports and consolidation across clients, suppliers, invoices, assets, financials, and stock.",
        "Fix identified systems and security issues and validate real user workflows across sales, workshop, procurement, and finance.",
        "Business technology audit: tools in use, overlaps, gaps, redundant costs, and a centralised data/system architecture recommendation.",
        "Plant and machinery audit to establish the asset register and create an evidence base for future improvements.",
        "IoT readiness verification only at this stage; implementation, hardware, and future automation are separately scoped under the SLA exclusions.",
        "AI learning and owner dashboards/insights are proposed as a layer on top of consolidated ERP data, subject to data quality and agreed scope.",
      ],
    },
    {
      id: "option-a",
      eyebrow: "Commercial option A",
      title: "On-site hourly delivery with job cards",
      subtitle:
        "R1,000 per hour · 3–4 hours per day · Monday to Friday · Johannesburg manufacturing plant",
      columns: [
        {
          title: "How it works",
          body: "Only time physically on-site is billed. Every session closes with a job card showing time, work completed, outcomes, and next actions.",
          bullets: [
            "Target: minimum 3 hours/day",
            "Approximately R3,000/day or R60,000/month at 20 working days",
            "Additional time is requested and billed at R1,000/hour",
          ],
        },
        {
          title: "Advantages",
          body: "The lowest-commitment opening path and easiest to scale up or down as the operational need becomes clearer.",
          bullets: [
            "Pay for time delivered",
            "Tangible, auditable work record",
            "Lower initial approval barrier",
            "ERP and broader optimisation time remain visible",
          ],
        },
        {
          title: "Trade-offs",
          body: "Income and availability vary with attendance, and daily time tracking and invoicing remain part of the operating model.",
          bullets: [
            "Variable monthly cost",
            "Efficiency can reduce billable hours",
            "Hours may be negotiated down after stabilisation",
          ],
        },
      ],
    },
    {
      id: "option-b",
      eyebrow: "Commercial option B",
      title: "Fixed monthly technology optimisation retainer",
      subtitle:
        "Indicative range: R55,000–R60,000 per month, with a written scope boundary and review point",
      columns: [
        {
          title: "How it works",
          body: "CloudMonkey operates as an outsourced technology lead / fractional CTO with a defined monthly service boundary and regular review.",
          bullets: [
            "Predictable monthly cost",
            "No daily time-tracking friction",
            "Rewards efficient delivery",
            "Best reviewed after trust and baseline scope are established",
          ],
        },
        {
          title: "Advantages",
          body: "A stronger long-term operating relationship with predictable MRR and a single accountable technology partner.",
          bullets: [
            "Stable planning for STI",
            "Stable recurring revenue model",
            "Supports ongoing optimisation and governance",
          ],
        },
        {
          title: "Trade-offs",
          body: "A fixed fee must not become an unlimited promise. Scope, hours or outcomes, exclusions, and a 60–90 day review must be written clearly.",
          bullets: [
            "Higher approval hurdle",
            "Scope creep risk",
            "Capacity must be actively managed",
          ],
        },
      ],
    },
    {
      id: "option-c",
      eyebrow: "Alternative path",
      title: "Self-implementation with remote CloudMonkey backend support",
      subtitle: "CloudMonkey Build plan: R4,999 per month",
      body: "If STI Electrical prefers to implement internally and only wants CloudMonkey for backend and remote support, the engagement can move to the Build plan. This is a lower-commitment alternative to the on-site Phase 2 close-out and retainer model.",
      bullets: [
        "No on-site component and no R70,000 milestone project fee.",
        "CloudMonkey completes the remaining agreed ERP service remotely, within the selected Build plan and service boundaries.",
        "STI Electrical retains responsibility for locating data, coordinating internal users, and completing operational adoption.",
        "This route is honest about the trade-off: lower cost and commitment, but slower access to on-site operational discovery and process embedding.",
      ],
    },
    {
      id: "phase-2-commercial",
      eyebrow: "Recommended Phase 2 close-out structure",
      title: "R70,000 total, tied to verified close-offs rather than calendar promises.",
      metrics: [
        { value: "R35,000", label: "50% upfront · start and data foundation" },
        { value: "R17,500", label: "25% · Week 3 close-off" },
        { value: "R17,500", label: "25% · Week 4 acceptance" },
      ],
      body: "The estimate is approximately 70 on-site hours over four weeks. The payment schedule is milestone-based: the first payment starts the engagement, the second follows the Week 3 close-off, and the final payment follows documented UAT, training, and handover acceptance at Week 4.",
      bullets: [
        "The R1,000 rate covers travel to the Johannesburg manufacturing plant only; travel elsewhere is quoted separately.",
        "The Phase 2 fee completes the core build and handover. It does not require STI Electrical to buy a later retainer.",
      ],
    },
    {
      id: "plan",
      eyebrow: "Delivery plan",
      title: "Four weeks from data dependency to operational handover.",
      gantt: [
        {
          label: "Data, asset register & IT inventory",
          weeks: [1, 1],
          detail: "Locate and import missing data; open plant and stack audits.",
        },
        {
          label: "Consolidation, security & audit close-out",
          weeks: [2, 2],
          detail:
            "Real data across modules; fix known issues; complete audits; assess IoT readiness.",
        },
        {
          label: "Process implementation & validation",
          weeks: [3, 3],
          detail:
            "Embed workflow changes, validate real operations, document proposed layouts, deliver IoT readiness report.",
        },
        {
          label: "Training, UAT & handover",
          weeks: [4, 4],
          detail:
            "Train users, go-live checklist, documentation, access handover, signed acceptance.",
        },
        {
          label: "Optional CloudMonkey retainer",
          weeks: [5, 8],
          detail:
            "Only if STI Electrical elects to continue after Phase 2; monthly hour bundle or agreed fixed retainer.",
        },
      ],
      bullets: [
        "Every on-site day closes with a job card: hours, work completed, outcomes, evidence, and next actions.",
        "Weekly close-offs are decision points. If required data is still unavailable, the impact is recorded rather than hidden.",
      ],
    },
    {
      id: "week-detail",
      eyebrow: "Milestone detail",
      title: "What each close-off means in practical terms",
      columns: [
        {
          title: "Week 1",
          body: "A documented data capture plan is in motion.",
          bullets: [
            "Assets register drafted",
            "IT stack inventory started",
            "Data captured vs outstanding visible",
          ],
        },
        {
          title: "Week 2",
          body: "The ERP reflects consolidated real data and known issues are closed or logged.",
          bullets: [
            "Module consolidation",
            "Security fixes",
            "IT and plant audits complete",
            "IoT readiness assessment started",
          ],
        },
        {
          title: "Week 3",
          body: "Users begin operating improved processes against real workflows.",
          bullets: [
            "Sales/workshop/procurement support",
            "Layout evidence",
            "User-level validation",
            "IoT readiness report",
          ],
        },
        {
          title: "Week 4",
          body: "STI Electrical can run the platform independently.",
          bullets: [
            "Training",
            "Go-live readiness",
            "Documentation and access handover",
            "Signed UAT acceptance",
          ],
        },
      ],
    },
    {
      id: "infrastructure",
      eyebrow: "Separate infrastructure cost",
      title: "ERP hosting is transparent and separate from on-site work.",
      body: "The ERP is already deployed to cloud infrastructure. Server, backups, SSL, monitoring, security, and restore support are infrastructure services, not on-site consulting time. Once the final hosting footprint is confirmed, STI Electrical can select the appropriate Managed Cloud plan.",
      columns: [
        {
          title: "Managed Standard",
          body: "R1,450/month · setup R4,250",
          bullets: [
            "Managed hosting/VPS",
            "SSL and DNS",
            "Automated backups",
            "Uptime monitoring",
            "Standard support",
          ],
        },
        {
          title: "Managed Business",
          body: "R2,600/month · setup R7,000",
          bullets: [
            "Everything in Standard",
            "Performance tuning",
            "Database support",
            "Security updates",
            "Priority support",
          ],
        },
        {
          title: "Managed Enterprise",
          body: "R4,750/month · setup R12,500",
          bullets: [
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
      id: "boundaries",
      eyebrow: "Full truth and openness",
      title: "What is included, what depends on STI, and what is not being promised.",
      columns: [
        {
          title: "Included in Phase 2",
          body: "ERP completion, real-data consolidation, security fixes, process validation, training, documentation, UAT, and handover.",
          bullets: [
            "Job cards and weekly close-offs",
            "Technology and plant audits",
            "IoT readiness assessment",
          ],
        },
        {
          title: "STI dependencies",
          body: "Access to finance, stock, asset, and operational data; availability of users; timely decisions; and access to the plant and systems.",
          bullets: [
            "Data quality affects timing",
            "Third-party systems may need cooperation",
            "Hardware or service-provider costs are separate",
          ],
        },
        {
          title: "Not silently included",
          body: "IoT implementation, new hardware, major custom integrations, travel outside the Johannesburg plant, and unlimited support are separately scoped or quoted.",
          bullets: [
            "No guaranteed business result",
            "No hidden lock-in",
            "No requirement to continue after handover",
          ],
        },
      ],
    },
    {
      id: "after-phase-2",
      eyebrow: "Optional transition",
      title: "After Week 4, STI Electrical decides what happens next.",
      body: "If the core ERP is accepted, STI Electrical can operate independently. If continued support is valuable, the relationship can transition to a 10- or 20-hour monthly bundle, additional on-site time at R1,000/hour, or a defined fixed retainer. A six-month agreement can receive a 10% monthly discount and can be expanded across related STI ventures by mutual agreement.",
      bullets: [
        "The retainer can cover ongoing optimisation, layout/process work, barcode and scanning implementation, and access to service providers at cost.",
        "CloudMonkey maintenance and infrastructure plans remain separate from consulting hours.",
        "There is no automatic continuation and no Phase 2 dependency on accepting a retainer.",
      ],
    },
    {
      id: "decision",
      eyebrow: "Decision point",
      title: "Choose the operating model that fits STI Electrical now.",
      columns: [
        {
          title: "A · On-site close-out",
          body: "R70,000 over four weeks, milestone-billed, job-card backed, then an optional retainer.",
          accent: "violet",
        },
        {
          title: "B · Defined monthly retainer",
          body: "Approximately R55,000–R60,000/month with a written boundary and review point.",
          accent: "cyan",
        },
        {
          title: "C · Self-implementation",
          body: "R4,999/month Build plan with remote CloudMonkey backend support and no on-site close-out fee.",
          accent: "amber",
        },
      ],
      body: "Recommended opening: Option A is the lower-friction, lower-scope-risk path for closing the existing Phase 2 gap. Option B is the stronger long-term model once the baseline is established. Option C remains available if STI Electrical prefers to retain more internal implementation responsibility.",
    },
    {
      id: "next-steps",
      eyebrow: "Next steps",
      title: "If STI Electrical wants to proceed",
      bullets: [
        "Confirm the preferred commercial option and the decision-maker for UAT and weekly close-offs.",
        "Confirm on-site days, plant access, user availability, and the source systems for assets, finance, and stock.",
        "Approve the written Phase 2 addendum under the existing 26 March 2026 Master SLA & NDA.",
        "Pay the 50% start milestone of R35,000; schedule Week 1 and begin data/foundation work.",
      ],
      body: "This proposal is intended to make the decision clear, auditable, and reversible. Questions, requested changes, and a decision can be recorded through CloudMonkey alongside the shared deck.",
    },
  ],
};
