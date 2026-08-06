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
  audioUrl?: string | null;
};

export type PitchDeckContent = {
  version: number;
  client: string;
  preparedBy: string;
  date: string;
  slides: PitchDeckSlide[];
};

export const STI_ELECTRICAL_PHASE_2_DECK: PitchDeckContent = {
  version: 2,
  client: "STI Electrical (Pty) Ltd",
  preparedBy: "H44S (Pty) Ltd t/a CloudMonkey",
  date: "29 July 2026",
  slides: [
    {
      id: "cover",
      eyebrow: "Confidential commercial proposal · STI-ONSITE-2026-07",
      title: "On-site ERP enablement and technology optimisation.",
      subtitle:
        "An optional 70-hour on-site service bundle supporting the original Phase 2 close-out, live-data consolidation, user enablement and production-floor implementation.",
      metrics: [
        {
          value: "Option A",
          label: "Standard SLA completion · no additional professional-services fee",
        },
        { value: "Option B", label: "Accelerated on-site enablement · 70 hours" },
        {
          value: "29 Jul 2026",
          label: "Prepared for Kiril Kutchoukov and the STI Electrical management team",
        },
      ],
    },
    {
      id: "executive-position",
      eyebrow: "1 · Executive position",
      title: "The original Phase 2 remains honoured. The on-site bundle is optional.",
      body: "STI Electrical has paid the full amount under the Master SLA. CloudMonkey remains committed to honouring the original Phase 2 deliverables. The R70,000 in Option B is not a second charge for those deliverables; it purchases a separate 70-hour embedded on-site service allocation requested to accelerate data consolidation, user enablement and production-floor implementation.",
      bullets: [
        "Phase 1 was completed and signed off by STI Electrical staff and management.",
        "Nexus ERP was configured, built, deployed and tested against approved workflows, using supplied operational information and seed data where live data was incomplete.",
        "The principal remaining dependency is operational adoption using STI's live data, with access to data owners, production personnel and decision-makers.",
      ],
    },
    {
      id: "current-status",
      eyebrow: "2 · Current delivery status",
      title: "The platform is ready for the next stage: live-data validation and user adoption.",
      columns: [
        {
          title: "Completed",
          body: "The analysis and core application work are in place.",
          bullets: [
            "Phase 1 completed and signed off",
            "ERP built, deployed and tested",
            "Approved workflows configured",
          ],
          accent: "violet",
        },
        {
          title: "Data available",
          body: "Information supplied by STI has been migrated where available.",
          bullets: [
            "Clients",
            "Suppliers",
            "Invoice information",
            "Seed data for incomplete live-data areas",
          ],
          accent: "cyan",
        },
        {
          title: "Still required",
          body: "The remaining work depends on reliable live data and participation.",
          bullets: [
            "Assets",
            "Financial information",
            "Stock/inventory",
            "User participation and formal UAT",
          ],
          accent: "amber",
        },
      ],
    },
    {
      id: "routes",
      eyebrow: "3 · Delivery options",
      title:
        "Two routes are available. The original Phase 2 deliverables remain honoured under both.",
      columns: [
        {
          title: "Option A · Standard SLA completion",
          body: "No additional professional-services fee for the original Phase 2 deliverables.",
          bullets: [
            "STI compiles, cleans and supplies data in agreed templates",
            "Scheduled remote sessions and planned implementation touchpoints",
            "Timing depends on data readiness and user availability",
            "No dedicated daily on-site resource allocation",
          ],
          accent: "cyan",
        },
        {
          title: "Option B · Accelerated on-site enablement",
          body: "R70,000 for 70 on-site hours at R1,000 per hour at STI's Johannesburg manufacturing facility.",
          bullets: [
            "CloudMonkey works directly with data owners and users",
            "Dedicated production-floor sessions",
            "Barcode/QR workflow implementation within the defined scope",
            "Target four-week programme, subject to readiness",
          ],
          accent: "violet",
        },
      ],
      body: "Option B is an acceleration service, not a replacement for STI's rights under the Master SLA. Purchased hours are first allocated to ERP close-out, live-data consolidation, user enablement and the agreed barcode/QR scope.",
    },
    {
      id: "option-a",
      eyebrow: "4 · Option A",
      title: "Complete the original Phase 2 through a structured, data-ready process.",
      body: "Under Option A, CloudMonkey completes the outstanding original Phase 2 deliverables without an additional professional-services fee once STI provides the required live data, appoints responsible data owners and makes the relevant users available.",
      bullets: [
        "STI provides complete asset, financial, stock, user and production information in agreed templates.",
        "STI assigns data owners and an authorised decision-maker.",
        "Users attend scheduled configuration, validation, training and UAT sessions.",
        "CloudMonkey completes configuration, testing, training, handover and the agreed remedy process.",
        "Dedicated daily on-site attendance, barcode/QR change scope and broader technology assessments are excluded from this route.",
      ],
    },
    {
      id: "option-b-priority",
      eyebrow: "5 · Option B",
      title: "Buy speed, proximity and embedded enablement—not the same Phase 2 twice.",
      subtitle: "70 on-site hours · R70,000 maximum bundle value · R1,000 per on-site hour",
      columns: [
        {
          title: "Priority 1",
          body: "Hours are first used for ERP close-out and production-floor enablement.",
          bullets: [
            "Live-data preparation and consolidation",
            "Reconciliation against source records",
            "Real-user workflow validation",
            "Access, training and UAT preparation",
            "Job card after every session",
          ],
          accent: "violet",
        },
        {
          title: "Production-floor scope",
          body: "The agreed barcode/QR scope turns traceability requirements into a tested Nexus workflow.",
          bullets: [
            "Mother coil to slit coil, cropping and final assembly stages",
            "Identifiers and scanning steps",
            "Material movement, loss and stage timing",
            "Floor-level user testing and training",
          ],
          accent: "cyan",
        },
        {
          title: "Priority 2",
          body: "Only if hours remain, or if STI approves additional hours in writing.",
          bullets: [
            "IT and software stack inventory",
            "Plant and machinery baseline",
            "Current versus proposed process flow",
            "IoT readiness assessment and recommendations",
          ],
          accent: "amber",
        },
      ],
    },
    {
      id: "boundaries",
      eyebrow: "6 · Boundaries and responsibilities",
      title: "The proposal is deliberately specific about what is—and is not—in the bundle.",
      columns: [
        {
          title: "STI provides",
          body: "Safe access, systems access, people and reliable source information.",
          bullets: [
            "Finance, operations, production and management availability",
            "Data owners and one authorised decision-maker",
            "Timely review of job cards, decisions and outputs",
            "Hardware and third-party procurement where required",
          ],
          accent: "cyan",
        },
        {
          title: "Excluded",
          body: "Costs and work outside the defined 70-hour service are not silently absorbed.",
          bullets: [
            "Scanners, printers, tablets, labels and consumables",
            "Wi-Fi, networking, electrical work and installation",
            "Machinery, PLC, sensor and advanced IoT integration",
            "AI, predictive systems, bespoke dashboards and custom automation",
            "Third-party licences and service-provider charges",
          ],
          accent: "amber",
        },
        {
          title: "Control point",
          body: "No work beyond the purchased bundle without STI's prior written approval.",
          bullets: [
            "Only physically delivered on-site hours are deducted unless approved otherwise",
            "Minimum on-site session: three hours",
            "Job cards submitted after each session",
            "Bundle intended for use within 60 calendar days",
          ],
          accent: "violet",
        },
      ],
    },
    {
      id: "plan",
      eyebrow: "7 · Indicative four-week plan",
      title: "A practical sequence from data and floor foundation to UAT and handover.",
      gantt: [
        {
          label: "Data and floor foundation",
          weeks: [1, 1],
          detail:
            "Confirm data owners; consolidate assets, financials and stock; confirm production stages and barcode/QR requirements.",
        },
        {
          label: "Consolidation and configuration",
          weeks: [2, 2],
          detail:
            "Import and validate live data; complete pre-production hardening; configure production tracking and scanning steps.",
        },
        {
          label: "Operational validation",
          weeks: [3, 3],
          detail:
            "Test real workflows; validate traceability; correct configuration defects; begin training.",
        },
        {
          label: "Training and close-out",
          weeks: [4, 4],
          detail: "Complete training; prepare handover; run UAT and the readiness walkthrough.",
        },
      ],
      bullets: [
        "Week 1 evidence: data register, issue log and approved implementation sequence.",
        "Week 2 evidence: validated data set, configuration record and security-hardening checklist.",
        "Week 3 evidence: user-test evidence, job cards and documented outstanding items.",
        "Week 4 evidence: training record, handover pack and UAT decision.",
        "The sequence is indicative. Hours are controlled by the purchased bundle and job cards, not by the passage of calendar weeks.",
      ],
    },
    {
      id: "commercial",
      eyebrow: "8 · Option B commercial terms",
      title: "Release the on-site hours in three clear blocks.",
      metrics: [
        {
          value: "35 hours",
          label: "Engagement confirmation · R35,000 · reserves the initial block",
        },
        { value: "17.5 hours", label: "After 35 logged hours · R17,500 · releases the next block" },
        {
          value: "17.5 hours",
          label: "After 52.5 logged hours · R17,500 · releases the final block",
        },
      ],
      bullets: [
        "The maximum bundle value is R70,000. A minimum on-site session of three hours applies.",
        "Travel to STI Electrical's Johannesburg manufacturing facility is included; travel elsewhere is separately quoted.",
        "Remote or administrative time is not deducted unless STI approves it in writing.",
        "Additional hours require prior written approval at the agreed R1,000/hour rate.",
        "Amounts are in South African rand; VAT, if applicable, will be shown on the tax invoice.",
        "This proposal is valid for 14 calendar days from 29 July 2026.",
      ],
    },
    {
      id: "hosting-independence",
      eyebrow: "9 · Hosting, ownership and handover",
      title: "STI keeps the choice of where and how the completed system is operated.",
      columns: [
        {
          title: "Self-hosted",
          body: "STI operates the deployed implementation independently and assumes responsibility for infrastructure, backups, monitoring, security operations and ongoing support.",
          accent: "cyan",
        },
        {
          title: "CloudMonkey Managed Standard",
          body: "From R1,450 per month, subject to final infrastructure confirmation.",
          bullets: [
            "Managed hosting/VPS",
            "SSL and DNS",
            "Automated backups",
            "Uptime monitoring",
            "Standard support",
          ],
          accent: "violet",
        },
        {
          title: "Ownership and exit",
          body: "STI retains ownership of its data and configured system outputs. Handover includes documentation, configurations, access credentials, data exports and knowledge transfer required by the Master SLA.",
          accent: "amber",
        },
      ],
      body: "The exact server specification, monthly charge, backup retention, support targets and any setup or migration charge will be confirmed in a separate hosting order before billing begins. Selecting Option B does not force future hosting, retainers or technology-assessment services.",
    },
    {
      id: "decision",
      eyebrow: "10 · Decision point",
      title:
        "Choose the route that matches STI Electrical's readiness and preferred level of on-site support.",
      columns: [
        {
          title: "Option A",
          body: "Standard SLA completion with no additional professional-services fee.",
          bullets: [
            "STI prepares and supplies data",
            "Scheduled sessions",
            "Timing follows readiness",
            "No dedicated daily on-site resource",
          ],
          accent: "cyan",
        },
        {
          title: "Option B",
          body: "Accelerated on-site enablement: 70 hours at R1,000/hour, maximum R70,000.",
          bullets: [
            "First 35-hour block: R35,000",
            "Production-floor barcode/QR scope",
            "Job-card accountability",
            "Four-week target, subject to readiness",
          ],
          accent: "violet",
        },
      ],
      body: "If Option A is selected, confirm the data-readiness checklist, responsible owners and session schedule. If Option B is selected, confirm the commencement date, on-site schedule and first 35-hour block. In either case, STI confirms its preferred hosting path before production go-live.",
    },
    {
      id: "acceptance",
      eyebrow: "11 · Acceptance",
      title: "A clear decision, with the original agreement still protecting both parties.",
      body: "This proposal is an optional service addendum between the same contracting parties: H44S (Pty) Ltd t/a CloudMonkey and STI Electrical (Pty) Ltd. The Master SLA remains in force for the original Phase 2 deliverables and prevails if there is a conflict, except for the expressly accepted commercial and operational terms governing the new 70-hour bundle.",
      bullets: [
        "Select Option A or Option B.",
        "Confirm the authorised decision-maker, data owners and access requirements.",
        "For Option B, confirm the start date, on-site schedule and first 35-hour block.",
        "Record the selected route, purchase order/reference and authorised signatures.",
      ],
      metrics: [
        { value: "STI Electrical", label: "Authorised representative" },
        {
          value: "Amrish Seunarain",
          label: "CEO / Programme Lead · H44S (Pty) Ltd t/a CloudMonkey",
        },
        { value: "STI-ONSITE-2026-07", label: "Proposal reference · valid 14 calendar days" },
      ],
    },
  ],
};

