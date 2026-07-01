import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { CurrencySwitcher } from "./CurrencySwitcher";
import logo from "@/assets/cm-logo.png";
import { useHydratedSession } from "@/hooks/use-admin-access";

const NAV = [
  { to: "/cloud", label: "Cloud" },
  { to: "/business", label: "Business" },
  { to: "/ai", label: "AI" },
  { to: "/ai-agents", label: "AI Agents" },
  { to: "/domains", label: "Domains" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const { data: session, authReady } = useHydratedSession();
  const isSignedIn = authReady && !!session;
  const signInHref = isSignedIn ? "/dashboard" : "/auth/sign-in";
  const signInLabel = isSignedIn ? "Dashboard" : "Sign in";
  const getStartedHref = isSignedIn ? "/dashboard" : "/auth/sign-up";
  const getStartedLabel = isSignedIn ? "Dashboard" : "Get Started";
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logo} alt="CloudMonkey logo" className="h-9 w-9 shrink-0" />
          <span className="text-lg font-bold tracking-tight text-foreground" style={{ fontFamily: "var(--font-display)" }}>
            CloudMonkey
          </span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "text-foreground bg-secondary" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <CurrencySwitcher />
          <Link to={signInHref} className="text-sm font-medium text-muted-foreground hover:text-foreground">
            {signInLabel}
          </Link>
          <Link
            to={getStartedHref}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elevated)] transition-transform hover:scale-[1.02]"
            style={{ background: "var(--gradient-primary)" }}
          >
            {getStartedLabel}
          </Link>
        </div>
        <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-border bg-background lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-4">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
                onClick={() => setOpen(false)}
              >
                {n.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
              <CurrencySwitcher />
              <Link
                to={getStartedHref}
                className="rounded-full px-4 py-2 text-sm font-semibold text-primary-foreground"
                style={{ background: "var(--gradient-primary)" }}
                onClick={() => setOpen(false)}
              >
                {getStartedLabel}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
