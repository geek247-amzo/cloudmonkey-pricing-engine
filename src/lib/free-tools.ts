export type FreeToolKind = "ssl" | "uptime";

export type FreeToolFinding = { code: string; title: string; detail: string };

const BUNDLE_BY_TOOL: Record<FreeToolKind, { bundleId: string; label: string }> = {
  ssl: { bundleId: "bundle_managed_cloud_care", label: "Managed Cloud Care" },
  uptime: { bundleId: "bundle_managed_cloud_care", label: "Managed Cloud Care" },
};

export function mapFreeToolFindingsToUpsells(kind: FreeToolKind, findings: FreeToolFinding[]) {
  if (!findings.length) return [];
  const bundle = BUNDLE_BY_TOOL[kind];
  return [
    {
      bundleId: bundle.bundleId,
      label: bundle.label,
      href: `/pricing?bundle=${bundle.bundleId}`,
    },
  ];
}
