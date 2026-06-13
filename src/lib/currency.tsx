import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Currency } from "./pricing";

interface Ctx {
  currency: Currency;
  setCurrency: (c: Currency) => void;
}

const CurrencyContext = createContext<Ctx | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>("ZAR");
  useEffect(() => {
    try {
      const stored = localStorage.getItem("cm-currency") as Currency | null;
      if (stored) setCurrency(stored);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("cm-currency", currency);
    } catch {}
  }, [currency]);
  return <CurrencyContext.Provider value={{ currency, setCurrency }}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}