export const STI_RISK_PLATFORM_DECK: PitchDeckContent = {
  version: 1,
  client: "STI Risk",
  preparedBy: "H44S (Pty) Ltd t/a CloudMonkey",
  date: "6 August 2026",
  slides: [
    {
      id: "cover",
      eyebrow: "Confidential product definition and development proposal",
      title: "Build the STI Risk platform with clarity, control and a path to market.",
      subtitle:
        "A structured product-definition sprint, milestone-based development programme and managed CloudMonkey service for STI Risk.",
      metrics: [
        {
          value: "Separate engagement",
          label: "STI Risk scope, project record, support queue and billing cost centre",
        },
        {
          value: "Milestone-led",
          label: "Features agreed against acceptance criteria before development",
        },
        {
          value: "Cloud-ready",
          label: "Managed hosting, monitoring, backups and support available as a separate service",
        },
      ],
    },
    {
      id: "separation",
      eyebrow: "1 · Commercial separation",
      title: "STI Risk and STI Electrical are separate CloudMonkey engagements.",
      body: "Kiril may be involved in both businesses, but the work remains separated for scope, billing, accountability and data governance. A relationship view can show both engagements together while the underlying records never merge.",
      bullets: [
        "Separate customer/project record and engagement code",
        "Separate agreement, proposal, invoices and support queue",
        "Separate hosting environment and operating cost centre",
        "Meetings covering both entities are allocated and approved explicitly",
        "Information is not transferred between engagements without authorisation",
      ],
    },
    {
      id: "definition",
      eyebrow: "2 · Product Definition Sprint",
      title: "Turn the product idea into an executable delivery plan.",
      columns: [
        {
          title: "Strategy",
          body: "Clarify the target market, business problem and commercial model.",
          bullets: [
            "Product positioning",
            "User and buyer profiles",
            "Success measures",
            "Commercial assumptions",
          ],
          accent: "violet",
        },
        {
          title: "Workflows",
          body: "Map how risk work is requested, assessed, approved and reported.",
          bullets: [
            "Roles and permissions",
            "Core workflows",
            "Exception paths",
            "Audit requirements",
          ],
          accent: "cyan",
        },
        {
          title: "Blueprint",
          body: "Create the feature inventory and roadmap that development can follow.",
          bullets: [
            "Prioritised backlog",
            "Acceptance criteria",
            "Integration map",
            "Delivery milestones",
          ],
          accent: "amber",
        },
      ],
    },
    {
      id: "development",
      eyebrow: "3 · Milestone-based development",
      title: "Build against approved scope, visible progress and testable outcomes.",
      body: "Features are developed in approved milestones. Each milestone has a defined outcome, acceptance criteria, review point and decision record. New requirements are logged as a change request rather than silently absorbed into an existing estimate.",
      bullets: [
        "Discovery and product blueprint",
        "Platform foundation, roles and data model",
        "Priority workflows and reporting",
        "Integrations, testing and user acceptance",
        "Launch preparation, documentation and handover",
      ],
    },
    {
      id: "service",
      eyebrow: "4 · Managed CloudMonkey service",
      title: "The platform can remain supported without creating unlimited personal access.",
      columns: [
        {
          title: "Managed Cloud",
          body: "Hosting, SSL, DNS, backups, monitoring and security maintenance selected to fit the final footprint.",
          bullets: [
            "Separate environment",
            "Health monitoring",
            "Backup and restore process",
            "Support boundaries",
          ],
          accent: "cyan",
        },
        {
          title: "Specialist access",
          body: "Additional consulting, training and technical time is booked and approved rather than assumed to be unlimited.",
          bullets: [
            "Remote or on-site",
            "Duration and purpose",
            "Resource and attendees",
            "Prepaid or separately quoted",
          ],
          accent: "violet",
        },
        {
          title: "Reporting",
          body: "The customer sees decisions, approvals, requests, milestones and outcomes in the CloudMonkey workspace.",
          bullets: ["Project activity", "Support history", "Open approvals", "Usage and invoices"],
          accent: "amber",
        },
      ],
    },
    {
      id: "support-model",
      eyebrow: "5 · Support and booking model",
      title: "Every request has a home, an owner and a commercial status.",
      body: "WhatsApp and email remain useful communication channels, but the permanent record lives in CloudMonkey. Each request is classified before material work begins.",
      bullets: [
        "Incident or defect",
        "General support question",
        "Configuration request",
        "Training or consultation",
        "New development",
        "On-site, infrastructure or hosting work",
      ],
      metrics: [
        { value: "Included", label: "Delivered under the active service boundary" },
        { value: "Prepaid", label: "Deducted from an approved hour allocation" },
        { value: "Quoted", label: "New scope or dedicated work requiring approval" },
      ],
    },
    {
      id: "roadmap",
      eyebrow: "6 · Indicative roadmap",
      title: "A staged path from definition to a supported, measurable product.",
      gantt: [
        {
          label: "Product definition",
          weeks: [1, 2],
          detail:
            "Strategy, users, workflows, feature inventory, priorities and acceptance criteria.",
        },
        {
          label: "Foundation build",
          weeks: [3, 5],
          detail: "Data model, access control, core platform shell and audit trail.",
        },
        {
          label: "Priority workflows",
          weeks: [6, 9],
          detail:
            "Build the highest-value workflows, reports and integrations against approved criteria.",
        },
        {
          label: "Validation and launch",
          weeks: [10, 12],
          detail: "User testing, fixes, documentation, training, launch readiness and handover.",
        },
      ],
    },
    {
      id: "boundaries",
      eyebrow: "7 · Boundaries and decision points",
      title: "Transparency protects the product and the relationship.",
      bullets: [
        "STI Risk work is not included in STI Electrical's scope, and Electrical time cannot be used automatically for Risk.",
        "Third-party licences, infrastructure, travel, hardware and specialist costs are approved separately.",
        "Intellectual property, credentials and customer data remain separated by engagement.",
        "No material billable work begins without written approval or an approved prepaid allocation.",
        "The final roadmap, service level, hosting footprint and development milestones are confirmed before build commencement.",
      ],
      metrics: [
        { value: "STI Risk", label: "Dedicated customer engagement" },
        { value: "CloudMonkey", label: "Product, platform and delivery partner" },
        { value: "Kiril", label: "Authorised stakeholder across the relevant engagement" },
      ],
    },
  ],
};

