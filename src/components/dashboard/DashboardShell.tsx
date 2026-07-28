import {
  Activity,
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
  HandCoins,
  Headphones,
  Home,
  KeyRound,
  LifeBuoy,
  Menu,
  ReceiptText,
  Search,
  Server,
  Settings,
  ShieldCheck,
  ShieldPlus,
  UserRound,
  WandSparkles,
  Wallet,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";

import logo from "@/assets/cm-logo.png";
import mascot from "@/assets/cm-mascot.png";
import { authClient } from "@/lib/auth-client";
import { signInPath } from "@/lib/auth-redirect";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

const mainNav = [{ to: "/dashboard", label: "Overview", icon: Home }] as const;

const userMenuNav = [
  { to: "/dashboard/agents", label: "AI Agents", icon: Bot },
  { to: "/dashboard/ai-website-builder", label: "AI Website Builder", icon: WandSparkles },
] as const;

const cloudNav = [
  { to: "/dashboard/domains", label: "Domains", icon: Globe },
  { to: "/dashboard/hosting", label: "Hosting", icon: Server },
  { to: "/dashboard/websites", label: "Websites", icon: HardDrive },
  { to: "/dashboard/reports", label: "Databases", icon: Database },
  { to: "/dashboard/reports", label: "Storage", icon: BriefcaseBusiness },
] as const;

const businessNav = [
  { to: "/dashboard/intelligence", label: "Intelligence", icon: FolderKanban },
  { to: "/dashboard/intelligence-wizard", label: "SEO Wizard", icon: Search },
  { to: "/dashboard/billing", label: "Billing", icon: ReceiptText },
  { to: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { to: "/dashboard/affiliates", label: "Affiliate Program", icon: HandCoins },
  { to: "/dashboard/reports", label: "Analytics", icon: BarChart3 },
  { to: "/dashboard/billing", label: "Invoices", icon: FileText },
] as const;

const bottomNav = [{ to: "/dashboard/support", label: "Support", icon: LifeBuoy }] as const;

const adminNav = [
  { to: "/dashboard/customers", label: "Customer Services", icon: UserRound },
  { to: "/dashboard/server-status", label: "Server Status", icon: Server },
  { to: "/dashboard/website-health", label: "Website Health", icon: Activity },
  { to: "/dashboard/cloud-security", label: "Cloud Security", icon: ShieldPlus },
  { to: "/dashboard/platform-credentials", label: "Provider API Keys", icon: KeyRound },
  { to: "/dashboard/website-projects", label: "Website Projects", icon: HardDrive },
  { to: "/dashboard/administration", label: "Platform Matrix", icon: ShieldCheck },
  { to: "/dashboard/administration", search: { tab: "agent" }, label: "Admin Agent", icon: Bot },
  { to: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { to: "/dashboard/affiliate-admin", label: "Affiliates", icon: HandCoins },
  { to: "/dashboard/crm", label: "CRM", icon: Headphones },
  { to: "/dashboard/proposals", label: "Proposal Manager", icon: FileText },
  { to: "/dashboard/users", label: "Users", icon: UserRound },
  { to: "/dashboard/roles", label: "Roles", icon: ShieldCheck },
  { to: "/dashboard/activity-logs", label: "Activity Logs", icon: Cloud },
  { to: "/dashboard/products", label: "Products & Pricing", icon: ReceiptText },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

const mobileNav = [
  mainNav[0],
  cloudNav[0],
  cloudNav[1],
  businessNav[2],
  businessNav[3],
  bottomNav[0],
] as const;

const adminMobileNav = [
  mainNav[0],
  adminNav[0],
  adminNav[1],
  adminNav[2],
  adminNav[6],
  bottomNav[0],
] as const;

export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const [isMounted, setIsMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [requiresTwoFactorSetup, setRequiresTwoFactorSetup] = useState(false);
  const [hasPrivateVps, setHasPrivateVps] = useState(false);
  const hydratedSession = isMounted ? session : null;
  const userName = hydratedSession?.user?.name || "User";
  const userEmail = hydratedSession?.user?.email || "";
  const userImage = hydratedSession?.user?.image || mascot;
  const firstName = userName.split(" ")[0];
  const userInitials = firstName.substring(0, 2).toUpperCase();
  const workspaceName = `${firstName}'s Workspace`;
  const isAdmin =
    hydratedSession?.user?.role === "admin" || hydratedSession?.user?.role === "owner";

  async function handleSignOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.assign("/auth/sign-in");
        },
      },
    });
  }

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || isSessionPending || session) return;
    const callbackURL = `${window.location.pathname}${window.location.search}`;
    window.location.replace(signInPath(callbackURL));
  }, [isMounted, isSessionPending, session]);

  useEffect(() => {
    if (!isMounted || !session) return;
    let cancelled = false;
    fetch("/api/user/security-status")
      .then((response) => (response.ok ? response.json() : null))
      .then((status) => {
        if (cancelled) return;
        const shouldSetup = Boolean(status?.requiresTwoFactorSetup);
        setRequiresTwoFactorSetup(shouldSetup);
        if (shouldSetup) router.navigate({ to: "/auth/two-factor/setup" });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isMounted, router, session]);

  useEffect(() => {
    if (!isMounted || !session || isAdmin) return;
    let cancelled = false;
    fetch("/api/user/vultr")
      .then((response) => (response.ok ? response.json() : []))
      .then((servers) => {
        if (cancelled) return;
        setHasPrivateVps(
          Array.isArray(servers) &&
            servers.some(
              (server) =>
                typeof server === "object" &&
                server !== null &&
                (server as { hostingMode?: string }).hostingMode === "private",
            ),
        );
      })
      .catch(() => {
        if (!cancelled) setHasPrivateVps(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, isMounted, session]);

  if (!isMounted || isSessionPending || !session || requiresTwoFactorSetup) {
    return (
      <section className="flex min-h-screen items-center justify-center bg-[#f6f8fc] px-4 text-[#07102c]">
        <div className="rounded-lg border border-[#dfe4ef] bg-white p-6 text-sm text-muted-foreground shadow-sm">
          {requiresTwoFactorSetup ? "Preparing account security..." : "Checking secure session..."}
        </div>
      </section>
    );
  }

  const visibleCloudNav = hasPrivateVps
    ? cloudNav
    : cloudNav.filter((item) => item.label !== "Hosting");

  return (
    <section className="dashboard-zoom-shell min-h-screen overflow-x-clip bg-[#f6f8fc] text-[#07102c]">
      <div className="dashboard-zoom-surface mx-auto grid min-h-screen max-w-[1920px] lg:grid-cols-[335px_1fr]">
        <aside className="hidden min-h-screen bg-[#070d23] text-white lg:flex lg:flex-col">
          <div className="flex h-[94px] items-center gap-4 border-b border-white/8 px-6">
            <img src={logo} alt="CloudMonkey" className="h-14 w-14 shrink-0" />
            <div
              className="text-[28px] font-extrabold text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              CloudMonkey
            </div>
          </div>

          <div className="px-5 py-6">
            <button className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.045] px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#6d34f7] text-base font-bold text-white">
                  {userInitials}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-white">{workspaceName}</div>
                  <div className="text-xs text-white/58">Workspace</div>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-white/60" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
            <nav className="space-y-1">
              <SidebarLink item={mainNav[0]} />
              {!isAdmin && (
                <>
                  {mainNav.slice(1).map((item) => (
                    <SidebarLink key={`${item.label}-${item.to}`} item={item} />
                  ))}
                  <SidebarGroup label="Cloud" icon={Cloud} items={visibleCloudNav} />
                </>
              )}
            </nav>

            {!isAdmin && (
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
            )}

            {isAdmin && (
              <div className="mt-6 border-t border-white/10 pt-5">
                <div className="mb-2 px-3 text-sm font-semibold text-white">Administration</div>
                <SidebarGroup
                  label="User menu"
                  icon={UserRound}
                  items={userMenuNav}
                  defaultOpen={false}
                />
                <nav className="space-y-1">
                  {adminNav.map((item) => (
                    <SidebarLink key={`${item.label}-${item.to}`} item={item} muted />
                  ))}
                </nav>
              </div>
            )}

            <div className="mt-6 border-t border-white/10 pt-5">
              <nav className="space-y-1">
                {bottomNav.map((item) => (
                  <SidebarLink key={`${item.label}-${item.to}`} item={item} muted />
                ))}
              </nav>
            </div>
          </div>

          <div className="p-5">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/[0.045] p-3 text-left text-white transition-colors hover:bg-white/8"
            >
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white">
                {hydratedSession?.user?.image ? (
                  <img
                    src={hydratedSession.user.image}
                    alt={userName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserRound className="h-6 w-6 text-[#07102c]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{userName}</div>
                <div className="truncate text-xs text-white/58">Sign out</div>
              </div>
              <ChevronRight className="h-4 w-4 text-white/60" />
            </button>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-col bg-[#f6f8fc]">
          <header className="sticky top-0 z-30 border-b border-[#dfe4ef] bg-white/92 px-4 py-3 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
                <img src={logo} alt="CloudMonkey" className="h-9 w-9 shrink-0" />
                <span
                  className="truncate text-lg font-extrabold"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  CloudMonkey
                </span>
              </Link>
              <div className="flex items-center gap-2">
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-full border-[#dfe4ef] bg-white"
                    >
                      <Menu className="h-5 w-5" />
                      <span className="sr-only">Open navigation menu</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="left"
                    className="w-[88vw] max-w-sm overflow-y-auto bg-[#070d23] p-0 text-white"
                  >
                    <div className="flex min-h-full flex-col">
                      <SheetHeader className="border-b border-white/10 px-5 py-5 text-left">
                        <SheetTitle className="text-white">CloudMonkey</SheetTitle>
                        <div className="text-sm text-white/60">Dashboard navigation</div>
                      </SheetHeader>

                      <div className="flex-1 px-4 py-4">
                        <div className="mb-4 flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.045] p-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#6d34f7] text-sm font-bold text-white">
                            {userInitials}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{workspaceName}</div>
                            <div className="truncate text-xs text-white/58">
                              {userEmail || "Signed in user"}
                            </div>
                          </div>
                        </div>

                        {isAdmin ? (
                          <>
                            <MobileNavSection
                              title="Administration"
                              items={[mainNav[0], ...adminNav]}
                              onNavigate={() => setMobileMenuOpen(false)}
                              muted
                            />
                            <MobileNavSection
                              title="User menu"
                              items={userMenuNav}
                              onNavigate={() => setMobileMenuOpen(false)}
                              muted
                            />
                          </>
                        ) : (
                          <>
                            <MobileNavSection
                              title="Main"
                              items={mainNav}
                              onNavigate={() => setMobileMenuOpen(false)}
                            />
                            <MobileNavSection
                              title="Cloud"
                              items={visibleCloudNav}
                              onNavigate={() => setMobileMenuOpen(false)}
                              nested
                            />
                            <MobileNavSection
                              title="Business"
                              items={businessNav}
                              onNavigate={() => setMobileMenuOpen(false)}
                              muted
                            />
                          </>
                        )}
                        <MobileNavSection
                          title="Support"
                          items={bottomNav}
                          onNavigate={() => setMobileMenuOpen(false)}
                          muted
                        />
                      </div>

                      <div className="border-t border-white/10 p-4">
                        <SheetClose asChild>
                          <button
                            type="button"
                            onClick={handleSignOut}
                            className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/[0.045] p-3 text-left text-white transition-colors hover:bg-white/8"
                          >
                            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white">
                              {hydratedSession?.user?.image ? (
                                <img
                                  src={hydratedSession.user.image}
                                  alt={userName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <UserRound className="h-5 w-5 text-[#07102c]" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-bold">{userName}</div>
                              <div className="truncate text-xs text-white/58">Sign out</div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-white/60" />
                          </button>
                        </SheetClose>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
                <img
                  src={userImage}
                  alt={userName}
                  className="h-10 w-10 rounded-full object-cover object-top"
                />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(isAdmin ? adminMobileNav : mobileNav)
                .filter((item) => item.label !== "Hosting" || hasPrivateVps)
                .map((item) => (
                  <Link
                    key={`${item.label}-${item.to}`}
                    to={item.to}
                    className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border border-[#dfe4ef] bg-white px-2 py-2 text-xs font-semibold text-[#58637e]"
                    activeProps={{
                      className:
                        "inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border border-transparent bg-[#5d2fe8] px-2 py-2 text-xs font-semibold text-white",
                    }}
                  >
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                ))}
            </div>
          </header>

          <main className="flex-1 min-w-0 overflow-x-clip px-4 py-5 sm:px-6 lg:px-9 lg:py-9 xl:px-10">
            <div className="mx-auto w-full min-w-0 max-w-[1536px]">{children}</div>
          </main>
        </div>
      </div>
    </section>
  );
}

function MobileNavSection({
  title,
  items,
  onNavigate,
  muted = false,
  nested = false,
}: {
  title: string;
  items: readonly SidebarItem[];
  onNavigate: () => void;
  muted?: boolean;
  nested?: boolean;
}) {
  return (
    <div className="mb-5">
      <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
        {title}
      </div>
      <nav className="space-y-1">
        {items.map((item) => (
          <SheetClose key={`${item.label}-${item.to}`} asChild>
            <Link
              to={item.to}
              search={item.search}
              onClick={onNavigate}
              className={`flex h-11 items-center gap-3 rounded-lg text-[15px] font-medium text-white/78 transition-colors hover:bg-white/[0.07] hover:text-white ${
                nested ? "px-6" : "px-3"
              }`}
              activeProps={{
                className:
                  "flex h-11 items-center gap-3 rounded-lg bg-[#5d2fe8] px-3 text-[15px] font-semibold text-white shadow-[0_10px_28px_-16px_rgba(93,47,232,0.85)]",
              }}
            >
              <item.icon
                className={`${nested ? "h-4 w-4" : "h-5 w-5"} ${muted ? "text-white/72" : ""}`}
              />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </Link>
          </SheetClose>
        ))}
      </nav>
    </div>
  );
}

type SidebarItem = {
  to: string;
  search?: Record<string, unknown>;
  label: string;
  icon: typeof Home;
};

function SidebarGroup({
  label,
  icon: Icon,
  items,
  defaultOpen = true,
}: {
  label: string;
  icon: typeof Home;
  items: readonly SidebarItem[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] font-semibold text-white/88 transition-colors hover:bg-white/[0.07]"
      >
        <Icon className="h-5 w-5" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-white/60" />
        ) : (
          <ChevronRight className="h-4 w-4 text-white/60" />
        )}
      </button>
      {open && (
        <nav className="mt-1 space-y-1 border-l border-white/10 pl-4">
          {items.map((item) => (
            <SidebarLink key={`${item.label}-${item.to}`} item={item} nested />
          ))}
        </nav>
      )}
    </div>
  );
}

function SidebarLink({
  item,
  muted = false,
  nested = false,
}: {
  item: SidebarItem;
  muted?: boolean;
  nested?: boolean;
}) {
  return (
    <Link
      to={item.to}
      search={item.search}
      className={`flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-medium text-white/78 transition-colors hover:bg-white/[0.07] hover:text-white ${
        nested ? "text-sm" : ""
      }`}
      activeProps={{
        className:
          "flex h-11 items-center gap-3 rounded-lg bg-[#5d2fe8] px-3 text-[15px] font-semibold text-white shadow-[0_10px_28px_-16px_rgba(93,47,232,0.85)]",
      }}
    >
      <item.icon className={`${nested ? "h-4 w-4" : "h-5 w-5"} ${muted ? "text-white/72" : ""}`} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </Link>
  );
}
