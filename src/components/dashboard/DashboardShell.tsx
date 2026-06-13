import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  Cloud,
  Database,
  FileText,
  FolderKanban,
  Globe,
  HardDrive,
  Headphones,
  Home,
  LifeBuoy,
  PlugZap,
  ReceiptText,
  Server,
  Settings,
  ShieldCheck,
  UserRound,
  WandSparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import logo from "@/assets/cm-logo.png";
import mascot from "@/assets/cm-mascot.png";

const mainNav = [
  { to: "/dashboard", label: "Overview", icon: Home },
  { to: "/dashboard/ai-wizard", label: "AI Wizard", icon: WandSparkles },
  { to: "/dashboard/users", label: "AI Agents", icon: Bot },
  { to: "/dashboard/integrations", label: "Automation", icon: PlugZap, chevron: true },
  { to: "/dashboard/reports", label: "Cloud", icon: Cloud, chevron: true },
  { to: "/dashboard/billing", label: "Domains", icon: Globe },
  { to: "/dashboard/sessions", label: "Hosting", icon: Server },
  { to: "/dashboard/sessions", label: "Websites", icon: HardDrive },
  { to: "/dashboard/reports", label: "Databases", icon: Database },
  { to: "/dashboard/reports", label: "Storage", icon: BriefcaseBusiness },
  { to: "/dashboard/roles", label: "Security", icon: ShieldCheck },
  { to: "/dashboard/activity-logs", label: "Backups", icon: Cloud },
] as const;

const businessNav = [
  { to: "/dashboard/support", label: "CRM", icon: Headphones },
  { to: "/dashboard/activity-logs", label: "Projects", icon: FolderKanban },
  { to: "/dashboard/billing", label: "Billing", icon: ReceiptText },
  { to: "/dashboard/reports", label: "Analytics", icon: BarChart3 },
  { to: "/dashboard/billing", label: "Invoices", icon: FileText },
] as const;

const bottomNav = [
  { to: "/dashboard/support", label: "Support", icon: LifeBuoy },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

const mobileNav = [
  mainNav[0],
  mainNav[1],
  mainNav[2],
  mainNav[5],
  mainNav[6],
  bottomNav[1],
] as const;

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <section className="dashboard-zoom-shell min-h-screen overflow-x-hidden bg-[#f6f8fc] text-[#07102c]">
      <div className="dashboard-zoom-surface mx-auto grid min-h-screen max-w-[1920px] lg:grid-cols-[335px_1fr]">
        <aside className="hidden min-h-screen bg-[#070d23] text-white lg:flex lg:flex-col">
          <div className="flex h-[94px] items-center gap-4 border-b border-white/8 px-6">
            <img src={logo} alt="CloudMonkey" className="h-14 w-14 shrink-0" />
            <div className="text-[28px] font-extrabold text-white" style={{ fontFamily: "var(--font-display)" }}>
              CloudMonkey
            </div>
          </div>

          <div className="px-5 py-6">
            <button className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.045] px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#6d34f7] text-base font-bold text-white">
                  AC
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-white">Acme Corporation</div>
                  <div className="text-xs text-white/58">Workspace</div>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-white/60" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
            <nav className="space-y-1">
              {mainNav.map((item) => (
                <SidebarLink key={`${item.label}-${item.to}`} item={item} />
              ))}
            </nav>

            <div className="mt-6 border-t border-white/10 pt-5">
              <div className="mb-2 flex items-center justify-between px-3 text-sm font-semibold text-white">
                <span>Business</span>
                <ChevronDown className="h-4 w-4 text-white/70" />
              </div>
              <nav className="space-y-1">
                {businessNav.map((item) => (
                  <SidebarLink key={`${item.label}-${item.to}`} item={item} muted />
                ))}
              </nav>
            </div>

            <div className="mt-6 border-t border-white/10 pt-5">
              <nav className="space-y-1">
                {bottomNav.map((item) => (
                  <SidebarLink key={`${item.label}-${item.to}`} item={item} muted />
                ))}
              </nav>
            </div>
          </div>

          <div className="p-5">
            <Link to="/" className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.045] p-3 text-white transition-colors hover:bg-white/8">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white">
                <UserRound className="h-6 w-6 text-[#07102c]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">John Smith</div>
                <div className="truncate text-xs text-white/58">john@acme.com</div>
              </div>
              <ChevronRight className="h-4 w-4 text-white/60" />
            </Link>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col bg-[#f6f8fc]">
          <header className="sticky top-0 z-30 border-b border-[#dfe4ef] bg-white/92 px-4 py-3 backdrop-blur lg:hidden">
            <div className="mb-3 flex items-center justify-between">
              <Link to="/dashboard" className="flex items-center gap-2">
                <img src={logo} alt="CloudMonkey" className="h-9 w-9" />
                <span className="text-lg font-extrabold" style={{ fontFamily: "var(--font-display)" }}>CloudMonkey</span>
              </Link>
              <img src={mascot} alt="Account" className="h-10 w-10 rounded-full object-cover object-top" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {mobileNav.map((item) => (
                <Link
                  key={`${item.label}-${item.to}`}
                  to={item.to}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-[#dfe4ef] bg-white px-3 py-2 text-xs font-semibold text-[#58637e]"
                  activeProps={{ className: "inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-transparent bg-[#5d2fe8] px-3 py-2 text-xs font-semibold text-white" }}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              ))}
            </div>
          </header>

          <main className="flex-1 px-4 py-5 sm:px-6 lg:px-9 lg:py-9 xl:px-10">
            <div className="mx-auto max-w-[1536px]">{children}</div>
          </main>
        </div>
      </div>
    </section>
  );
}

type SidebarItem = {
  to: string;
  label: string;
  icon: typeof Home;
  chevron?: boolean;
};

function SidebarLink({ item, muted = false }: { item: SidebarItem; muted?: boolean }) {
  return (
    <Link
      to={item.to}
      className="flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-medium text-white/78 transition-colors hover:bg-white/[0.07] hover:text-white"
      activeProps={{
        className: "flex h-11 items-center gap-3 rounded-lg bg-[#5d2fe8] px-3 text-[15px] font-semibold text-white shadow-[0_10px_28px_-16px_rgba(93,47,232,0.85)]",
      }}
    >
      <item.icon className={`h-5 w-5 ${muted ? "text-white/72" : ""}`} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.chevron && <ChevronDown className="h-4 w-4 text-white/60" />}
    </Link>
  );
}
