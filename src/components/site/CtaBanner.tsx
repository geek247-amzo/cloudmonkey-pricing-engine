import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function CtaBanner({ title, subtitle, primary, secondary, accent = "var(--primary)" }: {
  title: ReactNode;
  subtitle: string;
  primary: { label: string; to: string };
  secondary?: { label: string; to: string };
  accent?: string;
}) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div
        className="relative overflow-hidden rounded-3xl p-8 text-white sm:p-12"
        style={{ background: `linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 60%, #000))` }}
      >
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative grid items-center gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <h3 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ fontFamily: "var(--font-display)" }}>{title}</h3>
            <p className="mt-2 max-w-xl text-white/85">{subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={primary.to} className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-white/90">
              {primary.label}
            </Link>
            {secondary && (
              <Link to={secondary.to} className="rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20">
                {secondary.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}