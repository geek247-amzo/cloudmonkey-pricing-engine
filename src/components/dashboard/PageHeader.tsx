import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-[#dfe4ef] pb-8 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        {eyebrow && <div className="sr-only">{eyebrow}</div>}
        <h1 className="text-2xl font-extrabold text-[#070b24] sm:text-[28px]" style={{ fontFamily: "var(--font-display)" }}>
          {title}
        </h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[#4d5874]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
