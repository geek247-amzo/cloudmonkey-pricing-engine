import mascot from "@/assets/cm-mascot.png.asset.json";
import type { ReactNode } from "react";

export function MascotHero({
  eyebrow,
  title,
  subtitle,
  ctas,
  accent = "var(--primary)",
  floating,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle: string;
  ctas?: ReactNode;
  accent?: string;
  floating?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
      <div
        className="absolute inset-0 -z-10 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(circle at 80% 20%, color-mix(in oklab, var(--primary-glow) 30%, transparent), transparent 50%), radial-gradient(circle at 20% 80%, color-mix(in oklab, var(--cloud) 20%, transparent), transparent 50%)",
        }}
      />
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-6 py-20 lg:grid-cols-2 lg:py-28">
        <div>
          {eyebrow && (
            <div
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider backdrop-blur"
              style={{ color: accent }}
            >
              {eyebrow}
            </div>
          )}
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl" style={{ fontFamily: "var(--font-display)" }}>
            {title}
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">{subtitle}</p>
          {ctas && <div className="mt-8 flex flex-wrap gap-3">{ctas}</div>}
        </div>
        <div className="relative flex items-center justify-center">
          <div className="absolute h-72 w-72 rounded-full blur-3xl sm:h-96 sm:w-96" style={{ background: `color-mix(in oklab, ${accent} 25%, transparent)` }} />
          <img src={mascot.url} alt="CloudMonkey mascot" className="relative z-10 h-80 w-auto drop-shadow-2xl sm:h-[28rem] lg:h-[32rem]" />
          {floating && <div className="pointer-events-none absolute inset-0 z-20">{floating}</div>}
        </div>
      </div>
    </section>
  );
}