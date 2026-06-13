import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  CircleX,
  Cloud,
  Database,
  Headphones,
  HeartHandshake,
  HelpCircle,
  Mail,
  Monitor,
  Network,
  Palette,
  PhoneCall,
  Rocket,
  Server,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Users,
  WandSparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";

import mascot from "@/assets/cm-mascot.png";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/dashboard/ai-wizard")({
  head: () => ({
    meta: [{ title: "AI Business Wizard - CloudMonkey" }],
  }),
  component: AiWizardPage,
});

const steps = [
  { id: "businessType", title: "About You" },
  { id: "industry", title: "Business Needs" },
  { id: "services", title: "Services" },
  { id: "preferences", title: "Preferences" },
  { id: "review", title: "Review & Confirm" },
] as const;

const wizardSteps: WizardStep[] = [
  {
    id: "businessType",
    greeting: "Hi John! Let's get to know your business",
    helper: "Answer a few questions and we'll recommend the best solutions for you.",
    question: "What best describes your business?",
    prompt: "Select the option that fits you best.",
    summaryLabel: "Business Type",
    options: [
      { id: "small-business", title: "Small Business", subtitle: "1 - 50 employees", detail: "Growing business", icon: Store, tone: "purple" },
      { id: "medium-business", title: "Medium Business", subtitle: "51 - 250 employees", detail: "Scaling operations", icon: Building2, tone: "blue" },
      { id: "enterprise", title: "Enterprise", subtitle: "250+ employees", detail: "Large organization", icon: Building2, tone: "green" },
      { id: "ecommerce", title: "E-Commerce", subtitle: "Online store", detail: "Selling products", icon: ShoppingCart, tone: "orange" },
      { id: "agency", title: "Agency / MSP", subtitle: "Service provider", detail: "Managing clients", icon: Users, tone: "pink" },
      { id: "non-profit", title: "Non-Profit", subtitle: "Non-profit organization", detail: "Making an impact", icon: HeartHandshake, tone: "purple" },
    ],
  },
  {
    id: "industry",
    greeting: "What kind of work does your business do?",
    helper: "Industry context helps tune AI agents, hosting needs, and support priorities.",
    question: "Choose the closest industry.",
    prompt: "Pick one primary industry for this workspace.",
    summaryLabel: "Industry",
    options: [
      { id: "retail", title: "Retail & E-Commerce", subtitle: "Stores, orders, inventory", detail: "Customer-facing operations", icon: ShoppingCart, tone: "orange" },
      { id: "professional-services", title: "Professional Services", subtitle: "Consulting, legal, finance", detail: "Client delivery teams", icon: Users, tone: "blue" },
      { id: "technology", title: "Technology", subtitle: "SaaS, software, platforms", detail: "Product and engineering", icon: Network, tone: "purple" },
      { id: "healthcare", title: "Healthcare", subtitle: "Clinics and care teams", detail: "Secure workflows", icon: HeartHandshake, tone: "green" },
      { id: "education", title: "Education", subtitle: "Schools and training", detail: "Learning operations", icon: Building2, tone: "blue" },
      { id: "other-industry", title: "Other", subtitle: "Mixed or specialized", detail: "Custom recommendation", icon: Sparkles, tone: "pink" },
    ],
  },
  {
    id: "services",
    greeting: "Which services should CloudMonkey prepare?",
    helper: "Select the services you want included in the recommended solution.",
    question: "What are you interested in?",
    prompt: "Choose one or more services.",
    summaryLabel: "Services Interest",
    multi: true,
    options: [
      { id: "ai-agents", title: "AI Agents", subtitle: "Sales, support, finance", detail: "Automate repeat work", icon: WandSparkles, tone: "purple" },
      { id: "websites", title: "Websites", subtitle: "Marketing and portals", detail: "Build and host sites", icon: Monitor, tone: "blue" },
      { id: "domains", title: "Domains", subtitle: "Register and manage", detail: "DNS and renewals", icon: Network, tone: "green" },
      { id: "cloud-hosting", title: "Cloud Hosting", subtitle: "Servers and apps", detail: "Managed infrastructure", icon: Cloud, tone: "purple" },
      { id: "email-apps", title: "Email & Apps", subtitle: "Google or Microsoft", detail: "Business productivity", icon: Mail, tone: "orange" },
      { id: "backups-security", title: "Backups & Security", subtitle: "Protection and recovery", detail: "Keep operations safe", icon: ShieldCheck, tone: "green" },
    ],
  },
  {
    id: "preferences",
    greeting: "How hands-on should the solution be?",
    helper: "These preferences guide the support model and implementation pace.",
    question: "Choose your preferred setup style.",
    prompt: "Select the option that best fits your team.",
    summaryLabel: "Primary Goal",
    options: [
      { id: "done-for-me", title: "Done-for-me setup", subtitle: "CloudMonkey handles it", detail: "Fastest path to launch", icon: Rocket, tone: "purple" },
      { id: "guided-setup", title: "Guided setup", subtitle: "We help your team", detail: "Balanced collaboration", icon: Headphones, tone: "blue" },
      { id: "self-service", title: "Self-service tools", subtitle: "Internal team leads", detail: "Control and flexibility", icon: Palette, tone: "green" },
      { id: "cost-control", title: "Lower monthly cost", subtitle: "Optimize essentials", detail: "Lean recommendation", icon: Database, tone: "orange" },
      { id: "growth-ready", title: "Growth-ready stack", subtitle: "Scale without rebuilds", detail: "Future-proof package", icon: Server, tone: "purple" },
      { id: "support-first", title: "Support-first", subtitle: "Reliable help desk", detail: "People and response time", icon: PhoneCall, tone: "pink" },
    ],
  },
];