export const STI_RISK_PRODUCT_PROPOSAL_DECK: PitchDeckContent = {
  version: 2,
  client: "STI Risk",
  preparedBy: "H44S (Pty) Ltd t/a CloudMonkey",
  date: "6 August 2026",
  slides: [
    {
      id: "cover",
      eyebrow: "Confidential build and managed-service proposal · Valid 14 days",
      title: "Build, launch and support the STI Risk platform.",
      subtitle:
        "A simple operating model: agree the build plan, deliver approved milestones, select the managed plan, and book additional help only when required.",
      metrics: [
        {
          value: "Milestone-led",
          label: "Build scope, price and payment trigger approved before work starts",
        },
        {
          value: "Managed",
          label: "Hosting, monitoring and routine support under a selected service order",
        },
        {
          value: "Bookable",
          label: "Remote or on-site assistance requested and paid through CloudMonkey",
        },
      ],
    },
    {
      id: "offer",
      eyebrow: "1 · The offer",
      title: "A controlled path from product idea to supported platform.",
      body: "CloudMonkey will first confirm what is already available, agree what must be built, and place the work into an approved milestone plan. CloudMonkey then builds and launches the approved platform on behalf of STI Risk. After launch, STI Risk selects the managed plan that fits its hosting, monitoring and support requirements.",
      bullets: [
        "Build work is approved and paid by milestone.",
        "Ongoing service is covered by the selected managed plan.",
        "Additional remote or on-site assistance is booked and paid only when needed.",
        "No disconnected messages or meetings become an uncontrolled feature commitment.",
      ],
    },
    {
      id: "scope",
      eyebrow: "2 · Scope",
      title: "Five components make the delivery model understandable.",
      columns: [
        {
          title: "Build plan",
          body: "Features, milestones, responsibilities, dependencies, target dates and acceptance checks.",
          accent: "violet",
        },
        {
          title: "Platform build",
          body: "Design, configuration and development of the features approved in the build plan.",
          accent: "cyan",
        },
        {
          title: "Testing and launch",
          body: "Demonstration, user acceptance testing, agreed corrections, deployment and handover.",
          accent: "amber",
        },
        {
          title: "Managed service",
          body: "Hosting, monitoring and support included in the selected managed plan.",
          accent: "violet",
        },
        {
          title: "Additional services",
          body: "Remote or on-site expertise booked separately through the CloudMonkey website.",
          accent: "cyan",
        },
      ],
    },
    {
      id: "separation",
      eyebrow: "3 · Customer separation",
      title: "STI Risk and STI Electrical remain separate CloudMonkey customers.",
      body: "This proposal applies only to STI Risk. It does not change, complete or extend any STI Electrical agreement or ERP deliverable.",
      bullets: [
        "Separate contracts and approved scope",
        "Separate project records and support tickets",
        "Separate managed plans, invoices and payment records",
        "Separate environments, data access and credentials where applicable",
        "Requests covering both companies are divided and logged against the correct customer",
      ],
    },
    {
      id: "journey",
      eyebrow: "4 · Initial platform journey",
      title: "The intended journey is clear without becoming an unlimited commitment.",
      columns: [
        {
          title: "1–2 · Enquiry to assessment",
          body: "Capture the customer, requested service, timing, location, assessment details, notes, evidence, photos and findings.",
          accent: "cyan",
        },
        {
          title: "3–4 · Scope to pitch",
          body: "Prepare recommendations, service options, controlled pricing, a branded pitch deck and—where selected—an AI text-to-audio overview.",
          accent: "violet",
        },
        {
          title: "5–6 · Agreement to payment",
          body: "Provide controlled proposal and agreement links, collect acceptance and provide the applicable payment link.",
          accent: "amber",
        },
        {
          title: "7–8 · Delivery to reporting",
          body: "Create the delivery project, responsibilities, tasks, evidence, progress updates, reports and follow-on opportunities.",
          accent: "cyan",
        },
      ],
      body: "The final feature list, sequence and milestone structure will be the approved build plan. This journey records the intended direction, not an unlimited feature commitment.",
    },
    {
      id: "build-control",
      eyebrow: "5 · Build and acceptance",
      title: "Every milestone has a price, proof and decision point.",
      bullets: [
        "CloudMonkey submits the proposed build plan and milestone quotation.",
        "STI Risk approves scope, price, prerequisites and target dates.",
        "Payment is completed in accordance with the milestone quotation.",
        "CloudMonkey schedules, performs and demonstrates the approved work.",
        "CloudMonkey supplies the agreed test evidence.",
        "STI Risk completes acceptance testing and provides one consolidated response.",
        "New features or changed requirements are added to the backlog and quoted before work starts.",
      ],
      metrics: [
        { value: "Approved", label: "Scope and milestone baseline" },
        { value: "Demonstrated", label: "Test evidence and user acceptance" },
        { value: "Controlled", label: "Change request before out-of-scope work" },
      ],
    },
    {
      id: "managed-plan",
      eyebrow: "6 · Managed plan",
      title: "Select the ongoing service after the platform footprint is known.",
      body: "Once the platform is ready for production, STI Risk selects the CloudMonkey managed plan appropriate to its hosting, monitoring and support requirements. The service order defines the exact inclusions, service levels, billing date, term and responsibilities.",
      columns: [
        {
          title: "Included",
          body: "Hosting, monitoring and routine support expressly included in the selected plan, plus listed maintenance.",
          accent: "cyan",
        },
        {
          title: "Booked or quoted",
          body: "New development, integrations, data work, dedicated workshops, training and implementation assistance.",
          accent: "violet",
        },
        {
          title: "Separate costs",
          body: "On-site attendance, travel, third-party licences, usage charges and external services unless expressly included.",
          accent: "amber",
        },
      ],
    },
    {
      id: "bookings",
      eyebrow: "7 · Remote and on-site services",
      title: "Additional help is simple to request and commercially clear.",
      columns: [
        {
          title: "Remote",
          body: "Select the available service and duration, pay at checkout, then attend the confirmed session remotely.",
          bullets: ["Consulting", "Training", "Troubleshooting", "Development review"],
          accent: "cyan",
        },
        {
          title: "On-site",
          body: "Provide the complete location. Professional time and applicable travel are calculated and approved before scheduling.",
          bullets: [
            "Minimum three-hour booking",
            "Location captured at checkout",
            "Travel shown where required",
            "No booking until checkout and confirmation",
          ],
          accent: "violet",
        },
      ],
      body: "A booking is only confirmed once checkout has been completed and CloudMonkey has issued the schedule confirmation. Extra work requires a further booking or approved quotation.",
    },
    {
      id: "responsibilities",
      eyebrow: "8 · Responsibilities",
      title: "A productive engagement needs clear ownership on both sides.",
      columns: [
        {
          title: "STI Risk",
          body: "Nominate the product owner and decision-makers; provide accurate requirements, examples, content, access and timely decisions; perform UAT; log support requests; book and pay for additional services.",
          accent: "cyan",
        },
        {
          title: "CloudMonkey",
          body: "Maintain the build plan and milestone record; build and demonstrate only approved scope; log support; deliver selected managed services; schedule paid bookings; calculate travel; apply agreed security and hosting controls.",
          accent: "violet",
        },
      ],
    },
    {
      id: "commercials",
      eyebrow: "9 · Commercial position",
      title: "The document is transparent about what is confirmed and what still needs approval.",
      bullets: [
        "Build pricing, payment milestones and dates are contained in the approved build plan or milestone quotation.",
        "The managed-plan fee and inclusions are contained in the selected service order.",
        "Ad hoc remote and on-site prices are displayed during website booking and paid at checkout.",
        "On-site bookings have a three-hour minimum and travel is calculated when required.",
        "Third-party licences, usage charges, payment processing, messaging and AI/audio services are excluded unless expressly included.",
        "All amounts are in South African rand; VAT, if applicable, is shown at quotation or checkout.",
      ],
      metrics: [
        { value: "Quote to confirm", label: "Build milestones and product-definition pricing" },
        { value: "Service order", label: "Managed hosting, monitoring and support" },
        { value: "Checkout", label: "Remote, on-site and travel charges where applicable" },
      ],
    },
    {
      id: "next-steps",
      eyebrow: "10 · Next steps",
      title: "Start with the decisions that make the first milestone executable.",
      bullets: [
        "Confirm the STI Risk legal contracting entity and authorised signatory.",
        "Confirm the product owner and users who may approve milestones and make bookings.",
        "Review and approve the initial build plan and first milestone quotation.",
        "Complete the first milestone payment so work can be scheduled.",
        "Select the managed plan before production launch.",
      ],
      metrics: [
        { value: "STI Risk", label: "Customer engagement" },
        { value: "Kiril", label: "Attention / authorised stakeholder to confirm" },
        { value: "CloudMonkey", label: "Build, manage and book support when required" },
      ],
    },
  ],
};
