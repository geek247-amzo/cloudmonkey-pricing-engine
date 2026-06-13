import { LockKeyhole, Sparkles, Users } from "lucide-react";
import type { ReactNode } from "react";

import logo from "@/assets/cm-logo.png";
import mascot from "@/assets/cm-mascot.png";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const HIGHLIGHTS = [
  { icon: Sparkles, title: "One identity", desc: "Email, Google, and Microsoft access in one flow." },
  { icon: LockKeyhole, title: "Security first", desc: "MFA, sessions, and recovery states built into the UI." },
  { icon: Users, title: "Team ready", desc: "Invite, link, and manage access without leaving the brand theme." },
] as const;

type AuthShellProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthShell({ eyebrow, title, subtitle, children, footer }: AuthShellProps) {
  return (
    <section className="relative overflow-hidden bg-[var(--gradient-hero)]">
      <div
        className="absolute inset-0 -z-10 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 20%, color-mix(in oklab, var(--cloud) 20%, transparent), transparent 28%), radial-gradient(circle at 85% 20%, color-mix(in oklab, var(--business) 16%, transparent), transparent 30%), radial-gradient(circle at 50% 90%, color-mix(in oklab, var(--primary-glow) 22%, transparent), transparent 34%)",
        }}
      />
      <div className="mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="relative hidden overflow-hidden border-r border-border/60 bg-foreground px-10 py-12 text-background lg:flex lg:flex-col">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_35%,rgba(255,255,255,0.04)_70%,transparent)]" />
          <div className="absolute -right-20 top-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-[color-mix(in_oklab,var(--primary)_30%,transparent)] blur-3xl" />

          <div className="relative flex items-center gap-3">
            <img src={logo} alt="CloudMonkey logo" className="h-11 w-11 shrink-0" />
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-background/55">CloudMonkey identity</div>
              <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Access everything</div>
            </div>
          </div>

          <div className="relative mt-10 max-w-xl">
            {eyebrow && (
              <Badge variant="outline" className="border-white/20 bg-white/10 text-background">
                {eyebrow}
              </Badge>
            )}
            <h1 className="mt-5 text-5xl font-bold tracking-tight sm:text-6xl" style={{ fontFamily: "var(--font-display)" }}>
              {title}
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-background/75">{subtitle}</p>
          </div>

          <div className="relative mt-10 space-y-4">
            {HIGHLIGHTS.map((item) => (
              <div key={item.title} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-background">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-background">{item.title}</div>
                  <div className="mt-1 text-sm leading-relaxed text-background/65">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="relative mt-auto pt-10">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.55)] backdrop-blur">
              <img src={mascot} alt="CloudMonkey mascot" className="mx-auto max-h-[360px] w-full object-contain" />
            </div>
          </div>
        </aside>

        <main className="flex items-center justify-center px-6 py-10 sm:px-8 lg:px-10">
          <div className="w-full max-w-xl">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <img src={logo} alt="CloudMonkey logo" className="h-10 w-10 shrink-0" />
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">CloudMonkey identity</div>
                <div className="text-lg font-bold tracking-tight text-foreground" style={{ fontFamily: "var(--font-display)" }}>Access everything</div>
              </div>
            </div>

            <Card className="overflow-hidden border-border/70 bg-card/92 shadow-[var(--shadow-elevated)] backdrop-blur">
              <CardHeader className="space-y-3 border-b border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.7),transparent)] pb-6">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">CloudMonkey account</div>
                <div className="text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: "var(--font-display)" }}>
                  {title}
                </div>
                <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">{children}</CardContent>
            </Card>

            {footer && <div className="px-1 pt-4 text-center text-sm text-muted-foreground">{footer}</div>}
          </div>
        </main>
      </div>
    </section>
  );
}
