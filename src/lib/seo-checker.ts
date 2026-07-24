export type SeoFinding = { code: string; title: string; detail: string };

const BUNDLE_BY_FINDING: Record<string, { bundleId: string; label: string; category: string }> = {
  http_status: {
    bundleId: "bundle_build_launch",
    label: "Build Launch",
    category: "Build & technical health",
  },
  unreachable: {
    bundleId: "bundle_build_launch",
    label: "Build Launch",
    category: "Build & technical health",
  },
  h1_structure: {
    bundleId: "bundle_build_launch",
    label: "Build Launch",
    category: "Build & technical health",
  },
  broken_links: {
    bundleId: "bundle_build_launch",
    label: "Build Launch",
    category: "Build & technical health",
  },
  missing_title: {
    bundleId: "bundle_website_growth_seo",
    label: "Website Growth + SEO",
    category: "Search visibility",
  },
  missing_description: {
    bundleId: "bundle_website_growth_seo",
    label: "Website Growth + SEO",
    category: "Search visibility",
  },
  missing_alt_text: {
    bundleId: "bundle_website_growth_seo",
    label: "Website Growth + SEO",
    category: "Search visibility",
  },
  missing_robots: {
    bundleId: "bundle_website_growth_seo",
    label: "Website Growth + SEO",
    category: "Search visibility",
  },
  missing_sitemap: {
    bundleId: "bundle_website_growth_seo",
    label: "Website Growth + SEO",
    category: "Search visibility",
  },
  missing_structured_data: {
    bundleId: "bundle_website_growth_seo",
    label: "Website Growth + SEO",
    category: "Search visibility",
  },
  missing_open_graph: {
    bundleId: "bundle_website_growth_seo",
    label: "Website Growth + SEO",
    category: "Search visibility",
  },
  https_required: {
    bundleId: "bundle_website_growth_seo",
    label: "Website Growth + SEO",
    category: "Search visibility",
  },
  missing_viewport: {
    bundleId: "bundle_website_growth_seo",
    label: "Website Growth + SEO",
    category: "Website experience",
  },
  missing_canonical: {
    bundleId: "bundle_website_growth_seo",
    label: "Website Growth + SEO",
    category: "Website experience",
  },
  missing_html_lang: {
    bundleId: "bundle_website_growth_seo",
    label: "Website Growth + SEO",
    category: "Website experience",
  },
};

export function mapFindingsToUpsells(findings: SeoFinding[]) {
  const seen = new Set<string>();
  return findings.flatMap((finding) => {
    const bundle = BUNDLE_BY_FINDING[finding.code];
    if (!bundle || seen.has(bundle.bundleId)) return [];
    seen.add(bundle.bundleId);
    return [
      {
        bundleId: bundle.bundleId,
        label: bundle.label,
        href: `/pricing?bundle=${bundle.bundleId}`,
      },
    ];
  });
}

export function findingCategory(code: string) {
  return BUNDLE_BY_FINDING[code]?.category ?? "General review";
}

export function summarizeFindings(findings: SeoFinding[]) {
  return {
    count: findings.length,
    status: findings.length ? "needs_attention" : "healthy_baseline",
    upsells: mapFindingsToUpsells(findings),
  };
}
