import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Currency } from "./pricing";

interface Ctx {
  currency: Currency;
  setCurrency: (c: Currency) => void;
}

const CurrencyContext = createContext<Ctx | undefined>(undefined);

function detectInitialCurrency(): Currency {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === "Africa/Johannesburg" || tz === "Africa/Maseru" || tz === "Africa/Mbabane") {
      return "ZAR";
    }
    if (tz === "Europe/London" || tz === "Europe/Belfast" || tz === "Europe/Guernsey" || tz === "Europe/Jersey" || tz === "Europe/Isle_of_Man") {
      return "GBP";
    }
    // European countries default to EUR
    const euroZones = ["Europe/Paris", "Europe/Berlin", "Europe/Rome", "Europe/Madrid", "Europe/Brussels", "Europe/Amsterdam", "Europe/Vienna", "Europe/Dublin", "Europe/Athens", "Europe/Lisbon", "Europe/Helsinki"];
    if (euroZones.includes(tz) || (tz.startsWith("Europe/") && !tz.includes("London") && !tz.includes("Belfast"))) {
      return "EUR";
    }
  } catch {}

  try {
    const languages = navigator.languages || [navigator.language];
    for (const lang of languages) {
      const upper = lang.toUpperCase();
      if (upper.endsWith("-ZA") || upper === "ZA") return "ZAR";
      if (upper.endsWith("-GB") || upper === "GB") return "GBP";
      const euroLocales = ["-FR", "-DE", "-IT", "-ES", "-NL", "-BE", "-AT", "-FI", "-IE", "-PT", "-GR"];
      if (euroLocales.some(el => upper.endsWith(el))) return "EUR";
    }
  } catch {}

  return "USD";
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>("ZAR");
  useEffect(() => {
    try {
      const stored = localStorage.getItem("cm-currency") as Currency | null;
      if (stored) {
        setCurrency(stored);
      } else {
        setCurrency(detectInitialCurrency());
      }
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