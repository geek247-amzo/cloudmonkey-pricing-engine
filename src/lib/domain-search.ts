export type DomainCheckResult = {
  domain: string;
  tld: string;
  isAvailable: boolean;
  message: string;
  priceZar?: number;
  planId?: string;
  planName?: string;
};

const DEFAULT_TLDS = ["co.za", "com"] as const;

export function normalizeDomainQuery(input: string) {
  const value = input.trim().toLowerCase().replace(/\s+/g, "");
  if (!value) {
    return null;
  }

  const root = value.split(".")[0];
  if (!root) {
    return null;
  }

  return { value, root };
}

export function getDomainTldsFromPlans(plans: { name: string }[] | undefined | null) {
  const fromPlans = (plans ?? [])
    .map((plan) => extractTldFromName(plan.name))
    .filter((tld): tld is string => !!tld);

  return mergeTlds(DEFAULT_TLDS, fromPlans);
}

export function buildDomainCandidates(input: string, tlds: readonly string[]) {
  const normalized = normalizeDomainQuery(input);
  if (!normalized) {
    return [];
  }

  const candidates = mergeTlds(tlds.length ? tlds : DEFAULT_TLDS, DEFAULT_TLDS).map((tld) => ({
    domain: `${normalized.root}.${tld}`,
    tld,
  }));

  if (normalized.value.includes(".")) {
    const exactTld = normalized.value.split(".").slice(1).join(".");
    const exactDomain = normalized.value;
    const exactAlreadyIncluded = candidates.some((candidate) => candidate.domain === exactDomain);
    if (!exactAlreadyIncluded) {
      candidates.unshift({ domain: exactDomain, tld: exactTld || "custom" });
    }
  }

  return dedupeCandidates(candidates);
}

function extractTldFromName(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9-]+(?:\.[a-z0-9-]+)*)$/);
  return match?.[1] ?? null;
}

function mergeTlds(primary: readonly string[], secondary: readonly string[]) {
  return dedupeStrings([...primary, ...secondary]);
}

function dedupeStrings(values: string[]) {
  return [...new Set(values)];
}

function dedupeCandidates(values: { domain: string; tld: string }[]) {
  const seen = new Set<string>();
  return values.filter((item) => {
    if (seen.has(item.domain)) return false;
    seen.add(item.domain);
    return true;
  });
}
