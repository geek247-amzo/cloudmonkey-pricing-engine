import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/cm-logo.png.asset.json";
import { CurrencySwitcher } from "./CurrencySwitcher";

const NAV = [
  { to: "/cloud", label: "Cloud" },
  { to: "/business", label: "Business" },
  { to: "/ai", label: "AI" },
  { to: "/ai-agents", label: "AI Agents" },
  { to: "/domains", label: "Domains" },
  { to: "/pricing", label: "Pricing" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logo.url} alt="CloudMonkey" className="h-9 w-9" />
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
          <Link to="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
          <Link
            to="/pricing"
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elevated)] transition-transform hover:scale-[1.02]"
            style={{ background: "var(--gradient-primary)" }}
          >
            Get Started
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
                to="/pricing"
                className="rounded-full px-4 py-2 text-sm font-semibold text-primary-foreground"
                style={{ background: "var(--gradient-primary)" }}
                onClick={() => setOpen(false)}
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}