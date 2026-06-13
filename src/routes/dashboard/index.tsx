import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  Bot,
  CircleHelp,
  CirclePlus,
  Cloud,
  Cpu,
  Database,
  FileText,
  Globe,
  Headphones,
  MemoryStick,
  Monitor,
  MoreHorizontal,
  Plus,
  Search,
  Server,
  UploadCloud,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import mascot from "@/assets/cm-mascot.png";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [{ title: "Dashboard - CloudMonkey" }],
  }),
  component: DashboardOverviewPage,
});

const metrics: Metric[] = [
  { label: "Total Spend (This Month)", value: "$12,540.00", helper: "12% vs last month", helperTone: "positive", icon: Wallet, tone: "purple" },
  { label: "Active AI Agents", value: "12", helper: "2 new this week", helperTone: "positive", icon: Bot, tone: "violet" },
  { label: "Websites", value: "7", helper: "View all websites", helperTone: "link", icon: Globe, tone: "blue" },
  { label: "Domains", value: "23", helper: "Manage domains", helperTone: "link", icon: Globe, tone: "violet" },
  { label: "Cloud Resources", value: "18", helper: "View resources", helperTone: "warning", icon: Cloud, tone: "orange" },
];

const usageRows = [
  { label: "CPU Usage", value: 45, icon: Cpu },
  { label: "Memory Usage", value: 62, icon: MemoryStick },
  { label: "Storage Usage", value: 71, icon: Database },
  { label: "Bandwidth Usage", value: 32, icon: Headphones },
];

const activities = [
  { label: 'AI Agent "Sales Assistant" executed', time: "2 min ago", icon: Bot, tone: "violet" },
  { label: "Website acme.com deployed", time: "1 hour ago", icon: Globe, tone: "blue" },
  { label: "Domain acme.io renewed", time: "3 hours ago", icon: Globe, tone: "green" },
  { label: "Backup completed successfully", time: "Yesterday", icon: Cloud, tone: "green" },
  { label: "New user added: Jane Cooper", time: "2 days ago", icon: CirclePlus, tone: "purple" },
];

const agents = [
  ["Sales Assistant", "Responding to leads and qualifying prospects", "Active"],
  ["Customer Support Bot", "Handling customer inquiries 24/7", "Active"],
  ["Marketing Analyst", "Analyzing campaigns and generating reports", "Active"],
  ["Invoice Processor", "Processing and categorizing invoices", "Inactive"],
];

const domains = [
  ["acme.com", "Active", "Renews May 15, 2025"],
  ["acme.io", "Active", "Renews Jun 20, 2025"],
  ["acme.dev", "Active", "Renews Aug 10, 2025"],
  ["acme.co", "Expiring Soon", "Renews May 30, 2025"],
  ["acme.app", "Active", "Renews Sep 5, 2025"],
];

const hosting = [
  ["acme.com", "Business Plan", "Online"],
  ["shop.acme.com", "Business Plan", "Online"],
  ["blog.acme.com", "Starter Plan", "Online"],
  ["help.acme.com", "Starter Plan", "Maintenance"],
  ["old.acme.com", "Basic Plan", "Offline"],
];

const quickActions: QuickAction[] = [
  { label: "Deploy Website", icon: Monitor },
  { label: "Register Domain", icon: Globe },
  { label: "Create AI Agent", icon: Bot },
  { label: "Launch Server", icon: Cloud },
  { label: "Create Backup", icon: UploadCloud },
  { label: "View Invoices", icon: FileText },
  { label: "Open Ticket", icon: Headphones },
  { label: "More Actions", icon: CirclePlus, muted: true },
];

function DashboardOverviewPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Overview"
        title={<>Overview</>}
        subtitle="Welcome back, John! Here's what's happening with Acme Corporation."
        actions={<DashboardActions />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_0.95fr_1.2fr]">
        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
          <CardHeader className="flex-row items-center justify-between space-y-0 px-5 pb-2 pt-5">
            <CardTitle className="text-base font-bold text-[#07102c]">Spending Overview</CardTitle>
            <Button variant="outline" size="sm" className="h-8 rounded-md border-[#d9dfeb] bg-white px-3 text-xs text-[#23304d] shadow-none">
              This Month
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="flex items-center gap-4">
              <div className="text-[28px] font-extrabold text-[#07102c]" style={{ fontFamily: "var(--font-display)" }}>
                $12,540.00
              </div>
              <div className="text-sm font-medium text-[#139a52]">12% vs last month</div>
            </div>
            <SpendingChart />
          </CardContent>
        </Card>

        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
          <CardHeader className="px-5 pb-3 pt-5">
            <CardTitle className="text-base font-bold text-[#07102c]">Resource Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 px-5 pb-5">
            {usageRows.map((row) => (
              <div key={row.label} className="grid grid-cols-[28px_1fr_42px] items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md text-[#662ff0]">
                  <row.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm font-medium text-[#07102c]">
                    <span>{row.label}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#e5e8ef]">
                    <div className="h-2 rounded-full bg-[#642ef0]" style={{ width: `${row.value}%` }} />
                  </div>
                </div>
                <div className="text-right text-sm font-bold text-[#07102c]">{row.value}%</div>
              </div>
            ))}
            <Link to="/dashboard/reports" className="inline-flex items-center gap-2 text-sm font-semibold text-[#5526de]">
              View all resources
              <Plus className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
          <CardHeader className="flex-row items-center justify-between space-y-0 px-5 pb-2 pt-5">
            <CardTitle className="text-base font-bold text-[#07102c]">Recent Activity</CardTitle>
            <Link to="/dashboard/activity-logs" className="text-sm font-semibold text-[#5526de]">
              View all
            </Link>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {activities.map((activity) => (
              <div key={activity.label} className="flex items-center gap-4 border-b border-[#e6eaf2] py-3 last:border-0">
                <ToneIcon icon={activity.icon} tone={activity.tone} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[#07102c]">{activity.label}</div>
                </div>
                <div className="whitespace-nowrap text-xs text-[#58637e]">{activity.time}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <DataPanel title="AI Agents" action="View all agents" to="/dashboard/users">
          {agents.map(([name, desc, status], index) => (
            <div key={name} className="flex items-center gap-3 py-2.5">
              <img src={mascot} alt="" className="h-9 w-9 rounded-full bg-[#eef2ff] object-cover object-top" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-[#07102c]">{name}</div>
                <div className="truncate text-xs text-[#58637e]">{desc}</div>
              </div>
              <StatusBadge status={status} muted={index === 3} />
            </div>
          ))}
        </DataPanel>

        <DataPanel title="Domains" action="Manage all" to="/dashboard/billing">
          {domains.map(([name, status, renewal]) => (
            <div key={name} className="grid grid-cols-[28px_1fr_94px_142px] items-center gap-3 py-2.5 text-sm">
              <Globe className="h-6 w-6 text-[#1381ee]" />
              <div className="font-bold text-[#07102c]">{name}</div>
              <StatusBadge status={status} />
              <div className="text-right text-xs text-[#58637e]">{renewal}</div>
            </div>
          ))}
        </DataPanel>

        <DataPanel title="Hosting" action="Manage all" to="/dashboard/sessions">
          {hosting.map(([site, plan, status]) => (
            <div key={site} className="grid grid-cols-[28px_1fr_108px_92px_22px] items-center gap-3 py-2.5 text-sm">
              <Server className="h-6 w-6 text-[#642ef0]" />
              <div className="font-bold text-[#07102c]">{site}</div>
              <div className="text-xs text-[#58637e]">{plan}</div>
              <StatusBadge status={status} />
              <MoreHorizontal className="h-4 w-4 text-[#283759]" />
            </div>
          ))}
        </DataPanel>
      </div>

      <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
        <CardHeader className="px-6 pb-2 pt-5">
          <CardTitle className="text-base font-bold text-[#07102c]">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
            {quickActions.map((action) => (
              <button key={action.label} className="group flex min-h-[108px] flex-col items-center justify-center gap-3 rounded-md bg-white text-center transition-colors hover:bg-[#f6f8fc]">
                <span className={`flex h-14 w-14 items-center justify-center rounded-md ${action.muted ? "border border-dashed border-[#b9c1d2] bg-white text-[#58637e]" : "bg-[#f1eafe] text-[#642ef0]"}`}>
                  <action.icon className="h-7 w-7" />
                </span>
                <span className="text-sm font-medium text-[#07102c]">{action.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardActions() {
  return (
    <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto lg:justify-end">
      <div className="relative w-full sm:w-[350px]">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b859d]" />
        <Input
          placeholder="Search anything..."
          className="h-12 rounded-lg border-[#d6dce9] bg-white pl-11 pr-10 text-sm shadow-none placeholder:text-[#7b859d]"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#8b94aa]">⌘K</span>
      </div>
      <Button variant="ghost" size="icon" className="relative h-11 w-11 rounded-lg text-[#07102c]">
        <Bell className="h-5 w-5" />
        <span className="absolute right-2 top-2 h-4 min-w-4 rounded-full bg-[#ee2f45] px-1 text-[10px] font-bold leading-4 text-white">3</span>
      </Button>
      <Button variant="ghost" size="icon" className="h-11 w-11 rounded-lg text-[#07102c]">
        <CircleHelp className="h-5 w-5" />
      </Button>
      <img src={mascot} alt="Account" className="h-12 w-12 rounded-full object-cover object-top" />
      <Button className="h-11 rounded-lg bg-[#5d2fe8] px-4 text-sm font-bold text-white shadow-none hover:bg-[#4f27ce]">
        <Plus className="h-4 w-4" />
        Quick Actions
        <ChevronStub />
      </Button>
    </div>
  );
}

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
      <CardContent className="flex min-h-[128px] items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[#07102c]">{metric.label}</div>
          <div className="mt-3 text-[26px] font-extrabold leading-none text-[#07102c]" style={{ fontFamily: "var(--font-display)" }}>
            {metric.value}
          </div>
          <div className={`mt-3 text-sm font-medium ${helperClass(metric.helperTone)}`}>{metric.helper}</div>
        </div>
        <ToneIcon icon={metric.icon} tone={metric.tone} large />
      </CardContent>
    </Card>
  );
}

function DataPanel({ title, action, to, children }: { title: string; action: string; to: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
      <CardHeader className="flex-row items-center justify-between space-y-0 px-5 pb-2 pt-5">
        <CardTitle className="text-base font-bold text-[#07102c]">{title}</CardTitle>
        <Link to={to} className="text-sm font-semibold text-[#5526de]">
          {action}
        </Link>
      </CardHeader>
      <CardContent className="px-5 pb-4">{children}</CardContent>
    </Card>
  );
}

function StatusBadge({ status, muted = false }: { status: string; muted?: boolean }) {
  const classes = status === "Expiring Soon"
    ? "bg-[#fff1dc] text-[#c96300]"
    : status === "Maintenance"
      ? "bg-[#fff1dc] text-[#c96300]"
      : status === "Offline" || muted
        ? "bg-[#f0f2f7] text-[#58637e]"
        : "bg-[#dcf7e8] text-[#0c8843]";

  return <Badge className={`rounded-md px-2 py-1 text-xs font-semibold shadow-none ${classes}`}>{status}</Badge>;
}

function ToneIcon({ icon: Icon, tone, large = false }: { icon: LucideIcon; tone: Tone; large?: boolean }) {
  const tones: Record<Tone, string> = {
    purple: "bg-[#efe7ff] text-[#642ef0]",
    violet: "bg-[#f0e7ff] text-[#642ef0]",
    blue: "bg-[#e6f0ff] text-[#1381ee]",
    orange: "bg-[#fff0dc] text-[#f47a16]",
    green: "bg-[#dff8e9] text-[#169a4f]",
  };

  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full ${tones[tone]} ${large ? "h-16 w-16" : "h-9 w-9"}`}>
      <Icon className={large ? "h-8 w-8" : "h-5 w-5"} />
    </div>
  );
}

function SpendingChart() {
  return (
    <svg viewBox="0 0 720 280" className="mt-2 h-[240px] w-full">
      <defs>
        <linearGradient id="spend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6a31ef" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#6a31ef" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[36, 90, 144, 198, 252].map((y) => (
        <line key={y} x1="58" x2="698" y1={y} y2={y} stroke="#e7eaf2" strokeWidth="1" />
      ))}
      {["$20K", "$15K", "$10K", "$5K", "$0"].map((label, index) => (
        <text key={label} x="0" y={40 + index * 54} fill="#58637e" fontSize="13" fontWeight="600">{label}</text>
      ))}
      <path
        d="M58 226 L106 196 L154 165 L202 146 L250 116 L298 146 L346 110 L394 96 L442 50 L490 78 L538 118 L586 112 L634 120 L682 84 L698 88 L698 252 L58 252 Z"
        fill="url(#spend-fill)"
      />
      <path
        d="M58 226 L106 196 L154 165 L202 146 L250 116 L298 146 L346 110 L394 96 L442 50 L490 78 L538 118 L586 112 L634 120 L682 84 L698 88"
        fill="none"
        stroke="#642ef0"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
      <circle cx="698" cy="88" r="6" fill="#ffffff" stroke="#642ef0" strokeWidth="4" />
      {["May 1", "May 8", "May 15", "May 22", "May 29"].map((label, index) => (
        <text key={label} x={64 + index * 155} y="274" fill="#58637e" fontSize="13" fontWeight="600">{label}</text>
      ))}
    </svg>
  );
}

function ChevronStub() {
  return <span className="ml-1 border-l border-white/30 pl-3 text-base leading-none">⌄</span>;
}

function helperClass(tone: Metric["helperTone"]) {
  if (tone === "positive") return "text-[#139a52]";
  if (tone === "warning") return "text-[#f47a16]";
  return "text-[#5526de]";
}

type Tone = "purple" | "violet" | "blue" | "orange" | "green";

type Metric = {
  label: string;
  value: string;
  helper: string;
  helperTone: "positive" | "link" | "warning";
  icon: LucideIcon;
  tone: Tone;
};

type QuickAction = {
  label: string;
  icon: LucideIcon;
  muted?: boolean;
};
