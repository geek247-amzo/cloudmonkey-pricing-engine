export type SeoFinding = { code: string; title: string; detail: string };

const BUNDLE_BY_FINDING: Record<string, string> = {
  https_required: "bundle_website_growth_seo",
  missing_title: "bundle_website_growth_seo",
  missing_description: "bundle_website_growth_seo",
  missing_alt_text: "bundle_website_growth_seo",
  missing_viewport: "bundle_website_growth_seo",
  http_status: "bundle_website_growth_seo",
  unreachable: "bundle_website_growth_seo",
};

export function mapFindingsToUpsells(findings: SeoFinding[]) {
  const bundleIds = [...new Set(findings.map((finding) => BUNDLE_BY_FINDING[finding.code]).filter(Boolean))];
  return bundleIds.map((bundleId) => ({ bundleId, label: "Website Growth + SEO", href: `/pricing?bundle=${bundleId}` }));
}

export function summarizeFindings(findings: SeoFinding[]) {
  return { count: findings.length, status: findings.length ? "needs_attention" : "healthy_baseline", upsells: mapFindingsToUpsells(findings) };
}
