import { useCurrency } from "@/lib/currency";
import { CURRENCIES } from "@/lib/pricing";

export function CurrencySwitcher() {
  const { currency, setCurrency } = useCurrency();
  return (
    <div className="relative">
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value as typeof currency)}
        className="cursor-pointer appearance-none rounded-full border border-border bg-card px-3 py-1.5 pr-7 text-xs font-semibold text-foreground hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
        aria-label="Currency"
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.symbol} {c.code}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" viewBox="0 0 12 12" fill="none">
        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}