const summaryItems: SummaryItem[] = [
  { stepId: "businessType", label: "Business Type", icon: Building2, tone: "purple" },
  { stepId: "industry", label: "Industry", icon: Building2, tone: "blue" },
  { stepId: "businessType", label: "Team Size", icon: Users, tone: "green" },
  { stepId: "preferences", label: "Primary Goal", icon: ShoppingCart, tone: "orange" },
  { stepId: "services", label: "Services Interest", icon: HeartHandshake, tone: "pink" },
];

const benefits = [
  { title: "Personalized Recommendations", subtitle: "Tailored to your needs", icon: ShieldCheck, tone: "purple" },
  { title: "Save Time & Money", subtitle: "Smart solutions that fit", icon: Rocket, tone: "blue" },
  { title: "Expert Support", subtitle: "We're here to help", icon: Headphones, tone: "cyan" },
  { title: "Secure & Reliable", subtitle: "Your business is safe", icon: ShieldCheck, tone: "green" },
] as const;

function AiWizardPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [answers, setAnswers] = useState<Record<WizardStepId, string[]>>({
    businessType: ["small-business"],
    industry: [],
    services: [],
    preferences: [],
  });

  const currentStep = wizardSteps[activeStep] ?? null;
  const completedCount = useMemo(() => getCompletedCount(answers, activeStep), [answers, activeStep]);
  const progress = Math.round((completedCount / steps.length) * 100);

  function selectOption(step: WizardStep, optionId: string) {
    setAnswers((current) => {
      const currentValues = current[step.id] ?? [];
      if (step.multi) {
        return {
          ...current,
          [step.id]: currentValues.includes(optionId)
            ? currentValues.filter((value) => value !== optionId)
            : [...currentValues, optionId],
        };
      }
      return { ...current, [step.id]: [optionId] };
    });
  }

  function goNext() {
    setActiveStep((step) => Math.min(step + 1, steps.length - 1));
  }

  function goBack() {
    setActiveStep((step) => Math.max(step - 1, 0));
  }

  return (
    <div className="space-y-4">
      <WizardHeader />

      <div className="rounded-lg border border-[#dfe4ef] bg-white p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] lg:p-7">
        <StepTracker activeStep={activeStep} />

        <div className="mt-7 grid gap-5 xl:grid-cols-[1fr_390px]">
          <div className="space-y-5">
            <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-none">
              <CardContent className="p-5 lg:p-7">
                {currentStep ? (
                  <WizardQuestion
                    step={currentStep}
                    activeStep={activeStep}
                    answers={answers}
                    onSelect={selectOption}
                  />
                ) : (
                  <ReviewStep answers={answers} />
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="outline"
                className="h-14 rounded-lg border-[#d8deea] bg-white px-8 text-base font-bold text-[#1d2946] shadow-none"
                onClick={goBack}
                disabled={activeStep === 0}
              >
                <ArrowLeft className="h-5 w-5" />
                Back
              </Button>
              <Button
                className="h-14 rounded-lg bg-[#5d2fe8] px-12 text-base font-bold text-white shadow-none hover:bg-[#4f27ce]"
                onClick={goNext}
                disabled={activeStep === steps.length - 1}
              >
                Next
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>

            <ProgressPanel progress={progress} />
            <BenefitsStrip />
          </div>

          <aside className="space-y-5">
            <SummaryPanel answers={answers} />
            <MascotPanel />
          </aside>
        </div>
      </div>
    </div>
  );
}

function WizardHeader() {
  return (
    <div className="flex flex-col gap-4 border-b border-[#dfe4ef] pb-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-4">
        <WandSparkles className="h-11 w-11 text-[#5d2fe8]" />
        <div>
          <h1 className="text-2xl font-extrabold text-[#07102c]" style={{ fontFamily: "var(--font-display)" }}>
            AI Business Wizard
          </h1>
          <p className="text-sm font-medium text-[#4d5874]">Let's build the perfect solution for your business.</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Button variant="outline" className="h-12 rounded-lg border-[#d8deea] bg-white px-5 text-sm font-bold text-[#07102c] shadow-none">
          <Headphones className="h-5 w-5" />
          Need help?
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-12 w-12 rounded-lg bg-[#f1f3f8] text-[#07102c]">
          <CircleX className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}

function StepTracker({ activeStep }: { activeStep: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-5">
      {steps.map((step, index) => {
        const isActive = index === activeStep;
        const isComplete = index < activeStep;
        return (
          <div key={step.id} className="relative flex flex-col items-center gap-3">
            {index < steps.length - 1 && (
              <div className={`absolute left-1/2 top-[22px] hidden h-1 w-full md:block ${isComplete ? "bg-[#5d2fe8]" : "bg-[#e5e8ef]"}`} />
            )}
            <div className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-full border text-base font-extrabold shadow-sm ${isActive || isComplete ? "border-[#5d2fe8] bg-[#5d2fe8] text-white" : "border-[#dfe4ef] bg-white text-[#07102c]"}`}>
              {isComplete ? <Check className="h-5 w-5" /> : index + 1}
            </div>
            <div className={`text-center text-sm font-bold ${isActive ? "text-[#5d2fe8]" : "text-[#07102c]"}`}>{step.title}</div>
          </div>
        );
      })}
    </div>
  );
}

function WizardQuestion({
  step,
  activeStep,
  answers,
  onSelect,
}: {
  step: WizardStep;
  activeStep: number;
  answers: Record<WizardStepId, string[]>;
  onSelect: (step: WizardStep, optionId: string) => void;
}) {
  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-[#07102c]" style={{ fontFamily: "var(--font-display)" }}>
            {step.greeting}
          </h2>
          <p className="mt-2 text-sm font-medium text-[#34415f]">{step.helper}</p>
        </div>
        <Badge className="w-fit rounded-lg bg-[#efe7ff] px-4 py-2 text-sm font-extrabold text-[#5d2fe8] shadow-none">
          Step {activeStep + 1} of 5
        </Badge>
      </div>

      <div className="mt-7 rounded-lg border border-[#dfe4ef] bg-white p-5 lg:p-7">
        <h3 className="text-xl font-extrabold text-[#07102c]" style={{ fontFamily: "var(--font-display)" }}>{step.question}</h3>
        <p className="mt-2 text-sm font-medium text-[#34415f]">{step.prompt}</p>

        <div className="mt-7 grid gap-5 lg:grid-cols-3">
          {step.options.map((option) => {
            const isSelected = (answers[step.id] ?? []).includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelect(step, option.id)}
                className={`relative flex min-h-[126px] items-center gap-5 rounded-lg border bg-white p-5 text-left transition-colors ${isSelected ? "border-[#9f7bff] ring-1 ring-[#9f7bff]" : "border-[#dfe4ef] hover:border-[#b8c1d3]"}`}
              >
                {isSelected && (
                  <span className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#5d2fe8] text-white">
                    <Check className="h-5 w-5" />
                  </span>
                )}
                <ToneTile icon={option.icon} tone={option.tone} />
                <span>
                  <span className="block text-base font-extrabold text-[#07102c]">{option.title}</span>
                  <span className="mt-2 block text-sm font-medium text-[#263653]">{option.subtitle}</span>
                  <span className="mt-1 block text-sm text-[#4d5874]">{option.detail}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-7 flex items-center gap-3 rounded-lg bg-[#eef6ff] px-4 py-4 text-sm font-medium text-[#0643b8]">
          <Sparkles className="h-5 w-5 shrink-0 text-[#5d2fe8]" />
          This helps us tailor the right services, recommendations and pricing for you.
        </div>
      </div>
    </div>
  );
}

function ReviewStep({ answers }: { answers: Record<WizardStepId, string[]> }) {
  const selectedServices = getSelectedTitles(answers.services, "services");
  const preference = getSelectedTitles(answers.preferences, "preferences")[0] ?? "Guided setup";
  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-[#07102c]" style={{ fontFamily: "var(--font-display)" }}>
            Review your recommended solution
          </h2>
          <p className="mt-2 text-sm font-medium text-[#34415f]">Confirm the choices below before your CloudMonkey team prepares the next step.</p>
        </div>
        <Badge className="w-fit rounded-lg bg-[#efe7ff] px-4 py-2 text-sm font-extrabold text-[#5d2fe8] shadow-none">
          Step 5 of 5
        </Badge>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-3">
        <ReviewCard title="Recommended Package" value="CloudMonkey Growth Stack" icon={Rocket} />
        <ReviewCard title="Setup Style" value={preference} icon={Headphones} />
        <ReviewCard title="Priority Services" value={selectedServices.length ? selectedServices.join(", ") : "AI Agents, Hosting, Backups"} icon={WandSparkles} />
      </div>

      <div className="mt-7 rounded-lg border border-[#dfe4ef] bg-[#f8faff] p-5">
        <h3 className="text-lg font-extrabold text-[#07102c]">Next actions</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {["Prepare solution summary", "Schedule setup call", "Create services checklist"].map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-lg bg-white p-4 text-sm font-bold text-[#07102c]">
              <Check className="h-5 w-5 text-[#139a52]" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryPanel({ answers }: { answers: Record<WizardStepId, string[]> }) {
  return (
    <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-[#5d2fe8]" />
          <h2 className="text-xl font-extrabold text-[#07102c]" style={{ fontFamily: "var(--font-display)" }}>Your Summary</h2>
        </div>
        <p className="mt-2 text-sm text-[#34415f]">Your responses will appear here</p>
        <div className="mt-5 border-t border-[#e3e7ef] pt-4">
          {summaryItems.map((item) => {
            const values = item.label === "Team Size"
              ? deriveTeamSize(answers.businessType)
              : getSelectedTitles(answers[item.stepId], item.stepId).join(", ");
            return (
              <div key={item.label} className="flex items-start gap-4 py-3">
                <ToneTile icon={item.icon} tone={item.tone} compact />
                <div>
                  <div className="text-sm font-extrabold text-[#07102c]">{item.label}</div>
                  <div className={`mt-1 text-sm font-medium ${values ? "text-[#5d2fe8]" : "text-[#5d2fe8]"}`}>{values || "Not selected"}</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function MascotPanel() {
  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-lg bg-[linear-gradient(180deg,#ffffff_0%,#f9f5ff_48%,#7d41fb_100%)]">
      <div className="absolute left-4 top-24 max-w-[170px] rounded-lg border border-[#cbb8ff] bg-white p-4 text-sm font-bold leading-relaxed text-[#07102c] shadow-lg">
        Don't worry, I'll guide you every step of the way!
        <span className="text-[#5d2fe8]">.</span>
      </div>
      <Sparkles className="absolute right-7 top-16 h-5 w-5 text-[#cbb8ff]" />
      <Sparkles className="absolute left-10 bottom-24 h-5 w-5 text-white/70" />
      <img src={mascot} alt="CloudMonkey mascot" className="absolute bottom-0 right-0 h-[380px] max-w-none object-contain" />
    </div>
  );
}

function ProgressPanel({ progress }: { progress: number }) {
  return (
    <div className="flex items-center gap-5 rounded-lg border border-[#dfe4ef] bg-white px-5 py-4">
      <ToneTile icon={WandSparkles} tone="purple" compact />
      <div className="text-sm font-extrabold text-[#07102c]">Your progress</div>
      <div className="h-2 flex-1 rounded-full bg-[#e5e8ef]">
        <div className="h-2 rounded-full bg-[#5d2fe8]" style={{ width: `${progress}%` }} />
      </div>
      <div className="w-24 text-right text-sm font-bold text-[#07102c]">{progress}% Complete</div>
    </div>
  );
}

function BenefitsStrip() {
  return (
    <div className="grid gap-3 rounded-lg border border-[#dfe4ef] bg-white p-4 md:grid-cols-4">
      {benefits.map((benefit) => (
        <div key={benefit.title} className="flex items-center gap-4 border-[#e5e8ef] md:border-r md:last:border-r-0">
          <ToneTile icon={benefit.icon} tone={benefit.tone} compact />
          <div>
            <div className="text-sm font-extrabold text-[#07102c]">{benefit.title}</div>
            <div className="mt-1 text-sm text-[#34415f]">{benefit.subtitle}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewCard({ title, value, icon }: { title: string; value: string; icon: LucideIcon }) {
  return (
    <div className="rounded-lg border border-[#dfe4ef] bg-white p-5">
      <ToneTile icon={icon} tone="purple" />
      <div className="mt-4 text-sm font-bold text-[#4d5874]">{title}</div>
      <div className="mt-2 text-lg font-extrabold text-[#07102c]">{value}</div>
    </div>
  );
}

function ToneTile({ icon: Icon, tone, compact = false }: { icon: LucideIcon; tone: Tone; compact?: boolean }) {
  const toneClass: Record<Tone, string> = {
    purple: "bg-[#efe7ff] text-[#5d2fe8]",
    blue: "bg-[#e6f0ff] text-[#1381ee]",
    green: "bg-[#dcf7e8] text-[#0c8843]",
    orange: "bg-[#fff0dc] text-[#f47a16]",
    pink: "bg-[#ffe1f1] text-[#e11783]",
    cyan: "bg-[#def7ff] text-[#0d94b8]",
  };
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg ${toneClass[tone]} ${compact ? "h-10 w-10" : "h-14 w-14"}`}>
      <Icon className={compact ? "h-5 w-5" : "h-7 w-7"} />
    </span>
  );
}

function getCompletedCount(answers: Record<WizardStepId, string[]>, activeStep: number) {
  const answeredSteps = wizardSteps.filter((step) => answers[step.id]?.length).length;
  return activeStep === 4 ? 5 : Math.max(answeredSteps, activeStep + 1);
}

function getSelectedTitles(ids: string[], stepId: WizardStepId) {
  const step = wizardSteps.find((item) => item.id === stepId);
  if (!step) return [];
  return ids.map((id) => step.options.find((option) => option.id === id)?.title).filter(Boolean) as string[];
}

function deriveTeamSize(ids: string[]) {
  const selected = ids[0];
  if (selected === "small-business") return "1 - 50 employees";
  if (selected === "medium-business") return "51 - 250 employees";
  if (selected === "enterprise") return "250+ employees";
  return "";
}

type WizardStepId = "businessType" | "industry" | "services" | "preferences";

type Tone = "purple" | "blue" | "green" | "orange" | "pink" | "cyan";

type WizardOption = {
  id: string;
  title: string;
  subtitle: string;
  detail: string;
  icon: LucideIcon;
  tone: Tone;
};

type WizardStep = {
  id: WizardStepId;
  greeting: string;
  helper: string;
  question: string;
  prompt: string;
  summaryLabel: string;
  multi?: boolean;
  options: WizardOption[];
};

type SummaryItem = {
  stepId: WizardStepId;
  label: string;
  icon: LucideIcon;
  tone: Tone;
};
