import { Link } from "@tanstack/react-router";
import logo from "@/assets/cm-logo.png.asset.json";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border bg-foreground text-background">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <img src={logo.url} alt="CloudMonkey" className="h-9 w-9" />
              <span className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>CloudMonkey</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-background/70">
              The all-in-one platform for cloud infrastructure, business solutions, and AI agents — one invoice, one dashboard, one support team.
            </p>
          </div>
          <FooterCol title="Cloud" links={[
            { to: "/cloud", label: "Cloud Solutions" },
            { to: "/domains", label: "Domains" },
            { to: "/cloud", label: "Hosting" },
            { to: "/cloud", label: "Websites" },
          ]} />
          <FooterCol title="Business" links={[
            { to: "/business", label: "Managed IT" },
            { to: "/business", label: "Microsoft 365" },
            { to: "/business", label: "Hosted PBX" },
            { to: "/business", label: "Security" },
          ]} />
          <FooterCol title="AI" links={[
            { to: "/ai", label: "AI Assistant" },
            { to: "/ai-agents", label: "AI Agents" },
            { to: "/ai", label: "Voice Intelligence" },
            { to: "/ai", label: "OpenClaw Servers" },
          ]} />
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-background/10 pt-6 text-xs text-background/60 md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} CloudMonkey. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/pricing" className="hover:text-background">Pricing</Link>
            <a href="#" className="hover:text-background">Privacy</a>
            <a href="#" className="hover:text-background">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <h4 className="mb-4 text-sm font-semibold">{title}</h4>
      <ul className="space-y-2.5 text-sm text-background/70">
        {links.map((l, i) => (
          <li key={i}>
            <Link to={l.to} className="hover:text-background">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}