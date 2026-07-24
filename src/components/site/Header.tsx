import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/cm-logo.png";
import { useHydratedSession } from "@/hooks/use-admin-access";
import { authClient } from "@/lib/auth-client";

const NAV = [
  { to: "/cloud", label: "Cloud" },
  { to: "/build", label: "Build" },
  { to: "/marketing", label: "Marketing" },
  { to: "/voice", label: "Voice" },
  { to: "/ai-agents", label: "AI Agents" },
  { to: "/domains", label: "Domains" },
  { to: "/pricing", label: "Pricing" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { data: session, authReady } = useHydratedSession();
  const isSignedIn = authReady && !!session;
  const getStartedHref = isSignedIn ? "/dashboard" : "/auth/sign-up";
  const getStartedLabel = isSignedIn ? "Dashboard" : "Get Started";

  async function handleSignOut() {
    setIsSigningOut(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => window.location.assign("/"),
        onError: () => setIsSigningOut(false),
      },
    });
  }
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
          {isSignedIn ? (
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              {isSigningOut ? "Signing out..." : "Sign out"}
            </button>
          ) : (
            <Link to="/auth/sign-in" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
          )}
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
              {isSignedIn ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void handleSignOut();
                  }}
                  disabled={isSigningOut}
                  className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
                >
                  {isSigningOut ? "Signing out..." : "Sign out"}
                </button>
              ) : (
                <Link
                  to="/auth/sign-in"
                  className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  Sign in
                </Link>
              )}
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
